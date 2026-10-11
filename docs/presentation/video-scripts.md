# Video scripts

Two videos, two jobs. Both are narrated; both must survive a judge pausing to
check a claim. Timings are budgets, not targets — verify durations mechanically
before submitting.

- **Presentation video — 2:00 to 3:00.** Problem, insight, product, execution.
- **Demo video — ≤ 3:00.** An uninterrupted run of the app.

Record at 1920×1080. Keep the terminal visible for the demo. Rehearse at least
twice on the demo machine, with a recorded fallback ready.

---

## Presentation video (~2:35)

Screen-capture of the app plus simple title cards. No live terminal needed.

| Time | On screen | Narration |
|---|---|---|
| 0:00–0:15 | Title card: *HealthAccess* — patients can prove who saw their records | Every patient has the right to know who accessed their medical record. |
| 0:15–0:40 | The audit-log diagram; the log owner == the audited party | Providers answer that with an audit log. But the party being audited owns the log — and can edit it. A log you can rewrite is not evidence. |
| 0:40–1:05 | Split card: "course prototype" vs "this build" | Our first version was an in-memory hash chain with no signatures. Immutable was a claim, not a guarantee. So we moved the commitment onto Solana. |
| 1:05–1:35 | The hash-chain animation; `head = sha256(prev_hash ‖ borsh(event))` | Each access folds into a rolling hash. Medical data never leaves Postgres. Only a pseudonymous, fixed-size event goes on chain. Rewrite any past event and every later hash breaks. |
| 1:35–2:00 | App: doctor opens a record → patient view shows the access | A doctor opens a record, an event is anchored, and the patient sees who looked — and that the log matches the chain. Refused access is logged too. |
| 2:00–2:20 | Repo/test metrics on screen | It is shipped and tested: a Rust program, 461 unit tests, 21 end-to-end specs, and a reproducible recorded demo. |
| 2:20–2:35 | The honest-limit card | The limit, stated plainly: this proves the log was not altered after the fact. It does not prove a malicious server logged truthfully at write time. Knowing where the guarantee stops is the difference between a claim and a guarantee. |

---

## Demo video (≤ 3:00)

Uninterrupted. Terminal visible. The kill step is the strongest 15 seconds — do
not rush it.

| Time | Action | Why it is on screen |
|---|---|---|
| 0:00–0:15 | Two terminals: `hospital-s :3001`, `ambulance-a :3002` | Establish "two independent servers" before anything else. |
| 0:15–0:35 | Log in as doctor (JWT httpOnly cookie) | Auth is real and server-enforced. |
| 0:35–0:55 | Search patient → open journal | Staff flow works. |
| 0:55–1:15 | Create a note; open the access log | Every access is logged. |
| 1:15–1:40 | Show the access log row; open the Solscan/explorer link, resolved on-chain | The claim is verifiable outside our UI. |
| 1:40–2:00 | Patient view: own data only, full chain verification shows **match** | The point of the product, in one screen. |
| 2:00–2:15 | Log in as unauthorized role → access denied (and logged) | Refusals are events too. |
| 2:15–2:45 | **Kill server 1.** Server 2 keeps serving; its trail is intact; verification still matches | The distributed guarantee. Pause here. |
| 2:45–3:00 | Return to one line: data in SQL, guarantee on chain | Land the thesis. |

> **Localnet note.** If devnet is still blocked on funding, the explorer link
> resolves against localnet (or is replaced by the in-app verification card). Do
> not fake a devnet link — show the localnet proof and say so.

---

## Production checklist

- [ ] Durations measured with `ffprobe`, not guessed; within limits.
- [ ] Every claim on screen re-checked against the running app the day of filming.
- [ ] No PII in frame; only seeded test data.
- [ ] `ACCESS_HASH_SALT` and `JWT_SECRET` never visible in the terminal.
- [ ] Fallback recording of the kill step exists in case the live demo misbehaves.
