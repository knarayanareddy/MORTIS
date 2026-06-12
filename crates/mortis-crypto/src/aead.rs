//! AES-256-GCM authenticated encryption — §7 CANONICAL
//!
//! Used for credential encryption at the application layer.
//! Crate: aes-gcm (RustCrypto, audited)

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use rand::RngCore;

pub const NONCE_LEN: usize = 12;

#[derive(Debug, thiserror::Error)]
pub enum AeadError {
    #[error("encryption failed")]
    EncryptFailed,
    #[error("decryption failed (bad key or tampered ciphertext)")]
    DecryptFailed,
    #[error("invalid key length")]
    InvalidKeyLength,
}

/// Encrypt plaintext with AES-256-GCM.
/// Returns nonce || ciphertext (ciphertext includes 16-byte auth tag).
pub fn encrypt(key: &[u8; 32], plaintext: &[u8]) -> Result<Vec<u8>, AeadError> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| AeadError::InvalidKeyLength)?;
    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| AeadError::EncryptFailed)?;
    let mut output = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    Ok(output)
}

/// Decrypt nonce || ciphertext with AES-256-GCM.
pub fn decrypt(key: &[u8; 32], data: &[u8]) -> Result<Vec<u8>, AeadError> {
    if data.len() < NONCE_LEN {
        return Err(AeadError::DecryptFailed);
    }
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| AeadError::InvalidKeyLength)?;
    let (nonce_bytes, ciphertext) = data.split_at(NONCE_LEN);
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| AeadError::DecryptFailed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        let key = [42u8; 32];
        let pt = b"sensitive credential data";
        let ct = encrypt(&key, pt).unwrap();
        let recovered = decrypt(&key, &ct).unwrap();
        assert_eq!(pt.as_slice(), recovered.as_slice());
    }

    #[test]
    fn wrong_key_fails() {
        let key1 = [1u8; 32];
        let key2 = [2u8; 32];
        let ct = encrypt(&key1, b"secret").unwrap();
        assert!(decrypt(&key2, &ct).is_err());
    }

    #[test]
    fn tampered_ciphertext_fails() {
        let key = [0u8; 32];
        let mut ct = encrypt(&key, b"secret").unwrap();
        let last = ct.len() - 1;
        ct[last] ^= 0xff;
        assert!(decrypt(&key, &ct).is_err());
    }

    #[test]
    fn empty_plaintext() {
        let key = [0u8; 32];
        let ct = encrypt(&key, b"").unwrap();
        let pt = decrypt(&key, &ct).unwrap();
        assert!(pt.is_empty());
    }

    proptest::proptest! {
        #[test]
        fn roundtrip_arbitrary(data in proptest::collection::vec(0u8..255, 0..4096)) {
            let key = [99u8; 32];
            let ct = encrypt(&key, &data).unwrap();
            let pt = decrypt(&key, &ct).unwrap();
            assert_eq!(data, pt);
        }
    }
}
