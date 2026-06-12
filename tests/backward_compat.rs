//! §14.5: Backward Compatibility Tests
//!
//! Verify that receipts from prior MAJOR versions can still be parsed
//! and that schema evolution is handled correctly.

use mortis_types::receipt::*;

#[test]
fn parse_v1_0_0_receipt() {
    let json = include_str!("receipts/v1.0.0/valid_receipt.json");
    let receipt: Receipt = serde_json::from_str(json).expect("v1.0.0 receipt must parse");

    assert_eq!(receipt.header.schema_version, "1.0");
    assert_eq!(receipt.header.run_id.to_string(), "550e8400-e29b-41d4-a716-446655440000");
    assert!(!receipt.header.dry_run);
    assert_eq!(receipt.phases.len(), 1);
    assert_eq!(receipt.summary.overall_result, "success");
    assert!(receipt.signature.is_some());
}

#[test]
fn v1_0_0_receipt_with_unknown_fields_still_parses() {
    // §14.3: New fields may be added in MINOR versions; old verifiers ignore unknown fields
    let json = r#"{
        "header": {
            "run_id": "550e8400-e29b-41d4-a716-446655440000",
            "schema_version": "1.0",
            "triggered_by": "manual",
            "dry_run": false,
            "started_at": "2026-01-01T00:00:00Z",
            "future_field": "should be ignored"
        },
        "phases": [],
        "summary": {
            "overall_result": "success",
            "phases_total": 0,
            "phases_succeeded": 0,
            "phases_failed": 0,
            "bytes_processed": 0
        },
        "signature": null,
        "rfc3161_token": null,
        "new_top_level_field": 42
    }"#;

    let receipt: Receipt = serde_json::from_str(json).expect("must parse with unknown fields");
    assert_eq!(receipt.header.schema_version, "1.0");
}

#[test]
fn receipt_with_coercion_flag_parses() {
    let json = r#"{
        "header": {
            "run_id": "550e8400-e29b-41d4-a716-446655440000",
            "schema_version": "1.0",
            "triggered_by": "duress",
            "dry_run": false,
            "coercion": true,
            "started_at": "2026-01-01T00:00:00Z"
        },
        "phases": [],
        "summary": {
            "overall_result": "success",
            "phases_total": 0,
            "phases_succeeded": 0,
            "phases_failed": 0,
            "bytes_processed": 0
        },
        "signature": null,
        "rfc3161_token": null
    }"#;

    let receipt: Receipt = serde_json::from_str(json).unwrap();
    assert!(receipt.header.coercion);
}

#[test]
fn receipt_without_coercion_defaults_false() {
    let json = r#"{
        "header": {
            "run_id": "550e8400-e29b-41d4-a716-446655440000",
            "schema_version": "1.0",
            "triggered_by": "manual",
            "dry_run": false,
            "started_at": "2026-01-01T00:00:00Z"
        },
        "phases": [],
        "summary": {
            "overall_result": "success",
            "phases_total": 0,
            "phases_succeeded": 0,
            "phases_failed": 0,
            "bytes_processed": 0
        },
        "signature": null,
        "rfc3161_token": null
    }"#;

    let receipt: Receipt = serde_json::from_str(json).unwrap();
    assert!(!receipt.header.coercion);
}

#[test]
fn schema_version_is_stable() {
    assert_eq!(RECEIPT_SCHEMA_VERSION, "1.0");
}
