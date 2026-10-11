import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-handler test for /api/access-log.
 *
 * Two rules matter here: a patient must only ever see logs about themselves,
 * and the payload must stay free of anything the chain is not allowed to see.
 * The source moved from an in-memory chain to Postgres, so the filter is now
 * enforced in the query rather than by filtering a list afterwards.
 */

const cookieValue = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: (name: string) => ({ value: cookieValue(name) }) }),
}));

const accessLogFindMany = vi.fn();
const userFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    accessLog: { findMany: (...args: unknown[]) => accessLogFindMany(...args) },
    user: { findMany: (...args: unknown[]) => userFindMany(...args) },
  },
}));

const verifyLocalOutbox = vi.fn();
vi.mock("@/lib/outbox/verify", () => ({ verifyLocalOutbox }));

const { GET } = await import("@/app/api/access-log/route");
const { signSessionToken } = await import("@/lib/auth");
import { makeSessionUser } from "@/test-utils/session";
import type { SessionUser } from "@/lib/types/api";

const user = makeSessionUser;

function authenticate(session: SessionUser | null) {
  cookieValue.mockImplementation((name: string) =>
    name === "token" && session ? signSessionToken(session) : undefined,
  );
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    eventId: "e-1",
    patientId: 1,
    userId: 1,
    recordId: 1,
    action: "view",
    serverId: "hospital-s",
    clientTime: new Date("2026-09-29T10:00:00.000Z"),
    status: "pending",
    signature: null,
    slot: null,
    headHash: null,
    ...overrides,
  };
}

beforeEach(() => {
  cookieValue.mockReset();
  accessLogFindMany.mockReset().mockResolvedValue([row()]);
  userFindMany.mockReset().mockResolvedValue([]);
  verifyLocalOutbox.mockReset().mockResolvedValue({
    localHead: "aa",
    chainHead: "aa",
    match: true,
    checkedAt: "2026-10-11T00:00:00.000Z",
  });
});

describe("GET /api/access-log", () => {
  it("returns 401 without a session", async () => {
    authenticate(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 for a role without readAccessLogs", async () => {
    authenticate(user("unauthorized"));

    expect((await GET()).status).toBe(403);
  });

  it("reads from Postgres, not process memory", async () => {
    authenticate(user("doctor"));

    await GET();

    expect(accessLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { id: "desc" }, take: 200 }),
    );
  });

  it("maps a row onto the event shape the journal renders", async () => {
    authenticate(user("doctor"));

    const body = (await (await GET()).json()) as {
      data: { accessLogs: Record<string, unknown>[]; viewerUserId: number };
    };

    expect(body.data.accessLogs).toEqual([
      {
        eventId: "e-1",
        userId: 1,
        patientId: 1,
        recordId: 1,
        action: "view",
        serverId: "hospital-s",
        timestamp: "2026-09-29T10:00:00.000Z",
        status: "pending",
        signature: null,
        slot: null,
        headHash: null,
      },
    ]);
    expect(body.data.viewerUserId).toBe(1);
  });

  it("carries an anchored slot as a decimal string, never a number", async () => {
    authenticate(user("doctor"));
    accessLogFindMany.mockResolvedValue([
      row({ status: "anchored", signature: "sig-1", slot: 2n ** 53n + 1n, headHash: "ff" }),
    ]);

    const body = (await (await GET()).json()) as {
      data: { accessLogs: { slot: string; status: string; signature: string }[] };
    };

    expect(body.data.accessLogs[0]?.slot).toBe("9007199254740993");
    expect(body.data.accessLogs[0]?.status).toBe("anchored");
    expect(body.data.accessLogs[0]?.signature).toBe("sig-1");
  });

  it("scopes a patient's query to their own patientId rather than filtering after", async () => {
    authenticate(user("patient", { id: 4, patientId: 1 }));

    await GET();

    // Enforced in the query, so a bug in the mapping cannot leak another
    // patient's events.
    expect(accessLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: 1 } }),
    );
  });

  it("gives staff every patient's events", async () => {
    authenticate(user("doctor"));

    await GET();

    expect(accessLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("falls back to a synthesized eventId for a row predating the column", async () => {
    authenticate(user("doctor"));
    accessLogFindMany.mockResolvedValue([row({ id: 7, eventId: null })]);

    const body = (await (await GET()).json()) as { data: { accessLogs: { eventId: string }[] } };

    expect(body.data.accessLogs[0]?.eventId).toBe("row-7");
  });

  it("resolves actor names from SQL without putting them in the event", async () => {
    authenticate(user("doctor"));
    userFindMany.mockResolvedValue([{ id: 1, username: "dr_test", role: "doctor" }]);

    const body = (await (await GET()).json()) as {
      data: { accessLogs: { userId: number }[]; actors: Record<string, { username: string }> };
    };

    expect(body.data.actors).toEqual({ "1": { username: "dr_test", role: "doctor" } });
    // The event rows stay id-only — the name is joined at read time.
    expect(body.data.accessLogs[0]).not.toHaveProperty("actorName");
    expect(userFindMany).toHaveBeenCalledWith({
      where: { id: { in: [1] } },
      select: { id: true, username: true, role: true },
    });
  });

  it("carries no medical content across the boundary", async () => {
    authenticate(user("doctor"));
    accessLogFindMany.mockResolvedValue([row({ action: "view", recordId: 1 })]);

    const body = (await (await GET()).json()) as {
      data: { accessLogs: Record<string, unknown>[] };
    };

    for (const event of body.data.accessLogs) {
      expect(event).not.toHaveProperty("content");
      expect(event).not.toHaveProperty("text");
      expect(event).not.toHaveProperty("note");
      expect(event).not.toHaveProperty("personalNumber");
      expect(event).not.toHaveProperty("diagnosis");
    }
  });

  it("reports whether the local mirror matches the chain head", async () => {
    authenticate(user("doctor"));

    const body = (await (await GET()).json()) as {
      data: { verification: { localHead: string; chainHead: string; match: boolean } };
    };

    expect(body.data.verification).toEqual({
      localHead: "aa",
      chainHead: "aa",
      match: true,
      checkedAt: "2026-10-11T00:00:00.000Z",
    });
  });

  it("surfaces a tampered mirror as match: false instead of failing the request", async () => {
    authenticate(user("doctor"));
    verifyLocalOutbox.mockResolvedValue({
      localHead: "bb",
      chainHead: "aa",
      match: false,
      checkedAt: "2026-10-11T00:00:00.000Z",
    });

    const response = await GET();
    const body = (await response.json()) as { data: { verification: { match: boolean } } };

    expect(response.status).toBe(200);
    expect(body.data.verification.match).toBe(false);
  });

  it("degrades to match: false when verification itself is unreachable", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    authenticate(user("doctor"));
    verifyLocalOutbox.mockRejectedValue(new Error("rpc down"));

    const response = await GET();
    const body = (await response.json()) as {
      data: { verification: { match: boolean; localHead: string }; accessLogs: unknown[] };
    };

    expect(response.status).toBe(200);
    expect(body.data.verification.match).toBe(false);
    expect(body.data.verification.localHead).toBe("");
    // The audit view itself must still render.
    expect(body.data.accessLogs).toHaveLength(1);
    consoleWarn.mockRestore();
  });

  it("returns 500 when the query throws", async () => {
    authenticate(user("doctor"));
    accessLogFindMany.mockRejectedValue(new Error("db gone"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("ACCESS_LOG_FAILED");
  });
});
