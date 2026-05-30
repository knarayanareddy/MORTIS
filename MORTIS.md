💀 MORTIS
Comprehensive Engineering Design Document
Version 1.0 | Cryptographically Accountable Digital Self-Destruct & Privacy Teardown Orchestrator
TABLE OF CONTENTS

    Project Overview & Vision
    Goals, Non-Goals & Constraints
    System Architecture
    Module Breakdown
        4.1 Inventory Engine
        4.2 Trigger System
        4.3 Destruction Orchestrator
        4.4 Credential Revocation Engine
        4.5 Local Sanitization Engine
        4.6 Remote Deletion Engine
        4.7 Browser Automation Layer (Playwright)
        4.8 Cryptographic Receipt System
        4.9 Dead Man's Switch Scheduler
        4.10 Canary System
        4.11 Notification & Final Message Dispatcher
        4.12 CLI Interface
    Data Models & Schemas
    API Specifications
    Directory Structure
    Configuration System
    Cryptography & Key Management
    Destruction Phase Choreography
    Local Sanitization Deep Dive
    Remote Deletion Deep Dive
    Credential Revocation Deep Dive
    Cryptographic Receipt Deep Dive
    Browser Automation Deep Dive
    Dead Man's Switch Deep Dive
    Canary System Deep Dive
    Security Model & Threat Boundaries
    Storage & Persistence
    Logging, Observability & Debugging
    Testing Strategy
    Build, Packaging & Installation
    Platform Support Matrix
    Performance Targets & Benchmarks
    Error Handling Strategy
    Dependency Registry
    Milestone & Phased Rollout Plan
    Open Questions & Future Work

1. Project Overview & Vision
1.1 What is MORTIS?

MORTIS is a local, user-owned, cryptographically accountable digital self-destruct orchestrator that runs entirely on the user's machine. It maintains an always-current, encrypted inventory of a user's complete digital footprint and, when triggered by any of several configurable mechanisms, executes a precisely choreographed sequence that:

    Exports user-designated data into an encrypted archive before destruction
    Revokes all credentials, API keys, OAuth tokens, and active sessions
    Wipes local files, secrets vaults, SSH keys, browser data, and device secrets using media-appropriate sanitization techniques
    Requests deletion on remote platforms and online services via API, browser automation, and GDPR Article 17 right-to-erasure workflows
    Produces a signed, RFC 3161-timestamped cryptographic receipt auditing every action taken — what succeeded, what failed, and when

All processing is local. No data leaves the machine. No cloud subscription is required. The user owns the process entirely.
1.2 The Problem Being Solved

Modern digital life generates a sprawling, unmanaged footprint:

    Credentials scattered across password managers, SSH key chains, browser vaults, cloud provider dashboards, and CI systems
    Active sessions on dozens of platforms that persist for days, weeks, or indefinitely
    Local files synchronized across cloud storage, often with no clear deletion path
    Platform accounts carrying years of behavioral data, messages, photos, and transaction history
    No single tool that treats the entirety of this footprint as something that can be deliberately, orderly, and evidentially dismantled

High-risk users — journalists, activists, whistleblowers, abuse survivors, people operating under duress — have an acute need for a system that does exactly this. But the problem is universal: anyone who has ever tried to "leave the internet" knows how hard it is.

MORTIS gives users a technically rigorous, locally-sovereign tool to orchestrate their own digital exit — or to prepare for one they hope never to need.
1.3 Design Philosophy
Principle	Description
Evidence-first	Every action is logged, timestamped, and signed. "I ran this" is provable. "The cloud deleted it" is evidenced as a request + observed outcome.
Human-in-the-loop	No destruction run begins without explicit, passphrase-confirmed user intent. Dead man's switch and canary modes have configurable grace windows.
Local-first	All cryptographic operations, scheduling, and data storage run on the user's machine.
Media-aware	Local sanitization follows NIST SP 800-88 device-class-specific guidance, not folklore-based multi-pass overwrite patterns.
Gracefully bounded	The system is honest about what it can prove. Local wipes can be strongly evidenced. Remote deletions are evidenced as requests + verification attempts.
Composable	Per-service deletion plugins. New services are added by writing a plugin, not by patching core logic.
Non-retaliatory	MORTIS never generates fake traffic, poisons analytics, exhausts remote resources, or acts outside the destruction scope.
2. Goals, Non-Goals & Constraints
2.1 Goals (In Scope)

    Encrypted, continuously refreshed inventory of credentials, accounts, local secrets, and cloud sync footprints
    Multi-trigger activation: manual passphrase, dead man's switch, hardware token presence/removal, canary tripwire, remote encrypted signal
    Ordered destruction choreography: export → revoke → keys → vault → cloud → local → verify → receipt → notify → self-delete
    Credential revocation for all major platforms where revocation APIs exist
    Local file sanitization using NIST SP 800-88-appropriate techniques per detected media class (HDD, SSD, NVMe, removable)
    Remote account deletion via platform APIs, browser automation (Playwright), and GDPR Article 17 request generation
    Cryptographic receipt: PGP-signed, RFC 3161-timestamped JSON audit log
    Dead man's switch with configurable check-in interval and grace window
    Canary token system with escalation-first, detonation-second logic
    Encrypted final message dispatch (SMTP, Signal-compatible, or file drop) upon completion
    Duress code support (alternate passphrase that silently omits export phase)
    "Dry run" / simulation mode that produces a full plan without executing it
    Cross-platform: macOS, Linux, Windows

2.2 Non-Goals (Explicitly Out of Scope)

    ❌ Analytics poisoning, fake traffic generation, or resource exhaustion against third-party services
    ❌ Breaking TLS on traffic not routed through the tool
    ❌ Acting as a VPN or anonymizing router
    ❌ CAPTCHA solving or any challenge bypass
    ❌ Guaranteeing cloud-side deletion (can only evidence requests + verify observable outcomes)
    ❌ Guaranteeing removal from search engine caches, third-party scrapes, or archived copies
    ❌ Autonomous keyboard/mouse control without user approval (in interactive modes)
    ❌ Cloud sync or remote telemetry of any kind
    ❌ Multi-user orchestration (one user, one machine per MORTIS instance)

2.3 Constraints

    All cryptographic operations use audited Rust crates (ring, sequoia-pgp, rustls)
    Inventory database encrypted with SQLCipher (AES-256-CBC) at rest
    Destruction run cannot proceed without explicit passphrase confirmation
    All destruction receipts are produced regardless of partial failure — MORTIS must not silently swallow errors
    Local sanitization method is selected per detected media class, not hardcoded
    "Provable destruction" is explicitly scoped: local actions are strongly evidenced, remote actions are evidenced as requests + observed outcomes
    Single binary deployment (Rust static binary, no runtime dependencies)
    Proxy latency: N/A (MORTIS does not intercept live traffic)

3. System Architecture
3.1 High-Level Architecture Diagram

text

┌─────────────────────────────────────────────────────────────────────────┐
│                           USER'S MACHINE                                │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                       MORTIS CORE                                │   │
│  │                                                                  │   │
│  │  ┌─────────────┐    ┌─────────────────────────────────────────┐ │   │
│  │  │   CLI       │    │          TRIGGER SYSTEM                 │ │   │
│  │  │  (clap)     │───►│  Manual │ DeadMan │ Hardware │ Canary   │ │   │
│  │  └─────────────┘    │                   │ Remote Signal       │ │   │
│  │                     └────────────────┬──────────────────────  ┘ │   │
│  │                                      │ TRIGGER FIRED             │   │
│  │                                      ▼                           │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │             DESTRUCTION ORCHESTRATOR                      │  │   │
│  │  │  Phase 1: Export  →  Phase 2: Revoke  →  Phase 3: Keys    │  │   │
│  │  │  Phase 4: Vault   →  Phase 5: Cloud   →  Phase 6: Local   │  │   │
│  │  │  Phase 7: Verify  →  Phase 8: Receipt →  Phase 9: Notify  │  │   │
│  │  │  Phase 10: Self-Delete                                     │  │   │
│  │  └─────────────┬────────────┬─────────────┬──────────────────┘  │   │
│  │                │            │             │                      │   │
│  │  ┌─────────────▼──┐  ┌──────▼──────┐ ┌───▼──────────────────┐  │   │
│  │  │  Credential    │  │   Local     │ │  Remote Deletion     │  │   │
│  │  │  Revocation    │  │  Sanitizer  │ │  Engine + Playwright │  │   │
│  │  │  Engine        │  │  (NIST 800) │ │  Automation          │  │   │
│  │  └────────────────┘  └─────────────┘ └──────────────────────┘  │   │
│  │                                                                  │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │         CRYPTOGRAPHIC RECEIPT SYSTEM                      │  │   │
│  │  │   PGP Sign (sequoia-pgp)  +  RFC 3161 Timestamp           │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────┐  ┌──────────────────────────────┐ │   │
│  │  │   INVENTORY ENGINE       │  │   NOTIFICATION DISPATCHER    │ │   │
│  │  │   (SQLCipher DB)         │  │   SMTP / Signal / File Drop  │ │   │
│  │  └──────────────────────────┘  └──────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                           │  Remote deletion requests only
                    ┌──────▼──────┐
                    │  INTERNET   │
                    │  (Services) │
                    └─────────────┘

3.2 Destruction Flow (Step by Step)

text

Step 1:  Trigger fires (manual passphrase / dead man's timer / HW event / canary / remote signal)
Step 2:  Orchestrator loads encrypted inventory from SQLCipher DB (requires passphrase)
Step 3:  Orchestrator builds a Destruction Plan from inventory (ordered phase list + per-asset action)
Step 4:  If --dry-run: output plan to stdout/file and exit. No destruction.
Step 5:  Phase 1 — EXPORT: Compress + encrypt designated assets to archive. Write archive path to state.
Step 6:  Phase 2 — REVOKE CREDENTIALS: Call platform revocation APIs. Log each result (success/fail/delay).
Step 7:  Phase 3 — KEY DESTRUCTION: Zero and unlink SSH keys, GPG keys, TLS client certs, cloud CLI creds.
Step 8:  Phase 4 — VAULT WIPE: Purge password manager vaults and secret stores.
Step 9:  Phase 5 — CLOUD DELETION: Submit deletion requests per-service (API / Playwright / GDPR form).
Step 10: Phase 6 — LOCAL SANITIZATION: Overwrite and unlink local files per NIST 800-88 media class.
Step 11: Phase 7 — VERIFICATION: Re-check each deletion (cloud: HTTP probe / local: file presence / revoke: re-auth attempt).
Step 12: Phase 8 — RECEIPT: Compile all phase logs into JSON receipt. PGP sign. RFC 3161 timestamp. Write to disk.
Step 13: Phase 9 — NOTIFY: Dispatch final messages to configured recipients.
Step 14: Phase 10 — SELF-DELETE: Wipe MORTIS configuration, inventory DB, keys, and binary (optional).

3.3 Component Ownership
Component	Language	Owns
CLI	Rust (clap)	User interaction, config, trigger invocation
Inventory Engine	Rust + SQLCipher	Asset catalog, plan generation
Trigger System	Rust + Tokio	All trigger types, grace windows, escalation
Destruction Orchestrator	Rust	Phase sequencing, state machine, error aggregation
Credential Revocation Engine	Rust (reqwest)	Platform API calls, revocation status tracking
Local Sanitization Engine	Rust	Media detection, wipe method dispatch, verification
Remote Deletion Engine	Rust + Playwright	Per-service plugins, API + browser automation
Cryptographic Receipt System	Rust (sequoia-pgp, RFC3161)	Signing, timestamping, receipt serialization
Dead Man's Switch	Rust + Tokio	Check-in scheduling, timer, grace window
Canary System	Rust	Token deployment, tripwire monitoring
Notification Dispatcher	Rust (lettre, SMTP)	Final message dispatch
4. Module Breakdown
4.1 Inventory Engine

Purpose

The Inventory Engine maintains the encrypted, continuously-refreshed catalog of everything MORTIS will act on during a destruction run. It is the single source of truth for the destruction plan. If something is not in the inventory, MORTIS will not act on it.

Inventory Categories

text

INVENTORY
├── Credentials
│   ├── Password manager entries (TOTP, passwords, notes)
│   ├── SSH key pairs (with filesystem paths)
│   ├── GPG/PGP private keys
│   ├── API tokens (cloud providers, CI, SaaS)
│   ├── OAuth grants (per platform)
│   └── Browser saved passwords + active sessions
│
├── Accounts
│   ├── Platform accounts (social, email, SaaS, forums)
│   ├── Deletion method metadata (API / browser / GDPR / manual)
│   ├── Expected verification signal per service
│   └── Data retention policy per service (if known)
│
├── Local Assets
│   ├── File paths and directory trees to sanitize
│   ├── Media class per path (HDD / SSD / NVMe / removable)
│   ├── Designation (destroy / export-then-destroy / keep)
│   └── Cloud sync state (synced to Drive/Dropbox/iCloud?)
│
├── Cloud Sync Footprints
│   ├── Provider (Drive, Dropbox, iCloud, OneDrive, etc.)
│   ├── Remote path / folder ID
│   └── Deletion method (API / GUI / token revoke first)
│
└── Secrets Stores
    ├── Password manager vaults (1Password, Bitwarden, KeePass, etc.)
    ├── macOS Keychain entries
    ├── Linux Secret Service entries
    ├── Windows Credential Manager entries
    └── Browser credential stores (per browser)

Implementation

Rust

// src/inventory/mod.rs

use sqlcipher::Connection;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryAsset {
    pub id: Uuid,
    pub category: AssetCategory,
    pub label: String,
    pub platform: Option<String>,
    pub local_path: Option<String>,
    pub deletion_method: DeletionMethod,
    pub designation: AssetDesignation,
    pub media_class: Option<MediaClass>,
    pub sync_state: SyncState,
    pub revocation_endpoint: Option<String>,
    pub verification_signal: Option<VerificationSignal>,
    pub last_verified: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AssetCategory {
    Credential,
    Account,
    LocalFile,
    CloudSync,
    SecretsStore,
    SshKey,
    GpgKey,
    ApiToken,
    OAuthGrant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeletionMethod {
    Api { endpoint: String, auth_type: AuthType },
    BrowserAutomation { plugin: String },
    GdprArticle17 { template: String, contact: String },
    ManualRunbook { instructions: String },
    LocalOnly, // No remote component
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AssetDesignation {
    Destroy,
    ExportThenDestroy { archive_path: String },
    Keep,
    Skip,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MediaClass {
    Hdd,
    Ssd,
    Nvme,
    Removable,
    RamDisk,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationSignal {
    pub signal_type: VerificationType,
    pub endpoint: Option<String>,
    pub expected_status: Option<u16>,
    pub expected_body_absent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VerificationType {
    HttpProbe,        // 404 / 410 expected
    ReAuthAttempt,    // Credential should fail
    FileAbsent,       // Path should not exist
    ApiQuery,         // Platform-specific query returns empty/deleted
    ManualCheck,      // Cannot automate — flag for human verification
}

Inventory Connectors

Inventory is populated via pluggable connectors that scan known data sources:

Rust

// src/inventory/connectors/mod.rs

pub trait InventoryConnector: Send + Sync {
    fn name(&self) -> &str;
    fn scan(&self, ctx: &ScanContext) -> Result<Vec<InventoryAsset>, ConnectorError>;
    fn is_available(&self) -> bool;
}

pub struct PasswordManagerConnector;     // 1Password, Bitwarden, KeePass export parsing
pub struct SshKeyConnector;              // ~/.ssh/ scan
pub struct GpgKeyConnector;              // gpg --list-secret-keys
pub struct BrowserCredentialConnector;  // Chrome/Firefox profile credential scan
pub struct CloudCliConnector;           // AWS ~/.aws/, GCP ~/.config/gcloud, etc.
pub struct OAuthGrantScanner;           // GitHub/Google OAuth grant pages (Playwright)
pub struct EmailAccountScanner;         // IMAP scan for account creation patterns
pub struct FilesystemConnector;         // User-defined directories
pub struct MacOsKeychainConnector;      // macOS Keychain
pub struct LinuxSecretServiceConnector; // GNOME Keyring / KWallet
pub struct WindowsCredentialConnector;  // Windows Credential Manager

Deletion Method Registry

Each account type has registered deletion metadata, maintained as a community-curated dataset inside MORTIS:

Rust

// src/inventory/deletion_registry.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceDeletionRecord {
    pub service_name: String,
    pub domain: String,
    pub deletion_difficulty: DeletionDifficulty,  // Easy / Medium / Hard / VeryHard
    pub has_api: bool,
    pub api_endpoint: Option<String>,
    pub browser_plugin: Option<String>,
    pub direct_deletion_url: Option<String>,
    pub gdpr_contact: Option<String>,
    pub expected_processing_days: u32,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeletionDifficulty {
    Easy,      // API or single-page UI deletion
    Medium,    // Multi-step UI, 24-48hr processing
    Hard,      // Email to support required, 7-30 day processing
    VeryHard,  // Requires physical mail, ID verification, or is practically impossible
}

4.2 Trigger System

Purpose

The Trigger System monitors all configured activation vectors and fires the Destruction Orchestrator when any trigger condition is satisfied. Each trigger type has its own failure modes, and the Trigger System models them explicitly.

Trigger Types

Rust

// src/triggers/mod.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TriggerType {
    Manual {
        passphrase_hash: String,          // Argon2id hash of activation passphrase
        duress_passphrase_hash: String,   // Alternate passphrase: omits export phase silently
        require_confirmation: bool,
    },
    DeadManSwitch {
        check_in_interval: Duration,
        grace_window: Duration,
        check_in_method: CheckInMethod,
        last_check_in: Option<DateTime<Utc>>,
    },
    HardwarePresence {
        device_id: String,               // USB key / hardware token identifier
        trigger_on: HardwareTriggerMode, // Removal or Absence
        debounce_ms: u64,                // Prevent flaky USB from triggering
        require_software_confirm: bool,  // Require passphrase even after HW event
    },
    Canary {
        canary_id: String,
        escalation_mode: CanaryEscalationMode,
        grace_window: Duration,
    },
    RemoteSignal {
        endpoint: String,                // Local port listening for encrypted signal
        signal_pubkey: String,           // Only accept signals encrypted to this key
        require_passphrase: bool,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CheckInMethod {
    Passphrase,           // Interactive CLI check-in
    TotpToken,            // TOTP-based check-in
    FileTouch { path: String },    // Touch a specific file within interval
    NetworkBeacon { url: String }, // Phone home to local canary server
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HardwareTriggerMode {
    OnRemoval,    // Fires when token is removed
    OnAbsence,    // Fires when token is not detected at check interval
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CanaryEscalationMode {
    EscalateOnly,              // Alert user — never destroy without explicit confirmation
    EscalateWithGraceWindow,   // Alert, then auto-destroy after grace window expires
    ImmediateDestruct,         // Only for explicit "I am certain this means compromise" cases
}

Trigger Monitor (Tokio-based)

Rust

// src/triggers/monitor.rs

use tokio::time::{interval, sleep};
use tokio::sync::mpsc;

pub struct TriggerMonitor {
    triggers: Vec<Box<dyn Trigger>>,
    event_tx: mpsc::Sender<TriggerEvent>,
    config: TriggerConfig,
}

#[derive(Debug)]
pub struct TriggerEvent {
    pub trigger_type: TriggerType,
    pub fired_at: DateTime<Utc>,
    pub confidence: TriggerConfidence,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug)]
pub enum TriggerConfidence {
    Confirmed,       // Passphrase entered, user present
    High,            // Hardware event + software verification
    Medium,          // Dead man's switch timer expired within grace window
    Canary,          // Tripwire accessed — treat as escalation signal
}

impl TriggerMonitor {
    pub async fn run(&mut self) {
        let mut check_interval = interval(Duration::from_secs(30));
        loop {
            check_interval.tick().await;
            for trigger in &self.triggers {
                if let Some(event) = trigger.check().await {
                    // Log the trigger event before acting
                    tracing::warn!(
                        trigger_type = ?event.trigger_type,
                        confidence = ?event.confidence,
                        "Trigger fired"
                    );
                    if let Err(e) = self.event_tx.send(event).await {
                        tracing::error!("Failed to send trigger event: {}", e);
                    }
                }
            }
        }
    }
}

Safety Interlock

Regardless of which trigger fires, the safety interlock is always evaluated first:

Rust

// src/triggers/safety.rs

pub struct SafetyInterlock {
    require_passphrase_for: Vec<TriggerType>, // Which trigger types require passphrase even if fired
    cooldown_period: Duration,                 // Minimum time between trigger activations
    last_activation: Option<DateTime<Utc>>,
    max_activations_per_hour: u8,
}

impl SafetyInterlock {
    pub fn evaluate(&mut self, event: &TriggerEvent) -> SafetyDecision {
        // Prevent double-fire
        if let Some(last) = self.last_activation {
            if Utc::now() - last < self.cooldown_period {
                return SafetyDecision::Block {
                    reason: "Cooldown period has not elapsed".to_string(),
                };
            }
        }
        // Canary always escalates first, never immediately destroys by default
        if matches!(event.trigger_type, TriggerType::Canary { .. }) {
            if event.confidence != TriggerConfidence::Confirmed {
                return SafetyDecision::Escalate {
                    reason: "Canary fired — requiring user confirmation before proceeding".to_string(),
                };
            }
        }
        SafetyDecision::Allow
    }
}

4.3 Destruction Orchestrator

Purpose

The Destruction Orchestrator is the state machine that sequences all ten destruction phases. It is the heart of MORTIS: it consumes the inventory, dispatches work to specialist engines, aggregates results, handles partial failures without silently dropping them, and ultimately hands off to the Receipt System.

Phase State Machine

Rust

// src/orchestrator/mod.rs

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PhaseState {
    Pending,
    Running,
    Completed { result: PhaseResult },
    Failed { error: String, partial_results: Vec<AssetActionResult> },
    Skipped { reason: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DestructionRun {
    pub run_id: Uuid,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub trigger_event: TriggerEvent,
    pub is_dry_run: bool,
    pub is_duress: bool,  // Set when duress passphrase was used
    pub phases: HashMap<PhaseId, PhaseState>,
    pub asset_actions: Vec<AssetActionResult>,
    pub total_assets: u32,
    pub assets_completed: u32,
    pub assets_failed: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetActionResult {
    pub asset_id: Uuid,
    pub asset_label: String,
    pub phase: PhaseId,
    pub action_taken: String,
    pub success: bool,
    pub error: Option<String>,
    pub evidence: Vec<EvidenceArtifact>,  // HTTP responses, file hashes, etc.
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceArtifact {
    pub artifact_type: ArtifactType,
    pub content_hash: String,  // SHA-256 of artifact content
    pub summary: String,
    pub raw_data: Option<Vec<u8>>, // HTTP response body, etc.
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ArtifactType {
    HttpResponse,
    FileHashBefore,
    FileHashAfter,
    VerificationProbe,
    RevocationConfirmation,
    GdprTicketId,
    ScreenshotHash,
}

Orchestrator Core

Rust

// src/orchestrator/runner.rs

pub struct DestructionOrchestrator {
    inventory: Arc<InventoryEngine>,
    exporter: Arc<ExportEngine>,
    revoker: Arc<CredentialRevocationEngine>,
    sanitizer: Arc<LocalSanitizationEngine>,
    remote_deleter: Arc<RemoteDeletionEngine>,
    receipt: Arc<ReceiptSystem>,
    notifier: Arc<NotificationDispatcher>,
    config: OrchestratorConfig,
}

impl DestructionOrchestrator {
    pub async fn execute(&self, trigger: TriggerEvent, opts: RunOptions) -> DestructionRun {
        let run_id = Uuid::new_v4();
        let mut run = DestructionRun::new(run_id, trigger, opts.dry_run, opts.duress);

        // Phase 1: Export
        if !opts.duress {
            run.execute_phase(PhaseId::Export, || {
                self.exporter.export_designated_assets(&run)
            }).await;
        } else {
            run.skip_phase(PhaseId::Export, "Duress mode: export phase silently skipped");
        }

        // Phase 2: Revoke Credentials
        run.execute_phase(PhaseId::RevokeCredentials, || {
            self.revoker.revoke_all(&run)
        }).await;

        // Phase 3: Key Destruction
        run.execute_phase(PhaseId::DestroyKeys, || {
            self.sanitizer.wipe_keys(&run)
        }).await;

        // Phase 4: Vault Wipe
        run.execute_phase(PhaseId::WipeVaults, || {
            self.sanitizer.wipe_vaults(&run)
        }).await;

        // Phase 5: Cloud Deletion
        run.execute_phase(PhaseId::CloudDeletion, || {
            self.remote_deleter.delete_all(&run)
        }).await;

        // Phase 6: Local Sanitization
        run.execute_phase(PhaseId::LocalSanitization, || {
            self.sanitizer.sanitize_local_files(&run)
        }).await;

        // Phase 7: Verification
        run.execute_phase(PhaseId::Verify, || {
            self.verify_all(&run)
        }).await;

        // Phase 8: Receipt (always runs, even if earlier phases failed)
        run.execute_phase(PhaseId::Receipt, || {
            self.receipt.generate_and_sign(&run)
        }).await;

        // Phase 9: Notify
        run.execute_phase(PhaseId::Notify, || {
            self.notifier.dispatch(&run)
        }).await;

        // Phase 10: Self-Delete (if configured)
        if self.config.self_delete_on_completion {
            run.execute_phase(PhaseId::SelfDelete, || {
                self.self_delete()
            }).await;
        }

        run.completed_at = Some(Utc::now());
        run
    }
}

4.4 Credential Revocation Engine

Purpose

Revokes all active credentials, tokens, and sessions across every configured platform. Because credential revocation is the most time-critical phase (it stops ongoing access immediately), it runs before any local wipe occurs.

Rust

// src/revocation/mod.rs

#[async_trait]
pub trait RevocationPlugin: Send + Sync {
    fn service_name(&self) -> &str;
    async fn revoke(&self, asset: &InventoryAsset, ctx: &RevocationContext)
        -> RevocationResult;
    async fn verify_revoked(&self, asset: &InventoryAsset, ctx: &RevocationContext)
        -> VerificationResult;
}

pub struct RevocationResult {
    pub success: bool,
    pub requested_at: DateTime<Utc>,
    pub confirmed_at: Option<DateTime<Utc>>,
    pub propagation_delay_seconds: Option<u64>,  // Known delays logged explicitly
    pub evidence: Vec<EvidenceArtifact>,
    pub raw_response: Option<bytes::Bytes>,
    pub error: Option<String>,
}

Built-in Revocation Plugins
Plugin	Method	Notes
GithubTokenRevoker	DELETE /applications/{client_id}/token	Uses GitHub's revoke-a-token endpoint
GoogleOAuthRevoker	POST /revoke?token=...	Revokes OAuth2 refresh/access tokens
AwsKeyRevoker	IAM DeleteAccessKey	Deletes IAM access key pairs
NpmTokenRevoker	DELETE /-/npm/v1/tokens/token/{id}	Registry token deletion
HerokuApiRevoker	DELETE /account/authorizations/{id}	Platform API token revocation
StripeKeyRevoker	POST /v1/api_keys/{id}/expire	Restricted key expiry
TwilioCredRevoker	Sub-account API key deletion	
GenericBearerRevoker	Platform-specific revoke URL	Configurable per-asset
SshKeyFilePurger	Zero + unlink ~/.ssh/id_*	Local only — no remote component
GpgKeyPurger	gpg --delete-secret-key	Removes from local keyring

Propagation Delay Handling

Because some platforms have eventual-consistency revocation (e.g., Google API keys may remain active for up to ~23 minutes post-revocation), all revocation results are logged with explicit propagation-delay annotations, and the verification phase re-probes after the annotated delay window:

Rust

// src/revocation/propagation.rs

pub struct PropagationDelayRegistry {
    known_delays: HashMap<String, Duration>,
}

impl PropagationDelayRegistry {
    pub fn default() -> Self {
        let mut m = HashMap::new();
        // Google: known propagation window
        m.insert("google_oauth".to_string(), Duration::from_secs(1380)); // ~23 min
        // GitHub: typically fast but allow margin
        m.insert("github_token".to_string(), Duration::from_secs(60));
        // AWS: IAM changes are eventually consistent
        m.insert("aws_iam".to_string(), Duration::from_secs(300)); // ~5 min
        Self { known_delays: m }
    }

    pub fn get_delay(&self, service: &str) -> Duration {
        self.known_delays.get(service).copied().unwrap_or(Duration::from_secs(120))
    }
}

The receipt explicitly states: "Revocation requested at T. Propagation delay window for this service: T+Δ. Re-verified at T+Δ: [result]. Treat as unsafe until T+Δ."
4.5 Local Sanitization Engine

Purpose

Wipes local files, secrets, keys, and vaults using NIST SP 800-88-appropriate techniques selected per detected storage media class. The engine never blindly applies "7-pass DoD overwrite" — it selects the appropriate method based on what the media actually supports.

NIST SP 800-88 Media Class → Method Mapping
Media Class	Method	Rationale
HDD (spinning disk)	Single-pass overwrite + verify (Clear)	NIST 800-88: single-pass sufficient for Clear; multi-pass adds cost without demonstrated benefit
SSD / NVMe (user data)	ATA Secure Erase or NVMe Format/Sanitize command (Purge)	Overwrite unreliable on flash due to wear leveling; device-native sanitize is the correct path
Encrypted volume (any)	Cryptographic Erase: destroy encryption key (Purge)	If correctly deployed, crypto erase makes ciphertext unrecoverable without the key
Removable flash	Full format + single overwrite where SE not available	Device-native where possible
RAM disk / tmpfs	Clear in-memory buffer to zero	In-memory: memset to 0, then dealloc
Unknown	Single-pass overwrite + flag for manual verification	Conservative fallback; flag in receipt

Rust

// src/sanitization/mod.rs

#[derive(Debug, Clone)]
pub enum SanitizationMethod {
    SinglePassOverwrite {
        pattern: OverwritePattern,    // Zeros, Random, or NIST-recommended pattern
        verify: bool,
    },
    CryptographicErase {
        key_material_path: String,
        overwrite_key: bool,
    },
    DeviceNativeSanitize {
        device_path: String,
        command: DeviceSanitizeCommand,
    },
    InMemoryZero {
        size_bytes: usize,
    },
    Unlink,  // Used only when already crypto-erased or in combination
}

#[derive(Debug, Clone)]
pub enum DeviceSanitizeCommand {
    AtaSecureErase,          // hdparm --security-erase
    NvmeFormatUserData,      // nvme format --ses=1
    NvmeSanitize,            // nvme sanitize --sanact=2
}

pub struct LocalSanitizationEngine {
    media_detector: MediaClassDetector,
    method_selector: SanitizationMethodSelector,
    verifier: SanitizationVerifier,
}

impl LocalSanitizationEngine {
    pub async fn sanitize_file(&self, path: &Path) -> SanitizationResult {
        // Step 1: Detect media class
        let media_class = self.media_detector.detect(path).await;

        // Step 2: Select appropriate method per NIST 800-88
        let method = self.method_selector.select(&media_class, path);

        // Step 3: Log intent (before executing)
        let pre_hash = self.hash_file(path).await;

        // Step 4: Execute sanitization
        let exec_result = self.execute_method(&method, path).await;

        // Step 5: Verify
        let verification = self.verifier.verify(path, &method, &exec_result).await;

        SanitizationResult {
            path: path.to_path_buf(),
            media_class,
            method_used: method,
            pre_action_hash: pre_hash,
            execution_result: exec_result,
            verification,
            timestamp: Utc::now(),
        }
    }
}

What "Verification" Means Per Method

Rust

// src/sanitization/verifier.rs

impl SanitizationVerifier {
    pub async fn verify(&self, path: &Path, method: &SanitizationMethod,
                        exec: &ExecutionResult) -> VerificationOutcome {
        match method {
            SanitizationMethod::SinglePassOverwrite { verify: true, .. } => {
                // Sample random byte positions — confirm they match overwrite pattern
                VerificationOutcome::SampledOverwriteVerified {
                    sample_count: 64,
                    pass_rate: self.sample_verify(path, 64).await,
                }
            }
            SanitizationMethod::CryptographicErase { .. } => {
                // Verify key material path is absent / zeroed
                // Log: "Ciphertext remains on disk but is computationally unrecoverable
                //       without the destroyed key"
                VerificationOutcome::KeyMaterialAbsent {
                    key_path_verified_absent: !path.exists(),
                    note: "Ciphertext not re-verified; crypto erase is sufficient per NIST 800-88".to_string(),
                }
            }
            SanitizationMethod::DeviceNativeSanitize { command, .. } => {
                // Verify sanitize command exit code + device sanitize status register
                VerificationOutcome::DeviceSanitizeStatus {
                    command_exit_code: exec.exit_code,
                    device_status: self.read_sanitize_status(path).await,
                }
            }
            _ => VerificationOutcome::UnlinkVerified {
                path_absent: !path.exists(),
            }
        }
    }
}

4.6 Remote Deletion Engine

Purpose

Submits deletion requests to all remote platforms in the inventory. Because platforms vary enormously in their deletion mechanisms — from clean REST APIs to web-only UI flows to GDPR email forms — the engine uses a plugin architecture: each service has a dedicated plugin that handles the specifics.

Rust

// src/remote_deletion/mod.rs

#[async_trait]
pub trait DeletionPlugin: Send + Sync {
    fn service_name(&self) -> &str;
    fn deletion_method(&self) -> DeletionMethod;

    async fn delete_account(
        &self,
        asset: &InventoryAsset,
        ctx: &DeletionContext,
    ) -> DeletionResult;

    async fn verify_deleted(
        &self,
        asset: &InventoryAsset,
        ctx: &DeletionContext,
    ) -> VerificationResult;
}

pub struct DeletionResult {
    pub service: String,
    pub requested_at: DateTime<Utc>,
    pub method_used: DeletionMethod,
    pub success: bool,
    pub ticket_id: Option<String>,           // Support ticket / case ID
    pub expected_completion: Option<DateTime<Utc>>, // Based on service's stated processing time
    pub evidence: Vec<EvidenceArtifact>,
    pub limitations: Vec<String>,            // "Search engine caches may retain content"
    pub error: Option<String>,
}

Built-in Deletion Plugins
Plugin	Method	Notes
GitHubDeletion	Browser automation	No public account-deletion API; web UI only
TwitterXDeletion	Browser automation	Web UI; note: search engines retain content independently
RedditDeletion	API + GDPR fallback	DELETE /api/delete_user + content nuke
LinkedInDeletion	Browser automation	Account closure via Settings
FacebookDeletion	Browser automation	30-day deactivation window before permanent
GoogleDeletion	myaccount.google.com + browser	Multi-step; data download first recommended
DropboxDeletion	POST /account/delete API	Requires account auth first
SlackDeletion	Workspace admin API or user closure	Context-dependent
DiscordDeletion	Browser automation	DELETE /api/v10/users/@me (undocumented)
GenericGdprDeletion	GDPR Article 17 request generator	Fallback for any service with no API

GDPR Article 17 Request Generator

Rust

// src/remote_deletion/gdpr.rs

pub struct GdprRequestGenerator {
    templates: HashMap<String, String>,
}

impl GdprRequestGenerator {
    pub fn generate_request(&self, asset: &InventoryAsset, user: &UserProfile) -> GdprRequest {
        GdprRequest {
            subject: format!("Right to Erasure Request (GDPR Article 17) - {}", user.email),
            body: self.render_template(asset, user),
            recipient_email: asset.deletion_method
                .gdpr_contact()
                .unwrap_or("privacy@".to_string() + &asset.platform.unwrap_or_default()),
            attachments: vec![], // ID may be requested by some services — not auto-attached
            generated_at: Utc::now(),
            reference_id: Uuid::new_v4().to_string(),
        }
    }

    fn render_template(&self, asset: &InventoryAsset, user: &UserProfile) -> String {
        // Renders a standardized, factual request citing Article 17 grounds
        // NOTE: Receipt annotates that GDPR exceptions exist and deletion
        // is not absolute — this is a request, not a guarantee.
        format!(
            "I am writing to exercise my right to erasure under Article 17 of the \
             General Data Protection Regulation (GDPR). I request the permanent \
             deletion of all personal data you hold relating to the account \
             associated with email address: {}...",
            user.email
        )
    }
}

Honest Limitations Annotation

Every remote deletion result includes an explicit limitations field populated from known constraints:

Rust

// src/remote_deletion/limitations.rs

pub fn get_service_limitations(service: &str) -> Vec<String> {
    match service {
        "twitter_x" => vec![
            "Account deletion does not remove content from external search engine caches.".to_string(),
            "X explicitly states it does not control search engine indexing of your content.".to_string(),
            "Third-party scrapes, reposts, and embeds are beyond X's deletion scope.".to_string(),
        ],
        "facebook" => vec![
            "Permanent deletion occurs 30 days after deactivation request.".to_string(),
            "Content shared with others (posts in groups, messages) may be retained by those parties.".to_string(),
        ],
        "google" => vec![
            "Some data may be retained for legal/fraud purposes per Google's retention policy.".to_string(),
            "Content posted to external sites using Google login is not deleted.".to_string(),
        ],
        _ => vec![
            "Deletion request submitted. Completion depends on the service's processing timeline.".to_string(),
            "Archived copies, search engine caches, and third-party scrapes are outside this service's deletion scope.".to_string(),
        ],
    }
}

4.7 Browser Automation Layer (Playwright)

Purpose

For services without clean deletion APIs, the Browser Automation Layer uses playwright-rust to perform user-visible, audited automated actions in a browser. Every automated action is screenshot-documented for the receipt.

Rust

// src/automation/mod.rs

use playwright::Playwright;

pub struct BrowserAutomationEngine {
    playwright: Arc<Playwright>,
    screenshot_dir: PathBuf,
    require_visible: bool,     // Always true — user can see what's happening
    config: AutomationConfig,
}

#[derive(Debug, Clone)]
pub struct AutomationTask {
    pub task_id: Uuid,
    pub task_type: AutomationTaskType,
    pub target_url: String,
    pub service_name: String,
    pub requires_approval: bool,
    pub approved_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone)]
pub enum AutomationTaskType {
    AccountDeletion { plugin: String },
    GdprFormSubmit { form_data: HashMap<String, String> },
    ScreenshotCapture,
    PrivacyPageScrape,
    ConsentBannerDismiss,
}

impl BrowserAutomationEngine {
    pub async fn execute_deletion(
        &self,
        task: AutomationTask,
        plugin: &dyn DeletionPlugin,
    ) -> AutomationResult {
        // Step 1: Assert task is approved
        if task.requires_approval && task.approved_at.is_none() {
            return AutomationResult::failed("User approval required before browser automation");
        }

        // Step 2: Launch browser (always headed — user sees it)
        let browser = self.playwright.chromium()
            .launcher()
            .headless(false) // NEVER headless — transparency to user
            .launch()
            .await
            .expect("Browser launch failed");

        // Step 3: Take pre-action screenshot
        let pre_screenshot = self.capture_screenshot(&browser, &task.target_url).await;

        // Step 4: Execute plugin-specific deletion flow
        let result = plugin.delete_account_via_browser(&browser, &task).await;

        // Step 5: Take post-action screenshot
        let post_screenshot = self.capture_screenshot(&browser, &task.target_url).await;

        // Step 6: Hash screenshots and add to evidence
        AutomationResult {
            task_id: task.task_id,
            success: result.success,
            pre_action_screenshot_hash: sha256(&pre_screenshot),
            post_action_screenshot_hash: sha256(&post_screenshot),
            evidence: result.evidence,
            completed_at: Utc::now(),
        }
    }
}

4.8 Cryptographic Receipt System

Purpose

After all destruction phases complete, the Receipt System compiles a comprehensive JSON audit log, signs it with the user's PGP key, and obtains an RFC 3161 timestamp from a trusted timestamp authority. The resulting receipt is the strongest evidence MORTIS can produce for any third party.

Receipt Structure

Rust

// src/receipt/mod.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DestructionReceipt {
    pub receipt_id: Uuid,
    pub schema_version: String,                    // "1.0"
    pub generated_at: DateTime<Utc>,

    // Run summary
    pub run_id: Uuid,
    pub trigger_type: String,
    pub dry_run: bool,
    pub duress_mode: bool,

    // Inventory snapshot at time of run
    pub inventory_hash_before: String,             // SHA-256 of full inventory export before run
    pub inventory_hash_after: String,              // SHA-256 of inventory export after run

    // Phase results
    pub phases: Vec<PhaseReceiptEntry>,

    // Asset-level actions
    pub asset_actions: Vec<AssetActionResult>,

    // Aggregate statistics
    pub total_assets: u32,
    pub assets_completed: u32,
    pub assets_failed: u32,
    pub assets_skipped: u32,
    pub credentials_revoked: u32,
    pub local_files_sanitized: u32,
    pub remote_accounts_requested: u32,
    pub remote_accounts_verified: u32,

    // Explicit limitations
    pub known_limitations: Vec<String>,

    // Cryptographic envelope
    pub pgp_signature: Option<String>,             // Detached PGP signature (armored)
    pub pgp_key_fingerprint: Option<String>,
    pub rfc3161_timestamp: Option<String>,         // Base64-encoded TST
    pub rfc3161_tsa: Option<String>,               // TSA URL used
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseReceiptEntry {
    pub phase_id: String,
    pub state: String,     // completed | failed | skipped
    pub started_at: DateTime<Utc>,
    pub completed_at: DateTime<Utc>,
    pub assets_actioned: u32,
    pub failures: u32,
    pub error_summary: Option<String>,
}

What the Receipt Can Prove (Explicit Scope)
Proof Level	What it Proves	Mechanism
Proof of Intent & Execution	MORTIS was run at timestamp T, triggered by event E, with these results	PGP signature + RFC 3161 timestamp
Proof of Local Sanitization	File at path P was sanitized using method M, verified with outcome V, at timestamp T	Hashed execution log in signed receipt
Proof of Remote Request	Deletion request for account A at service S was submitted at T, with HTTP response hash H	Hashed HTTP responses in signed receipt
Proof of Credential Revocation	Token T was submitted to revocation endpoint E at time T, with response R. Re-verified at T+Δ	Hashed revocation responses + re-probe results

PGP Signing (sequoia-pgp)

Rust

// src/receipt/signing.rs

use sequoia_openpgp::crypto::KeyPair;
use sequoia_openpgp::serialize::stream::{Message, Signer, LiteralWriter};

pub struct PgpSigner {
    keypair: KeyPair,
    fingerprint: String,
}

impl PgpSigner {
    pub fn sign_receipt(&self, receipt_json: &[u8]) -> Result<String, SigningError> {
        let mut signed = Vec::new();
        let message = Message::new(&mut signed);
        let signer = Signer::new(message, self.keypair.clone())
            .detached()
            .build()?;
        let mut writer = LiteralWriter::new(signer).build()?;
        writer.write_all(receipt_json)?;
        writer.finalize()?;
        Ok(base64::encode(&signed))
    }
}

RFC 3161 Timestamping

Rust

// src/receipt/timestamp.rs

use reqwest::Client;

pub struct Rfc3161Timestamper {
    tsa_url: String, // e.g., "https://freetsa.org/tsr" (user-configurable)
    client: Client,
}

impl Rfc3161Timestamper {
    pub async fn timestamp(&self, data: &[u8]) -> Result<TimestampToken, TimestampError> {
        // Step 1: Compute SHA-256 hash of data
        let hash = sha256(data);

        // Step 2: Build RFC 3161 TimeStampReq
        let req = build_timestamp_request(&hash);

        // Step 3: Submit to TSA
        let response = self.client
            .post(&self.tsa_url)
            .header("Content-Type", "application/timestamp-query")
            .body(req)
            .send()
            .await?;

        // Step 4: Parse TimeStampResp
        let tst = parse_timestamp_response(response.bytes().await?)?;

        Ok(TimestampToken {
            tsa_url: self.tsa_url.clone(),
            token_base64: base64::encode(&tst),
            timestamp: extract_timestamp(&tst)?,
            hash_algorithm: "SHA-256".to_string(),
        })
    }
}

4.9 Dead Man's Switch Scheduler

Purpose

The Dead Man's Switch fires a destruction run if the user fails to check in within the configured interval. It models "incapacitation or capture" — not "I forgot to check in."

Rust

// src/triggers/dead_mans_switch.rs

use tokio::time::{interval_at, Instant, Duration};

pub struct DeadManSwitch {
    check_in_interval: Duration,
    grace_window: Duration,
    check_in_method: CheckInMethod,
    last_check_in: Arc<RwLock<DateTime<Utc>>>,
    state_path: PathBuf, // Persisted last-check-in timestamp
}

impl DeadManSwitch {
    pub async fn run(&self, event_tx: mpsc::Sender<TriggerEvent>) {
        let mut timer = interval_at(
            Instant::now() + self.check_in_interval,
            self.check_in_interval,
        );

        loop {
            timer.tick().await;

            let last = *self.last_check_in.read().await;
            let since_last = Utc::now() - last;

            if since_last > self.check_in_interval + self.grace_window {
                tracing::warn!(
                    since_last_check_in = ?since_last,
                    grace_window = ?self.grace_window,
                    "Dead man's switch timer expired with no check-in within grace window"
                );
                event_tx.send(TriggerEvent {
                    trigger_type: TriggerType::DeadManSwitch { .. },
                    fired_at: Utc::now(),
                    confidence: TriggerConfidence::Medium,
                    metadata: hashmap!{
                        "last_check_in".to_string() => last.to_rfc3339(),
                        "elapsed_hours".to_string() => since_last.num_hours().to_string(),
                    },
                }).await.ok();
            } else if since_last > self.check_in_interval {
                // In grace window — emit warning, not trigger
                tracing::warn!(
                    "Dead man's switch: missed check-in window. Grace expires in {:?}",
                    (self.check_in_interval + self.grace_window) - since_last
                );
            }
        }
    }

    pub async fn check_in(&self, method: &CheckInMethod) -> Result<(), CheckInError> {
        // Validate check-in credential
        match method {
            CheckInMethod::Passphrase => {
                // Prompt + verify passphrase
            }
            CheckInMethod::TotpToken => {
                // Verify TOTP
            }
            CheckInMethod::FileTouch { path } => {
                // Verify file was touched within interval
            }
            _ => {}
        }
        // Update persisted timestamp
        *self.last_check_in.write().await = Utc::now();
        self.persist_check_in().await
    }
}

4.10 Canary System

Purpose

Canary tokens are planted artifacts (files, URLs, credentials, DNS entries) that generate an alert when accessed. MORTIS treats canary access as an escalation signal — not an instant detonation trigger — by default, because a canary might be accessed by a legitimate scan, a researcher, or by an attacker deliberately trying to trigger destruction.

Rust

// src/canary/mod.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanaryToken {
    pub canary_id: Uuid,
    pub token_type: CanaryType,
    pub label: String,
    pub planted_at: DateTime<Utc>,
    pub last_accessed: Option<DateTime<Utc>>,
    pub access_count: u32,
    pub escalation_mode: CanaryEscalationMode,
    pub grace_window: Duration,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CanaryType {
    HttpUrl {
        url: String,              // URL that phones home on access
        webhook_secret: String,
    },
    CredentialHoneypot {
        fake_credential: String,  // Credential that triggers when used
        monitor_endpoint: String,
    },
    FileTripwire {
        file_path: PathBuf,       // File access is monitored via inotify/FSEvents
        watch_type: WatchType,
    },
    DnsCanary {
        subdomain: String,        // DNS query triggers alert
        ns_server: String,
    },
}

// Escalation: always notify first, require confirmation before destruction
impl CanarySystem {
    pub async fn handle_trip(&self, canary: &CanaryToken, event_tx: &mpsc::Sender<TriggerEvent>) {
        tracing::warn!(
            canary_id = %canary.canary_id,
            label = %canary.label,
            mode = ?canary.escalation_mode,
            "Canary tripped"
        );

        match &canary.escalation_mode {
            CanaryEscalationMode::EscalateOnly => {
                // Alert user via notification. No destruction. User must manually confirm.
                self.notifier.alert_canary_trip(canary).await;
            }
            CanaryEscalationMode::EscalateWithGraceWindow => {
                // Alert + start grace window countdown
                self.notifier.alert_canary_trip_with_countdown(canary).await;
                sleep(canary.grace_window).await;
                // If user has not cancelled, fire trigger
                if !self.cancellation_received(canary.canary_id).await {
                    event_tx.send(TriggerEvent {
                        trigger_type: TriggerType::Canary { canary_id: canary.canary_id.to_string(), .. },
                        confidence: TriggerConfidence::Canary,
                        ..
                    }).await.ok();
                }
            }
            CanaryEscalationMode::ImmediateDestruct => {
                // Only appropriate when user has explicitly opted in and understands implications
                event_tx.send(TriggerEvent { .. }).await.ok();
            }
        }
    }
}

4.11 Notification & Final Message Dispatcher

Purpose

After the destruction run completes, dispatches pre-authored final messages to configured recipients. This is a one-way send: a will, a notification to a trusted contact, or an alert to a legal representative.

Rust

// src/notification/mod.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FinalMessage {
    pub message_id: Uuid,
    pub recipient: MessageRecipient,
    pub subject: String,
    pub body_encrypted: Vec<u8>,      // Encrypted to recipient's public key
    pub body_pgp_key: Option<String>, // Recipient's PGP key (for encryption)
    pub send_on: SendCondition,
    pub include_receipt: bool,
    pub include_receipt_hash_only: bool, // Privacy-preserving: only hash, not full receipt
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageRecipient {
    Email { address: String },
    FileDrop { path: PathBuf },         // Write to file: trusted contact retrieves
    LocalOnly,                           // Write to disk only — no network send
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SendCondition {
    OnAnyDestruction,
    OnSuccessfulDestruction,
    OnPartialFailure,
    OnDeadManSwitch,
    OnCanaryTrip,
    Always,
}

pub struct NotificationDispatcher {
    smtp_config: Option<SmtpConfig>,
    mailer: Option<lettre::SmtpTransport>,
}

impl NotificationDispatcher {
    pub async fn dispatch(&self, run: &DestructionRun) -> Vec<DispatchResult> {
        let messages = self.select_messages_for_run(run);
        let mut results = Vec::new();

        for msg in messages {
            let result = match &msg.recipient {
                MessageRecipient::Email { address } => {
                    self.send_email(address, &msg, run).await
                }
                MessageRecipient::FileDrop { path } => {
                    self.write_file(path, &msg, run).await
                }
                MessageRecipient::LocalOnly => {
                    self.write_local(&msg, run).await
                }
            };
            results.push(result);
        }
        results
    }
}

4.12 CLI Interface

Purpose

MORTIS is entirely CLI-driven. No GUI. The CLI uses clap and provides a small, deliberate set of commands.

Rust

// src/cli/mod.rs

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "mortis")]
#[command(about = "Cryptographically accountable digital self-destruct orchestrator")]
#[command(version)]
pub struct Cli {
    #[arg(long, default_value = "~/.mortis/config.toml")]
    pub config: PathBuf,

    #[arg(long, help = "Enable verbose logging")]
    pub verbose: bool,

    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Initialize MORTIS: generate CA, encryption keys, and default config
    Init {
        #[arg(long)]
        passphrase: Option<String>, // Prefer prompt over CLI arg
    },

    /// Scan and update the inventory
    Scan {
        #[arg(long, help = "Run all connectors")]
        full: bool,
        #[arg(long, help = "Run specific connector")]
        connector: Option<String>,
    },

    /// Show current inventory
    Inventory {
        #[arg(long, help = "Filter by category")]
        category: Option<String>,
        #[arg(long, help = "Output format")]
        format: Option<String>, // table | json
    },

    /// Perform a dry run: show the destruction plan without executing
    Plan {
        #[arg(long, help = "Output plan to file")]
        output: Option<PathBuf>,
    },

    /// Execute a destruction run
    Run {
        #[arg(long, help = "Dry run: plan only, no execution")]
        dry_run: bool,
        #[arg(long, help = "Skip confirmation prompt (use with care)")]
        no_confirm: bool,
        #[arg(long, help = "Run specific phases only")]
        phases: Option<Vec<String>>,
        #[arg(long, help = "Output receipt to file")]
        receipt_out: Option<PathBuf>,
    },

    /// Check in to the dead man's switch
    Checkin,

    /// Manage canary tokens
    Canary {
        #[command(subcommand)]
        action: CanaryCommands,
    },

    /// Show or export the last destruction receipt
    Receipt {
        #[arg(long)]
        run_id: Option<Uuid>,
        #[arg(long, help = "Verify PGP signature and RFC3161 timestamp")]
        verify: bool,
    },

    /// Configure MORTIS settings
    Config {
        #[command(subcommand)]
        action: ConfigCommands,
    },
}

CLI Run Output (example)

text

$ mortis run

MORTIS v1.0.0 — Destruction Orchestrator
Run ID: 7f3a1c2d-...
Trigger: Manual (passphrase confirmed)

WARNING: This will execute a full destruction run.
Type 'CONFIRM' to proceed: CONFIRM

[Phase 1/10] EXPORT ━━━━━━━━━━━━━━━━━━━━━━━━ 12 assets → /tmp/mortis-export-enc.tar.gpg ✓
[Phase 2/10] REVOKE CREDENTIALS ━━━━━━━━━━━━
  ✓ github_token (rfc:xxxx) — revoked, propagation delay: 60s
  ✓ google_oauth — revoked, propagation delay: 1380s [logged]
  ✗ aws_iam_key — FAILED: API timeout. Evidence logged. Manual action required.
[Phase 3/10] DESTROY KEYS ━━━━━━━━━━━━━━━━━━ 8 keys wiped ✓
[Phase 4/10] WIPE VAULTS ━━━━━━━━━━━━━━━━━━━ 3 stores purged ✓
[Phase 5/10] CLOUD DELETION ━━━━━━━━━━━━━━━━
  ✓ github.com — deletion request submitted (browser automation)
  ✓ twitter.com — deletion request submitted [limitations: search cache]
  ~ reddit.com — GDPR Article 17 request generated (manual send required)
[Phase 6/10] LOCAL SANITIZATION ━━━━━━━━━━━━ 234 files sanitized (SSD: crypto-erase) ✓
[Phase 7/10] VERIFY ━━━━━━━━━━━━━━━━━━━━━━━━ 18/19 verified ✓, 1 pending (propagation)
[Phase 8/10] RECEIPT ━━━━━━━━━━━━━━━━━━━━━━━ Signed (PGP), Timestamped (RFC3161) ✓
              → ~/.mortis/receipts/7f3a1c2d-receipt.json
[Phase 9/10] NOTIFY ━━━━━━━━━━━━━━━━━━━━━━━━ 1 message dispatched ✓
[Phase 10/10] SELF-DELETE ━━━━━━━━━━━━━━━━━━ MORTIS config wiped ✓

Run complete. 1 failure (aws_iam_key). Receipt: ~/.mortis/receipts/7f3a1c2d-receipt.json

5. Data Models & Schemas
5.1 SQLCipher Schema

SQL

-- migrations/001_initial.sql
-- Database encrypted with SQLCipher (AES-256-CBC)
-- Key derived from passphrase via Argon2id

CREATE TABLE IF NOT EXISTS inventory_assets (
    id                   TEXT PRIMARY KEY,        -- UUID
    category             TEXT NOT NULL,
    label                TEXT NOT NULL,
    platform             TEXT,
    local_path           TEXT,
    deletion_method      TEXT NOT NULL,           -- JSON serialized DeletionMethod
    designation          TEXT NOT NULL,           -- JSON serialized AssetDesignation
    media_class          TEXT,
    sync_state           TEXT NOT NULL DEFAULT 'none',
    revocation_endpoint  TEXT,
    verification_signal  TEXT,                    -- JSON serialized VerificationSignal
    last_verified        DATETIME,
    notes                TEXT,
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS destruction_runs (
    id                   TEXT PRIMARY KEY,
    started_at           DATETIME NOT NULL,
    completed_at         DATETIME,
    trigger_type         TEXT NOT NULL,
    trigger_metadata     TEXT,                    -- JSON
    is_dry_run           BOOLEAN NOT NULL DEFAULT 0,
    is_duress            BOOLEAN NOT NULL DEFAULT 0,
    inventory_hash_before TEXT,
    inventory_hash_after  TEXT,
    total_assets         INTEGER NOT NULL DEFAULT 0,
    assets_completed     INTEGER NOT NULL DEFAULT 0,
    assets_failed        INTEGER NOT NULL DEFAULT 0,
    assets_skipped       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS asset_action_results (
    id                   TEXT PRIMARY KEY,
    run_id               TEXT NOT NULL,
    asset_id             TEXT NOT NULL,
    asset_label          TEXT NOT NULL,
    phase                TEXT NOT NULL,
    action_taken         TEXT NOT NULL,
    success              BOOLEAN NOT NULL,
    error                TEXT,
    evidence             TEXT,                    -- JSON array of EvidenceArtifact
    timestamp            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES destruction_runs(id),
    FOREIGN KEY (asset_id) REFERENCES inventory_assets(id)
);

CREATE TABLE IF NOT EXISTS destruction_receipts (
    id                   TEXT PRIMARY KEY,
    run_id               TEXT NOT NULL UNIQUE,
    generated_at         DATETIME NOT NULL,
    receipt_json         TEXT NOT NULL,           -- Full JSON receipt
    receipt_hash         TEXT NOT NULL,           -- SHA-256 of receipt_json
    pgp_signature        TEXT,
    pgp_key_fingerprint  TEXT,
    rfc3161_timestamp    TEXT,                    -- Base64 TST
    rfc3161_tsa          TEXT,
    FOREIGN KEY (run_id) REFERENCES destruction_runs(id)
);

CREATE TABLE IF NOT EXISTS canary_tokens (
    id                   TEXT PRIMARY KEY,
    token_type           TEXT NOT NULL,           -- JSON
    label                TEXT NOT NULL,
    planted_at           DATETIME NOT NULL,
    last_accessed        DATETIME,
    access_count         INTEGER NOT NULL DEFAULT 0,
    escalation_mode      TEXT NOT NULL,
    grace_window_seconds INTEGER NOT NULL DEFAULT 3600,
    enabled              BOOLEAN NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS check_ins (
    id                   TEXT PRIMARY KEY,
    checked_in_at        DATETIME NOT NULL,
    method               TEXT NOT NULL,
    verified             BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS config (
    key                  TEXT PRIMARY KEY,
    value                TEXT NOT NULL,
    updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_assets_category ON inventory_assets(category);
CREATE INDEX idx_assets_platform ON inventory_assets(platform);
CREATE INDEX idx_results_run_id ON asset_action_results(run_id);
CREATE INDEX idx_results_asset_id ON asset_action_results(asset_id);
CREATE INDEX idx_results_phase ON asset_action_results(phase);
CREATE INDEX idx_runs_started ON destruction_runs(started_at);

6. API Specifications

MORTIS is a CLI tool. There is no HTTP REST API. All interaction is via the mortis binary. The following documents the internal trait interfaces that modules expose to each other.
6.1 InventoryEngine Trait

Rust

pub trait InventoryEngineApi {
    fn load_all(&self) -> Result<Vec<InventoryAsset>, InventoryError>;
    fn load_by_category(&self, category: AssetCategory) -> Result<Vec<InventoryAsset>, InventoryError>;
    fn upsert_asset(&self, asset: &InventoryAsset) -> Result<(), InventoryError>;
    fn delete_asset(&self, id: Uuid) -> Result<(), InventoryError>;
    fn export_snapshot(&self) -> Result<Vec<u8>, InventoryError>; // For hash in receipt
    fn build_destruction_plan(&self, opts: &PlanOptions) -> Result<DestructionPlan, InventoryError>;
}

6.2 DeletionPlugin Trait

Rust

#[async_trait]
pub trait DeletionPlugin: Send + Sync {
    fn service_name(&self) -> &str;
    fn deletion_method(&self) -> DeletionMethod;
    async fn delete_account(&self, asset: &InventoryAsset, ctx: &DeletionContext) -> DeletionResult;
    async fn verify_deleted(&self, asset: &InventoryAsset, ctx: &DeletionContext) -> VerificationResult;
}

6.3 RevocationPlugin Trait

Rust

#[async_trait]
pub trait RevocationPlugin: Send + Sync {
    fn service_name(&self) -> &str;
    async fn revoke(&self, asset: &InventoryAsset, ctx: &RevocationContext) -> RevocationResult;
    async fn verify_revoked(&self, asset: &InventoryAsset, ctx: &RevocationContext) -> VerificationResult;
    fn known_propagation_delay(&self) -> Duration;
}

6.4 InventoryConnector Trait

Rust

pub trait InventoryConnector: Send + Sync {
    fn name(&self) -> &str;
    fn scan(&self, ctx: &ScanContext) -> Result<Vec<InventoryAsset>, ConnectorError>;
    fn is_available(&self) -> bool;
    fn requires_passphrase(&self) -> bool;
}

7. Directory Structure

text

mortis/
├── src/
│   ├── main.rs                          # Entry point: CLI dispatch
│   │
│   ├── cli/
│   │   ├── mod.rs                       # clap CLI definition
│   │   ├── run.rs                       # `mortis run` command handler
│   │   ├── scan.rs                      # `mortis scan` command handler
│   │   ├── inventory.rs                 # `mortis inventory` command handler
│   │   ├── plan.rs                      # `mortis plan` command handler
│   │   ├── checkin.rs                   # `mortis checkin` command handler
│   │   ├── canary.rs                    # `mortis canary` command handler
│   │   ├── receipt.rs                   # `mortis receipt` command handler
│   │   └── config.rs                    # `mortis config` command handler
│   │
│   ├── inventory/
│   │   ├── mod.rs                       # InventoryEngine struct + API
│   │   ├── asset.rs                     # InventoryAsset and all related types
│   │   ├── plan.rs                      # DestructionPlan builder
│   │   ├── deletion_registry.rs         # ServiceDeletionRecord registry
│   │   └── connectors/
│   │       ├── mod.rs                   # InventoryConnector trait
│   │       ├── password_manager.rs      # 1Password / Bitwarden / KeePass
│   │       ├── ssh_keys.rs              # ~/.ssh/ scan
│   │       ├── gpg_keys.rs              # gpg --list-secret-keys
│   │       ├── browser_credentials.rs   # Chrome/Firefox profile scan
│   │       ├── cloud_cli.rs             # AWS ~/.aws/, GCP ~/.config/gcloud
│   │       ├── oauth_grants.rs          # OAuth grant scanner (Playwright)
│   │       ├── email_scanner.rs         # IMAP account creation pattern scan
│   │       ├── filesystem.rs            # User-defined directories
│   │       ├── macos_keychain.rs        # macOS Keychain
│   │       ├── linux_secret_service.rs  # GNOME Keyring / KWallet
│   │       └── windows_credential.rs    # Windows Credential Manager
│   │
│   ├── triggers/
│   │   ├── mod.rs                       # TriggerType, TriggerEvent definitions
│   │   ├── monitor.rs                   # TriggerMonitor (Tokio task)
│   │   ├── safety.rs                    # SafetyInterlock
│   │   ├── manual.rs                    # Manual passphrase trigger
│   │   ├── dead_mans_switch.rs          # Dead man's switch scheduler
│   │   ├── hardware.rs                  # USB/hardware presence trigger
│   │   ├── canary_trigger.rs            # Canary tripwire trigger adapter
│   │   └── remote_signal.rs             # Remote encrypted signal listener
│   │
│   ├── orchestrator/
│   │   ├── mod.rs                       # DestructionOrchestrator struct
│   │   ├── runner.rs                    # Phase execution loop + state machine
│   │   ├── phases.rs                    # PhaseId, PhaseState, PhaseResult types
│   │   └── export.rs                    # Phase 1: Export engine
│   │
│   ├── revocation/
│   │   ├── mod.rs                       # RevocationPlugin trait + engine
│   │   ├── propagation.rs               # PropagationDelayRegistry
│   │   ├── plugins/
│   │   │   ├── github.rs
│   │   │   ├── google.rs
│   │   │   ├── aws.rs
│   │   │   ├── npm.rs
│   │   │   ├── heroku.rs
│   │   │   ├── stripe.rs
│   │   │   ├── ssh_key.rs
│   │   │   ├── gpg_key.rs
│   │   │   └── generic_bearer.rs
│   │   └── registry.rs                  # Plugin registry + dispatcher
│   │
│   ├── sanitization/
│   │   ├── mod.rs                       # LocalSanitizationEngine
│   │   ├── media_detector.rs            # MediaClassDetector
│   │   ├── method_selector.rs           # NIST 800-88 method selection
│   │   ├── overwrite.rs                 # Single-pass overwrite implementation
│   │   ├── crypto_erase.rs              # Cryptographic erase (key destruction)
│   │   ├── device_sanitize.rs           # ATA Secure Erase, NVMe Format/Sanitize
│   │   ├── verifier.rs                  # SanitizationVerifier
│   │   └── keys_vaults.rs               # SSH key, GPG key, vault wipe routines
│   │
│   ├── remote_deletion/
│   │   ├── mod.rs                       # DeletionPlugin trait + engine
│   │   ├── gdpr.rs                      # GdprRequestGenerator
│   │   ├── limitations.rs               # Known service limitations registry
│   │   └── plugins/
│   │       ├── github.rs
│   │       ├── twitter_x.rs
│   │       ├── reddit.rs
│   │       ├── linkedin.rs
│   │       ├── facebook.rs
│   │       ├── google.rs
│   │       ├── dropbox.rs
│   │       ├── discord.rs
│   │       ├── slack.rs
│   │       └── generic_gdpr.rs
│   │
│   ├── automation/
│   │   ├── mod.rs                       # BrowserAutomationEngine
│   │   ├── tasks.rs                     # AutomationTask types
│   │   └── safety.rs                    # Automation safety guards + audit log
│   │
│   ├── receipt/
│   │   ├── mod.rs                       # ReceiptSystem + DestructionReceipt
│   │   ├── signing.rs                   # PGP signing (sequoia-pgp)
│   │   ├── timestamp.rs                 # RFC 3161 timestamping
│   │   └── proof_levels.rs              # Proof scope annotations
│   │
│   ├── canary/
│   │   ├── mod.rs                       # CanarySystem + CanaryToken
│   │   ├── http_canary.rs               # HTTP URL canary
│   │   ├── file_tripwire.rs             # Filesystem watch canary
│   │   ├── credential_honeypot.rs       # Honeypot credential canary
│   │   └── dns_canary.rs                # DNS canary
│   │
│   ├── notification/
│   │   ├── mod.rs                       # NotificationDispatcher
│   │   ├── email.rs                     # SMTP (lettre)
│   │   └── file_drop.rs                 # Local file drop
│   │
│   ├── storage/
│   │   ├── mod.rs                       # DB connection + pool
│   │   ├── migrations.rs                # Migration runner
│   │   ├── inventory_repo.rs            # InventoryAsset CRUD
│   │   ├── run_repo.rs                  # DestructionRun CRUD
│   │   ├── result_repo.rs               # AssetActionResult CRUD
│   │   ├── receipt_repo.rs              # DestructionReceipt CRUD
│   │   └── canary_repo.rs               # CanaryToken CRUD
│   │
│   ├── crypto/
│   │   ├── mod.rs                       # Crypto utilities
│   │   ├── kdf.rs                       # Argon2id key derivation
│   │   ├── hashing.rs                   # SHA-256 utilities
│   │   └── memory.rs                    # Secure memory zeroization (zeroize)
│   │
│   ├── errors/
│   │   └── mod.rs                       # Error types, categories, policy
│   │
│   └── config/
│       ├── mod.rs                       # Config struct + loader
│       ├── defaults.rs                  # Default values
│       └── validator.rs                 # Config validation
│
├── tests/
│   ├── unit/
│   │   ├── classifier_tests.rs
│   │   ├── sanitization_tests.rs
│   │   ├── receipt_tests.rs
│   │   └── trigger_tests.rs
│   ├── integration/
│   │   ├── dry_run_tests.rs
│   │   ├── revocation_mock_tests.rs
│   │   └── deletion_mock_tests.rs
│   └── e2e/
│       └── full_run_test.rs
│
├── data/
│   └── deletion_registry.json           # Community-maintained service deletion metadata
│
├── Cargo.toml
├── Cargo.lock
├── Makefile
├── Dockerfile
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
└── README.md

8. Configuration System
8.1 Config File (TOML)

Stored at ~/.mortis/config.toml. The database and keys are stored at ~/.mortis/.

toml

[general]
data_dir = "~/.mortis"
log_level = "info"    # debug | info | warn | error

[passphrase]
# Passphrase is never stored — it is entered at runtime
# KDF parameters for Argon2id key derivation
kdf_algorithm = "argon2id"
kdf_memory_kb = 65536    # 64MB
kdf_iterations = 3
kdf_parallelism = 4

[inventory]
auto_scan_on_start = false
scan_connectors = [
    "ssh_keys",
    "gpg_keys",
    "browser_credentials",
    "cloud_cli",
    "filesystem",
]
user_directories = [
    "~/Documents",
    "~/Desktop",
    "~/Downloads",
    "~/code",
]

[triggers]
# Which trigger types are enabled
manual_enabled = true
dead_mans_switch_enabled = false
hardware_trigger_enabled = false
canary_enabled = false
remote_signal_enabled = false

[triggers.dead_mans_switch]
check_in_interval_hours = 48
grace_window_hours = 6
check_in_method = "passphrase"    # passphrase | totp | file_touch

[triggers.hardware]
device_id = ""             # Set to your USB token device ID
trigger_on = "removal"     # removal | absence
debounce_ms = 2000
require_software_confirm = true  # Always recommended

[triggers.canary]
default_escalation_mode = "escalate_with_grace_window"
default_grace_window_minutes = 60

[orchestrator]
# Phase enable/disable per run type
export_enabled = true
self_delete_on_completion = false    # Off by default — very hard to undo
destruction_phases = [
    "export",
    "revoke_credentials",
    "destroy_keys",
    "wipe_vaults",
    "cloud_deletion",
    "local_sanitization",
    "verify",
    "receipt",
    "notify",
]

[sanitization]
# Local file sanitization settings
ssd_method = "device_native_sanitize"    # device_native_sanitize | crypto_erase | single_pass
hdd_method = "single_pass_overwrite"     # single_pass_overwrite | crypto_erase
overwrite_pattern = "zeros"              # zeros | random | nist_recommended
verify_after_wipe = true
flag_unknown_media = true               # Flag assets where media class cannot be determined

[remote_deletion]
enabled_plugins = [
    "github",
    "twitter_x",
    "reddit",
    "google",
    "dropbox",
    "generic_gdpr",
]
generate_gdpr_requests_for_unknown = true
gdpr_request_output_dir = "~/.mortis/gdpr_requests"

[receipt]
output_dir = "~/.mortis/receipts"
pgp_sign = true
pgp_key_fingerprint = ""   # Set to your PGP key fingerprint; generated on init if blank
rfc3161_timestamp = true
rfc3161_tsa_url = "https://freetsa.org/tsr"   # User-configurable TSA
include_evidence_artifacts = true

[notification]
enabled = false
# Messages are authored separately via `mortis config notification add`

[notification.smtp]
host = ""
port = 587
username = ""
password_env = "MORTIS_SMTP_PASSWORD"  # Never stored in config file
tls = true

[export]
archive_format = "tar.gz.gpg"          # Compressed + encrypted to receipt PGP key
output_dir = "~/.mortis/exports"

8.2 Config Loader

Rust

// src/config/mod.rs

use config::{Config, File, Environment};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct MortisConfig {
    pub general: GeneralConfig,
    pub passphrase: PassphraseConfig,
    pub inventory: InventoryConfig,
    pub triggers: TriggersConfig,
    pub orchestrator: OrchestratorConfig,
    pub sanitization: SanitizationConfig,
    pub remote_deletion: RemoteDeletionConfig,
    pub receipt: ReceiptConfig,
    pub notification: NotificationConfig,
    pub export: ExportConfig,
}

pub fn load(path: &Path) -> Result<MortisConfig, ConfigError> {
    let cfg = Config::builder()
        .add_source(File::with_name(path.to_str().unwrap()).required(false))
        .add_source(Environment::with_prefix("MORTIS"))
        .build()?;
    let config: MortisConfig = cfg.try_deserialize()?;
    validate(&config)?;
    Ok(config)
}

pub fn default_path() -> PathBuf {
    dirs::home_dir()
        .expect("Cannot determine home directory")
        .join(".mortis")
        .join("config.toml")
}

9. Cryptography & Key Management
9.1 Database Encryption (SQLCipher)

The inventory database is encrypted at rest using SQLCipher with AES-256-CBC. The database key is derived from the user's passphrase using Argon2id:

Rust

// src/crypto/kdf.rs

use argon2::{Argon2, Params, Algorithm, Version};

pub struct KeyDerivation {
    params: Params,
    algorithm: Algorithm,
    version: Version,
}

impl KeyDerivation {
    pub fn default_strong() -> Self {
        Self {
            params: Params::new(
                65536,  // m_cost: 64MB
                3,      // t_cost: 3 iterations
                4,      // p_cost: 4 threads
                Some(32), // output_len: 256-bit key
            ).unwrap(),
            algorithm: Algorithm::Argon2id,
            version: Version::V0x13,
        }
    }

    pub fn derive_key(&self, passphrase: &[u8], salt: &[u8]) -> [u8; 32] {
        let argon2 = Argon2::new(self.algorithm, self.version, self.params.clone());
        let mut output = [0u8; 32];
        argon2.hash_password_into(passphrase, salt, &mut output)
            .expect("Argon2id key derivation failed");
        output
    }
}

9.2 Key Storage Model

text

~/.mortis/
├── config.toml           # Plain text (no secrets)
├── mortis.db             # SQLCipher-encrypted inventory + run history
├── pgp/
│   ├── receipt-key.pgp   # PGP private key for receipt signing (encrypted with passphrase)
│   └── receipt-key.pub   # PGP public key (for export + sharing with receipt verifiers)
├── receipts/             # Signed + timestamped JSON receipts
├── exports/              # Encrypted export archives (gitignored, user controls)
├── gdpr_requests/        # Generated GDPR Article 17 request drafts
└── logs/                 # Opt-in structured logs

9.3 Secure Memory Handling

All sensitive material in memory (passphrases, derived keys, credential values) uses the zeroize crate to guarantee that memory is zeroed before deallocation:

Rust

// src/crypto/memory.rs

use zeroize::{Zeroize, ZeroizeOnDrop};

#[derive(Zeroize, ZeroizeOnDrop)]
pub struct SensitiveBuffer(Vec<u8>);

#[derive(Zeroize, ZeroizeOnDrop)]
pub struct DerivedKey([u8; 32]);

// Never logs, never serializes, zeroed on drop
#[derive(ZeroizeOnDrop)]
pub struct Passphrase(String);

9.4 PGP Key Generation on Init

Rust

// src/crypto/pgp_init.rs

use sequoia_openpgp::cert::{CertBuilder, CipherSuite};

pub fn generate_receipt_keypair(user_id: &str) -> Result<(Cert, String), CryptoError> {
    let (cert, _revocation) = CertBuilder::new()
        .add_userid(user_id)
        .set_cipher_suite(CipherSuite::Cv25519)   // Curve25519 — modern, audited
        .add_signing_subkey()
        .generate()?;

    let fingerprint = cert.fingerprint().to_hex();
    Ok((cert, fingerprint))
}

10. Destruction Phase Choreography
10.1 Phase Order Rationale

The phase order is not arbitrary. Each phase depends on the outcome of prior phases:
Phase	Why It Comes Here
1. Export	Must run before any destruction — export requires the data to exist
2. Revoke Credentials	Most time-critical — stops active access immediately; runs before local wipe to ensure we still have credentials to call revocation APIs
3. Destroy Keys	Key material is gone before any local files — prevents late-stage credential extraction
4. Wipe Vaults	Vault contents are gone before local file wipe sweeps the same directories
5. Cloud Deletion	Runs before local wipe — we still have tokens/sessions for API calls
6. Local Sanitization	Runs after cloud deletion to avoid sync services re-uploading just-deleted files
7. Verify	Runs after all active phases — checks each action's outcome
8. Receipt	Always runs last — captures everything that happened, including failures
9. Notify	Runs after receipt — final message can include receipt hash
10. Self-Delete	Optional, final — removes MORTIS itself after run is complete
10.2 Cloud Sync Ordering Detail

A critical subtlety: if cloud sync (Dropbox, Drive, iCloud) is active, wiping local files first will propagate the deletion to the cloud — but may race with in-progress sync. The correct order is:

text

1. Revoke sync service API tokens (Phase 2) — stops active sync propagation
2. Request cloud-side deletion via API (Phase 5) — deletes remote copy
3. Wipe local files (Phase 6) — removes local copy

This ensures local deletion does not accidentally trigger sync propagation that might fail or be incomplete.
11. Local Sanitization Deep Dive
11.1 Media Class Detector

Rust

// src/sanitization/media_detector.rs

pub struct MediaClassDetector;

impl MediaClassDetector {
    pub async fn detect(&self, path: &Path) -> MediaClass {
        // Step 1: Find the block device underlying this path
        let device = self.resolve_block_device(path).await;

        // Step 2: Read device rotation rate (0 = SSD/NVMe, >0 = HDD)
        match device {
            Some(dev) => {
                let rotational = self.read_rotational_flag(&dev).await;
                let is_nvme = dev.to_str().map(|s| s.contains("nvme")).unwrap_or(false);
                match (rotational, is_nvme) {
                    (false, true)  => MediaClass::Nvme,
                    (false, false) => MediaClass::Ssd,
                    (true, _)      => MediaClass::Hdd,
                    _              => MediaClass::Unknown,
                }
            }
            None => MediaClass::Unknown,
        }
    }
}

11.2 Overwrite Implementation (HDD)

Rust

// src/sanitization/overwrite.rs

use std::io::Write;
use std::fs::OpenOptions;

pub async fn single_pass_overwrite(path: &Path, pattern: OverwritePattern) -> OverwriteResult {
    let metadata = tokio::fs::metadata(path).await?;
    let file_size = metadata.len() as usize;

    let fill_byte = match pattern {
        OverwritePattern::Zeros => 0x00u8,
        OverwritePattern::Ones  => 0xFFu8,
        OverwritePattern::NistRecommended => 0x00u8, // NIST 800-88 Clear: single-pass zeros
        OverwritePattern::Random => { /* generate random bytes */ 0x00 }
    };

    let mut f = OpenOptions::new()
        .write(true)
        .open(path)
        .await?;

    // Overwrite in 64KB chunks
    let chunk_size = 65536;
    let fill_chunk = vec![fill_byte; chunk_size];
    let mut written = 0;

    while written < file_size {
        let to_write = (file_size - written).min(chunk_size);
        f.write_all(&fill_chunk[..to_write]).await?;
        written += to_write;
    }
    f.flush().await?;
    f.sync_all().await?; // fsync to ensure write hits media

    // Unlink
    tokio::fs::remove_file(path).await?;

    OverwriteResult::success(path, file_size, written)
}

11.3 NVMe Sanitize Command

Rust

// src/sanitization/device_sanitize.rs

use std::process::Command;

pub fn nvme_format_user_data(device: &Path) -> DeviceSanitizeResult {
    // nvme format --ses=1 overwrites user data (User Data Erase)
    // --ses=2 is Cryptographic Erase where supported
    let output = Command::new("nvme")
        .args(&["format", "--ses=1", device.to_str().unwrap()])
        .output();

    match output {
        Ok(out) => DeviceSanitizeResult {
            command: "nvme format --ses=1".to_string(),
            exit_code: out.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&out.stdout).to_string(),
            stderr: String::from_utf8_lossy(&out.stderr).to_string(),
            success: out.status.success(),
        },
        Err(e) => DeviceSanitizeResult::failed(format!("nvme command not found: {}", e)),
    }
}

12. Remote Deletion Deep Dive
12.1 GitHub Plugin (Browser Automation)

Rust

// src/remote_deletion/plugins/github.rs

pub struct GitHubDeletion {
    automation: Arc<BrowserAutomationEngine>,
}

#[async_trait]
impl DeletionPlugin for GitHubDeletion {
    fn service_name(&self) -> &str { "github.com" }
    fn deletion_method(&self) -> DeletionMethod {
        DeletionMethod::BrowserAutomation { plugin: "github".to_string() }
    }

    async fn delete_account(&self, asset: &InventoryAsset, ctx: &DeletionContext) -> DeletionResult {
        // GitHub account deletion is Settings → Account → Delete account (web UI only)
        // No public user-facing API endpoint
        let task = AutomationTask {
            task_type: AutomationTaskType::AccountDeletion { plugin: "github".to_string() },
            target_url: "https://github.com/settings/admin".to_string(),
            requires_approval: true,
            approved_at: ctx.user_approved_at,
            ..
        };

        let result = self.automation.execute_deletion(task, self).await;
        DeletionResult::from_automation(result, self.service_name())
    }

    async fn verify_deleted(&self, asset: &InventoryAsset, _ctx: &DeletionContext) -> VerificationResult {
        // Probe the profile URL — expect 404 after deletion
        let url = format!("https://github.com/{}", asset.label);
        let response = reqwest::get(&url).await;
        match response {
            Ok(r) if r.status() == 404 => VerificationResult::verified("Profile returns 404"),
            Ok(r) => VerificationResult::unverified(format!("Profile still returns {}", r.status())),
            Err(e) => VerificationResult::error(e.to_string()),
        }
    }
}

12.2 Generic GDPR Deletion Plugin

Rust

// src/remote_deletion/plugins/generic_gdpr.rs

pub struct GenericGdprDeletion {
    generator: Arc<GdprRequestGenerator>,
    output_dir: PathBuf,
}

#[async_trait]
impl DeletionPlugin for GenericGdprDeletion {
    fn service_name(&self) -> &str { "generic_gdpr" }
    fn deletion_method(&self) -> DeletionMethod {
        DeletionMethod::GdprArticle17 {
            template: "standard_erasure".to_string(),
            contact: "privacy@[service]".to_string(),
        }
    }

    async fn delete_account(&self, asset: &InventoryAsset, ctx: &DeletionContext) -> DeletionResult {
        let request = self.generator.generate_request(asset, &ctx.user_profile);

        // Write draft to output_dir — user must send manually if SMTP not configured
        let output_path = self.output_dir.join(format!(
            "gdpr_request_{}_{}.txt",
            asset.platform.as_deref().unwrap_or("unknown"),
            request.reference_id,
        ));
        tokio::fs::write(&output_path, request.body.as_bytes()).await?;

        DeletionResult {
            service: asset.platform.clone().unwrap_or_default(),
            method_used: self.deletion_method(),
            success: true, // Request generated — not yet sent
            ticket_id: Some(request.reference_id.clone()),
            evidence: vec![
                EvidenceArtifact {
                    artifact_type: ArtifactType::GdprTicketId,
                    content_hash: sha256(request.body.as_bytes()),
                    summary: format!("GDPR Article 17 request draft written to {:?}", output_path),
                    raw_data: None,
                }
            ],
            limitations: vec![
                "GDPR Article 17 right to erasure is not absolute; exceptions apply (legal obligations, public interest).".to_string(),
                "This is a request — completion depends on the controller's processing timeline and any applicable exceptions.".to_string(),
                "Manual action required: send this request to the controller if SMTP not configured.".to_string(),
            ],
            ..
        }
    }
}

13. Credential Revocation Deep Dive
13.1 GitHub Token Revocation

Rust

// src/revocation/plugins/github.rs

pub struct GithubTokenRevoker {
    client: reqwest::Client,
    delay_registry: Arc<PropagationDelayRegistry>,
}

#[async_trait]
impl RevocationPlugin for GithubTokenRevoker {
    fn service_name(&self) -> &str { "github_token" }

    async fn revoke(&self, asset: &InventoryAsset, ctx: &RevocationContext) -> RevocationResult {
        // GitHub Docs: DELETE /applications/{client_id}/token
        // Also covers: POST /applications/{client_id}/token (check + revoke)
        let token = asset.local_path.as_deref().unwrap_or("");
        let resp = self.client
            .delete(&format!(
                "https://api.github.com/applications/{}/token",
                ctx.client_id
            ))
            .basic_auth(&ctx.client_id, Some(&ctx.client_secret))
            .json(&serde_json::json!({ "access_token": token }))
            .send()
            .await;

        match resp {
            Ok(r) => RevocationResult {
                success: r.status() == 204,
                requested_at: Utc::now(),
                propagation_delay_seconds: Some(
                    self.delay_registry.get_delay("github_token").as_secs()
                ),
                evidence: vec![EvidenceArtifact {
                    artifact_type: ArtifactType::RevocationConfirmation,
                    content_hash: sha256(r.status().as_str().as_bytes()),
                    summary: format!("HTTP {}", r.status()),
                    raw_data: None,
                }],
                ..
            },
            Err(e) => RevocationResult::failed(e.to_string()),
        }
    }

    fn known_propagation_delay(&self) -> Duration {
        Duration::from_secs(60)
    }
}

14. Cryptographic Receipt Deep Dive
14.1 Three Proof Levels

Every receipt explicitly annotates which proof level applies to each action:

Rust

// src/receipt/proof_levels.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProofLevel {
    /// Proof of Intent & Execution:
    /// MORTIS was run at T, triggered by E, these actions were dispatched.
    /// Evidence: PGP-signed + RFC3161-timestamped execution log.
    IntentAndExecution,

    /// Proof of Local Sanitization:
    /// File/device was sanitized using method M per NIST 800-88,
    /// verified with outcome V, at timestamp T.
    /// Evidence: Pre/post hash, verification outcome, media class, method used.
    LocalSanitization {
        media_class: MediaClass,
        method: String,
        verification_outcome: String,
        nist_800_88_reference: String,
    },

    /// Proof of Remote Request & Observable Outcome:
    /// Request submitted at T. HTTP response: H.
    /// Re-verified at T+Δ: [outcome].
    /// Limitations: [list of known limitations].
    /// Note: This evidences a request and observed effect; it does not prove
    ///       server-side deletion or removal from caches/scrapes.
    RemoteRequestAndOutcome {
        endpoint: String,
        request_hash: String,
        response_hash: String,
        verified_at: Option<DateTime<Utc>>,
        verification_outcome: Option<String>,
        limitations: Vec<String>,
    },
}

14.2 Receipt Compilation

Rust

// src/receipt/mod.rs

pub struct ReceiptSystem {
    signer: Arc<PgpSigner>,
    timestamper: Arc<Rfc3161Timestamper>,
    output_dir: PathBuf,
}

impl ReceiptSystem {
    pub async fn generate_and_sign(&self, run: &DestructionRun) -> Result<DestructionReceipt, ReceiptError> {
        // Step 1: Compile receipt from run state
        let mut receipt = DestructionReceipt::from_run(run);

        // Step 2: Add known limitations for each remote action
        for action in &mut receipt.asset_actions {
            if action.phase == "cloud_deletion" || action.phase == "revoke_credentials" {
                action.evidence.push(EvidenceArtifact {
                    artifact_type: ArtifactType::HttpResponse,
                    summary: format!(
                        "Proof level: RemoteRequestAndOutcome — see limitations for {}",
                        action.asset_label
                    ),
                    ..
                });
            }
        }

        // Step 3: Serialize to canonical JSON
        let json_bytes = serde_json::to_vec_pretty(&receipt)?;

        // Step 4: PGP sign
        let signature = self.signer.sign_receipt(&json_bytes)?;
        receipt.pgp_signature = Some(signature);
        receipt.pgp_key_fingerprint = Some(self.signer.fingerprint.clone());

        // Step 5: RFC 3161 timestamp
        let tst = self.timestamper.timestamp(&json_bytes).await?;
        receipt.rfc3161_timestamp = Some(tst.token_base64);
        receipt.rfc3161_tsa = Some(tst.tsa_url);

        // Step 6: Write to disk
        let output_path = self.output_dir.join(format!("{}-receipt.json", run.run_id));
        tokio::fs::write(&output_path, serde_json::to_vec_pretty(&receipt)?).await?;

        Ok(receipt)
    }
}

15. Browser Automation Deep Dive
15.1 Safety Guarantees

Every browser automation action enforces these invariants — there are no exceptions:

Rust

// src/automation/safety.rs

pub struct AutomationSafetyGuard {
    audit_log: Arc<storage::RunRepo>,
}

impl AutomationSafetyGuard {
    pub fn assert_safe(&self, task: &AutomationTask) -> Result<(), SafetyError> {
        // 1. Approval must be recorded
        if task.requires_approval && task.approved_at.is_none() {
            return Err(SafetyError::NoApproval(task.task_id));
        }
        // 2. Browser must not be headless
        // (Enforced at BrowserAutomationEngine::new() — headless = false always)

        // 3. Log intent before execution (not after)
        self.audit_log.log_automation_intent(task)?;
        Ok(())
    }

    pub fn record_result(&self, task: &AutomationTask, result: &AutomationResult) {
        self.audit_log.log_automation_result(task, result).ok();
    }
}

15.2 Screenshot Evidence

Every browser action takes pre- and post-screenshots. Screenshots are hashed and embedded in the receipt as evidence artifacts (not stored as raw images — only their SHA-256 hashes, to avoid retaining sensitive screen content):

Rust

// src/automation/mod.rs

async fn capture_screenshot_hash(&self, page: &playwright::Page, label: &str) -> EvidenceArtifact {
    let screenshot_bytes = page.screenshot(
        playwright::PageScreenshotOptions::default()
    ).await.unwrap_or_default();

    let hash = sha256(&screenshot_bytes);

    // Write raw screenshot to receipt evidence dir (opt-in, deleted with self-delete)
    if self.config.retain_screenshots {
        let path = self.screenshot_dir.join(format!("{}-{}.png", label, &hash[..8]));
        tokio::fs::write(&path, &screenshot_bytes).await.ok();
    }

    EvidenceArtifact {
        artifact_type: ArtifactType::ScreenshotHash,
        content_hash: hash,
        summary: format!("Screenshot hash at step: {}", label),
        raw_data: None, // Raw bytes not embedded in receipt
    }
}

16. Dead Man's Switch Deep Dive
16.1 State Persistence

The dead man's switch persists its state to disk so it survives process restarts:

Rust

// src/triggers/dead_mans_switch.rs

impl DeadManSwitch {
    async fn persist_check_in(&self) -> Result<(), CheckInError> {
        let state = DeadManSwitchState {
            last_check_in: Utc::now(),
            check_in_count: self.load_state().await.check_in_count + 1,
        };
        let json = serde_json::to_vec(&state)?;
        tokio::fs::write(&self.state_path, &json).await?;
        Ok(())
    }

    pub async fn load_state(&self) -> DeadManSwitchState {
        match tokio::fs::read(&self.state_path).await {
            Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_default(),
            Err(_) => DeadManSwitchState::default(),
        }
    }
}

16.2 "I'm Alive" Check-In Workflow

text

$ mortis checkin

MORTIS Dead Man's Switch Check-In
Last check-in: 2025-05-28 14:22 UTC (23h ago)
Next required: 2025-05-29 14:22 UTC (1h from now)
Grace window: 6h

Enter check-in passphrase: ****

✓ Check-in recorded at 2025-05-29 13:50 UTC
  Next required: 2025-05-31 13:50 UTC

17. Canary System Deep Dive
17.1 HTTP URL Canary Setup

text

$ mortis canary create --type http_url --label "Dev server backup credentials"

Creating HTTP canary token...
✓ Canary URL generated: https://canarytokens.org/generate/{token}
  Label: Dev server backup credentials
  Canary ID: 9f2a3b4c-...
  Escalation mode: escalate_with_grace_window (60min)

Plant this URL in your notes/config where compromise would cause access.
MORTIS will monitor for trips via webhook (configure webhook below).

17.2 File Tripwire (inotify/FSEvents)

Rust

// src/canary/file_tripwire.rs

#[cfg(target_os = "linux")]
use inotify::{Inotify, WatchMask};

#[cfg(target_os = "macos")]
use notify::{Watcher, RecursiveMode, watcher};

pub struct FileTripwire {
    path: PathBuf,
    watch_type: WatchType,  // Access | Modify | Open
}

impl FileTripwire {
    pub async fn watch(&self, event_tx: mpsc::Sender<CanaryTripEvent>) {
        // Platform-appropriate filesystem event monitoring
        // Linux: inotify IN_ACCESS / IN_OPEN
        // macOS: kqueue / FSEvents
        // Windows: ReadDirectoryChangesW
        // ...
    }
}

18. Security Model & Threat Boundaries
18.1 Trust Zones

text

┌──────────────────────────────────────────────┐
│  FULLY TRUSTED (local process)               │
│  - MORTIS binary + runtime                   │
│  - SQLCipher DB (requires passphrase)        │
│  - PGP key store (~/.mortis/pgp/)            │
│  - Receipt output (~/.mortis/receipts/)      │
└────────────────┬─────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────┐
│  SEMI-TRUSTED (local system)                 │
│  - Filesystem (user's files)                 │
│  - Browser profiles                          │
│  - OS credential stores (Keychain, etc.)     │
│  - Cloud CLI configs (~/.aws, etc.)          │
└────────────────┬─────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────┐
│  UNTRUSTED (remote)                          │
│  - All platform APIs (revocation targets)    │
│  - All deletion endpoints                    │
│  - RFC 3161 TSA (for timestamp only)         │
└──────────────────────────────────────────────┘

18.2 Threat Model & Mitigations
Threat	Mitigation
Attacker triggers destruction remotely to destroy evidence	Remote signal trigger requires pre-registered public key; signal must be encrypted to that key. Canary fires escalation, not instant destruct by default
Coercion: user forced to enter passphrase	Duress passphrase silently omits export phase; to observer, run looks identical
False positive dead man's switch (sleep, travel, no internet)	Configurable grace window; check-in via file touch (works offline)
Attacker pokes canary to trigger destruction	Default escalation mode requires user confirmation within grace window
Flaky USB hardware trigger	Debounce window; require_software_confirm = true default
Inventory DB exfiltrated	SQLCipher AES-256-CBC at rest; key derived from passphrase via Argon2id (64MB, 3 iterations)
PGP receipt key stolen	Key stored encrypted with passphrase; never logged, never served over network
Revocation propagation gap exploited	Propagation delays logged explicitly; receipt notes "treat as unsafe until T+Δ"
Browser automation acts autonomously	Hard-coded requires_approval = true in all automation tasks; no bypass code path
WASM (if added later): plugin exfiltrates data	Future: wazero sandbox with no host imports
18.3 What MORTIS Cannot Guarantee

This is written into the design and into every receipt:

Rust

// src/receipt/known_limitations.rs

pub fn global_limitations() -> Vec<String> {
    vec![
        "Search engine caches, web archives, and third-party scrapes of remote content are outside any platform's deletion scope and cannot be acted on by MORTIS.".to_string(),
        "GDPR Article 17 right to erasure is not absolute; controllers may retain data under legal obligation, public interest, or other exceptions.".to_string(),
        "Credential revocation may be subject to propagation delays; the receipt documents the delay window per service.".to_string(),
        "Local sanitization guarantees are bounded by media class detection accuracy and available device-native sanitize commands.".to_string(),
        "Copies of data held by third parties (recipients of emails, participants in chats, etc.) cannot be deleted by MORTIS.".to_string(),
        "This receipt proves what MORTIS attempted and what was observably confirmed. It does not prove absolute deletion of all copies of all data.".to_string(),
    ]
}

19. Storage & Persistence
19.1 Database Connection

Rust

// src/storage/mod.rs

use rusqlite::Connection;
use std::path::Path;

pub struct Db {
    conn: Mutex<Connection>,
}

impl Db {
    pub fn open(path: &Path, key: &[u8; 32]) -> Result<Self, DbError> {
        let conn = Connection::open(path)?;
        // Set SQLCipher key (AES-256-CBC)
        let key_hex = hex::encode(key);
        conn.execute_batch(&format!("PRAGMA key = \"x'{}'\";", key_hex))?;
        conn.execute_batch("PRAGMA cipher_page_size = 4096;")?;
        conn.execute_batch("PRAGMA kdf_iter = 64000;")?; // Additional KDF rounds within SQLCipher
        conn.execute_batch("PRAGMA journal_mode = WAL;")?;
        conn.execute_batch("PRAGMA busy_timeout = 5000;")?;

        let db = Self { conn: Mutex::new(conn) };
        db.run_migrations()?;
        Ok(db)
    }
}

19.2 Log Retention

All logs and run history are retained for a user-configured period. The self-delete phase (Phase 10) can wipe the entire ~/.mortis/ directory:

Rust

// src/orchestrator/phases.rs

pub async fn self_delete(config: &MortisConfig) -> PhaseResult {
    // 1. Wipe receipts dir
    // 2. Wipe exports dir
    // 3. Wipe logs dir
    // 4. Wipe SQLCipher DB (overwrite + unlink)
    // 5. Wipe PGP keys
    // 6. Wipe config.toml
    // 7. Wipe MORTIS binary (if configured)
    // Each step is logged to stdout before execution
}

20. Logging, Observability & Debugging
20.1 Structured Logging (tracing)

Rust

// src/main.rs

use tracing_subscriber::{fmt, EnvFilter};
use tracing_appender::rolling::{RollingFileAppender, Rotation};

pub fn init_logging(config: &LogConfig) {
    let file_appender = RollingFileAppender::new(
        Rotation::DAILY,
        &config.log_dir,
        "mortis.log",
    );

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::new(&config.level))
        .with_writer(file_appender)
        .with_ansi(false)
        .json()  // Structured JSON logs
        .init();
}

20.2 Run Telemetry (Local Only)

Every destruction run writes a machine-readable telemetry file alongside the receipt:

JSON

{
  "run_id": "7f3a1c2d-...",
  "started_at": "2025-05-29T14:00:00Z",
  "completed_at": "2025-05-29T14:07:43Z",
  "duration_seconds": 463,
  "phases": {
    "export": { "state": "completed", "duration_s": 12 },
    "revoke_credentials": { "state": "completed_with_failures", "duration_s": 45, "failures": 1 },
    "destroy_keys": { "state": "completed", "duration_s": 2 },
    "wipe_vaults": { "state": "completed", "duration_s": 4 },
    "cloud_deletion": { "state": "completed", "duration_s": 180 },
    "local_sanitization": { "state": "completed", "duration_s": 210 },
    "verify": { "state": "completed", "duration_s": 8 },
    "receipt": { "state": "completed", "duration_s": 2 }
  },
  "assets_total": 87,
  "assets_completed": 86,
  "assets_failed": 1
}

20.3 Debug Mode

When RUST_LOG=debug:

    Full HTTP request/response bodies logged for revocation and deletion calls
    Media class detection decision tree logged per file
    NIST 800-88 method selection rationale logged per asset
    PGP signing and RFC 3161 request/response logged
    All trigger monitor check cycles logged

21. Testing Strategy
21.1 Test Pyramid

text

                    ┌──────────────┐
                    │  E2E (5%)    │
                    │  Dry run +   │
                    │  mock net    │
                    └──────┬───────┘
               ┌───────────┴────────────┐
               │   Integration (25%)    │
               │  Orchestrator + DB +   │
               │  Mock plugins          │
               └───────────┬────────────┘
          ┌────────────────┴──────────────────┐
          │        Unit Tests (70%)           │
          │  Sanitizer, KDF, Receipt,         │
          │  Trigger logic, Plugin logic      │
          └───────────────────────────────────┘

21.2 Unit Tests

Rust

// tests/unit/sanitization_tests.rs

#[test]
fn test_media_class_selects_correct_nist_method() {
    let selector = SanitizationMethodSelector::default();
    let path = Path::new("/fake/path");

    let hdd_method = selector.select(&MediaClass::Hdd, path);
    assert!(matches!(hdd_method, SanitizationMethod::SinglePassOverwrite { .. }));

    let ssd_method = selector.select(&MediaClass::Ssd, path);
    assert!(matches!(ssd_method,
        SanitizationMethod::DeviceNativeSanitize { .. } |
        SanitizationMethod::CryptographicErase { .. }
    ));

    let nvme_method = selector.select(&MediaClass::Nvme, path);
    assert!(matches!(nvme_method, SanitizationMethod::DeviceNativeSanitize { .. }));
}

#[test]
fn test_overwrite_verifier_samples_correctly() {
    let verifier = SanitizationVerifier::default();
    // Create test file, overwrite with zeros, verify sampling passes
    let tmp = tempfile::NamedTempFile::new().unwrap();
    write_random_content(tmp.path());
    single_pass_overwrite_sync(tmp.path(), OverwritePattern::Zeros);
    let outcome = verifier.verify_sync(tmp.path(), &SanitizationMethod::SinglePassOverwrite {
        pattern: OverwritePattern::Zeros, verify: true
    });
    assert!(matches!(outcome, VerificationOutcome::SampledOverwriteVerified { pass_rate, .. } if pass_rate > 0.99));
}

Rust

// tests/unit/receipt_tests.rs

#[tokio::test]
async fn test_receipt_pgp_signature_is_verifiable() {
    let (cert, _) = generate_receipt_keypair("test@mortis").unwrap();
    let signer = PgpSigner::from_cert(cert);
    let fake_receipt = b"{}";
    let signature = signer.sign_receipt(fake_receipt).unwrap();
    assert!(!signature.is_empty());
    // Verify signature round-trip
    assert!(verify_pgp_signature(fake_receipt, &signature, &signer.public_cert()).is_ok());
}

#[tokio::test]
async fn test_rfc3161_timestamp_contains_correct_hash() {
    let timestamper = Rfc3161Timestamper::new_test(); // Uses mock TSA
    let data = b"test receipt data";
    let token = timestamper.timestamp(data).await.unwrap();
    assert!(!token.token_base64.is_empty());
    assert!(token.timestamp <= Utc::now());
}

Rust

// tests/unit/trigger_tests.rs

#[test]
fn test_safety_interlock_blocks_rapid_fire() {
    let mut interlock = SafetyInterlock::default();
    let event = test_trigger_event();
    assert!(matches!(interlock.evaluate(&event), SafetyDecision::Allow));
    // Second fire within cooldown
    let _ = interlock.record_activation();
    assert!(matches!(interlock.evaluate(&event), SafetyDecision::Block { .. }));
}

#[test]
fn test_canary_default_escalates_not_destructs() {
    let mut interlock = SafetyInterlock::default();
    let canary_event = TriggerEvent {
        trigger_type: TriggerType::Canary { .. },
        confidence: TriggerConfidence::Canary,
        ..
    };
    assert!(matches!(interlock.evaluate(&canary_event), SafetyDecision::Escalate { .. }));
}

21.3 Integration Tests (Mock Plugins)

Rust

// tests/integration/dry_run_tests.rs

#[tokio::test]
async fn test_dry_run_produces_plan_without_executing() {
    let (orchestrator, mock_db) = build_test_orchestrator().await;
    let trigger = test_manual_trigger();

    let run = orchestrator.execute(trigger, RunOptions {
        dry_run: true,
        duress: false,
    }).await;

    // Dry run should produce a plan but zero actual actions
    assert!(run.is_dry_run);
    assert_eq!(run.assets_completed, 0);
    assert_eq!(run.asset_actions.len(), 0);

    // But should have generated a plan document
    let plan = mock_db.get_last_plan().await.unwrap();
    assert!(!plan.phases.is_empty());
}

#[tokio::test]
async fn test_phase_failure_does_not_halt_receipt_generation() {
    let (orchestrator, _) = build_test_orchestrator_with_failing_revocation().await;
    let run = orchestrator.execute(test_manual_trigger(), RunOptions::default()).await;

    // Revocation phase failed
    assert!(run.phases[&PhaseId::RevokeCredentials].is_failed());

    // Receipt phase must have still run
    assert!(run.phases[&PhaseId::Receipt].is_completed());

    // Receipt must contain the failure record
    let receipt = run.get_receipt().unwrap();
    assert!(receipt.asset_actions.iter().any(|a| !a.success));
}

21.4 E2E Tests (Full Dry Run)

Rust

// tests/e2e/full_run_test.rs

#[tokio::test]
async fn test_full_dry_run_with_mock_inventory() {
    // Build a complete MORTIS instance with mock network and mock inventory
    let config = test_config();
    let mut mortis = Mortis::new(config).await.unwrap();
    mortis.load_mock_inventory(mock_inventory_all_types()).await;

    let result = mortis.run(RunOptions { dry_run: true, ..Default::default() }).await;

    assert_eq!(result.phases.len(), 10);
    assert!(result.phases.values().all(|p|
        matches!(p, PhaseState::Skipped { .. }) // dry run: all skipped
    ));
}

22. Build, Packaging & Installation
22.1 Cargo.toml (Key Dependencies)

toml

[package]
name = "mortis"
version = "1.0.0"
edition = "2021"
rust-version = "1.75"

[dependencies]
# CLI
clap = { version = "4", features = ["derive", "env"] }

# Async runtime
tokio = { version = "1", features = ["full"] }

# HTTP client
reqwest = { version = "0.11", features = ["json", "rustls-tls"], default-features = false }

# TLS
rustls = "0.22"

# Cryptography
ring = "0.17"
sequoia-openpgp = "1"
argon2 = "0.5"
zeroize = { version = "1", features = ["derive"] }

# Timestamp (RFC 3161)
# (Custom implementation using rasn or der crates)
rasn = "0.12"
rasn-cms = "0.12"

# Database
rusqlite = { version = "0.31", features = ["bundled-sqlcipher"] }

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"
toml = "0.8"

# Browser automation
playwright = "0.0.20"

# UUID
uuid = { version = "1", features = ["v4", "serde"] }

# DateTime
chrono = { version = "0.4", features = ["serde"] }

# Hashing
sha2 = "0.10"
hex = "0.4"

# Email (SMTP)
lettre = { version = "0.11", features = ["smtp-transport", "rustls-tls"] }

# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
tracing-appender = "0.2"

# Filesystem watching
notify = "6"
inotify = { version = "0.10", optional = true }

# Config
config = "0.14"

# Directories (platform home dir)
dirs = "5"

# Async trait
async-trait = "0.1"

# Error handling
thiserror = "1"
anyhow = "1"

# Base64
base64 = "0.21"

# Temp files (testing)
tempfile = "3"

[features]
default = []
inotify = ["dep:inotify"]

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true

22.2 Makefile

Makefile

.PHONY: all build test lint clean release install

# Build (debug)
build:
	cargo build

# Build (release, stripped, LTO)
build-release:
	cargo build --release

# Run all tests
test:
	cargo test --workspace

# Run integration tests
test-integration:
	cargo test --test '*' -- --test-threads=1

# Lint
lint:
	cargo clippy --all-targets -- -D warnings
	cargo fmt --check

# Format
fmt:
	cargo fmt

# Clean
clean:
	cargo clean

# Cross-platform release builds (requires cross or cargo-zigbuild)
release:
	cargo build --release --target x86_64-unknown-linux-musl
	cargo build --release --target aarch64-unknown-linux-musl
	cargo build --release --target x86_64-apple-darwin
	cargo build --release --target aarch64-apple-darwin
	cargo build --release --target x86_64-pc-windows-msvc

# Install locally
install:
	cargo install --path .

# Initialize MORTIS for the current user
init:
	mortis init

# Run dry run (useful for development)
dry-run:
	mortis run --dry-run

22.3 Installation Script

Bash

#!/bin/bash
# install.sh

set -e

MORTIS_HOME="$HOME/.mortis"
mkdir -p "$MORTIS_HOME/certs" "$MORTIS_HOME/receipts" "$MORTIS_HOME/logs" \
         "$MORTIS_HOME/exports" "$MORTIS_HOME/gdpr_requests" "$MORTIS_HOME/pgp"

echo "📥 Downloading MORTIS..."
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
[ "$ARCH" = "x86_64" ] && ARCH="x86_64"
[ "$ARCH" = "aarch64" ] && ARCH="aarch64"
[ "$ARCH" = "arm64" ]   && ARCH="aarch64"

BINARY="mortis-${OS}-${ARCH}"
curl -L "https://github.com/your-repo/mortis/releases/latest/download/${BINARY}" \
  -o /usr/local/bin/mortis
chmod +x /usr/local/bin/mortis

echo "⚙️  Initializing MORTIS..."
mortis init

echo ""
echo "✅ MORTIS installed."
echo ""
echo "Next steps:"
echo "  1. Run 'mortis scan' to build your initial inventory"
echo "  2. Run 'mortis inventory' to review what was found"
echo "  3. Run 'mortis plan' to preview your destruction plan"
echo "  4. Configure triggers in ~/.mortis/config.toml"
echo ""
echo "When ready: 'mortis run --dry-run' to simulate a run without executing."

23. Platform Support Matrix
Feature	macOS (Intel)	macOS (Apple Silicon)	Linux (x86_64)	Linux (arm64)	Windows (x86_64)
Core CLI	✅	✅	✅	✅	✅
SQLCipher Inventory	✅	✅	✅	✅	✅
SSH Key Scan	✅	✅	✅	✅	✅
macOS Keychain	✅	✅	❌	❌	❌
Linux Secret Service	❌	❌	✅	✅	❌
Windows Credential Manager	❌	❌	❌	❌	✅
HDD Overwrite	✅	✅	✅	✅	✅
ATA Secure Erase	✅ (hdparm)	✅	✅	✅	⚠️ (admin)
NVMe Sanitize	✅ (nvme-cli)	✅	✅	✅	⚠️ (admin)
Playwright Automation	✅	✅	✅	✅	✅
PGP Signing (sequoia)	✅	✅	✅	✅	✅
RFC 3161 Timestamp	✅	✅	✅	✅	✅
SMTP Notify	✅	✅	✅	✅	✅
Dead Man's Switch	✅	✅	✅	✅	✅
File Tripwire (inotify)	❌	❌	✅	✅	❌
File Tripwire (FSEvents)	✅	✅	❌	❌	❌
File Tripwire (ReadDirChanges)	❌	❌	❌	❌	✅
Hardware Token Trigger	✅	✅	✅	✅	✅
24. Performance Targets & Benchmarks
Metric	Target	Notes
Inventory load (1000 assets)	< 500ms	SQLCipher read with index
Bloom filter lookup (blocklist)	N/A	No blocklist in MORTIS
Argon2id KDF (64MB, 3 iter)	2-5s	Intentionally slow for security
Single-pass overwrite (1GB HDD file)	< 30s	Disk-speed bound; logged
NVMe sanitize command	1-300s	Device-dependent; async, non-blocking
Credential revocation (10 tokens, serial)	< 60s	Network bound; parallel option available
Browser automation (one account deletion)	30-120s	Page load + interaction bound
PGP sign receipt	< 1s	Sequoia + Curve25519
RFC 3161 timestamp (network round-trip)	< 5s	TSA-dependent
Full dry run (100 assets)	< 10s	No I/O, plan generation only
Full destruction run (100 assets, mock net)	3-10 min	Dominated by browser automation
25. Error Handling Strategy
25.1 Error Categories

Rust

// src/errors/mod.rs

#[derive(Debug, thiserror::Error)]
pub enum MortisError {
    #[error("Inventory error: {0}")]
    Inventory(#[from] InventoryError),

    #[error("Trigger error: {0}")]
    Trigger(#[from] TriggerError),

    #[error("Sanitization error: {0}")]
    Sanitization(#[from] SanitizationError),

    #[error("Revocation error: {0}")]
    Revocation(#[from] RevocationError),

    #[error("Deletion error: {0}")]
    Deletion(#[from] DeletionError),

    #[error("Receipt error: {0}")]
    Receipt(#[from] ReceiptError),

    #[error("Crypto error: {0}")]
    Crypto(#[from] CryptoError),

    #[error("Storage error: {0}")]
    Storage(#[from] StorageError),

    #[error("Config error: {0}")]
    Config(#[from] ConfigError),
}

25.2 Core Error Policy

Critical rule: errors in any phase must never suppress the receipt.

Rust

// src/orchestrator/runner.rs

impl DestructionOrchestrator {
    async fn execute_phase<F, Fut>(&self, phase: PhaseId, f: F) -> PhaseState
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<PhaseResult, MortisError>>,
    {
        let started = Utc::now();
        match f().await {
            Ok(result) => {
                tracing::info!(phase = ?phase, "Phase completed");
                PhaseState::Completed { result }
            }
            Err(e) => {
                // Log the error but NEVER halt the run
                // Receipt must always be generated regardless of prior failures
                tracing::error!(phase = ?phase, error = %e, "Phase failed — continuing to next phase");
                PhaseState::Failed {
                    error: e.to_string(),
                    partial_results: self.collect_partial_results(&phase),
                }
            }
        }
    }
}

25.3 Receipts Are Written Regardless

The receipt phase is special: it runs even if every previous phase failed. This is enforced structurally — Phase 8 (Receipt) is not inside the same fallible chain as the other phases:

Rust

// src/orchestrator/runner.rs

// Phases 1-7: best effort, errors logged
for phase in &[Export, RevokeCredentials, DestroyKeys, WipeVaults,
               CloudDeletion, LocalSanitization, Verify] {
    run.execute_phase(*phase, ...).await; // Non-fatal
}

// Phase 8: Receipt ALWAYS runs
// This is intentionally outside the error-accumulating loop
run.execute_receipt_phase(&self.receipt).await; // Separate, always executes

// Phases 9-10: Non-fatal
run.execute_phase(Notify, ..).await;
if self.config.self_delete_on_completion {
    run.execute_phase(SelfDelete, ..).await;
}

26. Dependency Registry
26.1 Rust Crates (Full)
Crate	Version	Purpose
clap	4.x	CLI argument parsing
tokio	1.x	Async runtime, scheduling
reqwest	0.11.x	HTTP client (revocation, deletion APIs)
rustls	0.22.x	TLS for all outbound HTTPS
ring	0.17.x	AES, SHA-256, HMAC
sequoia-openpgp	1.x	PGP key generation, signing, verification
argon2	0.5.x	Argon2id key derivation for DB + passphrase
zeroize	1.x	Secure memory zeroing
rasn + rasn-cms	0.12.x	ASN.1 / RFC 3161 TST construction
rusqlite	0.31.x	SQLite client (bundled SQLCipher)
serde + serde_json	1.x	Serialization
toml	0.8.x	Config file parsing
playwright	0.0.20.x	Browser automation
uuid	1.x	UUID v4 generation
chrono	0.4.x	DateTime handling
sha2	0.10.x	SHA-256 hashing
hex	0.4.x	Hex encoding
lettre	0.11.x	SMTP email sending
tracing	0.1.x	Structured logging
tracing-subscriber	0.3.x	Log output (JSON, file)
tracing-appender	0.2.x	Rolling file log appender
notify	6.x	Cross-platform filesystem watching
inotify	0.10.x	Linux inotify (optional, Linux only)
config	0.14.x	Config loading + env override
dirs	5.x	Platform home directory resolution
async-trait	0.1.x	Async trait support
thiserror	1.x	Error type derivation
anyhow	1.x	Error context wrapping
base64	0.21.x	Base64 encoding
tempfile	3.x	Temp files for tests
26.2 External Tools Required
Tool	Required For	Install
Rust ≥ 1.75	Build	`curl https://sh.rustup.rs
nvme-cli	NVMe device sanitize	apt install nvme-cli / brew install nvme-cli
hdparm	ATA Secure Erase	apt install hdparm
Node.js ≥ 20	Playwright browser binaries	brew install node
GPG	Optional: existing key import	Pre-installed on most systems
cargo	Build	Included with Rust
27. Milestone & Phased Rollout Plan
Phase 1 — Foundation (Weeks 1-4)

Goal: Working inventory + dry-run plan generation

    Project structure and Cargo.toml
    SQLCipher DB setup + migrations
    Argon2id KDF + database key derivation
    Core inventory data model + CRUD
    SSH key connector
    GPG key connector
    Filesystem connector (user-defined directories)
    Manual trigger (passphrase)
    Safety interlock
    DestructionPlan builder (dry-run output)
    CLI: init, scan, inventory, plan
    Structured logging (tracing)
    Unit tests for inventory and KDF

Deliverable: mortis init && mortis scan && mortis plan works. Produces human-readable destruction plan. No actual destruction.
Phase 2 — Local Sanitization (Weeks 5-8)

Goal: Credible local file wipe with NIST 800-88 alignment

    Media class detector (HDD / SSD / NVMe / Unknown)
    NIST 800-88 method selector
    Single-pass overwrite (HDD)
    Cryptographic erase path
    NVMe sanitize command wrapper
    ATA Secure Erase wrapper
    Sanitization verifier (sampling + device status)
    SSH key and GPG key wipe routines
    Vault wipe stubs (pluggable)
    Phase 6 (local sanitization) wired into orchestrator
    Receipt system: local sanitization proof level
    Unit + integration tests for sanitization

Deliverable: mortis run can safely wipe all designated local assets with correct media-class methods and produce a receipt evidencing local sanitization.
Phase 3 — Cryptographic Receipt (Weeks 9-11)

Goal: Signed, timestamped receipt for every run

    DestructionReceipt struct + serialization
    PGP key generation on mortis init (sequoia-pgp)
    PGP detached signature generation
    RFC 3161 TimeStampReq construction (rasn)
    RFC 3161 TSA submission and TST parsing
    Three proof levels annotated per action
    Global limitations section in every receipt
    mortis receipt CLI command (view + verify)
    Unit tests for signing and timestamping

Deliverable: Every run produces a receipt that can be independently verified: PGP signature validates, RFC 3161 timestamp confirms time bounds, proof levels are explicit.
Phase 4 — Credential Revocation (Weeks 12-14)

Goal: Revoke all major credentials before local wipe

    RevocationPlugin trait
    PropagationDelayRegistry
    GitHub token revoker
    Google OAuth revoker
    AWS IAM key revoker
    SSH + GPG key file purger
    Generic bearer token revoker (configurable)
    Phase 2 (revoke) wired into orchestrator + receipt
    Integration tests with mock HTTP server

Deliverable: mortis run revokes all configured credentials in Phase 2, before any local wipe, with propagation delay metadata in the receipt.
Phase 5 — Remote Deletion + Browser Automation (Weeks 15-18)

Goal: Account deletion requests for all configured services

    DeletionPlugin trait
    GdprRequestGenerator
    BrowserAutomationEngine (Playwright)
    Safety guard + automation audit log
    GitHub deletion plugin (browser
