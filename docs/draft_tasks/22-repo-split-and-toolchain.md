# Task: Solana Repo Split and Toolchain

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-10-10
- **Status:** TODO
- **Assignee:** matdevstamp
- **Tags:** solana, hackathon, tooling, required
- **Dependencies:** None
- **Related:** 24-solana-program-scaffold.md
- **Estimated Effort:** 5h

## Requirements

- The hackathon project lives in its own public repository
- The full pre-existing git history is preserved and pushed
- Rust, Solana CLI, and Anchor CLI are installed and verified
- The Rust workspace builds and `cargo test` passes
- CI runs `cargo test` on every push
- No keypair material is committed

## User Stories

- As a builder, I want the hackathon work in its own repository so that the course deliverable is never mutated
- As a judge, I want to inspect the git history so that I can see exactly what was built during the hackathon
- As a builder, I want `cargo test` in CI so that regressions in the Rust program are caught immediately
- As a builder, I want the toolchain state recorded so that a setup failure does not silently stall the project

## Design

### Repository split

GitHub refuses to fork a repository into the account that already owns it, so a
true fork is impossible. Instead the existing history becomes the root of a new
repository:

```
gh repo create matdevstamp/healthaccess-solana --public
git remote add solana git@github.com:matdevstamp/healthaccess-solana.git
git push solana main
```

**Already done.** Repo created and full history pushed.

### Why preserve history rather than squash

Colosseum requires disclosure of prior development work, with misrepresentation
voiding prizes. Keeping the history makes the disclosure verifiable by the judge
rather than asserted by the applicant. A compliance requirement expressed as
repository policy.

### Toolchain baseline (verified 2026-10-10)

| Tool | Status | Notes |
|---|---|---|
| `cargo` / `rustc` | 1.97.1 | Present |
| `solana` | 4.3.0 | Installed to `~/.local/share/solana` |
| `anchor` | 1.2.1 | Installed to `~/.cargo/bin` |
| Devnet keypair | `6qDeFvYgSqjcdQcXZ33MzQGH2nZi3PhG8r5k3FeVZTLw` | `~/.config/solana/devnet.json`, mode 600 |
| Devnet SOL | 0 | Airdrop rate-limited; retry needed |

Anchor is 1.2.1, so the scaffold task must verify macro idioms rather than
assume 0.x.

### Layout

```
healthaccess-solana/
├── Anchor.toml              # task 24
├── Cargo.toml               # this task (workspace root)
├── programs/healthaccess_audit/
├── src/                     # Next.js app
└── .github/workflows/       # this task
```

## Tasks

- [x] Create `matdevstamp/healthaccess-solana` (public)
- [x] Add as remote and push full existing history
- [ ] Install Solana CLI; verify `solana --version`
- [ ] Install Anchor CLI; verify `anchor --version`
- [ ] Create workspace `Cargo.toml`
- [ ] Verify `cargo build` and `cargo test` pass
- [ ] Add `cargo test` job to CI
- [ ] Update `.gitignore` for `target/`, `.anchor/`, keypairs
- [ ] Record the devnet keypair pubkey in the README

## Done Criteria

- [ ] New public repo contains the full pre-existing history
- [ ] Original course repo referenced in the README as prior work
- [ ] `cargo build` succeeds
- [ ] `cargo test` passes (zero tests is acceptable)
- [ ] `solana --version` and `anchor --version` succeed
- [ ] CI runs `cargo test` and passes
- [ ] No keypair material is committed

## Notes

- Solana CLI needs `export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"`
- Never commit `target/` or `*.keypair.json`
- The devnet airdrop is rate-limited; retry with backoff rather than assuming failure
- Owns the root `Cargo.toml`, `.github/`, and `.gitignore` exclusively

## Questions to Resolve

- [ ] Does `anchor build` require platform tools (`cargo install --locked --git https://github.com/anza-xyz/platform-tools`)?
- [ ] Which devnet RPC provider for E2E? The public endpoint rate-limits under parallel tests