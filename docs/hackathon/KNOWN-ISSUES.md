# Known Issues

## LiteSVM integration tests blocked (task 29)

The LiteSVM suite is written but does not run. The tests exist in the working
copy; they are not committed because shipping a suite that fails on `cargo test`
is worse than shipping none.

### The blocker

Three Solana toolchain versions collide:

| Component | Wants | Ships / provides |
|---|---|---|
| `cargo-build-sbf` (platform-tools v1.57) | SBPFv3 | SBPFv3 |
| `litesvm` 0.11 (via `anchor-litesvm` 0.4) | SBPFv2 | rejects SBPFv3 |
| platform-tools v1.48 (`--arch v0`) | SBPFv2 | rustc too old for this workspace |

`LiteSVM::add_program` returns `InvalidAccountData` when handed an SBPFv3 ELF.
The error names a program-account problem, not a format problem, so it costs
time to diagnose.

### Options, none cheap

1. **Downgrade `anchor-litesvm`.** Its dependency graph pins `litesvm` 0.11.
   Downgrading risks the same class of field-level compile errors seen with
   litesvm 0.15.
2. **Use `litesvm` 0.18+ directly**, without `anchor-litesvm`. Supports newer
   SBPF but means hand-rolling instruction construction: discriminators, account
   metas, and `InstructionData` wiring, roughly 60 lines of helper code.
3. **Wait for `anchor-litesvm` to update.** Out of our control.
4. **Test against the local validator instead of LiteSVM.** The validator is
   already running and the program is already deployed, so the pragmatic option
   is to exercise it end to end from the app side rather than from Rust.

### Recommendation

Option 4, or defer. The value of these tests is proving the deployed program
enforces the same rules as the pure model. That is demonstrable against the
local validator just as well, and the app side needs an integration path
anyway for task 30.

Do not spend more time on the LiteSVM version matrix before the submission.

## Other open items

- **Devnet SOL.** Airdrop rate-limited; a retry loop runs in the background.
  Devnet deploy (task 28) needs it for the public explorer link in the demo.
  Localnet deploy already works and is not blocked.
- **`anchor build` does not forward cargo features.** Use
  `anchor build -- --features anchor`, or the program macro layer is compiled
  out and IDL generation fails with `IDL doesn't exist`.
- **Program keypair is not in the repo, so the address is not reproducible.**
  `keys/` is gitignored by design (a public repo must not leak spend
  authority), which means a fresh clone cannot regenerate the exact program
  address: `anchor build` would mint a new keypair and deploy to a different
  address than the committed `declare_id!`. The committed IDL and the
  `declare_id_matches_committed_idl()` guard keep the *binary* honest; only the
  original `keys/<program>-keypair.json` (held out-of-repo, mode 600) can sign a
  redeploy to the same address. Back that file up; losing it loses the address.
- **`declare_program!` history (fixed).** An earlier revision used
  `declare_program!(healthaccess_audit)` instead of a `#[program]` block. In
  Anchor 1.2 that macro generates `accounts::*`/`instruction::*` client types
  from the IDL but NO on-chain entrypoint, so the build produced a 544-byte
  `.so` with an empty dynamic-symbol table — deploy accepted it, every
  instruction then failed. Reverted to the `#[program]` block (rev that removed
  it: 7a0e5c7); the integration tests in this repo hand-roll instructions from
  the pure layer, and the TS client consumes the committed IDL, so nothing
  depended on the generated client types.
- **Trail authority is not rotatable on-chain.** `initialize` fixes
  `authority` to the deploying `payer`; there is no rotation instruction, so a
  lost devnet keypair means a fresh deploy + new audit trail. Accepted for the
  demo; noted so it is not mistaken for a shipped feature.