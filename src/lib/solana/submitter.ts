/**
 * The real {@link ChainSubmitter}: Anchor-backed, over RPC.
 *
 * This is the only file in the app that signs a transaction. Everything else —
 * the flusher, the routes, the tests — depends on the interface in
 * `@/lib/outbox/submitter`, which is why the state machine can be tested with
 * no Solana connection at all.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";

import { Keypair, Transaction, type PublicKey } from "@solana/web3.js";

import { getConnection } from "./client";
import { fetchCurrentHead } from "./chain";
import { env } from "@/lib/env";
import { recordAccessInstruction } from "./program";
import type { OnChainAccessEvent } from "./types";
import {
  ChainSubmitError,
  classifySubmitError,
  type ChainSubmitter,
  type Hash32,
} from "@/lib/outbox/submitter";

let cachedKeypair: Keypair | null = null;

/** Expand a leading `~`. `SOLANA_KEYPAIR_PATH` is documented with one. */
export function expandHome(path: string): string {
  return path.startsWith("~/") ? `${homedir()}/${path.slice(2)}` : path;
}

/**
 * Load the signing keypair, memoized.
 *
 * The file lives outside both repos, so there is exactly one of it and neither
 * clone can commit it. A missing keypair is terminal, not transient: no amount
 * of retrying conjures the file.
 */
export function loadKeypair(): Keypair {
  if (cachedKeypair) {
    return cachedKeypair;
  }

  const path = expandHome(env.solanaKeypairPath);
  if (!existsSync(path)) {
    throw ChainSubmitError.terminal(
      `Keypair not found at ${path}. Set SOLANA_KEYPAIR_PATH to the signing keypair.`,
    );
  }

  try {
    const secret = JSON.parse(readFileSync(path, "utf8")) as number[];
    cachedKeypair = Keypair.fromSecretKey(Uint8Array.from(secret));
  } catch (error) {
    throw ChainSubmitError.terminal(`Could not read keypair at ${path}`, { cause: error });
  }

  return cachedKeypair;
}

/** Drop the memoized keypair. Tests use this. */
export function resetKeypair(): void {
  cachedKeypair = null;
}

/**
 * The submitter handed to the flusher.
 *
 * Errors are classified on the way out rather than inside the flusher, so the
 * flusher's retry logic never has to know how Anchor renders a custom error in
 * the version currently installed.
 */
export const solanaSubmitter: ChainSubmitter = {
  async fetchHead(): Promise<Hash32> {
    return fetchCurrentHead();
  },

  async submit(event: OnChainAccessEvent, prevHash: Hash32): Promise<string> {
    const authority = loadKeypair();

    try {
      const connection = getConnection();
      const instruction = recordAccessInstruction({
        event,
        prevHash,
        authority: authority.publicKey as PublicKey,
      });

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

      const transaction = new Transaction({
        feePayer: authority.publicKey,
        blockhash,
        lastValidBlockHeight,
      }).add(instruction);

      return await connection.sendTransaction(transaction, [authority]);
    } catch (error) {
      throw wrap(error);
    }
  },
};

/**
 * Re-throw as a classified {@link ChainSubmitError}.
 *
 * `Unauthorized` fails fast and is not retried: the program will reject this
 * signer forever, so retrying only delays the terminal state and burns rate
 * limit. `ChainBroken` is the opposite — it means a competitor advanced the
 * chain, and a retry that re-reads the head will win.
 */
export function wrap(error: unknown): ChainSubmitError {
  if (error instanceof ChainSubmitError) {
    return error;
  }
  const kind = classifySubmitError(error);
  const message = error instanceof Error ? error.message : String(error);
  return new ChainSubmitError(kind, message, { cause: error });
}
