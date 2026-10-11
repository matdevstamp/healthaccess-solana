import { expect, test } from "@playwright/test";

import { skipUnlessDeployed } from "./helpers";

/**
 * Anchoring, end to end: an access event written by a normal request must end
 * up on chain with a signature and a slot.
 *
 * This is the whole pipeline in one test — record, outbox, sweep, re-read,
 * submit, verify — and it is the only place the pieces are exercised together.
 * Everything else is unit-tested against a mock, which is what makes this one
 * worth the devnet quota.
 */

test.describe("anchoring", () => {
  test.beforeEach(async ({ request }) => {
    skipUnlessDeployed();
    await request.post("/api/auth/login", {
      data: { username: "dr_test", password: "test123" },
    });
  });

  test("anchors an access event with a signature and a slot", async ({ request }) => {
    await request.get("/api/patients/1");

    const { prisma } = await import("@/lib/prisma");

    await expect
      .poll(
        async () => {
          const row = await prisma.accessLog.findFirst({
            where: { status: "anchored" },
            orderBy: { id: "desc" },
            select: { signature: true, slot: true, headHash: true },
          });
          return row?.signature ?? null;
        },
        { timeout: 60_000, intervals: [2_000] },
      )
      .not.toBeNull();

    const row = await prisma.accessLog.findFirst({
      where: { status: "anchored" },
      orderBy: { id: "desc" },
      select: { signature: true, slot: true, headHash: true },
    });

    // A base58 signature, and a slot that crossed the DB as a BigInt.
    expect(row?.signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]{80,90}$/);
    expect(row?.slot).not.toBeNull();
    expect(row?.headHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("serves an anchored slot as a decimal string over JSON", async ({ request }) => {
    const body = (await (await request.get("/api/access-log")).json()) as {
      data: { accessLogs: { slot: string | null; signature: string | null }[] };
    };

    for (const event of body.data.accessLogs) {
      if (event.slot !== null) {
        expect(typeof event.slot, "a bigint slot must not become a JSON number").toBe("string");
        expect(event.slot).toMatch(/^[0-9]+$/);
      }
    }
  });

  test("shows pending, not failed, while an event is still queued", async ({ request }) => {
    const { prisma } = await import("@/lib/prisma");

    await prisma.accessLog.create({
      data: {
        eventId: `e2e-pending-${Date.now()}`,
        patientId: 1,
        userId: 1,
        recordId: null,
        action: "view",
        serverId: "hospital-s",
        status: "pending",
        actorRole: "doctor",
      },
    });

    const body = (await (await request.get("/api/access-log")).json()) as {
      data: { accessLogs: { eventId: string; status: string; signature: string | null }[] };
    };
    const queued = body.data.accessLogs.find((event) => event.eventId.startsWith("e2e-pending-"));

    // A queued row is not a record. Reporting it as pending rather than failed
    // is what keeps a demo from looking broken while the flusher is in flight.
    expect(queued?.status).toBe("pending");
    expect(queued?.signature).toBeNull();
  });

  test("carries no medical content in the on-chain payload", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { toChainEvent } = await import("@/lib/outbox/store");

    const row = await prisma.accessLog.findFirst({
      where: { status: "anchored" },
      orderBy: { id: "desc" },
    });
    if (!row) {
      test.skip(true, "nothing anchored yet");
      return;
    }

    const event = toChainEvent({
      id: row.id,
      eventId: row.eventId ?? "",
      patientId: row.patientId,
      userId: row.userId,
      role: row.actorRole,
      action: row.action,
      recordId: row.recordId,
      serverId: row.serverId,
      clientTime: row.clientTime,
      attempt: row.attempt,
    });

    const serialized = JSON.stringify({
      patientHash: Array.from(event.patientHash),
      actorHash: Array.from(event.actorHash),
      action: event.action,
      role: event.role,
      recordId: event.recordId.toString(),
      server: event.server,
      timestamp: event.timestamp.toString(),
    });

    // Fixed-size, hashes and enums only. No name, no personal number, no note
    // body, no date of birth — the payload has no field that could carry one.
    expect(serialized).not.toMatch(/dr_test|patient_test|Andersson/);
    expect(serialized).not.toMatch(/19\d{10}/);
    expect(Object.keys(event).sort()).toEqual([
      "action",
      "actorHash",
      "patientHash",
      "recordId",
      "role",
      "server",
      "timestamp",
    ]);
  });

  test("leaves the request path off the critical path", async ({ request }) => {
    // The event write must not wait on a cluster round trip. A generous bound
    // still catches an accidental await; it is not a latency benchmark.
    const started = Date.now();
    await request.get("/api/patients/1");
    const elapsed = Date.now() - started;

    expect(elapsed, "a journal read must not wait on Solana").toBeLessThan(5_000);
  });
});
