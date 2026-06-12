//! Ed25519 signing — §7 CANONICAL
//!
//! Crate: ed25519-dalek (audited)

use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;
use zeroize::ZeroizeOnDrop;
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

#[derive(Debug, thiserror::Error)]
pub enum SigningError {
    #[error("invalid key: {0}")]
    InvalidKey(String),
    #[error("signature verification failed")]
    VerificationFailed,
    #[error("base64 decode: {0}")]
    Base64(#[from] base64::DecodeError),
}

/// Ed25519 keypair. Secret key is zeroized on drop.
#[derive(ZeroizeOnDrop)]
pub struct SigningKeyPair {
    #[zeroize(skip)]
    public: VerifyingKey,
    secret: SigningKey,
}

impl SigningKeyPair {
    pub fn generate() -> Self {
        let secret = SigningKey::generate(&mut OsRng);
        let public = secret.verifying_key();
        Self { public, secret }
    }

    pub fn from_secret_bytes(bytes: &[u8; 32]) -> Result<Self, SigningError> {
        let secret = SigningKey::from_bytes(bytes);
        let public = secret.verifying_key();
        Ok(Self { public, secret })
    }

    /// Export secret key bytes for encrypted persistence.
    /// Caller must encrypt before storage.
    pub fn secret_key_bytes(&self) -> [u8; 32] {
        self.secret.to_bytes()
    }

    pub fn public_key_bytes(&self) -> [u8; 32] {
        self.public.to_bytes()
    }

    /// Public key ID: base64url first 8 bytes
    pub fn public_key_id(&self) -> String {
        URL_SAFE_NO_PAD.encode(&self.public.as_bytes()[..8])
    }

    /// Sign a message (typically SHA-256 hash bytes).
    /// Returns base64url-encoded signature.
    pub fn sign(&self, message: &[u8]) -> String {
        let sig = self.secret.sign(message);
        URL_SAFE_NO_PAD.encode(sig.to_bytes())
    }

    /// Verify a signature.
    pub fn verify(
        message: &[u8],
        signature_b64: &str,
        public_key_bytes: &[u8; 32],
    ) -> Result<(), SigningError> {
        let sig_bytes = URL_SAFE_NO_PAD.decode(signature_b64)?;
        let sig = Signature::from_slice(&sig_bytes)
            .map_err(|e| SigningError::InvalidKey(e.to_string()))?;
        let pk = VerifyingKey::from_bytes(public_key_bytes)
            .map_err(|e| SigningError::InvalidKey(e.to_string()))?;
        pk.verify(message, &sig).map_err(|_| SigningError::VerificationFailed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sign_and_verify() {
        let kp = SigningKeyPair::generate();
        let msg = b"mortis receipt body hash";
        let sig = kp.sign(msg);
        assert!(SigningKeyPair::verify(msg, &sig, &kp.public_key_bytes()).is_ok());
    }

    #[test]
    fn verify_wrong_message_fails() {
        let kp = SigningKeyPair::generate();
        let sig = kp.sign(b"original");
        assert!(SigningKeyPair::verify(b"tampered", &sig, &kp.public_key_bytes()).is_err());
    }

    #[test]
    fn verify_wrong_key_fails() {
        let kp1 = SigningKeyPair::generate();
        let kp2 = SigningKeyPair::generate();
        let sig = kp1.sign(b"msg");
        assert!(SigningKeyPair::verify(b"msg", &sig, &kp2.public_key_bytes()).is_err());
    }

    #[test]
    fn roundtrip_secret_bytes() {
        let kp1 = SigningKeyPair::generate();
        let bytes = kp1.secret_key_bytes();
        let kp2 = SigningKeyPair::from_secret_bytes(&bytes).unwrap();
        assert_eq!(kp1.public_key_bytes(), kp2.public_key_bytes());
    }

    #[test]
    fn public_key_id_is_deterministic() {
        let kp = SigningKeyPair::generate();
        assert_eq!(kp.public_key_id(), kp.public_key_id());
    }

    proptest::proptest! {
        #[test]
        fn arbitrary_message_sign_verify(msg in proptest::collection::vec(0u8..255, 0..1024)) {
            let kp = SigningKeyPair::generate();
            let sig = kp.sign(&msg);
            assert!(SigningKeyPair::verify(&msg, &sig, &kp.public_key_bytes()).is_ok());
        }
    }
}
