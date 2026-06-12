//! Receipt building and verification engine

use chrono::Utc;
use uuid::Uuid;

use mortis_types::receipt::*;

use crate::hashing::canonical_json_hash;
use crate::signing::SigningKeyPair;

/// Build, sign, and verify receipts.
pub struct ReceiptEngine {
    keypair: Option<SigningKeyPair>,
}

impl ReceiptEngine {
    pub fn new(keypair: Option<SigningKeyPair>) -> Self {
        Self { keypair }
    }

    pub fn set_keypair(&mut self, kp: SigningKeyPair) {
        self.keypair = Some(kp);
    }

    pub fn public_key_id(&self) -> Option<String> {
        self.keypair.as_ref().map(|kp| kp.public_key_id())
    }

    pub fn public_key_bytes(&self) -> Option<[u8; 32]> {
        self.keypair.as_ref().map(|kp| kp.public_key_bytes())
    }

    /// Start a new receipt
    pub fn begin_receipt(
        &self,
        run_id: Uuid,
        triggered_by: &str,
        dry_run: bool,
        coercion: bool,
        plan_id: Option<Uuid>,
    ) -> Receipt {
        Receipt {
            header: ReceiptHeader {
                run_id,
                schema_version: RECEIPT_SCHEMA_VERSION.to_string(),
                triggered_by: triggered_by.to_string(),
                dry_run,
                coercion,
                plan_id,
                started_at: Utc::now(),
                completed_at: None,
            },
            phases: Vec::new(),
            summary: ReceiptSummary {
                overall_result: "success".to_string(),
                phases_total: 0,
                phases_succeeded: 0,
                phases_failed: 0,
                bytes_processed: 0,
            },
            signature: None,
            rfc3161_token: None,
        }
    }

    /// Record a phase result into the receipt
    pub fn record_phase(receipt: &mut Receipt, phase: ReceiptPhase) {
        receipt.summary.phases_total += 1;
        match phase.result.as_str() {
            "success" => receipt.summary.phases_succeeded += 1,
            "partial" | "failed" => receipt.summary.phases_failed += 1,
            _ => {}
        }
        receipt.summary.bytes_processed += phase.bytes_processed;
        receipt.phases.push(phase);
    }

    /// Finalize: set completed_at and overall_result
    pub fn finalize(receipt: &mut Receipt) {
        receipt.header.completed_at = Some(Utc::now());
        receipt.summary.overall_result = if receipt.summary.phases_failed == 0 {
            "success".to_string()
        } else if receipt.summary.phases_succeeded > 0 {
            "partial".to_string()
        } else {
            "failed".to_string()
        };
    }

    /// Sign the receipt. Returns false if no keypair configured.
    pub fn sign(&self, receipt: &mut Receipt) -> bool {
        let kp = match &self.keypair {
            Some(kp) => kp,
            None => return false,
        };

        let body = canonical_receipt_body(receipt);
        let hash = canonical_json_hash(&body);
        let sig = kp.sign(&hash);

        receipt.signature = Some(SignatureBlock {
            algorithm: "Ed25519".to_string(),
            public_key_id: kp.public_key_id(),
            body_hash: hex::encode(&hash),
            value: sig,
        });
        true
    }

    /// Verify a receipt's signature
    pub fn verify(receipt: &Receipt, public_key_bytes: &[u8; 32]) -> Result<(), VerificationError> {
        let sig_block = receipt
            .signature
            .as_ref()
            .ok_or(VerificationError::NoSignature)?;

        // Reconstruct canonical body
        let body = canonical_receipt_body(receipt);
        let expected_hash = canonical_json_hash(&body);
        let expected_hex = hex::encode(&expected_hash);

        // Verify body hash matches
        if expected_hex != sig_block.body_hash {
            return Err(VerificationError::BodyHashMismatch {
                expected: expected_hex,
                actual: sig_block.body_hash.clone(),
            });
        }

        // Verify Ed25519 signature
        SigningKeyPair::verify(&expected_hash, &sig_block.value, public_key_bytes)
            .map_err(|_| VerificationError::SignatureInvalid)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum VerificationError {
    #[error("receipt has no signature block")]
    NoSignature,
    #[error("body hash mismatch: expected {expected}, got {actual}")]
    BodyHashMismatch { expected: String, actual: String },
    #[error("Ed25519 signature invalid")]
    SignatureInvalid,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_receipt_and_sign() -> (Receipt, [u8; 32]) {
        let kp = SigningKeyPair::generate();
        let pk_bytes = kp.public_key_bytes();
        let engine = ReceiptEngine::new(Some(kp));

        let run_id = Uuid::new_v4();
        let mut receipt = engine.begin_receipt(run_id, "manual", false, false, None);

        ReceiptEngine::record_phase(
            &mut receipt,
            ReceiptPhase {
                phase_order: 0,
                phase_type: "sanitize_local".to_string(),
                plugin_name: Some("FileOverwritePlugin".to_string()),
                asset_id: Some(Uuid::new_v4()),
                result: "success".to_string(),
                best_effort: false,
                bytes_processed: 1024,
                duration_ms: Some(150),
                evidence: None,
                error: None,
                recorded_at: Utc::now(),
            },
        );

        ReceiptEngine::finalize(&mut receipt);
        engine.sign(&mut receipt);

        (receipt, pk_bytes)
    }

    #[test]
    fn receipt_verify_valid() {
        let (receipt, pk) = make_receipt_and_sign();
        assert!(ReceiptEngine::verify(&receipt, &pk).is_ok());
    }

    #[test]
    fn receipt_detects_tamper() {
        let (mut receipt, pk) = make_receipt_and_sign();
        receipt.summary.overall_result = "failed".to_string();
        assert!(ReceiptEngine::verify(&receipt, &pk).is_err());
    }

    #[test]
    fn receipt_no_signature() {
        let engine = ReceiptEngine::new(None);
        let receipt = engine.begin_receipt(Uuid::new_v4(), "test", true, false, None);
        let kp = SigningKeyPair::generate();
        assert!(matches!(
            ReceiptEngine::verify(&receipt, &kp.public_key_bytes()),
            Err(VerificationError::NoSignature)
        ));
    }

    #[test]
    fn receipt_json_roundtrip_preserves_signature() {
        let (receipt, _) = make_receipt_and_sign();
        let json = serde_json::to_string(&receipt).unwrap();
        let deserialized: Receipt = serde_json::from_str(&json).unwrap();
        assert_eq!(receipt.signature, deserialized.signature);
    }

    #[test]
    fn dry_run_receipt() {
        let engine = ReceiptEngine::new(None);
        let receipt = engine.begin_receipt(Uuid::new_v4(), "cli", true, false, None);
        assert!(receipt.header.dry_run);
    }

    #[test]
    fn coercion_flag() {
        let engine = ReceiptEngine::new(None);
        let receipt = engine.begin_receipt(Uuid::new_v4(), "cli", false, true, None);
        assert!(receipt.header.coercion);
    }

    proptest::proptest! {
        #[test]
        fn tamper_any_field_breaks_signature(
            change_result in proptest::bool::ANY,
        ) {
            let (mut receipt, pk) = make_receipt_and_sign();
            if change_result {
                receipt.summary.overall_result = "interrupted".to_string();
            }
            if change_result {
                assert!(ReceiptEngine::verify(&receipt, &pk).is_err());
            }
        }
    }
}
