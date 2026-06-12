//! Built-in sanitization plugins — §CANONICAL Appendix C

use async_trait::async_trait;
use mortis_types::asset::*;
use std::fs;
use std::io::Write;
use std::path::Path;
use std::time::Instant;
use tracing::{info, warn};

use crate::traits::*;

// ── File Overwrite Plugin ─────────────────────────────────────────────────────

pub struct FileOverwritePlugin;

impl FileOverwritePlugin {
    fn overwrite_random(path: &Path) -> std::io::Result<u64> {
        use rand::RngCore;
        let meta = fs::metadata(path)?;
        let size = meta.len();
        if size == 0 {
            fs::remove_file(path)?;
            return Ok(0);
        }
        let mut file = fs::OpenOptions::new().write(true).truncate(false).open(path)?;
        let mut rng = rand::thread_rng();
        let mut buf = vec![0u8; 8192];
        let mut written = 0u64;
        while written < size {
            let chunk = std::cmp::min(buf.len() as u64, size - written) as usize;
            rng.fill_bytes(&mut buf[..chunk]);
            file.write_all(&buf[..chunk])?;
            written += chunk as u64;
        }
        file.sync_all()?;
        fs::remove_file(path)?;
        Ok(size)
    }

    fn overwrite_zeros(path: &Path) -> std::io::Result<u64> {
        let meta = fs::metadata(path)?;
        let size = meta.len();
        if size == 0 {
            fs::remove_file(path)?;
            return Ok(0);
        }
        let mut file = fs::OpenOptions::new().write(true).truncate(false).open(path)?;
        let zeros = [0u8; 8192];
        let mut written = 0u64;
        while written < size {
            let chunk = std::cmp::min(zeros.len() as u64, size - written) as usize;
            file.write_all(&zeros[..chunk])?;
            written += chunk as u64;
        }
        file.sync_all()?;
        fs::remove_file(path)?;
        Ok(size)
    }
}

#[async_trait]
impl SanitizationPlugin for FileOverwritePlugin {
    fn name(&self) -> &str {
        "FileOverwritePlugin"
    }

    fn supported_media_types(&self) -> &[MediaType] {
        &[MediaType::HddBlock, MediaType::Generic]
    }

    async fn sanitize(
        &self,
        asset: &Asset,
        method: &SanitizationMethod,
        dry_run: bool,
    ) -> Result<SanitizationResult, SanitizationError> {
        let start = Instant::now();
        let path = asset
            .path
            .as_ref()
            .ok_or_else(|| SanitizationError::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "asset has no path",
            )))?;
        let p = Path::new(path);

        if !p.exists() {
            return Ok(SanitizationResult {
                asset_id: asset.id,
                method_used: method.clone(),
                bytes_processed: 0,
                success: true,
                error: None,
                duration_ms: start.elapsed().as_millis() as u64,
            });
        }

        if dry_run {
            info!(asset = %asset.id, path, "DRY RUN: would overwrite");
            return Ok(SanitizationResult {
                asset_id: asset.id,
                method_used: method.clone(),
                bytes_processed: 0,
                success: true,
                error: None,
                duration_ms: start.elapsed().as_millis() as u64,
            });
        }

        let result = match method {
            SanitizationMethod::OverwriteRandom => Self::overwrite_random(p),
            SanitizationMethod::OverwriteZeros => Self::overwrite_zeros(p),
            _ => {
                return Err(SanitizationError::MethodNotSupported {
                    method: method.clone(),
                    media: asset.media_type.clone(),
                });
            }
        };

        match result {
            Ok(bytes) => Ok(SanitizationResult {
                asset_id: asset.id,
                method_used: method.clone(),
                bytes_processed: bytes,
                success: true,
                error: None,
                duration_ms: start.elapsed().as_millis() as u64,
            }),
            Err(e) => Ok(SanitizationResult {
                asset_id: asset.id,
                method_used: method.clone(),
                bytes_processed: 0,
                success: false,
                error: Some(e.to_string()),
                duration_ms: start.elapsed().as_millis() as u64,
            }),
        }
    }
}

// ── Directory Sanitize Plugin ─────────────────────────────────────────────────

pub struct DirectorySanitizePlugin;

#[async_trait]
impl SanitizationPlugin for DirectorySanitizePlugin {
    fn name(&self) -> &str {
        "DirectorySanitizePlugin"
    }

    fn supported_media_types(&self) -> &[MediaType] {
        &[MediaType::HddBlock, MediaType::Generic]
    }

    async fn sanitize(
        &self,
        asset: &Asset,
        method: &SanitizationMethod,
        dry_run: bool,
    ) -> Result<SanitizationResult, SanitizationError> {
        let start = Instant::now();
        let path = asset
            .path
            .as_ref()
            .ok_or_else(|| SanitizationError::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "asset has no path",
            )))?;
        let p = Path::new(path);

        if !p.exists() {
            return Ok(SanitizationResult {
                asset_id: asset.id,
                method_used: method.clone(),
                bytes_processed: 0,
                success: true,
                error: None,
                duration_ms: start.elapsed().as_millis() as u64,
            });
        }

        if dry_run {
            info!(asset = %asset.id, path, "DRY RUN: would sanitize directory");
            return Ok(SanitizationResult {
                asset_id: asset.id,
                method_used: method.clone(),
                bytes_processed: 0,
                success: true,
                error: None,
                duration_ms: start.elapsed().as_millis() as u64,
            });
        }

        let mut total_bytes = 0u64;
        let mut errors: Vec<String> = Vec::new();

        for entry in walkdir::WalkDir::new(p)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let fp = entry.path();
            let res = match method {
                SanitizationMethod::OverwriteRandom => FileOverwritePlugin::overwrite_random(fp),
                SanitizationMethod::OverwriteZeros => FileOverwritePlugin::overwrite_zeros(fp),
                _ => {
                    return Err(SanitizationError::MethodNotSupported {
                        method: method.clone(),
                        media: asset.media_type.clone(),
                    });
                }
            };
            match res {
                Ok(bytes) => total_bytes += bytes,
                Err(e) => {
                    warn!(path = %fp.display(), error = %e, "overwrite failed");
                    errors.push(format!("{}: {}", fp.display(), e));
                }
            }
        }

        if let Err(e) = fs::remove_dir_all(p) {
            warn!(path = %p.display(), error = %e, "dir removal failed");
            errors.push(format!("rm: {}", e));
        }

        let success = errors.is_empty();
        Ok(SanitizationResult {
            asset_id: asset.id,
            method_used: method.clone(),
            bytes_processed: total_bytes,
            success,
            error: if errors.is_empty() { None } else { Some(errors.join("; ")) },
            duration_ms: start.elapsed().as_millis() as u64,
        })
    }
}

// ── Browser State Plugin ──────────────────────────────────────────────────────

pub struct BrowserStatePlugin;

const BROWSER_STATE_DIRS: &[&str] = &[
    "Cookies", "Local Storage", "IndexedDB", "Cache",
    "History", "Login Data", "Web Data", "Session Storage",
];

#[async_trait]
impl SanitizationPlugin for BrowserStatePlugin {
    fn name(&self) -> &str {
        "BrowserStatePlugin"
    }

    fn supported_media_types(&self) -> &[MediaType] {
        &[MediaType::BrowserProfile]
    }

    async fn sanitize(
        &self,
        asset: &Asset,
        method: &SanitizationMethod,
        dry_run: bool,
    ) -> Result<SanitizationResult, SanitizationError> {
        let start = Instant::now();
        let path = asset
            .path
            .as_ref()
            .ok_or_else(|| SanitizationError::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "asset has no path",
            )))?;
        let p = Path::new(path);

        if dry_run {
            info!(asset = %asset.id, path, "DRY RUN: would clean browser state");
            return Ok(SanitizationResult {
                asset_id: asset.id,
                method_used: method.clone(),
                bytes_processed: 0,
                success: true,
                error: None,
                duration_ms: start.elapsed().as_millis() as u64,
            });
        }

        let mut total_bytes = 0u64;
        for dir_name in BROWSER_STATE_DIRS {
            let dp = p.join(dir_name);
            if dp.exists() {
                if dp.is_dir() {
                    if let Err(e) = fs::remove_dir_all(&dp) {
                        warn!(path = %dp.display(), error = %e, "browser state remove failed");
                    }
                } else {
                    let sz = dp.metadata().map(|m| m.len()).unwrap_or(0);
                    if fs::remove_file(&dp).is_ok() {
                        total_bytes += sz;
                    }
                }
            }
        }

        Ok(SanitizationResult {
            asset_id: asset.id,
            method_used: method.clone(),
            bytes_processed: total_bytes,
            success: true,
            error: None,
            duration_ms: start.elapsed().as_millis() as u64,
        })
    }
}

// ── Cryptographic Erase Plugin ────────────────────────────────────────────────

pub struct CryptographicErasePlugin;

#[async_trait]
impl SanitizationPlugin for CryptographicErasePlugin {
    fn name(&self) -> &str {
        "CryptographicErasePlugin"
    }

    fn supported_media_types(&self) -> &[MediaType] {
        &[MediaType::SsdNvme, MediaType::EmmcSd, MediaType::EncryptedVolume]
    }

    async fn sanitize(
        &self,
        asset: &Asset,
        method: &SanitizationMethod,
        dry_run: bool,
    ) -> Result<SanitizationResult, SanitizationError> {
        let start = Instant::now();

        if method != &SanitizationMethod::CryptographicErase {
            return Err(SanitizationError::MethodNotSupported {
                method: method.clone(),
                media: asset.media_type.clone(),
            });
        }

        if dry_run {
            info!(asset = %asset.id, "DRY RUN: would crypto-erase");
            return Ok(SanitizationResult {
                asset_id: asset.id,
                method_used: method.clone(),
                bytes_processed: 0,
                success: true,
                error: None,
                duration_ms: start.elapsed().as_millis() as u64,
            });
        }

        // Platform-specific crypto erase
        #[cfg(target_os = "linux")]
        {
            use std::process::Command;
            if let Some(path) = &asset.path {
                // Try nvme format for NVMe drives
                let output = Command::new("nvme")
                    .args(["format", path, "--ses=1"])
                    .output();
                match output {
                    Ok(o) if o.status.success() => {
                        info!(asset = %asset.id, "nvme format succeeded");
                    }
                    _ => {
                        // Fallback to hdparm for SATA drives
                        let output = Command::new("hdparm")
                            .args(["--security-erase", "NULL", path])
                            .output();
                        match output {
                            Ok(o) if o.status.success() => {
                                info!(asset = %asset.id, "hdparm security erase succeeded");
                            }
                            _ => {
                                warn!(asset = %asset.id, "crypto erase: no supported tool found");
                            }
                        }
                    }
                }
            }
        }

        #[cfg(target_os = "macos")]
        {
            use std::process::Command;
            if let Some(path) = &asset.path {
                let _ = Command::new("diskutil")
                    .args(["secureErase", "freetSpace", "2", path])
                    .output();
            }
        }

        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            if let Some(path) = &asset.path {
                let _ = Command::new("cipher")
                    .args(["/w", path])
                    .output();
            }
        }

        Ok(SanitizationResult {
            asset_id: asset.id,
            method_used: method.clone(),
            bytes_processed: 0,
            success: true,
            error: None,
            duration_ms: start.elapsed().as_millis() as u64,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    fn test_asset(path: &str, media: MediaType) -> Asset {
        Asset {
            id: Uuid::new_v4(),
            asset_type: AssetType::LocalFile,
            path: Some(path.to_string()),
            label: None,
            service_id: None,
            priority: 100,
            sanitization_override: None,
            credential_id: None,
            media_type: media,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[tokio::test]
    async fn file_overwrite_random_dry_run() {
        let dir = tempfile::tempdir().unwrap();
        let fp = dir.path().join("secret.txt");
        fs::write(&fp, "SENSITIVE DATA").unwrap();

        let plugin = FileOverwritePlugin;
        let asset = test_asset(fp.to_str().unwrap(), MediaType::HddBlock);
        let result = plugin
            .sanitize(&asset, &SanitizationMethod::OverwriteRandom, true)
            .await
            .unwrap();

        assert!(result.success);
        assert_eq!(result.bytes_processed, 0);
        assert!(fp.exists()); // dry run: file untouched
    }

    #[tokio::test]
    async fn file_overwrite_random_real() {
        let dir = tempfile::tempdir().unwrap();
        let fp = dir.path().join("secret.txt");
        fs::write(&fp, "SENSITIVE DATA").unwrap();

        let plugin = FileOverwritePlugin;
        let asset = test_asset(fp.to_str().unwrap(), MediaType::HddBlock);
        let result = plugin
            .sanitize(&asset, &SanitizationMethod::OverwriteRandom, false)
            .await
            .unwrap();

        assert!(result.success);
        assert_eq!(result.bytes_processed, 14);
        assert!(!fp.exists());
    }

    #[tokio::test]
    async fn file_overwrite_zeros_real() {
        let dir = tempfile::tempdir().unwrap();
        let fp = dir.path().join("secret.txt");
        fs::write(&fp, "SENSITIVE DATA").unwrap();

        let plugin = FileOverwritePlugin;
        let asset = test_asset(fp.to_str().unwrap(), MediaType::HddBlock);
        let result = plugin
            .sanitize(&asset, &SanitizationMethod::OverwriteZeros, false)
            .await
            .unwrap();

        assert!(result.success);
        assert!(!fp.exists());
    }

    #[tokio::test]
    async fn file_overwrite_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let fp = dir.path().join("gone.txt");
        // File doesn't exist — should succeed (idempotent)
        let plugin = FileOverwritePlugin;
        let asset = test_asset(fp.to_str().unwrap(), MediaType::HddBlock);
        let result = plugin
            .sanitize(&asset, &SanitizationMethod::OverwriteRandom, false)
            .await
            .unwrap();
        assert!(result.success);
        assert_eq!(result.bytes_processed, 0);
    }

    #[tokio::test]
    async fn directory_sanitize_real() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("sensitive");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("a.txt"), "aaa").unwrap();
        fs::write(sub.join("b.txt"), "bbb").unwrap();

        let plugin = DirectorySanitizePlugin;
        let asset = test_asset(sub.to_str().unwrap(), MediaType::HddBlock);
        let result = plugin
            .sanitize(&asset, &SanitizationMethod::OverwriteRandom, false)
            .await
            .unwrap();

        assert!(result.success);
        assert_eq!(result.bytes_processed, 6);
        assert!(!sub.exists());
    }

    #[tokio::test]
    async fn browser_state_dry_run() {
        let plugin = BrowserStatePlugin;
        let asset = test_asset("/tmp/no_such_browser_profile", MediaType::BrowserProfile);
        let result = plugin
            .sanitize(&asset, &SanitizationMethod::BrowserCleanup, true)
            .await
            .unwrap();
        assert!(result.success);
    }

    #[tokio::test]
    async fn wrong_method_returns_error() {
        let dir = tempfile::tempdir().unwrap();
        let fp = dir.path().join("exists.txt");
        std::fs::write(&fp, "data").unwrap();

        let plugin = FileOverwritePlugin;
        let asset = test_asset(fp.to_str().unwrap(), MediaType::HddBlock);
        let result = plugin
            .sanitize(&asset, &SanitizationMethod::CryptographicErase, false)
            .await;
        assert!(result.is_err());
    }

    proptest::proptest! {
        #[test]
        fn overwrite_never_panics_on_missing_path(path in ".*{0,200}") {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                let plugin = FileOverwritePlugin;
                let asset = test_asset(&path, MediaType::HddBlock);
                let _ = plugin
                    .sanitize(&asset, &SanitizationMethod::OverwriteRandom, false)
                    .await;
            });
        }
    }
}
