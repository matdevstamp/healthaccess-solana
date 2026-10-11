/**
 * Shared API types — the single source of truth for the request/response
 * contract between route handlers and client components (kickoff decision:
 * no OpenAPI/generated client; both sides live in one TS codebase).
 */

import type { AnchorStatus } from "@/lib/solana/types";

export type { AnchorStatus } from "@/lib/solana/types";

/** The supported access roles. */
export const ROLES = [
  "doctor",
  "nurse",
  "ambulance",
  "primary_care",
  "patient",
  "unauthorized",
] as const;
export type Role = (typeof ROLES)[number];

/** Note visibility levels. */
export const NOTE_VISIBILITIES = ["private", "healthcare", "all"] as const;
export type NoteVisibility = (typeof NOTE_VISIBILITIES)[number];

/** Authenticated session user, decoded from the JWT / session cookie. */
export interface SessionUser {
  id: number;
  username: string;
  role: Role;
  organizationId: number | null;
  patientId: number | null;
}

/** Standard envelope for every JSON API response. */
export type ApiResponse<T> =
  { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

/**
 * Chain block of the health payload.
 *
 * `pendingEvents > 0` is not an error: it means the flusher is behind, and
 * surfacing it stops a demo looking broken when it is merely in flight.
 * `programDeployed: false` is the normal state before the task-28 deploy and
 * must not fail the check either — the off-chain audit view works without it.
 */
export interface SolanaHealth {
  reachable: boolean;
  cluster: string;
  programId: string | null;
  programDeployed: boolean;
  headHash: string | null;
  currentSlot: string | null;
  /** Outbox rows still waiting to be anchored. `null` when unqueryable. */
  pendingEvents: number | null;
  error: string | null;
}

/** GET /api/health payload. */
export interface HealthData {
  status: "ok";
  server: string;
  timestamp: string;
  /** Last-known status of the configured peer, kept fresh by the heartbeat. */
  peer?: {
    healthy: boolean | null;
    serverId: string | null;
    lastCheckedAt: string | null;
  };
  solana?: SolanaHealth;
}

/**
 * Whether the off-chain mirror still agrees with chain state.
 *
 * `match: false` is the tamper signal: a dropped, reordered, or edited local
 * entry changes the folded head. A `bigint` slot must cross JSON as a decimal
 * string; `Number(someSlot)` silently corrupts anything past 2^53.
 */
export interface ChainVerificationBlock {
  localHead: string;
  chainHead: string;
  match: boolean;
  checkedAt: string;
}

/** POST /api/auth/login request payload. */
export interface LoginRequest {
  username: string;
  password: string;
}

/** POST /api/auth/login response payload (no token — it lives in an httpOnly cookie). */
export interface LoginResponse {
  user: SessionUser;
}

/** Patient search filters supported by task 13. */
export type PatientSearchFilter = "name" | "dob" | "personalNumber";

/** Patient summary shown in search results. */
export interface PatientSummary {
  id: number;
  name: string;
  dateOfBirth: string;
  personalNumber: string;
  recordCount: number;
  noteCount: number;
  lastVisit: string;
}

/** GET /api/patients search payload. */
export interface PatientSearchResponse {
  patients: PatientSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  query: string;
  filters: PatientSearchFilter[];
}

/** Role-filtered medical record preview for the journal page. */
export interface MedicalRecordPreview {
  id: number;
  date: string;
  title: string;
  practitioner: string;
  summary: string;
}

/** Role-filtered note preview for the journal page. */
export interface JournalNotePreview {
  id: number;
  createdAt: string;
  author: string;
  authorUserId: number;
  visibility: NoteVisibility;
  text: string;
}

/** A single note returned by the notes API. */
export interface Note {
  id: number;
  recordId: number;
  text: string;
  visibility: NoteVisibility;
  authorUserId: number;
  author: string;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/notes payload. */
export interface NoteListResponse {
  notes: Note[];
  hiddenNotesCount: number;
}

/** POST /api/notes request payload. */
export interface CreateNoteRequest {
  recordId: number;
  text: string;
  visibility: NoteVisibility;
}

/** PATCH /api/notes/[id] request payload (at least one field is required). */
export interface UpdateNoteRequest {
  text?: string;
  visibility?: NoteVisibility;
}

/** POST /api/notes and PATCH /api/notes/[id] payload. */
export interface NoteMutationResponse {
  note: Note;
}

/** DELETE /api/notes/[id] payload. */
export interface NoteDeleteResponse {
  deletedId: number;
}

/**
 * userId → display name for access-log events. Resolved from SQL at read time
 * because the chain itself must not carry personal data. Keyed by string since
 * it arrives as a JSON object.
 */
export type AccessLogActorMap = Record<string, { username: string; role: Role }>;

/**
 * One recorded access event, as the app sees it.
 *
 * Lives in SQL and in the outbox, not on chain — the on-chain form is
 * `OnChainAccessEvent`, where the two ids are 32-byte salted hashes and there
 * is no `eventId` at all. Keeping them apart is the point: this shape carries
 * ids, so it must never cross the chain boundary, and `toChainEvent` is the
 * one function allowed to convert between them.
 */
export interface AccessLogEvent {
  eventId: string;
  userId: number;
  patientId: number;
  recordId: number | null;
  action: string;
  serverId: string;
  /** Client-supplied ISO time. The Solana slot is the trusted clock. */
  timestamp: string;
  /** Anchoring state. Absent on a live socket push, which has not flushed yet. */
  status?: AnchorStatus;
  signature?: string | null;
  /** Decimal string. BigInt on chain; a number would corrupt it silently. */
  slot?: string | null;
  headHash?: string | null;
}

/** GET /api/access-log payload. */
export interface AccessLogResponse {
  accessLogs: AccessLogEvent[];
  actors: AccessLogActorMap;
  /** Whether the local mirror still agrees with chain state. */
  verification: ChainVerificationBlock;
  viewerUserId: number;
}

/**
 * Access event preview for the patient journal.
 *
 * Named apart from the contract's `AccessLogPreview` (which is the anchored,
 * outbox-shaped one) because this is the *display* projection: it resolves the
 * actor's name and a coarse action verb, neither of which may go on chain.
 */
export interface JournalAccessLogPreview {
  id: number;
  timestamp: string;
  actorName: string;
  actorRole: Role;
  action: "viewed" | "created_note" | "updated_record";
  verified: boolean;
}

/**
 * Anchored access event preview. Contract §6, verbatim.
 *
 * `slot` is a decimal string rather than a number because Solana slots exceed
 * `Number.MAX_SAFE_INTEGER`; the same rule governs `recordId` on chain.
 */
export interface AccessLogPreview {
  eventId: string;
  patientId: number;
  userId: number;
  recordId: number | null;
  action: string; // human-readable, for display only
  serverId: string;
  clientTime: string; // ISO
  status: AnchorStatus;
  signature: string | null; // null until anchored
  slot: string | null; // decimal string; BigInt-backed
  headHash: string | null;
}

/** GET /api/patients/[id] journal payload. */
export interface PatientJournalResponse {
  patient: PatientSummary;
  viewerRole: Role;
  viewerUserId: number;
  isOwnJournal: boolean;
  records: MedicalRecordPreview[];
  notes: JournalNotePreview[];
  hiddenNotesCount: number;
  accessLogs: JournalAccessLogPreview[];
}
