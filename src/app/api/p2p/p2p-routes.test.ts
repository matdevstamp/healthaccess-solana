import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P2P inbound endpoints. The note relay is the only one left: chain
 * replication is gone, because replicating the audit trail to a second process
 * was a second source of truth for the same facts. Notes still replicate,
 * because a note read on the other node is a note the clinician expects to see.
 */

const broadcastNoteCreated = vi.fn();
vi.mock("@/lib/realtime/broadcast", () => ({ broadcastNoteCreated }));

const { POST: postNote } = await import("@/app/api/p2p/note/route");
import { peerAuthHeaders } from "@/lib/p2p/peer-auth";

function request(body: unknown, path: string, authorized = true) {
  return new Request(`http://localhost:3002${path}`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", ...(authorized ? peerAuthHeaders() : {}) },
  });
}

const noteMessage = {
  type: "note_created",
  from: "hospital-s",
  timestamp: "2026-09-29T10:00:00.000Z",
  patientId: 1,
  data: {
    id: 1,
    recordId: 1,
    text: "note",
    visibility: "healthcare",
    authorUserId: 1,
    author: "dr_test",
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T10:00:00.000Z",
  },
};

beforeEach(() => {
  broadcastNoteCreated.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/p2p/note", () => {
  it("rejects a peer without the shared secret", async () => {
    const response = await postNote(request(noteMessage, "/api/p2p/note", false));

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("Unauthorized peer");
  });

  it("does not broadcast for an unauthorized peer", async () => {
    await postNote(request(noteMessage, "/api/p2p/note", false));

    expect(broadcastNoteCreated).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    const response = await postNote(request("{oops", "/api/p2p/note"));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Invalid JSON");
  });

  it.each([
    ["a wrong type tag", { ...noteMessage, type: "access_log" }],
    ["a missing patientId", { ...noteMessage, patientId: undefined }],
    ["a string patientId", { ...noteMessage, patientId: "1" }],
    ["a null data payload", { ...noteMessage, data: null }],
  ])("rejects %s with 400", async (_label, body) => {
    const response = await postNote(request(body, "/api/p2p/note"));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Invalid P2P note message");
  });

  it("broadcasts an accepted note into the patient's room", async () => {
    const response = await postNote(request(noteMessage, "/api/p2p/note"));

    expect(response.status).toBe(200);
    expect(broadcastNoteCreated).toHaveBeenCalledWith(1, noteMessage.data);
  });

  it("lets the shared visibility rule filter the broadcast", async () => {
    await postNote(request(noteMessage, "/api/p2p/note"));

    // broadcastNoteCreated is the real decision point; it is covered in its own
    // suite, so here we only assert the raw note is forwarded untouched.
    expect(broadcastNoteCreated.mock.calls[0]?.[1].visibility).toBe("healthcare");
  });
});
