/**
 * The hash chain, client side.
 *
 * These bytes must match `programs/healthaccess_audit/src/{state,hash_chain}.rs`
 * exactly, or a valid log verifies as tampered. That is the whole reason the
 * layout is spelled out here rather than left to a library: the Rust side
 * hand-serializes `AccessEvent` precisely so a silent encoding drift becomes a
 * failing test instead of a passing fraud.
 *
 * Layout, little-endian, no padding (83 bytes):
 *
 * ```text
 * [0..32]    patient_hash
 * [32..64]   actor_hash
 * [64]       action
 * [65]       role
 * [66..74]   record_id   (i64 LE)
 * [74]       server
 * [75..83]   timestamp   (i64 LE)
 * ```
 */

import { createHash } from "node:crypto";

import { env } from "@/lib/env";
import { NO_RECORD, type ChainAction, type ChainRole, type OnChainAccessEvent } from "./types";

/** Total serialized size of an `AccessEvent`, matching `ACCESS_EVENT_LEN`. */
export const ACCESS_EVENT_LEN = 83;

/** The chain head before any entry exists. */
export const ZERO_HASH: Uint8Array = new Uint8Array(32);

/** Domain separator so a patient id can never be read as a user id. */
const PATIENT_DOMAIN = 0x01;
const ACTOR_DOMAIN = 0x02;

/** Deterministic byte serialization. Exactly {@link ACCESS_EVENT_LEN} bytes. */
export function canonicalBytes(event: OnChainAccessEvent): Uint8Array {
  const out = new Uint8Array(ACCESS_EVENT_LEN);

  out.set(event.patientHash.subarray(0, 32), 0);
  out.set(event.actorHash.subarray(0, 32), 32);
  out[64] = event.action;
  out[65] = event.role;
  out.set(i64le(event.recordId), 66);
  out[74] = event.server;
  out.set(i64le(event.timestamp), 75);

  return out;
}

/** `sha256(prev_hash || canonical_bytes(event))`. */
export function chainHead(prev: Uint8Array, event: OnChainAccessEvent): Uint8Array {
  const hasher = createHash("sha256");
  hasher.update(Buffer.from(prev.subarray(0, 32)));
  hasher.update(Buffer.from(canonicalBytes(event)));
  return new Uint8Array(hasher.digest());
}

/** Fold a sequence of events into the resulting head hash. */
export function foldHead(events: readonly OnChainAccessEvent[]): Uint8Array {
  let head = ZERO_HASH;
  for (const event of events) {
    head = chainHead(head, event);
  }
  return head;
}

/**
 * Recompute the chain and compare against the known head.
 *
 * A dropped, reordered, or edited entry produces a different head, which is
 * how a tampered off-chain mirror is detected.
 */
export function verifyChain(events: readonly OnChainAccessEvent[], expected: Uint8Array): boolean {
  return hexEq(foldHead(events), expected.subarray(0, 32));
}

/**
 * Salted hash of a patient id. 32 bytes. The raw id never leaves the server.
 *
 * `sha256(domain || salt || i64le(id))`. The domain byte keeps patient `7` and
 * user `7` from sharing a hash, which matters because the two fields are
 * adjacent in the payload and a collision would let a reader conflate them.
 */
export function hashPatientId(patientId: number): Uint8Array {
  return saltedIdHash(PATIENT_DOMAIN, patientId);
}

/** Salted hash of the acting user's id. 32 bytes. Never the raw id. */
export function hashActorId(userId: number): Uint8Array {
  return saltedIdHash(ACTOR_DOMAIN, userId);
}

function saltedIdHash(domain: number, id: number): Uint8Array {
  const hasher = createHash("sha256");
  hasher.update(Uint8Array.of(domain));
  hasher.update(Buffer.from(env.accessHashSalt));
  hasher.update(Buffer.from(i64le(BigInt(Math.trunc(id)))));
  return new Uint8Array(hasher.digest());
}

/** Little-endian signed 64-bit encoding. BigInt in, 8 bytes out. */
function i64le(value: bigint): Uint8Array {
  const out = new Uint8Array(8);
  let remaining = BigInt.asUintN(64, value);
  for (let i = 0; i < 8; i += 1) {
    out[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return out;
}

/** Hex-encode bytes. Used for display and for the DB's `headHash` column. */
export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

/** Decode hex back to bytes. */
export function fromHex(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase();
  if (normalized.length % 2 !== 0 || !/^[0-9a-f]*$/.test(normalized)) {
    throw new Error(`Invalid hex string: ${hex}`);
  }
  return new Uint8Array(Buffer.from(normalized, "hex"));
}

/** Constant-shape comparison. Both sides are fixed 32-byte hashes. */
export function hexEq(a: Uint8Array, b: Uint8Array): boolean {
  const left = a.subarray(0, 32);
  const right = b.subarray(0, 32);
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Build an {@link OnChainAccessEvent} from raw ids.
 *
 * This is the only place raw ids are allowed to enter the chain pipeline, and
 * it hashes them on the way in. `recordId: null` becomes the `-1` sentinel so
 * the Borsh encoding stays fixed-length.
 */
export function buildAccessEvent(input: {
  patientId: number;
  userId: number;
  action: ChainAction;
  role: ChainRole;
  recordId: number | null;
  server: number;
  timestamp: Date | number;
}): OnChainAccessEvent {
  const timestamp =
    typeof input.timestamp === "number"
      ? BigInt(Math.trunc(input.timestamp))
      : BigInt(Math.trunc(input.timestamp.getTime() / 1000));

  return {
    patientHash: hashPatientId(input.patientId),
    actorHash: hashActorId(input.userId),
    action: input.action,
    role: input.role,
    recordId: input.recordId === null ? NO_RECORD : BigInt(Math.trunc(input.recordId)),
    server: input.server,
    timestamp,
  };
}

/** Map `hospital-s` / `ambulance-a` to the `server` byte on the wire. */
export function serverIndex(serverId: string): number {
  return serverId === "ambulance-a" ? 1 : 0;
}
