# MORTIS — Machine-Operated Responsive Total Infrastructure Sanitizer

A local-first, user-controlled data sanitization and remote revocation system written in Rust.

## Quick Start

```bash
# Build
cargo build --release

# Initialize (creates encrypted config + DB)
mortis config init

# Add assets to inventory
mortis inventory add --type local_file --path /path/to/sensitive/data --label "secret docs"

# Create and run a plan
mortis run --plan my_plan.toml --dry-run   # Safe preview
mortis run --plan my_plan.toml              # Execute

# Verify receipt
mortis receipt verify --receipt ~/.mortis/receipts/<run_id>.receipt.json
```

## Architecture

MORTIS follows a phase-based choreography:

1. **Trigger fires** (manual, scheduled, environmental, remote signal, dead man's switch)
2. **Passphrase interlock** — gates all destructive operations
3. **Plan loaded** from InventoryDB
4. **Phases execute** in user-defined order:
   - Revoke remote accounts (via DeletionPlugins)
   - Sanitize local assets (NIST SP 800-88 aligned)
   - Clear browser state
   - Wipe DB records
   - Self-destruct config (optional)
5. **Receipt emitted** — Ed25519-signed, optionally RFC 3161-timestamped

## Components

| Component | Purpose |
|-----------|---------|
| `mortis-core` | Core engine: orchestrator, triggers, passphrase interlock |
| `mortis-crypto` | Cryptographic primitives: Ed25519, SHA-256, PBKDF2, AES-256 |
| `mortis-db` | SQLCipher persistence layer: inventory, receipts, config |
| `mortis-plugins` | Plugin traits + built-in plugins for sanitization & deletion |
| `mortis-cli` | CLI interface (clap-based) |

## Security Model

- **Encryption at rest:** SQLCipher (AES-256-CBC) with user-supplied passphrase
- **Key derivation:** PBKDF2-HMAC-SHA512 (100,000 iterations)
- **Receipt signing:** Ed25519 with SHA-256 body hash
- **Timestamping:** RFC 3161 (optional, user-configurable TSA)
- **Memory safety:** All key material zeroized via `zeroize` crate
- **No telemetry:** Zero outbound network on local-only runs

## Documentation

See [MORTIS.md](../MORTIS.md) for the complete engineering specification.
