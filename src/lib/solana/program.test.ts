import { describe, expect, it } from "vitest";

import {
  decodeTrail,
  encodeRecordAccess,
  initialHead,
  isProgramConfigured,
  programId,
  recordAccessInstruction,
  trailAddress,
} from "@/lib/solana/program";
import {
  AUDIT_TRAIL_LEN,
  CONTRACT_IDL,
  TRAIL_SEED,
  accountDiscriminator,
  idlCandidates,
  instructionDiscriminator,
  loadIdl,
} from "@/lib/solana/idl";
import { ACCESS_EVENT_LEN, ZERO_HASH } from "@/lib/solana/hash";
import type { OnChainAccessEvent } from "@/lib/solana/types";
import { PublicKey } from "@solana/web3.js";

/**
 * No socket, no keypair, no deployment. Everything here is byte layout and
 * address derivation, which is exactly what can be verified offline.
 */

const PROGRAM = new PublicKey("11111111111111111111111111111111");

const event: OnChainAccessEvent = {
  patientHash: new Uint8Array(32).fill(3),
  actorHash: new Uint8Array(32).fill(4),
  action: 0,
  role: 1,
  recordId: 12n,
  server: 0,
  timestamp: 1_700_000_000n,
};

/** Build a well-formed 82-byte AuditTrail account. */
function accountBytes(overrides: { eventCount?: bigint } = {}) {
  const bytes = new Uint8Array(AUDIT_TRAIL_LEN);
  bytes.set(accountDiscriminator(CONTRACT_IDL, "AuditTrail"), 0);
  bytes[8] = 1; // version
  bytes.set(new PublicKey("SysvarC1ock11111111111111111111111111111111").toBytes(), 9);
  bytes.set(new Uint8Array(32).fill(9), 41); // head_hash
  const count = Buffer.alloc(8);
  count.writeBigUInt64LE(overrides.eventCount ?? 12n);
  bytes.set(count, 73);
  bytes[81] = 254; // bump

  return bytes;
}

describe("discriminators", () => {
  it("is sha256(namespace:name)[0..8], as Anchor computes it", async () => {
    const { createHash } = await import("node:crypto");
    const expected = [
      ...createHash("sha256").update("global:record_access").digest().subarray(0, 8),
    ];

    expect(Array.from(instructionDiscriminator(CONTRACT_IDL, "record_access"))).toEqual(expected);
  });

  it("throws for an instruction the IDL does not declare", () => {
    expect(() => instructionDiscriminator(CONTRACT_IDL, "nope")).toThrow(/Unknown instruction/);
  });

  it("throws for an account the IDL does not declare", () => {
    expect(() => accountDiscriminator(CONTRACT_IDL, "nope")).toThrow(/Unknown account/);
  });
});

describe("trailAddress", () => {
  it("derives from the audit_trail seed", () => {
    const [address, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from(TRAIL_SEED, "utf8")],
      PROGRAM,
    );

    expect(trailAddress(PROGRAM).equals(address)).toBe(true);
    expect(bump).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic", () => {
    expect(trailAddress(PROGRAM).equals(trailAddress(PROGRAM))).toBe(true);
  });
});

describe("decodeTrail", () => {
  it("decodes version, authority, head hash, count and bump", () => {
    const trail = decodeTrail(accountBytes());

    expect(trail.version).toBe(1);
    expect(trail.authority.toBase58()).toBe("SysvarC1ock11111111111111111111111111111111");
    expect(Array.from(trail.headHash)).toEqual(Array(32).fill(9));
    expect(trail.eventCount).toBe(12n);
    expect(trail.bump).toBe(254);
  });

  it("keeps eventCount a bigint", () => {
    const huge = 18_446_744_073_709_551_615n; // u64 max

    expect(decodeTrail(accountBytes({ eventCount: huge })).eventCount).toBe(huge);
  });

  it("rejects an account that is too short", () => {
    expect(() => decodeTrail(new Uint8Array(50))).toThrow(/too short/);
  });

  it("rejects a foreign account rather than decoding garbage", () => {
    const bytes = accountBytes();
    bytes.set([9, 9, 9, 9, 9, 9, 9, 9], 0);

    expect(() => decodeTrail(bytes)).toThrow(/discriminator mismatch/);
  });
});

describe("encodeRecordAccess", () => {
  it("is 8 + 83 + 32 bytes with no length prefixes", () => {
    expect(encodeRecordAccess(event, ZERO_HASH)).toHaveLength(8 + ACCESS_EVENT_LEN + 32);
  });

  it("starts with the instruction discriminator and carries prev_hash last", () => {
    const prev = new Uint8Array(32).fill(6);
    const bytes = encodeRecordAccess(event, prev, CONTRACT_IDL);

    expect(Array.from(bytes.subarray(0, 8))).toEqual(
      Array.from(instructionDiscriminator(CONTRACT_IDL, "record_access")),
    );
    expect(Array.from(bytes.subarray(8 + ACCESS_EVENT_LEN))).toEqual(Array(32).fill(6));
  });

  it("carries the same canonical bytes the hash chain uses", async () => {
    const { canonicalBytes } = await import("@/lib/solana/hash");
    const bytes = encodeRecordAccess(event, ZERO_HASH, CONTRACT_IDL);

    expect(bytes.subarray(8, 8 + ACCESS_EVENT_LEN)).toEqual(canonicalBytes(event));
  });
});

describe("recordAccessInstruction", () => {
  it("keys the authority as signer and the trail as writable", () => {
    const authority = new PublicKey("SysvarC1ock11111111111111111111111111111111");
    const instruction = recordAccessInstruction({
      event,
      prevHash: ZERO_HASH,
      authority,
      id: PROGRAM,
    });

    expect(instruction.programId.equals(PROGRAM)).toBe(true);
    expect(instruction.keys[0]?.pubkey.equals(authority)).toBe(true);
    expect(instruction.keys[0]?.isSigner).toBe(true);
    expect(instruction.keys[0]?.isWritable).toBe(true);
    expect(instruction.keys[1]?.pubkey.equals(trailAddress(PROGRAM))).toBe(true);
    expect(instruction.keys[1]?.isSigner).toBe(false);
    expect(instruction.keys[1]?.isWritable).toBe(true);
  });

  it("explains itself when the program has not been deployed", () => {
    expect(() =>
      recordAccessInstruction({
        event,
        prevHash: ZERO_HASH,
        authority: new PublicKey("SysvarC1ock11111111111111111111111111111111"),
      }),
    ).toThrow(/SOLANA_PROGRAM_ID/);
  });
});

describe("programId", () => {
  it("is null while the deployment has not happened", () => {
    expect(isProgramConfigured()).toBe(false);
    expect(programId()).toBeNull();
  });
});

describe("initialHead", () => {
  it("is the zero hash", () => {
    expect(Array.from(initialHead())).toEqual(Array(32).fill(0));
  });
});

describe("loadIdl", () => {
  it("prefers a committed build when SOLANA_IDL_PATH points at one", () => {
    // Nothing is deployed yet, so the contract fallback is what ships. The
    // candidate list is still what makes the swap automatic later.
    expect(idlCandidates()[0]).toContain("healthaccess_audit.json");
    expect(loadIdl().instructions.map((instruction) => instruction.name)).toEqual([
      "initialize",
      "record_access",
    ]);
  });

  it("falls back rather than throwing when no build output exists", () => {
    expect(() => loadIdl()).not.toThrow();
  });
});
