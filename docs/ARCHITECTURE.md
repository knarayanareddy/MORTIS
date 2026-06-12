# Architecture

Detailed technical architecture of MORTIS.

## Overview

MORTIS is structured as a Rust workspace with six crates following a strict dependency hierarchy. No circular dependencies exist. Shared types live in a leaf crate that depends on nothing internal.

```
mortis-types (shared types, zero internal deps)
    ↓
mortis-crypto (Ed25519, SHA-256, PBKDF2, AES-256-GCM, RFC 3161)
    ↓
mortis-plugins (async traits, sanitization plugins, deletion plugins)
    ↓
mortis-db (SQLCipher persistence, Appendix A schema, migrations)
    ↓
mortis-core (orchestrator, passphrase interlock, triggers, log scrubbing)
    ↓
mortis-cli (clap CLI, secure input, all 10 exit codes, SLO benchmarks)
```

## Crate Details

### mortis-types

**Purpose:** Shared type definitions with zero internal dependencies.

Every other crate depends on this crate. It defines:
- `Asset`, `AssetType`, `MediaType`, `SanitizationMethod`
- `Credential`, `CredentialType`
- `Plan`, `PlanPhase`, `PhaseType`
- `Receipt`, `ReceiptHeader`, `ReceiptPhase`, `ReceiptSummary`, `SignatureBlock`
- `TriggerType`, `EnvCondition`, `SignalSource`, `TriggerEvaluation`
- `ExitCode`, `MortisError`

**Dependencies:** serde, chrono, uuid, thiserror

### mortis-crypto

**Purpose:** All cryptographic primitives per §7 CANONICAL.

| Module | Function |
|--------|----------|
| `signing.rs` | Ed25519 key generation, signing, verification |
| `hashing.rs` | SHA-256, canonical JSON hashing |
| `key_derivation.rs` | PBKDF2-HMAC-SHA512, salt generation, key derivation |
| `aead.rs` | AES-256-GCM encryption/decryption for credentials |
| `receipt_engine.rs` | Receipt building, signing, verification |
| `rfc3161.rs` | RFC 3161 TSA client |

**Key types:**
- `SigningKeyPair` — Ed25519 keypair, zeroized on drop
- `DerivedKey` — PBKDF2 output, zeroized on drop
- `ReceiptEngine` — Builds, signs, and verifies receipts

### mortis-plugins

**Purpose:** Plugin trait definitions and built-in implementations.

**Traits (§5.2 CANONICAL):**
- `InventoryConnector` — Discovers assets (read-only)
- `SanitizationPlugin` — Destroys local assets
- `DeletionPlugin` — Revokes remote accounts

**Built-in plugins:**
- `FileOverwritePlugin` — Overwrites files with random/zero data
- `DirectorySanitizePlugin` — Recursive directory overwrite + removal
- `BrowserStatePlugin` — Clears browser profiles
- `CryptographicErasePlugin` — Platform-specific crypto erase
- `GoogleAccountPlugin` — Google account deletion (stub)
- `DropboxPlugin` — Dropbox deletion (stub)
- `GenericApiPlugin` — Configurable HTTP API deletion

**Plugin safety:**
- All plugins are `Send + Sync`
- Plugin panics caught by orchestrator
- Timeout enforcement per call
- No access to DB or ReceiptEngine

### mortis-db

**Purpose:** SQLCipher persistence layer.

**Tables (Appendix A):**
- `assets` — Inventory of registered digital assets
- `plans` — Named destruction plans
- `plan_phases` — Phase entries within a plan
- `receipts` — Completed run receipts
- `receipt_phases` — Phase-level results
- `credentials` — Encrypted credential references
- `run_metrics` — Performance metrics
- `config` — Key-value config store
- `schema_migrations` — Migration tracking

**Key functions:**
- `open_database_encrypted()` — Opens with PRAGMA key
- `rotate_database_key()` — Re-encrypts with PRAGMA rekey
- `initialize_schema()` — Creates all tables

### mortis-core

**Purpose:** Core engine — orchestrator, triggers, passphrase, scrubbing.

**Modules:**

| Module | Responsibility |
|--------|---------------|
| `orchestrator.rs` | Phase runner, plugin dispatch, incremental receipt persistence |
| `passphrase.rs` | Passphrase interlock (primary + duress) |
| `plan.rs` | Plan loading from TOML files |
| `triggers.rs` | Trigger evaluation (manual, scheduled, environmental, remote, dead man's switch) |
| `scrubbing.rs` | Log scrubbing (hex/b64 redaction, path truncation) |

**Orchestrator flow:**
1. Receive plan + passphrase result + options
2. Create receipt (write initial)
3. For each phase:
   a. Execute phase (sanitize/revoke/self-destruct)
   b. Record phase result to receipt
   c. Persist receipt incrementally
   d. Check continue_on_failure
4. Finalize and sign receipt
5. Return receipt + metrics

### mortis-cli

**Purpose:** Command-line interface.

**Key features:**
- Clap-based command parsing
- Secure passphrase input via `rpassword`
- SQLCipher database encryption
- All 10 spec exit codes
- SLO benchmarks in `self-check`
- Incremental receipt persistence

## Data Flow

### Initialization

```
User → mortis config init
  → Generate PBKDF2 salt
  → Derive DB encryption key
  → Open SQLCipher database with PRAGMA key
  → Initialize schema
  → Store salt in external file
  → Store key hash in encrypted DB
```

### Execution

```
User → mortis run --plan emergency.toml
  → Read passphrase
  → Read salt from file
  → Derive DB key
  → Open encrypted database
  → Verify passphrase via interlock
  → Load plan from TOML file
  → Load inventory from DB
  → For each phase:
      → Find matching plugin
      → Execute with timeout
      → Record result to receipt
      → Persist receipt to file
  → Sign receipt with Ed25519
  → Persist final receipt to DB
  → Return exit code
```

### Verification

```
User → mortis receipt verify --receipt <path>
  → Read receipt JSON
  → Reconstruct canonical body
  → Compute SHA-256 hash
  → Compare with signature block's body_hash
  → Verify Ed25519 signature
  → Return exit code (0/6/7)
```

## Security Boundaries

```
┌────────────────────────────────────────────────┐
│ FULLY TRUSTED (process-owned)                  │
│ - Orchestrator, PassphraseInterlock            │
│ - ReceiptEngine, InventoryDB                   │
└────────────────────────────────────────────────┘
│ narrow plugin API (typed traits, no raw FFI)
▼
┌────────────────────────────────────────────────┐
│ SEMI-TRUSTED (sandboxed plugins)               │
│ - SanitizationPlugins (local FS ops)           │
│ - BrowserAutomation (Playwright subprocess)    │
│ - InventoryConnectors (read-only probes)       │
└────────────────────────────────────────────────┘
│ network I/O only via typed plugin return values
▼
┌────────────────────────────────────────────────┐
│ UNTRUSTED (remote, assumed compromised)         │
│ - Cloud service APIs (deletion endpoints)      │
│ - RFC 3161 TSA                                 │
│ - SMS/Signal/webhook trigger source            │
└────────────────────────────────────────────────┘
```

## Error Handling

- **Plugin panics:** Caught by `tokio::time::timeout`, treated as phase failure
- **Plugin timeouts:** Configurable per plugin (default 300s)
- **Partial failures:** `continue_on_failure` flag per phase
- **DB errors:** Hard abort before any phase runs
- **Receipt write failure:** File fallback
- **TSA failure:** Receipt emitted without timestamp

## Memory Safety

- All key material uses `#[derive(ZeroizeOnDrop)]`
- Passphrases zeroized after use
- Derived keys zeroized on drop
- No raw pointers in plugin API
- Plugins cannot access core memory
