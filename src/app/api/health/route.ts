import { env } from "@/lib/env";
import { ok } from "@/lib/api/http";
import { getPeerHealth } from "@/lib/p2p/peer-health";
import { getChainStatus } from "@/lib/solana/chain";
import { prismaOutboxStore } from "@/lib/outbox/store";
import type { HealthData } from "@/lib/types/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const peer = getPeerHealth();
  const [chain, pendingEvents] = await Promise.all([
    getChainStatus(),
    // A count that cannot fail the health check. An unqueryable database is a
    // different alarm, and reporting `null` says "unknown" instead of lying.
    prismaOutboxStore.countPending().catch(() => null),
  ]);

  const data: HealthData = {
    status: "ok",
    server: env.serverId,
    timestamp: new Date().toISOString(),
    peer: {
      healthy: peer.healthy,
      serverId: peer.serverId,
      lastCheckedAt: peer.lastCheckedAt,
    },
    solana: {
      reachable: chain.reachable,
      cluster: chain.cluster,
      programId: chain.programId,
      programDeployed: chain.programDeployed,
      headHash: chain.headHash,
      currentSlot: chain.currentSlot,
      pendingEvents,
      error: chain.error,
    },
  };
  return ok(data);
}
