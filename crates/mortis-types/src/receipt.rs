//! §CANONICAL — Appendix B: Receipt Schema
//!
//! This is the authoritative receipt type. All receipt serialization
//! and deserialization must conform to this schema.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const RECEIPT_SCHEMA_VERSION: &str = "1.0";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Receipt {
    pub header: ReceiptHeader,
    pub phases: Vec<ReceiptPhase>,
    pub summary: ReceiptSummary,
    pub signature: Option<SignatureBlock>,
    pub rfc3161_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReceiptHeader {
    pub run_id: Uuid,
    pub schema_version: String,
    pub triggered_by: String,
    pub dry_run: bool,
    #[serde(default)]
    pub coercion: bool,
    pub plan_id: Option<Uuid>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReceiptPhase {
    pub phase_order: i32,
    pub phase_type: String,
    pub plugin_name: Option<String>,
    pub asset_id: Option<Uuid>,
    pub result: String,
    #[serde(default)]
    pub best_effort: bool,
    #[serde(default)]
    pub bytes_processed: u64,
    pub duration_ms: Option<u64>,
    pub evidence: Option<String>,
    pub error: Option<String>,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReceiptSummary {
    pub overall_result: String,
    pub phases_total: i32,
    pub phases_succeeded: i32,
    pub phases_failed: i32,
    pub bytes_processed: u64,
}

/// §CANONICAL signature block
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SignatureBlock {
    pub algorithm: String,
    pub public_key_id: String,
    /// hex-encoded SHA-256 of canonical receipt body
    pub body_hash: String,
    /// base64url-encoded Ed25519 signature over body_hash bytes
    pub value: String,
}

/// Build the canonical JSON body for signing.
/// §CANONICAL: sorted keys, no whitespace.
pub fn canonical_receipt_body(receipt: &Receipt) -> serde_json::Value {
    serde_json::json!({
        "header": receipt.header,
        "phases": receipt.phases,
        "summary": receipt.summary,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_receipt_serialization_roundtrip() {
        let receipt = Receipt {
            header: ReceiptHeader {
                run_id: Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap(),
                schema_version: RECEIPT_SCHEMA_VERSION.to_string(),
                triggered_by: "manual".to_string(),
                dry_run: false,
                coercion: false,
                plan_id: None,
                started_at: Utc::now(),
                completed_at: None,
            },
            phases: vec![],
            summary: ReceiptSummary {
                overall_result: "success".to_string(),
                phases_total: 0,
                phases_succeeded: 0,
                phases_failed: 0,
                bytes_processed: 0,
            },
            signature: None,
            rfc3161_token: None,
        };

        let json = serde_json::to_string(&receipt).unwrap();
        let deserialized: Receipt = serde_json::from_str(&json).unwrap();
        assert_eq!(receipt, deserialized);
    }

    #[test]
    fn test_schema_version_constant() {
        assert_eq!(RECEIPT_SCHEMA_VERSION, "1.0");
    }
}
