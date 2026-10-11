import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchCurrentHead,
  getChainStatus,
  readTrail,
  verifyAgainstChain,
} from "@/lib/solana/chain";
import { resetConnection, setConnection } from "@/lib/solana/client";
import { ZERO_HASH, foldHead, toHex } from "@/lib/solana/hash";
import type { OnChainAccessEvent } from "@/lib/solana/types";

/**
 * The verification view is the claim the project makes, so the mismatch case
 * matters more than the happy one. No program is deployed, so every test here
 * runs against the "no trail yet" path or an injected fake connection.
 */

const connection = {
  getSlot: vi.fn(),
  getAccountInfo: vi.fn(),
};

function event(overrides: Partial<OnChainAccessEvent> = {}): OnChainAccessEvent {
  return {
    patientHash: new Uint8Array(32).fill(1),
    actorHash: new Uint8Array(32).fill(2),
    action: 0,
    role: 0,
    recordId: 1n,
    server: 0,
    timestamp: 1_700_000_000n,
    ...overrides,
  };
}

beforeEach(() => {
  connection.getSlot.mockReset().mockResolvedValue(1_234_567_890);
  connection.getAccountInfo.mockReset().mockResolvedValue(null);
  setConnection(connection as never);
});

afterEach(() => {
  resetConnection();
  vi.restoreAllMocks();
});

describe("fetchCurrentHead", () => {
  it("returns the zero hash when no trail exists yet", async () => {
    // No SOLANA_PROGRAM_ID in the test env, so there is nothing to read.
    await expect(fetchCurrentHead()).resolves.toEqual(ZERO_HASH);
  });

  it("does not touch the network while the program is unconfigured", async () => {
    await fetchCurrentHead();

    expect(connection.getAccountInfo).not.toHaveBeenCalled();
  });
});

describe("verifyAgainstChain", () => {
  const events = [event(), event({ recordId: 2n }), event({ recordId: 3n })];

  it("reports a match when the local fold equals the chain head", async () => {
    const result = await verifyAgainstChain(events, { chainHead: foldHead(events) });

    expect(result.match).toBe(true);
    expect(result.localHead).toBe(result.chainHead);
    expect(result.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("reports a mismatch when a local entry was altered", async () => {
    const [first, second, third] = events as [
      OnChainAccessEvent,
      OnChainAccessEvent,
      OnChainAccessEvent,
    ];
    const tampered = [first, { ...second, action: 3 as const }, third];

    const result = await verifyAgainstChain(tampered, { chainHead: foldHead(events) });

    expect(result.match).toBe(false);
    expect(result.localHead).not.toBe(result.chainHead);
  });

  it("reports a mismatch when a local entry was dropped", async () => {
    const result = await verifyAgainstChain(events.slice(0, 2), { chainHead: foldHead(events) });

    expect(result.match).toBe(false);
  });

  it("matches an empty mirror against an empty chain", async () => {
    const result = await verifyAgainstChain([], { chainHead: ZERO_HASH });

    expect(result.match).toBe(true);
    expect(result.localHead).toBe(toHex(ZERO_HASH));
  });

  it("reports a mismatch rather than throwing when the chain head is unknown", async () => {
    // The default path reads chain state; unconfigured, that is the zero head.
    const result = await verifyAgainstChain(events);

    expect(result.match).toBe(false);
    expect(result.chainHead).toBe(toHex(ZERO_HASH));
  });
});

describe("readTrail", () => {
  it("returns null while the program id is unset", async () => {
    await expect(readTrail()).resolves.toBeNull();
  });
});

describe("getChainStatus", () => {
  it("reports the unconfigured program without failing the check", async () => {
    const status = await getChainStatus();

    expect(status.programId).toBeNull();
    expect(status.programDeployed).toBe(false);
    expect(status.reachable).toBe(false);
    expect(status.cluster).toBe("devnet");
    expect(status.error).toMatch(/SOLANA_PROGRAM_ID/);
  });

  it("reports an unreachable RPC as a value rather than throwing", async () => {
    process.env.SOLANA_PROGRAM_ID = "11111111111111111111111111111111";
    connection.getSlot.mockRejectedValue(new Error("fetch failed"));

    const status = await getChainStatus();

    expect(status.reachable).toBe(false);
    expect(status.error).toBe("RPC unreachable");

    delete process.env.SOLANA_PROGRAM_ID;
  });

  it("reports the slot as a decimal string, never a raw number", async () => {
    process.env.SOLANA_PROGRAM_ID = "11111111111111111111111111111111";
    connection.getSlot.mockResolvedValue(1_234_567_890);

    const status = await getChainStatus();

    // The string is the point: `slot` crosses JSON and Postgres as text so no
    // downstream consumer can silently coerce it to a double.
    expect(status.currentSlot).toBe("1234567890");

    delete process.env.SOLANA_PROGRAM_ID;
  });
});
