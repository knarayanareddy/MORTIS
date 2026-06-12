//! E2E Tests — §11.1
//!
//! Full CLI + real DB + sandboxed tmpdir.

use std::fs;
use std::process::Command;

fn mortis_bin() -> String {
    std::env::var("CARGO_BIN_EXE_mortis").unwrap_or_else(|_| "target/debug/mortis".to_string())
}

fn setup_test_env() -> (tempfile::TempDir, String) {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    (dir, db_path.to_str().unwrap().to_string())
}

fn mortis_cmd(db_path: &str, args: &[&str], passphrase: &str) -> std::process::Output {
    Command::new(mortis_bin())
        .args(["--db", db_path, "--passphrase-env", "MORTIS_TEST_PASS"])
        .args(args)
        .env("MORTIS_TEST_PASS", passphrase)
        .output()
        .expect("failed to run mortis")
}

fn mortis_init(db_path: &str, passphrase: &str) {
    Command::new(mortis_bin())
        .args(["--db", db_path, "config", "init", "--passphrase-env", "MORTIS_TEST_PASS"])
        .env("MORTIS_TEST_PASS", passphrase)
        .output()
        .unwrap();
}

#[test]
fn self_check_passes() {
    let output = Command::new(mortis_bin()).args(["self-check"]).output().unwrap();
    assert!(output.status.success());
    assert!(String::from_utf8_lossy(&output.stdout).contains("MORTIS"));
}

#[test]
fn config_init_creates_db() {
    let (_dir, db_path) = setup_test_env();
    mortis_init(&db_path, "test_passphrase_123");
    assert!(fs::metadata(&db_path).is_ok());
    // Salt file should also exist (same name but .salt extension)
    let mut salt_path = std::path::PathBuf::from(&db_path);
    salt_path.set_extension("salt");
    assert!(fs::metadata(&salt_path).is_ok(), "salt file not found at {}", salt_path.display());
}

#[test]
fn inventory_add_and_list() {
    let (_dir, db_path) = setup_test_env();
    mortis_init(&db_path, "test");

    let output = mortis_cmd(&db_path, &["inventory", "add", "--type", "local_file", "--path", "/tmp/test.txt", "--label", "test file"], "test");
    assert!(output.status.success(), "add failed: {}", String::from_utf8_lossy(&output.stderr));
    let id = String::from_utf8_lossy(&output.stdout).trim().to_string();
    assert!(!id.is_empty());

    let output = mortis_cmd(&db_path, &["inventory", "list"], "test");
    assert!(output.status.success(), "list failed: {}", String::from_utf8_lossy(&output.stderr));
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("local_file"));
    assert!(stdout.contains("/tmp/test.txt"));

    let output = mortis_cmd(&db_path, &["inventory", "remove", "--id", &id, "--force"], "test");
    assert!(output.status.success());

    let output = mortis_cmd(&db_path, &["inventory", "list"], "test");
    assert!(!String::from_utf8_lossy(&output.stdout).contains("/tmp/test.txt"));
}

#[test]
fn inventory_remove_nonexistent_returns_exit_5() {
    let (_dir, db_path) = setup_test_env();
    mortis_init(&db_path, "test");

    let output = mortis_cmd(&db_path, &["inventory", "remove", "--id", "nonexistent-uuid", "--force"], "test");
    assert_eq!(output.status.code(), Some(5));
}

#[test]
fn dry_run_produces_no_side_effects() {
    let (dir, db_path) = setup_test_env();
    let test_file = dir.path().join("should_not_be_deleted.txt");
    fs::write(&test_file, "SENSITIVE DATA").unwrap();
    let plan_file = dir.path().join("test_plan.toml");
    fs::write(&plan_file, r#"
[plan]
name = "dry_run_test"

[[phases]]
phase_type = "sanitize_local"
asset_ids = ["00000000-0000-0000-0000-000000000001"]
continue_on_failure = true
"#).unwrap();

    mortis_init(&db_path, "test");

    let output = mortis_cmd(&db_path, &["run", "--plan", plan_file.to_str().unwrap(), "--dry-run"], "test");
    assert!(output.status.success(), "dry-run failed: {}", String::from_utf8_lossy(&output.stderr));
    assert!(test_file.exists(), "file must still exist after dry-run");
    assert_eq!(fs::read_to_string(&test_file).unwrap(), "SENSITIVE DATA");
}

#[test]
fn receipt_list_empty_ok() {
    let (_dir, db_path) = setup_test_env();
    mortis_init(&db_path, "test");

    let output = mortis_cmd(&db_path, &["receipt", "list"], "test");
    assert!(output.status.success(), "receipt list failed: {}", String::from_utf8_lossy(&output.stderr));
}

#[test]
fn receipt_inspect_nonexistent_returns_exit_5() {
    let (_dir, db_path) = setup_test_env();
    mortis_init(&db_path, "test");

    let output = mortis_cmd(&db_path, &["receipt", "inspect", "--run-id", "nonexistent"], "test");
    assert_eq!(output.status.code(), Some(5));
}

#[test]
fn trigger_list_ok() {
    let output = Command::new(mortis_bin()).args(["trigger", "list"]).output().unwrap();
    assert!(output.status.success());
}

#[test]
fn trigger_test_ok() {
    let output = Command::new(mortis_bin()).args(["trigger", "test", "--type", "manual", "--dry-run"]).output().unwrap();
    assert!(output.status.success());
}

#[test]
fn receipt_tamper_detection() {
    use mortis_crypto::receipt_engine::ReceiptEngine;
    use mortis_crypto::signing::SigningKeyPair;
    use mortis_types::receipt::*;
    use uuid::Uuid;
    use chrono::Utc;

    let kp = SigningKeyPair::generate();
    let pk = kp.public_key_bytes();
    let engine = ReceiptEngine::new(Some(kp));

    let mut receipt = engine.begin_receipt(Uuid::new_v4(), "test", false, false, None);
    ReceiptEngine::record_phase(&mut receipt, ReceiptPhase {
        phase_order: 0, phase_type: "sanitize_local".to_string(),
        plugin_name: Some("test".to_string()), asset_id: None,
        result: "success".to_string(), best_effort: false,
        bytes_processed: 100, duration_ms: Some(50),
        evidence: None, error: None, recorded_at: Utc::now(),
    });
    ReceiptEngine::finalize(&mut receipt);
    engine.sign(&mut receipt);

    assert!(ReceiptEngine::verify(&receipt, &pk).is_ok());

    let mut tampered = receipt.clone();
    tampered.summary.overall_result = "failed".to_string();
    assert!(ReceiptEngine::verify(&tampered, &pk).is_err());

    let mut tampered2 = receipt.clone();
    tampered2.phases[0].result = "failed".to_string();
    assert!(ReceiptEngine::verify(&tampered2, &pk).is_err());

    let mut tampered3 = receipt.clone();
    tampered3.summary.bytes_processed = 999;
    assert!(ReceiptEngine::verify(&tampered3, &pk).is_err());

    let mut tampered4 = receipt.clone();
    tampered4.signature = None;
    assert!(ReceiptEngine::verify(&tampered4, &pk).is_err());
}

#[test]
fn receipt_verify_nonexistent_file() {
    let output = Command::new(mortis_bin())
        .args(["receipt", "verify", "--receipt", "/nonexistent/path.json"])
        .output()
        .unwrap();
    assert!(!output.status.success());
}

#[test]
fn full_lifecycle() {
    let (dir, db_path) = setup_test_env();
    let test_file = dir.path().join("secret.txt");
    fs::write(&test_file, "TOP SECRET").unwrap();
    let plan_file = dir.path().join("plan.toml");

    mortis_init(&db_path, "test");

    let output = mortis_cmd(&db_path, &["inventory", "add", "--type", "local_file", "--path", test_file.to_str().unwrap()], "test");
    let asset_id = String::from_utf8_lossy(&output.stdout).trim().to_string();

    fs::write(&plan_file, format!(r#"
[plan]
name = "lifecycle_test"

[[phases]]
phase_type = "sanitize_local"
asset_ids = ["{}"]
continue_on_failure = true
"#, asset_id)).unwrap();

    // Dry-run first
    let output = mortis_cmd(&db_path, &["run", "--plan", plan_file.to_str().unwrap(), "--dry-run"], "test");
    assert!(output.status.success(), "dry-run failed: {}", String::from_utf8_lossy(&output.stderr));
    assert!(test_file.exists(), "dry-run must not delete file");

    // Live run
    let output = mortis_cmd(&db_path, &["run", "--plan", plan_file.to_str().unwrap()], "test");
    assert!(output.status.success(), "live run failed: {}", String::from_utf8_lossy(&output.stderr));
    assert!(!test_file.exists(), "file must be deleted after live run");

    // Verify receipt exists
    let output = mortis_cmd(&db_path, &["receipt", "list"], "test");
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(!stdout.trim().is_empty(), "receipt list should not be empty");
}
