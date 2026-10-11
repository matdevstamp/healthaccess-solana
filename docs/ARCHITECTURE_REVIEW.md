# Architecture Review — 2026-10-11 (ripwire)

**Status:** review performed, findings below.

## Run metadata

- Tool: **ripwire 0.5.0** — deterministic AST call-graph extraction, no LLM pass,
  no API key, no network.
- Corpus: 275 files · 2293 symbols · 825 edges · 151 modules
  (1712 call-graph isolated).
- Outputs: [`ripwire-out/graph.html`](../ripwire-out/graph.html) (interactive
  call graph) and [`ripwire-out/GRAPH_REPORT.md`](../ripwire-out/GRAPH_REPORT.md)
  (human-readable summary) are the only tracked artifacts. ripwire's warm parse
  cache lives in `TMPDIR`, so nothing else is committed.
- Reproduce: `npm run ripwire` (see [docs/ripwire.md](ripwire.md)).

## Findings

1. **Clean tooling/app separation.** The graph splits into three loose groups
   with almost no cross-talk: the Python planning tooling
   (`project_management/` + tests), the Next.js application (`src/`, `prisma/`,
   `e2e/`, `demo/`), and root config files. No accidental coupling between the
   repo tooling and app code — the architecture matches the "docs/python
   direct-push, app via PR" boundary in the gruppkontrakt.
2. **The on-chain encoding is the real hub.** The highest-ranked symbols are
   `canonical_bytes` (`programs/healthaccess_audit/src/state.rs`) and
   `chain_head` (`hash_chain.rs`), and `state.rs` is a god file with three
   dependents. That is correct: the 83-byte `AccessEvent` encoding is the
   contract every other layer (Anchor program, TS client, outbox, tests) depends
   on. It is a deliberate chokepoint, not an accident.
3. **One dependency cycle, at the expected seam.**
   `src/lib/solana/submitter.ts` ↔ `client.ts` ↔ `chain.ts` form the only cycle
   in the repository. These three are the on-chain client boundary and are tightly
   cohesive by design, but the cycle is worth watching as the client grows.
4. **Hub nodes are the deliberate seams.** Beyond the program core, the bridges
   are the planning CLI and the GitHub client (`project_management/`) — the repo
   tooling, not the app. Nothing in the app's hot path is an unexpected tangle.
5. **Docs are first-class in the graph.** ripwire indexes Markdown, so
   `docs/` headings appear as symbols and the documentation layer is structurally
   connected to the code it describes — useful for spotting docs that describe
   code which no longer exists.
6. **Caveat: Prisma is not parsed.** `prisma/schema.prisma` is not a ripwire
   language, so the data model is absent from the graph. Read the generated
   [`docs/diagrams/data-model.md`](diagrams/data-model.md) for that layer.

## Bus factor

Ownership is recency-weighted per file: **228 of 273 files have a single author**
by weighted commits, while the shared app files (route handlers, `src/lib/types/api.ts`,
`gruppkontrakt.md`) carry two to four authors each. The integration surfaces are
shared even where individual files are not — consistent with the four-stream
structure in the project plan.

## Re-run before submission

Regenerate both artifacts after the final merged change:

```bash
npm run ripwire
```

`graph.html` and `GRAPH_REPORT.md` are committed outputs; if the topology changed,
commit the regenerated copies with the change that altered it.
