# Presentation package

Everything needed for the Colosseum submission and Demo Day, in one place.

| File | What it is | Phase |
|---|---|---|
| [`pitch-narrative.md`](pitch-narrative.md) | The spine. Problem, insight, product, execution, market, traction, honest limits. Source of truth for every other file. | early |
| [`mentor-deck.md`](mentor-deck.md) | Technical deck for the Build Station. Admits edges; ends with questions we want answered. | early |
| [`pitch-deck.md`](pitch-deck.md) | Judge-facing deck. Leads with problem and product, not cryptography. | final |
| [`video-scripts.md`](video-scripts.md) | Shot-by-shot scripts for the 2–3 min presentation and the ≤ 3 min demo. | final |
| [`SUBMISSION.md`](SUBMISSION.md) | Portal-ready copy plus the required prior-development disclosure. | final |
| [`logo.svg`](logo.svg) · [`icon.svg`](icon.svg) | Product lockup and square icon. | final |

## Rules

- **One source of truth.** Numbers and claims live in `pitch-narrative.md`; the
  decks and videos copy from it. If a number changes, it changes once.
- **Every claim is verifiable.** Each claim ties to a file, a command, or a
  running screen. See the verification table in the narrative.
- **The register differs by audience.** Decks and videos are forward-leaning and
  present-tense. The portal prior-work field is strictly accurate.

## Regenerate-ability

The source of truth for the *claims* is the repository itself: the README, the
interface contract, and the test suites. When the app changes, update
[`pitch-narrative.md`](pitch-narrative.md) first, then the decks follow.
