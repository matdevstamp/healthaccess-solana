# Submission

Portal-ready copy for the Colosseum Crypto World's Fair submission. Fields are
written to be pasted as-is; keep them accurate — the prior-work field is binding
under the official rules.

**Deadline:** Oct 13, 04:59 CEST. Draft on Oct 11, submit on Oct 12. Never leave
a required field to the final hours.

---

## Project name

**HealthAccess**

## One-liner

Tamper-evident medical-record access auditing: every record access is committed
to Solana, so a patient can prove nobody rewrote the log.

## Category / track

Solana track (separate $100k pool). Student project — eligible for the
University award. Repo is public.

## Elevator pitch (≤ 300 chars)

Patients have the legal right to know who accessed their medical records, but the
audit log is owned by the party being audited — and can be edited. HealthAccess
commits a rolling hash of the access log to Solana. The medical data stays in
PostgreSQL; the guarantee lives on chain.

## Short description

HealthAccess makes medical-record access logs tamper-evident. Patient data never
touches the chain: it stays in PostgreSQL. What goes on-chain is a fixed,
pseudonymous 83-byte event — a salted-hash of who accessed which record, the
action, and when. Each event folds into a rolling hash (`head = sha256(prev ||
borsh(event))`) stored in a single Solana PDA. Rewriting any past event changes
every hash after it, so the tamper is visible. A durable outbox writes the event
to Postgres first and a background flusher anchors it to the program, re-reading
the head on every attempt so concurrent writers resolve by re-read-and-retry.

## The problem

GDPR Article 15 gives patients the right to know who accessed their records.
Providers keep an audit log to satisfy it — and the party audited is the party
that owns and can edit the log. A log you can rewrite is not evidence.

## The insight

A better audit log does not fix a trust problem; a commitment does. The fix is not
to replace the provider's log, but to publish a commitment to it that the
provider cannot quietly rewrite — without putting patient data on-chain.

## What is built

- **Anchor program** `healthaccess_audit` — `initialize` + `record_access`,
  program ID `Co2EarRRbhBbisT1dcVoeYuNNs3fuRR1zFdyRd3ewxrE`.
- **On-chain state** — one 82-byte `AuditTrail` PDA (`[b"audit_trail"]`) holding a
  rolling 32-byte head.
- **Payload** — 83-byte fixed `AccessEvent`; no `String`, no `Vec`, no PII.
- **App** — Next.js with six roles, patient view, and two-server realtime.
- **Anchoring pipeline** — durable Postgres outbox + background flusher with
  optimistic-concurrency retry (`ChainBroken`).
- **Tests** — 461 unit tests, 21 Playwright E2E specs, Rust pure-layer suite.

## What is not shipped (and why)

Stated up front rather than hidden:

- **Devnet deploy** is config-complete but blocked on a funded keypair
  (airdrop rate-limited). **Localnet deploy works today.**
- **LiteSVM integration tests** are blocked on a Solana toolchain collision
  (SBPFv2 vs SBPFv3); not shipped rather than shipped failing.
- **Patient wallet consent** is scoped out — it would widen the frozen payload.
- **Honest limit:** on-chain commitment proves *retroactive* integrity, not that a
  malicious server logged truthfully at write time.

## Prior development disclosure (accurate — required)

HealthAccess began as **Inl 3**, a course assignment that implemented a
medical-records app with a **custom in-memory hash chain** for the audit log. That
implementation is preserved in this repository's git history and was never
deployed on-chain.

During the Colosseum Crypto World's Fair hackathon, the following were built
**new**:

- the Anchor program (`healthaccess_audit`) and its Rust tests;
- the frozen on-chain interface contract (82-byte account, 83-byte payload);
- the TypeScript Solana client (encoding, PDA, chain reads);
- the durable outbox and background flusher that anchor events;
- the on-chain verification UI and the Solana E2E tests.

The motivation for the move is itself disclosable and true: the course prototype
had **no signatures**, so its tamper-detection was a claim rather than a
guarantee. The hackathon work replaces that claim with a chain guarantee.

No other pre-existing code was reused. The app scaffolding (Next.js, Prisma,
auth, UI) is part of the same course project and is disclosed here.

## Links

- Repository: https://github.com/matdevstamp/healthaccess-solana
- Program ID: `Co2EarRRbhBbisT1dcVoeYuNNs3fuRR1zFdyRd3ewxrE`
- Interface contract: `docs/hackathon/INTERFACE-CONTRACT.md`
- Future work: `docs/hackathon/FUTURE-WORK.md`

## Team

Solo submission (supported by the rules). Present founder-market fit directly:
a builder in health software who hit this exact trust ceiling and shipped past it.

## Submission checklist

- [ ] Repo is public and the link resolves without login.
- [ ] README states the problem, the honest limit, and what is not shipped.
- [ ] Prior-development field matches this document.
- [ ] Presentation video is 2–3 min; demo video ≤ 3 min (measured).
- [ ] Logo uploaded.
- [ ] Submitted before Oct 13, 04:59 CEST.
- [ ] Demo Day (Oct 13, 18:00) rehearsed, including the kill-a-server step.
