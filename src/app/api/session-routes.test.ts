import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Small session/health routes. Grouped into one file because each is a handful
 * of lines: the value here is asserting the status/envelope contract and the
 * peer-health payload shape.
 */

const cookieValue = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: (name: string) => ({ value: cookieValue(name) }) }),
}));

const getPeerHealth = vi.fn();
vi.mock("@/lib/p2p/peer-health", () => ({ getPeerHealth }));

// The health route counts pending outbox rows. Mocked here so the assertion is
// about the envelope and the peer payload, not about whether Postgres happens
// to be running on the machine.
vi.mock("@/lib/outbox/store", () => ({
  prismaOutboxStore: { countPending: async () => 0 },
}));

const { GET: getMe } = await import("@/app/api/auth/me/route");
const { POST: postLogout } = await import("@/app/api/auth/logout/route");
const { GET: getHealth } = await import("@/app/api/health/route");
const { GET: getRecords } = await import("@/app/api/records/route");
const { signSessionToken } = await import("@/lib/auth");
import { HOSPITAL_ID, makeSessionUser } from "@/test-utils/session";
import type { SessionUser } from "@/lib/types/api";

const user = makeSessionUser;

function authenticate(session: SessionUser | null) {
  cookieValue.mockImplementation((name: string) =>
    name === "token" && session ? signSessionToken(session) : undefined,
  );
}

beforeEach(() => {
  cookieValue.mockReset();
  getPeerHealth.mockReset().mockReturnValue({
    peerUrl: "http://localhost:3002",
    healthy: null,
    serverId: null,
    lastCheckedAt: null,
    lastError: null,
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without a session", async () => {
    authenticate(null);

    const response = await getMe();

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("returns the session user", async () => {
    authenticate(user("nurse"));

    const body = (await (await getMe()).json()) as { data: { user: Record<string, unknown> } };

    expect(body.data.user).toEqual({
      id: 1,
      username: "nurse_test",
      role: "nurse",
      organizationId: HOSPITAL_ID,
      patientId: null,
    });
  });

  it("returns 401 for a tampered token", async () => {
    cookieValue.mockImplementation(() => "not.a.jwt");

    expect((await getMe()).status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session cookie", async () => {
    const response = await postLogout();
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(cookie).toContain("token=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toMatch(/Max-Age=0/i);
  });

  it("succeeds even without a session", async () => {
    const body = (await (await postLogout()).json()) as { data: { message: string } };

    expect(body.data.message).toBe("Logged out");
  });
});

describe("GET /api/health", () => {
  it("reports this server's id and an ISO timestamp", async () => {
    const body = (await (await getHealth()).json()) as {
      data: { status: string; server: string; timestamp: string };
    };

    expect(body.data.status).toBe("ok");
    expect(body.data.server).toBe(process.env.SERVER_ID);
    expect(Date.parse(body.data.timestamp)).not.toBeNaN();
  });

  it("reports an unknown peer before the first heartbeat", async () => {
    const body = (await (await getHealth()).json()) as {
      data: { peer: { healthy: boolean | null; serverId: string | null } };
    };

    expect(body.data.peer).toEqual({
      healthy: null,
      serverId: null,
      lastCheckedAt: null,
    });
  });

  it("passes a healthy peer identity through", async () => {
    getPeerHealth.mockReturnValue({
      peerUrl: "http://localhost:3002",
      healthy: true,
      serverId: "ambulance-a",
      lastCheckedAt: "2026-09-29T10:00:00.000Z",
      lastError: null,
    });

    const body = (await (await getHealth()).json()) as {
      data: { peer: { healthy: boolean; serverId: string; lastCheckedAt: string } };
    };

    expect(body.data.peer).toEqual({
      healthy: true,
      serverId: "ambulance-a",
      lastCheckedAt: "2026-09-29T10:00:00.000Z",
    });
  });

  it("does not leak the peer error text", async () => {
    getPeerHealth.mockReturnValue({
      peerUrl: "http://localhost:3002",
      healthy: false,
      serverId: null,
      lastCheckedAt: null,
      lastError: "ECONNREFUSED",
    });

    expect(JSON.stringify(await (await getHealth()).json())).not.toContain("ECONNREFUSED");
  });
});

describe("GET /api/records", () => {
  it("reports that the endpoint is not implemented yet", async () => {
    const response = await getRecords();
    const body = (await response.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(501);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_IMPLEMENTED");
    expect(body.error.message).toMatch(/task 14/i);
  });
});
