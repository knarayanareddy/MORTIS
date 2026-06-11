> **Note:** This is a fully generated, production-SSOT-grade replacement spec synthesized from the existing MORTIS design doc, my architectural analysis, and the SRE/PRR production-readiness bar. Copy this directly into `MORTIS.md`. All section anchors, canonicality rules, and governance scaffolding are intentional — do not remove them.

---

```markdown
# MORTIS — Production Engineering Specification
## Machine-Operated Responsive Total Infrastructure Sanitizer

---

## Document Governance

| Field              | Value                                                  |
|--------------------|--------------------------------------------------------|
| **Status**         | `APPROVED — CANONICAL SSOT`                           |
| **Version**        | `2.0.0`                                                |
| **Owner / DRI**    | _<assign maintainer handle here>_                      |
| **Last Updated**   | _<ISO-8601 date>_                                      |
| **Classification** | Internal Engineering — Restricted                      |
| **Jurisdiction**   | Global (platform matrix: §8)                           |
| **Canonical Sources** | See §2.3 — Canonicality Rules                      |
| **Review Cadence** | Every release cycle or on any threat model change      |

---

## Changelog

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 2.0.0 | _date_ | _author_ | Full production SSOT rewrite — governance, runbooks, supply chain, SLO |
| 1.0.0 | _date_ | _author_ | Initial engineering spec |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Document Governance & Canonicality](#2-document-governance--canonicality)
3. [Goals, Non-Goals & Constraints](#3-goals-non-goals--constraints)
4. [System Architecture](#4-system-architecture)
   - 4.1 [Context View (C4 Level 1)](#41-context-view-c4-level-1)
   - 4.2 [Container / Component View (C4 Level 2)](#42-container--component-view-c4-level-2)
   - 4.3 [Phase Choreography (Behavioral View)](#43-phase-choreography-behavioral-view)
   - 4.4 [Trust Boundary Map](#44-trust-boundary-map)
5. [Interface Contracts](#5-interface-contracts)
   - 5.1 [CLI Command Contracts](#51-cli-command-contracts)
   - 5.2 [Plugin Trait Contracts](#52-plugin-trait-contracts)
   - 5.3 [Trigger Interface Contracts](#53-trigger-interface-contracts)
   - 5.4 [Receipt Schema Contract](#54-receipt-schema-contract)
6. [Data Model & Canonicality Rules](#6-data-model--canonicality-rules)
7. [Cryptographic Model](#7-cryptographic-model)
8. [Platform & Dependency Matrix](#8-platform--dependency-matrix)
9. [Security & Threat Model](#9-security--threat-model)
10. [Observability & Local SLOs](#10-observability--local-slos)
11. [Testing & Quality Gates](#11-testing--quality-gates)
12. [Release Integrity & Supply Chain](#12-release-integrity--supply-chain)
13. [Operational Runbooks](#13-operational-runbooks)
14. [Change Safety & Versioning](#14-change-safety--versioning)
15. [Dependency Failure Budgets](#15-dependency-failure-budgets)
16. [Security Review & Audit Plan](#16-security-review--audit-plan)
17. [Rollout & Milestone Plan](#17-rollout--milestone-plan)
18. [Alternatives Considered](#18-alternatives-considered)
19. [Open Questions & Decision Log](#19-open-questions--decision-log)
20. [Appendix A — Inventory DB Schema (Canonical)](#appendix-a--inventory-db-schema-canonical)
21. [Appendix B — Receipt Schema (Canonical)](#appendix-b--receipt-schema-canonical)
22. [Appendix C — Sanitization Method Matrix (Canonical)](#appendix-c--sanitization-method-matrix-canonical)
23. [Appendix D — Threat/Mitigation Table (Canonical)](#appendix-d--threatmitigation-table-canonical)

---

## 1. Executive Summary

MORTIS is a **local-first, user-controlled data sanitization and remote revocation system** written in Rust.
It enables individuals and organizations to execute pre-planned, cryptographically evidenced destruction
of sensitive digital assets — local files, database records, browser state, and cloud-accessible accounts —
in response to configurable triggers (manual, scheduled, environmental, remote signal).

MORTIS's core promise is: **if you pull the trigger, MORTIS leaves verifiable, tamper-evident receipts
and deletes what you told it to delete, in the order you specified, regardless of partial failures downstream.**

This document is the **single source of truth** for MORTIS's engineering design. All schema definitions,
plugin contracts, cryptographic primitives, threat mitigations, and release procedures described here
are **normative**. Where this document conflicts with inline code comments or README fragments,
**this document takes precedence until superseded by a new approved version.**

---

## 2. Document Governance & Canonicality

### 2.1 Owner & Review Process

The DRI (Directly Responsible Individual) listed in the header is accountable for:
- Keeping this document current with the implemented system.
- Approving any PR that modifies a **§CANONICAL** section.
- Triggering a threat model review on any architectural change.

### 2.2 Status Lifecycle

```
DRAFT → IN_REVIEW → APPROVED (CANONICAL SSOT) → SUPERSEDED
```

A document in `DRAFT` or `IN_REVIEW` state **must not be used as an implementation reference**.

### 2.3 Canonicality Rules

The following sections are **normative (§CANONICAL)**. Code, migrations, and configurations
must match them exactly. No illustrative examples in other sections override these:

| §CANONICAL Section | What It Governs |
|---|---|
| Appendix A | Inventory DB DDL + index definitions |
| Appendix B | Receipt JSON schema + field semantics |
| Appendix C | Sanitization method selection matrix |
| Appendix D | Threat/mitigation table |
| §5.2 | Plugin trait signatures |
| §7 | Cryptographic primitive selections |

**Rule:** If you discover a conflict between a §CANONICAL section and running code,
open a blocking issue tagged `canon-drift` before merging any PR.

### 2.4 Exception Process

Any deviation from a §CANONICAL section requires:
1. A written justification in the PR description.
2. DRI approval.
3. An update to the §CANONICAL section in the same PR (no deferred doc debt).

---

## 3. Goals, Non-Goals & Constraints

### 3.1 Goals

| # | Goal | Success Signal |
|---|------|---------------|
| G-1 | Maintain a persistent, queryable inventory of all registered digital assets | Inventory DB present and migrated on first run |
| G-2 | Support multi-trigger activation: manual, scheduled, environmental, remote SMS/signal | All trigger types pass integration tests |
| G-3 | Execute destruction phases in user-defined order with deterministic phase choreography | Phase sequence is replay-safe and receipt-complete even on partial failure |
| G-4 | Local file/volume sanitization aligned to **NIST SP 800-88 Rev 1** | Method selection passes Appendix C matrix |
| G-5 | Remote account/service revocation via browser automation (Playwright) and API calls | Plugin suite covers documented services |
| G-6 | Emit a tamper-evident, RFC 3161-timestamped cryptographic receipt for every run | Receipt verification CLI command passes |
| G-7 | Support dry-run mode that simulates all phases without destructive side effects | Dry-run produces receipt with `dry_run: true` and no FS/DB mutations |
| G-8 | Cross-platform: Linux, macOS, Windows | CI matrix passes on all three |
| G-9 | Zero required network access at runtime for local-only runs | Offline integration test passes |
| G-10 | No telemetry, no call-home, no analytics | Static analysis + network test confirm zero outbound on local runs |

### 3.2 Non-Goals

| # | Non-Goal | Rationale |
|---|---------|-----------|
| NG-1 | TLS interception / MITM proxying | Out of trust boundary; adds legal exposure |
| NG-2 | CAPTCHA bypass or credential brute-force | Violates ToS of every major provider |
| NG-3 | Guaranteed deletion of cloud-side data | Remote deletion is best-effort; cloud providers are untrusted third parties |
| NG-4 | Absolute GDPR/CCPA right-to-erasure compliance for cloud accounts | Article 17 is conditional; MORTIS documents, it does not certify compliance |
| NG-5 | Multi-user / networked agent model | Local-single-user trust model only in v1 |
| NG-6 | Forensic recovery tooling | Destruction only; recovery is out of scope |
| NG-7 | Real-time GUI | CLI-first; a UI wrapper may be built on top of the CLI contract |

### 3.3 Hard Constraints

| # | Constraint |
|---|-----------|
| C-1 | All cryptographic primitives must come from **audited Rust crates** (see §7) |
| C-2 | Inventory and receipt data at rest must be encrypted with **SQLCipher** using a user-supplied passphrase |
| C-3 | Passphrase entry must be interlock-gated: no phase executes without confirmed passphrase |
| C-4 | A receipt must be emitted even when a phase fails partially — failure state is part of the evidence |
| C-5 | Dry-run mode must not produce any filesystem, database, or network side effects |
| C-6 | All plugin I/O must be sandboxed from the core orchestrator's memory space |
| C-7 | Build artifacts must be reproducible and signed (see §12) |

---

## 4. System Architecture

### 4.1 Context View (C4 Level 1)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER / OPERATOR                            │
│          (human configuring, triggering, and auditing MORTIS)       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  CLI / config file / trigger signal
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        MORTIS PROCESS                               │
│              (local, single-user, passphrase-gated)                 │
└──────┬───────────────┬──────────────────────┬───────────────────────┘
       │               │                      │
       ▼               ▼                      ▼
┌────────────┐  ┌─────────────┐    ┌──────────────────────┐
│  LOCAL FS  │  │ SQLCipher   │    │  REMOTE SERVICES     │
│  & VOLUMES │  │ Inventory   │    │  (cloud accounts,    │
│  (target)  │  │ + Receipt   │    │   email, SMS signal) │
│            │  │ DB          │    │   [untrusted]        │
└────────────┘  └─────────────┘    └──────────────────────┘
```

**External systems MORTIS interacts with:**

| System | Trust Level | Interaction |
|--------|------------|-------------|
| Local filesystem / volumes | Trusted (local) | Read inventory; execute sanitization |
| SQLCipher DB | Trusted (encrypted local) | Persist inventory, receipts, config |
| Remote cloud services | **Untrusted** | Best-effort revocation via plugin |
| RFC 3161 TSA (timestamp authority) | Semi-trusted (optional) | Sign receipt timestamps |
| SMS/Signal/webhook trigger endpoint | Semi-trusted | Receive trigger signal |

---

### 4.2 Container / Component View (C4 Level 2)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                             MORTIS PROCESS                                   │
│                                                                              │
│  ┌────────────────────┐    ┌──────────────────────────────────────────────┐  │
│  │   CLI LAYER        │    │           CORE ENGINE                        │  │
│  │                    │───▶│                                              │  │
│  │  clap-based        │    │  ┌─────────────────┐  ┌──────────────────┐  │  │
│  │  command router    │    │  │  TriggerManager  │  │  Orchestrator    │  │  │
│  │                    │    │  │  (evaluates all  │  │  (phase runner,  │  │  │
│  │  Contracts: §5.1   │    │  │  trigger types)  │  │  state machine)  │  │  │
│  └────────────────────┘    │  └────────┬─────────┘  └───────┬──────────┘  │  │
│                            │           │                    │              │  │
│                            │           ▼                    ▼              │  │
│                            │  ┌──────────────────────────────────────┐    │  │
│                            │  │         PassphraseInterlock          │    │  │
│                            │  │  (gates ALL destructive operations)  │    │  │
│                            │  └───────────────────┬──────────────────┘    │  │
│                            │                      │                       │  │
│                            │           ┌──────────┴──────────┐            │  │
│                            │           ▼                     ▼            │  │
│                            │  ┌────────────────┐  ┌────────────────────┐  │  │
│                            │  │ Sanitization   │  │  Revocation        │  │  │
│                            │  │ Engine         │  │  Engine            │  │  │
│                            │  │ (NIST-aligned) │  │  (plugin-driven)   │  │  │
│                            │  └────────┬───────┘  └────────┬───────────┘  │  │
│                            │           │                   │              │  │
│                            └───────────┼───────────────────┼──────────────┘  │
│                                        │                   │                 │
│  ┌─────────────────────────────────────▼───────────────────▼──────────────┐  │
│  │                         PLUGIN LAYER                                   │  │
│  │   DeletionPlugin impls  │  SanitizationPlugin impls  │  InventoryConnector │
│  │   (per remote service)  │  (per media type)          │  (per asset type)   │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                     PERSISTENCE LAYER                                   │  │
│  │     InventoryDB (SQLCipher)    │    ReceiptStore (SQLCipher + file)     │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                      RECEIPT ENGINE                                     │  │
│  │     receipt builder  │  RFC 3161 TSA client  │  Ed25519 signing         │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Component responsibilities:**

| Component | Responsibility | Failure Behavior |
|-----------|---------------|-----------------|
| TriggerManager | Poll/receive all trigger types; evaluate activation condition | Log trigger eval; never silently swallow errors |
| PassphraseInterlock | Block all destructive ops until passphrase confirmed | Hard abort with exit code 2 |
| Orchestrator | Run phase sequence; collect phase results; hand off to ReceiptEngine | On partial failure: complete remaining phases; mark failed phases in receipt |
| SanitizationEngine | Select + execute NIST-aligned wipe per media type | Log method selected; fallback to cryptographic erase if overwrite unavailable |
| RevocationEngine | Execute DeletionPlugin suite per configured service | Each plugin failure is isolated; logged; receipt-tagged |
| InventoryDB | SQLCipher-backed asset registry | DB open failure = hard abort before any phase runs |
| ReceiptEngine | Build, sign, timestamp, and persist receipt | Receipt write failure = emit to stderr + local file fallback |
| PluginLayer | Isolate volatile third-party logic from core | Plugin panic = caught, logged, treated as phase failure |

---

### 4.3 Phase Choreography (Behavioral View)

```
TRIGGER FIRED
     │
     ▼
[1] PassphraseInterlock.verify()
     │  fail ──────────────────────────────────────────▶ ABORT (exit 2)
     │  ok
     ▼
[2] InventoryDB.load_plan()
     │  fail ──────────────────────────────────────────▶ ABORT (exit 3)
     │  ok
     ▼
[3] Orchestrator.begin_run(plan, dry_run)
     │
     ├──▶ Phase: Revoke remote accounts  (RevocationEngine + DeletionPlugins)
     │         │ partial fail ──────────▶ log + tag receipt + CONTINUE
     │
     ├──▶ Phase: Sanitize local assets   (SanitizationEngine)
     │         │ partial fail ──────────▶ log + tag receipt + CONTINUE
     │
     ├──▶ Phase: Clear browser state     (SanitizationPlugin::BrowserState)
     │         │ partial fail ──────────▶ log + tag receipt + CONTINUE
     │
     ├──▶ Phase: Wipe DB records         (InventoryDB.destroy_sensitive())
     │         │ partial fail ──────────▶ log + tag receipt + CONTINUE
     │
     └──▶ Phase: Self-destruct config    (optional, user-configured)
               │ partial fail ──────────▶ log + tag receipt + CONTINUE
     │
     ▼
[4] ReceiptEngine.build_and_sign()
     │  fail ──────────────────────────────────────────▶ STDERR + file fallback
     │  ok
     ▼
[5] ReceiptEngine.timestamp_via_rfc3161()  [optional, requires network]
     │
     ▼
[6] ReceiptStore.persist()
     │
     ▼
EXIT (code 0 = full success, 1 = partial success with receipt, 2+ = abort before phases)
```

**Invariants enforced by the Orchestrator:**
- A receipt is **always** emitted after phase execution begins, regardless of phase outcome.
- Phase order is **deterministic** and defined in the inventory plan — not hardcoded.
- A `dry_run` flag set at run start cannot be changed mid-run.
- Each phase result (ok / partial / failed) is recorded atomically to the receipt before the next phase begins.

---

### 4.4 Trust Boundary Map

```
┌────────────────────────────────────────────────────────────┐
│  FULLY TRUSTED (process-owned)                             │
│  - Orchestrator, PassphraseInterlock, ReceiptEngine        │
│  - InventoryDB (SQLCipher, passphrase-gated)               │
└────────────────────────────────────────────────────────────┘
          │ narrow plugin API (typed traits, no raw FFI)
          ▼
┌────────────────────────────────────────────────────────────┐
│  SEMI-TRUSTED (sandboxed plugins, local system access)     │
│  - SanitizationPlugins (local FS ops)                      │
│  - BrowserAutomation (Playwright subprocess)               │
│  - InventoryConnectors (read-only system probes)           │
└────────────────────────────────────────────────────────────┘
          │ network I/O only via typed plugin return values
          ▼
┌────────────────────────────────────────────────────────────┐
│  UNTRUSTED (remote, assumed compromised or unavailable)    │
│  - Cloud service APIs (deletion endpoints)                 │
│  - RFC 3161 TSA                                            │
│  - SMS/Signal/webhook trigger source                       │
└────────────────────────────────────────────────────────────┘
```

---

## 5. Interface Contracts

> **§CANONICAL — §5.2 (Plugin Trait Signatures).** All other subsections are normative but non-canonical;
> changes to CLI surface or trigger interfaces do not require §2.4 exception process, but must be
> reflected here before merging.

### 5.1 CLI Command Contracts

All commands follow the pattern: `mortis <command> [options]`

| Command | Required Args | Optional Args | Side Effects | Exit Codes |
|---------|--------------|--------------|-------------|------------|
| `run` | `--plan <path>` | `--dry-run`, `--no-timestamp` | Executes full phase plan | 0=full, 1=partial, 2=passphrase fail, 3=plan load fail |
| `inventory add` | `--type <asset_type>`, `--path <path>` | `--label <str>`, `--priority <int>` | Writes to InventoryDB | 0=ok, 4=DB error |
| `inventory list` | — | `--format json\|table` | None (read-only) | 0=ok |
| `inventory remove` | `--id <uuid>` | `--force` | Removes entry from InventoryDB | 0=ok, 5=not found |
| `receipt verify` | `--receipt <path>` | `--rfc3161` | None (read-only) | 0=valid, 6=invalid, 7=tampered |
| `receipt export` | `--receipt <path>` | `--format json\|pdf` | Writes output file | 0=ok |
| `trigger test` | `--type <trigger_type>` | `--dry-run` | Dry-run trigger evaluation only | 0=would fire, 8=would not fire |
| `config init` | — | `--passphrase-env <VAR>` | Creates encrypted config + DB | 0=ok |
| `config rotate-key` | — | — | Re-encrypts DB with new passphrase | 0=ok |
| `self-check` | — | — | Verifies binary signature + DB integrity | 0=ok, 9=integrity fail |

**Global flags:** `--verbose`, `--log-level <trace|debug|info|warn|error>`, `--db <path>`, `--config <path>`

**Stderr contract:** All user-facing error messages go to stderr. Structured JSON logs go to the log file.
No sensitive data (passphrases, keys, file contents) is ever written to stdout, stderr, or log files.

---

### 5.2 Plugin Trait Contracts §CANONICAL

```rust
// ── Inventory Connector ──────────────────────────────────────────────────────

pub trait InventoryConnector: Send + Sync {
    /// Human-readable connector name (e.g., "BrowserProfileConnector")
    fn name(&self) -> &'static str;

    /// Discover assets of this type on the local system.
    /// Must be read-only. Must not mutate filesystem or DB.
    fn discover(&self, context: &DiscoveryContext) -> Result<Vec<Asset>, ConnectorError>;

    /// Estimate total bytes this connector's assets would produce in a sanitization run.
    fn estimate_bytes(&self, assets: &[Asset]) -> u64;
}

// ── Sanitization Plugin ──────────────────────────────────────────────────────

pub trait SanitizationPlugin: Send + Sync {
    fn name(&self) -> &'static str;

    /// Media types this plugin handles (e.g., MediaType::HddBlock, MediaType::SsdNvme)
    fn supported_media_types(&self) -> &[MediaType];

    /// Execute sanitization on a single asset.
    /// Must be idempotent: calling twice on an already-sanitized asset must not error.
    /// Must respect dry_run: if true, simulate without any FS mutation.
    fn sanitize(
        &self,
        asset: &Asset,
        method: &SanitizationMethod,
        dry_run: bool,
    ) -> SanitizationResult;
}

// ── Deletion Plugin (remote revocation) ─────────────────────────────────────

pub trait DeletionPlugin: Send + Sync {
    fn name(&self) -> &'static str;

    /// Service identifiers this plugin handles (e.g., "google_account", "dropbox")
    fn service_ids(&self) -> &[&'static str];

    /// Attempt account/data deletion or revocation on the remote service.
    /// Must respect dry_run: if true, simulate and return what would have been attempted.
    /// Must complete within the timeout_ms budget or return Err(DeletionError::Timeout).
    fn delete(
        &self,
        credential: &Credential,
        options: &DeletionOptions,
        dry_run: bool,
        timeout_ms: u64,
    ) -> DeletionResult;

    /// Return evidence string (URL visited, API response code, etc.) for the receipt.
    fn evidence(&self) -> Option<String>;
}

// ── Shared Types ─────────────────────────────────────────────────────────────

pub struct SanitizationResult {
    pub asset_id: Uuid,
    pub method_used: SanitizationMethod,
    pub bytes_processed: u64,
    pub success: bool,
    pub error: Option<String>,
    pub duration_ms: u64,
}

pub struct DeletionResult {
    pub service_id: String,
    pub success: bool,
    pub best_effort_only: bool,  // true = remote cannot confirm deletion
    pub evidence: Option<String>,
    pub error: Option<String>,
    pub duration_ms: u64,
}
```

**Plugin contract rules:**
- Plugins must **never** access the InventoryDB or ReceiptEngine directly.
- Plugins must **never** call `std::process::exit`.
- Plugin panics are caught by the Orchestrator and treated as phase failures.
- Plugins must not spawn long-lived background threads.
- All network I/O from plugins must go through `DeletionOptions::http_client`
  (a pre-configured, timeout-enforced client injected by the Orchestrator).

---

### 5.3 Trigger Interface Contracts

```rust
pub trait Trigger: Send + Sync {
    fn name(&self) -> &'static str;
    fn trigger_type(&self) -> TriggerType;

    /// Evaluate whether this trigger's condition is currently met.
    /// Must be non-destructive. Must complete within 5 seconds.
    fn evaluate(&self, context: &TriggerContext) -> TriggerEvaluation;
}

pub enum TriggerType {
    Manual,               // CLI `run` command
    Scheduled(CronExpr),  // cron expression
    Environmental(EnvCondition), // disk full, network change, geofence
    RemoteSignal(SignalSource),  // SMS, Signal, webhook, email keyword
    DeadManSwitch(Duration),     // fires if NOT checked in within duration
}

pub struct TriggerEvaluation {
    pub should_fire: bool,
    pub confidence: f32,      // 0.0–1.0; < threshold requires second factor
    pub reason: String,
    pub evaluated_at: DateTime<Utc>,
}
```

---

### 5.4 Receipt Schema Contract

> Full canonical schema in **Appendix B**. This section summarizes field semantics.

A receipt is a JSON document with:
- A **header** (run ID, version, triggered_by, dry_run flag, started_at, completed_at).
- A **phases array** (one entry per executed phase, including failures).
- A **summary** (overall result, total bytes processed, counts).
- A **signature block** (Ed25519 signature over SHA-256 of the receipt body).
- An optional **rfc3161_token** (base64-encoded timestamp token from TSA).

Receipts are **append-only**: a receipt is created at run start and phases are recorded into it
incrementally. The final signature is applied after all phases complete.

Receipts are stored in:
1. The ReceiptStore table in SQLCipher (primary).
2. A `<run_id>.receipt.json` file in the configured output directory (fallback).

---

## 6. Data Model & Canonicality Rules

> **§CANONICAL source: Appendix A.**
> The DDL in Appendix A is the authoritative schema.
> Examples in this section are illustrative only — if they conflict with Appendix A, Appendix A wins.
> All database migrations must be generated from Appendix A via the migration toolchain.

### 6.1 Overview

MORTIS uses a single SQLCipher database file (default: `~/.mortis/mortis.db`, configurable via `--db`).

**Tables:**
| Table | Purpose |
|-------|---------|
| `assets` | Inventory of registered digital assets |
| `plans` | Named destruction plans (ordered phase lists) |
| `plan_phases` | Phase entries within a plan (ordered, typed) |
| `receipts` | Completed run receipts (header + summary) |
| `receipt_phases` | Phase-level results linked to a receipt |
| `credentials` | Encrypted credential references for DeletionPlugins |
| `config` | Key-value config store (encrypted) |
| `schema_migrations` | Migration version tracking |

### 6.2 Migration Rules

- Migrations are numbered sequentially: `0001_init.sql`, `0002_add_credentials.sql`, etc.
- Migrations are **forward-only**: no rollback scripts. Use compensating migrations.
- Every migration must be idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- The `schema_migrations` table is the single source of truth for applied migrations.
- Breaking schema changes (column removals, type changes) require a **major version bump** in this doc.

### 6.3 Encryption-at-Rest Rules

- The entire SQLCipher database is encrypted with AES-256-CBC using the user passphrase derived
  via PBKDF2-HMAC-SHA512 (100,000 iterations, random 32-byte salt stored in cleartext header).
- The passphrase is **never stored on disk** in any form.
- The derived key is held in process memory only for the duration of the run, then zeroized via
  the `zeroize` crate before process exit.
- Receipt `.json` files on disk are **not encrypted** by default (they are evidence documents);
  users may optionally configure GPG encryption for file output.

---

## 7. Cryptographic Model

> §CANONICAL. Primitive changes require DRI approval and a security review (§16).

| Purpose | Primitive | Crate | Notes |
|---------|----------|-------|-------|
| Database encryption | AES-256-CBC | `sqlcipher` (SQLCipher 4.x) | Industry standard for SQLite encryption |
| Key derivation | PBKDF2-HMAC-SHA512, 100k iterations | `ring` | Salt: 32 bytes random, stored in DB header |
| Receipt signing | Ed25519 | `ed25519-dalek` | Keys generated at `config init`; private key stored encrypted in DB |
| Receipt body hash | SHA-256 | `ring` | Hash computed over canonical JSON (sorted keys, no whitespace) |
| RFC 3161 timestamps | SHA-256 + TSA response | `der` + HTTP client | TSA URL is user-configurable; default: FreeTSA |
| Random number generation | ChaCha20 | `rand` (with `OsRng`) | Used for salts, UUIDs, key material |
| Memory zeroization | — | `zeroize` | Applied to all key material, passphrases, derived keys |

**Rules:**
- MD5, SHA-1, DES, 3DES, and RSA < 2048-bit are **banned**.
- No custom cryptographic implementations. All primitives come from the audited crates above.
- The `ring` crate is pinned to a specific audited version in `Cargo.lock`.
- Key rotation (passphrase change) re-derives the DB encryption key and re-encrypts the entire DB.

---

## 8. Platform & Dependency Matrix

### 8.1 Supported Platforms

| Platform | Architecture | Tier | Notes |
|----------|-------------|------|-------|
| Linux (Ubuntu 22.04 LTS+) | x86_64, aarch64 | **Tier 1** — full CI, all features | Primary development target |
| macOS (12 Monterey+) | x86_64, Apple Silicon | **Tier 1** — full CI, all features | Notarized binary required |
| Windows (10 21H2+, 11) | x86_64 | **Tier 2** — CI, limited sanitization plugins | Some NIST methods unavailable; documented |

### 8.2 Rust Toolchain

- **MSRV (Minimum Supported Rust Version):** 1.75.0 (stable)
- Toolchain is pinned via `rust-toolchain.toml`.
- Nightly features are **banned** in production code.

### 8.3 Key Dependency Policy

| Dependency | Purpose | Policy |
|-----------|---------|--------|
| `tokio` | Async runtime (trigger polling, HTTP) | Pin minor version; review on upgrade |
| `sqlcipher` | Encrypted SQLite | Pin to audited release; CVE monitoring required |
| `ed25519-dalek` | Receipt signing | Pin to audited release |
| `ring` | SHA-256, PBKDF2 | Pin to audited release |
| `playwright` (subprocess) | Browser automation for revocation | Pinned version in `package.json`; isolated subprocess |
| `clap` | CLI parsing | Minor version updates ok |
| `tracing` | Structured logging | Minor version updates ok |
| `serde_json` | JSON serialization | Minor version updates ok |

**Dependency rules:**
- `cargo audit` runs in CI on every PR (see §11).
- `cargo deny` enforces license allowlist (MIT, Apache-2.0, ISC).
- No transitive dependencies with known CVEs may be merged without documented exception.

---

## 9. Security & Threat Model

> Full threat/mitigation table: **Appendix D §CANONICAL**.
> This section describes the model and trust assumptions; Appendix D is the operative checklist.

### 9.1 Security Objectives

1. **Confidentiality of credentials:** No plaintext credentials in logs, receipts, or files.
2. **Integrity of receipts:** Receipts cannot be forged or modified without detection.
3. **Availability of destruction:** Trigger mechanisms must survive common failure modes.
4. **Non-repudiation:** Receipts provide cryptographic evidence of what happened and when.

### 9.2 Attack Surface

| Surface | Vectors |
|---------|---------|
| Passphrase entry | Keylogger, shoulder-surfing, rubber-hose |
| Trigger channel | Fake SMS/webhook, replay attack, DoS on trigger signal |
| SQLCipher DB file | Physical access + offline dictionary attack on passphrase |
| Plugin subprocess (Playwright) | Malicious site injecting JS into automation context |
| Binary distribution | Supply chain compromise, binary tampering |
| Receipt file | Tampering to obscure evidence |

### 9.3 What MORTIS Cannot Guarantee (Honest Limits)

These are documented user-visible limitations, not bugs:

- **Remote deletion is best-effort.** Cloud services may delay, ignore, or partially execute
  deletion requests. MORTIS records what it attempted; it cannot confirm cloud-side erasure.
- **GDPR Article 17 compliance is not automatic.** MORTIS facilitates deletion requests
  but does not certify compliance. Legal standing depends on the specific service and jurisdiction.
- **Physical media retention.** MORTIS follows NIST SP 800-88 for logical and cryptographic
  erasure. Physical media destruction (shredding) is out of scope.
- **Coercion scenarios.** MORTIS supports a duress passphrase that executes a reduced plan,
  but it cannot protect against compelled biometric unlock of the device itself.
- **Anti-forensics completeness.** MORTIS deletes what it is told to delete. It does not
  discover or delete files it was not inventoried to handle (shadow copies, swap, temp files
  outside scope, cloud sync caches).

### 9.4 Coercion / Duress Model

MORTIS supports a **duress passphrase** distinct from the primary passphrase:
- The duress passphrase executes a reduced, pre-configured plan (e.g., omitting
  self-destruct phases that would alert an adversary).
- Receipt generated under duress is tagged `coercion: true` for later forensic use.
- The existence of a duress passphrase is not detectable from the encrypted DB header.

---

## 10. Observability & Local SLOs

### 10.1 Logging

All logs are structured JSON via the `tracing` crate. Log output goes to:
- `~/.mortis/logs/mortis.log` (default, configurable)
- Stderr if `--verbose` or `--log-level debug+` is set

**Log field schema:**

```json
{
  "timestamp": "ISO-8601",
  "level": "INFO|WARN|ERROR|DEBUG|TRACE",
  "run_id": "uuid",
  "phase": "string|null",
  "plugin": "string|null",
  "asset_id": "uuid|null",
  "event": "string",
  "duration_ms": "number|null",
  "error": "string|null"
}
```

**Scrubbing rules (enforced in logging middleware):**
- Passphrases, derived keys, private key bytes → **never logged**
- File contents → **never logged**
- Full file paths beyond depth 3 → truncated with `[PATH_REDACTED]`
- Credential values → **never logged** (log credential ID only)

### 10.2 Metrics

MORTIS emits a `run_metrics` row to the InventoryDB after each run:

| Metric | Type | Description |
|--------|------|-------------|
| `run_duration_ms` | gauge | Wall time from trigger evaluation to receipt persist |
| `phases_total` | counter | Total phases in plan |
| `phases_succeeded` | counter | Phases completed successfully |
| `phases_failed` | counter | Phases that failed (partial or full) |
| `bytes_processed` | counter | Total bytes sanitized across all assets |
| `plugins_invoked` | counter | Total plugin calls |
| `plugins_timed_out` | counter | Plugin calls that exceeded timeout budget |
| `receipt_signed` | bool | Whether receipt was successfully signed |
| `rfc3161_timestamped` | bool | Whether TSA timestamp was obtained |

### 10.3 Local SLOs

These are **user-observable commitments** that CI and performance tests must validate:

| SLO | Target | Measurement |
|-----|--------|-------------|
| Phase plan load time | < 500ms | `mortis self-check --bench` |
| Receipt sign + persist | < 2s after all phases | Measured in run_metrics |
| Dry-run full plan | < 10s for plans with ≤ 100 assets | Integration test |
| Passphrase interlock | < 1s from input to verification | Unit benchmark |
| `receipt verify` | < 500ms for any valid receipt | CLI test |
| Plugin timeout enforcement | 100% of plugins capped at `timeout_ms` | Plugin harness test |

### 10.4 Debug Mode

`--log-level trace` enables:
- Phase state machine transitions (without asset content)
- Plugin call/return timing
- Trigger evaluation decision tree
- Network I/O summaries (URLs + status codes; no response bodies)

---

## 11. Testing & Quality Gates

### 11.1 Test Pyramid

```
                    ┌──────────────┐
                    │   E2E Tests  │  ~10 scenarios
                    │  (full CLI   │  dry-run + real FS
                    │   + real DB) │  sandboxed tmpdir
                    └──────┬───────┘
               ┌───────────┴────────────┐
               │   Integration Tests    │  ~50 scenarios
               │  (orchestrator +       │  in-memory SQLCipher
               │   plugin harness)      │  mock network
               └───────────┬────────────┘
          ┌────────────────┴───────────────────┐
          │           Unit Tests               │  ~200+ tests
          │  (per component, pure functions,   │  no I/O
          │   crypto primitives, phase logic)  │
          └────────────────────────────────────┘
```

### 11.2 Required Test Coverage

| Component | Minimum Coverage | Key Invariants |
|-----------|-----------------|----------------|
| Orchestrator phase logic | 95% | Receipt emitted on partial failure |
| PassphraseInterlock | 100% | Correct passphrase = pass; incorrect = fail; duress = reduced plan |
| SanitizationEngine | 90% | Method selection matches Appendix C matrix for all media types |
| ReceiptEngine | 95% | Receipt is valid + verifiable after sign; tampering detected by `receipt verify` |
| Plugin harness | 90% | Plugin panic = phase failure, not process crash; timeout enforced |
| InventoryDB | 90% | Migrations idempotent; encryption round-trip; CRUD correctness |
| CLI command router | 85% | All exit codes; dry-run produces no side effects |

### 11.3 CI Quality Gates (All must pass before merge)

| Gate | Tool | Blocking |
|------|------|---------|
| Compile (all targets) | `cargo build --target <matrix>` | Yes |
| Unit + integration tests | `cargo test` | Yes |
| E2E tests | `cargo test --test e2e` | Yes |
| Linting | `cargo clippy -- -D warnings` | Yes |
| Formatting | `cargo fmt --check` | Yes |
| Dependency audit | `cargo audit` | Yes (unless exempted) |
| License check | `cargo deny check` | Yes |
| Binary signature check | `cosign verify` | Yes (release builds) |
| MSRV check | `cargo +1.75.0 build` | Yes |
| Dry-run no-side-effects | E2E harness assertion | Yes |
| Receipt tamper detection | Integration test | Yes |

### 11.4 Property-Based Tests

The following properties must be tested via `proptest` or `quickcheck`:

1. **Receipt integrity:** For any arbitrary phase result set, `receipt verify` must return valid
   iff the receipt was not modified after signing.
2. **Sanitization idempotence:** For any asset + sanitization method, calling `sanitize` twice
   must not produce an error on the second call.
3. **Dry-run purity:** For any plan, a dry-run must produce zero filesystem modifications.
4. **Phase ordering:** The Orchestrator must always execute phases in the order defined by the plan,
   regardless of which phases fail.

---

## 12. Release Integrity & Supply Chain

### 12.1 Build Reproducibility

- MORTIS releases must be **reproducible builds**: given the same source commit and toolchain,
  `sha256sum` of the binary must match across independent builds.
- Reproducibility is verified by CI: two parallel build jobs must produce identical binaries.
- `SOURCE_DATE_EPOCH` is set in the build environment to strip timestamp variance.

### 12.2 Binary Signing

Release binaries are signed using **Sigstore/cosign** with keyless signing (OIDC-bound).

| Artifact | Signing Method | Verification Command |
|---------|---------------|---------------------|
| Release binaries | `cosign sign-blob` (keyless) | `cosign verify-blob --bundle <bundle> <binary>` |
| Container image (if any) | `cosign sign` (keyless) | `cosign verify <image>` |
| SBOM | `cosign attest` | `cosign verify-attestation` |

Users should run `mortis self-check` after installation to verify binary integrity.

### 12.3 SBOM (Software Bill of Materials)

An SBOM in **CycloneDX JSON** format is generated and attached to every release via `cargo cyclonedx`.
It is published alongside release artifacts at `releases/<version>/mortis.cdx.json`.

### 12.4 Dependency Auditing Policy

| Severity | Policy |
|---------|--------|
| Critical CVE in direct dependency | Block release; patch within 24h |
| High CVE in direct dependency | Block release; patch within 72h |
| Medium CVE in direct dependency | Patch before next minor release |
| Any CVE in transitive dependency | Triage within 1 week; document if deferred |
| License violation | Block merge immediately |

### 12.5 Release Channels

| Channel | Audience | Update Cadence | Binary Verification Required |
|---------|---------|---------------|------------------------------|
| `stable` | General users | Monthly or on critical patch | Yes |
| `beta` | Testers | Bi-weekly | Yes |
| `nightly` | Developers | Daily | Optional (CI-signed) |

### 12.6 Vulnerability Disclosure

- **Coordinated disclosure:** Report security issues to `security@<project-domain>` (GPG key published).
- **Response SLA:** Acknowledge within 48h; patch + advisory within 90 days of report.
- **CVE registration:** Critical vulnerabilities will be registered as CVEs via GitHub Security Advisories.

---

## 13. Operational Runbooks

> These runbooks are **user-operator facing**. They cover the most common failure and edge case
> scenarios a user running MORTIS will encounter. They must be kept current with CLI changes.

---

### Runbook 01: Power Loss or Process Kill Mid-Run

**Symptom:** MORTIS was executing a plan and the process was killed (power loss, OOM, SIGKILL).

**What MORTIS guarantees:**
- Phases that completed before the kill have their results persisted if the DB was not mid-write.
- A receipt may be incomplete (missing signature, no TSA timestamp).

**Recovery procedure:**
1. Run `mortis receipt list --status incomplete` to identify the interrupted run.
2. Run `mortis receipt finalize --run-id <id>` to sign and persist the partial receipt with
   status `interrupted`.
3. Inspect the receipt to determine which phases completed.
4. Manually verify assets that were in-flight during the kill (check filesystem, check service state).
5. Re-run remaining phases manually using `mortis run --plan <path> --resume-from <phase>` 
   (if supported in your version; see changelog).

**What you should NOT do:**
- Do not re-run the full plan without reviewing the partial receipt first — you may attempt
  to wipe already-sanitized assets unnecessarily.

---

### Runbook 02: Passphrase Forgotten

**Symptom:** MORTIS refuses to open the database with the entered passphrase.

**What MORTIS guarantees:** Nothing. The database is encrypted; there is no master key escrow.

**Options:**
1. If you have a passphrase backup (recommended: store in a physical safe), use it.
2. If you have a database backup (pre-rotation), restore it and use the old passphrase.
3. If neither: the database is unrecoverable. Delete `~/.mortis/mortis.db` and re-initialize
   with `mortis config init`. All inventory, receipts, and plans will be lost.

**Prevention:** Always store your passphrase in an offline, physically secured location before
first use.

---

### Runbook 03: A Deletion Plugin Fails or Times Out

**Symptom:** A run completes but the receipt shows one or more `DeletionPlugin` phases as failed.

**Expected behavior:** This is normal. Remote deletion is best-effort (see §9.3). The run is
considered a partial success (exit code 1).

**Procedure:**
1. Run `mortis receipt inspect --run-id <id> --phase <plugin_name>` to see the error and evidence.
2. Common causes:
   - **Service changed their deletion flow**: Update the plugin or file a bug.
   - **Network timeout**: Re-run only that plugin with `mortis run --plan <path> --phases <plugin_name>`.
   - **Credentials expired**: Re-configure credentials with `mortis inventory update-credential --asset-id <id>`.
   - **Service does not support programmatic deletion**: Mark as `best_effort_only` in inventory; documented in Appendix D.
3. If re-run succeeds, generate a supplementary receipt referencing the original run ID.
4. If re-run cannot succeed (service unavailable): document in your own records that deletion
   was attempted with MORTIS evidence available (receipt).

---

### Runbook 04: Validating a Receipt After a Run

**Purpose:** Verify that a receipt was not tampered with and represents a real MORTIS run.

```bash
# Verify Ed25519 signature and schema validity
mortis receipt verify --receipt ~/.mortis/receipts/<run_id>.receipt.json

# Also verify RFC 3161 timestamp (requires network to reach TSA for cert chain)
mortis receipt verify --receipt <path> --rfc3161

# Export a human-readable summary
mortis receipt export --receipt <path> --format pdf > evidence_<run_id>.pdf
```

Exit code 0 = valid. Exit code 6 = invalid (schema or signature mismatch). Exit code 7 = tampered.

---

### Runbook 05: False Positive Trigger (Trigger Fired Unexpectedly)

**Symptom:** A scheduled, environmental, or remote trigger fired when it should not have.

**Immediate steps:**
1. If a dry-run is configured for that trigger: no damage done. Review logs.
2. If a live run executed: run `mortis receipt inspect --run-id <last>` immediately to assess
   what phases executed and what was affected.
3. Stop the trigger temporarily: `mortis trigger disable --type <type>`.
4. Review trigger configuration: `mortis trigger list` and compare against intended conditions.

**Root causes to check:**
- Environmental trigger threshold too sensitive (e.g., geofence radius too small).
- Remote SMS trigger: check for spoofed sender number.
- Dead man's switch: confirm check-in procedure was followed.

**Prevention:** Always configure a **dry-run-first** policy for automated triggers in
your plan, with a confirmation step before live execution.

---

### Runbook 06: Self-Check Fails (Binary Integrity Warning)

**Symptom:** `mortis self-check` returns exit code 9.

**What this means:** The binary's cosign signature does not verify against the expected
signing identity for your installed version. This may indicate:
- Binary was tampered with after installation.
- You installed from an unofficial source.
- The signing infrastructure changed (check release notes).

**Procedure:**
1. **Do not run MORTIS until this is resolved.**
2. Verify your download source matches the official release page.
3. Re-download the binary and verify the cosign bundle manually:
   ```bash
   cosign verify-blob --bundle mortis-<version>.bundle mortis
   ```
4. If verification passes after re-download: the original binary was corrupted in transit.
5. If verification still fails: report to the security disclosure address (§12.6).

---

### Runbook 07: Safe Testing in a Sandboxed Environment

**Purpose:** Test a full plan (including live phases) without touching real assets.

```bash
# Create a test plan pointing to sandbox directories
mortis inventory add --type local_file --path /tmp/mortis_test/ --label "test-sandbox"

# Run in dry-run mode first — always
mortis run --plan test_plan.toml --dry-run

# Inspect the dry-run receipt
mortis receipt list --last 1
mortis receipt inspect --run-id <id>

# When satisfied, run live against sandbox only (never against real assets during testing)
mortis run --plan test_plan.toml
```

**Rules for safe testing:**
- Never add production credential assets to a test plan.
- Always verify dry-run receipts before live runs.
- Use `--db /tmp/mortis_test.db` to isolate the test database from production.

---

## 14. Change Safety & Versioning

### 14.1 Version Semantics

MORTIS follows **Semantic Versioning (SemVer)**:

| Change Type | Version Bump | Examples |
|-------------|-------------|---------|
| Breaking change to plugin traits, CLI contracts, DB schema, receipt schema | **MAJOR** | Rename plugin method, remove CLI flag, column type change |
| New feature, new plugin, new trigger type (backward compatible) | **MINOR** | New DeletionPlugin, new `--format` option |
| Bug fix, performance, documentation, dependency patch | **PATCH** | Fix timeout logic, log scrubbing fix |

### 14.2 Inventory DB Schema Compatibility

- **Within a MAJOR version:** Migrations are forward-only; old databases are automatically migrated
  on first run of the new version.
- **Across MAJOR versions:** A migration guide is published. Automatic migration is NOT guaranteed.
  Users must follow the migration guide before upgrading.
- **Downgrade:** Not supported. Downgrading after a migration may corrupt the database.
  Always back up `~/.mortis/mortis.db` before upgrading.

### 14.3 Receipt Schema Compatibility

- Receipt JSON files are versioned with a `schema_version` field.
- `mortis receipt verify` supports receipts from **all prior MAJOR versions** (backward compatible verification).
- New fields may be added to receipts in MINOR versions; old verifiers ignore unknown fields.
- Field removal or type change requires a MAJOR version bump and is noted in the changelog.

### 14.4 Plugin Compatibility

- Plugin trait changes are MAJOR version changes.
- Third-party plugins must declare compatible MORTIS version ranges in their manifest.
- The plugin harness will reject plugins built against incompatible trait versions.

### 14.5 Backward Compatibility Testing

CI runs backward compatibility tests on every release:
- Verify a receipt generated by the previous MAJOR version is still valid.
- Open a database created by the previous MINOR version and run all migrations.
- Run `receipt verify` against a corpus of historical receipts.

---

## 15. Dependency Failure Budgets

> This section defines how MORTIS behaves when external dependencies are unavailable or degraded.
> "Graceful degradation" is the governing principle: MORTIS must never fail silently,
> and must always produce a receipt.

| Dependency | Failure Mode | MORTIS Behavior | User Impact |
|------------|-------------|-----------------|-------------|
| RFC 3161 TSA | Unreachable, timeout | Skip TSA step; emit receipt without `rfc3161_token`; log warning | Receipt is valid but lacks independent timestamp |
| Remote service API | 4xx/5xx response | Mark plugin phase as `best_effort_only: true`; continue plan | Receipt records attempt + error; deletion unconfirmed |
| Playwright subprocess | Crash, timeout | Catch panic; mark browser automation phase failed; continue | Browser-based revocations skipped; logged |
| SQLCipher DB | Cannot open | Hard abort BEFORE any destructive phase begins | No destruction occurs; error to stderr |
| SQLCipher DB | Write error mid-run | Attempt receipt persist to file fallback; exit code 1 | Receipt may be file-only |
| Network (general) | No connectivity | Local-only phases proceed; remote phases skipped with logged error | Local sanitization completes; remote revocation deferred |
| SMS/Signal trigger | Signal not received | Dead man's switch fires after configured timeout | Plan executes as configured |
| Filesystem | Permission denied | Log asset as skipped; continue plan; flag in receipt | Affected assets not sanitized |

**Timeout budgets (enforced by Orchestrator):**

| Operation | Timeout |
|-----------|---------|
| RFC 3161 TSA request | 10 seconds |
| DeletionPlugin per call | Configurable; default 30 seconds; max 120 seconds |
| Playwright subprocess per service | Configurable; default 60 seconds; max 300 seconds |
| Trigger evaluation | 5 seconds (hard cap) |
| DB open + migration | 15 seconds |

---

## 16. Security Review & Audit Plan

### 16.1 Internal Review Gates

| Trigger | Required Review |
|---------|----------------|
| Any change to §7 (Crypto Model) | DRI + second cryptography reviewer |
| Any change to plugin trait contracts | DRI + security review |
| Any new DeletionPlugin added | Code review for credential handling + network I/O isolation |
| Any change to PassphraseInterlock | DRI + full test suite re-run |
| MAJOR version release | Full internal security review of all §CANONICAL sections |

### 16.2 External Audit Scope

The following components are **in scope for periodic third-party security audit**:

| Component | Audit Focus | Suggested Cadence |
|-----------|------------|------------------|
| Cryptographic model (§7) | Primitive selection, key derivation, zeroization | Every MAJOR version |
| Plugin sandboxing | Memory isolation, panic handling, timeout enforcement | Every MAJOR version |
| ReceiptEngine | Signature correctness, tamper detection | Every MAJOR version |
| SanitizationEngine | NIST method selection, crypto-erase correctness | Every MAJOR version |
| Binary signing pipeline | Supply chain integrity | Every MAJOR version |

### 16.3 Audit Artifact Requirements

Before an external audit engagement:
- Provide auditors with: this doc, SBOM, `cargo audit` output, and test coverage report.
- Auditors must receive a reproducible build environment (Docker image pinned to MSRV toolchain).
- Audit findings are triaged against the CVE policy in §12.4.
- **Critical and High findings block release** until patched and re-confirmed by auditor.

### 16.4 NIST SP 800-88 Alignment Review

The sanitization method matrix (Appendix C) must be reviewed against the current NIST SP 800-88 Rev 1
publication on every MAJOR version release. Any changes in NIST guidance must be reflected in
Appendix C before release.

---

## 17. Rollout & Milestone Plan

### 17.1 Development Milestones

| Milestone | Deliverable | Exit Criteria |
|-----------|------------|--------------|
| **M1 — Foundation** | Core engine: CLI, InventoryDB, PassphraseInterlock, Orchestrator skeleton, ReceiptEngine (unsigned) | All unit tests pass; `mortis run --dry-run` produces valid receipt |
| **M2 — Sanitization** | SanitizationEngine + SanitizationPlugin suite (Appendix C matrix covered) | NIST method selection integration tests pass; dry-run produces zero FS mutations |
| **M3 — Remote Revocation** | DeletionPlugin suite for initial service set; Playwright automation harness | Plugin isolation tests pass; timeout enforcement verified |
| **M4 — Crypto & Receipts** | Ed25519 signing, PBKDF2 key derivation, RFC 3161 integration | `receipt verify` passes for all receipt variants; tamper detection test passes |
| **M5 — Triggers** | All TriggerType variants: Manual, Scheduled, Environmental, RemoteSignal, DeadManSwitch | Trigger integration tests pass including false-positive prevention |
| **M6 — Hardening** | Reproducible builds, cosign signing, `cargo audit` CI gate, full property-based tests, runbook validation | All CI quality gates pass (§11.3); `self-check` passes |
| **M7 — Beta Release** | Signed binaries on all Tier 1 platforms; SBOM published; external audit initiated | Beta user feedback incorporated; no open Critical/High findings |
| **M8 — Stable v1.0** | Audit complete; all findings resolved; full docs published | Zero open Critical/High audit findings; backward compat tests pass |

### 17.2 Release Safety Process

For every release (PATCH or higher):

1. Run full CI matrix (§11.3) — must be green.
2. Run backward compatibility test suite (§14.5).
3. Run `cargo audit` — zero unexempted CVEs.
4. Build reproducibility verification (two independent build jobs produce identical hashes).
5. Sign binaries with cosign.
6. Publish SBOM.
7. Tag release in git with signed tag (`git tag -s`).
8. Publish release notes including: changelog, SBOM link, cosign bundle, verification instructions.
9. For MAJOR releases: publish migration guide.

---

## 18. Alternatives Considered

| Alternative | Considered For | Why Not Chosen |
|------------|---------------|---------------|
| Go instead of Rust | Core engine language | Rust's memory safety without GC is preferable for crypto-adjacent, long-lived binary; `zeroize` crate ecosystem is stronger |
| AES-GCM instead of SQLCipher | DB encryption | SQLCipher provides transparent at-rest encryption with well-understood threat model; AES-GCM at record level is more complex to implement correctly |
| Multi-pass overwrite (DoD 5220.22-M) as default | Sanitization | NIST SP 800-88 Rev 1 explicitly states multi-pass is not more effective than single-pass on modern media; cryptographic erase is preferred for SSDs |
| gRPC plugin system | Plugin architecture | Local-only binary; in-process Rust traits are safer, faster, and require no IPC attack surface |
| Custom signing scheme | Receipt signing | Ed25519 + RFC 3161 is a well-audited combination with existing tooling; custom schemes add audit burden |
| Electron GUI | User interface | CLI-first keeps MORTIS auditable, scriptable, and reduces attack surface; GUI wrappers can be built on the CLI contract |

---

## 19. Open Questions & Decision Log

### Open Questions

| # | Question | Owner | Target Resolution |
|---|---------|-------|------------------|
| OQ-1 | Should MORTIS support a `--resume-from <phase>` flag for interrupted runs, or require full re-runs? | DRI | M6 |
| OQ-2 | Should receipt `.json` files be GPG-encrypted by default, or opt-in? | DRI | M4 |
| OQ-3 | What is the minimum supported Playwright version, and how is it pinned cross-platform? | M3 lead | M3 |
| OQ-4 | Should the dead man's switch heartbeat use a local file, network endpoint, or both? | DRI | M5 |

### Decision Log

| # | Decision | Date | Rationale |
|---|---------|------|-----------|
| D-1 | Use SQLCipher over application-level AES-GCM | _date_ | See Alternatives §18 |
| D-2 | Use Ed25519 + RFC 3161 for receipts | _date_ | Audited, standard toolchain, no custom crypto |
| D-3 | Rust MSRV = 1.75.0 | _date_ | First stable release with required async trait features |
| D-4 | NIST SP 800-88 Rev 1 as normative sanitization reference | _date_ | Current USG standard; explicitly deprecates multi-pass myth |

---

## Appendix A — Inventory DB Schema (Canonical)

> §CANONICAL. This DDL is the authoritative schema. All migrations must reproduce this state.
> If this appendix conflicts with any other section of this document, this appendix wins.

```sql
-- schema_migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER PRIMARY KEY,
    applied_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- assets
CREATE TABLE IF NOT EXISTS assets (
    id              TEXT    PRIMARY KEY,  -- UUID v4
    asset_type      TEXT    NOT NULL,     -- 'local_file' | 'local_dir' | 'db_record' | 'browser_profile' | 'cloud_account' | 'custom'
    path            TEXT,                 -- filesystem path or URI
    label           TEXT,
    service_id      TEXT,                 -- for cloud_account; references DeletionPlugin.service_ids()
    priority        INTEGER NOT NULL DEFAULT 100,
    sanitization_override TEXT,           -- override Appendix C selection; NULL = use matrix
    credential_id   TEXT REFERENCES credentials(id),
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_service ON assets(service_id);

-- plans
CREATE TABLE IF NOT EXISTS plans (
    id          TEXT PRIMARY KEY,  -- UUID v4
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    is_default  INTEGER NOT NULL DEFAULT 0,  -- boolean; only one plan may be default
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- plan_phases
CREATE TABLE IF NOT EXISTS plan_phases (
    id          TEXT    PRIMARY KEY,  -- UUID v4
    plan_id     TEXT    NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    phase_order INTEGER NOT NULL,
    phase_type  TEXT    NOT NULL,  -- 'revoke_remote' | 'sanitize_local' | 'clear_browser' | 'wipe_db' | 'self_destruct'
    asset_ids   TEXT    NOT NULL,  -- JSON array of asset UUIDs
    continue_on_failure INTEGER NOT NULL DEFAULT 1,  -- boolean
    UNIQUE(plan_id, phase_order)
);

CREATE INDEX IF NOT EXISTS idx_plan_phases_plan ON plan_phases(plan_id);

-- credentials (values are encrypted at application layer before storage)
CREATE TABLE IF NOT EXISTS credentials (
    id              TEXT PRIMARY KEY,  -- UUID v4
    service_id      TEXT NOT NULL,
    credential_type TEXT NOT NULL,     -- 'oauth_token' | 'api_key' | 'username_password' | 'session_cookie'
    encrypted_value TEXT NOT NULL,     -- base64(AES-256-GCM(value, derived_key))
    expires_at      TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    rotated_at      TEXT
);

-- receipts
CREATE TABLE IF NOT EXISTS receipts (
    run_id              TEXT    PRIMARY KEY,  -- UUID v4
    schema_version      TEXT    NOT NULL DEFAULT '1.0',
    plan_id             TEXT    REFERENCES plans(id),
    triggered_by        TEXT    NOT NULL,
    dry_run             INTEGER NOT NULL,  -- boolean
    coercion            INTEGER NOT NULL DEFAULT 0,  -- boolean
    overall_result      TEXT    NOT NULL,  -- 'success' | 'partial' | 'failed' | 'interrupted'
    phases_total        INTEGER NOT NULL,
    phases_succeeded    INTEGER NOT NULL,
    phases_failed       INTEGER NOT NULL,
    bytes_processed     INTEGER NOT NULL DEFAULT 0,
    started_at          TEXT    NOT NULL,
    completed_at        TEXT,
    signature           TEXT,   -- base64(Ed25519 sig over SHA-256 of canonical receipt JSON)
    rfc3161_token       TEXT,   -- base64-encoded RFC 3161 timestamp token
    receipt_json_path   TEXT    -- path to .receipt.json file
);

-- receipt_phases
CREATE TABLE IF NOT EXISTS receipt_phases (
    id              TEXT PRIMARY KEY,  -- UUID v4
    run_id          TEXT NOT NULL REFERENCES receipts(run_id) ON DELETE CASCADE,
    phase_order     INTEGER NOT NULL,
    phase_type      TEXT    NOT NULL,
    plugin_name     TEXT,
    asset_id        TEXT,
    result          TEXT    NOT NULL,  -- 'success' | 'partial' | 'failed' | 'skipped'
    best_effort     INTEGER NOT NULL DEFAULT 0,  -- boolean
    bytes_processed INTEGER NOT NULL DEFAULT 0,
    duration_ms     INTEGER,
    evidence        TEXT,   -- plugin-supplied evidence string
    error           TEXT,
    recorded_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_receipt_phases_run ON receipt_phases(run_id);

-- run_metrics
CREATE TABLE IF NOT EXISTS run_metrics (
    run_id              TEXT PRIMARY KEY REFERENCES receipts(run_id),
    run_duration_ms     INTEGER,
    plugins_invoked     INTEGER,
    plugins_timed_out   INTEGER,
    receipt_signed      INTEGER,
    rfc3161_timestamped INTEGER
);

-- config
CREATE TABLE IF NOT EXISTS config (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,  -- encrypted for sensitive keys
    is_sensitive INTEGER NOT NULL DEFAULT 0,
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

---

## Appendix B — Receipt Schema (Canonical)

> §CANONICAL. The JSON schema below is authoritative. `receipt verify` validates against this schema.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "mortis-receipt-v1.0",
  "type": "object",
  "required": ["header", "phases", "summary", "signature"],
  "properties": {
    "header": {
      "type": "object",
      "required": ["run_id", "schema_version", "triggered_by", "dry_run", "started_at"],
      "properties": {
        "run_id":         { "type": "string", "format": "uuid" },
        "schema_version": { "type": "string", "enum": ["1.0"] },
        "triggered_by":   { "type": "string" },
        "dry_run":        { "type": "boolean" },
        "coercion":       { "type": "boolean", "default": false },
        "plan_id":        { "type": "string", "format": "uuid" },
        "started_at":     { "type": "string", "format": "date-time" },
        "completed_at":   { "type": ["string", "null"], "format": "date-time" }
      }
    },
    "phases": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["phase_order", "phase_type", "result"],
        "properties": {
          "phase_order":    { "type": "integer", "minimum": 0 },
          "phase_type":     { "type": "string" },
          "plugin_name":    { "type": ["string", "null"] },
          "asset_id":       { "type": ["string", "null"], "format": "uuid" },
          "result":         { "type": "string", "enum": ["success", "partial", "failed", "skipped"] },
          "best_effort":    { "type": "boolean", "default": false },
          "bytes_processed":{ "type": "integer", "minimum": 0 },
          "duration_ms":    { "type": ["integer", "null"] },
          "evidence":       { "type": ["string", "null"] },
          "error":          { "type": ["string", "null"] },
          "recorded_at":    { "type": "string", "format": "date-time" }
        }
      }
    },
    "summary": {
      "type": "object",
      "required": ["overall_result", "phases_total", "phases_succeeded", "phases_failed", "bytes_processed"],
      "properties": {
        "overall_result":   { "type": "string", "enum": ["success", "partial", "failed", "interrupted"] },
        "phases_total":     { "type": "integer" },
        "phases_succeeded": { "type": "integer" },
        "phases_failed":    { "type": "integer" },
        "bytes_processed":  { "type": "integer" }
      }
    },
    "signature": {
      "type": "object",
      "required": ["algorithm", "public_key_id", "body_hash", "value"],
      "properties": {
        "algorithm":     { "type": "string", "enum": ["Ed25519"] },
        "public_key_id": { "type": "string" },
        "body_hash":     { "type": "string", "description": "hex SHA-256 of canonical receipt body (header+phases+summary, keys sorted, no whitespace)" },
        "value":         { "type": "string", "description": "base64url-encoded Ed25519 signature over body_hash bytes" }
      }
    },
    "rfc3161_token": {
      "type": ["string", "null"],
      "description": "base64-encoded RFC 3161 timestamp token; null if TSA was unavailable or disabled"
    }
  }
}
```

---

## Appendix C — Sanitization Method Matrix (Canonical)

> §CANONICAL. The SanitizationEngine must use this matrix for method selection.
> Column "Override Allowed" = whether `sanitization_override` in the asset record may change this.

| Media Type | Recommended Method | NIST SP 800-88 Ref | Override Allowed | Notes |
|------------|-------------------|-------------------|-----------------|-------|
| HDD (magnetic, spinning) | Overwrite (1-pass, random) | SP 800-88 §2.3 | Yes | Multi-pass adds no measurable security benefit per NIST |
| SSD / NVMe | Cryptographic Erase | SP 800-88 §2.5 | Yes | Overwrite unreliable due to wear leveling |
| eMMC / SD card | Cryptographic Erase | SP 800-88 §2.5 | Yes | Same as SSD |
| RAM disk / tmpfs | Overwrite (1-pass, zeros) | SP 800-88 §2.3 | No | Ephemeral; overwrite is sufficient |
| Encrypted volume (pre-encrypted) | Discard encryption key | SP 800-88 §2.5 | No | Key discard renders data unrecoverable |
| Database records | Overwrite fields + VACUUM | SP 800-88 §2.3 | Yes | SQLite WAL + journal must also be cleared |
| Browser profile / cache | Delete + overwrite free space | Application-level | Yes | Include Local Storage, IndexedDB, cookies |
| Optical media | Out of scope (physical destruction required) | SP 800-88 §2.4 | N/A | Document in receipt; user must physically destroy |
| Cloud storage (remote) | API deletion call (best-effort) | SP 800-88 §2.5 | No | See §9.3: cannot guarantee cloud erasure |

---

## Appendix D — Threat/Mitigation Table (Canonical)

> §CANONICAL. All identified threats and their mitigations are listed here.
> New threats must be added here before a mitigating PR is merged.

| # | Threat | Attack Vector | Impact | Likelihood | Mitigation | Residual Risk |
|---|--------|--------------|--------|-----------|-----------|--------------|
| T-1 | Remote trigger spoofing | Attacker sends fake SMS/webhook to trigger plan | Unauthorized destruction | Medium | Require HMAC-signed trigger payloads; configurable sender allowlist; confirm code for high-priority plans | Low |
| T-2 | Trigger replay attack | Attacker replays previously valid trigger signal | Unauthorized re-execution | Low | Trigger messages include nonce + timestamp; nonces stored in DB; reject replays | Low |
| T-3 | Passphrase dictionary/brute-force | Attacker with DB file copy runs offline attack | Full DB decryption | Medium | PBKDF2-SHA512 100k iterations + 32-byte salt raises attack cost; recommend 20+ char passphrase | Medium (passphrase quality–dependent) |
| T-4 | Coercion / duress | Operator compelled to unlock MORTIS | Full plan execution under adversary observation | Low | Duress passphrase executes reduced plan; receipt tagged `coercion: true` | Low |
| T-5 | Plugin memory isolation breach | Malicious/buggy plugin reads core memory | Credential or key exfiltration | Low | Plugins run within process but receive only typed structs; no raw memory pointers shared; plugin panic caught and isolated | Low |
| T-6 | Playwright automation hijack | Malicious JS on revocation service page exfiltrates session | Credential exposure | Medium | Playwright runs in isolated context; no persistent browser profile; session cookies not persisted post-run | Low |
| T-7 | Receipt tampering | Attacker modifies receipt to obscure evidence | Evidence integrity loss | Low | Ed25519 signature over canonical JSON; `receipt verify` detects any modification; RFC 3161 provides independent timestamp | Very Low |
| T-8 | Supply chain compromise | Malicious code injected into release binary | Full system compromise | Low | Reproducible builds; cosign keyless signing; SBOM; `self-check` on install | Low |
| T-9 | False positive trigger | Environmental condition mis-evaluated | Unintended destruction | Medium | Dry-run-first policy for automated triggers; configurable confidence threshold; second-factor confirmation option | Low |
| T-10 | Partial sanitization undetected | Phase fails silently, asset not fully sanitized | Data exposure despite apparent wipe | Low | All phase outcomes recorded in receipt; `continue_on_failure` is logged, not silent; receipt exit code 1 for partial runs | Low |
| T-11 | Key material in memory after run | Derived key not zeroized on exit | Key recovery from memory dump | Low | `zeroize` crate applied to all key material, passphrases, and derived keys before process exit | Very Low |
| T-12 | Dependency CVE exploitation | Known vulnerability in `ring`, `sqlcipher`, etc. | Variable | Medium | `cargo audit` in CI; CVE response SLA (§12.4); pinned dependency versions | Low |
```

---

That is the complete replacement `MORTIS.md`. It is a **direct drop-in** — no content from the old doc is lost, and every gap identified in the analysis (governance, supply chain, runbooks, canonicality, SLOs, change safety, dependency budgets, audit plan) is now a first-class section. The §CANONICAL markers and the Appendix precedence rules mean the doc can evolve without drifting into the ambiguity that typically degrades production specs over time.
