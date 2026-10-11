/**
 * Verification of the off-chain mirror against chain state.
 *
 * This is the claim the project makes: what you read is what was anchored. The
 * check is a recomputation, not a lookup — the local rows are folded back into
 * a head hash and compared with the chain's, so an edited, dropped, or
 * reordered entry produces a different answer.
 *
 * The limit worth stating plainly: this proves nothing was altered *after* the
 * fact. It does not prove the server logged truthfully at write time. The
 * authorization layer is still trusted.
 */

import { prisma } from "@/lib/prisma";
import { foldHead, hexEq, toHex } from "@/lib/solana/hash";
import { fetchCurrentHead, type ChainVerification } from "@/lib/solana/chain";
import { toChainEvent } from "./store";

/**
 * Fold the local mirror and compare it to the chain head.
 *
 * `terminal` rows are included in the fold. Excluding them would let a row be
 * deleted and the local head still match, which would be exactly the omission
 * the chain exists to catch. Pending rows are included too: an unanchored event
 * that has not been folded into the chain yet is precisely what makes
 * `match: false`, and that is true information rather than a glitch.
 */
export async function verifyLocalOutbox(): Promise<ChainVerification> {
  const rows = await prisma.accessLog.findMany({
    orderBy: { id: "asc" },
    include: { user: { select: { role: true } } },
  });

  const localHead = foldHead(
    rows.map((row) =>
      toChainEvent({
        id: row.id,
        eventId: row.eventId ?? `row-${row.id}`,
        patientId: row.patientId,
        userId: row.userId,
        role: row.user.role,
        action: row.action,
        recordId: row.recordId,
        serverId: row.serverId,
        clientTime: row.clientTime,
        attempt: row.attempt,
      }),
    ),
  );

  const chainHeadBytes = await fetchCurrentHead();

  return {
    localHead: toHex(localHead),
    chainHead: toHex(chainHeadBytes),
    match: hexEq(localHead, chainHeadBytes),
    checkedAt: new Date().toISOString(),
  };
}
