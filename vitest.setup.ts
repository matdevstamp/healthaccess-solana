/**
 * Test-wide environment. `env.ts` and the P2P layer read process.env at
 * import time, so the values must be set before any module under test loads.
 */
process.env.JWT_SECRET = "test-secret";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/healthaccess_test";
process.env.SERVER_ID = "hospital-s";
process.env.PEER_URL = "http://localhost:3002";
process.env.PEER_SECRET = "test-peer-secret";
// 32 bytes of hex. Patient and user ids are salted-hashed before they reach the
// chain, and the salt is read through the same lazy env accessor as JWT_SECRET,
// so it has to exist before any hashing test runs.
process.env.ACCESS_HASH_SALT = "a".repeat(64);
