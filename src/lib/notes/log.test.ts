import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * logNoteAccess is the named seam every note-reading route calls. It is a thin
 * wrapper now — the ordering and durability rules live in recordAccessEvent,
 * and are tested there. What matters here is that the wrapper passes the
 * caller's intent through unchanged, including for the denied paths.
 */

const recordAccessEvent = vi.fn();
vi.mock("@/lib/outbox/record", () => ({ recordAccessEvent }));

const { logNoteAccess } = await import("@/lib/notes/log");

beforeEach(() => {
  recordAccessEvent.mockReset().mockResolvedValue({ eventId: "evt-1" });
});

describe("logNoteAccess", () => {
  it("records the event against this server's id", async () => {
    await logNoteAccess(1, 2, 3, "view", "doctor");

    expect(recordAccessEvent).toHaveBeenCalledWith({
      userId: 1,
      patientId: 2,
      recordId: 3,
      action: "view",
      serverId: process.env.SERVER_ID,
      role: "doctor",
    });
  });

  it.each(["view", "create", "edit", "delete"])("passes the %s action through", async (action) => {
    await logNoteAccess(1, 2, 3, action, "doctor");

    expect(recordAccessEvent).toHaveBeenCalledWith(expect.objectContaining({ action }));
  });

  it("records a denied access, which is an audit event rather than an error", async () => {
    await logNoteAccess(1, 2, 3, "view_denied", "doctor");

    expect(recordAccessEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "view_denied" }),
    );
  });

  it("awaits the durable write before resolving", async () => {
    let resolved = false;
    recordAccessEvent.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => {
            resolved = true;
            resolve({ eventId: "evt-1" });
          }, 5),
        ),
    );

    await logNoteAccess(1, 2, 3, "view", "doctor");

    expect(resolved).toBe(true);
  });

  it("propagates a failed durable write rather than losing the audit entry", async () => {
    recordAccessEvent.mockRejectedValue(new Error("database is gone"));

    await expect(logNoteAccess(1, 2, 3, "view", "doctor")).rejects.toThrow("database is gone");
  });
});
