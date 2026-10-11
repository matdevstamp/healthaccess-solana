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
- **`declare_program!` requires `idls/` at compile time.** The directory is
  committed, so a clean clone builds. Renaming or moving it breaks the build
  with an unhelpful `idls directory not found`.
- **`anchor build` does not forward cargo features.** Use
  `anchor build -- --features anchor`, or the program macro layer is compiled
  out and IDL generation fails with `IDL doesn't exist`.