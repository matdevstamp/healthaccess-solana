import { expect, test, type APIRequestContext } from "@playwright/test";

import type { SolanaHealth } from "@/lib/types/api";

/**
 * Shared setup for the devnet specs.
 *
 * Every spec in this directory runs against a real cluster and costs real RPC
 * quota, so each one skips itself when the deployment is not configured. A skip
 * that says why is useful; a failure that says "SOLANA_PROGRAM_ID is not set"
 * twenty times is not.
 */

export const PROGRAM_ID = process.env.SOLANA_PROGRAM_ID?.trim() ?? "";
export const IS_CONFIGURED = PROGRAM_ID.length > 0;

/** Skip unless a deployment is configured. Returns so specs can call it inline. */
export function skipUnlessDeployed() {
  test.skip(
    !IS_CONFIGURED,
    "SOLANA_PROGRAM_ID is not set — run against a configured cluster with --config playwright.blockchain.config.ts",
  );
}

export async function health(request: APIRequestContext): Promise<SolanaHealth> {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);

  const body = (await response.json()) as { data: { solana?: SolanaHealth } };
  expect(body.data.solana, "health must report a solana block").toBeDefined();
  return body.data.solana as SolanaHealth;
}
