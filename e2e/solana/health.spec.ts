import { expect, test } from "@playwright/test";

import { IS_CONFIGURED, PROGRAM_ID, health, skipUnlessDeployed } from "./helpers";

/**
 * Chain reachability and deployment state, end to end against a live cluster.
 *
 * The point is not that these numbers are right — it is that a broken deploy
 * is *visible* before the demo rather than inferred from a missing audit entry
 * halfway through it.
 */

test.describe("solana health", () => {
  test("reports the chain as reachable and the program as deployed", async ({ request }) => {
    skipUnlessDeployed();

    const solana = await health(request);

    expect(solana.reachable, "RPC should answer").toBe(true);
    expect(solana.programId).toBe(PROGRAM_ID);
    expect(solana.programDeployed, "the trail account should exist after initialize()").toBe(true);
    expect(solana.cluster).toBeTruthy();
    expect(solana.error).toBeNull();
  });

  test("reports the head as 32 bytes of hex, never a number", async ({ request }) => {
    skipUnlessDeployed();

    const solana = await health(request);

    expect(solana.headHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("reports the current slot as a decimal string", async ({ request }) => {
    skipUnlessDeployed();

    const solana = await health(request);

    expect(solana.currentSlot).toMatch(/^[0-9]+$/);
    // Slots are far past 2^53 in the general case; the string is the contract.
    expect(typeof solana.currentSlot).toBe("string");
  });

  test("reports a pending count without failing the check", async ({ request }) => {
    const solana = await health(request);

    // Runs unconfigured too: a pending count above zero is in-flight work, not
    // an error, and health must not start failing because the flusher is behind.
    expect(solana.pendingEvents === null || solana.pendingEvents >= 0).toBe(true);
  });

  test("degrades instead of failing when no program is deployed", async ({ request }) => {
    test.skip(IS_CONFIGURED, "only meaningful without a configured program");

    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    const body = (await response.json()) as { data: { solana: { programDeployed: boolean } } };
    expect(body.data.solana.programDeployed).toBe(false);
  });
});
