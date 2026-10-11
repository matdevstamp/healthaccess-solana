# Task: E2E and Submission Disclosure

## Metadata
- **Priority:** P0 - Critical
- **Deadline:** 2026-10-12
- **Status:** TODO
- **Assignee:** matdevstamp
- **Tags:** testing, disclosure, required
- **Dependencies:** 29-solana-program-tests.md, 32-wire-flusher-to-program.md
- **Related:** 36-hackathon-documentation.md, 37-hackathon-submission-and-decks.md
- **Estimated Effort:** 4h

## Requirements

- E2E proves a real devnet signature results from a record view
- A test proves a tampered local log is detectable
- Devnet specs are separated from the default fast suite
- The prior course repository is disclosed accurately in the submission form

Documentation rewrite lives in task 36.

## User Stories

- As a judge, I want an E2E test that hits devnet so that I know the integration is real, not mocked
- As an auditor, I want a tamper test so that the headline claim is backed by evidence
- As a builder, I want devnet specs out of the default run so that the fast suite stays fast

## Design

### E2E against devnet

Two specs matter:

**Anchoring.** A record view produces a signature that resolves on-chain.

```ts
test("viewing a record anchors an access log on devnet", async ({ page }) => {
  await loginAs(page, "doctor");
  await page.goto(`/patients/${patientId}`);
  await expect(page.getByTestId("access-log-row").first())
    .toContainText(/anchored/i);
  const sig = await signatureFrom(page);
  expect(await signatureResolvesOnExplorer(sig)).toBe(true);
});
```

**Tamper detection.** Mutate a local log row, refetch, assert `match: false`.

That second spec is the one that proves the headline claim, so it is not
optional.

Tag both `@devnet` and exclude them from `npm run test`.

### Disclosure

Colosseum requires disclosure of relevant prior development work, with
misrepresentation voiding prizes. The README wording is task 36; the submission
form disclosure belongs here.

The disclosure must name the course project and link it. Judges can inspect the
history, and a verified disclosure is strictly safer than an unverified claim
of originality.

## Tasks

- [ ] Write the anchoring E2E spec
- [ ] Write the tamper-detection E2E spec
- [ ] Tag devnet specs and exclude from the default run
- [ ] Add a keyed-RPC CI job for the devnet specs
- [ ] Draft the submission-form disclosure naming the course repo
- [ ] Verify the disclosure text matches what the history shows

## Done Criteria

- [ ] Devnet E2E passes with a real signature
- [ ] Tamper spec produces `match: false`
- [ ] Devnet specs are tagged and excluded from the default run
- [ ] Submission-form disclosure names the course project and links it
- [ ] Disclosure text is accurate against the git history

## Notes

- **CUT LINE:** the CI job is droppable; keep the two specs, drop the automation
- Airdrops and devnet rate limits make CI flaky; a manual-triggered job beats every push
- The disclosure is short on purpose; a long explanation invites scrutiny it does not need

## Questions to Resolve

- [ ] Do the devnet specs need a funded CI wallet, or should the demo account be a documented devnet address?
- [ ] Should the specs live in `e2e/solana/` as a separate directory?