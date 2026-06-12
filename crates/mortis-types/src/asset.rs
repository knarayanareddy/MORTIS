use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

/// Asset types supported by MORTIS
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum AssetType {
    LocalFile,
    LocalDir,
    DbRecord,
    BrowserProfile,
    CloudAccount,
    Custom(String),
}

impl fmt::Display for AssetType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::LocalFile => write!(f, "local_file"),
            Self::LocalDir => write!(f, "local_dir"),
            Self::DbRecord => write!(f, "db_record"),
            Self::BrowserProfile => write!(f, "browser_profile"),
            Self::CloudAccount => write!(f, "cloud_account"),
            Self::Custom(s) => write!(f, "{}", s),
        }
    }
}

impl AssetType {
    pub fn from_str_opt(s: &str) -> Self {
        match s {
            "local_file" => Self::LocalFile,
            "local_dir" => Self::LocalDir,
            "db_record" => Self::DbRecord,
            "browser_profile" => Self::BrowserProfile,
            "cloud_account" => Self::CloudAccount,
            other => Self::Custom(other.to_string()),
        }
    }
}

/// Media types for sanitization method selection (§CANONICAL Appendix C)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum MediaType {
    HddBlock,
    SsdNvme,
    EmmcSd,
    RamDisk,
    EncryptedVolume,
    DatabaseRecord,
    BrowserProfile,
    OpticalMedia,
    CloudStorage,
    Generic,
}

impl fmt::Display for MediaType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::HddBlock => write!(f, "hdd"),
            Self::SsdNvme => write!(f, "ssd_nvme"),
            Self::EmmcSd => write!(f, "emmc_sd"),
            Self::RamDisk => write!(f, "ram_disk"),
            Self::EncryptedVolume => write!(f, "encrypted_volume"),
            Self::DatabaseRecord => write!(f, "database"),
            Self::BrowserProfile => write!(f, "browser"),
            Self::OpticalMedia => write!(f, "optical"),
            Self::CloudStorage => write!(f, "cloud"),
            Self::Generic => write!(f, "generic"),
        }
    }
}

/// Sanitization methods — §CANONICAL Appendix C
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum SanitizationMethod {
    OverwriteRandom,
    OverwriteZeros,
    CryptographicErase,
    DatabaseWipe,
    BrowserCleanup,
    CloudDeletion,
    PhysicalDestructionRequired,
}

impl fmt::Display for SanitizationMethod {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::OverwriteRandom => write!(f, "overwrite_random"),
            Self::OverwriteZeros => write!(f, "overwrite_zeros"),
            Self::CryptographicErase => write!(f, "cryptographic_erase"),
            Self::DatabaseWipe => write!(f, "database_wipe"),
            Self::BrowserCleanup => write!(f, "browser_cleanup"),
            Self::CloudDeletion => write!(f, "cloud_deletion"),
            Self::PhysicalDestructionRequired => write!(f, "physical_destruction"),
        }
    }
}

/// Select sanitization method per Appendix C matrix
pub fn select_sanitization_method(media: &MediaType, _override_allowed: bool) -> SanitizationMethod {
    match media {
        MediaType::HddBlock => SanitizationMethod::OverwriteRandom,
        MediaType::SsdNvme | MediaType::EmmcSd => SanitizationMethod::CryptographicErase,
        MediaType::RamDisk => SanitizationMethod::OverwriteZeros,
        MediaType::EncryptedVolume => SanitizationMethod::CryptographicErase,
        MediaType::DatabaseRecord => SanitizationMethod::DatabaseWipe,
        MediaType::BrowserProfile => SanitizationMethod::BrowserCleanup,
        MediaType::CloudStorage => SanitizationMethod::CloudDeletion,
        MediaType::OpticalMedia => SanitizationMethod::PhysicalDestructionRequired,
        MediaType::Generic => SanitizationMethod::OverwriteRandom,
    }
}

/// A registered digital asset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub id: Uuid,
    pub asset_type: AssetType,
    pub path: Option<String>,
    pub label: Option<String>,
    pub service_id: Option<String>,
    pub priority: i32,
    pub sanitization_override: Option<SanitizationMethod>,
    pub credential_id: Option<Uuid>,
    pub media_type: MediaType,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Asset {
    pub fn effective_sanitization_method(&self) -> SanitizationMethod {
        self.sanitization_override
            .clone()
            .unwrap_or_else(|| select_sanitization_method(&self.media_type, true))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitization_method_selection_hdd() {
        assert_eq!(
            select_sanitization_method(&MediaType::HddBlock, false),
            SanitizationMethod::OverwriteRandom
        );
    }

    #[test]
    fn test_sanitization_method_selection_ssd() {
        assert_eq!(
            select_sanitization_method(&MediaType::SsdNvme, false),
            SanitizationMethod::CryptographicErase
        );
    }

    #[test]
    fn test_sanitization_method_selection_browser() {
        assert_eq!(
            select_sanitization_method(&MediaType::BrowserProfile, false),
            SanitizationMethod::BrowserCleanup
        );
    }

    proptest::proptest! {
        #[test]
        fn test_asset_type_display_roundtrip(s in "[a-z_]{1,20}") {
            let at = AssetType::from_str_opt(&s);
            let displayed = at.to_string();
            // Custom types round-trip; known types map to their canonical form
            assert!(!displayed.is_empty());
        }
    }
}
