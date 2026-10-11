# Task: Devnet Deploy

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-10-11
- **Status:** TODO
- **Assignee:** matdevstamp
- **Tags:** solana, deployment, devnet, required
- **Dependencies:** 27-build-anchor-program.md
- **Related:** 30-solana-client-and-env.md
- **Estimated Effort:** 2h

## Requirements

- The devnet wallet is funded
- The program is deployed to devnet
- The program ID and IDL are committed
- No keypair material is committed
- The deployment is verifiable by anyone from the README

## User Stories

- As a judge, I want the program ID in the README so that I can inspect the deployed program myself
- As a builder, I want the IDL committed so that clients can be generated without running Anchor locally
- As a builder, I want the keypair outside the repository so that a public repo never leaks spend authority

## Design

### Keypair location

`~/.config/solana/devnet.json`, outside the repository. **Already generated**
(`6qDe…zTLw`, mode 600). For a public repo the keypair must never be a repo
file, even gitignored, because gitignored files leak through CI logs and
archives.

### Sequence

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana airdrop 2                       # rate-limited; retry with backoff
anchor build
anchor deploy --provider.cluster devnet
```

Commit afterwards: `target/idl/healthaccess_audit.json`, the generated
TypeScript types, and the program ID in the README.

### Verification

```bash
solana program show <PROGRAM_ID> --url devnet   # exists, executable
solana account <PROGRAM_ID> --url devnet        # owner = BPF loader
```

### Schedule note

Two hours of work, but gated on an external rate limit that has already bitten
once. Start the airdrop attempt early and let it retry while other work
proceeds, rather than discovering the block at this point in the plan.

## Tasks

- [ ] Airdrop SOL to the devnet keypair
- [ ] `anchor build`
- [ ] `anchor deploy` to devnet
- [ ] Commit IDL and generated TypeScript types
- [ ] Record the program ID in the README
- [ ] Add `SOLANA_PROGRAM_ID` to `.env.example`
- [ ] Verify with `solana program show`

## Done Criteria

- [ ] Devnet keypair is funded
- [ ] No `*.keypair.json` or secret is tracked by git
- [ ] Program is deployed and visible on the devnet explorer
- [ ] Program ID is in the README
- [ ] IDL is committed
- [ ] `solana program show` confirms the deployment

## Notes

- Airdrop is rate-limited; retry with backoff, `solana airdrop 1` repeatedly
- Deployment costs roughly 1.5 SOL rent-exempt for a small program
- Commit the IDL so judges need not run `anchor build`
- `target/` and `.anchor/` must be gitignored before building

## Questions to Resolve

- [ ] Which devnet RPC provider for the app and E2E?
- [ ] Record the exact deploy command in the README so the deployment is reproducible?