# MORTIS review

## 1) Scope and verdict

- Repo: **MORTIS**
- Pinned SHA: **180bc4a4222b0601bbd7bc08dd1939c9371a9734**
- Stage: **implementation** with prototype/stub pockets in the CLI surface
- Runtime: **NOT RUN**

Sampled paths and ranges:
- `README.md` lines 1-140
- `docs/SECURITY.md` lines 1-180
- `docs/DEPLOYMENT.md` lines 1-140
- `crates/mortis-cli/src/main.rs` lines 1-714
- `crates/mortis-core/src/orchestrator.rs` lines 1-260
- `crates/mortis-crypto/src/receipt_engine.rs` lines 1-220
- `crates/mortis-db/src/inventory.rs` lines 1-122

Uninspected boundaries:
- `crates/mortis-core/src/passphrase.rs`, `plan.rs`, `triggers.rs`
- the rest of `crates/mortis-db/*`, `crates/mortis-crypto/*`, `crates/mortis-types/*`
- `.github/workflows/ci.yml` log details beyond snapshot metadata
- the nested `complete-mortis-system-implementation/` app beyond its package metadata

Verdict: the main CLI/orchestrator path exists and is internally coherent, but the repo still has a few high-signal gaps where the CLI advertises stateful security behavior that is not actually durable or fail-closed yet.

## 2) Architecture and product boundary

Actual entry path:
`main()` → `run()` → `cmd_run` / `cmd_config` / `cmd_receipt` / `cmd_trigger` / `cmd_self_check` in `crates/mortis-cli/src/main.rs:151-714`.

Main destructive path:
`cmd_run()` opens the encrypted DB, verifies the passphrase interlock, loads inventory rows, and calls `Orchestrator::execute_run()`; the orchestrator then signs a receipt through `ReceiptEngine` and persists it back to disk/DB (`crates/mortis-cli/src/main.rs:234-363`, `crates/mortis-core/src/orchestrator.rs:95-176`, `crates/mortis-crypto/src/receipt_engine.rs:33-133`).

Boundary note: the nested React/Vite folder is a separate artifact. I did not treat it as the live MORTIS product path.

## 3) Findings ledger

### MORTIS-F1 — `config init` is not actually idempotent
- Severity: **medium**
- Status: **confirmed static**
- Evidence:
  - `crates/mortis-cli/src/main.rs:591-606` — `"Check if already initialized"` then `if mortis_db::config::get_config(&conn, "salt")?.is_some() { ... }`, but init never writes that key.
    - URL: https://github.com/knarayanareddy/MORTIS/blob/180bc4a4222b0601bbd7bc08dd1939c9371a9734/crates/mortis-cli/src/main.rs#L591-L606
  - same file `:598-605` — `"Store salt in external file"` and `set_config(..., "primary_key_hash", ...)`, but no `salt` config write.
    - URL: https://github.com/knarayanareddy/MORTIS/blob/180bc4a4222b0601bbd7bc08dd1939c9371a9734/crates/mortis-cli/src/main.rs#L598-L605
- Impact: the guard is wrong regardless of the downstream path. Because `open_database_encrypted` / schema-open behavior was not inspected here, the second-init consequence is only an unverified risk: it may fall through and mutate state, or it may fail earlier in a less clear way. Either way, the current check is not a reliable idempotency gate.
- Recommended correction: make init check the real on-disk state (`salt` file + DB bootstrap row + key material) before doing any writes, and return a hard “already initialized” path without mutating state.

### MORTIS-F2 — Receipt signing identity is ephemeral instead of durable
- Severity: **high**
- Status: **confirmed static**
- Evidence:
  - `crates/mortis-cli/src/main.rs:261-263` — `let kp = SigningKeyPair::generate();` inside `cmd_run`.
    - URL: https://github.com/knarayanareddy/MORTIS/blob/180bc4a4222b0601bbd7bc08dd1939c9371a9734/crates/mortis-cli/src/main.rs#L261-L263
  - `docs/SECURITY.md:61-63` says receipt signing keys are generated at config init and used for Ed25519 receipt signing.
    - URL: https://github.com/knarayanareddy/MORTIS/blob/180bc4a4222b0601bbd7bc08dd1939c9371a9734/docs/SECURITY.md#L61-L63
- Impact: the run path creates a fresh signing keypair every execution, but the inspected code path never persists that keypair or its public key. That means the verification story depends on some out-of-band file/state not shown in the live path, and the product promise of stable cryptographic accountability is not enforced by the actual entry path.
- Recommended correction: load a persisted keypair or trusted public key from a defined store, and fail the run if the trust root is absent.

### MORTIS-F3 — `receipt verify` fails open when the public key is missing
- Severity: **medium**
- Status: **confirmed static**
- Evidence:
  - `crates/mortis-cli/src/main.rs:454-459` — if `signing_key.pub` is absent, the command prints `"signed: yes (unverified)"` and returns `ExitCode::Ok`.
    - URL: https://github.com/knarayanareddy/MORTIS/blob/180bc4a4222b0601bbd7bc08dd1939c9371a9734/crates/mortis-cli/src/main.rs#L454-L459
  - `crates/mortis-crypto/src/receipt_engine.rs:111-132` only performs real verification once a public key is supplied.
    - URL: https://github.com/knarayanareddy/MORTIS/blob/180bc4a4222b0601bbd7bc08dd1939c9371a9734/crates/mortis-crypto/src/receipt_engine.rs#L111-L132
- Impact: the verification command reports success even when it could not verify anything. That is a misleading security result, not a safe degraded mode.
- Recommended correction: when no key is available, return a distinct failure/unknown code and make the CLI text explicit that verification was not performed.

### MORTIS-F4 — Trigger management commands are stubs
- Severity: **low/medium**
- Status: **confirmed static**
- Evidence:
  - `crates/mortis-cli/src/main.rs:555-572` — `List`, `Disable`, and `Enable` just print strings like `"no triggers configured"` / `"disabled:"` / `"enabled:"` and return success.
    - URL: https://github.com/knarayanareddy/MORTIS/blob/180bc4a4222b0601bbd7bc08dd1939c9371a9734/crates/mortis-cli/src/main.rs#L555-L572
- Impact: the product exposes trigger controls, but there is no persisted trigger state or observable side effect in the audited path. That makes the CLI look more complete than it is.
- Recommended correction: back the trigger commands with real state and wire them into the run path before keeping them in the public CLI surface.

## 4) Five-discipline assessment

- **Correctness/code review:** the run path is readable and modular, but the init guard, verification fallback, and trigger commands are all behaviorally wrong relative to their names.
- **Automation/testing:** there are tests in `orchestrator.rs` and `receipt_engine.rs`, but none of the sampled tests cover the broken init guard, missing-key verification fallback, or trigger persistence path. That leaves the highest-risk user-visible branches under-tested.
- **DevOps/operations:** the repo has a deployment guide and release scripts, but the live code path still depends on a local trust root decision that is not operationally closed yet. Release hygiene should wait for that decision.
- **OWASP/security:** fail-open verification plus ephemeral signing identity undercut the stated tamper-evidence model in `docs/SECURITY.md`.
- **UI/UX/accessibility:** this audited path is CLI-first, so the relevant UX issue is terminal clarity, not web accessibility. `"signed: yes (unverified)"` and trigger commands that print success without doing anything are misleading operator feedback.

## 5) Production blockers and owner questions

1. Where should the canonical signing key live: local file, DB row, OS keychain, or another trust store?
2. Should `receipt verify` ever return success when it could not verify the key? If yes, what exit code/text marks that state unambiguously?
3. What is the source of truth for trigger state, and should it survive restarts?
4. Should `config init` be strictly one-shot, or should it support repair/recovery flows?

## 6) Evidence inventory and limitations

Materialized snapshot samples under `evidence/MORTIS/numbered-sources/`:
- `README.md` lines 1-140
- `docs/SECURITY.md` lines 1-180
- `docs/DEPLOYMENT.md` lines 1-140
- `Cargo.toml` and crate manifests in the snapshot tree

Supplemental pinned-source reads via `gh api` (selected ranges, not full-file history):
- `crates/mortis-cli/src/main.rs` lines 1-714
- `crates/mortis-core/src/orchestrator.rs` lines 1-260
- `crates/mortis-crypto/src/receipt_engine.rs` lines 1-220
- `crates/mortis-db/src/inventory.rs` lines 1-122

Not run:
- no build, test, or runtime execution
- no shelling into the target repo
- no GitHub workflow log inspection beyond snapshot metadata
