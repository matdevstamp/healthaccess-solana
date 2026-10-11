import type { Note } from "@/lib/types/api";

export interface P2PNoteMessage {
  type: "note_created";
  from: string;
  timestamp: string;
  patientId: number;
  data: Note;
}
