import { defineConfig } from "@playwright/test";

/**
 * The Solana suite, kept out of the main Playwright run.
 *
 * `npm run test:e2e` must stay green on a machine that has never been given
 * devnet credentials, so the chain specs live here behind their own config and
 * are launched explicitly (`npx playwright test --config
 * playwright.blockchain.config.ts`). Every spec in here also skips itself when
 * `SOLANA_PROGRAM_ID` is unset, so running this config by accident is a no-op
 * rather than a wall of failures.
 *
 * Deliberately *not* booted through the two-instance webServer the main config
 * uses. These specs talk to one server's API directly; starting a second app
 * would only add flakiness and cost, and the two-node story is already covered
 * by `e2e/p2p/` and `e2e/notes/visibility.spec.ts`.
 */
export default defineConfig({
  testDir: "./e2e/solana",
  reporter: [["list"]],
  // Devnet is a shared, rate-limited resource. Serial on purpose: parallel
  // specs would contend for the same public RPC and each would look flaky.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: process.env.SOLANA_BASE_URL ?? "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
});
