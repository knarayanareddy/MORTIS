//! PBKDF2-HMAC-SHA512 key derivation — §7 CANONICAL
//!
//! 100,000 iterations. 32-byte random salt.
//! Crate: ring (audited)

use rand::rngs::OsRng;
use rand::RngCore;
use ring::pbkdf2;
use zeroize::ZeroizeOnDrop;
use std::num::NonZeroU32;

pub const PBKDF2_ITERATIONS: u32 = 100_000;
pub const SALT_LEN: usize = 32;
pub const KEY_LEN: usize = 32; // AES-256

#[derive(Debug, thiserror::Error)]
pub enum KeyError {
    #[error("invalid salt length: expected {expected}, got {actual}")]
    InvalidSalt { expected: usize, actual: usize },
}

/// Derived key — zeroized on drop.
#[derive(ZeroizeOnDrop)]
pub struct DerivedKey {
    bytes: [u8; KEY_LEN],
}

impl DerivedKey {
    pub fn as_bytes(&self) -> &[u8; KEY_LEN] {
        &self.bytes
    }
}

pub fn generate_salt() -> [u8; SALT_LEN] {
    let mut salt = [0u8; SALT_LEN];
    OsRng.fill_bytes(&mut salt);
    salt
}

pub fn derive(passphrase: &str, salt: &[u8]) -> Result<DerivedKey, KeyError> {
    if salt.len() != SALT_LEN {
        return Err(KeyError::InvalidSalt {
            expected: SALT_LEN,
            actual: salt.len(),
        });
    }
    let mut key = [0u8; KEY_LEN];
    pbkdf2::derive(
        pbkdf2::PBKDF2_HMAC_SHA512,
        NonZeroU32::new(PBKDF2_ITERATIONS).unwrap(),
        salt,
        passphrase.as_bytes(),
        &mut key,
    );
    Ok(DerivedKey { bytes: key })
}

pub fn verify(passphrase: &str, salt: &[u8], expected: &[u8; KEY_LEN]) -> Result<bool, KeyError> {
    let derived = derive(passphrase, salt)?;
    // Constant-time comparison using subtle crate (transitive dep)
    use subtle::ConstantTimeEq;
    Ok(derived.as_bytes().ct_eq(expected).into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic() {
        let salt = generate_salt();
        let k1 = derive("pass", &salt).unwrap();
        let k2 = derive("pass", &salt).unwrap();
        assert_eq!(k1.as_bytes(), k2.as_bytes());
    }

    #[test]
    fn different_passphrases_differ() {
        let salt = generate_salt();
        let k1 = derive("a", &salt).unwrap();
        let k2 = derive("b", &salt).unwrap();
        assert_ne!(k1.as_bytes(), k2.as_bytes());
    }

    #[test]
    fn different_salts_differ() {
        let k1 = derive("p", &generate_salt()).unwrap();
        let k2 = derive("p", &generate_salt()).unwrap();
        assert_ne!(k1.as_bytes(), k2.as_bytes());
    }

    #[test]
    fn verify_correct() {
        let salt = generate_salt();
        let k = derive("secret", &salt).unwrap();
        assert!(verify("secret", &salt, k.as_bytes()).unwrap());
    }

    #[test]
    fn verify_wrong() {
        let salt = generate_salt();
        let k = derive("secret", &salt).unwrap();
        assert!(!verify("wrong", &salt, k.as_bytes()).unwrap());
    }

    #[test]
    fn invalid_salt_length() {
        assert!(derive("p", &[0u8; 16]).is_err());
    }

    #[test]
    fn key_length() {
        let k = derive("x", &generate_salt()).unwrap();
        assert_eq!(k.as_bytes().len(), KEY_LEN);
    }
}
