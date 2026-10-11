# Demo

A reproducible presentation demo for Awesome Journal: a recorded MP4 with English
captions and two synthetic voices, covering the flows required by
[`../docs/Raw_Requirements.md`](../docs/Raw_Requirements.md).

## Presentation

- **Gamma document:** [Awesome Journal — presentation](https://gamma.app/docs/Awesome-Journal-sutbjt9liz0ezby?follow_on_start=true&following_id=pm3dsbunkjcrnnm&mode=doc)
- **Video:** `out/demo.mp4` (~6.5 min, 1920x1080)
- **Split-screen video:** `out/demo-parallel.mp4` (~2.5 min, 1920x1080)

> The Gamma document requires a login. The link above points to the presentation
> that ships with the submission.

> The videos live in `out/` and are **not** version-controlled. Run
> `npm run demo` to regenerate them from the tracked code.

## Scenes

| # | Scene | Shows |
|---|-------|-------|
| 1 | `intro` | Project name and demo summary |
| 2 | `login-doctor` | JWT login as doctor |
| 3 | `search-patient` | Patient search |
| 4 | `records` | Notes read from PostgreSQL/SQL |
| 5 | `note-visibility` | `private` hidden, `all` visible to the patient |
| 6 | `access-log` | The access log and blockchain verification |
| 7 | `realtime-p2p` | Same note on two servers (split-screen) |
| 8 | `patient-view` | Patient sees only their own data |
| 9 | `url-tampering` | changing the `userId` in the URL is blocked |
| 10 | `unauthorized` | Unauthorized role denied the journal |
| 11 | `primary-care` | Primary care gets shared access |
| 12 | `outro` | Summary |

## Running it yourself

Needs two running servers, a seeded database, and Chromium:

```bash
# 1. Seed + build
npx prisma generate && node prisma/seed.js
npm run build

# 2. Two servers, peered with each other
SERVER_ID=hospital-s PEER_URL=http://localhost:3002 npm run start -- -p 3001
SERVER_ID=ambulance-a PEER_URL=http://localhost:3001 npm run start -- -p 3002

# 3. Demo
npm run demo
```

`npm run demo` = `demo:narrate` → `demo:record` → `demo:compose`.

| Script | Does |
|--------|------|
| `npm run demo:narrate` | Generates one MP3 per caption with `edge-tts` into `out/audio/` |
| `npm run demo:record` | Records each scene into `out/raw/` and writes `out/timeline.json` |
| `npm run demo:compose` | Stitches `out/demo.mp4` together with audio and frame timing |

### Two versions

`DEMO_SET` chooses which recording is made:

| Variable | Output |
|----------|--------|
| `DEMO_SET=main` (default) | `out/demo.mp4` — the linear walkthrough of every requirement |
| `DEMO_SET=parallel` | `out/demo-parallel.mp4` — split-screen with both servers side by side |

`DEMO_SCENES=par-setup,par-realtime` records only some scenes, which is what
makes a single beat iterable.

### Captions

`captions.ts` is the single source of all text. The same string is used for the
on-screen toast and for the voice, so caption and voice can never drift apart.

| Field | Value |
|-------|-------|
| Voices | `en-US-JennyNeural`, `en-US-GuyNeural` |
| Rate | `-6%` |

Change the text in `captions.ts`, then `npm run demo:narrate && npm run demo:record
&& npm run demo:compose`.

### Output

`out/` is generated and **not versioned**:

- `out/demo.mp4`, `out/demo-parallel.mp4` — finished presentations
- `out/audio/` — voice clips + `index.json` (durations, text, speaker)
- `out/raw*/` — unedited screen recordings per scene and lane
- `out/segments*/` — ffmpeg intermediate steps
- `out/timeline*.json` — scene order and caption timestamps

Everything in `out/` can be recreated with `npm run demo` from the tracked code,
so there is no reason to check in ~40 MB of video and audio.

## Notes on the recording

- **The cursor.** Playwright does not record the OS pointer. `human.ts` therefore
  injects its own DOM cursor that follows the mouse, with a soft ring on each click.
- **Typing.** Keystrokes are sent character by character with a varied delay, not
  `fill()`, so the video looks hand-typed.
- **Motion.** The mouse travels along a curved path with slight drift, and
  scrolling happens in small steps — not a single `scrollTo`.
- **Video encoding.** Ffmpeg on this machine lacks `libx264`, so the compose step
  uses `libopenh264` with a fixed bitrate instead of CRF.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEMO_SET` | `main` | `main` or `parallel`, see [Two versions](#two-versions) |
| `DEMO_SCENES` | all scenes | Comma-separated list, e.g. `DEMO_SCENES=records,outro` |
| `SERVER_1` | `http://localhost:3001` | The host hospital |
| `SERVER_2` | `http://localhost:3002` | The ambulance |
| `DATABASE_URL` | from `.env` | Seeded and cleaned by `record.spec.ts` |

The recording writes rows and cleans them up after itself via `deleteDemoNotes`,
so the run is repeatable.
