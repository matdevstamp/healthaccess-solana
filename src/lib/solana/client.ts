/**
 * The one Solana `Connection` in the app.
 *
 * Routes never construct a `Connection`. Everything goes through
 * `getConnection()`, which memoizes a single instance built from `env` so that
 * a request path does not pay for a new HTTP agent and a new WebSocket per
 * call. The instance is lazy: importing this module must never open a socket,
 * because the off-chain audit view has to work on a machine that has never
 * been given devnet credentials.
 */

import { Connection } from "@solana/web3.js";

import { env } from "@/lib/env";

let cached: Connection | null = null;

/** Memoized connection, built from env on first use. */
export function getConnection(): Connection {
  cached ??= new Connection(env.solanaRpcUrl, {
    commitment: env.solanaCommitment,
    // The flusher is the only writer, and it polls on a timer rather than
    // waiting on confirmations. A 30s websocket would just be a leak.
    wsEndpoint: env.solanaRpcUrl.replace(/^http/, "ws"),
  });
  return cached;
}

/** Drop the memoized connection. Tests and dev restarts use this. */
export function resetConnection(): void {
  cached = null;
}

/** Substitute a connection, so a test can inject a mock without a socket. */
export function setConnection(connection: Connection): void {
  cached = connection;
}

/**
 * Cheap liveness probe for `/api/health`.
 *
 * Never throws. Health has to report "unreachable" as a value; a health route
 * that 500s when devnet is down tells an operator nothing.
 */
export async function probeConnection(): Promise<{ reachable: boolean; slot: bigint | null }> {
  try {
    const slot = await getConnection().getSlot({ commitment: env.solanaCommitment });
    // Slots exceed Number.MAX_SAFE_INTEGER on mainnet within a few years, and
    // the whole point of the bigint discipline is not to be the exception.
    return { reachable: true, slot: BigInt(slot) };
  } catch {
    return { reachable: false, slot: null };
  }
}

/** Whether the audit trail has been created yet. */
export async function isTrailInitialized(): Promise<boolean> {
  const { readTrail } = await import("./chain");
  return (await readTrail()) !== null;
}

/**
 * Create the audit trail. Idempotent in effect, not in call: Anchor's `init`
 * constraint rejects a second call with `AccountAlreadyInitialized`, which is a
 * terminal error by design — re-initializing would discard the head hash.
 */
export async function initializeTrail(): Promise<string> {
  const { Transaction } = await import("@solana/web3.js");
  const { loadKeypair } = await import("./submitter");
  const { initializeInstruction } = await import("./program");

  const authority = loadKeypair();
  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  const transaction = new Transaction({
    feePayer: authority.publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(initializeInstruction({ payer: authority.publicKey }));

  return connection.sendTransaction(transaction, [authority]);
}
