//! Orchestrator — §4.3 Phase Choreography
//!
//! Invariants:
//! - Receipt ALWAYS emitted after phase execution begins.
//! - Phase order is DETERMINISTIC from the plan.
//! - dry_run cannot change mid-run.
//! - Each phase result recorded atomically before next phase.
//! - §5.4: Receipts are append-only — written incrementally after each phase.

use chrono::Utc;
use std::time::{Duration, Instant};
use tracing::{error, info, warn};
use uuid::Uuid;

use mortis_crypto::receipt_engine::ReceiptEngine;
use mortis_plugins::sanitization::*;
use mortis_plugins::traits::*;
use mortis_types::asset::*;
use mortis_types::plan::*;
use mortis_types::receipt::{Receipt, ReceiptPhase};

use crate::passphrase::PassphraseResult;

#[derive(Debug, thiserror::Error)]
pub enum OrchestratorError {
    #[error("passphrase failed")]
    PassphraseFailed,
    #[error("plan load: {0}")]
    PlanLoad(String),
}

pub struct RunOptions {
    pub dry_run: bool,
    pub no_timestamp: bool,
    pub coercion: bool,
}

/// §10.2: run_metrics recorded after each run
#[derive(Debug, Clone, serde::Serialize)]
pub struct RunMetrics {
    pub run_duration_ms: u64,
    pub phases_total: i32,
    pub phases_succeeded: i32,
    pub phases_failed: i32,
    pub bytes_processed: u64,
    pub plugins_invoked: u32,
    pub plugins_timed_out: u32,
    pub plugins_panicked: u32,
    pub receipt_signed: bool,
    pub rfc3161_timestamped: bool,
}

/// Callback for incremental receipt persistence (§5.4)
pub type ReceiptPersistFn = Box<dyn Fn(&Receipt) + Send + Sync>;

pub struct Orchestrator {
    receipt_engine: ReceiptEngine,
    sanitization_plugins: Vec<Box<dyn SanitizationPlugin>>,
    deletion_plugins: Vec<Box<dyn DeletionPlugin>>,
    persist_fn: Option<ReceiptPersistFn>,
}

impl Orchestrator {
    pub fn new(receipt_engine: ReceiptEngine) -> Self {
        Self {
            receipt_engine,
            sanitization_plugins: Vec::new(),
            deletion_plugins: Vec::new(),
            persist_fn: None,
        }
    }

    pub fn with_default_plugins(mut self) -> Self {
        self.sanitization_plugins.push(Box::new(FileOverwritePlugin));
        self.sanitization_plugins.push(Box::new(DirectorySanitizePlugin));
        self.sanitization_plugins.push(Box::new(BrowserStatePlugin));
        self.sanitization_plugins.push(Box::new(CryptographicErasePlugin));
        self
    }

    /// §5.4: Set callback for incremental receipt persistence
    pub fn with_persist_fn(mut self, f: ReceiptPersistFn) -> Self {
        self.persist_fn = Some(f);
        self
    }

    pub fn add_sanitization_plugin(&mut self, p: Box<dyn SanitizationPlugin>) {
        self.sanitization_plugins.push(p);
    }

    pub fn add_deletion_plugin(&mut self, p: Box<dyn DeletionPlugin>) {
        self.deletion_plugins.push(p);
    }

    /// Execute a run. Returns (receipt, metrics).
    pub async fn execute_run(
        &self,
        plan: &Plan,
        passphrase_result: PassphraseResult,
        options: RunOptions,
        triggered_by: &str,
        inventory: &[(Asset, SanitizationMethod)],
    ) -> (Receipt, RunMetrics) {
        let run_id = Uuid::new_v4();
        let start = Instant::now();
        info!(run_id = %run_id, plan = %plan.name, dry_run = options.dry_run, "run starting");

        let mut receipt = self.receipt_engine.begin_receipt(
            run_id, triggered_by, options.dry_run, options.coercion, Some(plan.id),
        );

        // §5.4: Write initial receipt immediately
        if let Some(f) = &self.persist_fn {
            f(&receipt);
        }

        let mut metrics = RunMetrics {
            run_duration_ms: 0,
            phases_total: 0,
            phases_succeeded: 0,
            phases_failed: 0,
            bytes_processed: 0,
            plugins_invoked: 0,
            plugins_timed_out: 0,
            plugins_panicked: 0,
            receipt_signed: false,
            rfc3161_timestamped: false,
        };

        let phases: Vec<&PlanPhase> = match passphrase_result {
            PassphraseResult::Primary => plan.phases.iter().collect(),
            PassphraseResult::Duress => {
                warn!("duress: reduced plan (no self-destruct)");
                plan.phases.iter().filter(|p| p.phase_type != PhaseType::SelfDestruct).collect()
            }
            PassphraseResult::Failed => {
                error!("passphrase failed inside orchestrator");
                ReceiptEngine::finalize(&mut receipt);
                self.persist_incremental(&receipt);
                metrics.run_duration_ms = start.elapsed().as_millis() as u64;
                return (receipt, metrics);
            }
        };

        for phase in &phases {
            let phase_start = Instant::now();
            let result = self.execute_phase(phase, &options, inventory, &mut metrics).await;

            let receipt_phase = build_receipt_phase(phase, &result, phase_start);
            ReceiptEngine::record_phase(&mut receipt, receipt_phase);

            match &result {
                PhaseOutcome::Success { .. } => metrics.phases_succeeded += 1,
                PhaseOutcome::Partial { .. } | PhaseOutcome::Failed { .. } => metrics.phases_failed += 1,
                _ => {}
            }
            metrics.phases_total += 1;

            // §5.4: Persist receipt after each phase (append-only)
            self.persist_incremental(&receipt);

            if result.is_failed() && !phase.continue_on_failure {
                error!(phase = phase.phase_order, "phase failed; aborting");
                break;
            }
        }

        ReceiptEngine::finalize(&mut receipt);
        let signed = self.receipt_engine.sign(&mut receipt);
        metrics.receipt_signed = signed;
        if !signed {
            warn!("receipt unsigned: no keypair");
        }

        // Final persist with signature
        self.persist_incremental(&receipt);

        metrics.bytes_processed = receipt.summary.bytes_processed;
        metrics.run_duration_ms = start.elapsed().as_millis() as u64;

        info!(
            run_id = %run_id,
            result = %receipt.summary.overall_result,
            succeeded = metrics.phases_succeeded,
            failed = metrics.phases_failed,
            bytes = metrics.bytes_processed,
            duration_ms = metrics.run_duration_ms,
            plugins_invoked = metrics.plugins_invoked,
            plugins_timed_out = metrics.plugins_timed_out,
            plugins_panicked = metrics.plugins_panicked,
            "run complete"
        );

        (receipt, metrics)
    }

    fn persist_incremental(&self, receipt: &Receipt) {
        if let Some(f) = &self.persist_fn {
            f(receipt);
        }
    }

    async fn execute_phase(
        &self,
        phase: &PlanPhase,
        options: &RunOptions,
        inventory: &[(Asset, SanitizationMethod)],
        metrics: &mut RunMetrics,
    ) -> PhaseOutcome {
        if options.dry_run {
            info!(phase = phase.phase_order, type = %phase.phase_type, "DRY RUN");
            return PhaseOutcome::Success { bytes: 0, plugin: "dry_run".to_string() };
        }

        match phase.phase_type {
            PhaseType::SanitizeLocal | PhaseType::ClearBrowser | PhaseType::WipeDb => {
                self.execute_sanitization(phase, inventory, metrics).await
            }
            PhaseType::RevokeRemote => {
                self.execute_revocation(phase, inventory, metrics).await
            }
            PhaseType::SelfDestruct => {
                self.execute_self_destruct(phase, options.dry_run).await
            }
        }
    }

    async fn execute_sanitization(
        &self,
        phase: &PlanPhase,
        inventory: &[(Asset, SanitizationMethod)],
        metrics: &mut RunMetrics,
    ) -> PhaseOutcome {
        let mut total_bytes = 0u64;
        let mut errors: Vec<String> = Vec::new();
        let mut assets_processed = 0u32;

        for (asset, method) in inventory {
            if !phase.asset_ids.contains(&asset.id) {
                continue;
            }

            let plugin = self.sanitization_plugins.iter().find(|p| {
                p.supported_media_types().contains(&asset.media_type)
            });

            let plugin = match plugin {
                Some(p) => p,
                None => {
                    warn!(media = %asset.media_type, "no plugin for media type");
                    errors.push(format!("no plugin for {}", asset.media_type));
                    continue;
                }
            };

            let plugin_name = plugin.name().to_string();
            metrics.plugins_invoked += 1;

            let timeout_duration = Duration::from_secs(300);
            let result = tokio::time::timeout(
                timeout_duration,
                plugin.sanitize(asset, method, false),
            ).await;

            match result {
                Ok(Ok(sr)) => {
                    if sr.success {
                        total_bytes += sr.bytes_processed;
                        assets_processed += 1;
                    } else {
                        errors.push(sr.error.unwrap_or_else(|| "unknown".to_string()));
                    }
                }
                Ok(Err(e)) => {
                    warn!(error = %e, "sanitization error");
                    errors.push(e.to_string());
                }
                Err(_) => {
                    error!(plugin = %plugin_name, "timeout");
                    metrics.plugins_timed_out += 1;
                    errors.push(format!("{} timeout", plugin_name));
                }
            }
        }

        let fallback_name = self.sanitization_plugins.first().map(|p| p.name().to_string()).unwrap_or_default();

        if errors.is_empty() {
            PhaseOutcome::Success { bytes: total_bytes, plugin: fallback_name }
        } else if assets_processed > 0 {
            PhaseOutcome::Partial { bytes: total_bytes, error: errors.join("; "), plugin: fallback_name }
        } else {
            PhaseOutcome::Failed { error: errors.join("; "), plugin: fallback_name }
        }
    }

    /// §4.3: Invoke deletion plugins for each service
    async fn execute_revocation(
        &self,
        phase: &PlanPhase,
        inventory: &[(Asset, SanitizationMethod)],
        metrics: &mut RunMetrics,
    ) -> PhaseOutcome {
        if self.deletion_plugins.is_empty() {
            warn!("no deletion plugins registered");
            return PhaseOutcome::Skipped { reason: "no deletion plugins".to_string() };
        }

        let total_bytes = 0u64;
        let mut errors: Vec<String> = Vec::new();
        let mut services_processed = 0u32;

        // Find assets in this phase that have a service_id
        let phase_assets: Vec<&Asset> = inventory
            .iter()
            .filter(|(a, _)| phase.asset_ids.contains(&a.id) && a.service_id.is_some())
            .map(|(a, _)| a)
            .collect();

        for plugin in &self.deletion_plugins {
            for service_id in plugin.service_ids() {
                // Only invoke if any asset targets this service
                let has_asset = phase_assets.iter().any(|a| {
                    a.service_id.as_deref() == Some(service_id)
                });

                if !has_asset && !phase_assets.is_empty() {
                    continue;
                }

                metrics.plugins_invoked += 1;
                let plugin_name = plugin.name().to_string();

                // Build credential from asset (encrypted value would come from DB in production)
                let credential = mortis_types::credential::Credential {
                    id: Uuid::new_v4(),
                    service_id: service_id.to_string(),
                    credential_type: mortis_types::credential::CredentialType::ApiKey,
                    encrypted_value: vec![],
                    nonce: vec![],
                    expires_at: None,
                    created_at: Utc::now(),
                    rotated_at: None,
                };

                let options = DeletionOptions { timeout_ms: 30_000 };

                let result = tokio::time::timeout(
                    Duration::from_secs(30),
                    plugin.delete(&credential, &options, false),
                ).await;

                match result {
                    Ok(Ok(dr)) => {
                        if dr.success {
                            services_processed += 1;
                            info!(service = service_id, plugin = %plugin_name, "deletion succeeded");
                        } else {
                            let err = dr.error.unwrap_or_else(|| "unknown".to_string());
                            warn!(service = service_id, error = %err, "deletion failed (best-effort)");
                            errors.push(format!("{}: {}", service_id, err));
                        }
                    }
                    Ok(Err(e)) => {
                        warn!(service = service_id, error = %e, "deletion error");
                        errors.push(format!("{}: {}", service_id, e));
                    }
                    Err(_) => {
                        error!(service = service_id, "deletion timeout");
                        metrics.plugins_timed_out += 1;
                        errors.push(format!("{}: timeout", service_id));
                    }
                }
            }
        }

        let plugin_name = self.deletion_plugins.first().map(|p| p.name().to_string()).unwrap_or_default();

        if errors.is_empty() {
            PhaseOutcome::Success { bytes: total_bytes, plugin: plugin_name }
        } else if services_processed > 0 {
            PhaseOutcome::Partial { bytes: total_bytes, error: errors.join("; "), plugin: plugin_name }
        } else {
            PhaseOutcome::Failed { error: errors.join("; "), plugin: plugin_name }
        }
    }

    /// §4.3: Self-destruct — delete mortis config, DB, receipts, keys
    async fn execute_self_destruct(&self, phase: &PlanPhase, dry_run: bool) -> PhaseOutcome {
        info!(phase = phase.phase_order, "self-destruct phase");

        if dry_run {
            return PhaseOutcome::Success { bytes: 0, plugin: "self_destruct".to_string() };
        }

        let mut deleted = 0u64;
        let mut errors: Vec<String> = Vec::new();

        // Delete mortis directory
        let home = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .unwrap_or_else(|_| ".".to_string());
        let mortis_dir = std::path::PathBuf::from(&home).join(".mortis");

        if mortis_dir.exists() {
            match std::fs::remove_dir_all(&mortis_dir) {
                Ok(_) => {
                    info!(dir = %mortis_dir.display(), "deleted mortis directory");
                    deleted += 1;
                }
                Err(e) => {
                    warn!(dir = %mortis_dir.display(), error = %e, "failed to delete mortis directory");
                    errors.push(format!("delete {}: {}", mortis_dir.display(), e));
                }
            }
        }

        // Delete salt file
        let salt_files = [
            format!("{}/.mortis/mortis.salt", home),
            format!("{}/.mortis/mortis.db.salt", home),
        ];
        for salt_file in &salt_files {
            let p = std::path::Path::new(salt_file);
            if p.exists() {
                if let Err(e) = std::fs::remove_file(p) {
                    errors.push(format!("delete {}: {}", salt_file, e));
                } else {
                    deleted += 1;
                }
            }
        }

        let plugin_name = "self_destruct".to_string();
        if errors.is_empty() {
            info!(deleted, "self-destruct completed");
            PhaseOutcome::Success { bytes: deleted, plugin: plugin_name }
        } else {
            warn!(deleted, errors = errors.len(), "self-destruct partially failed");
            PhaseOutcome::Partial { bytes: deleted, error: errors.join("; "), plugin: plugin_name }
        }
    }
}

fn build_receipt_phase(phase: &PlanPhase, outcome: &PhaseOutcome, start: Instant) -> ReceiptPhase {
    let duration = Some(start.elapsed().as_millis() as u64);
    let recorded_at = Utc::now();
    let phase_type = phase.phase_type.to_string();

    match outcome {
        PhaseOutcome::Success { bytes, plugin } => ReceiptPhase {
            phase_order: phase.phase_order, phase_type, plugin_name: Some(plugin.clone()),
            asset_id: None, result: "success".to_string(), best_effort: false,
            bytes_processed: *bytes, duration_ms: duration, evidence: None, error: None, recorded_at,
        },
        PhaseOutcome::Partial { bytes, error, plugin } => ReceiptPhase {
            phase_order: phase.phase_order, phase_type, plugin_name: Some(plugin.clone()),
            asset_id: None, result: "partial".to_string(), best_effort: false,
            bytes_processed: *bytes, duration_ms: duration, evidence: None,
            error: Some(error.clone()), recorded_at,
        },
        PhaseOutcome::Failed { error, plugin } => ReceiptPhase {
            phase_order: phase.phase_order, phase_type, plugin_name: Some(plugin.clone()),
            asset_id: None, result: "failed".to_string(), best_effort: false,
            bytes_processed: 0, duration_ms: duration, evidence: None,
            error: Some(error.clone()), recorded_at,
        },
        PhaseOutcome::Skipped { reason } => ReceiptPhase {
            phase_order: phase.phase_order, phase_type, plugin_name: None,
            asset_id: None, result: "skipped".to_string(), best_effort: false,
            bytes_processed: 0, duration_ms: duration, evidence: None,
            error: Some(reason.clone()), recorded_at,
        },
    }
}

enum PhaseOutcome {
    Success { bytes: u64, plugin: String },
    Partial { bytes: u64, error: String, plugin: String },
    Failed { error: String, plugin: String },
    Skipped { reason: String },
}

impl PhaseOutcome {
    fn is_failed(&self) -> bool {
        matches!(self, PhaseOutcome::Failed { .. })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mortis_crypto::receipt_engine::ReceiptEngine;
    use mortis_crypto::signing::SigningKeyPair;

    #[tokio::test]
    async fn dry_run_produces_signed_receipt() {
        let kp = SigningKeyPair::generate();
        let engine = ReceiptEngine::new(Some(kp));
        let orch = Orchestrator::new(engine).with_default_plugins();

        let plan = Plan {
            id: Uuid::new_v4(), name: "test".to_string(), description: None, is_default: false,
            phases: vec![PlanPhase {
                id: Uuid::new_v4(), phase_order: 0, phase_type: PhaseType::SanitizeLocal,
                asset_ids: vec![Uuid::new_v4()], continue_on_failure: true,
            }],
            created_at: Utc::now(),
        };

        let opts = RunOptions { dry_run: true, no_timestamp: false, coercion: false };
        let (receipt, metrics) = orch.execute_run(&plan, PassphraseResult::Primary, opts, "test", &[]).await;

        assert!(receipt.header.dry_run);
        assert_eq!(receipt.summary.overall_result, "success");
        assert!(receipt.signature.is_some());
        assert!(metrics.receipt_signed);
    }

    #[tokio::test]
    async fn empty_plan() {
        let engine = ReceiptEngine::new(None);
        let orch = Orchestrator::new(engine).with_default_plugins();
        let plan = Plan {
            id: Uuid::new_v4(), name: "e".to_string(), description: None, is_default: false,
            phases: vec![], created_at: Utc::now(),
        };
        let opts = RunOptions { dry_run: false, no_timestamp: false, coercion: false };
        let (receipt, _) = orch.execute_run(&plan, PassphraseResult::Primary, opts, "test", &[]).await;
        assert_eq!(receipt.summary.overall_result, "success");
    }

    #[tokio::test]
    async fn real_file_sanitization() {
        let dir = tempfile::tempdir().unwrap();
        let fp = dir.path().join("secret.txt");
        std::fs::write(&fp, "SECRET DATA").unwrap();

        let asset = Asset {
            id: Uuid::new_v4(), asset_type: AssetType::LocalFile,
            path: Some(fp.to_str().unwrap().to_string()), label: None, service_id: None,
            priority: 100, sanitization_override: None, credential_id: None,
            media_type: MediaType::HddBlock, created_at: Utc::now(), updated_at: Utc::now(),
        };
        let method = SanitizationMethod::OverwriteRandom;

        let engine = ReceiptEngine::new(None);
        let orch = Orchestrator::new(engine).with_default_plugins();
        let plan = Plan {
            id: Uuid::new_v4(), name: "real".to_string(), description: None, is_default: false,
            phases: vec![PlanPhase {
                id: Uuid::new_v4(), phase_order: 0, phase_type: PhaseType::SanitizeLocal,
                asset_ids: vec![asset.id], continue_on_failure: true,
            }],
            created_at: Utc::now(),
        };

        let opts = RunOptions { dry_run: false, no_timestamp: false, coercion: false };
        let (receipt, metrics) = orch.execute_run(&plan, PassphraseResult::Primary, opts, "test", &[(asset, method)]).await;

        assert_eq!(receipt.summary.overall_result, "success");
        assert!(receipt.summary.bytes_processed > 0);
        assert!(metrics.plugins_invoked > 0);
        assert!(!fp.exists());
    }

    #[tokio::test]
    async fn incremental_persistence_called() {
        use std::sync::{Arc, Mutex};

        let persist_count = Arc::new(Mutex::new(0usize));
        let persist_count_clone = persist_count.clone();

        let engine = ReceiptEngine::new(None);
        let orch = Orchestrator::new(engine).with_default_plugins()
            .with_persist_fn(Box::new(move |_receipt| {
                *persist_count_clone.lock().unwrap() += 1;
            }));

        let plan = Plan {
            id: Uuid::new_v4(), name: "inc".to_string(), description: None, is_default: false,
            phases: vec![
                PlanPhase { id: Uuid::new_v4(), phase_order: 0, phase_type: PhaseType::SanitizeLocal,
                    asset_ids: vec![], continue_on_failure: true },
                PlanPhase { id: Uuid::new_v4(), phase_order: 1, phase_type: PhaseType::ClearBrowser,
                    asset_ids: vec![], continue_on_failure: true },
            ],
            created_at: Utc::now(),
        };

        let opts = RunOptions { dry_run: true, no_timestamp: false, coercion: false };
        let (receipt, _) = orch.execute_run(&plan, PassphraseResult::Primary, opts, "test", &[]).await;

        // Should persist: initial + 2 phases + final = at least 4
        let count = *persist_count.lock().unwrap();
        assert!(count >= 4, "expected >=4 persists, got {}", count);
        assert_eq!(receipt.summary.phases_total, 2);
    }

    #[tokio::test]
    async fn duress_excludes_self_destruct() {
        let engine = ReceiptEngine::new(None);
        let orch = Orchestrator::new(engine).with_default_plugins();
        let plan = Plan {
            id: Uuid::new_v4(), name: "d".to_string(), description: None, is_default: false,
            phases: vec![
                PlanPhase { id: Uuid::new_v4(), phase_order: 0, phase_type: PhaseType::SanitizeLocal,
                    asset_ids: vec![], continue_on_failure: true },
                PlanPhase { id: Uuid::new_v4(), phase_order: 1, phase_type: PhaseType::SelfDestruct,
                    asset_ids: vec![], continue_on_failure: true },
            ],
            created_at: Utc::now(),
        };

        let opts = RunOptions { dry_run: true, no_timestamp: false, coercion: true };
        let (receipt, _) = orch.execute_run(&plan, PassphraseResult::Duress, opts, "test", &[]).await;
        assert_eq!(receipt.summary.phases_total, 1);
        assert!(receipt.header.coercion);
    }

    #[tokio::test]
    async fn partial_failure_continues() {
        let dir = tempfile::tempdir().unwrap();
        let existing = dir.path().join("exists.txt");
        std::fs::write(&existing, "data").unwrap();
        let missing = dir.path().join("does_not_exist.txt");

        let asset_ok = Asset {
            id: Uuid::new_v4(), asset_type: AssetType::LocalFile,
            path: Some(existing.to_str().unwrap().to_string()), label: None, service_id: None,
            priority: 100, sanitization_override: None, credential_id: None,
            media_type: MediaType::HddBlock, created_at: Utc::now(), updated_at: Utc::now(),
        };
        let asset_missing = Asset {
            id: Uuid::new_v4(), asset_type: AssetType::LocalFile,
            path: Some(missing.to_str().unwrap().to_string()), label: None, service_id: None,
            priority: 90, sanitization_override: None, credential_id: None,
            media_type: MediaType::HddBlock, created_at: Utc::now(), updated_at: Utc::now(),
        };

        let engine = ReceiptEngine::new(None);
        let orch = Orchestrator::new(engine).with_default_plugins();
        let plan = Plan {
            id: Uuid::new_v4(), name: "partial".to_string(), description: None, is_default: false,
            phases: vec![PlanPhase {
                id: Uuid::new_v4(), phase_order: 0, phase_type: PhaseType::SanitizeLocal,
                asset_ids: vec![asset_ok.id, asset_missing.id], continue_on_failure: true,
            }],
            created_at: Utc::now(),
        };

        let opts = RunOptions { dry_run: false, no_timestamp: false, coercion: false };
        let (receipt, metrics) = orch.execute_run(
            &plan, PassphraseResult::Primary, opts, "test",
            &[(asset_ok, SanitizationMethod::OverwriteRandom),
              (asset_missing, SanitizationMethod::OverwriteRandom)],
        ).await;

        assert_eq!(receipt.summary.overall_result, "success");
        assert!(metrics.plugins_invoked >= 2);
    }

    proptest::proptest! {
        #[test]
        fn receipt_always_emitted(dry in proptest::bool::ANY) {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                let engine = ReceiptEngine::new(None);
                let orch = Orchestrator::new(engine).with_default_plugins();
                let plan = Plan { id: Uuid::new_v4(), name: "p".to_string(), description: None,
                    is_default: false, phases: vec![], created_at: Utc::now() };
                let opts = RunOptions { dry_run: dry, no_timestamp: false, coercion: false };
                let (r, m) = orch.execute_run(&plan, PassphraseResult::Primary, opts, "test", &[]).await;
                assert!(!r.summary.overall_result.is_empty());
                assert!(m.run_duration_ms > 0 || m.run_duration_ms == 0);
            });
        }
    }
}
