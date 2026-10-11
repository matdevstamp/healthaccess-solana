/**
 * The request path: write the event durably, then get out of the way.
 *
 * Two rules live here.
 *
 * 1. The row is written to Postgres **before** the function returns, and
 *    nothing on this path touches the network. Awaiting `sendTransaction()`
 *    here would make every patient record read wait on a cluster round trip,
 *    and a slow drop would become a missing audit entry.
 * 2. The Solana SDK is not even *loaded* on the request path. The flusher is
 *    behind a dynamic import, so a read costs one Postgres insert and no
 *    Web3 bundle.
 */

import { prismaOutboxStore, type EnqueueInput } from "./store";

/** Persist an access event as `pending`. Returns the row id. */
export async function enqueueAccessEvent(input: EnqueueInput): Promise<number> {
  const row = await prismaOutboxStore.enqueue(input);
  return row.id;
}

let draining: Promise<unknown> | null = null;

/**
 * Kick a background drain. Fire and forget by construction.
 *
 * Never awaited and never rejected: a flusher failure must not surface in the
 * request that produced the event. Overlapping calls share one drain, so a
 * burst of writes does not start a burst of flayers.
 */
export function scheduleFlush(): void {
  if (draining) {
    return;
  }

  draining = runFlush().finally(() => {
    draining = null;
  });

  void draining.catch(() => {
    // Already recorded on the outbox rows; nothing to add here.
  });
}

/** Whether a drain is currently in flight. Exposed for tests. */
export function isDraining(): boolean {
  return draining !== null;
}

async function runFlush(): Promise<void> {
  // Imported here, not at the top: the request path must not pay for the SDK.
  const [{ flushPending }, { solanaSubmitter }, { getConnection }] = await Promise.all([
    import("./flusher"),
    import("@/lib/solana/submitter"),
    import("@/lib/solana/client"),
  ]);

  await flushPending({
    submitter: solanaSubmitter,
    store: prismaOutboxStore,
    resolveSlot: async (signature) => {
      const slot = await getConnection().getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      return slot === null ? null : BigInt(slot.slot);
    },
  });
}

/** Test seam: reset the drain guard between cases. */
export function resetDrain(): void {
  draining = null;
}
