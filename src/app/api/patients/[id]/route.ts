import { AuthError, requirePermission } from "@/lib/auth";
import { canAccessPatient } from "@/lib/auth/permissions";
import { fail, ok } from "@/lib/api/http";
import { env } from "@/lib/env";
import { recordAccessEvent } from "@/lib/outbox/record";
import { getDatabasePatientJournal } from "@/lib/patients/journal";
import type { PatientJournalResponse } from "@/lib/types/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requirePermission("readPatient");
    const { id } = await context.params;
    const patientId = Number(id);

    if (!Number.isSafeInteger(patientId) || patientId <= 0) {
      return fail("BAD_PATIENT_ID", "Patient id must be a number.", 400);
    }

    if (!canAccessPatient(user, patientId)) {
      // Logged before returning, not after: a refused access is an audit
      // event, not an error, and it is the one a patient most needs to see.
      await recordAccessEvent({
        userId: user.id,
        patientId,
        recordId: null,
        action: "view_denied",
        serverId: env.serverId,
      });

      return fail("UNAUTHORIZED", "Patients can only open their own journal.", 403);
    }

    const journal = await getDatabasePatientJournal(patientId, user);
    if (!journal) {
      await recordAccessEvent({
        userId: user.id,
        patientId,
        recordId: null,
        action: "view_not_found",
        serverId: env.serverId,
      });

      return fail("PATIENT_NOT_FOUND", "Patient could not be found.", 404);
    }

    await recordAccessEvent({
      userId: user.id,
      patientId,
      recordId: null,
      action: "view",
      serverId: env.serverId,
    });

    return ok(journal satisfies PatientJournalResponse);
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.code, error.message, error.code === "UNAUTHENTICATED" ? 401 : 403);
    }
    return fail("PATIENT_JOURNAL_FAILED", "Could not load patient journal.", 500);
  }
}
