use thiserror::Error;

/// Exit codes per §5.1
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExitCode {
    /// Full success
    Ok = 0,
    /// Partial success with receipt
    Partial = 1,
    /// Passphrase verification failed
    PassphraseFail = 2,
    /// Plan load failed
    PlanLoadFail = 3,
    /// Database error
    DbError = 4,
    /// Resource not found
    NotFound = 5,
    /// Invalid receipt
    InvalidReceipt = 6,
    /// Receipt tampered
    Tampered = 7,
    /// Trigger would not fire
    TriggerWouldNotFire = 8,
    /// Integrity check failed
    IntegrityFail = 9,
}

impl ExitCode {
    pub fn as_i32(self) -> i32 {
        self as i32
    }
}

#[derive(Debug, Error)]
pub enum MortisError {
    #[error("Passphrase verification failed")]
    PassphraseFail,

    #[error("Plan load failed: {0}")]
    PlanLoadFail(String),

    #[error("Database error: {0}")]
    DbError(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Receipt invalid: {0}")]
    InvalidReceipt(String),

    #[error("Receipt tampered: {0}")]
    Tampered(String),

    #[error("Trigger error: {0}")]
    TriggerError(String),

    #[error("Integrity check failed: {0}")]
    IntegrityFail(String),

    #[error("Plugin error: {0}")]
    PluginError(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Crypto error: {0}")]
    Crypto(String),

    #[error("{0}")]
    Other(String),
}

impl MortisError {
    pub fn exit_code(&self) -> ExitCode {
        match self {
            Self::PassphraseFail => ExitCode::PassphraseFail,
            Self::PlanLoadFail(_) => ExitCode::PlanLoadFail,
            Self::DbError(_) => ExitCode::DbError,
            Self::NotFound(_) => ExitCode::NotFound,
            Self::InvalidReceipt(_) => ExitCode::InvalidReceipt,
            Self::Tampered(_) => ExitCode::Tampered,
            Self::TriggerError(_) => ExitCode::TriggerWouldNotFire,
            Self::IntegrityFail(_) => ExitCode::IntegrityFail,
            _ => ExitCode::Partial,
        }
    }
}
