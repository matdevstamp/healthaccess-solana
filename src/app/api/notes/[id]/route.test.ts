import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-handler tests for /api/notes/[id]. Only the note's author may edit or
 * delete a note; everything else is a 403 that never reaches Prisma.
 */

const cookieValue = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: (name: string) => ({ value: cookieValue(name) }) }),
}));

const findUnique = vi.fn();
const update = vi.fn();
const delete_ = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { note: { findUnique, update, delete: delete_ } },
}));

const logNoteAccess = vi.fn();
vi.mock("@/lib/notes/log", () => ({ logNoteAccess }));

const { PATCH, DELETE } = await import("@/app/api/notes/[id]/route");
const { signSessionToken } = await import("@/lib/auth");
import { makeSessionUser } from "@/test-utils/session";
import type { Role, SessionUser } from "@/lib/types/api";

const user = (role: Role, id: number) =>
  makeSessionUser(role, {
    id,
    username: `${role}_${id}`,
    patientId: role === "patient" ? 1 : null,
  });

function authenticate(session: SessionUser | null) {
  cookieValue.mockImplementation((name: string) =>
    name === "token" && session ? signSessionToken(session) : undefined,
  );
}

function patch(id: string, body: unknown) {
  return PATCH(
    new Request(`http://localhost:3000/api/notes/${id}`, {
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ id }) },
  );
}

function del(id: string) {
  return DELETE(new Request(`http://localhost:3000/api/notes/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

const storedNote = {
  id: 5,
  recordId: 1,
  content: "Original.",
  visibility: "healthcare",
  authorId: 3,
  record: { patientId: 1 },
};

const updatedNote = {
  id: 5,
  recordId: 1,
  content: "Edited.",
  visibility: "all",
  authorId: 3,
  author: { id: 3, username: "nurse_3" },
  createdAt: new Date("2026-08-18T10:42:00.000Z"),
  updatedAt: new Date("2026-09-29T10:00:00.000Z"),
};

beforeEach(() => {
  cookieValue.mockReset();
  findUnique.mockReset().mockResolvedValue(storedNote);
  update.mockReset().mockResolvedValue(updatedNote);
  delete_.mockReset().mockResolvedValue(storedNote);
  logNoteAccess.mockReset().mockResolvedValue(undefined);
});

describe("PATCH /api/notes/[id]", () => {
  it("returns 401 without a session", async () => {
    authenticate(null);

    expect((await patch("5", { text: "x" })).status).toBe(401);
  });

  it("returns 403 for a role without createNote", async () => {
    authenticate(user("patient", 4));

    expect((await patch("5", { text: "x" })).status).toBe(403);
  });

  it.each(["abc", "0", "-1", "1.5"])("returns 400 for the note id %s", async (id) => {
    authenticate(user("nurse", 3));

    const response = await patch(id, { text: "x" });

    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toBe("Invalid note id");
  });

  it("returns 400 for a body that is not JSON", async () => {
    authenticate(user("nurse", 3));

    const response = await patch("5", "{oops");

    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toBe("Invalid request body");
  });

  it.each([
    ["an empty payload", {}],
    ["blank text", { text: "   " }],
    ["an unknown visibility", { visibility: "secret" }],
  ])("returns 400 for %s", async (_label, body) => {
    authenticate(user("nurse", 3));

    const response = await patch("5", body);

    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toBe("Invalid note data");
  });

  it("returns 404 when the note does not exist", async () => {
    authenticate(user("nurse", 3));
    findUnique.mockResolvedValue(null);

    const response = await patch("5", { text: "x" });

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  it("returns 403 when the caller is not the author", async () => {
    authenticate(user("doctor", 1));

    const response = await patch("5", { text: "x" });

    expect(response.status).toBe(403);
    expect((await response.json()).error.message).toBe("Only the note author can edit this note");
    expect(update).not.toHaveBeenCalled();
  });

  it("maps text onto the Prisma content column", async () => {
    authenticate(user("nurse", 3));

    await patch("5", { text: "Edited." });

    expect(update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 5 },
      data: { content: "Edited." },
    });
  });

  it("only writes the fields that were sent", async () => {
    authenticate(user("nurse", 3));

    await patch("5", { visibility: "all" });

    expect(update.mock.calls[0]?.[0]).toMatchObject({ data: { visibility: "all" } });
    expect(update.mock.calls[0]?.[0].data).not.toHaveProperty("content");
  });

  it("returns the serialised updated note", async () => {
    authenticate(user("nurse", 3));

    const body = (await (await patch("5", { text: "Edited." })).json()) as {
      data: { note: Record<string, unknown> };
    };

    expect(body.data.note).toEqual({
      id: 5,
      recordId: 1,
      text: "Edited.",
      visibility: "all",
      authorUserId: 3,
      author: "nurse_3",
      createdAt: "2026-08-18T10:42:00.000Z",
      updatedAt: "2026-09-29T10:00:00.000Z",
    });
  });

  it("logs an edit event", async () => {
    authenticate(user("nurse", 3));

    await patch("5", { text: "Edited." });

    expect(logNoteAccess).toHaveBeenCalledWith(3, 1, 1, "edit", "nurse");
  });

  it("returns 500 when Prisma throws", async () => {
    authenticate(user("nurse", 3));
    update.mockRejectedValue(new Error("db down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await patch("5", { text: "x" });

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("NOTE_EDIT_FAILED");
    consoleError.mockRestore();
  });
});

describe("DELETE /api/notes/[id]", () => {
  it("returns 401 without a session", async () => {
    authenticate(null);

    expect((await del("5")).status).toBe(401);
  });

  it("returns 403 for a role without createNote", async () => {
    authenticate(user("patient", 4));

    expect((await del("5")).status).toBe(403);
  });

  it("returns 400 for a non-numeric id", async () => {
    authenticate(user("nurse", 3));

    expect((await del("abc")).status).toBe(400);
  });

  it("returns 404 when the note does not exist", async () => {
    authenticate(user("nurse", 3));
    findUnique.mockResolvedValue(null);

    expect((await del("5")).status).toBe(404);
  });

  it("returns 403 when the caller is not the author", async () => {
    authenticate(user("doctor", 1));

    const response = await del("5");

    expect(response.status).toBe(403);
    expect((await response.json()).error.message).toBe("Only the note author can delete this note");
    expect(delete_).not.toHaveBeenCalled();
  });

  it("deletes the note and returns its id", async () => {
    authenticate(user("nurse", 3));

    const body = (await (await del("5")).json()) as { data: { deletedId: number } };

    expect(body.data.deletedId).toBe(5);
    expect(delete_).toHaveBeenCalledWith({ where: { id: 5 } });
  });

  it("logs a delete event", async () => {
    authenticate(user("nurse", 3));

    await del("5");

    expect(logNoteAccess).toHaveBeenCalledWith(3, 1, 1, "delete", "nurse");
  });

  it("returns 500 when Prisma throws", async () => {
    authenticate(user("nurse", 3));
    delete_.mockRejectedValue(new Error("db down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await del("5");

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("NOTE_DELETE_FAILED");
    consoleError.mockRestore();
  });
});
