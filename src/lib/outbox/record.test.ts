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

const { enqueueAccessEvent, isDraining, resetDrain, scheduleFlush } =
  await import("@/lib/outbox/record");

beforeEach(() => {
  resetDrain();
  enqueue.mockReset().mockResolvedValue({ id: 5 });
  flushPending.mockReset().mockResolvedValue([]);
  getConnection.mockReset().mockReturnValue({ getTransaction: vi.fn() });
  solanaSubmitter.fetchHead.mockReset();
  solanaSubmitter.submit.mockReset();
});

afterEach(() => {
  resetDrain();
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
