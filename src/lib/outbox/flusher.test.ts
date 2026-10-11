import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_ATTEMPTS,
  backoffMs,
  createMockSubmitter,
  flushEntry,
  flushPending,
} from "@/lib/outbox/flusher";
import { ChainSubmitError, classifySubmitError, type ChainSubmitter } from "@/lib/outbox/submitter";
import { ZERO_HASH, toHex } from "@/lib/solana/hash";
import type { OutboxEntry, OutboxStore } from "@/lib/outbox/store";

/**
 * The flusher depends only on `ChainSubmitter` and `OutboxStore`, which is why
 * this file needs no Solana connection, no keypair, and no database. Every test
 * here is about *retry semantics*, which is the part most likely to be wrong.
 */

function entry(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    id: 1,
    eventId: "e-1",
    patientId: 1,
    userId: 2,
    role: "doctor",
    action: "view",
    recordId: 10,
    serverId: "hospital-s",
    clientTime: new Date(1_700_000_000_000),
    attempt: 0,
    ...overrides,
  };
}

type Row = OutboxEntry & {
  status: "pending" | "flushing" | "anchored" | "failed";
  error: string | null;
  signature: string | null;
};

/** An in-memory store that behaves like the Postgres one, CAS claim included. */
function fakeStore(rows: OutboxEntry[] = [entry()]) {
  const state = new Map<number, Row>(
    rows.map((row) => [
      row.id,
      { ...row, status: "pending" as const, error: null, signature: null },
    ]),
  );

  const store: OutboxStore & { rows: Map<number, Row> } = {
    rows: state,
    async enqueue() {
      throw new Error("not used in these tests");
    },
    async pending(limit) {
      return [...state.values()].filter((row) => row.status === "pending").slice(0, limit);
    },
    async claim(id) {
      const row = state.get(id);
      if (!row || row.status !== "pending") {
        return null;
      }
      row.status = "flushing";
      row.attempt += 1;
      return row;
    },
    async markAnchored(id, result) {
      const row = state.get(id);
      if (row) {
        row.status = "anchored";
        row.signature = result.signature;
        row.error = null;
      }
    },
    async markRetry(id, attempt, error) {
      const row = state.get(id);
      if (row) {
        row.status = "pending";
        row.attempt = attempt;
        row.error = error;
      }
    },
    async markFailed(id, attempt, error) {
      const row = state.get(id);
      if (row) {
        row.status = "failed";
        row.attempt = attempt;
        row.error = error;
      }
    },
    async recoverStaleClaims() {
      let recovered = 0;
      for (const row of state.values()) {
        if (row.status === "flushing") {
          row.status = "pending";
          recovered += 1;
        }
      }
      return recovered;
    },
    async countPending() {
      return [...state.values()].filter((row) => row.status === "pending").length;
    },
  };

  return store;
}

/** Never actually sleeps, and records what it was asked to wait for. */
function fakeSleep() {
  const waits: number[] = [];
  return {
    waits,
    sleep: async (ms: number) => {
      waits.push(ms);
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("flushEntry", () => {
  it("anchors the entry and records the signature", async () => {
    const store = fakeStore();
    const submitter = createMockSubmitter();

    const result = await flushEntry(entry(), { store, submitter, sleep: async () => {} });

    expect(result.status).toBe("anchored");
    expect(store.rows.get(1)?.status).toBe("anchored");
    expect(store.rows.get(1)?.signature).toBe(result.signature);
  });

  it("advances the mocked chain head so a second event chains onto the first", async () => {
    const store = fakeStore([entry({ id: 1 }), entry({ id: 2 })]);
    const submitter = createMockSubmitter();
    const firstHead = toHex(ZERO_HASH);

    await flushPending({ store, submitter, sleep: async () => {} });

    expect(toHex(submitter.head)).not.toBe(firstHead);
    expect(store.rows.get(1)?.status).toBe("anchored");
    expect(store.rows.get(2)?.status).toBe("anchored");
  });

  describe("retry with re-read", () => {
    it("re-reads the head on every attempt instead of blind-retrying", async () => {
      const store = fakeStore();
      const submitter = createMockSubmitter({ chainBrokenCount: 2 });
      const fetchHead = vi.spyOn(submitter, "fetchHead");
      const submit = vi.spyOn(submitter, "submit");

      const result = await flushEntry(entry(), { store, submitter, sleep: async () => {} });

      expect(result.status).toBe("anchored");
      // Two contention failures plus the winning attempt.
      expect(submit).toHaveBeenCalledTimes(3);
      // A re-read per attempt is the whole point: a blind retry resubmits the
      // same stale prev_hash and fails forever.
      expect(fetchHead).toHaveBeenCalledTimes(3);
      expect(store.rows.get(1)?.status).toBe("anchored");
    });

    it("resolves concurrent writers via re-read rather than dropping the event", async () => {
      const store = fakeStore();
      const submitter = createMockSubmitter({ chainBrokenCount: 1 });
      const { waits, sleep } = fakeSleep();

      const result = await flushEntry(entry(), { store, submitter, sleep });

      expect(result.status).toBe("anchored");
      // Backoff grows, so the loser of the race does not hammer the cluster.
      expect(waits).toEqual([backoffMs(0)]);
    });

    it("parks the entry as failed once the attempts are exhausted", async () => {
      const store = fakeStore();
      const submitter: ChainSubmitter = {
        fetchHead: async () => Uint8Array.from(ZERO_HASH),
        submit: async () => {
          throw ChainSubmitError.chainBroken();
        },
      };

      const result = await flushEntry(entry(), { store, submitter, sleep: async () => {} });

      expect(result.status).toBe("failed");
      expect(store.rows.get(1)?.status).toBe("failed");
      expect(store.rows.get(1)?.error).toBe("contention");
      expect(store.rows.get(1)?.attempt).toBe(MAX_ATTEMPTS);
    });
  });

  describe("error classification", () => {
    it("leaves an RPC failure pending rather than losing the event", async () => {
      const store = fakeStore();
      const submitter: ChainSubmitter = {
        fetchHead: async () => Uint8Array.from(ZERO_HASH),
        submit: async () => {
          throw ChainSubmitError.transient("fetch failed: ECONNREFUSED");
        },
      };

      const result = await flushEntry(entry(), { store, submitter, sleep: async () => {} });

      expect(result.status).toBe("failed");
      // Not lost: the row keeps its error and its attempt count, so the next
      // sweep or an operator can pick it up.
      expect(store.rows.get(1)?.error).toBe("fetch failed: ECONNREFUSED");
      expect(store.rows.get(1)?.attempt).toBe(MAX_ATTEMPTS);
    });

    it("treats a head read failure as retryable and re-reads rather than failing", async () => {
      const store = fakeStore();
      let reads = 0;
      const submitter: ChainSubmitter = {
        fetchHead: async () => {
          reads += 1;
          if (reads < 3) {
            throw ChainSubmitError.transient("429 rate limited");
          }
          return Uint8Array.from(ZERO_HASH);
        },
        submit: async () => "sig-ok",
      };

      const result = await flushEntry(entry(), { store, submitter, sleep: async () => {} });

      expect(reads).toBe(3);
      expect(result.status).toBe("anchored");
    });

    it("fails fast on an auth error without retrying", async () => {
      const store = fakeStore();
      const submitter: ChainSubmitter = {
        fetchHead: async () => Uint8Array.from(ZERO_HASH),
        submit: async () => {
          throw ChainSubmitError.terminal("unauthorized signer");
        },
      };
      const { waits, sleep } = fakeSleep();
      const submit = vi.fn(submitter.submit);

      const result = await flushEntry(entry(), {
        store,
        submitter: { ...submitter, submit },
        sleep,
      });

      expect(result.status).toBe("failed");
      expect(submit).toHaveBeenCalledTimes(1);
      expect(waits).toEqual([]);
      expect(store.rows.get(1)?.status).toBe("failed");
      expect(store.rows.get(1)?.error).toBe("unauthorized signer");
    });
  });

  describe("concurrency and restart", () => {
    it("skips a row another server already claimed", async () => {
      const store = fakeStore();
      const submitter = createMockSubmitter();
      // Pretend a sibling server won the compare-and-swap.
      const row = store.rows.get(1);
      if (row) {
        row.status = "anchored";
      }

      const result = await flushEntry(entry(), { store, submitter, sleep: async () => {} });

      expect(result.status).toBe("skipped");
      expect(submitter.head).toEqual(ZERO_HASH);
    });

    it("lets two concurrent flushes of the same row anchor exactly once", async () => {
      const store = fakeStore();
      const submitter = createMockSubmitter();

      const [a, b] = await Promise.all([
        flushEntry(entry(), { store, submitter, sleep: async () => {} }),
        flushEntry(entry(), { store, submitter, sleep: async () => {} }),
      ]);

      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual(["anchored", "skipped"]);
      expect(store.rows.get(1)?.attempt).toBe(1);
    });

    it("resumes a pending row left behind by a previous process", async () => {
      // What a crash mid-flush leaves in Postgres: status pending, attempt > 0.
      const store = fakeStore([entry({ attempt: 2 })]);
      const submitter = createMockSubmitter();

      const result = await flushEntry(entry(), { store, submitter, sleep: async () => {} });

      expect(result.status).toBe("anchored");
      expect(store.rows.get(1)?.attempt).toBe(3);
    });

    it("recovers rows stranded in flushing by a process that died", async () => {
      // Claimed, then the worker was killed before it could mark anything.
      const store = fakeStore();
      const row = store.rows.get(1);
      if (row) {
        row.status = "flushing";
        row.attempt = 1;
      }
      const submitter = createMockSubmitter();

      const results = await flushPending({ store, submitter, sleep: async () => {} });

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe("anchored");
    });

    it("does not let one poisoned row stop the sweep", async () => {
      const store = fakeStore([entry({ id: 1 }), entry({ id: 2 })]);
      let calls = 0;
      const submitter: ChainSubmitter = {
        fetchHead: async () => Uint8Array.from(ZERO_HASH),
        submit: async () => {
          calls += 1;
          if (calls === 1) {
            throw ChainSubmitError.terminal("unauthorized signer");
          }
          return `sig-${calls}`;
        },
      };

      const results = await flushPending({ store, submitter, sleep: async () => {} }, 10);

      expect(results.map((result) => result.status)).toEqual(["failed", "anchored"]);
      expect(store.rows.get(1)?.status).toBe("failed");
      expect(store.rows.get(2)?.status).toBe("anchored");
    });
  });
});

describe("backoffMs", () => {
  it("doubles per attempt", () => {
    expect(backoffMs(0)).toBe(250);
    expect(backoffMs(1)).toBe(500);
    expect(backoffMs(2)).toBe(1000);
  });

  it("caps so a stuck row cannot hold a worker forever", () => {
    expect(backoffMs(20)).toBe(30_000);
  });

  it("treats a negative attempt as the first one", () => {
    expect(backoffMs(-1)).toBe(250);
  });
});

describe("classifySubmitError", () => {
  it("recognises ChainBroken by name", () => {
    expect(classifySubmitError(new Error("ChainBroken"))).toBe("chain-broken");
  });

  it("recognises ChainBroken by its custom error code", () => {
    expect(classifySubmitError(new Error("custom program error: 0x1771"))).toBe("chain-broken");
    expect(classifySubmitError({ message: "failed", code: 6001 })).toBe("chain-broken");
  });

  it("recognises auth failures as terminal", () => {
    expect(classifySubmitError(new Error("Unauthorized"))).toBe("terminal");
    expect(classifySubmitError({ message: "custom program error", code: 6000 })).toBe("terminal");
  });

  it("treats transport failures as transient", () => {
    expect(classifySubmitError(new Error("fetch failed"))).toBe("transient");
    expect(classifySubmitError(new Error("429 Too Many Requests"))).toBe("transient");
  });

  it("defaults an unknown error to transient rather than dropping the event", () => {
    expect(classifySubmitError(new Error("something new"))).toBe("transient");
  });

  it("survives non-Error throwables", () => {
    expect(classifySubmitError(null)).toBe("transient");
    expect(classifySubmitError("ChainBroken")).toBe("chain-broken");
    expect(classifySubmitError(undefined)).toBe("transient");
  });

  it("passes an already-classified error straight through", () => {
    expect(classifySubmitError(ChainSubmitError.terminal("nope"))).toBe("terminal");
  });
});

describe("createMockSubmitter", () => {
  it("moves its head on a successful submit", async () => {
    const submitter = createMockSubmitter();

    await submitter.submit(
      {
        patientHash: new Uint8Array(32),
        actorHash: new Uint8Array(32),
        action: 0,
        role: 0,
        recordId: 1n,
        server: 0,
        timestamp: 1n,
      },
      ZERO_HASH,
    );

    expect(submitter.head).not.toEqual(ZERO_HASH);
  });

  it("throws whatever the caller asked it to", async () => {
    const submitter = createMockSubmitter({ failWith: () => new Error("boom") });

    await expect(
      submitter.submit(
        {
          patientHash: new Uint8Array(32),
          actorHash: new Uint8Array(32),
          action: 0,
          role: 0,
          recordId: 1n,
          server: 0,
          timestamp: 1n,
        },
        ZERO_HASH,
      ),
    ).rejects.toThrow("boom");
  });
});
