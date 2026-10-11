# AGENTS.md

Instructions for AI agents (and humans) working in **healthaccess-solana** — a
tamper-evident medical-record access audit trail on Solana. Medical data lives in
PostgreSQL; only pseudonymous access events are committed on-chain.

## Navigate before you read

This repo is mapped with **ripwire**, a deterministic call-graph CLI. Use it
instead of blind `grep` + whole-file reads — less context is measurably more
accurate, not just cheaper. See [`docs/ripwire.md`](docs/ripwire.md) for the full
guide.

```bash
ripwire .                                   # ranked map of the repo
ripwire . --for="<task in words>"           # orient on a task
ripwire . --pack-task="<task>"              # signatures + callers + tests, one call
ripwire . --expand=SYM                      # one symbol's body + callee signatures
ripwire . --callers=SYM                     # who calls it
ripwire . --impact=SYM                      # transitive blast radius
ripwire . --exemplar="<what you're writing>" # the repo's best instance to imitate
```

If a symbol you expect is missing, run `ripwire . --doctor`.

## Where things live

| Area | Path |
|---|---|
| Anchored audit program (Rust/Anchor) | `programs/healthaccess_audit/` |
| On-chain client (TS) | `src/lib/solana/` |
| Durable outbox (enqueue → flush → anchor) | `src/lib/outbox/` |
| Route handlers | `src/app/api/` |
| Prisma schema / migrations / seed | `prisma/` |
| App + blockchain E2E | `e2e/` |
| Recorded demo harness | `demo/` |
| Docs, diagrams, hackathon notes | `docs/` |

Start with [`README.md`](README.md), then
[`docs/hackathon/INTERFACE-CONTRACT.md`](docs/hackathon/INTERFACE-CONTRACT.md) for
the frozen on-chain design (program ID, 83-byte payload, rolling `head_hash`).

## Conventions

- **Docs are code.** A capability the docs claim but the code lacks is a bug. If
  you change behaviour, update the README, the diagrams, and the API/database
  docs in the same change. [`docs/hackathon/FUTURE-WORK.md`](docs/hackathon/FUTURE-WORK.md)
  lists what is deliberately not built.
- **App code goes to `main` through a PR** (CI must pass). `docs/` and
  `project_management/` may push directly.
- **Never commit secrets.** `ACCESS_HASH_SALT`, `JWT_SECRET`, and `PEER_SECRET`
  are runtime secrets; `keys/` holds the program keypair and is gitignored on
  purpose.
- **Prisma is generated, not hand-written** where marked: `docs/diagrams/data-model.md`
  comes from `prisma generate`.
- **Diagrams are Mermaid in Markdown** so GitHub renders them; regenerate
  `docs/diagrams/task-dependencies.md` with the `project_management` CLI rather
  than editing it by hand.

## Verify before you claim done

```bash
npm run check            # lint + typecheck + format
npm run test:unit        # Vitest (auth, visibility, hash chain, outbox, encoding)
npm run build && npm run test:e2e   # Playwright against two real servers
cargo test --features anchor        # Rust hash chain + program logic
```

See [`README.md`](README.md#testing) for the full test matrix.
