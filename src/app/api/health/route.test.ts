import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/api/health` reports chain state so a broken deploy is visible before the
 * demo, not during it. The rule that matters: none of the chain calls may fail
 * the request.
 */

const getPeerHealth = vi.fn();
vi.mock("@/lib/p2p/peer-health", () => ({ getPeerHealth }));

const getChainStatus = vi.fn();
vi.mock("@/lib/solana/chain", () => ({ getChainStatus }));

const countPending = vi.fn();
vi.mock("@/lib/outbox/store", () => ({
  prismaOutboxStore: { countPending: () => countPending() },
}));

const { GET } = await import("@/app/api/health/route");

const baseStatus = {
  reachable: true,
  cluster: "devnet",
  programId: "4wJq123",
  programDeployed: true,
  headHash: "4f".repeat(32),
  currentSlot: "1234567890",
  error: null,
};

beforeEach(() => {
  getPeerHealth.mockReset().mockReturnValue({
    healthy: true,
    serverId: "ambulance-a",
    lastCheckedAt: "2026-10-11T00:00:00.000Z",
  });
  getChainStatus.mockReset().mockResolvedValue(baseStatus);
  countPending.mockReset().mockResolvedValue(0);
});

describe("GET /api/health", () => {
  it("reports the existing peer block unchanged", async () => {
    const body = (await (await GET()).json()) as {
      data: { status: string; peer: { healthy: boolean } };
    };

    expect(body.data.status).toBe("ok");
    expect(body.data.peer.healthy).toBe(true);
  });

  it("reports cluster, reachability, program and head", async () => {
    const body = (await (await GET()).json()) as {
      data: { solana: Record<string, unknown> };
    };

    expect(body.data.solana).toEqual({
      reachable: true,
      cluster: "devnet",
      programId: "4wJq123",
      programDeployed: true,
      headHash: "4f".repeat(32),
      currentSlot: "1234567890",
      pendingEvents: 0,
      error: null,
    });
  });

  it("surfaces a non-zero pending count, which is not an error", async () => {
    countPending.mockResolvedValue(3);

    const response = await GET();
    const body = (await response.json()) as {
      data: { status: string; solana: { pendingEvents: number } };
    };

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("ok");
    expect(body.data.solana.pendingEvents).toBe(3);
  });

  it("still answers when the program has not been deployed", async () => {
    getChainStatus.mockResolvedValue({
      ...baseStatus,
      programId: null,
      programDeployed: false,
      reachable: false,
      headHash: null,
      currentSlot: null,
      error: "SOLANA_PROGRAM_ID is not set",
    });

    const response = await GET();
    const body = (await response.json()) as {
      data: { status: string; solana: { programDeployed: boolean; error: string } };
    };

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("ok");
    expect(body.data.solana.programDeployed).toBe(false);
    expect(body.data.solana.error).toMatch(/SOLANA_PROGRAM_ID/);
  });

  it("reports an unknown pending count rather than failing on an unqueryable db", async () => {
    countPending.mockRejectedValue(new Error("db down"));

    const response = await GET();
    const body = (await response.json()) as { data: { solana: { pendingEvents: number | null } } };

    expect(response.status).toBe(200);
    expect(body.data.solana.pendingEvents).toBeNull();
  });
});
