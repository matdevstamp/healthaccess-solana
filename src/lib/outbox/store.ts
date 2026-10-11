/**
 * The durable outbox: one row per access event, written on the request path and
 * drained by a background flusher.
 *
 * The store is an interface so the flusher can be tested against an in-memory
 * double, and so the flusher never imports Prisma. That is what lets task 26 be
 * built and verified before the program is deployed.
 */

import { prisma } from "@/lib/prisma";
import { serverIndex } from "@/lib/solana/hash";
import { hashActorId, hashPatientId } from "@/lib/solana/hash";
import { NO_RECORD, actionToCode, roleToCode } from "@/lib/solana/types";
import type { OnChainAccessEvent } from "@/lib/solana/types";

/** What the flusher needs from a queued row. */
export interface OutboxEntry {
  id: number;
  eventId: string;
  patientId: number;
  userId: number;
  role: string;
  action: string;
  recordId: number | null;
  serverId: string;
  clientTime: Date;
  /** Attempts already made. A row past the cap is not retried again. */
  attempt: number;
}

export interface EnqueueInput {
  eventId: string;
  patientId: number;
  userId: number;
  /** Acting role, snapshotted onto the row at enqueue time. */
  role: string;
  recordId: number | null;
  action: string;
  serverId: string;
  clientTime?: Date;
}

export interface MarkAnchoredInput {
  signature: string;
  slot: bigint;
  headHash: string;
}

/**
 * Storage seam for the flusher.
 *
 * Every method is deliberately narrow. `claim` is the one that matters: it is a
 * compare-and-swap on `status = 'pending'`, so two servers racing for the same
 * row produce exactly one winner and the loser moves on.
 */
export interface OutboxStore {
  enqueue(input: EnqueueInput): Promise<{ id: number }>;
  pending(limit: number): Promise<OutboxEntry[]>;
  /**
   * Compare-and-swap `pending → flushing`. Returns `null` when another worker
   * already owns the row, which is how two servers avoid flushing the same
   * entry twice.
   */
  claim(id: number): Promise<OutboxEntry | null>;
  markAnchored(id: number, result: MarkAnchoredInput): Promise<void>;
  /** Still retryable: back to `pending` with the failure recorded. */
  markRetry(id: number, attempt: number, error: string): Promise<void>;
  /** Terminal: will not be retried without operator action. */
  markFailed(id: number, attempt: number, error: string): Promise<void>;
  /**
   * Return rows abandoned in `flushing` by a crashed process to `pending`.
   *
   * `flushing` is what makes the claim exclusive, and exclusivity is not
   * crash-safe by itself: a process killed mid-flush would strand its rows
   * forever. Sweeping them back to `pending` is what makes the flusher
   * idempotent across restart rather than merely restart-tolerant.
   */
  recoverStaleClaims(olderThan: Date): Promise<number>;
  countPending(): Promise<number>;
}

/**
 * Convert a queued row into the on-chain event.
 *
 * The raw patient and user ids are hashed *here*, on the way into the payload.
 * Nothing downstream of this function has the un-hashed ids to leak, which is
 * the GDPR boundary enforced in code rather than by convention.
 */
export function toChainEvent(entry: OutboxEntry): OnChainAccessEvent {
  return {
    patientHash: hashPatientId(entry.patientId),
    actorHash: hashActorId(entry.userId),
    action: actionToCode(entry.action),
    role: roleToCode(entry.role),
    recordId: entry.recordId === null ? NO_RECORD : BigInt(entry.recordId),
    server: serverIndex(entry.serverId),
    timestamp: BigInt(Math.trunc(entry.clientTime.getTime() / 1000)),
  };
}

/** Prisma-backed store. The only file in the outbox that talks to the database. */
export const prismaOutboxStore: OutboxStore = {
  async enqueue(input) {
    const row = await prisma.accessLog.create({
      data: {
        eventId: input.eventId,
        patientId: input.patientId,
        userId: input.userId,
        actorRole: input.role,
        recordId: input.recordId,
        action: input.action,
        serverId: input.serverId,
        status: "pending",
        clientTime: input.clientTime ?? new Date(),
      },
      select: { id: true },
    });
    return row;
  },

  async pending(limit) {
    const rows = await prisma.accessLog.findMany({
      where: { status: "pending" },
      orderBy: { id: "asc" },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      eventId: row.eventId ?? `row-${row.id}`,
      patientId: row.patientId,
      userId: row.userId,
      role: row.actorRole,
      action: row.action,
      recordId: row.recordId,
      serverId: row.serverId,
      clientTime: row.clientTime,
      attempt: row.attempt,
    }));
  },

  async claim(id) {
    // Compare-and-swap. Two servers racing produce exactly one winner; the
    // loser's update matches no rows because `flushing` is no longer `pending`.
    const claimed = await prisma.accessLog.updateMany({
      where: { id, status: "pending" },
      data: { status: "flushing", attempt: { increment: 1 }, claimedAt: new Date() },
    });
    if (claimed.count === 0) {
      return null;
    }

    const row = await prisma.accessLog.findUnique({
      where: { id },
    });
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      eventId: row.eventId ?? `row-${row.id}`,
      patientId: row.patientId,
      userId: row.userId,
      role: row.actorRole,
      action: row.action,
      recordId: row.recordId,
      serverId: row.serverId,
      clientTime: row.clientTime,
      attempt: row.attempt,
    };
  },

  async markAnchored(id, result) {
    await prisma.accessLog.update({
      where: { id },
      data: {
        status: "anchored",
        signature: result.signature,
        slot: result.slot,
        headHash: result.headHash,
        error: null,
      },
    });
  },

  async markRetry(id, attempt, error) {
    await prisma.accessLog.update({
      where: { id },
      data: { status: "pending", attempt, error },
    });
  },

  async markFailed(id, attempt, error) {
    await prisma.accessLog.update({
      where: { id },
      data: { status: "failed", attempt, error },
    });
  },

  async recoverStaleClaims(olderThan) {
    const recovered = await prisma.accessLog.updateMany({
      where: { status: "flushing", claimedAt: { lt: olderThan } },
      data: { status: "pending" },
    });
    return recovered.count;
  },

  async countPending() {
    return prisma.accessLog.count({ where: { status: "pending" } });
  },
};
