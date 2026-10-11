import { describe, expect, it } from "vitest";

import {
  ACCESS_LOGGED_LEN,
  decodeAccessLogged,
  decodeAccessLogs,
  extractProgramData,
} from "@/lib/solana/events";
import { toHex } from "@/lib/solana/hash";

/**
 * `emit!` writes the Borsh-serialized event into the transaction log as
 * `Program data: <base64>`. The emitted struct is 59 bytes:
 * `u64 seq || head_hash || action || role || record_id || server || timestamp`.
 *
 * These offsets are pinned against the committed IDL, not against a guess —
 * see the cross-check in `program.test.ts`.
 */

interface Fields {
  seq: bigint;
  headHash: Uint8Array;
  action: number;
  role: number;
  recordId: bigint;
  server: number;
  timestamp: bigint;
}

function payload(fields: Fields): Uint8Array {
  const out = new Uint8Array(8 + 32 + 1 + 1 + 8 + 1 + 8);
  const seq = Buffer.alloc(8);
  seq.writeBigUInt64LE(fields.seq);
  out.set(seq, 0);
  out.set(fields.headHash, 8);
  out[40] = fields.action;
  out[41] = fields.role;
  const record = Buffer.alloc(8);
  record.writeBigInt64LE(fields.recordId);
  out.set(record, 42);
  out[50] = fields.server;
  const timestamp = Buffer.alloc(8);
  timestamp.writeBigInt64LE(fields.timestamp);
  out.set(timestamp, 51);
  return out;
}

const fields: Fields = {
  seq: 0n,
  headHash: new Uint8Array(32),
  action: 4,
  role: 5,
  recordId: -1n,
  server: 1,
  timestamp: 1_700_000_000n,
};

/** A payload with every field set to a recognisable, distinct value. */
function sample(overrides: Partial<Fields> = {}): Uint8Array {
  return payload({ ...fields, seq: 42n, headHash: new Uint8Array(32).fill(7), ...overrides });
}

describe("decodeAccessLogged", () => {
  it("round-trips every field, keeping the 64-bit values as bigint", () => {
    const decoded = decodeAccessLogged(sample());

    expect(decoded.seq).toBe(42n);
    expect(toHex(decoded.headHash)).toBe(toHex(new Uint8Array(32).fill(7)));
    expect(decoded.action).toBe(4);
    expect(decoded.role).toBe(5);
    expect(decoded.recordId).toBe(-1n);
    expect(decoded.server).toBe(1);
    expect(decoded.timestamp).toBe(1_700_000_000n);
  });

  it("does not publish the patient or actor hashes", () => {
    const decoded = decodeAccessLogged(sample()) as unknown as Record<string, unknown>;

    // The hashes are committed to via head_hash, but the emitted event stopped
    // repeating them. Asserting the absence keeps a future change to that
    // privacy decision from being accidental.
    expect(decoded).not.toHaveProperty("patientHash");
    expect(decoded).not.toHaveProperty("actorHash");
  });

  it("decodes a seq past Number.MAX_SAFE_INTEGER without losing precision", () => {
    const huge = 9_007_199_254_740_993n; // 2^53 + 1

    const decoded = decodeAccessLogged(sample({ seq: huge }));

    expect(decoded.seq).toBe(huge);
    // Proof it never went through `number`: the double round-trip loses the +1.
    expect(Number(huge)).not.toBe(huge);
  });

  it("is exactly 59 bytes", () => {
    expect(ACCESS_LOGGED_LEN).toBe(59);
    expect(sample()).toHaveLength(59);
  });

  it("rejects a short payload rather than returning zeros", () => {
    expect(() => decodeAccessLogged(new Uint8Array(10))).toThrow(/too short/);
  });

  it("rejects an out-of-range enum instead of inventing a value", () => {
    const bytes = sample();
    const at = (index: number, value: number) => {
      bytes[index] = value;
    };
    at(40, 9); // action, beyond the contract's 0..5
    at(41, 9); // role

    expect(() => decodeAccessLogged(bytes)).toThrow(/out-of-range enum/);
  });
});

describe("extractProgramData", () => {
  it("finds the emitted payload in a transaction log", () => {
    const encoded = Buffer.from(sample()).toString("base64");
    const logs = ["Program 4wJq upy", `Program data: ${encoded}`, "Program 4wJq success"];

    expect(toHex(extractProgramData(logs) ?? new Uint8Array())).toBe(toHex(sample()));
  });

  it("returns null when the transaction emitted nothing", () => {
    expect(extractProgramData(["Program 4wJq invoke [1]", "Program 4wJq success"])).toBeNull();
  });

  it("takes the last emission when a transaction emits several", () => {
    const first = Buffer.from(sample({ seq: 1n })).toString("base64");
    const second = Buffer.from(sample({ seq: 2n })).toString("base64");

    expect(
      toHex(
        extractProgramData([`Program data: ${first}`, `Program data: ${second}`]) ??
          new Uint8Array(),
      ),
    ).toBe(toHex(sample({ seq: 2n })));
  });
});

describe("decodeAccessLogs", () => {
  it("returns every emission on the transaction", () => {
    const first = Buffer.from(sample({ seq: 1n })).toString("base64");
    const second = Buffer.from(sample({ seq: 2n })).toString("base64");

    const decoded = decodeAccessLogs([
      "Program log: unrelated",
      `Program data: ${first}`,
      `Program data: ${second}`,
    ]);

    expect(decoded.map((entry) => entry.seq)).toEqual([1n, 2n]);
  });

  it("skips a payload it cannot decode rather than failing the whole read", () => {
    const good = Buffer.from(sample()).toString("base64");

    const decoded = decodeAccessLogs(["Program data: bm90LWFuLWV2ZW50", `Program data: ${good}`]);

    expect(decoded).toHaveLength(1);
  });

  it("returns an empty list for a transaction with no emissions", () => {
    expect(decodeAccessLogs(["Program 4wJq success"])).toEqual([]);
  });
});
