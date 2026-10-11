import { createAccessLog } from "@/lib/blockchain/access-log-service";
import { env } from "@/lib/env";
import { enqueueAccessEvent, scheduleFlush } from "@/lib/outbox/record";
import { sendAccessLogToPeer } from "@/lib/p2p/transport";

/**
 * Write a note access event.
 *
 * Order matters. The outbox row is written first and awaited, so the event is
 * durable in Postgres before anything else happens — a process that dies after
 * this line still leaves an audit entry behind. Only then does the peer sync
 * happen, and the chain flush is scheduled in the background with no await at
 * all, which is what keeps a record read off the cluster's critical path.
 *
 * A failed durable write propagates. Failing closed on the audit trail is the
 * deliberate choice: a silently dropped audit entry is the failure mode this
 * whole design exists to prevent.
 */
export async function logNoteAccess(
  userId: number,
  patientId: number,
  recordId: number,
  action: string,
) {
  const block = createAccessLog({
    userId,
    patientId,
    recordId,
    action,
    serverId: env.serverId,
  });

  await enqueueAccessEvent({
    eventId: block.data.eventId,
    userId,
    patientId,
    recordId,
    action,
    serverId: env.serverId,
  });

  // Fire and forget. Never awaited, never surfaced to the caller.
  scheduleFlush();

  await sendAccessLogToPeer(block.data);
}
