import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  hasPendingEvents,
  startOutboxSweep,
  stopOutboxSweep,
  sweepOutbox,
  getOutboxSweepStatus,
} from "@/lib/outbox/sweep";

/**
 * The sweep exists for the case a write-triggered flush cannot cover: a
 * transient failure followed by an idle server. So the tests are about what it
 * skips and what it does not.
 */

const countPending = vi.fn();
vi.mock("@/lib/outbox/store", () => ({
  prismaOutboxStore: { countPending: () => countPending() },
}));

const flushPending = vi.fn();
vi.mock("@/lib/outbox/flusher", () => ({
  flushPending: (...args: unknown[]) => flushPending(...args),
}));

vi.mock("@/lib/solana/submitter", () => ({
  solanaSubmitter: { fetchHead: vi.fn(), submit: vi.fn() },
}));
vi.mock("@/lib/solana/client", () => ({
  getConnection: () => ({ getTransaction: vi.fn().mockResolvedValue({ slot: 5 }) }),
}));

const CONFIGURED = "11111111111111111111111111111111";

beforeEach(() => {
  stopOutboxSweep();
  countPending.mockReset().mockResolvedValue(0);
  flushPending.mockReset().mockResolvedValue([]);
  process.env.SOLANA_PROGRAM_ID = CONFIGURED;
});

afterEach(() => {
  stopOutboxSweep();
  delete process.env.SOLANA_PROGRAM_ID;
});

describe("hasPendingEvents", () => {
  it("is false without touching the database when no program is configured", async () => {
    delete process.env.SOLANA_PROGRAM_ID;

    await expect(hasPendingEvents()).resolves.toBe(false);
    expect(countPending).not.toHaveBeenCalled();
  });

  it("is false when the queue is empty", async () => {
    await expect(hasPendingEvents()).resolves.toBe(false);
  });

  it("is true when rows are waiting", async () => {
    countPending.mockResolvedValue(2);

    await expect(hasPendingEvents()).resolves.toBe(true);
  });
});

describe("sweepOutbox", () => {
  it("flushes when rows are pending", async () => {
    countPending.mockResolvedValue(1);

    await sweepOutbox();

    expect(flushPending).toHaveBeenCalledTimes(1);
  });

  it("does not touch the chain when nothing is pending", async () => {
    await sweepOutbox();

    expect(flushPending).not.toHaveBeenCalled();
  });

  it("records the sweep even when nothing was pending", async () => {
    await sweepOutbox();

    expect(getOutboxSweepStatus().sweeps).toBeGreaterThan(0);
    expect(getOutboxSweepStatus().lastError).toBeNull();
  });

  it("never throws when the flush fails, and records the error", async () => {
    countPending.mockResolvedValue(1);
    flushPending.mockRejectedValue(new Error("rpc down"));

    await expect(sweepOutbox()).resolves.toBeUndefined();
    expect(getOutboxSweepStatus().lastError).toBe("rpc down");
  });

  it("resolves the slot so an anchored row carries one", async () => {
    countPending.mockResolvedValue(1);
    flushPending.mockImplementation(
      async (deps: { resolveSlot?: (s: string) => Promise<bigint | null> }) => {
        await expect(deps.resolveSlot?.("sig")).resolves.toBe(5n);
      },
    );

    await sweepOutbox();

    expect(flushPending).toHaveBeenCalled();
  });

  it("treats an unresolvable slot as cosmetic", async () => {
    countPending.mockResolvedValue(1);
    vi.doMock("@/lib/solana/client", () => ({
      getConnection: () => ({ getTransaction: vi.fn().mockRejectedValue(new Error("nope")) }),
    }));

    await expect(sweepOutbox()).resolves.toBeUndefined();
    vi.doUnmock("@/lib/solana/client");
  });
});

describe("startOutboxSweep", () => {
  it("sweeps once immediately so a restart drains without waiting a tick", async () => {
    countPending.mockResolvedValue(1);

    startOutboxSweep(60_000);

    await vi.waitFor(() => expect(flushPending).toHaveBeenCalledTimes(1));
  });

  it("is idempotent, because two bundles could both try to start it", async () => {
    startOutboxSweep(60_000);
    startOutboxSweep(60_000);

    expect(getOutboxSweepStatus().running).toBe(true);
  });

  it("stops cleanly so tests do not leak a timer", () => {
    startOutboxSweep(60_000);
    stopOutboxSweep();

    expect(getOutboxSweepStatus().running).toBe(false);
  });
});
