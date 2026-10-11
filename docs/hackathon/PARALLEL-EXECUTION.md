# Parallel Execution Plan

**Deadline: Oct 13, 04:59 CEST** (Oct 12, 23:59 PT). Demo Day follows on Oct 13 at 18:00.

## The problem this solves

The task plan was sized for one human working sequentially, and on the critical
path that reads:

```
22 → 23 → 24 → 27 → 28 → 29 → 32 → 33
5h   4h  12h   9h   6h   5h   4h  13h  = 58h
```

58h of strictly serial work against ~50h available. Parallel agents do not
compress a chain. The point of this restructure is to **break the chain**, not
to add agents to it.

## What was actually blocking

Task 24 was 12h on the critical path and one indivisible unit. Split it:

- **Task 25** — pure Rust hash chain, `cargo test`, no Solana dependency
- **Task 26** — Anchor wrapper, glue

The interface between them is fixed in
[`INTERFACE-CONTRACT.md`](./INTERFACE-CONTRACT.md) before either starts. That
is what makes them safe to run at the same time.

## Revised critical path

```
22(5) → 23(3) → {24∥25∥26}(9) → 27(5) → {28∥29∥30}(7) → 32(5) → 36(5) → 37(13) ≈ 52h
```

Splitting task 24 into 24 (scaffold) and 25 (pure) moves 12h off a single
serial node, and task 26 (outbox) joins the same parallel wave as a bonus.
The honest critical path is ~52h against ~50h wall-clock, which is why the
cut lines below are triggered by clock time rather than by wishful thinking.

Down from 58h. The parallelism buys the margin, and the margin is what absorbs
the airdrop rate-limit that is already biting.

---

## Waves

### Wave 0 — start immediately, no dependencies

| Task | Agent | Owner of |
|---|---|---|
| 23 | **contract** | Freezes `INTERFACE-CONTRACT.md`. Blocks everything. |
| 22 | **infra** | Toolchain, workspace, CI |
| 36 | **docs** | README origin section, architecture outline |
| 37 | **pitch** | Deck narrative only. No code required. |

Task 23 is not optional and not parallel. It takes 3h and everything else
codes against its output. Starting it first is the single highest-leverage
action available.

Tasks 36 and 37 have an early phase that needs no running system, so they
absorb idle time on any agent that finishes early. Both have a later final
phase (see waves 6 and 7).

### Wave 1 — after 23 lands

| Task | Agent | Depends on |
|---|---|---|
| 24 | **scaffold** | contract only (Anchor scaffolding) |
| 25 | **rust-pure** | contract only (`cargo test`, no Solana) |
| 26 | **outbox** | contract only (Postgres model + insert, mockable flusher) |

Three agents, no file overlap. The outbox is deliberately included this early:
the Postgres model and insert path need the types, not the deployed program.

### Wave 2 — after 24 and 25 both merge

| Task | Agent | Depends on |
|---|---|---|
| 27 | **rust-anchor** | 24 + 25 merged |
| 36 (mid) | **docs** | 25 merged; can document real hash behavior |

### Wave 3 — after 27

| Task | Agent | Notes |
|---|---|---|
| 28 | **deploy** | Needs a build; airdrop is rate-limited, start early |
| 29 | **rust-tests** | LiteSVM integration. Needs the `.so` |
| 30 | **node** | TS client. **Owns `package.json`** |

Task 28 is short but externally rate-limited. Task 30 owns the one
serialization point in the plan.

### Wave 4 — after 30 (and 28 for a live chain)

| Task | Agent | Notes |
|---|---|---|
| 31 | **removal** | Deletes the old chain. Serial by nature |
| 32 | **app** | Wire flusher to the real program |

### Wave 5 — after 32

| Task | Agent | Notes |
|---|---|---|
| 33 | **wallet** | Phantom. Cut line. Owns `package.json` after 30 |
| 34 | **ui** | Verification UI. Cut line |

### Wave 6 — after 32

| Task | Agent | Notes |
|---|---|---|
| 35 | **e2e** | Devnet specs |
| 36 (final) | **docs** | Final documentation pass |

### Wave 7 — everything else green

| Task | Agent | Notes |
|---|---|---|
| 37 (final) | **pitch** | Videos and portal. **Upload early** |

---

## Merge order

Never merge two tasks touching the same file in the same wave.

```
23 → {24, 25, 26} → 27 → {28, 29, 30} → {31, 32} → {33, 34, 35, 36} → 37
```

Task 25 must merge before 27. Task 30 must merge before 33 (shared
`package.json`). Everything else is free.

## File ownership

Full table in [`INTERFACE-CONTRACT.md` §8](./INTERFACE-CONTRACT.md). The short
version:

| File | Owner |
|---|---|
| `Cargo.toml`, `.github/`, `.gitignore` | 22 |
| `Anchor.toml` | 24 |
| `programs/.../hash_chain.rs`, `state.rs`, `errors.rs` | 25 |
| `prisma/schema.prisma` | 26 |
| `programs/.../lib.rs` | 27 |
| `src/lib/solana/*`, `env.ts`, `types/api.ts`, `.env.example`, `package.json` | 30 |
| `src/lib/blockchain/*`, `src/lib/p2p/*`, `vitest.config.ts` | 31 |
| `e2e/**` | 35 |
| `README.md`, `docs/**`, `demo/captions.ts` | 36 |

**An agent that needs a file it does not own opens a PR against the owner's
branch. It does not edit the file.**

---

## The three things that break parallel runs

### 1. Contract drift

Two agents implementing the same interface from two readings produces code that
type-checks separately and fails at integration. `INTERFACE-CONTRACT.md` is
frozen and version-controlled for this reason. If it must change, it changes
once, in task 23, and every downstream agent re-reads it.

### 2. Shared-file collisions

`package.json` is the known hazard. Beyond that: any two agents running
`npm install` will contend on the lockfile even if they touch different files.
Sequence installs through the owner, not in parallel.

### 3. Unverifiable done-criteria

This is the real risk. Agents write fast and wrong, and a done-criterion that
cannot be checked mechanically will not be checked. Every task below has at
least one machine-checkable criterion — a command that exits non-zero.

---

## Cut lines

Decided now, not under pressure. Triggers are stated as conditions, not vibes.

| Trigger | Action |
|---|---|
| Behind after wave 3 | Drop task 34 (verification UI) |
| Behind after wave 4 | Drop task 33 (wallet) too |
| Wave 5 not green by **Oct 12, 09:00** | Stop features. Tasks 36 and 37 only. |
| Any P0 failing at **Oct 12, 17:00** | Submit with what works; polish is optional, a broken submission is not |

**Never cut:** 23 (contract), 25 (hash chain), 27 (program), 29 (tests), 37
(submission). Those five are the submission.

---

## Verification budget

Roughly 40% of remaining time goes to verification, not implementation. Assume
it. An unverified agent output is not an asset.

Minimum bar before submitting:

```
cargo test                                  # pure hash chain, no Solana needed
cargo test --features litesvm               # program integration
npm run lint && npm run typecheck           # TypeScript
npm run test:unit                           # existing suite must stay green
```

The existing 99%-coverage suite is an asset for this submission. It proves the
swap did not break what already worked. Keep it green throughout.

---

## Honest limit to state in the pitch

On-chain commitment prevents **retroactive alteration** of the access log. It
does not stop a malicious server logging a lie at write time. The application's
authorization layer is still trusted to produce truthful events.

State this before a judge asks. Volunteering a precise limitation reads as
mastery; being caught overclaiming reads as not having understood the system.