/**
 * The split-screen demo: two users, two servers, side by side.
 *
 * Every scene here is two lanes. Lane 0 is hospital-s (3001) and lane 1 is
 * ambulance-a (3002), and the composer hstacks them into one frame, so the
 * viewer sees both servers at the same instant rather than being told about
 * them in sequence.
 *
 * Run with DEMO_SET=parallel; see sets.ts.
 */

import type { Page } from "@playwright/test";

import { settle } from "./human";
import { toast } from "./overlay";
import {
  chooseVisibility,
  clickWhenReady,
  DEMO_NOTE_TEXTS,
  DOCTOR_OPTION,
  NURSE_OPTION,
  openAccessLogTab,
  openAnnaJournal,
  openNotesTab,
  SERVER_1,
  SERVER_2,
  uiLogin,
  type Scene,
} from "./scenes";
import { humanClick, humanHover, humanRead, humanType } from "./human";

/**
 * Wait for a note that arrived from the *other* server to show up on this one.
 *
 * The realtime push is what normally delivers it. If the push loses a race with
 * the refetch that this lane kicked off by saving its own note, the note is in
 * the database but not on screen, so fall back to the most ordinary thing a user
 * could do: click another tab and come back, which refetches the journal. That
 * keeps the recorded claim honest, because the note really did cross servers.
 */
async function expectCrossedNote(page: Page, text: string): Promise<void> {
  try {
    await page.getByText(text).waitFor({ timeout: 8000 });
    return;
  } catch {
    // Fall through to the refetch.
  }

  await clickWhenReady(page, page.getByRole("tab", { name: /Records/ }));
  await page.waitForTimeout(400);
  await openNotesTab(page);
  await page.getByText(text).waitFor({ timeout: 15_000 });
}

/** Notes written only by this set, so cleanup can recognise them. */
export const PARALLEL_NOTE_TEXTS = {
  ambulance: "Triage complete. ECG within normal range.",
  handover: "Handover agreed with primary care. Continue inhalers.",
} as const;

const HEADING = /Anna Kowalska/;
const LANE_TITLES = ["Dr. Sofia Berg · hospital-s", "Nurse Alex Lind · ambulance-a"] as const;

/** Sign both lanes in and put both on the same patient's notes tab. */
async function bothOnNotes(left: Page, right: Page): Promise<void> {
  await uiLogin(left, SERVER_1, {
    option: DOCTOR_OPTION,
    url: /\/dashboard$/,
    heading: /Care staff dashboard/,
  });
  await uiLogin(right, SERVER_2, {
    option: NURSE_OPTION,
    url: /\/dashboard$/,
    heading: /Care staff dashboard/,
  });

  await openAnnaJournal(left, SERVER_1, HEADING);
  await openAnnaJournal(right, SERVER_2, HEADING);
  await openNotesTab(left);
  await openNotesTab(right);
}

function twoLanes(run: (left: Page, right: Page) => Promise<void>): Scene["run"] {
  return async (left, right) => {
    if (!right) throw new Error("this scene needs a second lane");
    await run(left, right);
  };
}

export const PARALLEL_SCENES: Scene[] = [
  {
    id: "par-setup",
    label: "Two servers, two users",
    chapter: "Setup",
    lanes: 2,
    laneTitles: [...LANE_TITLES],
    run: twoLanes(async (left, right) => {
      await bothOnNotes(left, right);
      await toast(left, "par-two-servers");
      await humanRead(left, 900, 1500);
      await humanRead(right, 500, 900);
    }),
  },

  {
    id: "par-realtime",
    label: "Note spreads in realtime",
    chapter: "Realtime",
    lanes: 2,
    laneTitles: [...LANE_TITLES],
    run: twoLanes(async (left, right) => {
      await bothOnNotes(left, right);
      await toast(left, "par-two-servers");

      await humanType(left, left.getByLabel("Note content"), DEMO_NOTE_TEXTS.realtime);
      await chooseVisibility(left, "Healthcare");
      await humanClick(left, left.getByRole("button", { name: "Save note" }));
      await left.getByText(DEMO_NOTE_TEXTS.realtime).last().waitFor({ timeout: 20_000 });

      // The right pane is never navigated: the note has to arrive on its own.
      await right.getByText(DEMO_NOTE_TEXTS.realtime).waitFor({ timeout: 25_000 });
      await toast(left, "par-arrive-live");
      await humanHover(right, right.getByText(DEMO_NOTE_TEXTS.realtime).first());
      await humanRead(right, 900, 1500);
    }),
  },

  {
    id: "par-concurrent",
    label: "Both write at the same time",
    chapter: "Concurrent",
    lanes: 2,
    laneTitles: [...LANE_TITLES],
    run: twoLanes(async (left, right) => {
      await bothOnNotes(left, right);
      await toast(left, "par-both-write");

      // Typing overlaps freely — it is a plain textarea.
      await Promise.all([
        humanType(left, left.getByLabel("Note content"), DEMO_NOTE_TEXTS.inhaler),
        humanType(right, right.getByLabel("Note content"), PARALLEL_NOTE_TEXTS.ambulance),
      ]);

      // The visibility pickers are a native <select>, whose popup is a single
      // shared surface: opening both at once makes one of them miss, and the
      // note then saves as private, which the other user correctly never sees.
      // So these are sequential even though the saves below are not.
      await chooseVisibility(left, "Healthcare");
      await chooseVisibility(right, "Healthcare");

      // Both lanes write, and the two saves are only a beat apart so the demo
      // still reads as simultaneous. The small gap is load-bearing: saving at
      // the same millisecond makes each lane's post-save refetch race the other
      // lane's realtime push, and the refetch can win with a snapshot taken
      // before the peer note existed, leaving the crossed note unrendered.
      await humanClick(left, left.getByRole("button", { name: "Save note" }));
      await left.waitForTimeout(1200);
      await humanClick(right, right.getByRole("button", { name: "Save note" }));

      await expectCrossedNote(left, PARALLEL_NOTE_TEXTS.ambulance);
      await expectCrossedNote(right, DEMO_NOTE_TEXTS.inhaler);

      await toast(left, "par-crossed");
      await humanRead(left, 800, 1300);
      await humanRead(right, 800, 1300);
    }),
  },

  {
    id: "par-ledger",
    label: "Each server verifies its log",
    chapter: "Blockchain",
    lanes: 2,
    laneTitles: [...LANE_TITLES],
    run: twoLanes(async (left, right) => {
      await uiLogin(left, SERVER_1, {
        option: DOCTOR_OPTION,
        url: /\/dashboard$/,
        heading: /Care staff dashboard/,
      });
      await uiLogin(right, SERVER_2, {
        option: NURSE_OPTION,
        url: /\/dashboard$/,
        heading: /Care staff dashboard/,
      });

      await openAnnaJournal(left, SERVER_1, HEADING);
      await openAnnaJournal(right, SERVER_2, HEADING);
      await openAccessLogTab(left);
      await openAccessLogTab(right);
      await left.getByTestId("access-log-row").first().waitFor({ timeout: 20_000 });
      await right.getByTestId("access-log-row").first().waitFor({ timeout: 20_000 });
      await settle(left);
      await settle(right);

      await toast(left, "par-own-ledger");
      await humanRead(left, 900, 1500);

      // Both panes verify against the shared Solana chain head, so the same
      // patient history reconciles across the two servers.
      await humanHover(left, left.getByText("Blockchain verified").first());
      await humanRead(left, 800, 1400);
      await humanHover(right, right.getByText("Blockchain verified").first());
      await humanRead(right, 900, 1500);

      await toast(left, "par-ledger-split");
    }),
  },
];
