/**
 * Every caption in the demo: who says it, and what they say.
 *
 * This is the single source of truth for both outputs — the toast rendered on
 * screen and the spoken audio — which is what guarantees the voice says
 * exactly what the toast shows. A caption cannot drift out of sync with its
 * audio because they are the same string.
 *
 * Two speakers mirror the way the presentation is actually handed over in
 * class: Sofie covers the patient-facing side, Mattias the crypto and
 * distributed side. Object key order is the presentation order.
 *
 * Lines are deliberately short — they are read from the back of a lecture
 * room, and each one lands on a single visible action.
 */

export type Speaker = "sofie" | "mattias";

/** edge-tts neural voices. English (US) only, both a little under default rate. */
export const VOICES: Record<Speaker, { voice: string; rate: string; label: string }> = {
  sofie: { voice: "en-US-JennyNeural", rate: "-6%", label: "Sofie" },
  mattias: { voice: "en-US-GuyNeural", rate: "-6%", label: "Mattias" },
};

export interface Caption {
  speaker: Speaker;
  text: string;
}

export const CAPTIONS: Record<string, Caption> = {
  // Opening — what the project is and why.
  "intro-what": {
    speaker: "sofie",
    text: "Every time someone opens a patient journal, an access log is written to a blockchain.",
  },
  "intro-gdpr": {
    speaker: "sofie",
    text: "Medical data lives in SQL. The patient always sees who looked at it.",
  },

  // Staff flow.
  "doctor-login": {
    speaker: "mattias",
    text: "JWT in an httpOnly cookie. Every API route checks the role on the server.",
  },
  "doctor-search": {
    speaker: "mattias",
    text: "Search hits SQL — name, date of birth, or personal number.",
  },
  "doctor-records": {
    speaker: "mattias",
    text: "Journal entries are read from SQL. No medical content goes to the blockchain.",
  },
  "doctor-notes-visibility": {
    speaker: "sofie",
    text: "Every note has a visibility: Private, Healthcare, or All.",
  },
  "doctor-notes-save": {
    speaker: "sofie",
    text: "Healthcare is visible to care staff. We save it as Healthcare.",
  },

  // Audit chain.
  "audit-privacy": {
    speaker: "mattias",
    text: "The chain stores a userId, never a name.",
  },
  "audit-verify": {
    speaker: "mattias",
    text: "Every block is hashed and signed. Verified means the chain is unchanged.",
  },

  // Two-server realtime.
  "p2p-servers": {
    speaker: "mattias",
    text: "Two servers: Hospital S on 3001, Ambulance A on 3002.",
  },
  "p2p-write": {
    speaker: "mattias",
    text: "The doctor saves on Hospital S.",
  },
  "p2p-arrive": {
    speaker: "sofie",
    text: "The nurse sees it immediately. No refresh needed.",
  },
  "p2p-how": {
    speaker: "mattias",
    text: "Notes spread over Socket.io. The access log anchors to Solana.",
  },

  // Patient.
  "patient-redirect": {
    speaker: "sofie",
    text: "The patient is sent straight to their own journal.",
  },
  "patient-visibility": {
    speaker: "sofie",
    text: "She only sees notes marked All.",
  },
  "patient-hidden-count": {
    speaker: "sofie",
    text: "The app shows the number of hidden notes, not their content.",
  },
  "patient-tamper": {
    speaker: "mattias",
    text: "Change the URL to another patient and access is denied server-side.",
  },

  // Denied + clinic.
  unauthorized: {
    speaker: "mattias",
    text: "Unauthorized users land on Access denied. Permission is checked per route.",
  },
  clinic: {
    speaker: "sofie",
    text: "Primary care gets the same clinical access as other staff.",
  },

  // Closing.
  outro: {
    speaker: "mattias",
    text: "SQL for medicine, blockchain for access, two servers in real time.",
  },
  // Split-screen set (demo/scenes-parallel.ts).
  "par-two-servers": {
    speaker: "sofie",
    text: "Now we run two servers at once, side by side.",
  },
  "par-arrive-live": {
    speaker: "mattias",
    text: "A note created on the left appears on the right, without a reload.",
  },
  "par-both-write": {
    speaker: "sofie",
    text: "Now both write at the same time; no server is only a receiver.",
  },
  "par-crossed": {
    speaker: "mattias",
    text: "The notes cross between servers and both see the same journal.",
  },
  "par-own-ledger": {
    speaker: "sofie",
    text: "The SQL mirror is verified against the shared chain head on Solana.",
  },
  "par-ledger-split": {
    speaker: "mattias",
    text: "One shared chain for both servers, and the same medical data in SQL.",
  },
};

/** Caption ids in presentation order, used to pre-generate the voice track. */
export const CAPTION_ORDER: string[] = Object.keys(CAPTIONS);

// Fail loudly on a malformed caption rather than generating an empty clip.
for (const [id, caption] of Object.entries(CAPTIONS)) {
  if (!caption.text?.trim()) {
    throw new Error(`caption "${id}" has no text`);
  }
  if (!VOICES[caption.speaker]) {
    throw new Error(`caption "${id}" has unknown speaker "${caption.speaker}"`);
  }
}

/** Reading-time fallback for a caption whose audio has not been generated yet. */
export function estimatedDurationMs(text: string): number {
  return Math.min(7_500, 1_600 + text.length * 34);
}
