//! SHA-256 hashing — §7 CANONICAL
//!
//! Crate: ring (audited)

use ring::digest::{Context, SHA256};

/// SHA-256 hash as hex string
pub fn sha256_hex(data: &[u8]) -> String {
    hex::encode(sha256_bytes(data))
}

/// SHA-256 hash as raw bytes
pub fn sha256_bytes(data: &[u8]) -> Vec<u8> {
    let mut ctx = Context::new(&SHA256);
    ctx.update(data);
    ctx.finish().as_ref().to_vec()
}

/// Canonical JSON hash: sorted keys, no whitespace.
/// Returns raw SHA-256 bytes.
pub fn canonical_json_hash(value: &serde_json::Value) -> Vec<u8> {
    sha256_bytes(canonical_json(value).as_bytes())
}

fn canonical_json(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Object(map) => {
            let mut pairs: Vec<_> = map.iter().collect();
            pairs.sort_by_key(|(k, _)| (*k).clone());
            let inner: Vec<String> = pairs
                .iter()
                .map(|(k, v)| format!("{}:{}", json_str(k), canonical_json(v)))
                .collect();
            format!("{{{}}}", inner.join(","))
        }
        serde_json::Value::Array(arr) => {
            let items: Vec<String> = arr.iter().map(canonical_json).collect();
            format!("[{}]", items.join(","))
        }
        serde_json::Value::String(s) => json_str(s),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => if *b { "true" } else { "false" }.to_string(),
        serde_json::Value::Null => "null".to_string(),
    }
}

fn json_str(s: &str) -> String {
    serde_json::to_string(s).unwrap_or_else(|_| format!("\"{}\"", s))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn sha256_hex_length() {
        assert_eq!(sha256_hex(b"hello").len(), 64);
    }

    #[test]
    fn canonical_json_key_order_independent() {
        let a = json!({"b": 2, "a": 1});
        let b = json!({"a": 1, "b": 2});
        assert_eq!(canonical_json_hash(&a), canonical_json_hash(&b));
    }

    #[test]
    fn canonical_json_deterministic() {
        let v = json!({"z": true, "a": [3, 1, 2], "m": {"y": null}});
        let h1 = canonical_json_hash(&v);
        let h2 = canonical_json_hash(&v);
        assert_eq!(h1, h2);
    }

    proptest::proptest! {
        #[test]
        fn canonical_json_never_panics(s in ".*{0,200}") {
            let v = serde_json::Value::String(s);
            let _ = canonical_json_hash(&v);
        }
    }
}
