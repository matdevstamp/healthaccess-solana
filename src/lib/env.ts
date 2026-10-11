/**
 * Typed access to environment variables. Validated once at first read so
 * a missing variable fails fast instead of at request time.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port value: ${value}`);
  }
  return port;
}

function parsePositiveInt(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name} value: ${value}`);
  }
  return parsed;
}

const serverId = optionalEnv("SERVER_ID", "hospital-s");

const COMMITMENTS = ["processed", "confirmed", "finalized"] as const;

/** Solana commitment levels. Anything else is a typo, not a fallback. */
function parseCommitment(value: string): (typeof COMMITMENTS)[number] {
  if (!COMMITMENTS.includes(value as (typeof COMMITMENTS)[number])) {
    throw new Error(`Invalid SOLANA_COMMITMENT value: ${value}`);
  }
  return value as (typeof COMMITMENTS)[number];
}

/**
 * The salt that pseudonymises patient and user ids before they reach the chain.
 *
 * Read lazily for the same reason `jwtSecret` is: `ACCESS_HASH_SALT` must never
 * be committed, so a developer who has not generated one yet should still be
 * able to boot for unrelated work and only fail if they hash an id.
 */
function parseAccessHashSalt(): Uint8Array {
  const value = requireEnv("ACCESS_HASH_SALT");
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(
      "ACCESS_HASH_SALT must be 32 bytes of hex (64 characters). Generate with: openssl rand -hex 32",
    );
  }
  return new Uint8Array(Buffer.from(value, "hex"));
}

/** Which demo instance the configured peer is. Derived unless PEER_URL is set. */
const DEFAULT_PEER_URL: Record<string, string> = {
  "hospital-s": "http://localhost:3002",
  "ambulance-a": "http://localhost:3001",
};

export const env = {
  /** Which of the two demo instances this server is (hospital-s | ambulance-a). */
  serverId,

  port: parsePort(optionalEnv("PORT", "3001")),

  databaseUrl: optionalEnv(
    "DATABASE_URL",
    "postgresql://healthaccess:healthaccess@localhost:5432/healthaccess",
  ),

  /** Set lazily so server startup never fails when auth is unused. */
  get jwtSecret(): string {
    return requireEnv("JWT_SECRET");
  },

  jwtExpiresIn: optionalEnv("JWT_EXPIRES_IN", "24h"),

  peerUrl: optionalEnv("PEER_URL", DEFAULT_PEER_URL[serverId] ?? "http://localhost:3002"),

  /** How often the peer heartbeat pings the other server (ms). */
  peerHeartbeatMs: parsePositiveInt(optionalEnv("PEER_HEARTBEAT_MS", "10000"), "PEER_HEARTBEAT_MS"),

  /** Solana cluster name, for display and for health reporting. */
  solanaCluster: optionalEnv("SOLANA_CLUSTER", "devnet"),

  /** Where the client sends transactions and reads the audit trail. */
  solanaRpcUrl: optionalEnv("SOLANA_RPC_URL", "https://api.devnet.solana.com"),

  /**
   * The deployed audit program. Empty until task 28 lands a deployment, which
   * is why it is *not* validated with `requireEnv` and read lazily: the app
   * must boot and serve reads on a machine that has never touched devnet.
   */
  get solanaProgramId(): string {
    return optionalEnv("SOLANA_PROGRAM_ID", "");
  },

  /** Path to the signing keypair. Outside the repo, never committed. */
  solanaKeypairPath: optionalEnv("SOLANA_KEYPAIR_PATH", "~/.config/solana/devnet.json"),

  /** `confirmed` is enough for a demo; `finalized` only adds latency. */
  solanaCommitment: parseCommitment(optionalEnv("SOLANA_COMMITMENT", "confirmed")),

  /**
   * 32 bytes that pseudonymise every patient and user id before it is hashed
   * into an on-chain event. Lazy, so a missing salt fails at the point of use
   * rather than at import time.
   */
  get accessHashSalt(): Uint8Array {
    return parseAccessHashSalt();
  },
};
