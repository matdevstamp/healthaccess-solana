import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit + integration tests for the server-side policy layer (task 19).
 *
 * Playwright owns the full-stack journey tests in `e2e/`; this suite covers
 * the pure logic and the route handlers with Prisma and `fetch` mocked, so a
 * contributor gets a sub-second signal without booting Postgres or two Next
 * servers.
 *
 * Run: `npm run test:unit` (coverage: `npm run test:unit:coverage`)
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/lib/**/*.ts", "src/app/api/**/route.ts"],
      exclude: [
        // Instantiated at import time against a live socket/DB; covered by e2e.
        "src/lib/prisma.ts",
        "src/lib/realtime/socket-server.ts",
        // Interface-only modules: no runtime code to cover.
        "src/lib/p2p/message.ts",
        // Test files and test-only factories.
        "**/*.test.ts",
        "src/test-utils/**",
      ],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
