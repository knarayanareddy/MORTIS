# MORTIS

**Machine-Operated Responsive Total Infrastructure Sanitizer**

A local-first, user-controlled data sanitization and remote revocation system written in Rust.

MORTIS executes pre-planned, cryptographically evidenced destruction of sensitive digital assets — local files, database records, browser state, and cloud-accessible accounts — in response to configurable triggers. Every run produces a tamper-evident, Ed25519-signed receipt.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Architecture](#architecture)
- [CLI Reference](#cli-reference)
- [Configuration](#configuration)
- [Plans](#plans)
- [Triggers](#triggers)
- [Receipts](#receipts)
- [Security Model](#security-model)
- [Runbooks](#runbooks)
- [Development](#development)
- [Spec Compliance](#spec-compliance)
- [License](#license)

---

## Quick Start

```bash
# 1. Install
cargo install --path crates/mortis-cli

# 2. Initialize (creates encrypted database)
mortis config init
# Enter a strong passphrase when prompted

# 3. Add assets to inventory
mortis inventory add --type local_file --path /path/to/secret.txt --label "Secret Doc"
mortis inventory add --type local_dir  --path /path/to/secrets/ --label "Secret Dir"

# 4. Create a destruction plan (see Plans section)
cat > emergency.toml << 'EOF'
[plan]
name = "emergency_wipe"
description = "Emergency data destruction"

[[phases]]
phase_type = "sanitize_local"
asset_ids = ["<paste-uuid-from-step-3>"]
continue_on_failure = true
EOF

# 5. Preview (dry-run — no mutations)
mortis run --plan emergency.toml --dry-run

# 6. Execute
mortis run --plan emergency.toml

# 7. Verify receipt
mortis receipt list
mortis receipt inspect --run-id <run-id>
```

---

## Installation

### From Source

```bash
git clone https://github.com/knarayanareddy/MORTIS.git
cd MORTIS
cargo build --release
# Binary at target/release/mortis
```

### Requirements

- **Rust** 1.75.0+ (stable)
- **Platform:** Linux (x86_64, aarch64), macOS (x86_64, Apple Silicon), Windows (x86_64)
- **No runtime dependencies** for local-only operations

### Verify Installation

```bash
mortis self-check
```

Expected output:
```
MORTIS Self-Check v0.1.0
=========================================
passphrase_init: 343ms ✅
passphrase_verify: 343ms ✅
receipt_sign: 0ms ✅
receipt_verify: 0ms ✅
=========================================
all SLOs met ✅
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER / OPERATOR                         │
│              (CLI, config files, trigger signals)               │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MORTIS PROCESS                           │
│                                                                 │
│  ┌──────────────┐  ┌─────────────────────────────────────────┐ │
│  │   CLI Layer   │  │            Core Engine                  │ │
│  │    (clap)     │→ │  ┌──────────────┐  ┌─────────────────┐ │ │
│  └──────────────┘  │  │TriggerManager│  │  Orchestrator    │ │ │
│                    │  └──────────────┘  │  (phase runner)  │ │ │
│                    │  ┌──────────────────────────────────┐  │ │ │
│                    │  │    PassphraseInterlock            │  │ │ │
│                    │  │    (gates all destructive ops)    │  │ │ │
│                    │  └──────────────────────────────────┘  │ │ │
│                    └─────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     Plugin Layer                            ││
│  │  SanitizationPlugin   DeletionPlugin   InventoryConnector  ││
│  │  (NIST SP 800-88)     (remote revoke)   (asset discovery)  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   Persistence Layer                          ││
│  │         SQLCipher (AES-256-CBC encrypted SQLite)             ││
│  │    Inventory │ Receipts │ Credentials │ Config │ Metrics    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Crypto Engine                             ││
│  │  Ed25519 signing │ SHA-256 hashing │ PBKDF2 key derivation  ││
│  │  AES-256-GCM     │ RFC 3161 TSA    │ zeroize on drop        ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Crate Structure

| Crate | Purpose | Dependencies |
|-------|---------|-------------|
| `mortis-types` | Shared types, zero internal deps | serde, chrono, uuid |
| `mortis-crypto` | Ed25519, SHA-256, PBKDF2, AES-256-GCM, RFC 3161 | ring, ed25519-dalek, aes-gcm |
| `mortis-plugins` | Plugin traits + built-in sanitization/deletion | async-trait, walkdir |
| `mortis-db` | SQLCipher persistence, Appendix A schema | rusqlite (bundled-sqlcipher) |
| `mortis-core` | Orchestrator, passphrase interlock, triggers, scrubbing | mortis-crypto, mortis-plugins |
| `mortis-cli` | CLI binary, secure input, SLO benchmarks | clap, rpassword, zeroize |

### Phase Choreography

When a trigger fires, MORTIS executes phases in this order:

```
TRIGGER FIRED
│
├─→ [1] PassphraseInterlock.verify()
│     fail ──→ ABORT (exit 2)
│
├─→ [2] InventoryDB.load_plan()
│     fail ──→ ABORT (exit 3)
│
├─→ [3] Orchestrator.begin_run(plan, dry_run)
│     │
│     ├─→ Phase: Revoke remote accounts (DeletionPlugins)
│     │     partial fail ──→ log + tag receipt + CONTINUE
│     │
│     ├─→ Phase: Sanitize local assets (SanitizationPlugins)
│     │     partial fail ──→ log + tag receipt + CONTINUE
│     │
│     ├─→ Phase: Clear browser state (BrowserStatePlugin)
│     │     partial fail ──→ log + tag receipt + CONTINUE
│     │
│     ├─→ Phase: Wipe DB records
│     │     partial fail ──→ log + tag receipt + CONTINUE
│     │
│     └─→ Phase: Self-destruct config (optional)
│           partial fail ──→ log + tag receipt + CONTINUE
│
├─→ [4] ReceiptEngine.build_and_sign()
│
├─→ [5] ReceiptEngine.timestamp_via_rfc3161() [optional]
│
└─→ [6] Receipt persisted (DB + JSON file)
       EXIT (0=success, 1=partial, 2+=abort)
```

---

## CLI Reference

### Global Options

```
mortis [OPTIONS] <COMMAND>

Options:
      --db <DB>                    Database path [default: ~/.mortis/mortis.db]
      --passphrase-env <VAR>       Read passphrase from environment variable
  -v, --verbose                    Verbose output
      --log-level <LEVEL>          Log level: trace|debug|info|warn|error [default: info]
  -h, --help                       Print help
  -V, --version                    Print version
```

### Commands

#### `mortis config init`

Initialize MORTIS configuration. Creates encrypted database and salt file.

```bash
# Interactive
mortis config init

# Non-interactive (for scripts/CI)
mortis config init --passphrase-env MORTIS_PASS

# Custom database path
mortis --db /secure/path/mortis.db config init
```

**Creates:**
- `~/.mortis/mortis.db` — SQLCipher-encrypted database
- `~/.mortis/mortis.salt` — PBKDF2 salt (not secret, but required for decryption)

#### `mortis config rotate-key`

Re-encrypt the database with a new passphrase.

```bash
mortis config rotate-key
# Prompts for old and new passphrases

# Non-interactive
mortis config rotate-key --old-passphrase-env OLD --new-passphrase-env NEW
```

**What happens:**
1. Verifies old passphrase
2. Derives new encryption key
3. Executes `PRAGMA rekey` to re-encrypt the database
4. Updates salt file and interlock hash

#### `mortis inventory add`

Register a digital asset in the inventory.

```bash
mortis inventory add --type local_file --path /path/to/secret.txt --label "Secret"
mortis inventory add --type local_dir  --path /path/to/secrets/  --priority 90
mortis inventory add --type cloud_account --path "https://accounts.google.com" --label "Google"
```

**Asset types:** `local_file`, `local_dir`, `db_record`, `browser_profile`, `cloud_account`, `custom`

#### `mortis inventory list`

```bash
mortis inventory list              # Table format
mortis inventory list --format json  # JSON format
```

#### `mortis inventory remove`

```bash
mortis inventory remove --id <uuid>
mortis inventory remove --id <uuid> --force  # Skip confirmation
```

#### `mortis run`

Execute a destruction plan.

```bash
# Dry-run (no mutations)
mortis run --plan emergency.toml --dry-run

# Live execution
mortis run --plan emergency.toml

# Skip RFC 3161 timestamping
mortis run --plan emergency.toml --no-timestamp

# Non-interactive
mortis run --plan emergency.toml --passphrase-env MORTIS_PASS
```

**Exit codes:**
| Code | Meaning |
|------|---------|
| 0 | Full success |
| 1 | Partial success (some phases failed) |
| 2 | Passphrase verification failed |
| 3 | Plan load failed |

#### `mortis receipt verify`

Verify a receipt's cryptographic signature.

```bash
mortis receipt verify --receipt ~/.mortis/receipts/<run-id>.receipt.json
mortis receipt verify --receipt <path> --rfc3161  # Also verify timestamp
```

**Exit codes:**
| Code | Meaning |
|------|---------|
| 0 | Valid |
| 6 | Invalid (schema error) |
| 7 | Tampered (signature/hash mismatch) |

#### `mortis receipt list`

```bash
mortis receipt list          # Last 10
mortis receipt list --last 50
```

#### `mortis receipt inspect`

```bash
mortis receipt inspect --run-id <uuid>
```

#### `mortis receipt finalize`

Finalize an interrupted receipt (§Runbook 01).

```bash
mortis receipt finalize --run-id <uuid>
```

#### `mortis receipt export`

```bash
mortis receipt export --receipt <path> --format json
```

#### `mortis trigger test`

```bash
mortis trigger test --type manual --dry-run
mortis trigger test --type scheduled --dry-run
```

#### `mortis trigger list`

```bash
mortis trigger list
```

#### `mortis trigger disable / enable`

```bash
mortis trigger disable --type scheduled
mortis trigger enable  --type scheduled
```

#### `mortis self-check`

Run SLO benchmarks and integrity checks.

```bash
mortis self-check
```

---

## Configuration

### Database Location

Default: `~/.mortis/mortis.db`

Override with `--db` flag or `MORTIS_DB` environment variable.

### Files Created

```
~/.mortis/
├── mortis.db          # SQLCipher-encrypted database
├── mortis.salt        # PBKDF2 salt (32 bytes, base64-encoded)
├── receipts/          # Receipt JSON files
│   ├── <run-id-1>.receipt.json
│   └── <run-id-2>.receipt.json
└── logs/              # Log files (future)
    └── mortis.log
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `MORTIS_PASS` | Passphrase (use with `--passphrase-env`) |
| `MORTIS_DB` | Default database path |
| `RUST_LOG` | Log level override |

---

## Plans

Plans define what MORTIS does when triggered. They are TOML files with ordered phases.

### Plan Structure

```toml
[plan]
name = "emergency_wipe"
description = "Emergency data destruction plan"
is_default = false

# Phase 1: Revoke remote accounts
[[phases]]
phase_type = "revoke_remote"
asset_ids = ["<cloud-account-uuid>"]
continue_on_failure = true

# Phase 2: Sanitize local files
[[phases]]
phase_type = "sanitize_local"
asset_ids = ["<file-uuid-1>", "<file-uuid-2>"]
continue_on_failure = true

# Phase 3: Clear browser state
[[phases]]
phase_type = "clear_browser"
asset_ids = ["<browser-profile-uuid>"]
continue_on_failure = true

# Phase 4: Wipe database records
[[phases]]
phase_type = "wipe_db"
asset_ids = ["<db-record-uuid>"]
continue_on_failure = false  # Abort if this fails

# Phase 5: Self-destruct (optional)
[[phases]]
phase_type = "self_destruct"
asset_ids = []
continue_on_failure = true
```

### Phase Types

| Type | Description | Plugin Used |
|------|-------------|-------------|
| `revoke_remote` | Delete remote accounts/data | DeletionPlugins |
| `sanitize_local` | Overwrite and delete local files | FileOverwritePlugin, DirectorySanitizePlugin |
| `clear_browser` | Clear browser profiles | BrowserStatePlugin |
| `wipe_db` | Wipe database records | DatabaseRecordPlugin |
| `self_destruct` | Delete MORTIS config and database | Built-in |

### Sanitization Methods (NIST SP 800-88)

| Media Type | Method | Notes |
|------------|--------|-------|
| HDD (magnetic) | Overwrite (1-pass, random) | Multi-pass adds no benefit per NIST |
| SSD / NVMe | Cryptographic Erase | Overwrite unreliable due to wear leveling |
| eMMC / SD | Cryptographic Erase | Same as SSD |
| RAM disk / tmpfs | Overwrite (1-pass, zeros) | Ephemeral |
| Encrypted volume | Discard encryption key | Key discard = unrecoverable |
| Database records | Overwrite fields + VACUUM | Include WAL + journal |
| Browser profile | Delete + overwrite free space | Include Local Storage, IndexedDB, cookies |
| Cloud storage | API deletion (best-effort) | Cannot guarantee cloud erasure |

---

## Triggers

Triggers determine when MORTIS executes a plan.

### Trigger Types

| Type | Description | Configuration |
|------|-------------|---------------|
| `Manual` | CLI `run` command | Default |
| `Scheduled` | Cron expression | `"0 0 * * * *"` (every hour) |
| `Environmental` | System conditions | Disk full, network change, geofence |
| `RemoteSignal` | External signal | SMS, Signal, webhook, email keyword |
| `DeadManSwitch` | Fires if NOT checked in | Timeout in seconds |

### Example: Scheduled Trigger

```toml
# In plan file (future)
[trigger]
type = "scheduled"
cron = "0 0 2 * * *"  # Every day at 2 AM
```

### Example: Dead Man's Switch

```toml
[trigger]
type = "dead_man_switch"
timeout_seconds = 86400  # 24 hours
```

If MORTIS doesn't receive a check-in within 24 hours, the plan executes.

### Confidence Threshold

Each trigger evaluation returns a confidence score (0.0–1.0). If confidence is below the threshold (default 0.8), a second factor is required before execution.

---

## Receipts

Every MORTIS run produces a cryptographically signed receipt.

### Receipt Structure

```json
{
  "header": {
    "run_id": "550e8400-e29b-41d4-a716-446655440000",
    "schema_version": "1.0",
    "triggered_by": "manual",
    "dry_run": false,
    "coercion": false,
    "started_at": "2026-06-12T10:00:00Z",
    "completed_at": "2026-06-12T10:00:05Z"
  },
  "phases": [
    {
      "phase_order": 0,
      "phase_type": "sanitize_local",
      "plugin_name": "FileOverwritePlugin",
      "result": "success",
      "bytes_processed": 1048576,
      "duration_ms": 150
    }
  ],
  "summary": {
    "overall_result": "success",
    "phases_total": 1,
    "phases_succeeded": 1,
    "phases_failed": 0,
    "bytes_processed": 1048576
  },
  "signature": {
    "algorithm": "Ed25519",
    "public_key_id": "dGVzdGtleQ",
    "body_hash": "abcdef0123456789...",
    "value": "dGVzdHNpZ25hdHVyZQ"
  },
  "rfc3161_token": null
}
```

### Verification

```bash
# Verify signature
mortis receipt verify --receipt <path>

# Verify with RFC 3161 timestamp
mortis receipt verify --receipt <path> --rfc3161
```

### Incremental Persistence

Receipts are written to disk after **every phase**, not just at completion. If the process is killed mid-run, a partial receipt survives with all completed phases recorded.

### Tamper Detection

Any modification to the receipt after signing will be detected:
- Changing any field in header, phases, or summary
- Modifying the signature block
- Removing the signature

---

## Security Model

### Encryption at Rest

- **Database:** SQLCipher (AES-256-CBC) with user-supplied passphrase
- **Key derivation:** PBKDF2-HMAC-SHA512, 100,000 iterations, 32-byte random salt
- **Credentials:** AES-256-GCM at the application layer
- **Passphrase:** Never stored on disk; zeroized from memory after use

### Cryptographic Primitives

| Purpose | Primitive | Crate |
|---------|-----------|-------|
| Database encryption | AES-256-CBC | sqlcipher |
| Key derivation | PBKDF2-HMAC-SHA512 | ring |
| Receipt signing | Ed25519 | ed25519-dalek |
| Receipt body hash | SHA-256 | ring |
| Credential encryption | AES-256-GCM | aes-gcm |
| Random generation | ChaCha20 | rand (OsRng) |
| Memory zeroization | — | zeroize |

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Passphrase brute-force | PBKDF2 100k iterations + 32-byte salt |
| Receipt tampering | Ed25519 signature + canonical JSON hash |
| Plugin panic | Caught by orchestrator; treated as phase failure |
| Plugin timeout | Configurable timeout per plugin call |
| Memory dump | All key material zeroized on drop |
| Supply chain | Reproducible builds + cosign signing + SBOM |
| False positive trigger | Dry-run-first policy + confidence threshold |

### What MORTIS Cannot Guarantee

- **Remote deletion is best-effort.** Cloud services may delay or ignore deletion requests.
- **Physical media destruction** (shredding) is out of scope.
- **Coercion resistance** is limited to duress passphrase; biometric unlock is not protected.
- **Anti-forensics completeness.** MORTIS deletes what it's told to delete. Shadow copies, swap files, and cloud sync caches outside scope are not handled.

### Duress Passphrase

MORTIS supports a secondary "duress" passphrase that executes a reduced plan (e.g., skipping self-destruct phases that would alert an adversary). Receipts generated under duress are tagged `"coercion": true`.

---

## Runbooks

### Runbook 01: Power Loss Mid-Run

**Symptom:** Process killed during execution.

```bash
# Check for interrupted receipt
mortis receipt list

# Finalize partial receipt
mortis receipt finalize --run-id <id>

# Review completed phases
mortis receipt inspect --run-id <id>

# Re-run remaining phases manually
mortis run --plan <path> --resume-from <phase>
```

### Runbook 02: Passphrase Forgotten

**There is no recovery.** The database is encrypted; there is no master key escrow.

Options:
1. Use passphrase backup (stored in a physical safe)
2. Restore database backup from before rotation
3. Delete `~/.mortis/mortis.db` and re-initialize

### Runbook 03: Plugin Failure

**Expected behavior:** Remote deletion is best-effort. Exit code 1 = partial success.

```bash
# Inspect failure
mortis receipt inspect --run-id <id>

# Re-run specific phase
mortis run --plan <path> --phases <plugin_name>
```

### Runbook 04: Receipt Verification

```bash
# Verify signature
mortis receipt verify --receipt <path>

# Verify with timestamp
mortis receipt verify --receipt <path> --rfc3161

# Export human-readable
mortis receipt export --receipt <path> --format json
```

### Runbook 05: False Positive Trigger

```bash
# Stop trigger
mortis trigger disable --type <type>

# Review what happened
mortis receipt inspect --run-id <last>

# Adjust trigger sensitivity
# Edit plan file and re-deploy
```

### Runbook 06: Self-Check Fails

```bash
# Verify binary integrity
mortis self-check

# If fails: re-download and verify
./scripts/build-reproducible.sh
```

### Runbook 07: Safe Testing

```bash
# Use isolated database
mortis --db /tmp/test.db config init --passphrase-env TEST_PASS
export TEST_PASS="test123"

# Add test assets
mortis --db /tmp/test.db inventory add --type local_file --path /tmp/test_secret.txt

# Dry-run first
mortis --db /tmp/test.db run --plan test.toml --dry-run

# Verify dry-run receipt
mortis --db /tmp/test.db receipt list

# Only then run live (against test assets only)
mortis --db /tmp/test.db run --plan test.toml
```

---

## Development

### Building

```bash
# Debug build
cargo build

# Release build
cargo build --release

# Run tests
cargo test

# Run E2E tests
cargo test --test e2e

# Run with logging
RUST_LOG=debug cargo run -- self-check
```

### Project Structure

```
MORTIS/
├── Cargo.toml                    # Workspace root
├── README.md                     # This file
├── MORTIS.md                     # Full engineering specification
├── deny.toml                     # License allowlist (cargo-deny)
├── .github/
│   └── workflows/
│       └── ci.yml                # CI pipeline (11 quality gates)
├── scripts/
│   ├── build-reproducible.sh     # Reproducible build verification
│   ├── generate-sbom.sh          # CycloneDX SBOM generation
│   └── sign-release.sh           # Cosign binary signing
├── tests/
│   ├── e2e.rs                    # End-to-end CLI tests
│   ├── backward_compat.rs        # Receipt backward compatibility
│   └── receipts/                 # Receipt corpus for compat tests
│       └── v1.0.0/
├── docs/                         # Documentation
├── examples/
│   ├── emergency_wipe.toml       # Sample plan
│   └── full_workflow.sh          # Complete workflow demo
└── crates/
    ├── mortis-types/             # Shared types (zero deps)
    ├── mortis-crypto/            # Cryptographic primitives
    ├── mortis-plugins/           # Plugin system
    ├── mortis-db/                # SQLCipher persistence
    ├── mortis-core/              # Core engine
    └── mortis-cli/               # CLI binary
```

### Testing

```bash
# All tests
cargo test

# Specific crate
cargo test -p mortis-crypto

# E2E only
cargo test --test e2e

# Backward compatibility
cargo test --test backward_compat

# With output
cargo test -- --nocapture
```

### CI Quality Gates

All must pass before merge:

| Gate | Tool | Blocking |
|------|------|----------|
| Compile (Linux/macOS/Windows) | `cargo build` | Yes |
| Unit + integration tests | `cargo test` | Yes |
| E2E tests | `cargo test --test e2e` | Yes |
| Linting | `cargo clippy -- -D warnings` | Yes |
| Formatting | `cargo fmt --check` | Yes |
| Dependency audit | `cargo audit` | Yes |
| License check | `cargo deny check` | Yes |
| MSRV (1.75.0) | `cargo +1.75.0 build` | Yes |
| Dry-run safety | E2E harness | Yes |
| Receipt tamper detection | Integration test | Yes |
| Reproducible build | Two builds, same hash | Yes |

### Adding a Plugin

```rust
use async_trait::async_trait;
use mortis_plugins::traits::*;

pub struct MyPlugin;

#[async_trait]
impl SanitizationPlugin for MyPlugin {
    fn name(&self) -> &str {
        "MyPlugin"
    }

    fn supported_media_types(&self) -> &[MediaType] {
        &[MediaType::Generic]
    }

    async fn sanitize(
        &self,
        asset: &Asset,
        method: &SanitizationMethod,
        dry_run: bool,
    ) -> Result<SanitizationResult, SanitizationError> {
        if dry_run {
            // Return what would happen
            return Ok(SanitizationResult {
                asset_id: asset.id,
                method_used: method.clone(),
                bytes_processed: 0,
                success: true,
                error: None,
                duration_ms: 0,
            });
        }

        // Actual sanitization logic here
        Ok(SanitizationResult {
            asset_id: asset.id,
            method_used: method.clone(),
            bytes_processed: 1024,
            success: true,
            error: None,
            duration_ms: 100,
        })
    }
}
```

Register in orchestrator:
```rust
let mut orch = Orchestrator::new(engine);
orch.add_sanitization_plugin(Box::new(MyPlugin));
```

---

## Spec Compliance

This implementation follows the [MORTIS Engineering Specification](MORTIS.md).

### §CANONICAL Sections

| Section | Status | Notes |
|---------|--------|-------|
| Appendix A (DB Schema) | ✅ Implemented | SQLCipher with all tables |
| Appendix B (Receipt Schema) | ✅ Implemented | JSON schema + signature |
| Appendix C (Sanitization Matrix) | ✅ Implemented | NIST SP 800-88 aligned |
| Appendix D (Threat/Mitigation) | ✅ Documented | All T-1 through T-12 |
| §5.2 (Plugin Traits) | ✅ Implemented | Async traits with timeout |
| §7 (Crypto Model) | ✅ Implemented | All primitives from audited crates |

### Exit Codes

| Code | Spec §5.1 | Implementation |
|------|-----------|----------------|
| 0 | Full success | ✅ |
| 1 | Partial success | ✅ |
| 2 | Passphrase fail | ✅ |
| 3 | Plan load fail | ✅ |
| 4 | DB error | ✅ |
| 5 | Not found | ✅ |
| 6 | Invalid receipt | ✅ |
| 7 | Tampered | ✅ |
| 8 | Trigger would not fire | ✅ |
| 9 | Integrity fail | ✅ |

---

## License

Apache-2.0

---

## Acknowledgments

- [NIST SP 800-88 Rev 1](https://csrc.nist.gov/publications/detail/sp/800-88/rev-1/final) — Media sanitization guidelines
- [RFC 3161](https://datatracker.ietf.org/doc/html/rfc3161) — Timestamp protocol
- [RFC 8032](https://datatracker.ietf.org/doc/html/rfc8032) — Ed25519 signature algorithm
