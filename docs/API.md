# API Reference

Complete reference for all MORTIS types, traits, and functions.

## Core Types

### Asset

```rust
pub struct Asset {
    pub id: Uuid,
    pub asset_type: AssetType,
    pub path: Option<String>,
    pub label: Option<String>,
    pub service_id: Option<String>,
    pub priority: i32,
    pub sanitization_override: Option<SanitizationMethod>,
    pub credential_id: Option<Uuid>,
    pub media_type: MediaType,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### AssetType

```rust
pub enum AssetType {
    LocalFile,
    LocalDir,
    DbRecord,
    BrowserProfile,
    CloudAccount,
    Custom(String),
}
```

### MediaType

```rust
pub enum MediaType {
    HddBlock,       // Magnetic hard disk
    SsdNvme,        // SSD or NVMe
    EmmcSd,         // eMMC or SD card
    RamDisk,        // RAM disk / tmpfs
    EncryptedVolume,// Pre-encrypted volume
    DatabaseRecord, // Database records
    BrowserProfile, // Browser profile / cache
    OpticalMedia,   // Optical media (out of scope)
    CloudStorage,   // Cloud storage (remote)
    Generic,        // Unknown
}
```

### SanitizationMethod

```rust
pub enum SanitizationMethod {
    OverwriteRandom,              // 1-pass random data
    OverwriteZeros,               // 1-pass zeros
    CryptographicErase,           // Discard encryption key
    DatabaseWipe,                 // Overwrite + VACUUM
    BrowserCleanup,               // Delete + overwrite free space
    CloudDeletion,                // API call (best-effort)
    PhysicalDestructionRequired,  // Document only
}
```

### Plan

```rust
pub struct Plan {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_default: bool,
    pub phases: Vec<PlanPhase>,
    pub created_at: DateTime<Utc>,
}
```

### PlanPhase

```rust
pub struct PlanPhase {
    pub id: Uuid,
    pub phase_order: i32,
    pub phase_type: PhaseType,
    pub asset_ids: Vec<Uuid>,
    pub continue_on_failure: bool,
}
```

### Receipt

```rust
pub struct Receipt {
    pub header: ReceiptHeader,
    pub phases: Vec<ReceiptPhase>,
    pub summary: ReceiptSummary,
    pub signature: Option<SignatureBlock>,
    pub rfc3161_token: Option<String>,
}
```

### RunMetrics

```rust
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
```

## Plugin Traits

### SanitizationPlugin

```rust
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
```

**Contract:**
- Must be idempotent (calling twice on sanitized asset must not error)
- Must respect `dry_run` (no mutations if true)
- Must not access InventoryDB or ReceiptEngine
- Must not call `std::process::exit`
- Panics are caught by orchestrator

### DeletionPlugin

```rust
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

    fn evidence(&self) -> Option<String> { None }
}
```

**Contract:**
- Must respect `dry_run`
- Must complete within `options.timeout_ms`
- Best-effort only (remote deletion cannot be guaranteed)

### InventoryConnector

```rust
pub trait InventoryConnector: Send + Sync {
    fn name(&self) -> &str;
    fn discover(&self, ctx: &DiscoveryContext) -> Result<Vec<Asset>, ConnectorError>;
    fn estimate_bytes(&self, assets: &[Asset]) -> u64;
}
```

**Contract:**
- Must be read-only (no filesystem or DB mutations)

## Orchestrator

```rust
impl Orchestrator {
    pub fn new(receipt_engine: ReceiptEngine) -> Self;
    pub fn with_default_plugins(self) -> Self;
    pub fn with_persist_fn(self, f: ReceiptPersistFn) -> Self;
    pub fn add_sanitization_plugin(&mut self, p: Box<dyn SanitizationPlugin>);
    pub fn add_deletion_plugin(&mut self, p: Box<dyn DeletionPlugin>);

    pub async fn execute_run(
        &self,
        plan: &Plan,
        passphrase_result: PassphraseResult,
        options: RunOptions,
        triggered_by: &str,
        inventory: &[(Asset, SanitizationMethod)],
    ) -> (Receipt, RunMetrics);
}
```

## ReceiptEngine

```rust
impl ReceiptEngine {
    pub fn new(keypair: Option<SigningKeyPair>) -> Self;
    pub fn set_keypair(&mut self, kp: SigningKeyPair);
    pub fn public_key_id(&self) -> Option<String>;
    pub fn public_key_bytes(&self) -> Option<[u8; 32]>;

    pub fn begin_receipt(&self, ...) -> Receipt;
    pub fn record_phase(receipt: &mut Receipt, phase: ReceiptPhase);
    pub fn finalize(receipt: &mut Receipt);
    pub fn sign(&self, receipt: &mut Receipt) -> bool;
    pub fn verify(receipt: &Receipt, public_key_bytes: &[u8; 32]) -> Result<(), VerificationError>;
}
```

## PassphraseInterlock

```rust
impl PassphraseInterlock {
    pub fn new() -> Self;
    pub fn is_initialized(&self) -> bool;
    pub fn initialize(&mut self, passphrase: &str) -> Result<[u8; 32], PassphraseError>;
    pub fn set_duress(&mut self, duress: &str) -> Result<(), PassphraseError>;
    pub fn load(&mut self, salt: [u8; 32], primary: [u8; 32], duress: Option<[u8; 32]>);
    pub fn verify(&self, passphrase: &str) -> Result<PassphraseResult, PassphraseError>;
}
```

## Crypto Functions

### Key Derivation

```rust
pub fn generate_salt() -> [u8; 32];
pub fn derive(passphrase: &str, salt: &[u8]) -> Result<DerivedKey, KeyError>;
pub fn verify(passphrase: &str, salt: &[u8], expected: &[u8; 32]) -> Result<bool, KeyError>;
```

### Hashing

```rust
pub fn sha256_hex(data: &[u8]) -> String;
pub fn sha256_bytes(data: &[u8]) -> Vec<u8>;
pub fn canonical_json_hash(value: &serde_json::Value) -> Vec<u8>;
```

### Signing

```rust
impl SigningKeyPair {
    pub fn generate() -> Self;
    pub fn from_secret_bytes(bytes: &[u8; 32]) -> Result<Self, SigningError>;
    pub fn secret_key_bytes(&self) -> [u8; 32];
    pub fn public_key_bytes(&self) -> [u8; 32];
    pub fn public_key_id(&self) -> String;
    pub fn sign(&self, message: &[u8]) -> String;
    pub fn verify(message: &[u8], signature_b64: &str, public_key_bytes: &[u8; 32]) -> Result<(), SigningError>;
}
```

### AEAD Encryption

```rust
pub fn encrypt(key: &[u8; 32], plaintext: &[u8]) -> Result<Vec<u8>, AeadError>;
pub fn decrypt(key: &[u8; 32], data: &[u8]) -> Result<Vec<u8>, AeadError>;
```

## Database Functions

```rust
pub fn open_database_encrypted(path: &str, passphrase_bytes: &[u8]) -> Result<Connection>;
pub fn rotate_database_key(conn: &Connection, new_passphrase_bytes: &[u8]) -> Result<()>;
pub fn initialize_schema(conn: &Connection) -> Result<()>;

// Inventory
pub fn add_asset(conn: &Connection, ...) -> Result<String>;
pub fn list_assets(conn: &Connection) -> Result<Vec<AssetRow>>;
pub fn get_asset(conn: &Connection, id: &str) -> Result<Option<AssetRow>>;
pub fn remove_asset(conn: &Connection, id: &str) -> Result<bool>;

// Receipts
pub fn save_receipt(conn: &Connection, receipt: &Receipt, json_path: Option<&str>) -> Result<()>;
pub fn get_receipt(conn: &Connection, run_id: &str) -> Result<Option<ReceiptRow>>;
pub fn list_receipts(conn: &Connection, limit: i32) -> Result<Vec<ReceiptRow>>;

// Config
pub fn get_config(conn: &Connection, key: &str) -> Result<Option<String>>;
pub fn set_config(conn: &Connection, key: &str, value: &str, sensitive: bool) -> Result<()>;
pub fn delete_config(conn: &Connection, key: &str) -> Result<bool>;
```

## Error Types

### MortisError

```rust
pub enum MortisError {
    PassphraseFail,
    PlanLoadFail(String),
    DbError(String),
    NotFound(String),
    InvalidReceipt(String),
    Tampered(String),
    TriggerError(String),
    IntegrityFail(String),
    PluginError(String),
    Io(std::io::Error),
    Crypto(String),
    Other(String),
}
```

### ExitCode

```rust
pub enum ExitCode {
    Ok = 0,              // Full success
    Partial = 1,         // Partial success with receipt
    PassphraseFail = 2,  // Passphrase verification failed
    PlanLoadFail = 3,    // Plan load failed
    DbError = 4,         // Database error
    NotFound = 5,        // Resource not found
    InvalidReceipt = 6,  // Invalid receipt
    Tampered = 7,        // Receipt tampered
    TriggerWouldNotFire = 8,
    IntegrityFail = 9,   // Integrity check failed
}
```

## Sanitization Result

```rust
pub struct SanitizationResult {
    pub asset_id: Uuid,
    pub method_used: SanitizationMethod,
    pub bytes_processed: u64,
    pub success: bool,
    pub error: Option<String>,
    pub duration_ms: u64,
}
```

## Deletion Result

```rust
pub struct DeletionResult {
    pub service_id: String,
    pub success: bool,
    pub best_effort_only: bool,
    pub evidence: Option<String>,
    pub error: Option<String>,
    pub duration_ms: u64,
}
```
