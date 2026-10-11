import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-handler test for /api/access-log. Two rules matter here: a patient must
 * only ever see logs about themselves, and a peer-sync failure must degrade to
 * the local chain rather than 500 the audit view.
 */

const cookieValue = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: (name: string) => ({ value: cookieValue(name) }) }),
}));

const syncServerPeer = vi.fn();
vi.mock("@/app/api/p2p/server-peer", () => ({ syncServerPeer }));

const getAccessLogBlockchain = vi.fn();
vi.mock("@/lib/blockchain/access-log-service", () => ({
  getAccessLogBlockchain: () => getAccessLogBlockchain(),
}));

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findMany: (...args: unknown[]) => findMany(...args) } },
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

const logs = [
  { eventId: "e-1", userId: 1, patientId: 1, recordId: 1, action: "view" },
  { eventId: "e-2", userId: 4, patientId: 2, recordId: 2, action: "view" },
];

beforeEach(() => {
  cookieValue.mockReset();
  syncServerPeer.mockReset().mockResolvedValue(undefined);
  getAccessLogBlockchain.mockReset().mockReturnValue({
    chain: logs.map((data) => ({ data })),
    isValid: () => true,
  });
  findMany.mockReset().mockResolvedValue([]);
  verifyLocalOutbox
    .mockReset()
    .mockResolvedValue({
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

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("gives staff the whole chain and the viewer's id", async () => {
    authenticate(user("doctor"));

    const body = (await (await GET()).json()) as {
      data: { accessLogs: typeof logs; chainValid: boolean; viewerUserId: number };
    };

    expect(body.data.accessLogs).toEqual(logs);
    expect(body.data.chainValid).toBe(true);
    expect(body.data.viewerUserId).toBe(1);
  });

  it("gives a patient only the logs about themselves", async () => {
    // Patients keep readAccessLogs, so the route's own filter is the gate.
    authenticate(user("patient", { id: 4, patientId: 1 }));

    const body = (await (await GET()).json()) as { data: { accessLogs: typeof logs } };

    expect(body.data.accessLogs).toEqual([logs[0]]);
  });

  it("tries to recover from the peer before reading the chain", async () => {
    authenticate(user("doctor"));

    await GET();

    expect(syncServerPeer).toHaveBeenCalled();
  });

  it("still serves the local chain when the peer is unreachable", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    authenticate(user("doctor"));
    syncServerPeer.mockRejectedValue(new Error("peer down"));

    const response = await GET();

    expect(response.status).toBe(200);
    expect((await response.json()).data.accessLogs).toEqual(logs);
    consoleWarn.mockRestore();
  });

  it("resolves actor names from SQL without putting them in the chain", async () => {
    authenticate(user("doctor"));
    findMany.mockResolvedValue([{ id: 1, username: "dr_test", role: "doctor" }]);

    const body = (await (await GET()).json()) as {
      data: { accessLogs: typeof logs; actors: Record<string, { username: string; role: string }> };
    };

    expect(body.data.actors).toEqual({ "1": { username: "dr_test", role: "doctor" } });
    // The chain entries stay untouched — names are joined at read time.
    expect(body.data.accessLogs).toEqual(logs);
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 4] } },
      select: { id: true, username: true, role: true },
    });
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
      data: { verification: { match: boolean; localHead: string }; accessLogs: typeof logs };
    };

    expect(response.status).toBe(200);
    expect(body.data.verification.match).toBe(false);
    expect(body.data.verification.localHead).toBe("");
    // The audit view itself must still render.
    expect(body.data.accessLogs).toEqual(logs);
    consoleWarn.mockRestore();
  });

  it("reports chainValid false instead of failing when the chain is broken", async () => {
    authenticate(user("doctor"));
    getAccessLogBlockchain.mockReturnValue({
      chain: logs.map((data) => ({ data })),
      isValid: () => false,
    });

    const body = (await (await GET()).json()) as { data: { chainValid: boolean } };

    expect(body.data.chainValid).toBe(false);
  });

  it("returns 500 when reading the chain throws", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    authenticate(user("doctor"));
    syncServerPeer.mockRejectedValue(new Error("peer down"));
    getAccessLogBlockchain.mockImplementation(() => {
      throw new Error("chain gone");
    });

    const response = await GET();

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("ACCESS_LOG_FAILED");
    consoleWarn.mockRestore();
  });
});
