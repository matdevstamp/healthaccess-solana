import { AuthError, requirePermission } from "@/lib/auth";
import { fail, ok } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { verifyLocalOutbox } from "@/lib/outbox/verify";
import type { AccessLogActorMap, AccessLogEvent, ChainVerificationBlock } from "@/lib/types/api";

/**
 * The audit view.
 *
 * Reads Postgres, not process memory. The old in-memory chain meant a restart
 * lost half the audit trail and each server held a different half — which is a
 * property an audit log must not have.
 *
 * There is no peer sync here anymore. Chain replication over P2P duplicated the
 * trail to a second process; the chain is the shared state now, and Postgres is
 * the shared mirror.
 */
export async function GET() {
  try {
    const user = await requirePermission("readAccessLogs");

    const rows = await prisma.accessLog.findMany({
      // A patient may only ever see their own events. Enforced in the query,
      // not by filtering afterwards, so a bug elsewhere cannot leak rows.
      where:
        user.role === "patient" && user.patientId !== null ? { patientId: user.patientId } : {},
      orderBy: { id: "desc" },
      take: 200,
    });

    const accessLogs: AccessLogEvent[] = rows.map((row) => ({
      eventId: row.eventId ?? `row-${row.id}`,
      userId: row.userId,
      patientId: row.patientId,
      recordId: row.recordId,
      action: row.action,
      serverId: row.serverId,
      timestamp: row.clientTime.toISOString(),
      status: row.status as AccessLogEvent["status"],
      signature: row.signature,
      // BigInt in the database, decimal string over JSON. A number here would
      // silently corrupt any slot past 2^53.
      slot: row.slot === null ? null : row.slot.toString(),
      headHash: row.headHash,
    }));

    // The rows carry only ids, so display names are resolved from SQL here, at
    // read time. Nothing personal is stored in the audit payload itself.
    const actorIds = [...new Set(accessLogs.map((log) => log.userId))];
    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, username: true, role: true },
    });

    const actorMap: AccessLogActorMap = Object.fromEntries(
      actors.map((actor) => [String(actor.id), { username: actor.username, role: actor.role }]),
    );

    // Verification is reported, never raised. A patient asking "is my log
    // intact?" deserves an answer even when the answer is bad, and an
    // unreachable RPC should not blank the audit view.
    let verification: ChainVerificationBlock;
    try {
      verification = await verifyLocalOutbox();
    } catch (error) {
      console.warn("Chain verification unavailable; reporting it as unverified.", error);
      verification = {
        localHead: "",
        chainHead: "",
        match: false,
        checkedAt: new Date().toISOString(),
      };
    }

    return ok({ accessLogs, actors: actorMap, verification, viewerUserId: user.id });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.code, error.message, error.code === "UNAUTHENTICATED" ? 401 : 403);
    }

    return fail("ACCESS_LOG_FAILED", "Could not load access logs.", 500);
  }
}
