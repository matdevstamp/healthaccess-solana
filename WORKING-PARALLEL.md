# Working in Parallel

Two clones, two branches, zero file overlap. This document is the contract
between them. Read it before you work in either.

## The setup

| | Rust clone | App clone |
|---|---|---|
| Path | `~/Skola/ha-solana` | `~/Skola/ha-app` |
| Branch | `feat/rust-audit-program` | `feat/solana-client` |
| Tasks | 24, 27, 28, 29 | 26, 30, 31, 32, 33, 34, 35, 36 |
| Toolchain | cargo + anchor | node + npm |
| Needs devnet SOL | yes (task 28) | no |

Both clone from `github.com:matdevstamp/healthaccess-solana`. Neither has the
Next.js node_modules; run `npm ci` in the app clone before touching TypeScript.

## File ownership

The rule: **a clone never edits a file the other clone owns.** Not even for a
one-line fix. Open a PR against the other branch instead.

### Rust clone owns

```
Cargo.toml                                (workspace root)
Anchor.toml
programs/healthaccess_audit/**
target/**
```

### App clone owns

```
package.json
package-lock.json
src/**
prisma/**
e2e/**
docs/**
demo/**
.github/workflows/**
```

### Nobody edits, by agreement

```
.env                     secret, gitignored
docs/hackathon/*.md      frozen contract, see below
docs/draft_tasks/*.md    planning, update only via the main clone
```

If a change is genuinely needed in the other clone's territory, write it down
in the PR description and let the merge do it. Do not reach across.

## Why the split is clean

Tasks 24/27/28/29 are pure Rust plus Anchor. They touch no TypeScript at all.

Tasks 26/30–36 are TypeScript, Prisma, and UI. The only bridge is
`programs/healthaccess_audit/src/lib.rs`, which the **Rust clone** owns and the
app never imports directly. The app talks to the program over RPC via the
generated TypeScript client, exactly as it would against any deployed program.

This is the payoff of splitting task 24 into 25 (pure) and 27 (Anchor). The
seam is defined in `docs/hackathon/INTERFACE-CONTRACT.md`, so neither clone
needs the other's output to start.

## Merge order

```
ha-solana: 24 → 27 → 28 → 29
ha-app:    26 → 30 → 31 → 32 → 33/34 → 35 → 36
```

Merge **Rust clone first**. Task 30 generates its TypeScript client from the
IDL, which is a Rust-clone artifact. Merging app first means generating a client
against an IDL that does not exist yet.

Recommended sequence, and do not skip it:

```bash
# Rust clone, once 24+27+28 are green
cd ~/Skola/ha-solana
git push origin feat/rust-audit-program
# open a PR, merge it

# THEN the app clone
cd ~/Skola/ha-app
git merge origin/main        # pick up the IDL
git rebase origin/main       # then replay your work on top
cargo build --manifest-path ../ha-solana/Cargo.toml  # or just read the committed IDL
```

If you need the IDL before merging, read it straight out of the Rust clone:

```bash
cp ~/Skola/ha-solana/target/idl/healthaccess_audit.json ~/Skola/ha-app/src/lib/solana/
```

That is a read, not an ownership violation. Copying the *committed* IDL into the
app after merging is the normal flow.

## Environment

Shared, because they describe the same devnet program:

```bash
# both clones need these
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
export SOLANA_RPC_URL=https://api.devnet.solana.com
export SOLANA_KEYPAIR_PATH=~/.config/solana/devnet.json
export SOLANA_CLUSTER=devnet
export SOLANA_COMMITMENT=confirmed
```

The keypair lives at `~/.config/solana/devnet.json`, outside both repos, so
there is exactly one and neither clone can commit it.

Add to `ha-app/.env` (gitignored):

```bash
SOLANA_PROGRAM_ID=          # filled in after task 28
ACCESS_HASH_SALT=           # 32-byte hex, generate with: openssl rand -hex 32
```

## The one shared resource: devnet SOL

Only the Rust clone needs it, for task 28's deploy. The app clone needs nothing
until it reads the chain, which is free.

If SOL runs out mid-deploy, the app work is unaffected. Do not let a rate-limited
airdrop stall both streams.

## Rules that keep this from becoming a mess

1. **Never `git push` from both clones at the same moment.** Stagger them.
2. **Never force-push a branch another clone has based work on.**
3. **Never edit a file the other clone owns.** PR instead.
4. **Commit in the clone that owns the file.** Do not batch across clones.
5. **If a clone needs to rebase, rebase from within that clone.** The other is unaffected.

## Status

Updated at the time both branches were first pushed for review.

Rust clone (`ha-solana`):

- Task 25 (pure hash chain) **complete** — 17 tests, tamper detection green
- Tasks 24 + 27 (Anchor program) **complete** — `declare_program!` adopted,
  `cargo test --features anchor` is 18 unit + 2 integration tests
- Task 28 (devnet deploy) **not done** — `SOLANA_PROGRAM_ID` is still empty in
  `.env`. Until it is filled the outbox stays `queued` and nothing is submitted;
  see the guard in `src/lib/outbox/record.ts`
- Task 29 (program tests) **in progress** — LiteSVM blocker documented in
  `docs/hackathon/KNOWN-ISSUES.md`

App clone (`ha-app`):

- Tasks 26 + 30 (outbox, chain client, salted ids) **complete**
- Task 31 (homemade chain removed) **complete**, plus the AccessLog→Patient
  foreign-key drop
- Tasks 32–35 **complete**
- Task 36 next
