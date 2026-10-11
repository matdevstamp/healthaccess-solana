# Task: Hackathon Submission and Decks

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-10-13
- **Status:** TODO
- **Assignee:** matdevstamp
- **Tags:** presentation, hackathon, submission, required
- **Dependencies:** 35-solana-e2e-and-disclosure.md, 36-hackathon-documentation.md
- **Related:** 32-wire-flusher-to-program.md
- **Estimated Effort:** 13h

## Requirements

- Two decks: a technical mentor deck and a judge-facing pitch deck
- A 2-3 minute presentation video
- A product-demo video of at most 3 minutes
- The Colosseum submission portal is completed before the deadline
- The prior-development disclosure is accurate in the portal

## User Stories

- As a mentor at the Build Station, I want a technical deck so that I can give useful feedback on the architecture
- As a judge, I want a pitch that leads with the problem and the product so that I understand the opportunity quickly
- As a judge, I want to verify every claim on the deck so that I am not misled
- As a builder, I want the submission uploaded early so that a late failure does not cost the entry

## Design

### Deadlines

| Milestone | Time (CEST) |
|---|---|
| Submission deadline | **Oct 13, 04:59** |
| Demo Day, Build Station | Oct 13, 18:00 |

Submit before Demo Day. The local event is a separate, later opportunity.

### Two phases

**Early (wave 0, no code needed):** problem, insight, market, and the origin
narrative. None of it depends on the demo working. Getting this done early
means the deadline is spent filming, not thinking.

**Final (wave 7):** execution evidence, videos, portal upload.

### Two decks, two audiences

**Mentor deck (Build Station, technical).** Architecture, the concurrency model,
the outbox tradeoff, what is unfinished. The audience is Solana Foundation
engineers and ecosystem partners who give sharper feedback for a deck that
admits its edges.

**Pitch deck (Colosseum judges).** Judged on founder-market fit, insight,
product and execution, market size, founder communication, viability, and
traction. A medical-records solo founder should lead with insight and execution,
not cryptography.

Suggested arc:

1. **Problem.** Patients cannot verify who accessed their records. GDPR requires
   it; nothing delivers it.
2. **Insight.** Every health system already has an audit log, and every one of
   them is mutable by the party being audited. The verifier and the audited
   party are the same party.
3. **Product.** An Anchor program that commits to an access-log head hash. The
   log cannot be quietly rewritten.
4. **Execution.** The Rust program, the tests, the working app, the deployed
   program ID.
5. **Market.** Health-data access auditing across EU systems; the compliance
   requirement already exists.
6. **Traction.** Shipped working, deployed, tested. Honest about pre-existing
   origin.

### Prize targeting

- **Solana track**, $100k across 10 projects
- **University award**, $5k — applies, this is a student project
- **Public Good award**, $5k — arguable if components ship open source

### The honest framing

Every claim on the deck must survive inspection. The register:

> "We started with a prototype audit layer and hit its ceiling: it had no
> signatures, so *immutable* was a claim rather than a guarantee. This hackathon
> we shipped the real thing."

Two boundaries:

- **Deck and videos:** forward-leaning, confident, present tense. State the
  origin as an engineering insight, not an apology.
- **Portal prior-work field:** accurate. Misrepresentation voids prizes under the
  official rules.

State the known limit before a judge asks: on-chain commitment prevents
retroactive alteration, not a malicious server logging a lie at write time.
Volunteering that reads as mastery; being caught overclaiming reads as not
having understood the system.

### Videos

**Presentation video, 2-3 min.** Problem, insight, product, execution. Narrated.
Among the first things judges review.

**Demo video, ≤3 min.** Uninterrupted:

```
login as doctor → search patient → open journal → anchor an access log
→ show the Solscan link resolving on-chain
→ patient view: own data only, full chain verification
→ unauthorized: access denied
→ kill server 1, server 2 keeps serving, trail intact
```

The kill step is the strongest 15 seconds in the demo. Rehearse with the
terminals visible.

### Upload discipline

Draft the portal on Oct 11, submit on Oct 12. Never leave a required field to
Oct 13 at 03:00.

## Tasks

- [ ] Write the pitch narrative (early phase)
- [ ] Write the mentor deck (early phase)
- [ ] Write the full pitch deck (final phase)
- [ ] Verify every deck claim against the running app
- [ ] Record and edit the 2-3 min presentation video
- [ ] Record and edit the ≤3 min demo video
- [ ] Produce a logo or product graphic
- [ ] Draft the submission portal
- [ ] Write the prior-development disclosure accurately
- [ ] Submit before the deadline
- [ ] Prepare Demo Day for Oct 13, 18:00

## Done Criteria

- [ ] Mentor deck complete and shared at the Build Station
- [ ] Pitch deck complete
- [ ] Presentation video is 2-3 minutes
- [ ] Demo video is at most 3 minutes
- [ ] Logo uploaded
- [ ] Portal submitted before Oct 13, 04:59 CEST
- [ ] Disclosure accurate in the portal
- [ ] Every demo claim verified against the running app
- [ ] Demo Day rehearsed, including the kill-a-server step

## Notes

- Verify video durations mechanically; judges enforce the limits
- Rehearse at least twice on the demo machine with a recorded fallback ready
- Solo submission is allowed and explicitly supported. Present founder-market
  fit directly rather than inventing a team
- After submitting, still attend Demo Day; local prizes and mentor feedback are
  separate from the Colosseum submission

## Questions to Resolve

- [ ] Target the University award explicitly, or let it follow from the work?
- [ ] Which track: Solana, or a general submission? Solana is a separate $100k pool
- [ ] Is the repo public? It must be, or `hackathon@colosseum.com` needs access