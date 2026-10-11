/**
 * A YouTube-style chapter strip, burned into the finished video by ffmpeg.
 *
 * The bar sits along the bottom: a progress line that advances with playback,
 * plus one segment per scene, with the current scene highlighted and labelled.
 *
 * It is drawn here rather than as a DOM overlay because a DOM overlay cannot
 * know where the other scenes ended — the strip spans the whole cut, so it can
 * only be laid out once every scene has been measured.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const WIDTH = 1920;
const HEIGHT = 1080;
const BAR_HEIGHT = 46;
/** Top edge of the bar. Absolute, because drawtext's x/y do not expose ih. */
const BAR_Y = HEIGHT - BAR_HEIGHT;
/** Space kept clear either side of a label inside its segment. */
const LABEL_PADDING = 14;
/** Rough advance width per character, used to decide whether a label fits. */
const CHAR_WIDTH = 6.6;
const FONT_SIZE = 13;
/** Baseline offset that centres the label in the bar. */
const LABEL_Y = BAR_Y + 16;

const FONT = "/usr/share/fonts/liberation-sans-fonts/LiberationSans-Regular.ttf";
const ACCENT = "0x38bdf8";
/**
 * Steps the progress fill advances in.
 *
 * drawbox evaluates its geometry once at configuration time, so `w='iw*t/TOTAL'`
 * renders a static bar no matter what `t` does. Only `enable` is re-evaluated
 * per frame, so the moving fill is drawn as a run of segments that each switch
 * on at their own moment.
 */
const PROGRESS_STEPS = 240;

export interface Chapter {
  /** Short label; longer ones are ellipsised to fit their segment. */
  label: string;
  start: number;
  end: number;
}

/** Shorten a label until it fits the space its segment can spare. */
function fit(label: string, segmentWidth: number): string {
  const budget = Math.floor((segmentWidth - LABEL_PADDING * 2) / CHAR_WIDTH);
  if (budget <= 1) return "";
  if (label.length <= budget) return label;
  return `${label.slice(0, Math.max(1, budget - 1)).trimEnd()}…`;
}

/**
 * The advancing fill, as segments that light up in turn.
 *
 * 240 segments over 1920px is 8px each: small enough that the bar reads as
 * moving rather than jumping, cheap enough to stay well inside the encode cost.
 */
function progressFill(total: number): string[] {
  const segment = WIDTH / PROGRESS_STEPS;
  const filters: string[] = [];

  for (let step = 0; step < PROGRESS_STEPS; step += 1) {
    const at = (total * step) / PROGRESS_STEPS;
    filters.push(
      `drawbox=x=${Math.round(step * segment)}:y=${BAR_Y - 4}` +
        `:w=${Math.ceil(segment) + 1}:h=3:color=${ACCENT}@0.95:t=fill` +
        `:enable='gte(t\\,${at.toFixed(3)})'`,
    );
  }

  return filters;
}

/**
 * Build the -vf filter chain for the chapter strip.
 *
 * Every scene label is written to its own file and referenced with `textfile`
 * rather than inlined, because ffmpeg's own escaping rules for `:` and `'` make
 * inlined non-ASCII text a reliable source of broken builds.
 */
export async function chapterFilter(chapters: Chapter[], total: number): Promise<string> {
  const labelDir = join("demo", "out", "segments", "labels");
  await mkdir(labelDir, { recursive: true });

  const placed = chapters.map((chapter) => {
    const x0 = Math.round((WIDTH * chapter.start) / total);
    const x1 = Math.round((WIDTH * chapter.end) / total);
    return { ...chapter, x0, x1, text: fit(chapter.label, x1 - x0) };
  });

  const filters: string[] = [
    // Bar background and its top edge.
    `drawbox=x=0:y=${BAR_Y}:w=iw:h=${BAR_HEIGHT}:color=black@0.78:t=fill`,
    `drawbox=x=0:y=${BAR_Y}:w=iw:h=1:color=white@0.16:t=fill`,
    // Dim track behind the fill.
    `drawbox=x=0:y=${BAR_Y - 4}:w=iw:h=3:color=${ACCENT}@0.22:t=fill`,
    ...progressFill(total),
  ];

  for (const [index, chapter] of placed.entries()) {
    const width = Math.max(1, chapter.x1 - chapter.x0);
    const file = join(labelDir, `${index}.txt`);
    await writeFile(file, chapter.text, "utf8");

    const window = `between(t\\,${chapter.start.toFixed(3)}\\,${chapter.end.toFixed(3)})`;

    // Highlight only the segment being played.
    filters.push(
      `drawbox=x=${chapter.x0}:y=${BAR_Y}:w=${width}:h=${BAR_HEIGHT}:color=white@0.13:t=fill:enable='${window}'`,
    );
    // Separator at each chapter boundary.
    if (index > 0) {
      filters.push(
        `drawbox=x=${chapter.x0}:y=${BAR_Y - 4}:w=1:h=${BAR_HEIGHT - 4}:color=white@0.22:t=fill`,
      );
    }
    if (chapter.text) {
      // Every label is drawn all the way through, dimmed, so the audience can
      // see where the demo is heading. The same label is then redrawn bright
      // while its own segment is playing, which is the only part that moves.
      filters.push(
        `drawtext=fontfile=${FONT}:textfile=${file}:fontsize=${FONT_SIZE}` +
          `:fontcolor=white@0.5:x=${chapter.x0 + LABEL_PADDING}:y=${LABEL_Y}`,
      );
      filters.push(
        `drawtext=fontfile=${FONT}:textfile=${file}:fontsize=${FONT_SIZE}` +
          `:fontcolor=white:x=${chapter.x0 + LABEL_PADDING}:y=${LABEL_Y}` +
          `:enable='${window}'`,
      );
    }
  }

  return filters.join(",");
}
