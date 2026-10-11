import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ACCESS_LOGGED_LEN } from "@/lib/solana/events";
import { idlCandidates, idlInstruction, idlStructFields, loadIdl } from "@/lib/solana/idl";
import { recordAccessInstruction } from "@/lib/solana/program";
import { PublicKey } from "@solana/web3.js";

const PROGRAM = new PublicKey("11111111111111111111111111111111");
const AUTHORITY = new PublicKey("SysvarC1ock11111111111111111111111111111111");

/**
 * Cross-check the client against the *committed* IDL from the Rust clone.
 *
 * Every other test in this suite checks the client against my own
 * understanding. That is exactly the wrong thing to do when two agents are
 * building against a frozen contract in parallel: a shared misunderstanding
 * type-checks and unit-tests perfectly on both sides and still fails on the
 * cluster, on demo day, with nothing local to debug.
 *
 * So these read the real artifact. When the Rust clone is absent the whole
 * suite skips rather than passing vacuously — a green that proves nothing is
 * worse than a skip that says so.
 */

function findCommittedIdl(): string | null {
  return idlCandidates().find((path) => existsSync(path)) ?? null;
}

const idlPath = findCommittedIdl();
const describeIfIdl = idlPath ? describe : describe.skip;

if (!idlPath) {
  console.warn(
    `[solana] No committed IDL found; cross-check skipped. Looked in:\n  ${idlCandidates().join("\n  ")}`,
  );
}

describeIfIdl("client vs the committed IDL", () => {
  const raw = JSON.parse(readFileSync(idlPath as string, "utf8")) as Record<string, unknown>;
  const idl = loadIdl();

  it("is reading the committed build, not the contract fallback", () => {
    expect(raw).toBeDefined();
    // The fallback has no address; a real build always does.
    expect(String(raw.address)).not.toBe("11111111111111111111111111111111");
  });

  it("agrees on every instruction discriminator", () => {
    for (const instruction of raw.instructions as { name: string; discriminator: number[] }[]) {
      expect(idlInstruction(idl, instruction.name).discriminator).toEqual(
        instruction.discriminator,
      );
    }
  });

  it("agrees on the AuditTrail account discriminator", () => {
    const account = (raw.accounts as { name: string; discriminator: number[] }[])[0];

    expect(
      idl.accounts.find((candidate) => candidate.name === account?.name)?.discriminator,
    ).toEqual(account?.discriminator);
  });

  it("agrees on the AccessLogged event discriminator", () => {
    const event = (raw.events as { name: string; discriminator: number[] }[])[0];

    expect(idl.events.find((candidate) => candidate.name === event?.name)?.discriminator).toEqual(
      event?.discriminator,
    );
  });

  it("agrees on the emitted AccessLogged field order, and its byte length", () => {
    // Read the raw artifact, not our own view of it — comparing the client to
    // the client would pass no matter what.
    const committed = (
      raw.types as { name: string; type?: { fields?: { name: string }[] } }[]
    ).find((type) => type.name === "AccessLogged");
    const committedFields = committed?.type?.fields?.map((field) => field.name) ?? [];

    expect(committedFields).toEqual([
      "seq",
      "head_hash",
      "action",
      "role",
      "record_id",
      "server",
      "timestamp",
    ]);
    expect(idlStructFields(idl, "AccessLogged")).toEqual(committedFields);

    // 8 + 32 + 1 + 1 + 8 + 1 + 8
    expect(ACCESS_LOGGED_LEN).toBe(59);
  });

  it("keeps the patient and actor hashes out of the emitted event", () => {
    const committed = (
      raw.types as { name: string; type?: { fields?: { name: string }[] } }[]
    ).find((type) => type.name === "AccessLogged");
    const fields = committed?.type?.fields?.map((field) => field.name) ?? [];

    // A privacy decision made on the Rust side. Asserted here so a future
    // change to it cannot land silently in the client.
    expect(fields).not.toContain("patient_hash");
    expect(fields).not.toContain("actor_hash");
  });

  it("still takes the hashes on the instruction argument", () => {
    const committed = (
      raw.types as { name: string; type?: { fields?: { name: string }[] } }[]
    ).find((type) => type.name === "AccessEventArg");
    const fields = committed?.type?.fields?.map((field) => field.name) ?? [];

    expect(fields).toEqual([
      "patient_hash",
      "actor_hash",
      "action",
      "role",
      "record_id",
      "server",
      "timestamp",
    ]);
  });

  it("supplies every account record_access declares, in order", () => {
    const declared = idlInstruction(idl, "record_access").accounts.map((account) => account.name);
    const instruction = recordAccessInstruction({
      event: {
        patientHash: new Uint8Array(32),
        actorHash: new Uint8Array(32),
        action: 0,
        role: 0,
        recordId: 1n,
        server: 0,
        timestamp: 1n,
      },
      prevHash: new Uint8Array(32),
      authority: AUTHORITY,
      id: PROGRAM,
    });

    // Positional resolution: a short list is not a type error, it is a
    // transaction the cluster rejects at simulation time.
    expect(instruction.keys).toHaveLength(declared.length);
    expect(instruction.keys[0]?.isSigner).toBe(true);
    expect(instruction.keys[1]?.isWritable).toBe(true);
  });

  it("agrees on the trail PDA seed", () => {
    const declared = idlInstruction(idl, "record_access").accounts.find(
      (account) => account.name === "trail",
    );
    const seed = declared?.pda?.seeds[0]?.value;

    expect(Buffer.from(seed as number[]).toString("utf8")).toBe("audit_trail");
  });

  it("agrees on the program error codes the retry classifier matches", () => {
    const errors = raw.errors as { code: number; name: string }[];

    expect(errors.map((error) => error.code).sort()).toEqual([6000, 6001, 6002]);
    expect(errors.find((error) => error.code === 6001)?.name).toBe("ChainBroken");
  });

  it("agrees on the program address the IDL was built for", () => {
    expect(String(raw.address)).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(() => new PublicKey(String(raw.address))).not.toThrow();
  });
});
