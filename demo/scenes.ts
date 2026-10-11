/**
 * Demo script: the flows docs/Raw_Requirements.md asks to be shown, in the
 * order a grader should see them.
 *
 * Each scene is recorded as its own video segment. Captions come from
 * captions.ts and are shown with toast() as the matching action happens, so
 * the text on screen and the voice track describe exactly the moment the
 * cursor is at.
 *
 * Every scene gets a fresh browser context, which doubles as the "log out and
 * switch role" step without needing a logout click.
 */

import type { Page } from "@playwright/test";

import {
  humanClick,
  humanHover,
  humanIdle,
  humanRead,
  humanType,
  reveal,
  scrollDown,
  scrollUp,
  settle,
} from "./human";
import { commitAddressBar, focusAddressBar, toast } from "./overlay";

export const SERVER_1 = "http://localhost:3001";
export const SERVER_2 = "http://localhost:3002";

export interface Scene {
  id: string;
  /** Descriptive label, kept in the timeline and printed while recording. */
  label: string;
  /**
   * Terse label for the burned-in chapter strip. Defaults to `label`, but a
   * long label gets ellipsised to fit its share of the bar, so scenes worth
   * naming set this to something short.
   */
  chapter?: string;
  /** 2 lanes are composited side by side (the two-server realtime scene). */
  lanes: 1 | 2;
  /** Where the recorder opens the browser before the scene's own actions. */
  startPath?: string;
  /**
   * Title shown in each lane's fake window chrome, left to right. Without it
   * the panes in a split-screen scene are indistinguishable.
   */
  laneTitles?: [string] | [string, string];
  /**
   * Sign in before the scene body runs. Scenes that open a journal directly
   * need this: every scene gets a fresh context, so the session never carries
   * over from the previous scene the way it would in a live click-through.
   */
  loginAs?: {
    option: string;
    url: RegExp;
    heading: RegExp;
  };
  run: (primary: Page, secondary?: Page) => Promise<void>;
}

/** Wait for an element to be interactive, then click it like a person. */
export async function clickWhenReady(
  page: Page,
  locator: Parameters<typeof humanClick>[1],
): Promise<void> {
  await locator.waitFor({ state: "visible", timeout: 15_000 });
  await settle(page);
  await humanClick(page, locator);
}

/** Log in through the real login form: pick the demo user, type, submit. */
export async function uiLogin(
  page: Page,
  baseURL: string,
  expectations: { option: string; url: RegExp; heading: RegExp },
): Promise<void> {
  const { option: optionLabel } = expectations;
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await settle(page);

  // Signing in is the least interesting thing the demo does, so it is played at
  // a believable clip rather than at a readable one: the pauses that make the
  // rest of the recording feel human are shortened here.
  await clickWhenReady(page, page.getByRole("combobox", { name: "Demo user" }));
  await clickWhenReady(page, page.getByRole("option", { name: optionLabel }));

  await humanType(page, page.getByLabel("Password"), "test123", {
    minDelay: 14,
    maxDelay: 34,
  });

  await clickWhenReady(page, page.getByRole("button", { name: "Sign in" }));
  await page.waitForURL(expectations.url, { timeout: 20_000 });
  await page.getByRole("heading", { name: expectations.heading }).waitFor({ timeout: 20_000 });
  await settle(page);
}

export const DOCTOR_OPTION = "Dr. Sofia Berg - Doctor";
export const NURSE_OPTION = "Nurse Alex Lind - Nurse";
const PATIENT_OPTION = "Anna Kowalska - Patient";
const UNAUTH_OPTION = "Unauthorized visitor - Unauthorized";
const CLINIC_OPTION = "Ekfors Primary Care Centre (nurse) - Primary care";

/**
 * Every note the recording writes, in one place.
 *
 * The recorder deletes these by text after each run. That is what makes
 * re-recording stable: a leftover note from an aborted run would otherwise make
 * a scene's own "did the note appear?" check match two elements and fail.
 */
export const DEMO_NOTE_TEXTS = {
  inhaler: "Inhaler used twice nightly. Review technique at next visit.",
  realtime: "SpO2 97% on arrival. Ambulating to triage.",
} as const;

/** The clinical journal used across the staff scenes. */
export async function openAnnaJournal(page: Page, baseURL: string, heading: RegExp): Promise<void> {
  await page.goto(`${baseURL}/patients/1`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: heading }).waitFor({ timeout: 20_000 });
  await page.getByText("Realtime connected").waitFor({ timeout: 20_000 });
  await settle(page);
}

export async function openNotesTab(page: Page): Promise<void> {
  await clickWhenReady(page, page.getByRole("tab", { name: /Notes/ }));
  await settle(page);
}

export async function openAccessLogTab(page: Page): Promise<void> {
  await clickWhenReady(page, page.getByRole("tab", { name: /Access log/ }));
  await settle(page);
}

/** Select a note-visibility level in the Radix select. */
export async function chooseVisibility(page: Page, optionName: string): Promise<void> {
  await clickWhenReady(page, page.locator("#note-visibility"));
  await clickWhenReady(page, page.getByRole("option", { name: optionName, exact: true }));
}

export const SCENES: Scene[] = [
  {
    id: "intro",
    label: "Awesome Journal",
    chapter: "Intro",
    startPath: "/",
    lanes: 1,
    run: async (page) => {
      await page.goto(SERVER_1, { waitUntil: "domcontentloaded" });
      await settle(page);
      await page.getByRole("heading", { level: 1, name: /Awesome\s*Journal/ }).waitFor();
      await humanIdle(page, 800, 1500);

      await toast(page, "intro-what");
      await humanHover(page, page.getByRole("link", { name: "Sign in", exact: true }));
      await humanRead(page, 500, 1000);

      await toast(page, "intro-gdpr");
      await humanRead(page, 600, 1200);

      await humanClick(page, page.getByRole("link", { name: "Sign in", exact: true }));
      await settle(page);
      await page.getByRole("button", { name: "Sign in" }).waitFor({ timeout: 15_000 });
      await humanRead(page, 700, 1300);
    },
  },

  {
    id: "login-doctor",
    label: "Login as doctor",
    chapter: "Login",
    lanes: 1,
    run: async (page) => {
      await page.goto(`${SERVER_1}/login`, { waitUntil: "domcontentloaded" });
      await settle(page);
      await humanRead(page, 600, 1100);

      await toast(page, "doctor-login");
      await clickWhenReady(page, page.getByRole("combobox", { name: "Demo user" }));
      await clickWhenReady(page, page.getByRole("option", { name: DOCTOR_OPTION }));

      await humanType(page, page.getByLabel("Password"), "test123");
      await humanRead(page, 400, 900);

      await clickWhenReady(page, page.getByRole("button", { name: "Sign in" }));
      await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
      await page
        .getByRole("heading", { name: /Care staff dashboard/ })
        .waitFor({ timeout: 20_000 });
      await settle(page);
      await humanRead(page, 900, 1500);
      await scrollDown(page, 0.3);
    },
  },

  {
    id: "search-patient",
    label: "Patient search",
    lanes: 1,
    loginAs: {
      option: DOCTOR_OPTION,
      url: /\/dashboard$/,
      heading: /Care staff dashboard/,
    },
    run: async (page) => {
      await page.goto(`${SERVER_1}/patients`, { waitUntil: "domcontentloaded" });
      await settle(page);
      await humanRead(page, 500, 1000);

      await toast(page, "doctor-search");
      await humanType(page, page.getByPlaceholder("Search patients..."), "Anna Kowalska");
      await humanRead(page, 400, 900);

      await clickWhenReady(page, page.getByRole("button", { name: "Search" }));
      await page.getByRole("link", { name: "Open journal" }).waitFor({ timeout: 15_000 });
      await settle(page);
      await humanRead(page, 800, 1400);

      await humanClick(page, page.getByRole("link", { name: "Open journal" }));
      await page.getByRole("heading", { name: /Anna Kowalska/ }).waitFor({ timeout: 20_000 });
      await settle(page);
      await humanRead(page, 700, 1300);
    },
  },

  {
    id: "records",
    label: "Journal entries from SQL",
    chapter: "Journal / SQL",
    lanes: 1,
    loginAs: {
      option: DOCTOR_OPTION,
      url: /\/dashboard$/,
      heading: /Care staff dashboard/,
    },
    run: async (page) => {
      await openAnnaJournal(page, SERVER_1, /Anna Kowalska/);
      await humanRead(page, 800, 1400);

      await toast(page, "doctor-records");
      await humanHover(page, page.getByText("Mild asthma — inhaler prescribed.").first());
      await humanRead(page, 700, 1300);
      await scrollDown(page, 0.4);
      await humanRead(page, 700, 1300);
      await scrollUp(page, 0.4);
      await humanIdle(page, 400, 900);
    },
  },

  {
    id: "note-visibility",
    label: "Write a note with visibility",
    chapter: "Visibility",
    lanes: 1,
    loginAs: {
      option: DOCTOR_OPTION,
      url: /\/dashboard$/,
      heading: /Care staff dashboard/,
    },
    run: async (page) => {
      await openAnnaJournal(page, SERVER_1, /Anna Kowalska/);
      await openNotesTab(page);
      await humanRead(page, 700, 1200);

      await toast(page, "doctor-notes-visibility");
      await humanType(page, page.getByLabel("Note content"), DEMO_NOTE_TEXTS.inhaler);
      await humanRead(page, 500, 1000);

      await toast(page, "doctor-notes-save");
      await chooseVisibility(page, "Healthcare");
      await humanRead(page, 600, 1200);

      await humanClick(page, page.getByRole("button", { name: "Save note" }));
      // .last(): the text is also still in the textarea, so match the rendered
      // note rather than whichever copy Playwright finds first.
      await page.getByText(DEMO_NOTE_TEXTS.inhaler).last().waitFor({ timeout: 20_000 });
      await settle(page);
      await humanRead(page, 1000, 1700);
    },
  },

  {
    id: "access-log",
    label: "Access log and verification",
    chapter: "Access log",
    lanes: 1,
    loginAs: {
      option: DOCTOR_OPTION,
      url: /\/dashboard$/,
      heading: /Care staff dashboard/,
    },
    run: async (page) => {
      await openAnnaJournal(page, SERVER_1, /Anna Kowalska/);
      await openAccessLogTab(page);
      await page.getByTestId("access-log-row").first().waitFor({ timeout: 20_000 });
      await settle(page);
      await humanRead(page, 900, 1500);

      await toast(page, "audit-privacy");
      await humanHover(page, page.getByTestId("access-log-row").first());
      await humanRead(page, 700, 1300);
      await scrollDown(page, 0.45);
      await humanRead(page, 700, 1200);

      await toast(page, "audit-verify");
      await humanHover(page, page.getByText("Blockchain verified").first());
      await humanRead(page, 700, 1300);
      await scrollDown(page, 0.35);
      await humanRead(page, 800, 1400);
    },
  },

  {
    id: "realtime-p2p",
    label: "Realtime between two servers",
    chapter: "Realtime P2P",
    lanes: 2,
    laneTitles: ["Dr. Sofia Berg · hospital-s", "Nurse Alex Lind · ambulance-a"],
    run: async (doctorPage, nursePage) => {
      if (!nursePage) throw new Error("realtime-p2p requires a second lane");

      await uiLogin(doctorPage, SERVER_1, {
        option: DOCTOR_OPTION,
        url: /\/dashboard$/,
        heading: /Care staff dashboard/,
      });
      await uiLogin(nursePage, SERVER_2, {
        option: NURSE_OPTION,
        url: /\/dashboard$/,
        heading: /Care staff dashboard/,
      });

      await openAnnaJournal(doctorPage, SERVER_1, /Anna Kowalska/);
      await openAnnaJournal(nursePage, SERVER_2, /Anna Kowalska/);
      await openNotesTab(doctorPage);
      await openNotesTab(nursePage);

      await toast(doctorPage, "p2p-servers");
      await humanRead(doctorPage, 500, 1000);

      const realtimeNote = DEMO_NOTE_TEXTS.realtime;
      await humanType(doctorPage, doctorPage.getByLabel("Note content"), realtimeNote);
      await chooseVisibility(doctorPage, "Healthcare");
      await humanRead(doctorPage, 500, 1000);

      await toast(doctorPage, "p2p-write");
      await humanClick(doctorPage, doctorPage.getByRole("button", { name: "Save note" }));
      await doctorPage.getByText(realtimeNote).waitFor({ timeout: 20_000 });
      await humanRead(doctorPage, 700, 1300);

      // The point of the scene: it lands on the other server with no reload,
      // so nursePage is only ever awaited here, never navigated.
      await nursePage.getByText(realtimeNote).waitFor({ timeout: 20_000 });
      await toast(doctorPage, "p2p-arrive");
      await humanHover(nursePage, nursePage.getByText(realtimeNote).first());
      await humanRead(nursePage, 700, 1200);

      await toast(doctorPage, "p2p-how");
      await humanHover(doctorPage, doctorPage.getByText(realtimeNote).first());
      await humanRead(doctorPage, 700, 1200);
    },
  },

  {
    id: "patient-view",
    label: "The patient's own view",
    lanes: 1,
    loginAs: {
      option: PATIENT_OPTION,
      url: /\/patients\/1$/,
      heading: /My health record/,
    },
    run: async (page) => {
      await humanRead(page, 800, 1400);

      await toast(page, "patient-redirect");
      await openNotesTab(page);
      await humanRead(page, 800, 1400);

      await toast(page, "patient-visibility");
      await humanHover(page, page.getByText("All").first());
      await humanRead(page, 800, 1300);

      const hiddenNotice = page.getByText(/protected healthcare note/);
      await hiddenNotice.waitFor({ timeout: 15_000 });
      await reveal(page, hiddenNotice);

      await toast(page, "patient-hidden-count");
      await humanHover(page, hiddenNotice);
      await humanRead(page, 800, 1400);

      await openAccessLogTab(page);
      await page.getByText("Blockchain verified").first().waitFor({ timeout: 20_000 });
      await settle(page);
      await humanRead(page, 1000, 1700);
    },
  },

  {
    id: "url-tampering",
    label: "URL tampering blocked",
    chapter: "URL change",
    lanes: 1,
    loginAs: {
      option: PATIENT_OPTION,
      url: /\/patients\/1$/,
      heading: /My health record/,
    },
    laneTitles: ["Anna Kowalska · patient"],
    run: async (page) => {
      await humanRead(page, 700, 1300);

      // Edit the address bar like a curious patient would. Playwright cannot
      // type into the real one — Control+l leaves focus on <body> because
      // browser chrome is outside the page — so the injected title bar stands
      // in for it, and pressing Enter navigates for real.
      await humanClick(page, page.locator("#demo-chrome .demo-url"));
      await focusAddressBar(page);
      await humanRead(page, 500, 900);

      await humanType(page, page.locator("#demo-chrome .demo-url-field"), "/patients/2", {
        clickFirst: false,
      });
      await humanRead(page, 700, 1200);

      await toast(page, "patient-tamper");
      await commitAddressBar(page);
      await page.getByText("Access denied").waitFor({ timeout: 20_000 });
      await page
        .getByText("Patients can only open their own journal.")
        .waitFor({ timeout: 20_000 });
      await settle(page);
      await humanRead(page, 1300, 2200);
    },
  },

  {
    id: "unauthorized",
    label: "Unauthorized denied access",
    chapter: "Unauthorized",
    lanes: 1,
    loginAs: {
      option: UNAUTH_OPTION,
      url: /\/access-denied$/,
      heading: /Access denied/,
    },
    run: async (page) => {
      await toast(page, "unauthorized");
      await humanRead(page, 900, 1500);
      await humanIdle(page, 500, 1000);
    },
  },

  {
    id: "primary-care",
    label: "Primary care gets clinical access",
    chapter: "Primary care",
    lanes: 1,
    loginAs: {
      option: CLINIC_OPTION,
      url: /\/dashboard$/,
      heading: /Care staff dashboard/,
    },
    run: async (page) => {
      await humanRead(page, 800, 1400);

      await toast(page, "clinic");
      await page.goto(`${SERVER_1}/patients`, { waitUntil: "domcontentloaded" });
      await settle(page);

      await humanType(page, page.getByPlaceholder("Search patients..."), "Anna");
      await clickWhenReady(page, page.getByRole("button", { name: "Search" }));
      await page.getByRole("link", { name: "Open journal" }).waitFor({ timeout: 15_000 });
      await humanRead(page, 600, 1200);

      await humanClick(page, page.getByRole("link", { name: "Open journal" }));
      await page.getByText("Primary care").first().waitFor({ timeout: 20_000 });
      await settle(page);
      await humanRead(page, 1000, 1700);
    },
  },

  {
    id: "outro",
    label: "Summary",
    lanes: 1,
    loginAs: {
      option: DOCTOR_OPTION,
      url: /\/dashboard$/,
      heading: /Care staff dashboard/,
    },
    run: async (page) => {
      await openAnnaJournal(page, SERVER_1, /Anna Kowalska/);
      await openAccessLogTab(page);
      await page.getByTestId("access-log-row").first().waitFor({ timeout: 20_000 });
      await settle(page);
      await humanRead(page, 800, 1400);

      await toast(page, "outro");
      await scrollDown(page, 0.4);
      await humanRead(page, 1600, 2600);
    },
  },
];
