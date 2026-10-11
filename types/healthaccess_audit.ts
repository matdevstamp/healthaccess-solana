/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/healthaccess_audit.json`.
 */
export type HealthaccessAudit = {
  address: "Co2EarRRbhBbisT1dcVoeYuNNs3fuRR1zFdyRd3ewxrE";
  metadata: {
    name: "healthaccessAudit";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Tamper-evident access-log commitment for HealthAccess on Solana";
  };
  instructions: [
    {
      name: "initialize";
      docs: ["Create the audit trail. Idempotent-guarded by the `init` constraint."];
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "trail";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [97, 117, 100, 105, 116, 95, 116, 114, 97, 105, 108];
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "recordAccess";
      docs: [
        "Append one access event to the chain.",
        "",
        "`prev_hash` must equal the current head. On a mismatch the transaction",
        "fails with `ChainBroken` and the caller re-reads the head and retries.",
      ];
      discriminator: [64, 187, 29, 123, 147, 64, 218, 100];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
          relations: ["trail"];
        },
        {
          name: "trail";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [97, 117, 100, 105, 116, 95, 116, 114, 97, 105, 108];
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "event";
          type: {
            defined: {
              name: "accessEventArg";
            };
          };
        },
        {
          name: "prevHash";
          type: {
            array: ["u8", 32];
          };
        },
      ];
    },
  ];
  accounts: [
    {
      name: "auditTrail";
      discriminator: [171, 223, 253, 181, 134, 88, 66, 26];
    },
  ];
  events: [
    {
      name: "accessLogged";
      discriminator: [243, 53, 225, 71, 64, 120, 109, 25];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "unauthorized";
      msg: "unauthorized signer";
    },
    {
      code: 6001;
      name: "chainBroken";
      msg: "previous hash does not match chain head";
    },
    {
      code: 6002;
      name: "accountAlreadyInitialized";
      msg: "audit trail already initialized";
    },
  ];
  types: [
    {
      name: "accessEventArg";
      docs: [
        "Anchor-facing wrapper. Not the hash input.",
        "",
        "Anchor needs Borsh to deserialize instruction arguments, but the hash must",
        "use [`AccessEvent::canonical_bytes`] so the TypeScript client and this",
        "program agree byte for byte. Both encodings are pinned by a test, so the",
        "shim cannot silently drift from the canonical layout.",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "patientHash";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "actorHash";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "action";
            type: "u8";
          },
          {
            name: "role";
            type: "u8";
          },
          {
            name: "recordId";
            type: "i64";
          },
          {
            name: "server";
            type: "u8";
          },
          {
            name: "timestamp";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "accessLogged";
      docs: ["Emit on every anchored access event so the mirror can be rebuilt off-chain."];
      type: {
        kind: "struct";
        fields: [
          {
            name: "seq";
            type: "u64";
          },
          {
            name: "headHash";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "action";
            type: "u8";
          },
          {
            name: "role";
            type: "u8";
          },
          {
            name: "recordId";
            type: "i64";
          },
          {
            name: "server";
            type: "u8";
          },
          {
            name: "timestamp";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "auditTrail";
      docs: [
        "The on-chain access-log entry. Fixed 83-byte layout.",
        "",
        "Privacy boundary: no names, no dates of birth, no personal numbers, and no",
        "note content. Patient and actor are salted hashes computed off-chain, so the",
        "chain holds pseudonymous accountability rather than linkable identity.",
        "",
        "The account type itself lives in `crate::state`, which is pure and does not",
        "import `anchor_lang`. This wrapper only adds the Anchor derive that gives us",
        "`InitSpace` and the 8-byte discriminator.",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "version";
            docs: ["Account layout version, so a future migration is detectable."];
            type: "u8";
          },
          {
            name: "authority";
            docs: ["The organization allowed to append. Only this key may write."];
            type: "pubkey";
          },
          {
            name: "headHash";
            docs: [
              "Rolling commitment over the access log. Chained, so a dropped or edited",
              "entry changes it and is detectable.",
            ];
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "eventCount";
            docs: ["Monotonic count of anchored entries."];
            type: "u64";
          },
          {
            name: "bump";
            docs: ["Canonical bump, stored to avoid recomputing on every access."];
            type: "u8";
          },
        ];
      };
    },
  ];
  constants: [
    {
      name: "accountVersion";
      type: "u8";
      value: "1";
    },
    {
      name: "auditTrailSeed";
      docs: [
        "Single global trail. Per-organization trails would multiply accounts and",
        "contention analysis for no demonstration benefit.",
      ];
      type: "bytes";
      value: "[97, 117, 100, 105, 116, 95, 116, 114, 97, 105, 108]";
    },
  ];
};
