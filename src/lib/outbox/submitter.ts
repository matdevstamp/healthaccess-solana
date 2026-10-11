/**
 * The seam between the outbox and the chain.
 *
 * The flusher imports this interface and nothing else from `src/lib/solana`.
 * That is what lets the state machine, the retry classification, and the
 * backoff be tested in wave 1, before the program is deployed and with no
 * Solana dependency in sight. Task 30 supplies the real implementation;
 * task 26's tests supply a mock.
 */

import type { OnChainAccessEvent } from "@/lib/solana/types";

/** 32 bytes. */
export type Hash32 = Uint8Array;

/**
 * Why a submit failed, and whether trying again can help.
 *
 * The distinction is the whole point: `ChainBroken` means someone else advanced
 * the chain, so a retry that re-reads the head will succeed. `Unauthorized`
 * means the program will reject this signer forever, so retrying only burns
 * rate limit and delays the terminal state.
 */
export type SubmitFailureKind = "chain-broken" | "transient" | "terminal";

/** Every error the flusher is allowed to see, already classified. */
export class ChainSubmitError extends Error {
  readonly kind: SubmitFailureKind;

  constructor(kind: SubmitFailureKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ChainSubmitError";
    this.kind = kind;
  }

  /** A stale `prev_hash`: re-read the head and the next attempt can win. */
  static chainBroken(message = "prev_hash does not match the chain head"): ChainSubmitError {
    return new ChainSubmitError("chain-broken", message);
  }

  /** RPC unreachable, rate limited, or the blockhash expired. Worth retrying. */
  static transient(message: string, options?: { cause?: unknown }): ChainSubmitError {
    return new ChainSubmitError("transient", message, options);
  }

  /** Auth, unknown instruction, or an account the program will never accept. */
  static terminal(message: string, options?: { cause?: unknown }): ChainSubmitError {
    return new ChainSubmitError("terminal", message, options);
  }
}

/** What a submitter must be able to do. Deliberately two methods. */
export interface ChainSubmitter {
  /** Read the current chain head. Called again before *every* attempt. */
  fetchHead(): Promise<Hash32>;

  /** Anchor `event` onto the chain after `prevHash`. Resolves to the signature. */
  submit(event: OnChainAccessEvent, prevHash: Hash32): Promise<string>;
}

/** Anchor error codes from `programs/healthaccess_audit/src/errors.rs`. */
export const AUDIT_ERROR = {
  unauthorized: 6000,
  chainBroken: 6001,
  accountAlreadyInitialized: 6002,
} as const;

const CHAIN_BROKEN_NAMES = new Set(["ChainBroken", "chain broken", "chainbroken"]);
const TERMINAL_NAMES = new Set([
  "Unauthorized",
  "AccountAlreadyInitialized",
  "unauthorized signer",
  "audit trail already initialized",
]);

/**
 * Classify an arbitrary thrown value into a {@link SubmitFailureKind}.
 *
 * Anchor surfaces program errors in several shapes depending on version: a
 * custom error code, a `ProgramError` with a message, or the raw log string.
 * All three are matched here so the flusher never has to know the shape, and
 * so an unrecognised error defaults to *transient* rather than being thrown
 * away — an unanchored event is recoverable, a wrongly-dropped one is not.
 */
export function classifySubmitError(error: unknown): SubmitFailureKind {
  if (error instanceof ChainSubmitError) {
    return error.kind;
  }

  const haystack = describeError(error).toLowerCase();

  for (const name of CHAIN_BROKEN_NAMES) {
    if (haystack.includes(name)) {
      return "chain-broken";
    }
  }

  for (const name of TERMINAL_NAMES) {
    if (haystack.includes(name.toLowerCase())) {
      return "terminal";
    }
  }

  // 6000/6001/6002 are the audit program's custom error codes. Anchor renders
  // them as "custom program error: 0x1771" (decimal 6001) or as the name.
  if (/\b6001\b/.test(haystack) || haystack.includes("0x1771")) {
    return "chain-broken";
  }
  if (/\b6000\b/.test(haystack) || /\b6002\b/.test(haystack)) {
    return "terminal";
  }

  if (
    /(fetch failed|econnrefused|econnreset|etimedout|timeout|socket hang up|429|rate limit|blockhash not found|block height exceeded)/.test(
      haystack,
    )
  ) {
    return "transient";
  }

  return "transient";
}

/** Flatten anything throwable into a searchable string. */
function describeError(error: unknown): string {
  if (error === null || error === undefined) {
    return "";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    const logs = (error as { logs?: unknown }).logs;
    return [error.message, typeof code === "number" ? String(code) : "", stringify(logs)]
      .filter(Boolean)
      .join(" ");
  }
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [record.message, record.code, stringify(record.logs)]
      .filter((part) => part !== undefined && part !== null)
      .map(String)
      .join(" ");
  }
  return String(error);
}

function stringify(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}
