//! §CANONICAL — §5.2 Plugin Trait Contracts

use async_trait::async_trait;
use mortis_types::asset::*;
use mortis_types::credential::Credential;
use thiserror::Error;

// ── Errors ────────────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum ConnectorError {
    #[error("discovery failed: {0}")]
    DiscoveryFailed(String),
    #[error("permission denied: {0}")]
    PermissionDenied(String),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
}

#[derive(Debug, Error)]
pub enum SanitizationError {
    #[error("method {method} not supported for {media}")]
    MethodNotSupported { method: SanitizationMethod, media: MediaType },
    #[error("permission denied: {0}")]
    PermissionDenied(String),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("timeout after {0}ms")]
    Timeout(u64),
    #[error("already sanitized: {0}")]
    AlreadySanitized(String),
}

#[derive(Debug, Error)]
pub enum DeletionError {
    #[error("service not supported: {0}")]
    ServiceNotSupported(String),
    #[error("credential error: {0}")]
    CredentialError(String),
    #[error("network: {0}")]
    Network(String),
    #[error("timeout after {0}ms")]
    Timeout(u64),
    #[error("service error: {0}")]
    ServiceError(String),
}

// ── Context ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct DiscoveryContext {
    pub search_paths: Vec<String>,
    pub asset_types: Vec<AssetType>,
    pub max_depth: usize,
}

#[derive(Debug, Clone)]
pub struct DeletionOptions {
    pub timeout_ms: u64,
}

#[derive(Debug, Clone)]
pub struct SanitizationResult {
    pub asset_id: uuid::Uuid,
    pub method_used: SanitizationMethod,
    pub bytes_processed: u64,
    pub success: bool,
    pub error: Option<String>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone)]
pub struct DeletionResult {
    pub service_id: String,
    pub success: bool,
    pub best_effort_only: bool,
    pub evidence: Option<String>,
    pub error: Option<String>,
    pub duration_ms: u64,
}

// ── Traits ────────────────────────────────────────────────────────────────────

/// Inventory Connector — discovers assets. Read-only.
pub trait InventoryConnector: Send + Sync {
    fn name(&self) -> &str;
    fn discover(&self, ctx: &DiscoveryContext) -> Result<Vec<Asset>, ConnectorError>;
    fn estimate_bytes(&self, assets: &[Asset]) -> u64;
}

/// Sanitization Plugin — §CANONICAL.
/// Must be idempotent. Must respect dry_run.
#[async_trait]
pub trait SanitizationPlugin: Send + Sync {
    fn name(&self) -> &str;
    fn supported_media_types(&self) -> &[MediaType];

    async fn sanitize(
        &self,
        asset: &Asset,
        method: &SanitizationMethod,
        dry_run: bool,
    ) -> Result<SanitizationResult, SanitizationError>;
}

/// Deletion Plugin — §CANONICAL.
/// Must respect dry_run. Must complete within timeout.
#[async_trait]
pub trait DeletionPlugin: Send + Sync {
    fn name(&self) -> &str;
    fn service_ids(&self) -> &[&str];

    async fn delete(
        &self,
        credential: &Credential,
        options: &DeletionOptions,
        dry_run: bool,
    ) -> Result<DeletionResult, DeletionError>;

    fn evidence(&self) -> Option<String> {
        None
    }
}
