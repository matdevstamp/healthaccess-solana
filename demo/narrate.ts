/**
 * Generates the English voice track: one clip per caption, voiced by that
 * caption's speaker.
 *
 * Run this BEFORE recording. The recorder reads durations/index.json to decide
 * how long each toast must stay on screen, so a caption is guaranteed to still
 * be readable when the voice finishes the sentence — the toast is timed from
 * the audio, never the other way round.
 *
 *   npm run demo:narrate
 *
 * Clips whose text and speaker are unchanged are reused, so iterating on one
 * caption does not re-synthesise the whole demo.
 */

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

import { CAPTIONS, CAPTION_ORDER, VOICES, type Speaker } from "./captions";

const run = promisify(execFile);

const AUDIO_DIR = "demo/out/audio";
const INDEX_PATH = `${AUDIO_DIR}/index.json`;

interface AudioIndex {
  /** captionId -> clip duration in ms. */
  durations: Record<string, number>;
  /** captionId -> text used to produce the clip, for staleness detection. */
  texts: Record<string, string>;
  /** captionId -> speaker that voiced the clip. */
  speakers: Record<string, Speaker>;
}

async function probeDurationMs(path: string): Promise<number> {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    path,
  ]);
  return Math.round(Number.parseFloat(stdout.trim()) * 1000);
}

async function main(): Promise<void> {
  await mkdir(AUDIO_DIR, { recursive: true });

  let index: AudioIndex = { durations: {}, texts: {}, speakers: {} };
  try {
    index = JSON.parse(await readFile(INDEX_PATH, "utf8")) as AudioIndex;
  } catch {
    // First run.
  }
  index.durations ??= {};
  index.texts ??= {};
  index.speakers ??= {};

  let generated = 0;
  let reused = 0;

  for (const id of CAPTION_ORDER) {
    const caption = CAPTIONS[id]!;
    const voice = VOICES[caption.speaker];
    const clipPath = `${AUDIO_DIR}/${id}.mp3`;

    if (index.texts[id] === caption.text && index.speakers[id] === caption.speaker) {
      reused += 1;
      continue;
    }

    await run("edge-tts", [
      "--voice",
      voice.voice,
      "--rate",
      voice.rate,
      "--text",
      caption.text,
      "--write-media",
      clipPath,
    ]);

    index.durations[id] = await probeDurationMs(clipPath);
    index.texts[id] = caption.text;
    index.speakers[id] = caption.speaker;
    generated += 1;

    const spoken = (index.durations[id]! / 1000).toFixed(2);
    console.log(`  ${voice.label.padEnd(8)} ${id.padEnd(24)} ${spoken}s`);
  }

  await writeFile(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  const total = Object.values(index.durations).reduce((sum, ms) => sum + ms, 0);
  console.log(
    `\n${CAPTION_ORDER.length} captions · ${generated} generated · ${reused} reused · ` +
      `${(total / 1000).toFixed(1)}s of speech`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
