import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The request path must never block on the chain. These tests assert the two
 * properties that give: the write is durable and awaited, and the drain is
 * fire-and-forget and shared rather than per-write.
 */

const enqueue = vi.fn();
vi.mock("@/lib/outbox/store", () => ({
  prismaOutboxStore: {
    enqueue: (...args: unknown[]) => enqueue(...args),
  },
}));

const flushPending = vi.fn();
vi.mock("@/lib/outbox/flusher", () => ({
  flushPending: (...args: unknown[]) => flushPending(...args),
}));

const solanaSubmitter = { fetchHead: vi.fn(), submit: vi.fn() };
vi.mock("@/lib/solana/submitter", () => ({ solanaSubmitter }));

const getConnection = vi.fn();
vi.mock("@/lib/solana/client", () => ({ getConnection }));

const { enqueueAccessEvent, isDraining, recordAccessEvent, resetDrain, scheduleFlush } =
  await import("@/lib/outbox/record");

beforeEach(() => {
  resetDrain();
  process.env.SOLANA_PROGRAM_ID = "11111111111111111111111111111111";
  enqueue.mockReset().mockResolvedValue({ id: 5 });
  flushPending.mockReset().mockResolvedValue([]);
  getConnection.mockReset().mockReturnValue({ getTransaction: vi.fn() });
  solanaSubmitter.fetchHead.mockReset();
  solanaSubmitter.submit.mockReset();
});

afterEach(() => {
  resetDrain();
  delete process.env.SOLANA_PROGRAM_ID;
});

describe("recordAccessEvent", () => {
  it("writes one durable row carrying a fresh eventId", async () => {
    await recordAccessEvent({
      userId: 1,
      patientId: 2,
      recordId: 3,
      action: "view",
      serverId: "hospital-s",
    });

    expect(enqueue).toHaveBeenCalledTimes(1);
    const written = enqueue.mock.calls[0]?.[0] as { eventId: string; action: string };
    expect(written.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(written.action).toBe("view");
  });

  it("returns the event it recorded, for the caller to inspect or broadcast", async () => {
    const event = await recordAccessEvent({
      userId: 1,
      patientId: 2,
      recordId: null,
      action: "view_denied",
      serverId: "hospital-s",
    });

    expect(event).toMatchObject({
      userId: 1,
      patientId: 2,
      recordId: null,
      action: "view_denied",
      serverId: "hospital-s",
      status: "pending",
    });
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("uses the same eventId for the row and the returned event", async () => {
    const event = await recordAccessEvent({
      userId: 1,
      patientId: 2,
      recordId: 3,
      action: "view",
      serverId: "hospital-s",
    });

    expect((enqueue.mock.calls[0]?.[0] as { eventId: string }).eventId).toBe(event.eventId);
  });

  it("propagates a failed durable write, because a dropped audit entry is the failure this prevents", async () => {
    enqueue.mockRejectedValue(new Error("database is gone"));

    await expect(
      recordAccessEvent({
        userId: 1,
        patientId: 2,
        recordId: 3,
        action: "view",
        serverId: "hospital-s",
      }),
    ).rejects.toThrow("database is gone");

    expect(flushPending).not.toHaveBeenCalled();
  });

  it("schedules the chain flush without awaiting it", async () => {
    await recordAccessEvent({
      userId: 1,
      patientId: 2,
      recordId: 3,
      action: "view",
      serverId: "hospital-s",
    });

    await vi.waitFor(() => expect(flushPending).toHaveBeenCalledTimes(1));
  });
});

describe("enqueueAccessEvent", () => {
  it("returns the id of the durable row", async () => {
    await expect(
      enqueueAccessEvent({
        eventId: "e-1",
        patientId: 1,
        userId: 2,
        recordId: 3,
        action: "view",
        serverId: "hospital-s",
      }),
    ).resolves.toBe(5);
  });

  it("passes the caller's client time through when given one", async () => {
    const clientTime = new Date(1_700_000_000_000);

    await enqueueAccessEvent({
      eventId: "e-1",
      patientId: 1,
      userId: 2,
      recordId: null,
      action: "view",
      serverId: "hospital-s",
      clientTime,
    });

    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ clientTime }));
  });
});

describe("scheduleFlush", () => {
  it("returns immediately rather than exposing a promise to await", () => {
    expect(scheduleFlush()).toBeUndefined();
  });

  it("drains the outbox against the real submitter", async () => {
    scheduleFlush();
    await vi.waitFor(() => expect(flushPending).toHaveBeenCalledTimes(1));

    expect(flushPending).toHaveBeenCalledWith(
      expect.objectContaining({ submitter: solanaSubmitter }),
    );
  });

  it("shares one drain across a burst of writes", async () => {
    scheduleFlush();
    scheduleFlush();
    scheduleFlush();

    await vi.waitFor(() => expect(flushPending).toHaveBeenCalledTimes(1));
  });

  it("allows a later drain once the current one finishes", async () => {
    scheduleFlush();
    await vi.waitFor(() => expect(isDraining()).toBe(false));

    scheduleFlush();

    await vi.waitFor(() => expect(flushPending).toHaveBeenCalledTimes(2));
  });

  it("swallows a failed drain, because a flusher failure is not a user error", async () => {
    flushPending.mockRejectedValue(new Error("rpc down"));

    expect(() => scheduleFlush()).not.toThrow();
    await vi.waitFor(() => expect(isDraining()).toBe(false));
  });

  it("records the slot when the signature can be resolved", async () => {
    getConnection.mockReturnValue({
      getTransaction: vi.fn().mockResolvedValue({ slot: 1_234 }),
    });
    flushPending.mockImplementation(
      async (deps: { resolveSlot?: (s: string) => Promise<bigint | null> }) => {
        await expect(deps.resolveSlot?.("sig-1")).resolves.toBe(1234n);
      },
    );

    scheduleFlush();

    await vi.waitFor(() => expect(flushPending).toHaveBeenCalled());
  });

  it("treats an unresolvable slot as cosmetic rather than failing the flush", async () => {
    getConnection.mockReturnValue({
      getTransaction: vi.fn().mockRejectedValue(new Error("not found")),
    });
    flushPending.mockImplementation(
      async (deps: { resolveSlot?: (s: string) => Promise<bigint | null> }) => {
        await expect(deps.resolveSlot?.("sig-1")).resolves.toBeNull();
      },
    );

    scheduleFlush();

    await vi.waitFor(() => expect(flushPending).toHaveBeenCalled());
  });
});

describe("scheduleFlush without a deployment", () => {
  it("does not touch the submitter, because queued is the correct state", async () => {
    // Without this guard every event burned its full retry budget and was
    // parked as `failed` — permanently — for a deploy that had not happened.
    delete process.env.SOLANA_PROGRAM_ID;

    scheduleFlush();
    await vi.waitFor(() => expect(isDraining()).toBe(false));

    expect(flushPending).not.toHaveBeenCalled();
  });

  it("still records the event durably, so nothing is lost while unconfigured", async () => {
    delete process.env.SOLANA_PROGRAM_ID;

    await recordAccessEvent({
      userId: 1,
      patientId: 2,
      recordId: 3,
      action: "view",
      serverId: "hospital-s",
    });

    expect(enqueue).toHaveBeenCalledTimes(1);
  });
});
