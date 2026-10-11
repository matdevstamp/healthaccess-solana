import { AuthError, requirePermission } from "@/lib/auth";
import { fail, ok } from "@/lib/api/http";
import { getAccessLogBlockchain } from "@/lib/blockchain/access-log-service";
import { syncServerPeer } from "@/app/api/p2p/server-peer";
import { prisma } from "@/lib/prisma";
import { verifyLocalOutbox } from "@/lib/outbox/verify";
import type { AccessLogActorMap, ChainVerificationBlock } from "@/lib/types/api";

export async function GET() {
  try {
    const user = await requirePermission("readAccessLogs");
    try {
      await syncServerPeer();
    } catch (error) {
      console.warn("Peer recovery unavailable; using local access logs.", error);
    }

    const blockchain = getAccessLogBlockchain();
    const allAccessLogs = blockchain.chain.map((block) => block.data);

    const accessLogs =
      user.role === "patient"
        ? allAccessLogs.filter((log) => log.patientId === user.patientId)
        : allAccessLogs;

    // The chain stores only a userId (it must not carry personal data), so the
    // display name is resolved from SQL here, at read time.
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
      console.warn("Chain verification unavailable; reporting it as unknown.", error);
      verification = {
        localHead: "",
        chainHead: "",
        match: false,
        checkedAt: new Date().toISOString(),
      };
    }

    return ok({
      accessLogs,
      actors: actorMap,
      chainValid: blockchain.isValid(),
      verification,
      viewerUserId: user.id,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.code, error.message, error.code === "UNAUTHENTICATED" ? 401 : 403);
    }

    return fail("ACCESS_LOG_FAILED", "Could not load access logs.", 500);
  }
}
