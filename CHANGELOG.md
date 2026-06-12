# Changelog

All notable changes to MORTIS are documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [0.1.0] - 2026-06-12

### Added

#### Core Engine
- Orchestrator with phase-based choreography (§4.3)
- Passphrase interlock with primary and duress support
- Plan loading from TOML files
- Trigger manager (manual, scheduled, environmental, remote, dead man's switch)
- Log scrubbing middleware (hex/b64 redaction, path truncation)
- Incremental receipt persistence after each phase
- Run metrics collection and persistence

#### Cryptographic Primitives (§7 CANONICAL)
- Ed25519 receipt signing via `ed25519-dalek`
- SHA-256 canonical JSON hashing via `ring`
- PBKDF2-HMAC-SHA512 key derivation (100,000 iterations)
- AES-256-GCM credential encryption via `aes-gcm`
- RFC 3161 TSA client with graceful degradation
- Constant-time passphrase comparison via `subtle`
- Memory zeroization via `zeroize`

#### Database (Appendix A CANONICAL)
- SQLCipher encryption (AES-256-CBC) via `bundled-sqlcipher`
- Full schema: assets, plans, plan_phases, receipts, receipt_phases, credentials, run_metrics, config
- Key rotation via `PRAGMA rekey`
- Forward-only migrations

#### Plugin System (§5.2 CANONICAL)
- `SanitizationPlugin` trait (async)
- `DeletionPlugin` trait (async)
- `InventoryConnector` trait
- Built-in plugins:
  - `FileOverwritePlugin` (random/zero overwrite)
  - `DirectorySanitizePlugin` (recursive)
  - `BrowserStatePlugin` (browser profile cleanup)
  - `CryptographicErasePlugin` (platform-specific)
  - `GoogleAccountPlugin` (stub)
  - `DropboxPlugin` (stub)
  - `GenericApiPlugin` (configurable)
- Plugin panic catching and timeout enforcement

#### CLI (§5.1)
- All commands: run, inventory, receipt, trigger, config, self-check
- All 10 exit codes per spec
- Secure passphrase input via `rpassword`
- SLO benchmarks in `self-check`
- Non-interactive mode via `--passphrase-env`

#### Testing
- 104 tests total
- 12 E2E tests (full CLI lifecycle)
- 5 backward compatibility tests (receipt corpus)
- 7 property-based tests (proptest)
- 0 compiler warnings

#### Documentation
- Comprehensive README with quick start, CLI reference, plans, triggers, receipts
- Architecture documentation
- API reference
- Security model documentation
- Deployment guide
- Contributing guide

#### CI/CD
- GitHub Actions pipeline with 11 quality gates
- Reproducible build verification
- SBOM generation (CycloneDX)
- Binary signing (cosign)
- License allowlist (cargo-deny)

#### Scripts
- `build-reproducible.sh` — Verify build reproducibility
- `generate-sbom.sh` — Generate CycloneDX SBOM
- `sign-release.sh` — Sign binaries with cosign

### Security

- SQLCipher AES-256-CBC database encryption
- PBKDF2-HMAC-SHA512 key derivation (100k iterations)
- Ed25519 receipt signing with tamper detection
- AES-256-GCM credential encryption
- Passphrase zeroization after use
- Log scrubbing (hex/b64/redaction)
- Plugin timeout enforcement
- No telemetry, no call-home, no analytics

### Known Limitations

- Deletion plugins are stubs (require OAuth2 + Playwright)
- Environmental triggers not implemented
- Remote signal triggers not implemented
- Self-destruct phase deletes config only (not binary)
- No GUI (CLI-only)
- No multi-user support
