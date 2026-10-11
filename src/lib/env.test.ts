import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * env.ts validates once at first read and throws on a bad value, so these
 * tests re-import the module with `vi.resetModules()` per environment.
 */

const DEFAULTS = {
  PORT: "3001",
  DATABASE_URL: "postgresql://healthaccess:healthaccess@localhost:5432/healthaccess",
  JWT_SECRET: "test-secret",
  JWT_EXPIRES_IN: "24h",
  PEER_URL: "http://localhost:3002",
  PEER_HEARTBEAT_MS: "10000",
};

const original = { ...process.env };

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries({ ...DEFAULTS, ...overrides })) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

/** Import a fresh copy of env.ts with the current process.env. */
async function loadEnv() {
  vi.resetModules();
  return (await import("@/lib/env")).env;
}

beforeEach(() => {
  setEnv({});
  delete process.env.SERVER_ID;
});

afterEach(() => {
  process.env = { ...original };
});

describe("env defaults", () => {
  it("defaults SERVER_ID to hospital-s", async () => {
    expect((await loadEnv()).serverId).toBe("hospital-s");
  });

  it("derives the peer url from the server id", async () => {
    setEnv({ SERVER_ID: "ambulance-a" });
    delete process.env.PEER_URL;

    expect((await loadEnv()).peerUrl).toBe("http://localhost:3001");
  });

  it("prefers an explicit PEER_URL over the derived one", async () => {
    setEnv({ SERVER_ID: "ambulance-a", PEER_URL: "http://example.test" });

    expect((await loadEnv()).peerUrl).toBe("http://example.test");
  });

  it("falls back to hospital-s's peer for an unknown server id", async () => {
    setEnv({ SERVER_ID: "unknown-clinic" });
    delete process.env.PEER_URL;

    expect((await loadEnv()).peerUrl).toBe("http://localhost:3002");
  });

  it("applies the documented defaults", async () => {
    const env = await loadEnv();

    expect(env).toMatchObject({
      port: 3001,
      jwtExpiresIn: "24h",
      peerHeartbeatMs: 10000,
      databaseUrl: DEFAULTS.DATABASE_URL,
    });
  });
});

describe("env validation", () => {
  it("throws when PORT is not a number", async () => {
    setEnv({ PORT: "http" });

    await expect(loadEnv()).rejects.toThrow("Invalid port value: http");
  });

  it.each(["0", "-1", "70000", "3000.5"])("throws for the invalid port %s", async (port) => {
    setEnv({ PORT: port });

    await expect(loadEnv()).rejects.toThrow(/Invalid port value/);
  });

  it("throws when PEER_HEARTBEAT_MS is not a positive integer", async () => {
    setEnv({ PEER_HEARTBEAT_MS: "0" });

    await expect(loadEnv()).rejects.toThrow("Invalid PEER_HEARTBEAT_MS value: 0");
  });

  it("fails fast when JWT_SECRET is missing", async () => {
    setEnv({ JWT_SECRET: undefined });

    const env = await loadEnv();

    expect(() => env.jwtSecret).toThrow("Missing required environment variable: JWT_SECRET");
  });

  it("reads JWT_SECRET lazily so startup survives without it", async () => {
    setEnv({ JWT_SECRET: undefined });

    const env = await loadEnv();

    expect(() => env.databaseUrl).not.toThrow();
  });
});

describe("solana env", () => {
  it("applies devnet defaults", async () => {
    const env = await loadEnv();

    expect(env.solanaRpcUrl).toBe("https://api.devnet.solana.com");
    expect(env.solanaCluster).toBe("devnet");
    expect(env.solanaCommitment).toBe("confirmed");
    expect(env.solanaProgramId).toBe("");
  });

  it("does not require a program id, so the app boots before the deploy", async () => {
    setEnv({ SOLANA_PROGRAM_ID: undefined });

    const env = await loadEnv();

    expect(env.solanaProgramId).toBe("");
  });

  it("reads the program id lazily", async () => {
    const env = await loadEnv();

    process.env.SOLANA_PROGRAM_ID = "4wJqSetGround";

    expect(env.solanaProgramId).toBe("4wJqSetGround");
  });

  it("rejects an unknown commitment rather than silently falling back", async () => {
    setEnv({ SOLANA_COMMITMENT: "eventually" });

    await expect(loadEnv()).rejects.toThrow("Invalid SOLANA_COMMITMENT value: eventually");
  });

  it("defaults the keypair path outside the repo", async () => {
    const env = await loadEnv();

    expect(env.solanaKeypairPath).toBe("~/.config/solana/devnet.json");
  });

  it("fails fast when ACCESS_HASH_SALT is missing", async () => {
    setEnv({ ACCESS_HASH_SALT: undefined });

    const env = await loadEnv();

    expect(() => env.accessHashSalt).toThrow(
      "Missing required environment variable: ACCESS_HASH_SALT",
    );
  });

  it("rejects a salt that is not 32 bytes of hex", async () => {
    setEnv({ ACCESS_HASH_SALT: "tooshort" });

    const env = await loadEnv();

    expect(() => env.accessHashSalt).toThrow(/32 bytes of hex/);
  });

  it("parses a valid salt into 32 bytes", async () => {
    setEnv({ ACCESS_HASH_SALT: "ab".repeat(32) });

    const env = await loadEnv();

    expect(env.accessHashSalt).toHaveLength(32);
    expect(env.accessHashSalt[0]).toBe(0xab);
  });
});
