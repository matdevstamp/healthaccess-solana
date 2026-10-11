/**
 * Decoding `AccessLogged`.
 *
 * `emit!` does not create an account; it writes the Borsh-serialized event into
 * the transaction log as `Program data: <base64>`. So reading events back means
 * fetching signatures for the trail PDA and decoding those log lines.
 *
 * Layout, 59 bytes, matching the committed IDL exactly:
 *
 * ```text
 * [0..8]    seq         u64 LE
 * [8..40]   head_hash   32 bytes
 * [40]      action      u8
 * [41]      role        u8
 * [42..50]  record_id   i64 LE
 * [50]      server      u8
 * [51..59]  timestamp   i64 LE
 * ```
 *
 * The emitted event deliberately does **not** repeat `patient_hash` and
 * `actor_hash`, even though the instruction argument carries them. The hashes
 * are still committed to — `head_hash = sha256(prev || canonical(event))` and
 * the canonical form includes both — but the per-transaction log stops
 * publishing them. The trade: an outside observer can see that an access
 * happened and to which record, but cannot join events across patients from
 * the logs alone.
 *
 * That means the off-chain mirror cannot be rebuilt from emitted events; it is
 * folded from the server's own rows and compared against `head_hash`. Which is
 * what `verifyLocalOutbox` does.
 */

import type { ChainAction, ChainRole } from "./types";
import { isChainAction, isChainRole } from "./types";

/** 8 (seq) + 32 (head_hash) + 1 + 1 + 8 + 1 + 8 = 59 bytes. */
export const ACCESS_LOGGED_LEN = 59;

export interface AccessLoggedEvent {
  /** Position in the chain. u64, so BigInt. */
  seq: bigint;
  /** The chain head *after* this event was appended. 32 bytes. */
  headHash: Uint8Array;
  action: ChainAction;
  role: ChainRole;
  /** `-1` sentinel for "not tied to a specific record". BigInt, never number. */
  recordId: bigint;
  server: number;
  /** Unix seconds. BigInt, never number. */
  timestamp: bigint;
}

/** The prefix Anchor uses for emitted event data in transaction logs. */
const PROGRAM_DATA_PREFIX = "Program data: ";

/**
 * Decode one `Program data:` payload.
 *
 * Throws on a short or misaligned buffer rather than returning zeros: a
 * half-decoded event would read as a valid one with the wrong `record_id`,
 * which is precisely the kind of thing the verification view must not do.
 */
export function decodeAccessLogged(data: Uint8Array): AccessLoggedEvent {
  if (data.length < ACCESS_LOGGED_LEN) {
    throw new Error(
      `AccessLogged payload too short: ${data.length} bytes, expected ${ACCESS_LOGGED_LEN}`,
    );
  }

  const seq = readU64(data, 0);
  const headHash = data.slice(8, 40);
  const action = data[40] ?? 0;
  const role = data[41] ?? 0;

  if (!isChainAction(action) || !isChainRole(role)) {
    throw new Error(`AccessLogged carries an out-of-range enum: action=${action} role=${role}`);
  }

  return {
    seq,
    headHash,
    action,
    role,
    recordId: readI64(data, 42),
    server: data[50] ?? 0,
    timestamp: readI64(data, 51),
  };
}

/** Pull the emitted-event base64 out of a transaction's log lines. */
export function extractProgramData(logMessages: readonly string[]): Uint8Array | null {
  for (let i = logMessages.length - 1; i >= 0; i -= 1) {
    const line = logMessages[i] ?? "";
    const index = line.indexOf(PROGRAM_DATA_PREFIX);
    if (index === -1) {
      continue;
    }
    const encoded = line.slice(index + PROGRAM_DATA_PREFIX.length).trim();
    try {
      return new Uint8Array(Buffer.from(encoded, "base64"));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Decode every `AccessLogged` in a transaction's logs.
 *
 * A transaction can emit more than one, so this returns a list rather than
 * pretending there is only ever one.
 */
export function decodeAccessLogs(logMessages: readonly string[]): AccessLoggedEvent[] {
  const events: AccessLoggedEvent[] = [];
  for (const line of logMessages) {
    const index = line.indexOf(PROGRAM_DATA_PREFIX);
    if (index === -1) {
      continue;
    }
    try {
      events.push(
        decodeAccessLogged(
          new Uint8Array(
            Buffer.from(line.slice(index + PROGRAM_DATA_PREFIX.length).trim(), "base64"),
          ),
        ),
      );
    } catch {
      // Some programs emit other events on the same transaction; skip, do not
      // fail the whole read.
      continue;
    }
  }
  return events;
}

function readU64(data: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let i = 7; i >= 0; i -= 1) {
    value = (value << 8n) | BigInt(data[offset + i] ?? 0);
  }
  return value;
}

function readI64(data: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let i = 7; i >= 0; i -= 1) {
    value = (value << 8n) | BigInt(data[offset + i] ?? 0);
  }
  return BigInt.asIntN(64, value);
}
