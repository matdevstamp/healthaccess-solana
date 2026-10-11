import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-handler tests for /api/notes. The session comes from the httpOnly
 * cookie (mocked `next/headers`), Prisma is mocked, and the real visibility
 * rule and access log run. HTTP status/envelope behaviour is asserted here;
 * the SQL itself is covered by e2e/notes against Postgres.
 */

const cookieValue = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: (name: string) => ({ value: cookieValue(name) }) }),
}));

const findUnique = vi.fn();
const findMany = vi.fn();
const create = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    medicalRecord: { findUnique },
    note: { findMany, create },
  },
}));

const logNoteAccess = vi.fn();
vi.mock("@/lib/notes/log", () => ({ logNoteAccess }));

const sendNoteToPeer = vi.fn();
vi.mock("@/lib/p2p/transport", () => ({ sendNoteToPeer }));

const broadcastNoteCreated = vi.fn();
vi.mock("@/lib/realtime/broadcast", () => ({ broadcastNoteCreated }));

const { GET, POST } = await import("@/app/api/notes/route");
const { signSessionToken } = await import("@/lib/auth");
import { makeSessionUser } from "@/test-utils/session";
import type { SessionUser } from "@/lib/types/api";

const user = makeSessionUser;

/** Authenticate the next request as `session` (or drop the cookie for null). */
function authenticate(session: SessionUser | null) {
  cookieValue.mockImplementation((name: string) =>
    name === "token" && session ? signSessionToken(session) : undefined,
  );
}

function get(recordId: string | null = "1") {
  const query = recordId === null ? "" : `?recordId=${recordId}`;
  return GET(new Request(`http://localhost:3000/api/notes${query}`));
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost:3000/api/notes", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
  );
}

const record = { id: 1, patientId: 1 };

function note(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    recordId: 1,
    content: "Follow-up in six months.",
    visibility: "all",
    authorId: 1,
    author: { id: 1, username: "dr_test" },
    createdAt: new Date("2026-08-18T10:42:00.000Z"),
    updatedAt: new Date("2026-08-18T10:42:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  cookieValue.mockReset();
  findUnique.mockReset().mockResolvedValue(record);
  findMany.mockReset().mockResolvedValue([]);
  create
    .mockReset()
    .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(note({ ...data, content: data.content, authorId: data.authorId })),
    );
  logNoteAccess.mockReset().mockResolvedValue(undefined);
  sendNoteToPeer.mockReset().mockResolvedValue(undefined);
  broadcastNoteCreated.mockReset().mockResolvedValue(undefined);
});

describe("GET /api/notes", () => {
  it("returns 401 without a session cookie", async () => {
    authenticate(null);

    const response = await get();

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 for a role without readPatient", async () => {
    authenticate(user("unauthorized"));

    const response = await get();

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
  });

  it.each([
    ["missing", null],
    ["empty", ""],
    ["non-numeric", "abc"],
    ["fractional", "1.5"],
    ["zero", "0"],
    ["negative", "-3"],
  ])("returns 400 for a %s recordId", async (_label, value) => {
    authenticate(user("doctor"));

    const response = await get(value);

    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toBe("A valid recordId is required");
  });

  it("returns 404 for an unknown record", async () => {
    authenticate(user("doctor"));
    findUnique.mockResolvedValue(null);

    const response = await get();

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  it("returns 403 and logs view_denied when a patient reads someone else's record", async () => {
    authenticate(user("patient", { id: 4, patientId: 1 }));
    findUnique.mockResolvedValue({ id: 1, patientId: 2 });

    const response = await get();

    expect(response.status).toBe(403);
    expect(logNoteAccess).toHaveBeenCalledWith(4, 2, 1, "view_denied", "patient");
  });

  it("returns only the notes the viewer may see and counts the rest as hidden", async () => {
    authenticate(user("patient", { id: 4, patientId: 1 }));
    findMany.mockResolvedValue([
      note({ id: 1, visibility: "all", authorId: 1 }),
      note({ id: 2, visibility: "healthcare", authorId: 1 }),
      note({ id: 3, visibility: "private", authorId: 1 }),
    ]);

    const body = (await (await get()).json()) as {
      ok: boolean;
      data: { notes: Array<{ id: number }>; hiddenNotesCount: number };
    };

    expect(body.ok).toBe(true);
    expect(body.data.notes.map((entry) => entry.id)).toEqual([1]);
    expect(body.data.hiddenNotesCount).toBe(2);
  });

  it("serialises the visible notes onto the API Note shape", async () => {
    authenticate(user("doctor"));
    findMany.mockResolvedValue([note()]);

    const body = (await (await get()).json()) as { data: { notes: Record<string, unknown>[] } };

    expect(body.data.notes[0]).toEqual({
      id: 1,
      recordId: 1,
      text: "Follow-up in six months.",
      visibility: "all",
      authorUserId: 1,
      author: "dr_test",
      createdAt: "2026-08-18T10:42:00.000Z",
      updatedAt: "2026-08-18T10:42:00.000Z",
    });
  });

  it("logs a view event for a successful read", async () => {
    authenticate(user("doctor"));

    await get();

    expect(logNoteAccess).toHaveBeenCalledWith(1, 1, 1, "view", "doctor");
  });

  it("orders the notes oldest first", async () => {
    authenticate(user("doctor"));

    await get();

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({ orderBy: { createdAt: "asc" } });
  });

  it("returns 500 when Prisma throws", async () => {
    authenticate(user("doctor"));
    findMany.mockRejectedValue(new Error("db down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await get();

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("NOTES_FAILED");
    consoleError.mockRestore();
  });
});

describe("POST /api/notes", () => {
  const body = { recordId: 1, text: "New note.", visibility: "healthcare" };

  it("returns 401 without a session cookie", async () => {
    authenticate(null);

    const response = await post(body);

    expect(response.status).toBe(401);
  });

  it("returns 403 for a role without createNote", async () => {
    authenticate(user("unauthorized"));

    const response = await post(body);

    expect(response.status).toBe(403);
  });

  it("returns 400 for a body that is not JSON", async () => {
    authenticate(user("nurse"));

    const response = await post("{not json");

    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toBe("Invalid request body");
  });

  it.each([
    ["a missing recordId", { text: "x", visibility: "all" }],
    ["a non-numeric recordId", { recordId: "1", text: "x", visibility: "all" }],
    ["a recordId of zero", { recordId: 0, text: "x", visibility: "all" }],
    ["empty text", { recordId: 1, text: "   ", visibility: "all" }],
    ["an unknown visibility", { recordId: 1, text: "x", visibility: "secret" }],
    ["an extra field is allowed but a missing one is not", { recordId: 1 }],
  ])("returns 400 for %s", async (_label, payload) => {
    authenticate(user("nurse"));

    const response = await post(payload);

    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toBe("Invalid note data");
  });

  it("returns 404 when the record does not exist", async () => {
    authenticate(user("nurse"));
    findUnique.mockResolvedValue(null);

    const response = await post(body);

    expect(response.status).toBe(404);
  });

  it("creates the note as the authenticated author and returns 201", async () => {
    authenticate(user("nurse", { id: 3 }));
    create.mockResolvedValue(note({ id: 9, authorId: 3, visibility: "healthcare" }));

    const response = await post(body);
    const json = (await response.json()) as {
      ok: boolean;
      data: { note: { id: number; authorUserId: number } };
    };

    expect(response.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.data.note.id).toBe(9);
    expect(json.data.note.authorUserId).toBe(3);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      data: { recordId: 1, authorId: 3, content: "New note.", visibility: "healthcare" },
    });
  });

  it("logs a create event", async () => {
    authenticate(user("nurse", { id: 3 }));

    await post(body);

    expect(logNoteAccess).toHaveBeenCalledWith(3, 1, 1, "create", "nurse");
  });

  it("broadcasts to sockets and syncs the peer", async () => {
    authenticate(user("nurse", { id: 3 }));

    await post(body);

    expect(broadcastNoteCreated).toHaveBeenCalledWith(1, expect.objectContaining({ id: 1 }));
    expect(sendNoteToPeer).toHaveBeenCalledWith(1, expect.objectContaining({ id: 1 }));
  });

  it("returns 500 when Prisma throws", async () => {
    authenticate(user("nurse"));
    create.mockRejectedValue(new Error("db down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await post(body);

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("NOTE_CREATE_FAILED");
    consoleError.mockRestore();
  });
});
