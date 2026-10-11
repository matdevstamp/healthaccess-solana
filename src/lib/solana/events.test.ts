import { describe, expect, it } from "vitest";

import {
  ACCESS_LOGGED_LEN,
  decodeAccessLogged,
  decodeAccessLogs,
  extractProgramData,
} from "@/lib/solana/events";
import { canonicalBytes, toHex } from "@/lib/solana/hash";
import type { OnChainAccessEvent } from "@/lib/solana/types";

/**
 * `emit!` writes the Borsh-serialized event into the transaction log as
 * `Program data: <base64>`. The emitted struct is
 * `AccessLogged { seq, head_hash, ...event }`, so the payload is
 * `u64 seq || head_hash || the 83-byte event`.
 */

function payload(seq: bigint, headHash: Uint8Array, event: OnChainAccessEvent): Uint8Array {
  const out = new Uint8Array(8 + 32 + 83);
  const seqBytes = Buffer.alloc(8);
  seqBytes.writeBigUInt64LE(seq);
  out.set(seqBytes, 0);
  out.set(headHash, 8);
  out.set(canonicalBytes(event), 40);
  return out;
}

const event: OnChainAccessEvent = {
  patientHash: new Uint8Array(32).fill(3),
  actorHash: new Uint8Array(32).fill(4),
  action: 4,
  role: 5,
  recordId: -1n,
  server: 1,
  timestamp: 1_700_000_000n,
};

const head = new Uint8Array(32).fill(7);

describe("decodeAccessLogged", () => {
  it("round-trips every field, keeping the 64-bit values as bigint", () => {
    const decoded = decodeAccessLogged(payload(42n, head, event));

    expect(decoded.seq).toBe(42n);
    expect(toHex(decoded.headHash)).toBe(toHex(head));
    expect(toHex(decoded.patientHash)).toBe(toHex(event.patientHash));
    expect(toHex(decoded.actorHash)).toBe(toHex(event.actorHash));
    expect(decoded.action).toBe(4);
    expect(decoded.role).toBe(5);
    expect(decoded.recordId).toBe(-1n);
    expect(decoded.server).toBe(1);
    expect(decoded.timestamp).toBe(1_700_000_000n);
  });

  it("decodes a seq past Number.MAX_SAFE_INTEGER without losing precision", () => {
    const huge = 9_007_199_254_740_993n; // 2^53 + 1

    const decoded = decodeAccessLogged(payload(huge, head, event));

    expect(decoded.seq).toBe(huge);
    // Proof it never went through `number`: the double round-trip loses the +1.
    expect(Number(huge)).not.toBe(huge);
  });

  it("is exactly 123 bytes", () => {
    expect(ACCESS_LOGGED_LEN).toBe(123);
    expect(payload(1n, head, event)).toHaveLength(123);
  });

  it("rejects a short payload rather than returning zeros", () => {
    expect(() => decodeAccessLogged(new Uint8Array(10))).toThrow(/too short/);
  });

  it("rejects an out-of-range enum instead of inventing a value", () => {
    const bytes = payload(1n, head, event);
    bytes[104] = 9; // action, beyond the contract's 0..5
    bytes[105] = 9; // role

    expect(() => decodeAccessLogged(bytes)).toThrow(/out-of-range enum/);
  });
});

describe("extractProgramData", () => {
  it("finds the emitted payload in a transaction log", () => {
    const encoded = Buffer.from(payload(1n, head, event)).toString("base64");
    const logs = ["Program 4wJq upy", `Program data: ${encoded}`, "Program 4wJq success"];

    expect(toHex(extractProgramData(logs) ?? new Uint8Array())).toBe(
      toHex(payload(1n, head, event)),
    );
  });

  it("returns null when the transaction emitted nothing", () => {
    expect(extractProgramData(["Program 4wJq invoke [1]", "Program 4wJq success"])).toBeNull();
  });

  it("takes the last emission when a transaction emits several", () => {
    const first = Buffer.from(payload(1n, head, event)).toString("base64");
    const second = Buffer.from(payload(2n, head, event)).toString("base64");

    expect(
      toHex(
        extractProgramData([`Program data: ${first}`, `Program data: ${second}`]) ??
          new Uint8Array(),
      ),
    ).toBe(toHex(payload(2n, head, event)));
  });
});

describe("decodeAccessLogs", () => {
  it("returns every emission on the transaction", () => {
    const first = Buffer.from(payload(1n, head, event)).toString("base64");
    const second = Buffer.from(payload(2n, head, event)).toString("base64");

    const decoded = decodeAccessLogs([
      "Program log: unrelated",
      `Program data: ${first}`,
      `Program data: ${second}`,
    ]);

    expect(decoded.map((entry) => entry.seq)).toEqual([1n, 2n]);
  });

  it("skips a payload it cannot decode rather than failing the whole read", () => {
    const good = Buffer.from(payload(1n, head, event)).toString("base64");

    const decoded = decodeAccessLogs(["Program data: bm90LWFuLWV2ZW50", `Program data: ${good}`]);

    expect(decoded).toHaveLength(1);
  });

  it("returns an empty list for a transaction with no emissions", () => {
    expect(decodeAccessLogs(["Program 4wJq success"])).toEqual([]);
  });
});
