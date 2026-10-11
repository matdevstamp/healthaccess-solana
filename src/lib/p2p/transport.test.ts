import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkPeerHealth, fetchPeerHealth, sendNoteToPeer } from "@/lib/p2p/transport";
import {
  getPeerSecret,
  isPeerAuthorized,
  peerAuthHeaders,
  PEER_SECRET_HEADER,
} from "@/lib/p2p/peer-auth";
import type { Note } from "@/lib/types/api";

const PEER_URL = "http://localhost:3002";

function note(): Note {
  return {
    id: 1,
    recordId: 1,
    text: "Follow-up in six months.",
    visibility: "healthcare",
    authorUserId: 2,
    author: "nurse_test",
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T10:00:00.000Z",
  };
}

function jsonResponse(body: unknown, init: { status?: number; ok?: boolean } = {}) {
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? status < 400,
    status,
    json: async () => body,
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("peer auth", () => {
  it("authorizes a request carrying the shared secret", () => {
    const request = new Request("http://localhost:3001/api/p2p/note", {
      headers: { [PEER_SECRET_HEADER]: getPeerSecret() },
    });

    expect(isPeerAuthorized(request)).toBe(true);
  });

  it("rejects a missing or wrong secret", () => {
    expect(isPeerAuthorized(new Request("http://localhost:3001/api/p2p/note"))).toBe(false);
    expect(
      isPeerAuthorized(
        new Request("http://localhost:3001/api/p2p/note", {
          headers: { [PEER_SECRET_HEADER]: "guess" },
        }),
      ),
    ).toBe(false);
  });

  it("exposes the secret as a header for outgoing calls", () => {
    expect(peerAuthHeaders()).toEqual({ [PEER_SECRET_HEADER]: getPeerSecret() });
  });
});

describe("sendNoteToPeer", () => {
  it("posts a note_created envelope tagged with the patient id", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await sendNoteToPeer(7, note());

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`${PEER_URL}/api/p2p/note`);
    const payload = JSON.parse(init.body) as { type: string; patientId: number };
    expect(payload).toMatchObject({ type: "note_created", patientId: 7 });
  });

  it("does not throw when the peer is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(sendNoteToPeer(7, note())).resolves.toBeUndefined();
  });
});

describe("fetchPeerHealth", () => {
  it("returns the peer identity and a check timestamp", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { status: "ok", server: "ambulance-a" } }));

    const health = await fetchPeerHealth();

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${PEER_URL}/api/health`);
    expect(health.healthy).toBe(true);
    expect(health.serverId).toBe("ambulance-a");
    expect(Date.parse(health.lastCheckedAt)).not.toBeNaN();
  });

  it("throws on a non-ok HTTP status", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 503 }));

    await expect(fetchPeerHealth()).rejects.toThrow("status 503");
  });

  it("throws when the peer reports an unhealthy status", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { status: "degraded", server: "x" } }));

    await expect(fetchPeerHealth()).rejects.toThrow("unhealthy status");
  });

  it("falls back to an empty server id when the payload omits it", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { status: "ok" } }));

    expect((await fetchPeerHealth()).serverId).toBe("");
  });
});

describe("checkPeerHealth", () => {
  it("reports healthy when the probe succeeds", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { status: "ok", server: "ambulance-a" } }));

    expect(await checkPeerHealth()).toBe(true);
  });

  it("reports unhealthy without throwing when the peer is down", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    expect(await checkPeerHealth()).toBe(false);
  });
});
