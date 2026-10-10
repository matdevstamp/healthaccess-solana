# Task: Solana Repo Split and Toolchain

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-10-10
- **Status:** TODO
- **Assignee:** matdevstamp
- **Tags:** solana, hackathon, tooling, required
- **Dependencies:** None
- **Related:** 23-solana-program-scaffold.md
- **Estimated Effort:** 5h

## Requirements

- The hackathon project must live in a NEW public repository, separate from the course repo
- The full pre-existing git history must be preserved and pushed (Colosseum requires disclosure of prior development work; a visible history is the strongest disclosure)
- A Rust toolchain must be available and verified
- Solana CLI and Anchor CLI must be installed, or their absence explicitly documented
- The Rust workspace must build and `cargo test` must pass on an empty program
- CI must run `cargo test` on every push

## User Stories

- As a builder, I want the hackathon work in its own repository so that the course deliverable is never mutated
- As a judge, I want to inspect the git history so that I can see exactly what was built during the hackathon
- As a builder, I want `cargo test` in CI so that regressions in the Rust program are caught immediately
- As a builder, I want the toolchain state recorded so that a setup failure does not silently stall the whole project

## Design

### Repository split

GitHub refuses to fork a repository into the account that already owns it, so a true fork is not possible. Instead:

```
gh repo create matdevstamp/healthaccess-solana --public
git remote add solana git@github.com:matdevstamp/healthaccess-solana.git
git push solana main
```

The existing history becomes the root of the new repository. From that point the Solanified work lands as clearly attributable commits on top.

### Why preserve history rather than squash

Colosseum's submission form requires disclosing relevant past development work, and misrepresentation voids prizes. Keeping the original history means the disclosure is verifiable by the judge rather than asserted by the applicant. This is a compliance requirement expressed as a repository policy.

### Toolchain baseline (verified 2026-10-10)

| Tool | Status | Notes |
|---|---|---|
| `cargo` | 1.97.1 | Present |
| `rustc` | 1.97.1 | Present |
| `solana` | not installed | Install via `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"` |
| `anchor` | not installed | `cargo install --git https://github.com/solana-foundation/anchor anchor-cli` (~15min compile) |

The Rust toolchain being present while Solana is not is the single most important schedule fact in this project. It means task 24's core logic must be testable without any Solana dependency. See task 24.

### Layout

```
healthaccess-solana/
├── Anchor.toml
├── Cargo.toml            # workspace: programs/*, tests
├── programs/healthaccess_audit/
├── tests/                # Rust integration tests (task 26)
├── app/ (existing Next.js app, unchanged in this task)
├── package.json
└── .github/workflows/
```

## Tasks

- [ ] Create `matdevstamp/healthaccess-solana` (public)
- [ ] Add as remote and push full existing history
- [ ] Record the original course repo URL in README for disclosure
- [ ] Install Solana CLI; verify `solana --version`
- [ ] Install Anchor CLI; verify `anchor --version`
- [ ] Create workspace `Cargo.toml` and `Anchor.toml`
- [ ] Create `programs/healthaccess_audit/` with an empty lib
- [ ] Verify `cargo build` and `cargo test` pass
- [ ] Add `cargo test` job to CI
- [ ] Update `.gitignore` for `target/`, `.anchor/`, keypair files

## Done Criteria

- [ ] New public repo exists and contains the full pre-existing history
- [ ] Original course repo is referenced in the README as prior work
- [ ] `cargo build` succeeds
- [ ] `cargo test` runs and passes (zero tests is acceptable at this stage)
- [ ] `solana --version` and `anchor --version` succeed, or absence is documented
- [ ] CI runs `cargo test` and passes
- [ ] No keypair material is committed

## Notes

- Solana CLI installs to `~/.local/share/solana`; add to PATH in the shell profile
- Anchor CLI from source is a long compile. If it fails or exceeds ~20 minutes, proceed with tasks 23-24 anyway: they only require `cargo`, not `anchor`
- Never commit `target/` or `*.keypair.json`
- The course repo must remain untouched and deployable

## Questions to Resolve

- [ ] Does Anchor build require the Solana platform tools (`cargo-build-sbf`)? Install via `cargo install --locked --git https://github.com/anza-xyz/platform-tools`
- [ ] Which Solana RPC provider to use for devnet? Public devnet is rate-limited; a free Helius or QuickNode key may be needed for E2E