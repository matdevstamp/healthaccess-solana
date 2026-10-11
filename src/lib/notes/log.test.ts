import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * logNoteAccess is the seam every note-reading route calls. Three rules matter:
 * the outbox row is durable before anything else happens, the chain flush is
 * never awaited, and the peer sync still runs.
 */

const createAccessLog = vi.fn();
vi.mock("@/lib/blockchain/access-log-service", () => ({ createAccessLog }));

const sendAccessLogToPeer = vi.fn();
vi.mock("@/lib/p2p/transport", () => ({ sendAccessLogToPeer }));

const enqueueAccessEvent = vi.fn();
const scheduleFlush = vi.fn();
vi.mock("@/lib/outbox/record", () => ({ enqueueAccessEvent, scheduleFlush }));

const { logNoteAccess } = await import("@/lib/notes/log");

beforeEach(() => {
  createAccessLog.mockReset().mockReturnValue({ data: { eventId: "evt-1", action: "view" } });
  sendAccessLogToPeer.mockReset().mockResolvedValue(undefined);
  enqueueAccessEvent.mockReset().mockResolvedValue(7);
  scheduleFlush.mockReset();
});

describe("logNoteAccess", () => {
  it("records the event against this server's id", async () => {
    await logNoteAccess(1, 2, 3, "view");

    expect(createAccessLog).toHaveBeenCalledWith({
      userId: 1,
      patientId: 2,
      recordId: 3,
      action: "view",
      serverId: process.env.SERVER_ID,
    });
  });

  it("writes the event to the outbox with the shared eventId", async () => {
    await logNoteAccess(1, 2, 3, "view");

    expect(enqueueAccessEvent).toHaveBeenCalledWith({
      eventId: "evt-1",
      userId: 1,
      patientId: 2,
      recordId: 3,
      action: "view",
      serverId: process.env.SERVER_ID,
    });
  });

  it("makes the outbox row durable before it forwards to the peer", async () => {
    const order: string[] = [];
    enqueueAccessEvent.mockImplementation(() => {
      order.push("outbox");
      return Promise.resolve(1);
    });
    scheduleFlush.mockImplementation(() => order.push("flush"));
    sendAccessLogToPeer.mockImplementation(() => {
      order.push("peer");
      return Promise.resolve();
    });
    createAccessLog.mockImplementation(() => {
      order.push("local");
      return { data: { eventId: "evt-1" } };
    });

    await logNoteAccess(1, 2, 3, "view");

    // A crash between "local" and "peer" must still leave an audit row behind.
    expect(order).toEqual(["local", "outbox", "flush", "peer"]);
  });

  it("schedules the chain flush without awaiting it", async () => {
    await logNoteAccess(1, 2, 3, "view");

    expect(scheduleFlush).toHaveBeenCalledTimes(1);
  });

  it("forwards the new block to the peer", async () => {
    await logNoteAccess(1, 2, 3, "view");

    expect(sendAccessLogToPeer).toHaveBeenCalledWith({ eventId: "evt-1", action: "view" });
  });

  it("propagates a peer-sync failure to the caller", async () => {
    sendAccessLogToPeer.mockRejectedValue(new Error("peer down"));

    await expect(logNoteAccess(1, 2, 3, "view")).rejects.toThrow("peer down");
  });

  it("propagates a failed durable write rather than losing the audit entry", async () => {
    enqueueAccessEvent.mockRejectedValue(new Error("database is gone"));

    await expect(logNoteAccess(1, 2, 3, "view")).rejects.toThrow("database is gone");
    // The peer must not be told about an event that was never durably written.
    expect(sendAccessLogToPeer).not.toHaveBeenCalled();
  });
});
