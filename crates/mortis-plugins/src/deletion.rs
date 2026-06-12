//! Built-in deletion plugins — §5.2
//!
//! Remote revocation is best-effort per §9.3.

use async_trait::async_trait;
use mortis_types::credential::Credential;
use tracing::{info, warn};

use crate::traits::*;

// ── Google Account Plugin ─────────────────────────────────────────────────────

pub struct GoogleAccountPlugin;

#[async_trait]
impl DeletionPlugin for GoogleAccountPlugin {
    fn name(&self) -> &str {
        "GoogleAccountPlugin"
    }

    fn service_ids(&self) -> &[&str] {
        &["google_account", "gmail", "google_drive", "youtube"]
    }

    async fn delete(
        &self,
        _credential: &Credential,
        _options: &DeletionOptions,
        dry_run: bool,
    ) -> Result<DeletionResult, DeletionError> {
        if dry_run {
            info!("DRY RUN: would delete Google account");
            return Ok(DeletionResult {
                service_id: "google_account".to_string(),
                success: true,
                best_effort_only: true,
                evidence: Some("DRY RUN: simulated".to_string()),
                error: None,
                duration_ms: 0,
            });
        }

        // Production: OAuth2 flow + browser automation to
        // https://myaccount.google.com/deleteaccount
        warn!("Google account deletion: requires OAuth2 + Playwright integration");
        Ok(DeletionResult {
            service_id: "google_account".to_string(),
            success: false,
            best_effort_only: true,
            evidence: None,
            error: Some("not implemented: requires OAuth2 + Playwright".to_string()),
            duration_ms: 0,
        })
    }
}

// ── Dropbox Plugin ────────────────────────────────────────────────────────────

pub struct DropboxPlugin;

#[async_trait]
impl DeletionPlugin for DropboxPlugin {
    fn name(&self) -> &str {
        "DropboxPlugin"
    }

    fn service_ids(&self) -> &[&str] {
        &["dropbox"]
    }

    async fn delete(
        &self,
        _credential: &Credential,
        _options: &DeletionOptions,
        dry_run: bool,
    ) -> Result<DeletionResult, DeletionError> {
        if dry_run {
            info!("DRY RUN: would delete Dropbox account");
            return Ok(DeletionResult {
                service_id: "dropbox".to_string(),
                success: true,
                best_effort_only: true,
                evidence: Some("DRY RUN: simulated".to_string()),
                error: None,
                duration_ms: 0,
            });
        }

        // Production: POST https://api.dropboxapi.com/2/users/delete_batch
        warn!("Dropbox deletion: requires API integration");
        Ok(DeletionResult {
            service_id: "dropbox".to_string(),
            success: false,
            best_effort_only: true,
            evidence: None,
            error: Some("not implemented: requires API integration".to_string()),
            duration_ms: 0,
        })
    }
}

// ── Generic HTTP API Plugin ───────────────────────────────────────────────────

pub struct GenericApiPlugin {
    service_name: &'static str,
    ids: &'static [&'static str],
    delete_url: String,
}

impl GenericApiPlugin {
    pub fn new(service_name: &'static str, ids: &'static [&'static str], delete_url: String) -> Self {
        Self { service_name, ids, delete_url }
    }
}

#[async_trait]
impl DeletionPlugin for GenericApiPlugin {
    fn name(&self) -> &str {
        self.service_name
    }

    fn service_ids(&self) -> &[&str] {
        self.ids
    }

    async fn delete(
        &self,
        _credential: &Credential,
        _options: &DeletionOptions,
        dry_run: bool,
    ) -> Result<DeletionResult, DeletionError> {
        if dry_run {
            info!(service = self.service_name, url = %self.delete_url, "DRY RUN: would call API");
            return Ok(DeletionResult {
                service_id: self.ids[0].to_string(),
                success: true,
                best_effort_only: true,
                evidence: Some(format!("DRY RUN: would call {}", self.delete_url)),
                error: None,
                duration_ms: 0,
            });
        }

        // Production: HTTP DELETE/POST to self.delete_url with credential
        warn!(service = self.service_name, "API deletion: not yet wired");
        Ok(DeletionResult {
            service_id: self.ids[0].to_string(),
            success: false,
            best_effort_only: true,
            evidence: None,
            error: Some("not implemented".to_string()),
            duration_ms: 0,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    fn dummy_credential() -> Credential {
        Credential {
            id: Uuid::new_v4(),
            service_id: "test".to_string(),
            credential_type: mortis_types::credential::CredentialType::ApiKey,
            encrypted_value: vec![],
            nonce: vec![],
            expires_at: None,
            created_at: Utc::now(),
            rotated_at: None,
        }
    }

    #[tokio::test]
    async fn google_dry_run() {
        let plugin = GoogleAccountPlugin;
        let cred = dummy_credential();
        let opts = DeletionOptions { timeout_ms: 30_000 };
        let result = plugin.delete(&cred, &opts, true).await.unwrap();
        assert!(result.success);
        assert!(result.best_effort_only);
    }

    #[tokio::test]
    async fn dropbox_dry_run() {
        let plugin = DropboxPlugin;
        let cred = dummy_credential();
        let opts = DeletionOptions { timeout_ms: 30_000 };
        let result = plugin.delete(&cred, &opts, true).await.unwrap();
        assert!(result.success);
    }

    #[tokio::test]
    async fn generic_api_dry_run() {
        let plugin = GenericApiPlugin::new("TestService", &["test_svc"], "https://example.com/delete".to_string());
        let cred = dummy_credential();
        let opts = DeletionOptions { timeout_ms: 30_000 };
        let result = plugin.delete(&cred, &opts, true).await.unwrap();
        assert!(result.success);
        assert_eq!(result.service_id, "test_svc");
    }

    #[test]
    fn service_ids_correct() {
        assert_eq!(GoogleAccountPlugin.service_ids(), &["google_account", "gmail", "google_drive", "youtube"]);
        assert_eq!(DropboxPlugin.service_ids(), &["dropbox"]);
    }
}
