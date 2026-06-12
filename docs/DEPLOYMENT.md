# Deployment Guide

How to deploy MORTIS in production.

## Prerequisites

- Linux (Ubuntu 22.04+), macOS (12+), or Windows (10 21H2+)
- Rust 1.75.0+ (for building from source)
- 100 MB disk space (binary + database)

## Installation

### From Source

```bash
# Clone
git clone https://github.com/knarayanareddy/MORTIS.git
cd MORTIS

# Build release
cargo build --release

# Verify
./target/release/mortis self-check

# Install to PATH
cp target/release/mortis /usr/local/bin/
```

### Pre-built Binaries

Download from [GitHub Releases](https://github.com/knarayanareddy/MORTIS/releases).

```bash
# Verify signature
cosign verify-blob --bundle mortis.bundle mortis

# Verify hash
sha256sum -c mortis.sha256

# Install
chmod +x mortis
sudo mv mortis /usr/local/bin/
```

## Initial Setup

### 1. Initialize Configuration

```bash
mortis config init
```

This creates:
- `~/.mortis/mortis.db` — Encrypted database
- `~/.mortis/mortis.salt` — PBKDF2 salt

**Important:** Store your passphrase in a physical safe. There is no recovery if forgotten.

### 2. Verify Installation

```bash
mortis self-check
```

All SLOs should show ✅.

### 3. Add Assets

```bash
# Local files
mortis inventory add --type local_file --path /data/secrets/api-keys.json --label "API Keys"
mortis inventory add --type local_file --path /data/secrets/certs/server.pem --label "TLS Cert"

# Directories
mortis inventory add --type local_dir --path /data/secrets/ --label "Secrets Dir"

# Browser profiles
mortis inventory add --type browser_profile --path ~/.config/google-chrome/Default --label "Chrome"

# Cloud accounts
mortis inventory add --type cloud_account --path "https://accounts.google.com" --label "Google" --service-id google_account

# Verify
mortis inventory list
```

### 4. Create a Plan

```bash
cat > /etc/mortis/plans/emergency.toml << 'EOF'
[plan]
name = "emergency_wipe"
description = "Emergency data destruction"

[[phases]]
phase_type = "revoke_remote"
asset_ids = ["<cloud-account-uuid>"]
continue_on_failure = true

[[phases]]
phase_type = "sanitize_local"
asset_ids = ["<file-uuid-1>", "<file-uuid-2>", "<dir-uuid>"]
continue_on_failure = true

[[phases]]
phase_type = "clear_browser"
asset_ids = ["<browser-uuid>"]
continue_on_failure = true

[[phases]]
phase_type = "self_destruct"
asset_ids = []
continue_on_failure = true
EOF
```

### 5. Test with Dry-Run

```bash
mortis run --plan /etc/mortis/plans/emergency.toml --dry-run
```

Verify:
- All phases show "success"
- No files were deleted
- Receipt was created

### 6. Review Receipt

```bash
mortis receipt list
mortis receipt inspect --run-id <id>
```

## Production Configuration

### Database Location

Default: `~/.mortis/mortis.db`

For production, consider:
- Encrypted filesystem partition
- Restricted permissions (`chmod 600`)
- Regular backups (before rotation)

```bash
# Custom location
mortis --db /secure/mortis/mortis.db config init
```

### Logging

```bash
# Enable structured logging
mortis --verbose --log-level info run --plan emergency.toml

# Log to file (future)
mortis --log-file /var/log/mortis.log run --plan emergency.toml
```

Log scrubbing automatically redacts:
- Passphrases and keys
- File contents
- Deep file paths
- Credential values

### Non-Interactive Execution

For scripts and CI/CD:

```bash
export MORTIS_PASS="your-secure-passphrase"
mortis run --plan emergency.toml --passphrase-env MORTIS_PASS
unset MORTIS_PASS
```

## Trigger Configuration

### Scheduled Triggers

```toml
# In plan file (future)
[trigger]
type = "scheduled"
cron = "0 0 2 * * *"  # Every day at 2 AM
```

### Dead Man's Switch

```toml
[trigger]
type = "dead_man_switch"
timeout_seconds = 86400  # 24 hours
```

Check-in mechanism:
```bash
mortis trigger checkin
```

### Webhook Trigger

```toml
[trigger]
type = "remote_signal"
source = "webhook"
url = "https://your-domain.com/mortis/trigger"
hmac_secret = "your-hmac-secret"
```

## Security Hardening

### File Permissions

```bash
chmod 700 ~/.mortis/
chmod 600 ~/.mortis/mortis.db
chmod 600 ~/.mortis/mortis.salt
chmod 700 ~/.mortis/receipts/
```

### Encrypted Filesystem

```bash
# Create encrypted partition
cryptsetup luksFormat /dev/sdX
cryptsetup open /dev/sdX mortis-data
mkfs.ext4 /dev/mapper/mortis-data
mount /dev/mapper/mortis-data /secure/

# Use for database
mortis --db /secure/mortis/mortis.db config init
```

### Network Isolation

For maximum security, run MORTIS on an air-gapped system:

```bash
# Build with no network features
cargo build --release --no-default-features

# Run offline
mortis run --plan emergency.toml --no-timestamp
```

## Backup and Recovery

### Backup

```bash
# Backup encrypted database
cp ~/.mortis/mortis.db /backup/mortis-$(date +%Y%m%d).db

# Backup salt file
cp ~/.mortis/mortis.salt /backup/mortis-$(date +%Y%m%d).salt

# Backup receipts
tar czf /backup/mortis-receipts-$(date +%Y%m%d).tar.gz ~/.mortis/receipts/
```

### Recovery

```bash
# Restore from backup
cp /backup/mortis-20260612.db ~/.mortis/mortis.db
cp /backup/mortis-20260612.salt ~/.mortis/mortis.salt

# Verify
mortis receipt list
```

### Key Rotation

```bash
# Rotate passphrase
mortis config rotate-key

# Old passphrase required, then new passphrase
# Database re-encrypted with new key
# Salt file updated automatically
```

## Monitoring

### Health Check

```bash
mortis self-check
```

### Receipt Monitoring

```bash
# Check recent runs
mortis receipt list --last 20

# Verify receipt integrity
mortis receipt verify --receipt ~/.mortis/receipts/<id>.receipt.json
```

### Log Monitoring

```bash
# Monitor for errors
tail -f /var/log/mortis.log | grep ERROR

# Monitor for warnings
tail -f /var/log/mortis.log | grep WARN
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run MORTIS dry-run
  run: |
    export MORTIS_PASS="${{ secrets.MORTIS_PASSPHRASE }}"
    mortis run --plan plans/ci-cleanup.toml --dry-run --passphrase-env MORTIS_PASS
```

### GitLab CI

```yaml
mortis-dry-run:
  script:
    - mortis run --plan plans/ci-cleanup.toml --dry-run --passphrase-env MORTIS_PASS
  variables:
    MORTIS_PASS: $CI_MORTIS_PASSPHRASE
```

## Troubleshooting

### Database Locked

```
Error: database is locked
```

**Solution:** Another MORTIS process is running. Wait or kill it.

### Wrong Passphrase

```
Error: passphrase verification failed
```

**Solution:** Check passphrase. If forgotten, see Runbook 02.

### Plugin Timeout

```
Error: plugin timeout after 300000ms
```

**Solution:** Increase timeout or check network connectivity.

### Missing Salt File

```
Error: not initialized; run 'config init' first
```

**Solution:** Run `mortis config init` or restore salt file from backup.

### Receipt Verification Failed

```
Error: TAMPERED: body hash mismatch
```

**Solution:** Receipt has been modified. Check for tampering.

## Performance Tuning

### Large Inventories

For 1000+ assets:
- Use `--format json` for batch operations
- Consider splitting into multiple plans
- Run phases in parallel (future)

### Slow Sanitization

- SSD: Use `cryptographic_erase` (instant)
- HDD: Overwrite is I/O bound (plan for time)
- Network: Cloud deletion depends on API latency

### Memory Usage

- Default: ~50 MB
- Large plans: ~100 MB
- Plugin-heavy: ~200 MB
