use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CredentialType {
    OauthToken,
    ApiKey,
    UsernamePassword,
    SessionCookie,
}

impl std::fmt::Display for CredentialType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::OauthToken => write!(f, "oauth_token"),
            Self::ApiKey => write!(f, "api_key"),
            Self::UsernamePassword => write!(f, "username_password"),
            Self::SessionCookie => write!(f, "session_cookie"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    pub id: Uuid,
    pub service_id: String,
    pub credential_type: CredentialType,
    pub encrypted_value: Vec<u8>,
    pub nonce: Vec<u8>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub rotated_at: Option<DateTime<Utc>>,
}
