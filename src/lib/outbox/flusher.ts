/**
 * The flusher: drains the outbox onto the chain.
 *
 * It depends on exactly two things — a {@link ChainSubmitter} and an
 * {@link OutboxStore} — and neither is `@solana/web3.js`. That is deliberate:
 * the retry semantics below are the part most likely to be wrong, and testing
 * them against a live cluster would make them the part least likely to be
 * tested.
 *
 * The rule that matters: **every attempt re-reads the head.** A blind retry
 * resubmits the same stale `prev_hash` and fails identically forever, which is
 * the normal case once two servers write to one PDA.
 */

import { ZERO_HASH, chainHead, toHex } from "@/lib/solana/hash";
import {
  ChainSubmitError,
  classifySubmitError,
  type ChainSubmitter,
  type SubmitFailureKind,
} from "./submitter";
import { toChainEvent, type OutboxEntry, type OutboxStore } from "./store";

/** Attempts per entry before it is parked as `failed`. */
export const MAX_ATTEMPTS = 5;

/** Backoff base. Doubles per attempt; a demo should not wait minutes. */
export const BASE_BACKOFF_MS = 250;

/** `250ms, 500ms, 1s, 2s…` capped, so a stuck row cannot hold a worker forever. */
export function backoffMs(attempt: number, base = BASE_BACKOFF_MS): number {
  return Math.min(base * 2 ** Math.max(0, attempt), 30_000);
}

export interface FlusherDeps {
  submitter: ChainSubmitter;
  store: OutboxStore;
  /** Injected so tests do not actually wait. */
  sleep?: (ms: number) => Promise<void>;
  /** Returns the slot the transaction landed in, for the outbox row. */
  resolveSlot?: (signature: string) => Promise<bigint | null>;
}

export interface FlushResult {
  status: "anchored" | "failed" | "skipped";
  signature: string | null;
  kind: SubmitFailureKind | null;
  error: string | null;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Anchor one entry onto the chain.
 *
 * Returns rather than throws: a flusher failure must never surface in the user
 * request that produced the event, and one poisoned row must not stop the sweep.
 */
export async function flushEntry(entry: OutboxEntry, deps: FlusherDeps): Promise<FlushResult> {
  const sleep = deps.sleep ?? defaultSleep;
  const event = toChainEvent(entry);

  const claimed = await deps.store.claim(entry.id);
  if (!claimed) {
    // Another server owns this row. Not an error; there is nothing to do.
    return { status: "skipped", signature: null, kind: null, error: null };
  }

  // Snapshot it. The store's row is mutated in place by the mark* calls, and
  // reading `claimed.attempt` inside the loop would compound the increments.
  // `claim` already recorded one attempt, so the loop's index is added to it
  // rather than counted from zero.
  const baseAttempt = claimed.attempt;

  let lastError: string | null = null;
  let lastKind: SubmitFailureKind | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let prevHash: Uint8Array;

    // RE-READ on every attempt, including the first. A head cached before the
    // loop is stale the moment another writer commits.
    try {
      prevHash = await deps.submitter.fetchHead();
    } catch (error) {
      lastKind = classifySubmitError(error);
      lastError = messageOf(error);
      await deps.store.markRetry(entry.id, baseAttempt + attempt, lastError);
      if (attempt === MAX_ATTEMPTS - 1) {
        break;
      }
      await sleep(backoffMs(attempt));
      continue;
    }

    try {
      const signature = await deps.submitter.submit(event, prevHash);
      const slot = await resolveSlotSafely(deps, signature);
      await deps.store.markAnchored(entry.id, {
        signature,
        slot: slot ?? 0n,
        headHash: toHex(chainHead(prevHash, event)),
      });
      return { status: "anchored", signature, kind: null, error: null };
    } catch (error) {
      lastKind = error instanceof ChainSubmitError ? error.kind : classifySubmitError(error);
      lastError = messageOf(error);

      // Auth errors fail fast. The program will reject this signer forever, so
      // retrying only burns rate limit and delays the terminal state.
      if (lastKind === "terminal") {
        await deps.store.markFailed(entry.id, baseAttempt + attempt, lastError);
        return { status: "failed", signature: null, kind: lastKind, error: lastError };
      }

      await deps.store.markRetry(entry.id, baseAttempt + attempt, lastError);

      if (attempt === MAX_ATTEMPTS - 1) {
        break;
      }
      await sleep(backoffMs(attempt));
    }
  }

  const exhausted = lastKind === "chain-broken" ? "contention" : (lastError ?? "max attempts");
  await deps.store.markFailed(entry.id, baseAttempt + MAX_ATTEMPTS - 1, exhausted);
  return { status: "failed", signature: null, kind: lastKind, error: exhausted };
}

/** How long a `flushing` row may sit before a sweep assumes its worker died. */
export const STALE_CLAIM_MS = 60_000;

/**
 * Drain the pending queue.
 *
 * Sequential on purpose: the chain is a single ordered ledger, so two
 * concurrent submits from the same server just contend with each other and pay
 * for `ChainBroken` retries. Batching would be the throughput answer; it is not
 * the demo answer.
 *
 * The stale-claim sweep runs first, so a process that died mid-flush does not
 * leave its rows stranded in `flushing` forever.
 */
export async function flushPending(deps: FlusherDeps, limit = 20): Promise<FlushResult[]> {
  await deps.store.recoverStaleClaims(new Date(Date.now() - STALE_CLAIM_MS));

  const pending = await deps.store.pending(limit);
  const results: FlushResult[] = [];

  for (const entry of pending) {
    results.push(await flushEntry(entry, deps));
  }

  return results;
}

/**
 * A submitter that never talks to a cluster.
 *
 * Used by tests and by any developer running the app before the program is
 * deployed, so the outbox path can be exercised end to end offline.
 */
export function createMockSubmitter(
  options: {
    startHead?: Uint8Array;
    /** Fail the first N submits with ChainBroken, simulating contention. */
    chainBrokenCount?: number;
    failWith?: () => unknown;
  } = {},
): ChainSubmitter & { head: Uint8Array } {
  let head: Uint8Array = Uint8Array.from(options.startHead ?? ZERO_HASH);
  let brokenRemaining = options.chainBrokenCount ?? 0;

  return {
    get head() {
      return head;
    },
    async fetchHead() {
      return Uint8Array.from(head);
    },
    async submit(event) {
      if (options.failWith) {
        throw options.failWith();
      }
      if (brokenRemaining > 0) {
        brokenRemaining -= 1;
        throw ChainSubmitError.chainBroken();
      }
      head = chainHead(head, event);
      return `mock-signature-${head[0]?.toString(16) ?? "0"}`;
    },
  };
}

async function resolveSlotSafely(deps: FlusherDeps, signature: string): Promise<bigint | null> {
  if (!deps.resolveSlot) {
    return null;
  }
  try {
    return await deps.resolveSlot(signature);
  } catch {
    // The signature is the fact that matters; a missing slot is cosmetic.
    return null;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
