# Future work — what is deliberately not shipped

This document records the work that was **scoped out**, **blocked**, or
**deferred** under the hackathon deadline. Nothing here is hidden in the code:
where a capability is absent, the docs and the running app say so. The point of
listing it is to separate an honest gap from a false claim.

## 1. Patient wallet consent (task 33) — scoped out

**Idea.** Let a patient connect their own Solana wallet (Phantom) and record
consent on-chain, so access consent is bound to a key the patient holds rather
than one the institution asserts.

**Why it is not built.** The frozen on-chain contract is an 83-byte fixed
`AccessEvent` (`docs/hackathon/INTERFACE-CONTRACT.md`). A consent record would
need a new instruction, a new account, and a wider payload — i.e. a re-freeze of
the interface the client, IDL, and tests are built against. That is a genuine
design change, not a small patch, so it was cut rather than half-built.

**What "done" would look like.**

- `WalletConnectButton` / `ConsentStatus` components via
  `@solana/wallet-adapter-react`.
- One `register_consent` transaction linking the patient address to a
  pseudonymous patient hash plus a timestamp.
- Staff authentication **unchanged** — the wallet adds a capability, it never
  gates the app.
- Graceful behaviour with no wallet installed, and wallet state surviving a
  reload.

**Honest framing for a pitch.** A self-custodied consent key is a real
differentiator against "the hospital logs that it logged". It is also the least
built part of the system. Present it as a direction with a thin demo, never as a
shipped feature.

## 2. Devnet deployment (task 28) — blocked on funding

Deploy configuration is committed (`Anchor.toml`), the app reads
`SOLANA_PROGRAM_ID`, and a **localnet** deploy works today. The public **devnet**
deploy is blocked on a funded keypair: the devnet SOL airdrop is rate-limited and
no funded keypair was available before the deadline.

Consequence: the demo runs against localnet, and `/api/health` reports
`programDeployed: false` when `SOLANA_PROGRAM_ID` is empty. The audit view and
the outbox work off-chain in that mode instead of failing. See
`docs/hackathon/KNOWN-ISSUES.md` for the keypair-address caveat.

## 3. LiteSVM integration tests (task 29) — blocked on toolchain

Three Solana toolchain versions collide (`SBPFv2` vs `SBPFv3`); the suite is
written but not committed because shipping a failing suite is worse than
shipping none. The recommended path is to exercise the deployed program
end-to-end against the local validator from the app side, which covers the same
rules. Full analysis in `docs/hackathon/KNOWN-ISSUES.md`.

## 4. Smaller deferrals

- **In-memory chain and its P2P replication of the access log** (tasks 15/16)
  were superseded by the Solana program and are preserved in the git history.
- **Trail authority is not rotatable on-chain** — `initialize` fixes the
  authority to the deploying payer; a lost keypair means a fresh deploy.
- **On-chain commitment proves *retroactive* integrity, not write-time
  truthfulness.** A malicious server could log a false event truthfully. This is
  the honest limit of the guarantee, stated in the README.
