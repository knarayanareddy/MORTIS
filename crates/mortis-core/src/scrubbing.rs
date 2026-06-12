//! §10.1 Log Scrubbing Rules
//!
//! Passphrases, derived keys, private key bytes → NEVER logged
//! File contents → NEVER logged
//! Full file paths beyond depth 3 → truncated with [PATH_REDACTED]
//! Credential values → NEVER logged (log credential ID only)

/// Scrub a file path: keep only first 3 meaningful components
pub fn scrub_path(path: &str) -> String {
    let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();

    if parts.len() <= 3 {
        return path.to_string();
    }

    let prefix = parts.iter().take(3).cloned().collect::<Vec<_>>().join("/");
    format!("/{}/[PATH_REDACTED]", prefix)
}

/// Check if a log message contains sensitive keywords and should be redacted
pub fn is_sensitive_log(message: &str) -> bool {
    const SENSITIVE_KEYWORDS: &[&str] = &[
        "passphrase", "password", "secret_key", "private_key",
        "derived_key", "credential", "token", "api_key",
    ];

    let lower = message.to_lowercase();
    SENSITIVE_KEYWORDS.iter().any(|kw| lower.contains(kw))
}

/// Scrub a log message, replacing sensitive patterns
pub fn scrub_message(message: &str) -> String {
    if !is_sensitive_log(message) {
        return message.to_string();
    }

    // Redact anything that looks like a hex key (16+ hex chars in a row)
    let mut result = message.to_string();
    let hex_pattern = regex_lite::Regex::new(r"[0-9a-fA-F]{16,}").unwrap();
    result = hex_pattern.replace_all(&result, "[REDACTED_HEX]").to_string();

    // Redact base64 blobs (32+ chars of base64 alphabet)
    let b64_pattern = regex_lite::Regex::new(r"[A-Za-z0-9+/]{32,}={0,2}").unwrap();
    result = b64_pattern.replace_all(&result, "[REDACTED_B64]").to_string();

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scrub_short_path_unchanged() {
        assert_eq!(scrub_path("/home/user/file.txt"), "/home/user/file.txt");
    }

    #[test]
    fn scrub_long_path_redacted() {
        assert_eq!(
            scrub_path("/home/user/.mortis/deep/nested/secret.key"),
            "/home/user/.mortis/[PATH_REDACTED]"
        );
    }

    #[test]
    fn sensitive_detection() {
        assert!(is_sensitive_log("passphrase verification failed"));
        assert!(is_sensitive_log("private_key loaded"));
        assert!(!is_sensitive_log("phase completed successfully"));
    }

    #[test]
    fn scrub_hex_key() {
        let msg = "passphrase verification: abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
        let scrubbed = scrub_message(msg);
        assert!(scrubbed.contains("[REDACTED_HEX]"), "scrubbed: {}", scrubbed);
        assert!(!scrubbed.contains("abcdef"), "should not contain original hex: {}", scrubbed);
    }

    #[test]
    fn scrub_b64_token() {
        let msg = "token: VGhpcyBpcyBhIHZlcnkgbG9uZyBiYXNlNjQgZW5jb2RlZCBzdHJpbmcgdGhhdCBzaG91bGQgYmUgcmVkYWN0ZWQ=";
        let scrubbed = scrub_message(msg);
        assert!(scrubbed.contains("[REDACTED_B64]"));
    }

    #[test]
    fn non_sensitive_unchanged() {
        let msg = "phase 0 completed in 150ms";
        assert_eq!(scrub_message(msg), msg);
    }
}
