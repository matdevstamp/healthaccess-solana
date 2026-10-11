# Interface Contract

**Status:** FROZEN. Signed off before any implementation begins.
**Owner:** task 23. Everything else codes against this file.

This contract exists so that parallel agents can work without stepping on each
other. If two agents can implement tasks 24, 25, and 29 simultaneously, it is
because the boundaries between them are written down here, not agreed in chat.

**Any change to this file invalidates the parallelism.** If something here is
wrong, change it once, in task 23, and re-announce. Do not drift per-branch.

---

## 1. The on-chain account

```rust
#[account]
#[derive(InitSpace)]
pub struct AuditTrail {
    pub version: u8,
    pub authority: Pubkey,
    pub head_hash: [u8; 32],
    pub event_count: u64,
    pub bump: u8,
}
```

**Total size:** 8 (discriminator) + 1 + 32 + 32 + 8 + 1 = 82 bytes.

**PDA seeds:** `[b"audit_trail"]` — one global trail, not per-organization.

One trail per system, deliberately. Per-organization trails would multiply
accounts and contention analysis for no demonstration benefit. This is a
tradeoff worth raising with mentors at the Build Station, not worth building
two days before a deadline.

---

## 2. The payload

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AccessEvent {
    pub patient_hash: [u8; 32],
    pub actor_hash:   [u8; 32],
    pub action:       u8,
    pub role:         u8,
    pub record_id:    i64,
    pub server:       u8,
    pub timestamp:    i64,
}
```

**Total size:** 32 + 32 + 1 + 1 + 8 + 1 + 8 = 83 bytes.

### Hard constraints

- **No `String`. No `Vec`.** Fixed-size only.
- **No names, dates of birth, personal numbers, or note content.** Ever.
- `record_id: i64` uses `-1` as a sentinel, never `Option`, to keep Borsh
  encoding fixed-length.
- IDs are **salted-hashed before they reach the chain**. The chain holds
  pseudonymous accountability, not linkable identity.

### Enumerations

Both are `u8` on the wire. The string forms live in the TypeScript layer only.

```ts
// action
0 = view          3 = delete
1 = create        4 = view_denied
2 = edit          5 = view_not_found

// role
0 = doctor        3 = primary_care
1 = nurse         4 = patient
2 = ambulance     5 = unauthorized
```

`view_denied` and `view_not_found` are audit events, not errors. A refused
access is exactly the thing a patient most needs to see.

---

## 3. The hash function

```
head = sha256( prev_hash || canonical_borsh(event) )
```

- `prev_hash` is 32 bytes.
- `canonical_borsh(event)` is the deterministic Borsh serialization of the
  83-byte payload. **Not** JSON, **not** string concatenation, **not** any
  encoding whose byte length can drift.
- The first event chains from `[0u8; 32]`.

Client and program must produce identical bytes. That is what makes an
off-chain mirror verifiable against chain state, and it is what task 35's
tamper test proves.

---

## 4. Rust module boundaries

```
programs/healthaccess_audit/src/
├── lib.rs          # Anchor entrypoints. THIN. Task 27.
├── hash_chain.rs   # pure. No anchor_lang import. Task 25.
├── state.rs        # pure. Encode/decode AccessEvent. Task 25.
└── errors.rs       # AuditError enum. Task 25.
```

`hash_chain.rs` and `state.rs` **must not import `anchor_lang`**. That is what
lets `cargo test` run them with zero Solana tooling, and it is what allows task
25 to proceed while task 24 scaffolds.

Public surface of the pure modules — the seam task 27 wraps:

```rust
// hash_chain.rs
pub fn chain_head(prev: &[u8; 32], event: &AccessEvent) -> [u8; 32];
pub fn verify_chain(events: &[AccessEvent], expected: &[u8; 32]) -> bool;

// state.rs
impl AccessEvent {
    pub fn canonical_bytes(&self) -> [u8; 83];
}
```

---

## 5. Instructions

```rust
pub fn initialize(ctx: Context<Initialize>) -> Result<()>;
pub fn record_access(ctx: Context<RecordAccess>, event: AccessEvent, prev_hash: [u8; 32]) -> Result<()>;
```

`record_access` behavior, in order:

1. `require_keys_eq!(trail.authority, authority.key(), Unauthorized)`
2. `require!(trail.head_hash == prev_hash, ChainBroken)`
3. `trail.head_hash = chain_head(&prev_hash, &event)`
4. `trail.event_count += 1`
5. `emit!(AccessLogged { seq, head_hash, ...event })`

Step 2 is optimistic concurrency. Two writers race, exactly one wins, the
Loser gets `ChainBroken` and must **re-read the head and retry**. This replaces
the old chain's implicit last-write-wins timestamp sort.

### Errors

```rust
pub enum AuditError {
    Unauthorized,
    ChainBroken,
    AccountAlreadyInitialized,
}
```

Every variant must be provoked by a named test (task 29).

---

## 6. TypeScript types

Owned by task 30. Everything else imports these; nobody redefines them.

```ts
export type ChainAction = 0|1|2|3|4|5;   // view|create|edit|delete|view_denied|view_not_found
export type ChainRole   = 0|1|2|3|4|5;   // doctor|nurse|ambulance|primary_care|patient|unauthorized

export interface OnChainAccessEvent {
  patientHash: Uint8Array;   // 32 bytes
  actorHash:   Uint8Array;   // 32 bytes
  action:      ChainAction;
  role:        ChainRole;
  recordId:    bigint;       // -1 sentinel; BigInt, never number
  server:      number;
  timestamp:   bigint;       // unix seconds; BigInt, never number
}

export type AnchorStatus = "pending" | "anchored" | "failed";

export interface AccessLogPreview {
  eventId: string;
  patientId: number;
  userId: number;
  recordId: number | null;
  action: string;            // human-readable, for display only
  serverId: string;
  clientTime: string;        // ISO
  status: AnchorStatus;
  signature: string | null;  // null until anchored
  slot: string | null;       // decimal string; BigInt-backed
  headHash: string | null;
}
```

`slot` and `recordId` are `bigint` on chain and must not pass through `number`
in TypeScript. Solana lamports and slots exceed `Number.MAX_SAFE_INTEGER`.
Getting this wrong silently corrupts values, so it is a type, not a comment.

---

## 7. Environment

```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=          # set after task 28
SOLANA_KEYPAIR_PATH=~/.config/solana/devnet.json
SOLANA_CLUSTER=devnet
SOLANA_COMMITMENT=confirmed
ACCESS_HASH_SALT=           # 32-byte hex; salts patient/user IDs before hashing
```

`SOLANA_*` are declared in `src/lib/env.ts` via `requireEnv`, which already
throws on missing values. `ACCESS_HASH_SALT` is task 30's, and it must never
be committed.

---

## 8. File ownership

Exclusive. One owner per file. An agent that needs to touch a file it does not
own opens a PR against the owner's branch instead of editing directly.

| File | Owner | Task |
|---|---|---|
| `Cargo.toml` (root) | 22 | toolchain |
| `.github/workflows/*` | 22 | toolchain |
| `.gitignore` | 22 | toolchain |
| `Anchor.toml` | 24 | scaffold |
| `programs/healthaccess_audit/src/hash_chain.rs` | 25 | pure |
| `programs/healthaccess_audit/src/state.rs` | 25 | pure |
| `programs/healthaccess_audit/src/errors.rs` | 25 | pure |
| `prisma/schema.prisma` | 26 | outbox |
| `src/lib/notes/log.ts`, note access paths | 26 | outbox |
| `programs/healthaccess_audit/src/lib.rs` | 27 | program |
| `e2e/blockchain/*` (delete) | 31 | removal |
| `src/lib/solana/*` | 30 | client |
| `src/lib/env.ts` | 30 | client |
| `src/lib/types/api.ts` | 30 | client |
| `.env.example` | 30 | client |
| `src/lib/blockchain/*` (delete) | 31 | removal |
| `src/lib/p2p/*` (partial) | 31 | removal |
| `vitest.config.ts` | 31 | removal |
| `e2e/**` (new specs) | 35 | e2e |
| `README.md`, `docs/**` | 36 | docs |
| `demo/captions.ts` | 36 | docs |
| `package.json` | **SERIAL — see below** | — |

### `package.json` is a serialization point

Solana dependencies (`@solana/web3.js`, `@coral-xyz/anchor`,
`@solana/wallet-adapter-*`) are added by tasks 30 and 33. Two agents adding
dependencies concurrently will conflict in both `package.json` and
`package-lock.json`.

**Rule:** tasks 30 and 33 queue behind each other for this one file. They may
still run in parallel if 30 lands its dependency change first and 33 rebases.
Sequence it deliberately rather than discovering the conflict at merge.

---

## 9. What this contract deliberately does not decide

Per-organization trails. Program upgradeability. Mainnet deployment. Payment.
Each is a real design question and each is out of scope for a 50-hour
submission. Listed here so nobody treats an omission as an oversight.