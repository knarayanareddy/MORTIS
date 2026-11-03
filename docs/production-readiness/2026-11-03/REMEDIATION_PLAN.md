# MORTIS remediation plan

## Phase 0 — baseline and scope lock

Entry criteria: the findings ledger is accepted as the current baseline; no one is assuming runtime behavior beyond the audited paths.

Exit criteria: the signing-key model, trigger-state model, and init semantics have owner decisions or explicit placeholders.

## Phase 1 — fix the security identity path

Goal: make receipt signing and verification use one durable trust root.

- **T1 — Persist and reuse the signing keypair**
  - Linked finding: **MORTIS-F2**
  - Prerequisites: owner decision on key location; no schema migration blocked.
  - Observed/proposed path: `crates/mortis-cli/src/main.rs`, `crates/mortis-crypto/src/receipt_engine.rs`.
  - Steps:
    1. Define one canonical storage path for the signing keypair or public key, and write it during init/rotation.
    2. Replace `SigningKeyPair::generate()` in the run path with load-or-error logic against that store.
    3. Preserve read compatibility for older receipts and any existing key files while the new store is rolled out.
  - Expected deliverable: a stable signing identity that survives multiple runs.
  - Verification:
    - planned unit/integration test that two runs on the same install produce the same public key ID
    - planned negative test that an install with no key material refuses to sign
  - DoD:
    - [ ] no per-run key generation remains in the main run path
    - [ ] the signing key can be found or the command fails clearly
    - [ ] receipts still verify after a restart

- **T2 — Fail closed when verification cannot actually verify**
  - Linked finding: **MORTIS-F3**
  - Prerequisites: T1 design decision on the trust root.
  - Observed/proposed path: `crates/mortis-cli/src/main.rs`, `crates/mortis-crypto/src/receipt_engine.rs`.
  - Steps:
    1. Replace the missing-key fallback with an explicit verification failure/unknown code.
    2. Make stdout/stderr wording match the exit code so operators do not read success as proof.
    3. Add a real “verified” state and keep “unverified” separate from success.
  - Expected deliverable: `receipt verify` stops claiming success when it did not verify anything.
  - Verification:
    - planned negative test where the public key is absent and the command returns failure
    - planned positive test where a valid key verifies a known receipt
  - DoD:
    - [ ] missing key material never returns a success code
    - [ ] verified and unverified states are distinguishable in output
    - [ ] tamper detection still returns a tampered result

## Phase 2 — make stateful setup real

Goal: make initialization and trigger controls behave like stateful commands, not placeholders.

- **T3 — Make `config init` truly one-shot and recoverable**
  - Linked finding: **MORTIS-F1**
  - Prerequisites: confirm the actual second-init failure mode, then decide whether init is strict one-shot or a repair flow.
  - Observed/proposed path: `crates/mortis-cli/src/main.rs`, plus any schema/metadata path needed for the init marker.
  - Steps:
    1. Replace the current `config["salt"]` guard with a real bootstrap check on the salt file, DB bootstrap row, and key material.
    2. Confirm whether the current path reaches mutation or fails earlier, then make the chosen second-init branch explicit.
    3. Add a recovery path that repairs missing metadata without changing established encryption state, if the owner wants repair behavior.
  - Expected deliverable: repeated init calls are either blocked cleanly or repaired without changing encryption state.
  - Verification:
    - planned test that a second init does not rewrite salt or keys, with the exact exit/status aligned to the chosen bootstrap model
    - planned negative test that deleting the guard causes the test to fail
  - DoD:
    - [ ] init is idempotent on an already initialized install
    - [ ] no existing DB gets re-keyed by accident
    - [ ] recovery behavior is documented if supported

- **T4 — Implement persisted trigger state**
  - Linked finding: **MORTIS-F4**
  - Prerequisites: storage model chosen for triggers.
  - Observed/proposed path: `crates/mortis-cli/src/main.rs` now; proposed durable helpers in `crates/mortis-core/src/triggers.rs` or a new persistence module.
  - Steps:
    1. Add a trigger-state representation that can be listed, enabled, disabled, and persisted.
    2. Wire `TriggerCmd::List`, `Disable`, and `Enable` to that store instead of printing placeholder text.
    3. Make the run path consult the stored trigger state before execution.
  - Expected deliverable: trigger commands have an observable side effect and survive restart.
  - Verification:
    - planned test that disable/enable changes persisted state
    - planned test that list reflects the stored state after a restart
  - DoD:
    - [ ] trigger commands no longer return fake success
    - [ ] state survives process restart
    - [ ] the run path reads the same source of truth as the CLI

## Phase 3 — regression coverage and release hygiene

Goal: prevent the same class of bug from reappearing.

- **T5 — Add regression tests for the broken trust and setup paths**
  - Linked requirement: prevent recurrence of **MORTIS-F1..F4**.
  - Prerequisites: T1-T4 changes are staged.
  - Observed/proposed path: `tests/e2e.rs`, `tests/backward_compat.rs`, and the module tests already present in `crates/mortis-core/src/orchestrator.rs` and `crates/mortis-crypto/src/receipt_engine.rs`.
  - Steps:
    1. Add one negative test per fixed behavior: bad init guard, missing key verify, ephemeral-key regression, and trigger-state regression.
    2. Add one end-to-end happy-path test that exercises init → add inventory → run → verify with the new trust root.
    3. Keep the tests deliberately brittle against the old broken behavior so they fail when the bug returns.
  - Expected deliverable: a minimal test suite that proves the fixes are real.
  - Verification:
    - planned `cargo test` and targeted test runs after each change
    - planned negative runs by temporarily breaking the guarded behavior in a scratch branch
  - DoD:
    - [ ] each fixed bug has a failing-when-broken test
    - [ ] no mirror test only checks the happy path
    - [ ] backward-compatibility coverage exists for receipts and keys

## Dependency map

| Task | Depends on | Notes |
|---|---|---|
| T1 | owner decision | key store location must be chosen first |
| T2 | T1 | verification semantics should match the new trust root |
| T3 | owner decision | strict one-shot vs repair flow |
| T4 | owner decision | trigger schema/store choice |
| T5 | T1-T4 | regression coverage comes last |

## Production acceptance checklist

- `config init` is idempotent and safe to repeat.
- Run/sign/verify all share one durable trust root.
- `receipt verify` fails closed when verification cannot happen.
- Trigger controls persist state and survive restart.
- Negative tests fail when the old broken behavior is reintroduced.
- Existing release scripts remain usable: `scripts/build-reproducible.sh`, `scripts/generate-sbom.sh`, `scripts/sign-release.sh`.

## Changes that require owner approval

- any new on-disk key location or key-format change
- any change to receipt verification exit codes or message semantics
- any persisted trigger schema or destructive trigger default
- any migration that can invalidate old installs without a rollback path

## Rollback and release policy

- Keep read compatibility for old receipts and old key material for at least one release line.
- Make new writes additive first; do not remove old reads until the new release has been proven.
- If a migration cannot be reversed, block the release instead of forcing a downgrade-path guess.
- Roll back by restoring the previous binary first; do not rewrite on-disk state during rollback unless the migration has an explicit reverse step.
