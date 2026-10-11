# Pitch deck — HealthAccess

Colosseum judges. Judged on founder-market fit, insight, product and execution,
market size, communication, viability, and traction. Lead with the problem and
the product; the cryptography is *how*, not *what*.

Solo submission — present founder-market fit directly.

---

## Slide 1 — Title

**HealthAccess**
Patients can prove who saw their medical records.
Tamper-evident access auditing, committed to Solana.

> *One breath. Then straight into the problem.*

---

## Slide 2 — Problem

Every patient has the legal right to know who accessed their records.

Every provider answers it with an **audit log they own and can edit**.

> The person being audited is the person keeping the evidence.

> *This is the whole opportunity: the trust gap is structural, not a feature gap.*

---

## Slide 3 — Insight

**A better audit log does not solve a trust problem. A commitment does.**

The fix is not to replace the hospital's log — it is to publish a commitment to
that log which the hospital **cannot quietly rewrite**, without ever putting
patient data on-chain.

> *Lead with this. It is the insight the whole product is built on.*

---

## Slide 4 — Product

Each access event folds into a rolling hash on Solana:

```
head = sha256( prev_hash || borsh(event) )
```

- **Medical data stays in PostgreSQL.** Never on-chain, not even hashed content.
- On-chain: a **pseudonymous** 83-byte event — who (salted hash), what action,
  which record, when.
- Rewrite any past event and every later hash breaks — the tamper is visible.

> *Product, in one idea: the chain stores a receipt, not the record.*

---

## Slide 5 — How a patient experiences it

1. A doctor opens a record → an event is written and anchored.
2. The patient sees **who** looked at their records.
3. The app verifies its own log against the on-chain head and reports **match**.
4. A refused access is logged too — a denial is exactly what a patient needs to see.

> *Show the patient view in the demo. It is the emotional beat.*

---

## Slide 6 — Execution (shipped, working)

| | |
|---|---|
| Anchor program | `healthaccess_audit`, deployed flow for localnet, program ID committed |
| App | Next.js, six roles, patient view, two-server realtime |
| Anchoring | durable outbox with retry; concurrent writers resolve on-chain |
| Tests | 461 unit tests, 21 Playwright E2E specs, Rust pure-layer suite |
| Demo | reproducible recorded walkthrough, two servers side by side |

82-byte on-chain account. 83-byte fixed payload. No `String`, no `Vec`, no PII.

> *Numbers on screen. Judges verify claims — these are all in the repo.*

---

## Slide 7 — Why now

- GDPR made access transparency a **legal requirement** across the EU.
- On-chain commitments became **cheap and boring** — this is now an engineering
  decision, not an exotic one.
- The audit requirement already exists; the buyer is already obligated.

> *Timing argument: the compliance need is old, the tooling is new.*

---

## Slide 8 — Market

Health-data access auditing is a **compliance line item**, not a new budget.

- Buyers: providers and EHR vendors who must prove an audit trail.
- Wedge: not "a better log" but "a log the operator cannot silently alter".
- First market: EU systems already bound by access-transparency rules.

> *Keep this short and confident. It is a real, obligated category.*

---

## Slide 9 — Traction

- **Shipped**, not mocked: runs end to end against two servers.
- **Tested**: unit, integration, E2E, and on-chain anchoring E2E.
- **Deployable today on localnet**; devnet is config-complete.
- **Honest provenance**: a course prototype grew into a real on-chain guarantee.

> *Solo, student, shipping a working system — that is the traction story.*

---

## Slide 10 — Founder-market fit

A student building health software, who hit the exact ceiling this product
addresses: a prototype audit log that *claimed* immutability and could not
prove it.

That failure is the product.

> *Founder-market fit here is domain + the scar of the wrong first version.*

---

## Slide 11 — The honest limit (say it first)

> **On-chain commitment prevents retroactive alteration. It does not prove a
> malicious server logged truthfully at write time.**

We say this before a judge asks. Knowing exactly where your guarantee stops is
the difference between a claim and a guarantee.

> *Volunteering this reads as mastery. Being caught overclaiming reads as not
> understanding the system.*

---

## Slide 12 — Roadmap

- **Devnet deploy** — done the moment the keypair is funded.
- **Self-custodied consent** — a patient-held key that records consent on-chain.
- **Batched commitments** — Merkle roots for higher write throughput per trail.
- **Per-organization trails** — partition contention for multi-tenant deployments.

> *Roadmap = the things we deliberately did not half-build.*

---

## Slide 13 — Ask

We are raising the bar for what "audit log" means in health software:
**a claim the operator cannot unmake.**

- Solana track — the program, the pipeline, the app are all here.
- Open about what is shipped, blocked, and deferred.

> *Close on the one-line thesis, not a request for money.*
