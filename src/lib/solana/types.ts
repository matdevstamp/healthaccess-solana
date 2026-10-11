/**
 * Wire types for the audit trail.
 *
 * Contract §6 of `docs/hackathon/INTERFACE-CONTRACT.md`, verbatim. Every other
 * module imports these; nobody redefines them.
 *
 * `recordId` and `timestamp` are `bigint`. Solana record identifiers are i64
 * and unix seconds run past `Number.MAX_SAFE_INTEGER`'s safe range in the
 * contract's own examples, so a `number` here would silently corrupt values.
 * That is why it is a type and not a comment.
 */

export type ChainAction =
  | 0 // view
  | 1 // create
  | 2 // edit
  | 3 // delete
  | 4 // view_denied
  | 5; // view_not_found;

export type ChainRole =
  | 0 // doctor
  | 1 // nurse
  | 2 // ambulance
  | 3 // primary_care
  | 4 // patient
  | 5; // unauthorized;

export interface OnChainAccessEvent {
  /** Salted hash of the patient id. Never the raw id. */
  patientHash: Uint8Array; // 32 bytes
  /** Salted hash of the acting user id. Never the raw id. */
  actorHash: Uint8Array; // 32 bytes
  action: ChainAction;
  role: ChainRole;
  /** `-1` sentinel for "not tied to a specific record". BigInt, never number. */
  recordId: bigint;
  server: number;
  /** Unix seconds. BigInt, never number. The chain slot remains the trusted clock. */
  timestamp: bigint;
}

export type AnchorStatus = "pending" | "anchored" | "failed";

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

// ── Enum mapping ───────────────────────────────────────────────────────────

/**
 * `view_denied` and `view_not_found` are audit events, not errors: a refused
 * access is exactly what a patient most needs to see.
 */
export const CHAIN_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "view_denied",
  "view_not_found",
] as const;
export type ChainActionName = (typeof CHAIN_ACTIONS)[number];

export const CHAIN_ROLES = [
  "doctor",
  "nurse",
  "ambulance",
  "primary_care",
  "patient",
  "unauthorized",
] as const;
export type ChainRoleName = (typeof CHAIN_ROLES)[number];

/** `record_id` sentinel for "this event is not tied to a specific record". */
export const NO_RECORD = -1n;

const ACTION_CODES = new Map<string, ChainAction>(
  CHAIN_ACTIONS.map((name, code) => [name, code as ChainAction]),
);
const ACTION_NAMES = new Map<string, ChainActionName>(
  CHAIN_ACTIONS.map((name, code) => [String(code), name]),
);
const ROLE_CODES = new Map<string, ChainRole>(
  CHAIN_ROLES.map((name, code) => [name, code as ChainRole]),
);
const ROLE_NAMES = new Map<string, ChainRoleName>(
  CHAIN_ROLES.map((name, code) => [String(code), name]),
);

/** Human action names the app already produces, mapped onto the wire enum. */
const LEGACY_ACTIONS: Record<string, ChainActionName> = {
  view: "view",
  viewed: "view",
  create: "create",
  created_note: "create",
  edit: "edit",
  updated_record: "edit",
  update: "edit",
  delete: "delete",
  view_denied: "view_denied",
  view_not_found: "view_not_found",
};

/** Map an app action string to its wire code. Unknown actions become `view`. */
export function actionToCode(action: string): ChainAction {
  const direct = ACTION_CODES.get(action);
  if (direct !== undefined) {
    return direct;
  }
  const legacy = LEGACY_ACTIONS[action];
  return legacy === undefined ? 0 : (ACTION_CODES.get(legacy) ?? 0);
}

/** Map a wire code back to its human name, for display only. */
export function actionName(code: number): ChainActionName {
  return ACTION_NAMES.get(String(code)) ?? "view";
}

/** Map a role name to its wire code. Unknown roles become `unauthorized`. */
export function roleToCode(role: string): ChainRole {
  return ROLE_CODES.get(role) ?? 5;
}

/** Map a wire code back to its role name. */
export function roleName(code: number): ChainRoleName {
  return ROLE_NAMES.get(String(code)) ?? "unauthorized";
}

/** Narrowing guard for values decoded off the chain. */
export function isChainAction(value: number): value is ChainAction {
  return Number.isInteger(value) && value >= 0 && value < CHAIN_ACTIONS.length;
}

export function isChainRole(value: number): value is ChainRole {
  return Number.isInteger(value) && value >= 0 && value < CHAIN_ROLES.length;
}
