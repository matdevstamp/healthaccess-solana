# Task: Devnet Deploy

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-10-11
- **Status:** TODO
- **Assignee:** matdevstamp
- **Tags:** solana, deployment, devnet, required
- **Dependencies:** 24-solana-audit-program.md
- **Related:** 29-solana-client-and-ha-demo.md
- **Estimated Effort:** 3h

## Requirements

- A devnet keypair exists and is funded
- The program is deployed to devnet
- The program ID and IDL are committed to the repository
- No keypair material is ever committed
- The deployed program is verifiable by anyone from the public README

## User Stories

- As a judge, I want the program ID in the README so that I can inspect the deployed program myself
- As a builder, I want the IDL committed so that clients can be generated without running Anchor locally
- As a builder, I want the keypair outside the repository so that a public repo never leaks spend authority

## Design

### Keypair location

`~/.config/solana/devnet.json` — the standard Solana CLI location, outside the repository. For a public repository, the keypair must never be a repo file, even gitignored, because gitignored files leak via CI logs, archives, and accidental `git add -f`.

### Sequence

```
solana-keygen new --outfile ~/.config/solana/devnet.json --no-bip39-passphrase
solana config set --keypair ~/.config/solana/devnet.json
solana config set --url devnet
solana airdrop 2
anchor build
anchor deploy --provider.cluster devnet
```

Commit afterwards: `target/idl/healthaccess_audit.json`, `target/types/healthaccess_audit.ts`, and the program ID in the README.

### Verification checklist

```
solana program show <PROGRAM_ID> --url devnet      # exists, executable
solana account <PROGRAM_ID> --url devnet           # owner = BPF loader
```

## Tasks

- [ ] Generate devnet keypair outside the repo
- [ ] Airdrop SOL
- [ ] `anchor build`
- [ ] `anchor deploy` to devnet
- [ ] Commit IDL and generated TypeScript types
- [ ] Record program ID in README
- [ ] Add a devnet address to `.env.example`

## Done Criteria

- [ ] Devnet keypair exists at `~/.config/solana/devnet.json`
- [ ] No `*.keypair.json` or secret is tracked by git
- [ ] Program is deployed and visible on the devnet explorer
- [ ] Program ID is in the README
- [ ] IDL is committed
- [ ] `solana program show` confirms the deployment

## Notes

- Devnet airdrop is rate-limited; if it fails, retry with backoff or use `solana airdrop 1` repeatedly
- Deployment costs roughly 1.5 SOL rent-exempt for a small program
- Commit the IDL rather than requiring judges to run `anchor build`
- Add `target/`, `.anchor/` to `.gitignore` before building

## Questions to Resolve

- [ ] Which devnet RPC provider for the app? Public endpoint is rate-limited and will fail under E2E parallel tests
- [ ] Record the deploy command in the README so the deployment is reproducible?