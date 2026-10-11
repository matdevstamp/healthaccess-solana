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

import { env } from "@/lib/env";
import { prismaOutboxStore, type EnqueueInput } from "./store";
import type { AccessLogEvent } from "@/lib/types/api";

/**
 * Record one access event. This is the only write path for the audit trail.
 *
 * It used to be three: an in-memory chain, a Postgres row, and a P2P push to
 * the peer. Three sources meant three places for a refused access to fail to
 * land, which is the opposite of what an audit trail is for. There is one now.
 *
 * Ordering is deliberate:
 *
 * 1. The outbox row is written and awaited, so the event is durable in
 *    Postgres before anything else happens. A process that dies after this
 *    line still leaves an audit entry behind.
 * 2. The realtime push and the chain flush are scheduled, never awaited. A
 *    patient reading their record must not wait on a socket or a cluster.
 *
 * A failed durable write propagates. Failing closed on the audit trail is the
 * deliberate choice: a silently dropped audit entry is the failure mode this
 * whole design exists to prevent.
 */
export async function recordAccessEvent(input: {
  userId: number;
  patientId: number;
  recordId: number | null;
  action: string;
  serverId: string;
  /** Acting role. Snapshotted onto the outbox row at enqueue time. */
  role: string;
}): Promise<AccessLogEvent> {
  const event: AccessLogEvent = {
    eventId: crypto.randomUUID(),
    userId: input.userId,
    patientId: input.patientId,
    recordId: input.recordId,
    action: input.action,
    serverId: input.serverId,
    timestamp: new Date().toISOString(),
    status: "pending",
    signature: null,
    slot: null,
    headHash: null,
  };

  await enqueueAccessEvent({
    eventId: event.eventId,
    userId: event.userId,
    patientId: event.patientId,
    recordId: event.recordId,
    action: event.action,
    serverId: event.serverId,
    role: input.role,
    clientTime: new Date(event.timestamp),
  });

  // Both of these are fire and forget. Neither can fail the request.
  void broadcastSafely(event);
  scheduleFlush();

  return event;
}

/** Persist an access event as `pending`. Returns the row id. */
export async function enqueueAccessEvent(input: EnqueueInput): Promise<number> {
  const row = await prismaOutboxStore.enqueue(input);
  return row.id;
}

async function broadcastSafely(event: AccessLogEvent): Promise<void> {
  // Imported lazily so a module-graph cycle between the outbox and the socket
  // layer cannot bite, and so a test that only exercises the outbox never
  // touches the socket server.
  const { broadcastAccessLogCreated } = await import("@/lib/realtime/broadcast");

  try {
    await broadcastAccessLogCreated(event);
  } catch (error) {
    console.warn("Real-time access-log broadcast failed.", error);
  }
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
  // Nothing to anchor to yet. This check has to happen *before* the submitter
  // is constructed: a missing SOLANA_PROGRAM_ID surfaces as a thrown error on
  // every attempt, and the flusher would burn each event through its full
  // retry budget and park it as `failed` — permanently — for a deployment
  // that has simply not happened yet. Queued is the correct state, and it is
  // what the sweep drains once the program id appears.
  if (env.solanaProgramId.trim().length === 0) {
    return;
  }

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
