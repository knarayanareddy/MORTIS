//! PassphraseInterlock — gates all destructive operations.
//!
//! Supports primary and duress passphrases.
//! §3.3 C-3: "Passphrase entry must be interlock-gated"

use mortis_crypto::key_derivation;
use tracing::{info, warn};
use zeroize::ZeroizeOnDrop;

#[derive(Debug, thiserror::Error)]
pub enum PassphraseError {
    #[error("not initialized")]
    NotInitialized,
    #[error("key derivation: {0}")]
    Key(#[from] key_derivation::KeyError),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PassphraseResult {
    Primary,
    Duress,
    Failed,
}

#[derive(ZeroizeOnDrop)]
pub struct PassphraseInterlock {
    salt: Option<[u8; key_derivation::SALT_LEN]>,
    primary_hash: Option<[u8; key_derivation::KEY_LEN]>,
    duress_hash: Option<[u8; key_derivation::KEY_LEN]>,
}

impl PassphraseInterlock {
    pub fn new() -> Self {
        Self { salt: None, primary_hash: None, duress_hash: None }
    }

    pub fn is_initialized(&self) -> bool {
        self.salt.is_some() && self.primary_hash.is_some()
    }

    /// Initialize with a new passphrase. Returns salt for storage.
    pub fn initialize(&mut self, passphrase: &str) -> Result<[u8; key_derivation::SALT_LEN], PassphraseError> {
        let salt = key_derivation::generate_salt();
        let key = key_derivation::derive(passphrase, &salt)?;
        self.salt = Some(salt);
        self.primary_hash = Some(*key.as_bytes());
        info!("passphrase interlock initialized");
        Ok(salt)
    }

    /// Set duress passphrase.
    pub fn set_duress(&mut self, duress: &str) -> Result<(), PassphraseError> {
        let salt = self.salt.ok_or(PassphraseError::NotInitialized)?;
        let key = key_derivation::derive(duress, &salt)?;
        self.duress_hash = Some(*key.as_bytes());
        info!("duress passphrase configured");
        Ok(())
    }

    /// Load from persisted values.
    pub fn load(
        &mut self,
        salt: [u8; key_derivation::SALT_LEN],
        primary: [u8; key_derivation::KEY_LEN],
        duress: Option<[u8; key_derivation::KEY_LEN]>,
    ) {
        self.salt = Some(salt);
        self.primary_hash = Some(primary);
        self.duress_hash = duress;
    }

    /// Verify a passphrase. Constant-time for primary, then duress.
    pub fn verify(&self, passphrase: &str) -> Result<PassphraseResult, PassphraseError> {
        let salt = self.salt.ok_or(PassphraseError::NotInitialized)?;

        if let Some(primary) = &self.primary_hash {
            if key_derivation::verify(passphrase, &salt, primary)? {
                info!("primary passphrase verified");
                return Ok(PassphraseResult::Primary);
            }
        }

        if let Some(duress) = &self.duress_hash {
            if key_derivation::verify(passphrase, &salt, duress)? {
                warn!("duress passphrase verified — reduced plan");
                return Ok(PassphraseResult::Duress);
            }
        }

        Ok(PassphraseResult::Failed)
    }

    pub fn salt_bytes(&self) -> Option<[u8; key_derivation::SALT_LEN]> {
        self.salt
    }

    pub fn primary_hash_bytes(&self) -> Option<[u8; key_derivation::KEY_LEN]> {
        self.primary_hash
    }

    pub fn duress_hash_bytes(&self) -> Option<[u8; key_derivation::KEY_LEN]> {
        self.duress_hash
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn primary_passphrase() {
        let mut pi = PassphraseInterlock::new();
        pi.initialize("correct").unwrap();
        assert_eq!(pi.verify("correct").unwrap(), PassphraseResult::Primary);
    }

    #[test]
    fn wrong_passphrase() {
        let mut pi = PassphraseInterlock::new();
        pi.initialize("correct").unwrap();
        assert_eq!(pi.verify("wrong").unwrap(), PassphraseResult::Failed);
    }

    #[test]
    fn duress_passphrase() {
        let mut pi = PassphraseInterlock::new();
        pi.initialize("primary").unwrap();
        pi.set_duress("duress").unwrap();
        assert_eq!(pi.verify("duress").unwrap(), PassphraseResult::Duress);
    }

    #[test]
    fn not_initialized() {
        let pi = PassphraseInterlock::new();
        assert!(pi.verify("x").is_err());
    }

    #[test]
    fn load_and_verify() {
        let mut pi = PassphraseInterlock::new();
        let salt = pi.initialize("pass").unwrap();
        let primary = pi.primary_hash_bytes().unwrap();

        let mut pi2 = PassphraseInterlock::new();
        pi2.load(salt, primary, None);
        assert_eq!(pi2.verify("pass").unwrap(), PassphraseResult::Primary);
    }
}
