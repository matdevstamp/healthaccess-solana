/**
 * The audit program IDL.
 *
 * Anchor's build writes `target/idl/healthaccess_audit.json` into the *Rust*
 * clone (`~/Skola/ha-solana/target/idl/`). `target/**` belongs to that clone, so
 * this module never writes there; it only reads, when the file is present, and
 * falls back to the copy below.
 *
 * The fallback exists because this app and the Rust program were built in
 * parallel, and the contract froze the wire format before either existed. The
 * layout below is transcribed from `programs/healthaccess_audit/src/state.rs`
 * and `docs/hackathon/INTERFACE-CONTRACT.md` §1/§2/§5. When the real IDL
 * arrives, `loadIdl()` prefers it, so the fallback is a scaffold that retires
 * itself rather than a second source of truth.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { PublicKey } from "@solana/web3.js";

/** An account an instruction expects, in declaration order. */
export interface IdlInstructionAccount {
  name: string;
  writable?: boolean;
  signer?: boolean;
  pda?: { seeds: { kind: string; value: number[] | string }[] };
}

/** Anchor 0.30+ IDL shape. Only the parts the client actually reads. */
export interface AuditIdl {
  address: string;
  metadata: { name: string; version: string; [key: string]: unknown };
  instructions: {
    name: string;
    discriminator: number[];
    args: { name: string; type: unknown }[];
    accounts: IdlInstructionAccount[];
  }[];
  accounts: { name: string; discriminator: number[] }[];
  events: { name: string; discriminator: number[] }[];
  types: { name: string; type?: { kind: string; fields?: { name: string; type: unknown }[] } }[];
  errors: { code: number; name: string; msg: string }[];
}

/** The system program. Declared by every Anchor instruction that moves lamports. */
export const SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");

/** One instruction by name. Throws rather than returning undefined. */
export function idlInstruction(idl: AuditIdl, name: string): AuditIdl["instructions"][number] {
  const instruction = idl.instructions.find((candidate) => candidate.name === name);
  if (!instruction) {
    throw new Error(`Unknown instruction: ${name}`);
  }
  return instruction;
}

/**
 * Field names of an IDL-defined struct, in declaration order.
 *
 * Declaration order is the whole point: Borsh encodes positionally, so this is
 * what tells the decoder where `record_id` sits inside `AccessLogged`.
 */
export function idlStructFields(idl: AuditIdl, typeName: string): string[] {
  const type = idl.types.find((candidate) => candidate.name === typeName);
  const fields = type?.type?.fields;
  if (!fields) {
    throw new Error(`Unknown IDL type: ${typeName}`);
  }
  return fields.map((field) => field.name);
}

/** PDA seeds for the one global trail. Contract §1. */
export const TRAIL_SEED = "audit_trail";

/** Total account size: 8 discriminator + 1 + 32 + 32 + 8 + 1 = 82. */
export const AUDIT_TRAIL_LEN = 82;

/**
 * Discriminators are `sha256("<namespace>:<name>")[0..8]`, computed rather than
 * pasted so they cannot be typo'd. Anchor's rule has not changed across 0.x.
 */
function discriminator(namespace: string, name: string): number[] {
  return [...createHash("sha256").update(`${namespace}:${name}`).digest().subarray(0, 8)];
}

function idlError(code: number, name: string, msg: string) {
  return { code, name, msg };
}

/** The frozen contract, transcribed. See the module comment. */
/** Placeholder address: 32 zero bytes. Replaced by `SOLANA_PROGRAM_ID`. */
export const CONTRACT_IDL: AuditIdl = {
  address: "11111111111111111111111111111111",
  metadata: { name: "healthaccess_audit", version: "0.1.0" },
  instructions: [
    {
      name: "initialize",
      discriminator: discriminator("global", "initialize"),
      args: [],
      accounts: [
        { name: "payer", writable: true, signer: true },
        { name: "trail", writable: true },
        { name: "system_program", address: SYSTEM_PROGRAM.toBase58() } as IdlInstructionAccount,
      ],
    },
    {
      name: "record_access",
      discriminator: discriminator("global", "record_access"),
      args: [
        { name: "event", type: { defined: { name: "AccessEventArg" } } },
        { name: "prev_hash", type: { array: ["u8", 32] } },
      ],
      accounts: [
        { name: "authority", writable: true, signer: true },
        { name: "trail", writable: true },
        { name: "system_program", address: SYSTEM_PROGRAM.toBase58() } as IdlInstructionAccount,
      ],
    },
  ],
  accounts: [{ name: "AuditTrail", discriminator: discriminator("account", "AuditTrail") }],
  events: [{ name: "AccessLogged", discriminator: discriminator("event", "AccessLogged") }],
  types: [
    { name: "AccessEventArg" },
    {
      name: "AccessLogged",
      type: {
        kind: "struct",
        fields: [
          { name: "seq", type: "u64" },
          { name: "head_hash", type: { array: ["u8", 32] } },
          { name: "action", type: "u8" },
          { name: "role", type: "u8" },
          { name: "record_id", type: "i64" },
          { name: "server", type: "u8" },
          { name: "timestamp", type: "i64" },
        ],
      },
    },
  ],
  errors: [
    idlError(6000, "Unauthorized", "unauthorized signer"),
    idlError(6001, "ChainBroken", "previous hash does not match chain head"),
    idlError(6002, "AccountAlreadyInitialized", "audit trail already initialized"),
  ],
};

/**
 * Where to look for the committed IDL, in order.
 *
 * `SOLANA_IDL_PATH` lets a developer point at a build without copying anything;
 * the sibling Rust clone is the documented in-place source.
 */
export function idlCandidates(): string[] {
  const configured = process.env.SOLANA_IDL_PATH;
  return [
    ...(configured ? [resolve(configured)] : []),
    join(process.cwd(), "target", "idl", "healthaccess_audit.json"),
    // Where the Rust clone actually commits its IDL. It moved out of target/
    // so the artifact is reviewable, and the plural directory is the in-flight
    // copy during a rebuild. Both are read-only to this repo.
    join(process.cwd(), "..", "ha-solana", "idl", "healthaccess_audit.json"),
    join(process.cwd(), "..", "ha-solana", "idls", "healthaccess_audit.json"),
    join(homedir(), "Skola", "ha-solana", "idl", "healthaccess_audit.json"),
    join(homedir(), "Skola", "ha-solana", "idls", "healthaccess_audit.json"),
    join(homedir(), "Skola", "ha-solana", "target", "idl", "healthaccess_audit.json"),
  ];
}

/** True when a real Anchor build output exists to read. */
export function hasCommittedIdl(): boolean {
  return idlCandidates().some((path) => existsSync(path));
}

/**
 * Load the committed IDL, or fall back to the frozen contract.
 *
 * Never throws: a missing or unparseable build must not stop the app from
 * serving the off-chain audit view, which is still useful without devnet.
 */
export function loadIdl(): AuditIdl {
  for (const path of idlCandidates()) {
    try {
      if (!existsSync(path)) {
        continue;
      }
      const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<AuditIdl>;
      if (!Array.isArray(parsed.instructions) || !Array.isArray(parsed.accounts)) {
        continue;
      }
      return { ...CONTRACT_IDL, ...parsed, metadata: parsed.metadata ?? CONTRACT_IDL.metadata };
    } catch {
      // A half-written IDL from a concurrent `anchor build` is not fatal here.
      continue;
    }
  }
  return CONTRACT_IDL;
}

/** The 8-byte Anchor discriminator for an instruction, as a hex string. */
export function instructionDiscriminator(idl: AuditIdl, name: string): Uint8Array {
  const instruction = idl.instructions.find((candidate) => candidate.name === name);
  if (!instruction) {
    throw new Error(`Unknown instruction: ${name}`);
  }
  return Uint8Array.from(instruction.discriminator);
}

/** The 8-byte Anchor discriminator for an account, as a hex string. */
export function accountDiscriminator(idl: AuditIdl, name: string): Uint8Array {
  const account = idl.accounts.find((candidate) => candidate.name === name);
  if (!account) {
    throw new Error(`Unknown account: ${name}`);
  }
  return Uint8Array.from(account.discriminator);
}
