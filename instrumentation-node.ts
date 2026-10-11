import { startPeerHeartbeat } from "@/lib/p2p/peer-health";
import { startOutboxSweep } from "@/lib/outbox/sweep";
import { startSocketServer } from "@/lib/realtime/socket-server";

/**
 * Node-runtime-only bootstrap, loaded from `instrumentation.ts` behind a
 * NEXT_RUNTIME guard. Kept in its own module so bundlers statically analyse
 * `instrumentation.ts` without pulling `node:http` into the Edge bundle.
 */
export function startNodeRuntimeServices(): void {
  startSocketServer();
  startPeerHeartbeat();
  // Writes already schedule a flush; this covers events that failed while the
  // server went idle, which otherwise sit pending until the next write.
  startOutboxSweep();
}
