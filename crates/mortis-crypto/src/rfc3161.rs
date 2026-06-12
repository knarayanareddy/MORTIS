//! RFC 3161 Timestamp Authority client
//!
//! §7 CANONICAL: TSA URL is user-configurable; default: FreeTSA.
//! §15: TSA timeout = 10 seconds.

use tracing::{info, warn};

pub const DEFAULT_TSA_URL: &str = "https://freetsa.org/tsr";
pub const TSA_TIMEOUT_SECS: u64 = 10;

#[derive(Debug, thiserror::Error)]
pub enum TsaError {
    #[error("network: {0}")]
    Network(String),
    #[error("invalid response: {0}")]
    InvalidResponse(String),
    #[error("timeout")]
    Timeout,
    #[error("not configured")]
    NotConfigured,
}

pub struct TsaClient {
    url: String,
}

impl TsaClient {
    pub fn new(url: Option<&str>) -> Self {
        Self {
            url: url.unwrap_or(DEFAULT_TSA_URL).to_string(),
        }
    }

    /// Request a timestamp token for the given hash.
    /// Returns base64-encoded token on success.
    ///
    /// §15: TSA failure → emit receipt without rfc3161_token; log warning.
    pub async fn timestamp(&self, sha256_hash: &[u8]) -> Result<String, TsaError> {
        info!(url = %self.url, hash_len = sha256_hash.len(), "requesting RFC 3161 timestamp");

        // Build RFC 3161 TimeStampReq
        let request = build_tsr_request(sha256_hash);

        // Execute with timeout (§15: 10s)
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(TSA_TIMEOUT_SECS))
            .build()
            .map_err(|e| TsaError::Network(e.to_string()))?;

        let response = client
            .post(&self.url)
            .header("Content-Type", "application/timestamp-query")
            .body(request)
            .send()
            .await;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    let body = resp.bytes().await.map_err(|e| TsaError::Network(e.to_string()))?;
                    let token = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &body);
                    info!(token_len = token.len(), "RFC 3161 timestamp obtained");
                    Ok(token)
                } else {
                    warn!(status = %resp.status(), "TSA returned error");
                    Err(TsaError::InvalidResponse(format!("HTTP {}", resp.status())))
                }
            }
            Err(e) => {
                if e.is_timeout() {
                    warn!("TSA request timed out");
                    Err(TsaError::Timeout)
                } else {
                    warn!(error = %e, "TSA request failed");
                    Err(TsaError::Network(e.to_string()))
                }
            }
        }
    }
}

/// Build a minimal RFC 3161 TimeStampReq (DER-encoded)
fn build_tsr_request(sha256_hash: &[u8]) -> Vec<u8> {
    // Minimal DER-encoded TimeStampReq
    // This is a simplified version; production would use a proper ASN.1 library
    let mut request = Vec::new();

    // SEQUENCE tag
    request.push(0x30);

    // Version = 1 (INTEGER)
    let version = [0x02, 0x01, 0x01];

    // MessageImprint: hash algorithm OID + hash value
    // SHA-256 OID: 2.16.840.1.101.3.4.2.1
    let hash_oid = [0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01];
    let mut hash_value = vec![0x04, sha256_hash.len() as u8];
    hash_value.extend_from_slice(sha256_hash);

    let mut message_imprint = Vec::new();
    message_imprint.push(0x30); // SEQUENCE
    message_imprint.push((hash_oid.len() + hash_value.len()) as u8);
    message_imprint.extend_from_slice(&hash_oid);
    message_imprint.extend_from_slice(&hash_value);

    // Total content length
    let content_len = version.len() + message_imprint.len();
    request.push(content_len as u8);
    request.extend_from_slice(&version);
    request.extend_from_slice(&message_imprint);

    request
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tsa_client_construction() {
        let client = TsaClient::new(None);
        assert_eq!(client.url, DEFAULT_TSA_URL);

        let client = TsaClient::new(Some("https://custom-tsa.example.com/tsr"));
        assert_eq!(client.url, "https://custom-tsa.example.com/tsr");
    }

    #[test]
    fn build_tsr_request_produces_der() {
        let hash = vec![0xAB; 32];
        let request = build_tsr_request(&hash);
        // Should start with SEQUENCE tag
        assert_eq!(request[0], 0x30);
        // Should be non-trivial
        assert!(request.len() > 10);
    }

    #[tokio::test]
    async fn tsa_timeout_on_unreachable() {
        let client = TsaClient::new(Some("https://192.0.2.1/tsr")); // RFC 5737 TEST-NET
        let hash = vec![0u8; 32];
        let result = client.timestamp(&hash).await;
        // Should fail (timeout or network error)
        assert!(result.is_err());
    }
}
