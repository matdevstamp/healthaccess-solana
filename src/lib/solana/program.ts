/**
 * The audit program, as the app sees it.
 *
 * Everything address- and byte-layout-related for the on-chain program lives
 * here: the PDA, the 82-byte `AuditTrail` decode, and the `record_access`
 * instruction encoding. The layout mirrors
 * `programs/healthaccess_audit/src/state.rs` and contract §1.
 *
 * `@coral-xyz/anchor` is deliberately not a dependency yet. The Rust side is
 * mid-migration between Anchor 0.x and 1.2, and a TS client pinned to the 0.32
 * codec would need reworking the moment the IDL is regenerated. The client is
 * instead driven by the frozen contract's byte layout, which is stable across
 * that migration. When the deployment exists, `loadIdl()` reads the committed
 * IDL and the discriminators below come from it, so swapping in Anchor's
 * `Program` is a local change to this file.
 */

import { PublicKey, type TransactionInstruction } from "@solana/web3.js";

import { env } from "@/lib/env";
import { ACCESS_EVENT_LEN, canonicalBytes, ZERO_HASH } from "./hash";
import {
  TRAIL_SEED,
  accountDiscriminator,
  instructionDiscriminator,
  loadIdl,
  type AuditIdl,
} from "./idl";

/** The decoded `AuditTrail` account. */
export interface TrailState {
  version: number;
  authority: PublicKey;
  /** 32 bytes. The chain head. */
  headHash: Uint8Array;
  /** BigInt: u64 on chain, and slots/identifiers outgrow `number`. */
  eventCount: bigint;
  bump: number;
}

/** True once task 28 has produced a program id to talk to. */
export function isProgramConfigured(): boolean {
  return env.solanaProgramId.trim().length > 0;
}

/** The deployed program id, or `null` when the deployment has not happened. */
export function programId(): PublicKey | null {
  const raw = env.solanaProgramId.trim();
  if (raw.length === 0) {
    return null;
  }
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}

/**
 * The one global trail PDA, seeds `[b"audit_trail"]`.
 *
 * One trail per system, deliberately: per-organization trails would multiply
 * accounts and contention analysis for no demonstration benefit.
 */
export function trailAddress(id: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from(TRAIL_SEED, "utf8")], id)[0];
}

/**
 * Decode the 82-byte `AuditTrail` account.
 *
 * Layout: `[0..8]` discriminator, `[8]` version, `[9..41]` authority,
 * `[41..73]` head_hash, `[73..81]` event_count (u64 LE), `[81]` bump.
 * The discriminator is checked rather than skipped: a stale build of a program
 * with the same address is exactly the failure this catches.
 */
export function decodeTrail(data: Uint8Array, idl: AuditIdl = loadIdl()): TrailState {
  if (data.length < 82) {
    throw new Error(`AuditTrail account too short: ${data.length} bytes, expected 82`);
  }

  const expected = accountDiscriminator(idl, "AuditTrail");
  for (let i = 0; i < 8; i += 1) {
    if (data[i] !== expected[i]) {
      throw new Error("AuditTrail account discriminator mismatch; wrong program or stale build");
    }
  }

  return {
    version: data[8] ?? 0,
    authority: new PublicKey(data.subarray(9, 41)),
    headHash: data.slice(41, 73),
    eventCount: readU64(data, 73),
    bump: data[81] ?? 0,
  };
}

/**
 * `record_access(event, prev_hash)`.
 *
 * Instruction data is the Anchor discriminator followed by the Borsh
 * serialization of the two arguments: the 83-byte canonical event, then the
 * 32-byte `prev_hash`. No padding, no length prefixes — the whole reason the
 * payload is fixed-size.
 */
export function encodeRecordAccess(
  event: Parameters<typeof canonicalBytes>[0],
  prevHash: Uint8Array,
  idl: AuditIdl = loadIdl(),
): Uint8Array {
  const body = canonicalBytes(event);
  const out = new Uint8Array(8 + ACCESS_EVENT_LEN + 32);
  out.set(instructionDiscriminator(idl, "record_access"), 0);
  out.set(body, 8);
  out.set(prevHash.subarray(0, 32), 8 + ACCESS_EVENT_LEN);
  return out;
}

/** Build the `record_access` instruction with the program and authority resolved. */
export function recordAccessInstruction(input: {
  event: Parameters<typeof canonicalBytes>[0];
  prevHash: Uint8Array;
  authority: PublicKey;
  id?: PublicKey;
  idl?: AuditIdl;
}): TransactionInstruction {
  const program = input.id ?? programId();
  if (!program) {
    throw new Error("SOLANA_PROGRAM_ID is not set; the audit program has not been deployed");
  }

  return {
    programId: program,
    keys: [
      { pubkey: input.authority, isSigner: true, isWritable: true },
      { pubkey: trailAddress(program), isSigner: false, isWritable: true },
    ],
    data: Buffer.from(encodeRecordAccess(input.event, input.prevHash, input.idl ?? loadIdl())),
  };
}

/** The head a freshly initialized, empty trail reports. */
export function initialHead(): Uint8Array {
  return Uint8Array.from(ZERO_HASH);
}

function readU64(data: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let i = 7; i >= 0; i -= 1) {
    value = (value << 8n) | BigInt(data[offset + i] ?? 0);
  }
  return value;
}
