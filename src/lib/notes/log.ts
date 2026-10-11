import { recordAccessEvent } from "@/lib/outbox/record";
import { env } from "@/lib/env";

/**
 * Write a note access event.
 *
 * A thin, named wrapper over {@link recordAccessEvent} so the note routes read
 * as audit intent rather than as outbox plumbing. The refused paths
 * (`view_denied`, `view_not_found`) go through here too: a denied access is
 * exactly the thing a patient most needs to see recorded.
 */
export async function logNoteAccess(
  userId: number,
  patientId: number,
  recordId: number,
  action: string,
  role: string,
) {
  await recordAccessEvent({
    userId,
    patientId,
    recordId,
    action,
    serverId: env.serverId,
    role,
  });
}
