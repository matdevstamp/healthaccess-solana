/**
 * Decoding `AccessLogged`.
 *
 * `emit!` does not create an account; it writes the Borsh-serialized event into
 * the transaction log as `Program data: <base64>`. So reading events back means
 * fetching signatures for the trail PDA and decoding those log lines.
 *
 * The wire layout is `u64 seq`, `head_hash`, then the 83-byte canonical event,
 * because the program emits `AccessLogged { seq, head_hash, ...event }`.
 */

import type { OnChainAccessEvent } from "./types";
import { isChainAction, isChainRole } from "./types";

/** 8 (seq) + 32 (head_hash) + 83 (event) = 123 bytes. */
export const ACCESS_LOGGED_LEN = 123;

export interface AccessLoggedEvent extends OnChainAccessEvent {
  /** Position in the chain. u64, so BigInt. */
  seq: bigint;
  /** The chain head *after* this event was appended. */
  headHash: Uint8Array;
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
  const patientHash = data.slice(40, 72);
  const actorHash = data.slice(72, 104);
  const action = data[104] ?? 0;
  const role = data[105] ?? 0;

  if (!isChainAction(action) || !isChainRole(role)) {
    throw new Error(`AccessLogged carries an out-of-range enum: action=${action} role=${role}`);
  }

  return {
    seq,
    headHash,
    patientHash,
    actorHash,
    action,
    role,
    recordId: readI64(data, 106),
    server: data[114] ?? 0,
    timestamp: readI64(data, 115),
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
