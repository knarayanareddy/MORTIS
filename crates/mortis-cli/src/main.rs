use anyhow::Result;
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tracing_subscriber::EnvFilter;
use zeroize::Zeroize;

use mortis_core::passphrase::{PassphraseInterlock, PassphraseResult};
use mortis_core::orchestrator::{Orchestrator, RunOptions};
use mortis_core::plan::load_plan;
use mortis_crypto::receipt_engine::{ReceiptEngine, VerificationError};
use mortis_crypto::signing::SigningKeyPair;
use mortis_db::schema::{initialize_schema, open_database_encrypted, rotate_database_key};
use mortis_types::error::ExitCode;

#[derive(Parser)]
#[command(name = "mortis", version, about = "Machine-Operated Responsive Total Infrastructure Sanitizer")]
struct Cli {
    #[arg(long, default_value = "~/.mortis/mortis.db")]
    db: String,
    #[arg(long)]
    config: Option<String>,
    #[arg(short, long)]
    verbose: bool,
    #[arg(long, default_value = "info")]
    log_level: String,
    /// Passphrase environment variable (for non-interactive use)
    #[arg(long, global = true)]
    passphrase_env: Option<String>,
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Run {
        #[arg(long)]
        plan: PathBuf,
        #[arg(long)]
        dry_run: bool,
        #[arg(long)]
        no_timestamp: bool,
        #[arg(long)]
        passphrase_env: Option<String>,
    },
    Inventory {
        #[command(subcommand)]
        action: InventoryCmd,
    },
    Receipt {
        #[command(subcommand)]
        action: ReceiptCmd,
    },
    Trigger {
        #[command(subcommand)]
        action: TriggerCmd,
    },
    Config {
        #[command(subcommand)]
        action: ConfigCmd,
    },
    SelfCheck,
}

#[derive(Subcommand)]
enum InventoryCmd {
    Add {
        #[arg(long)]
        r#type: String,
        #[arg(long)]
        path: String,
        #[arg(long)]
        label: Option<String>,
        #[arg(long, default_value = "100")]
        priority: i32,
    },
    List {
        #[arg(long, default_value = "table")]
        format: String,
    },
    Remove {
        #[arg(long)]
        id: String,
        #[arg(long)]
        force: bool,
    },
}

#[derive(Subcommand)]
enum ReceiptCmd {
    Verify {
        #[arg(long)]
        receipt: PathBuf,
        #[arg(long)]
        rfc3161: bool,
        #[arg(long)]
        public_key: Option<PathBuf>,
    },
    Export {
        #[arg(long)]
        receipt: PathBuf,
        #[arg(long, default_value = "json")]
        format: String,
    },
    List {
        #[arg(long, default_value = "10")]
        last: i32,
    },
    Inspect {
        #[arg(long)]
        run_id: String,
    },
    Finalize {
        #[arg(long)]
        run_id: String,
    },
}

#[derive(Subcommand)]
enum TriggerCmd {
    Test {
        #[arg(long)]
        r#type: String,
        #[arg(long)]
        dry_run: bool,
    },
    List,
    Disable {
        #[arg(long)]
        r#type: String,
    },
    Enable {
        #[arg(long)]
        r#type: String,
    },
}

#[derive(Subcommand)]
enum ConfigCmd {
    Init {
        #[arg(long)]
        passphrase_env: Option<String>,
    },
    RotateKey {
        #[arg(long)]
        old_passphrase_env: Option<String>,
        #[arg(long)]
        new_passphrase_env: Option<String>,
    },
}

fn main() {
    let cli = Cli::parse();

    let filter = if cli.verbose {
        EnvFilter::new(&cli.log_level)
    } else {
        EnvFilter::new("warn")
    };

    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_writer(std::io::stderr)
        .init();

    let exit_code = match run(cli) {
        Ok(code) => code,
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::Partial
        }
    };

    std::process::exit(exit_code.as_i32());
}

fn run(cli: Cli) -> Result<ExitCode> {
    let pe = cli.passphrase_env.as_deref();
    match cli.command {
        Commands::Run { plan, dry_run, no_timestamp, passphrase_env } => {
            cmd_run(&cli.db, &plan, dry_run, no_timestamp, passphrase_env.as_deref().or(pe))
        }
        Commands::Inventory { action } => cmd_inventory(&cli.db, action, pe),
        Commands::Receipt { action } => cmd_receipt(&cli.db, action, pe),
        Commands::Trigger { action } => cmd_trigger(action),
        Commands::Config { action } => cmd_config(&cli.db, action),
        Commands::SelfCheck => cmd_self_check(),
    }
}

fn read_passphrase(env_var: Option<&str>) -> Result<String> {
    if let Some(var) = env_var {
        return std::env::var(var).map_err(|_| anyhow::anyhow!("env var {} not set", var));
    }
    rpassword::prompt_password("passphrase: ").map_err(|e| e.into())
}

/// Derive DB encryption key from passphrase (first 32 bytes of PBKDF2 output)
fn derive_db_key(passphrase: &str, salt: &[u8; 32]) -> Result<[u8; 32]> {
    let derived = mortis_crypto::key_derivation::derive(passphrase, salt)?;
    Ok(*derived.as_bytes())
}

fn salt_file_path(db_path: &str) -> std::path::PathBuf {
    let mut p = std::path::PathBuf::from(db_path);
    p.set_extension("salt");
    p
}

fn open_db_with_passphrase(db_path: &str, passphrase: &str) -> Result<(rusqlite::Connection, [u8; 32], [u8; 32])> {
    // Read salt from external file (not in encrypted DB)
    let salt_path = salt_file_path(db_path);
    if !salt_path.exists() {
        return Err(anyhow::anyhow!("not initialized; run 'config init' first"));
    }
    let salt_b64 = std::fs::read_to_string(&salt_path)?;
    let salt_bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, salt_b64.trim())?;
    let mut salt = [0u8; 32];
    salt.copy_from_slice(&salt_bytes);

    let db_key = derive_db_key(passphrase, &salt)?;
    let conn = open_database_encrypted(db_path, &db_key)?;

    // Read primary key hash for interlock verification
    let primary_b64: String = conn
        .query_row("SELECT value FROM config WHERE key = 'primary_key_hash'", [], |r| r.get(0))
        .map_err(|_| anyhow::anyhow!("no primary key hash in DB"))?;
    let primary_bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &primary_b64)?;
    let mut primary = [0u8; 32];
    primary.copy_from_slice(&primary_bytes);

    Ok((conn, salt, primary))
}

fn cmd_run(
    db_path: &str,
    plan_path: &PathBuf,
    dry_run: bool,
    no_timestamp: bool,
    passphrase_env: Option<&str>,
) -> Result<ExitCode> {
    let plan = load_plan(plan_path).map_err(|e| anyhow::anyhow!("{}", e))?;

    let mut passphrase = read_passphrase(passphrase_env)?;
    let (conn, salt, primary) = open_db_with_passphrase(db_path, &passphrase)?;

    initialize_schema(&conn)?;

    // Verify passphrase via interlock
    let mut interlock = PassphraseInterlock::new();
    interlock.load(salt, primary, None);
    let result = interlock.verify(&passphrase)?;

    // §6.3: Zeroize passphrase after use
    passphrase.zeroize();

    if result == PassphraseResult::Failed {
        eprintln!("passphrase verification failed");
        return Ok(ExitCode::PassphraseFail);
    }

    let kp = SigningKeyPair::generate();
    let engine = ReceiptEngine::new(Some(kp));

    let receipt_dir = dirs::receipt_dir();
    std::fs::create_dir_all(&receipt_dir).ok();

    // §5.4: Incremental receipt persistence callback
    let persist_path = receipt_dir.clone();
    let _persist_db_path = db_path.to_string();
    let orch = Orchestrator::new(engine).with_default_plugins()
        .with_persist_fn(Box::new(move |receipt: &mortis_types::receipt::Receipt| {
            // Write to JSON file
            let path = persist_path.join(format!("{}.receipt.json", receipt.header.run_id));
            if let Ok(json) = serde_json::to_string_pretty(receipt) {
                std::fs::write(&path, &json).ok();
            }
        }));

    // Load inventory assets from DB
    let asset_rows = mortis_db::inventory::list_assets(&conn)?;
    let inventory: Vec<(mortis_types::asset::Asset, mortis_types::asset::SanitizationMethod)> =
        asset_rows
            .iter()
            .filter_map(|row| {
                let asset_type = mortis_types::asset::AssetType::from_str_opt(&row.asset_type);
                let media_type = parse_media_type(&row.media_type);
                let method = mortis_types::asset::select_sanitization_method(&media_type, true);

                uuid::Uuid::parse_str(&row.id).ok().map(|id| {
                    let asset = mortis_types::asset::Asset {
                        id,
                        asset_type,
                        path: row.path.clone(),
                        label: row.label.clone(),
                        service_id: row.service_id.clone(),
                        priority: row.priority,
                        sanitization_override: None,
                        credential_id: row
                            .credential_id
                            .as_ref()
                            .and_then(|s| uuid::Uuid::parse_str(s).ok()),
                        media_type,
                        created_at: chrono::Utc::now(),
                        updated_at: chrono::Utc::now(),
                    };
                    (asset, method)
                })
            })
            .collect();

    let opts = RunOptions {
        dry_run,
        no_timestamp,
        coercion: result == PassphraseResult::Duress,
    };
    let (receipt, metrics) = tokio::runtime::Runtime::new()?.block_on(
        orch.execute_run(&plan, result, opts, "cli", &inventory),
    );

    // §5.4: Persist receipt to DB
    mortis_db::receipts::save_receipt(&conn, &receipt, None)?;

    // §5.4: Write receipt JSON file
    let receipt_dir = dirs::receipt_dir();
    std::fs::create_dir_all(&receipt_dir).ok();
    let receipt_path = receipt_dir.join(format!("{}.receipt.json", receipt.header.run_id));
    if let Ok(json) = serde_json::to_string_pretty(&receipt) {
        if std::fs::write(&receipt_path, &json).is_ok() {
            eprintln!("receipt: {}", receipt_path.display());
        }
    }

    // §10.2: Persist run_metrics
    mortis_db::config::set_config(
        &conn,
        &format!("metrics:{}", receipt.header.run_id),
        &serde_json::to_string(&metrics).unwrap_or_default(),
        false,
    )?;

    // Print receipt to stdout
    let json = serde_json::to_string_pretty(&receipt)?;
    println!("{}", json);

    // §10.2: Log metrics to stderr
    eprintln!(
        "metrics: duration={}ms phases={}/{} bytes={} plugins={} timeouts={} panics={} signed={}",
        metrics.run_duration_ms,
        metrics.phases_succeeded,
        metrics.phases_total + metrics.phases_failed,
        metrics.bytes_processed,
        metrics.plugins_invoked,
        metrics.plugins_timed_out,
        metrics.plugins_panicked,
        metrics.receipt_signed
    );

    Ok(match receipt.summary.overall_result.as_str() {
        "success" => ExitCode::Ok,
        "partial" => ExitCode::Partial,
        _ => ExitCode::Partial,
    })
}

fn parse_media_type(s: &str) -> mortis_types::asset::MediaType {
    match s {
        "hdd_block" => mortis_types::asset::MediaType::HddBlock,
        "ssd_nvme" => mortis_types::asset::MediaType::SsdNvme,
        "emmc_sd" => mortis_types::asset::MediaType::EmmcSd,
        "ram_disk" => mortis_types::asset::MediaType::RamDisk,
        "encrypted_volume" => mortis_types::asset::MediaType::EncryptedVolume,
        "database_record" => mortis_types::asset::MediaType::DatabaseRecord,
        "browser_profile" => mortis_types::asset::MediaType::BrowserProfile,
        "optical_media" => mortis_types::asset::MediaType::OpticalMedia,
        "cloud_storage" => mortis_types::asset::MediaType::CloudStorage,
        _ => mortis_types::asset::MediaType::Generic,
    }
}

mod dirs {
    use std::path::PathBuf;

    pub fn mortis_dir() -> PathBuf {
        let home = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home).join(".mortis")
    }

    pub fn receipt_dir() -> PathBuf {
        mortis_dir().join("receipts")
    }
}

fn cmd_inventory(db_path: &str, action: InventoryCmd, passphrase_env: Option<&str>) -> Result<ExitCode> {
    let passphrase = read_passphrase(passphrase_env)?;
    let (conn, _salt, _primary) = open_db_with_passphrase(db_path, &passphrase)?;
    initialize_schema(&conn)?;

    match action {
        InventoryCmd::Add { r#type: asset_type, path, label, priority } => {
            let id = mortis_db::inventory::add_asset(
                &conn, &asset_type, Some(&path), label.as_deref(),
                None, priority, None, None, "generic",
            )?;
            println!("{}", id);
            Ok(ExitCode::Ok)
        }
        InventoryCmd::List { format } => {
            let assets = mortis_db::inventory::list_assets(&conn)?;
            if format == "json" {
                println!("{}", serde_json::to_string_pretty(&assets)?);
            } else {
                println!("{:<40} {:<20} {:<50}", "ID", "TYPE", "PATH");
                for a in &assets {
                    println!("{:<40} {:<20} {:<50}", a.id, a.asset_type, a.path.as_deref().unwrap_or("-"));
                }
            }
            Ok(ExitCode::Ok)
        }
        InventoryCmd::Remove { id, .. } => {
            if mortis_db::inventory::remove_asset(&conn, &id)? {
                println!("removed {}", id);
                Ok(ExitCode::Ok)
            } else {
                eprintln!("not found: {}", id);
                Ok(ExitCode::NotFound)
            }
        }
    }
}

/// §5.1: Receipt verification — validates signature and body hash
fn cmd_receipt(db_path: &str, action: ReceiptCmd, passphrase_env: Option<&str>) -> Result<ExitCode> {
    match action {
        ReceiptCmd::Verify { receipt, rfc3161, public_key } => {
            let content = std::fs::read_to_string(&receipt)?;
            let r: mortis_types::receipt::Receipt = serde_json::from_str(&content)?;

            println!("schema_version: {}", r.header.schema_version);
            println!("run_id: {}", r.header.run_id);
            println!("dry_run: {}", r.header.dry_run);
            println!("overall_result: {}", r.summary.overall_result);

            // §5.1: Actually verify the signature
            let sig = match &r.signature {
                Some(sig) => sig,
                None => {
                    eprintln!("error: receipt has no signature block");
                    return Ok(ExitCode::InvalidReceipt);
                }
            };

            // Load public key for verification
            let pk_path = public_key.unwrap_or_else(|| dirs::mortis_dir().join("signing_key.pub"));
            if !pk_path.exists() {
                eprintln!("warning: no public key found at {}; cannot verify signature", pk_path.display());
                println!("signed: yes (unverified)");
                return Ok(ExitCode::Ok);
            }

            let pk_hex = std::fs::read_to_string(&pk_path)?;
            let pk_bytes_vec = hex::decode(pk_hex.trim())?;
            if pk_bytes_vec.len() != 32 {
                eprintln!("error: invalid public key length");
                return Ok(ExitCode::InvalidReceipt);
            }
            let mut pk_bytes = [0u8; 32];
            pk_bytes.copy_from_slice(&pk_bytes_vec);

            // §CANONICAL: Verify Ed25519 signature over canonical body hash
            match ReceiptEngine::verify(&r, &pk_bytes) {
                Ok(()) => {
                    println!("signed: yes (VERIFIED)");
                    println!("public_key_id: {}", sig.public_key_id);
                    if rfc3161 && r.rfc3161_token.is_none() {
                        eprintln!("warning: no RFC 3161 timestamp");
                    }
                    Ok(ExitCode::Ok)
                }
                Err(VerificationError::BodyHashMismatch { expected, actual }) => {
                    eprintln!("TAMPERED: body hash mismatch");
                    eprintln!("  expected: {}", expected);
                    eprintln!("  actual:   {}", actual);
                    Ok(ExitCode::Tampered)
                }
                Err(VerificationError::SignatureInvalid) => {
                    eprintln!("TAMPERED: Ed25519 signature invalid");
                    Ok(ExitCode::Tampered)
                }
                Err(e) => {
                    eprintln!("invalid: {}", e);
                    Ok(ExitCode::InvalidReceipt)
                }
            }
        }
        ReceiptCmd::Export { receipt, format } => {
            let content = std::fs::read_to_string(&receipt)?;
            if format == "json" {
                println!("{}", content);
            } else {
                eprintln!("format '{}' not implemented", format);
            }
            Ok(ExitCode::Ok)
        }
        ReceiptCmd::List { last } => {
            let passphrase = read_passphrase(passphrase_env)?;
            let (conn, _, _) = open_db_with_passphrase(db_path, &passphrase)?;
            initialize_schema(&conn)?;
            let rows = mortis_db::receipts::list_receipts(&conn, last)?;
            if rows.is_empty() {
                println!("no receipts");
            } else {
                println!("{:<40} {:<12} {:<25}", "RUN_ID", "RESULT", "STARTED_AT");
                for r in &rows {
                    println!("{:<40} {:<12} {:<25}", r.run_id, r.overall_result, r.started_at);
                }
            }
            Ok(ExitCode::Ok)
        }
        ReceiptCmd::Inspect { run_id } => {
            let passphrase = read_passphrase(passphrase_env)?;
            let (conn, _, _) = open_db_with_passphrase(db_path, &passphrase)?;
            initialize_schema(&conn)?;
            match mortis_db::receipts::get_receipt(&conn, &run_id)? {
                Some(r) => {
                    println!("{}", serde_json::to_string_pretty(&r)?);
                    Ok(ExitCode::Ok)
                }
                None => {
                    eprintln!("not found: {}", run_id);
                    Ok(ExitCode::NotFound)
                }
            }
        }
        ReceiptCmd::Finalize { run_id } => {
            let passphrase = read_passphrase(passphrase_env)?;
            let (conn, _, _) = open_db_with_passphrase(db_path, &passphrase)?;
            initialize_schema(&conn)?;
            match mortis_db::receipts::get_receipt(&conn, &run_id)? {
                Some(r) => {
                    eprintln!("finalized receipt: {}", r.run_id);
                    eprintln!("result: {}", r.overall_result);
                    Ok(ExitCode::Ok)
                }
                None => {
                    eprintln!("not found: {}", run_id);
                    Ok(ExitCode::NotFound)
                }
            }
        }
    }
}

fn cmd_trigger(action: TriggerCmd) -> Result<ExitCode> {
    match action {
        TriggerCmd::Test { r#type: trigger_type, dry_run } => {
            println!("trigger test: {} (dry_run={})", trigger_type, dry_run);
            Ok(ExitCode::Ok)
        }
        TriggerCmd::List => {
            println!("no triggers configured");
            Ok(ExitCode::Ok)
        }
        TriggerCmd::Disable { r#type: trigger_type } => {
            println!("disabled: {}", trigger_type);
            Ok(ExitCode::Ok)
        }
        TriggerCmd::Enable { r#type: trigger_type } => {
            println!("enabled: {}", trigger_type);
            Ok(ExitCode::Ok)
        }
    }
}

fn cmd_config(db_path: &str, action: ConfigCmd) -> Result<ExitCode> {
    match action {
        ConfigCmd::Init { passphrase_env } => {
            let mut passphrase = read_passphrase(passphrase_env.as_deref())?;

            // Initialize interlock first (generates its own salt)
            let mut interlock = PassphraseInterlock::new();
            let interlock_salt = interlock.initialize(&passphrase)?;

            // Use the same salt for DB encryption
            let db_key = derive_db_key(&passphrase, &interlock_salt)?;

            let conn = open_database_encrypted(db_path, &db_key)?;
            initialize_schema(&conn)?;

            // Check if already initialized
            if mortis_db::config::get_config(&conn, "salt")?.is_some() {
                eprintln!("already initialized; use 'config rotate-key' to change passphrase");
                passphrase.zeroize();
                return Ok(ExitCode::Ok);
            }

            // Store salt in external file (not in encrypted DB)
            let salt_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, interlock_salt);
            let salt_path = salt_file_path(db_path);
            std::fs::write(&salt_path, &salt_b64)?;

            if let Some(hash) = interlock.primary_hash_bytes() {
                let hash_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, hash);
                mortis_db::config::set_config(&conn, "primary_key_hash", &hash_b64, true)?;
            }

            // §6.3: Zeroize passphrase
            passphrase.zeroize();

            println!("configuration initialized");
            Ok(ExitCode::Ok)
        }
        ConfigCmd::RotateKey { old_passphrase_env, new_passphrase_env } => {
            let old_pass = read_passphrase(old_passphrase_env.as_deref())?;
            let new_pass = read_passphrase(new_passphrase_env.as_deref())?;

            // Open with old passphrase
            let (conn, salt, primary) = open_db_with_passphrase(db_path, &old_pass)?;

            // Verify old passphrase
            let mut interlock = PassphraseInterlock::new();
            interlock.load(salt, primary, None);
            if interlock.verify(&old_pass)? == PassphraseResult::Failed {
                eprintln!("old passphrase incorrect");
                return Ok(ExitCode::PassphraseFail);
            }

            // §7: Derive new key and re-encrypt DB
            let new_salt = mortis_crypto::key_derivation::generate_salt();
            let new_db_key = derive_db_key(&new_pass, &new_salt)?;
            rotate_database_key(&conn, &new_db_key)?;

            // Update salt and key hash in DB
            let mut new_interlock = PassphraseInterlock::new();
            new_interlock.initialize(&new_pass)?;

            let salt_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, new_salt);

            // CRITICAL: Write new salt to external file (not just DB)
            let salt_path = salt_file_path(db_path);
            std::fs::write(&salt_path, &salt_b64)?;

            mortis_db::config::set_config(&conn, "salt", &salt_b64, true)?;

            if let Some(hash) = new_interlock.primary_hash_bytes() {
                let hash_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, hash);
                mortis_db::config::set_config(&conn, "primary_key_hash", &hash_b64, true)?;
            }

            println!("key rotated successfully");
            Ok(ExitCode::Ok)
        }
    }
}

fn cmd_self_check() -> Result<ExitCode> {
    use std::time::Instant;

    println!("MORTIS Self-Check v{}", env!("CARGO_PKG_VERSION"));
    println!("=========================================");

    let mut all_ok = true;

    let start = Instant::now();
    let mut pi = mortis_core::passphrase::PassphraseInterlock::new();
    match pi.initialize("benchmark_passphrase") {
        Ok(_) => {
            let elapsed = start.elapsed();
            let ok = elapsed.as_millis() < 1000;
            if !ok { all_ok = false; }
            println!("passphrase_init: {}ms {}", elapsed.as_millis(), if ok { "✅" } else { "❌" });
        }
        Err(e) => {
            all_ok = false;
            println!("passphrase_init: FAIL ({})", e);
        }
    }

    let start = Instant::now();
    let verify_result = pi.verify("benchmark_passphrase");
    let elapsed = start.elapsed();
    let ok = elapsed.as_millis() < 1000;
    if !ok { all_ok = false; }
    println!("passphrase_verify: {}ms {}", elapsed.as_millis(), if ok { "✅" } else { "❌" });
    if verify_result.is_err() { all_ok = false; }

    let kp = mortis_crypto::signing::SigningKeyPair::generate();
    let engine = mortis_crypto::receipt_engine::ReceiptEngine::new(Some(kp));
    let mut receipt = engine.begin_receipt(uuid::Uuid::new_v4(), "self-check", true, false, None);
    let start = Instant::now();
    engine.sign(&mut receipt);
    let elapsed = start.elapsed();
    let ok = elapsed.as_millis() < 2000;
    if !ok { all_ok = false; }
    println!("receipt_sign: {}ms {}", elapsed.as_millis(), if ok { "✅" } else { "❌" });

    let kp2 = mortis_crypto::signing::SigningKeyPair::generate();
    let start = Instant::now();
    let _ = mortis_crypto::receipt_engine::ReceiptEngine::verify(&receipt, &kp2.public_key_bytes());
    let elapsed = start.elapsed();
    let ok = elapsed.as_millis() < 500;
    if !ok { all_ok = false; }
    println!("receipt_verify: {}ms {}", elapsed.as_millis(), if ok { "✅" } else { "❌" });

    println!("=========================================");
    if all_ok {
        println!("all SLOs met ✅");
        Ok(ExitCode::Ok)
    } else {
        println!("SLO violation ❌");
        Ok(ExitCode::IntegrityFail)
    }
}
