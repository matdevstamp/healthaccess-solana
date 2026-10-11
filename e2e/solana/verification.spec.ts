import { expect, test } from "@playwright/test";

import { IS_CONFIGURED, skipUnlessDeployed } from "./helpers";

/**
 * The tamper signal, end to end.
 *
 * This is the claim the project makes: what a patient reads is what was
 * anchored. A dropped, reordered, or edited local entry has to produce
 * `match: false` — and, critically, must not fail the request. A patient
 * asking "is my log intact?" deserves an answer even when the answer is bad.
 *
 * The local mirror is altered directly in the database. There is no API for
 * tampering with an audit log, which is the point; the check has to be able to
 * detect one anyway.
 */

test.describe("chain verification", () => {
  test.beforeEach(async ({ request }) => {
    skipUnlessDeployed();
    // Generate an event to anchor, so the local mirror is not trivially empty.
    await request.post("/api/auth/login", {
      data: { username: "dr_test", password: "test123" },
    });
    await request.get("/api/patients/1");
  });

  test("reports a verification block with both heads", async ({ request }) => {
    await request.post("/api/auth/login", {
      data: { username: "dr_test", password: "test123" },
    });

    const response = await request.get("/api/access-log");
    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      data: {
        verification: { localHead: string; chainHead: string; match: boolean; checkedAt: string };
      };
    };
    const { verification } = body.data;

    expect(verification.localHead).toMatch(/^[0-9a-f]{64}$/);
    expect(verification.chainHead).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof verification.match).toBe("boolean");
    expect(Date.parse(verification.checkedAt)).not.toBeNaN();
  });

  test("matches once the flusher has drained the queue", async ({ request }) => {
    test.skip(!IS_CONFIGURED, "needs a deployment");

    // The sweep runs every 10s; the write-triggered flush is immediate. Poll
    // rather than sleep a fixed amount so a slow devnet does not fail the spec.
    await expect
      .poll(
        async () => {
          const body = await verificationOf(request);
          return body.match;
        },
        { timeout: 60_000, intervals: [2_000] },
      )
      .toBe(true);
  });

  test("detects a dropped entry in the local mirror", async ({ request }) => {
    const before = await verificationOf(request);
    expect(before.match).toBe(true);

    // Deleting the newest anchored row is the cheapest way to make the mirror
    // disagree with a head the chain has already committed to.
    const { prisma } = await import("@/lib/prisma");
    const newest = await prisma.accessLog.findFirst({
      where: { status: "anchored" },
      orderBy: { id: "desc" },
      select: { id: true },
    });
    if (!newest) {
      test.skip(true, "no anchored row to remove yet");
      return;
    }
    await prisma.accessLog.delete({ where: { id: newest.id } });

    const after = await verificationOf(request);
    expect(after.match, "a dropped entry must break verification").toBe(false);
    expect(after.localHead).not.toBe(after.chainHead);
  });

  test("detects an edited entry in the local mirror", async ({ request }) => {
    const before = await verificationOf(request);
    expect(before.match).toBe(true);

    const { prisma } = await import("@/lib/prisma");
    const target = await prisma.accessLog.findFirst({
      where: { status: "anchored" },
      orderBy: { id: "asc" },
      select: { id: true, action: true },
    });
    if (!target) {
      test.skip(true, "no anchored row to edit yet");
      return;
    }
    await prisma.accessLog.update({
      where: { id: target.id },
      data: { action: target.action === "view" ? "delete" : "view" },
    });

    const after = await verificationOf(request);
    expect(after.match, "an edited entry must break verification").toBe(false);
  });
});

async function verificationOf(request: import("@playwright/test").APIRequestContext) {
  const response = await request.get("/api/access-log");
  expect(response.status()).toBe(200);

  const body = (await response.json()) as {
    data: { verification: { localHead: string; chainHead: string; match: boolean } };
  };
  return body.data.verification;
}
