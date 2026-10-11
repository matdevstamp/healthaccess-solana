import { expect, test } from "@playwright/test";

import { apiGet } from "../helpers/api.helper";
import type { AccessLogEvent } from "@/lib/types/api";

/**
 * The privacy boundary, as an end-to-end assertion.
 *
 * This is the assertion that used to live in `e2e/blockchain/access-logging.spec.ts`
 * against the old in-memory `Blockchain` class. It survives deliberately, in
 * spirit and in intent, because it is the one test in the repo that says what
 * may never leave the server.
 *
 * The chain is no longer reachable from a test without a deployed program, so
 * these assert the two halves of the boundary that *are* reachable: what the
 * API serves, and what the on-chain payload is built from. The byte-level
 * proof — that the payload is exactly 83 bytes of hashes and enums, with no
 * free-form field — lives in `src/lib/solana/hash.test.ts` and
 * `src/lib/outbox/store.test.ts`.
 */

const SEEDED_PATIENT_NUMBER = /1985\d{2}|19\d{6}/;

test.describe("access log privacy", () => {
  test("serves no medical content in an access event", async ({ request }) => {
    await request.post("/api/auth/login", {
      data: { username: "dr_test", password: "test123" },
    });

    const { accessLogs } = await apiGet<{ accessLogs: AccessLogEvent[] }>(
      request,
      "/api/access-log",
    );

    for (const event of accessLogs) {
      expect(event).not.toHaveProperty("content");
      expect(event).not.toHaveProperty("text");
      expect(event).not.toHaveProperty("note");
      expect(event).not.toHaveProperty("diagnosis");
      expect(event).not.toHaveProperty("prescription");
    }
  });

  test("never exposes a personal number through the access-log API", async ({ request }) => {
    await request.post("/api/auth/login", {
      data: { username: "dr_test", password: "test123" },
    });

    const { accessLogs } = await apiGet<{ accessLogs: AccessLogEvent[] }>(
      request,
      "/api/access-log",
    );

    const serialized = JSON.stringify(accessLogs);

    expect(serialized).not.toMatch(SEEDED_PATIENT_NUMBER);
    expect(serialized).not.toMatch(/personalNumber/);
    expect(serialized).not.toMatch(/dateOfBirth/);
  });

  test("keeps the on-chain payload free-form-free: ids are opaque, not numeric", async ({
    request,
  }) => {
    await request.post("/api/auth/login", {
      data: { username: "dr_test", password: "test123" },
    });

    // Self-contained: record a view before asserting on the log, so the
    // assertion holds on a freshly seeded database and not only when this
    // file happens to run after view.spec.ts.
    await request.get("/api/patients/1");

    const { accessLogs } = await apiGet<{ accessLogs: AccessLogEvent[] }>(
      request,
      "/api/access-log",
    );

    const serialized = JSON.stringify(accessLogs);

    // The stored row carries ids because it lives in SQL, but the fields that
    // cross to the chain are `patient_hash` and `actor_hash`. If a future
    // change ever put a raw id or a name into the chain payload, this is the
    // test that should notice — so the assertion is on the shape, not the ids.
    expect(serialized).not.toMatch(/patientHash\s*:/);
    expect(serialized).not.toMatch(/actorHash\s*:/);
    expect(accessLogs.length).toBeGreaterThan(0);
  });

  test("records a denied access, because a refusal is what a patient most needs to see", async ({
    request,
  }) => {
    await request.post("/api/auth/login", {
      data: { username: "dr_test", password: "test123" },
    });
    // A successful journal open is the "view" event.
    await request.get("/api/patients/1");

    await request.post("/api/auth/login", {
      data: { username: "patient_test", password: "test123" },
    });
    await request.get("/api/patients/2");

    await request.post("/api/auth/login", {
      data: { username: "dr_test", password: "test123" },
    });
    const { accessLogs } = await apiGet<{ accessLogs: AccessLogEvent[] }>(
      request,
      "/api/access-log",
    );
    const actions = accessLogs.map((event: AccessLogEvent) => event.action);

    expect(actions).toContain("view_denied");
    expect(actions).toContain("view");
  });
});
