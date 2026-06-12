use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PhaseType {
    RevokeRemote,
    SanitizeLocal,
    ClearBrowser,
    WipeDb,
    SelfDestruct,
}

impl fmt::Display for PhaseType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::RevokeRemote => write!(f, "revoke_remote"),
            Self::SanitizeLocal => write!(f, "sanitize_local"),
            Self::ClearBrowser => write!(f, "clear_browser"),
            Self::WipeDb => write!(f, "wipe_db"),
            Self::SelfDestruct => write!(f, "self_destruct"),
        }
    }
}

impl PhaseType {
    pub fn from_str_opt(s: &str) -> Option<Self> {
        match s {
            "revoke_remote" => Some(Self::RevokeRemote),
            "sanitize_local" => Some(Self::SanitizeLocal),
            "clear_browser" => Some(Self::ClearBrowser),
            "wipe_db" => Some(Self::WipeDb),
            "self_destruct" => Some(Self::SelfDestruct),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanPhase {
    pub id: Uuid,
    pub phase_order: i32,
    pub phase_type: PhaseType,
    pub asset_ids: Vec<Uuid>,
    pub continue_on_failure: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plan {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_default: bool,
    pub phases: Vec<PlanPhase>,
    pub created_at: DateTime<Utc>,
}

/// Run result per phase
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PhaseResultStatus {
    Success,
    Partial,
    Failed,
    Skipped,
}

impl fmt::Display for PhaseResultStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Success => write!(f, "success"),
            Self::Partial => write!(f, "partial"),
            Self::Failed => write!(f, "failed"),
            Self::Skipped => write!(f, "skipped"),
        }
    }
}

/// Overall run result
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum OverallResult {
    Success,
    Partial,
    Failed,
    Interrupted,
}

impl fmt::Display for OverallResult {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Success => write!(f, "success"),
            Self::Partial => write!(f, "partial"),
            Self::Failed => write!(f, "failed"),
            Self::Interrupted => write!(f, "interrupted"),
        }
    }
}
