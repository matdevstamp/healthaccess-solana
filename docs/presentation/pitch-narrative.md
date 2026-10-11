# Pitch narrative

The single source of truth for the decks and the presentation video. Every claim
here is verifiable against the running app, the tests, or a committed file; the
verification notes sit next to the claim. If a number here changes, it changes in
one place.

**Product:** HealthAccess — tamper-evident medical-record access auditing on Solana.
**Track:** Colosseum Crypto World's Fair, Solana track (student/university submission).

---

## 1. Problem

GDPR Article 15 gives every patient the right to know who accessed their medical
records. Health providers keep an audit log to satisfy it — and the party that is
*audited* is the same party that *owns and can edit* the log.

A log you can rewrite is not evidence. The verifier and the verified are the same
entity, so "immutable" is a promise, not a guarantee.

## 2. Insight

Every health system already has an audit log, and every one of them is mutable by
the party being audited. The missing piece is not a new log — it is a **commitment
to the log that the log's owner cannot quietly rewrite**.

That commitment does not need the medical data. It needs only a fixed-size,
pseudonymous record of *who accessed what, when* — and a chain that makes any
retroactive edit visible.

Our own first version proved the point the hard way: the course prototype used an
in-memory hash chain with **no signatures**. *Immutable* was a claim, not a
guarantee. Anchoring the head to Solana is what turns it into a guarantee.

## 3. Product

A rolling hash chain committed to a single Solana account:

```
head = sha256( prev_hash || borsh(event) )
```

- Medical data stays in PostgreSQL. **Never** on chain, not even hashed content.
- On chain: an 83-byte fixed `AccessEvent` — salted-hashed patient and actor ids,
  action, role, record id, server, timestamp. No `String`, no `Vec`, no PII.
- One `AuditTrail` PDA holds the running head. Rewriting any past event changes
  every hash after it, and the on-chain head stops matching — the tamper is visible.
- A durable outbox writes the event to Postgres first (`pending`), then a
  background flusher submits it to the program and stamps the row with the
  `slot`, `signature`, and committed `head_hash`.
- Patients see who looked, and the app can verify the local mirror against chain
  state and report a match.

## 4. Execution (shipped)

| Component | What exists | Verify |
|---|---|---|
| Anchor program | `healthaccess_audit`, `initialize` + `record_access` | `programs/healthaccess_audit/` |
| On-chain state | one `AuditTrail` PDA, 82 bytes, seeds `[b"audit_trail"]` | `docs/hackathon/INTERFACE-CONTRACT.md` |
| Program ID | `Co2EarRRbhBbisT1dcVoeYuNNs3fuRR1zFdyRd3ewxrE` | `declare_id!`, committed IDL |
| Optimistic concurrency | two writers race, one wins, loser re-reads and retries (`ChainBroken`) | `record_access`; outbox flusher |
| Working app | Next.js app, six roles, patient view, two-server realtime | `npm run dev`, `e2e/` |
| Tests | 461 unit tests (33 files), 21 Playwright specs, Rust pure-layer suite | `npm run test:unit`, `npm run test:e2e` |
| Demo | reproducible recorded MP4 with narration | `demo/`, `npm run demo` |

Scale: ~13,200 lines of TypeScript across the app, ~850 lines of Rust in the
program, 298 tracked files.

## 5. Market

Health-data access auditing is not a new budget line — it is a **compliance
requirement that already exists** across the EU under GDPR. Any provider or EHR
vendor that must prove an audit trail is a candidate, and the buyer is already
obligated to buy *something*. The wedge is the guarantee: not a better audit log,
but a log the operator cannot silently alter.

## 6. Traction

- **Shipped and working**, not a mock: the app runs end to end against two servers.
- **Tested**: unit, integration, and E2E against a real Postgres and two real
  servers; on-chain anchoring covered by a Solana E2E suite.
- **Deployable today on localnet**; devnet deploy is config-complete and blocked
  only on a funded keypair.
- **Open about its origin**: built on a course prototype; the Solana program,
  tests, and pipeline were built for this hackathon.

## Honest limits (say these before a judge asks)

Stating the boundaries reads as mastery. Being caught overclaiming reads as not
having understood the system.

1. **Retroactive integrity, not write-time truth.** On-chain commitment prevents
   alteration *after the fact*. It does not prove a malicious server logged
   truthfully *at write time*. This is the honest limit of the guarantee.
2. **Devnet deploy is blocked on funding.** Deploy config and app wiring are
   done; the airdrop is rate-limited. The demo runs on localnet.
3. **LiteSVM integration tests are blocked** on a Solana toolchain version
   collision (SBPFv2 vs SBPFv3). The pure-model and app-level tests cover the
   same rules; a failing suite was not shipped.
4. **Patient wallet consent (self-custodied consent key) is scoped out.** A real
   differentiator, but it would widen the frozen 83-byte payload — a design
   change, not a patch. Present as a direction, never as shipped.
5. **The trail authority is not rotatable on-chain.** `initialize` fixes it to
   the deploying payer; a lost keypair means a fresh deploy.

## The register

> We started with a prototype audit layer and hit its ceiling: it had no
> signatures, so *immutable* was a claim rather than a guarantee. This hackathon
> we shipped the real thing — the commitment lives on Solana, and the log cannot
> be quietly rewritten.

- **Decks and videos:** forward-leaning, confident, present tense. The origin is
  an engineering insight, not an apology.
- **Portal prior-work field:** accurate. Misrepresentation voids prizes under the
  official rules.
