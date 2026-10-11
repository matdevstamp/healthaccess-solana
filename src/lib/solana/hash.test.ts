import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  ACCESS_EVENT_LEN,
  ZERO_HASH,
  buildAccessEvent,
  canonicalBytes,
  chainHead,
  foldHead,
  fromHex,
  hashActorId,
  hashPatientId,
  hexEq,
  serverIndex,
  toHex,
  verifyChain,
} from "@/lib/solana/hash";
import { NO_RECORD, type OnChainAccessEvent } from "@/lib/solana/types";

/**
 * These bytes must match `programs/healthaccess_audit/src/state.rs` exactly.
 * If they drift, a valid log verifies as tampered, so the layout is asserted
 * offset by offset rather than just by length.
 */

function ev(overrides: Partial<OnChainAccessEvent> = {}): OnChainAccessEvent {
  return {
    patientHash: new Uint8Array(32).fill(1),
    actorHash: new Uint8Array(32).fill(2),
    action: 0,
    role: 0,
    recordId: 7n,
    server: 0,
    timestamp: 1_700_000_000n,
    ...overrides,
  };
}

describe("canonicalBytes", () => {
  it("is exactly 83 bytes", () => {
    expect(ACCESS_EVENT_LEN).toBe(83);
    expect(canonicalBytes(ev())).toHaveLength(83);
  });

  it("lays out each field at the offset the Rust state.rs uses", () => {
    const bytes = canonicalBytes(ev());

    expect(bytes.slice(0, 32)).toEqual(new Uint8Array(32).fill(1));
    expect(bytes.slice(32, 64)).toEqual(new Uint8Array(32).fill(2));
    expect(bytes[64]).toBe(0); // action
    expect(bytes[65]).toBe(0); // role
    expect(Array.from(bytes.slice(66, 74))).toEqual([7, 0, 0, 0, 0, 0, 0, 0]); // record_id i64 LE
    expect(bytes[74]).toBe(0); // server
    expect(Array.from(bytes.slice(75, 83))).toEqual([0, 0xf1, 0x53, 0x65, 0, 0, 0, 0]); // timestamp
  });

  it("encodes the -1 record sentinel rather than an Option", () => {
    const bytes = canonicalBytes(ev({ recordId: NO_RECORD }));

    expect(Array.from(bytes.slice(66, 74))).toEqual([255, 255, 255, 255, 255, 255, 255, 255]);
  });

  it("encodes a negative i64 timestamp in two's complement", () => {
    const bytes = canonicalBytes(ev({ timestamp: -1n }));

    expect(Array.from(bytes.slice(75, 83))).toEqual([255, 255, 255, 255, 255, 255, 255, 255]);
  });
});

describe("chainHead", () => {
  it("is sha256(prev || canonical_bytes(event))", () => {
    const prev = new Uint8Array(32).fill(9);
    const event = ev();
    const expected = createHash("sha256")
      .update(Buffer.from(prev))
      .update(Buffer.from(canonicalBytes(event)))
      .digest();

    expect(toHex(chainHead(prev, event))).toBe(expected.toString("hex"));
  });

  it("chains the first event from the zero hash", () => {
    expect(chainHead(ZERO_HASH, ev())).toEqual(foldHead([ev()]));
  });

  it("changes when any field changes", () => {
    const base = toHex(chainHead(ZERO_HASH, ev()));
    const mutations: Partial<OnChainAccessEvent>[] = [
      { patientHash: new Uint8Array(32).fill(5) },
      { actorHash: new Uint8Array(32).fill(5) },
      { action: 3 },
      { role: 2 },
      { recordId: 999n },
      { server: 1 },
      { timestamp: 42n },
    ];

    for (const mutation of mutations) {
      expect(toHex(chainHead(ZERO_HASH, ev(mutation)))).not.toBe(base);
    }
  });
});

describe("verifyChain", () => {
  const first = ev();
  const second = ev({ recordId: 8n });
  const third = ev({ recordId: 9n });
  const events = [first, second, third];

  it("accepts an intact log", () => {
    expect(verifyChain(events, foldHead(events))).toBe(true);
  });

  it("accepts an empty log against the zero head", () => {
    expect(verifyChain([], ZERO_HASH)).toBe(true);
  });

  it("rejects a dropped entry", () => {
    const head = foldHead(events);

    expect(verifyChain([first, third], head)).toBe(false);
  });

  it("rejects reordered entries", () => {
    const head = foldHead(events);

    expect(verifyChain([first, third, second], head)).toBe(false);
  });

  it("rejects an edited entry", () => {
    const head = foldHead(events);

    expect(verifyChain([first, { ...second, action: 3 }, third], head)).toBe(false);
  });

  it("rejects a truncated log", () => {
    const head = foldHead(events);

    expect(verifyChain(events.slice(0, 2), head)).toBe(false);
  });

  it("rejects an appended entry", () => {
    const head = foldHead([first, second]);

    expect(verifyChain(events, head)).toBe(false);
  });
});

describe("salted id hashing", () => {
  it("is 32 bytes", () => {
    expect(hashPatientId(1)).toHaveLength(32);
    expect(hashActorId(1)).toHaveLength(32);
  });

  it("is deterministic for the same id", () => {
    expect(toHex(hashPatientId(42))).toBe(toHex(hashPatientId(42)));
  });

  it("never returns the raw id as bytes", () => {
    // Not a proof of preimage resistance; a check that the small integers do
    // not simply appear in the digest.
    expect(hashPatientId(7)).not.toContain(7);
  });

  it("separates patient and actor domains so id 7 differs in both fields", () => {
    expect(toHex(hashPatientId(7))).not.toBe(toHex(hashActorId(7)));
  });

  it("changes the digest when the salt changes", async () => {
    const original = toHex(hashPatientId(7));

    // The salt is read through env's lazy getter, so swapping it does not need
    // a module reset — only a fresh hash call.
    process.env.ACCESS_HASH_SALT = "b".repeat(64);
    const rehashed = toHex(hashPatientId(7));
    process.env.ACCESS_HASH_SALT = "a".repeat(64);

    expect(rehashed).not.toBe(original);
  });
});

describe("buildAccessEvent", () => {
  it("hashes the ids rather than carrying them", () => {
    const event = buildAccessEvent({
      patientId: 3,
      userId: 4,
      action: 0,
      role: 0,
      recordId: 11,
      server: 0,
      timestamp: new Date(1_700_000_000_000),
    });

    expect(event.patientHash).toEqual(hashPatientId(3));
    expect(event.actorHash).toEqual(hashActorId(4));
    expect(event.recordId).toBe(11n);
    expect(event.timestamp).toBe(1_700_000_000n);
  });

  it("uses the -1 sentinel for a null record id", () => {
    const event = buildAccessEvent({
      patientId: 1,
      userId: 1,
      action: 4,
      role: 5,
      recordId: null,
      server: 0,
      timestamp: 0,
    });

    expect(event.recordId).toBe(NO_RECORD);
  });
});

describe("serverIndex", () => {
  it("maps the two-node deployment to 0 and 1", () => {
    expect(serverIndex("hospital-s")).toBe(0);
    expect(serverIndex("ambulance-a")).toBe(1);
  });
});

describe("hex helpers", () => {
  it("round-trips", () => {
    const bytes = new Uint8Array([0, 1, 254, 255]);

    expect(fromHex(toHex(bytes))).toEqual(bytes);
  });

  it("rejects a malformed hex string", () => {
    expect(() => fromHex("nothex")).toThrow(/Invalid hex/);
    expect(() => fromHex("abc")).toThrow(/Invalid hex/);
  });

  it("compares hashes without short-circuiting on length", () => {
    expect(hexEq(new Uint8Array(32).fill(1), new Uint8Array(32).fill(1))).toBe(true);
    expect(hexEq(new Uint8Array(32).fill(1), new Uint8Array(32).fill(2))).toBe(false);
    expect(hexEq(new Uint8Array(31), new Uint8Array(32))).toBe(false);
  });
});
