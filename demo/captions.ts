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

/** edge-tts neural voices. Swedish only, both a little under default rate. */
export const VOICES: Record<Speaker, { voice: string; rate: string; label: string }> = {
  sofie: { voice: "sv-SE-SofieNeural", rate: "-6%", label: "Sofie" },
  mattias: { voice: "sv-SE-MattiasNeural", rate: "-6%", label: "Mattias" },
};

export interface Caption {
  speaker: Speaker;
  text: string;
}

export const CAPTIONS: Record<string, Caption> = {
  // Opening — what the project is and why.
  "intro-what": {
    speaker: "sofie",
    text: "Varje gång någon öppnar en patientjournal skrivs en accesslog till en blockkedja.",
  },
  "intro-gdpr": {
    speaker: "sofie",
    text: "Medicinska uppgifter ligger i SQL. Patienten ser alltid vem som tittat.",
  },

  // Staff flow.
  "doctor-login": {
    speaker: "mattias",
    text: "JWT i httpOnly-cookie. Varje API-route kontrollerar rollen på servern.",
  },
  "doctor-search": {
    speaker: "mattias",
    text: "Sökningen går mot SQL — namn, födelsedatum eller personnummer.",
  },
  "doctor-records": {
    speaker: "mattias",
    text: "Journalposterna läses från SQL. Inget medicinskt innehåll går till blockkedjan.",
  },
  "doctor-notes-visibility": {
    speaker: "sofie",
    text: "Varje anteckning har en synlighet: Private, Healthcare eller All.",
  },
  "doctor-notes-save": {
    speaker: "sofie",
    text: "Healthcare syns för vårdpersonal. Vi sparar den som Healthcare.",
  },

  // Audit chain.
  "audit-privacy": {
    speaker: "mattias",
    text: "Kedjan visar userId, inte namn.",
  },
  "audit-verify": {
    speaker: "mattias",
    text: "Varje block hashas och signeras. Verified betyder att kedjan är oförändrad.",
  },

  // Two-server realtime.
  "p2p-servers": {
    speaker: "mattias",
    text: "Två servrar: Sjukhus S på 3001, Ambulans A på 3002.",
  },
  "p2p-write": {
    speaker: "mattias",
    text: "Läkaren sparar på Sjukhus S.",
  },
  "p2p-arrive": {
    speaker: "sofie",
    text: "Sjuksköterskan ser den direkt. Ingen uppdatering behövs.",
  },
  "p2p-how": {
    speaker: "mattias",
    text: "Anteckningar sprids via Socket.io. Åtkomstloggen ankar till Solana.",
  },

  // Patient.
  "patient-redirect": {
    speaker: "sofie",
    text: "Patienten skickas direkt till sin egen journal.",
  },
  "patient-visibility": {
    speaker: "sofie",
    text: "Hon ser bara anteckningar med synligheten All.",
  },
  "patient-hidden-count": {
    speaker: "sofie",
    text: "Appen visar antalet dolda anteckningar, inte innehållet.",
  },
  "patient-tamper": {
    speaker: "mattias",
    text: "Byter vi URL:en till annan patient nekas åtkomst server-side.",
  },

  // Denied + clinic.
  unauthorized: {
    speaker: "mattias",
    text: "Obehörig skickas till Access denied. Behörighet prövas per route.",
  },
  clinic: {
    speaker: "sofie",
    text: "Primary care får samma kliniska åtkomst som övrig personal.",
  },

  // Closing.
  outro: {
    speaker: "mattias",
    text: "SQL för medicin, blockkedja för åtkomst, två servrar i realtid.",
  },
  // Split-screen set (demo/scenes-parallel.ts).
  "par-two-servers": {
    speaker: "sofie",
    text: "Nu kör vi två servrar samtidigt, som två fönster bredvid varandra.",
  },
  "par-arrive-live": {
    speaker: "mattias",
    text: "Anteckningen skapad till vänster dyker upp till höger, utan omladdning.",
  },
  "par-both-write": {
    speaker: "sofie",
    text: "Nu skriver båda samtidigt, ingen server är bara mottagare.",
  },
  "par-crossed": {
    speaker: "mattias",
    text: "Anteckningarna korsar serverna och båda ser samma journal.",
  },
  "par-own-ledger": {
    speaker: "sofie",
    text: "Speglingen i SQL verifieras mot det gemensamma kedjehuvudet på Solana.",
  },
  "par-ledger-split": {
    speaker: "mattias",
    text: "En gemensam kedja för båda servrarna, och samma medicinska data i SQL.",
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
