/**
 * Reading chain state.
 *
 * `fetchCurrentHead()` is what the flusher calls before every attempt, and
 * `verifyAgainstChain()` is what `/api/access-log` shows a patient: whether the
 * off-chain mirror still agrees with what the chain says.
 *
 * The honest limit, worth stating in the pitch: agreement proves nothing was
 * *retroactively altered*. It does not prove the server logged truthfully at
 * write time. On-chain commitment is about immutability, not honesty.
 */

import { PublicKey } from "@solana/web3.js";

import { env } from "@/lib/env";
import { getConnection, probeConnection } from "./client";
import { ZERO_HASH, foldHead, hexEq, toHex } from "./hash";
import {
  decodeTrail,
  initialHead,
  isProgramConfigured,
  programId,
  trailAddress,
  type TrailState,
} from "./program";
import type { OnChainAccessEvent } from "./types";

/** Result of comparing the local mirror against chain state. */
export interface ChainVerification {
  localHead: string;
  chainHead: string;
  match: boolean;
  checkedAt: string;
}

/** What `/api/health` reports about the chain. Never throws. */
export interface ChainStatus {
  reachable: boolean;
  cluster: string;
  programId: string | null;
  programDeployed: boolean;
  headHash: string | null;
  currentSlot: string | null;
  error: string | null;
}

/**
 * Read the current chain head.
 *
 * Returns the zero hash when the trail does not exist yet, because "no entries
 * anchored" is a legitimate state, not an error — and treating it as one would
 * make the very first submission look broken.
 *
 * Throws only when the chain genuinely cannot be read, so the flusher's
 * retry classification can act on it.
 */
export async function fetchCurrentHead(): Promise<Uint8Array> {
  const trail = await readTrail();
  return trail?.headHash ?? initialHead();
}

/** The decoded `AuditTrail`, or `null` when the program is absent. */
export async function readTrail(): Promise<TrailState | null> {
  const id = programId();
  if (!id) {
    return null;
  }

  const info = await getConnection().getAccountInfo(trailAddress(id), {
    commitment: env.solanaCommitment,
  });
  if (!info) {
    return null;
  }

  return decodeTrail(new Uint8Array(info.data));
}

/**
 * Compare the off-chain mirror against the chain head.
 *
 * `match: false` is the tamper signal the project claims, so it is reported
 * as a value rather than raised: a patient asking "is my log intact?" deserves
 * an answer even when the answer is bad.
 */
export async function verifyAgainstChain(
  events: readonly OnChainAccessEvent[],
  options: { chainHead?: Uint8Array } = {},
): Promise<ChainVerification> {
  const localHead = foldHead(events);
  const onChain = options.chainHead ?? (await fetchCurrentHead());

  return {
    localHead: toHex(localHead),
    chainHead: toHex(onChain),
    match: hexEq(localHead, onChain),
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Chain health for `/api/health`.
 *
 * `programDeployed: false` is a normal state before task 28 and must not fail
 * the check — the off-chain audit view still works without devnet. A pending
 * count above zero is likewise not an error: it means the flusher is behind.
 */
export async function getChainStatus(): Promise<ChainStatus> {
  const base: ChainStatus = {
    reachable: false,
    cluster: env.solanaCluster,
    programId: env.solanaProgramId.trim() || null,
    programDeployed: false,
    headHash: null,
    currentSlot: null,
    error: null,
  };

  if (!isProgramConfigured()) {
    return { ...base, error: "SOLANA_PROGRAM_ID is not set" };
  }

  const probe = await probeConnection();
  if (!probe.reachable) {
    return { ...base, error: "RPC unreachable" };
  }

  try {
    const trail = await readTrail();
    return {
      ...base,
      reachable: true,
      programDeployed: trail !== null,
      headHash: toHex(trail?.headHash ?? ZERO_HASH),
      currentSlot: probe.slot === null ? null : probe.slot.toString(),
    };
  } catch (error) {
    return { ...base, reachable: true, error: describe(error) };
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Exposed for tests that need a stable address without env plumbing. */
export function trailAddressFor(id: PublicKey): PublicKey {
  return trailAddress(id);
}
