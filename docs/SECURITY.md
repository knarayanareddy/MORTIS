# Security Model

Comprehensive security documentation for MORTIS.

## Threat Model

### Trust Boundaries

```
┌────────────────────────────────────────────────────────────┐
│ FULLY TRUSTED (process-owned)                              │
│ - Orchestrator                                             │
│ - PassphraseInterlock                                      │
│ - ReceiptEngine                                            │
│ - InventoryDB (SQLCipher, passphrase-gated)                │
└────────────────────────────────────────────────────────────┘
│ narrow plugin API (typed traits, no raw FFI)               │
▼
┌────────────────────────────────────────────────────────────┐
│ SEMI-TRUSTED (sandboxed plugins, local system access)      │
│ - SanitizationPlugins (local FS ops)                       │
│ - BrowserAutomation (Playwright subprocess)                │
│ - InventoryConnectors (read-only system probes)            │
└────────────────────────────────────────────────────────────┘
│ network I/O only via typed plugin return values            │
▼
┌────────────────────────────────────────────────────────────┐
│ UNTRUSTED (remote, assumed compromised or unavailable)     │
│ - Cloud service APIs (deletion endpoints)                  │
│ - RFC 3161 TSA                                             │
│ - SMS/Signal/webhook trigger source                        │
└────────────────────────────────────────────────────────────┘
```

### Security Objectives

1. **Confidentiality:** No plaintext credentials in logs, receipts, or files
2. **Integrity:** Receipts cannot be forged or modified without detection
3. **Availability:** Trigger mechanisms survive common failure modes
4. **Non-repudiation:** Receipts provide cryptographic evidence of what happened and when

### Attack Surfaces

| Surface | Vectors | Mitigation |
|---------|---------|------------|
| Passphrase entry | Keylogger, shoulder-surfing | `rpassword` secure input, no echo |
| Trigger channel | Fake SMS/webhook, replay | HMAC-signed payloads, nonce + timestamp |
| SQLCipher DB | Physical access + offline attack | PBKDF2 100k iterations + 32-byte salt |
| Plugin subprocess | Malicious JS in automation | Isolated context, no persistent profiles |
| Binary distribution | Supply chain compromise | Reproducible builds, cosign signing, SBOM |
| Receipt file | Tampering to obscure evidence | Ed25519 signature, `receipt verify` |

## Cryptographic Primitives

All primitives come from audited Rust crates. MD5, SHA-1, DES, 3DES, and RSA < 2048-bit are **banned**.

| Purpose | Primitive | Crate | Notes |
|---------|-----------|-------|-------|
| Database encryption | AES-256-CBC | sqlcipher (4.x) | Industry standard for SQLite |
| Key derivation | PBKDF2-HMAC-SHA512 | ring | 100,000 iterations, 32-byte salt |
| Receipt signing | Ed25519 | ed25519-dalek | Keys generated at config init |
| Receipt body hash | SHA-256 | ring | Canonical JSON (sorted keys, no whitespace) |
| Credential encryption | AES-256-GCM | aes-gcm | Application-layer encryption |
| RFC 3161 timestamps | SHA-256 + TSA | reqwest | Optional, configurable TSA URL |
| Random generation | ChaCha20 | rand (OsRng) | Salts, UUIDs, key material |
| Memory zeroization | — | zeroize | All key material, passphrases |

## Encryption at Rest

### Database Encryption

The entire SQLCipher database is encrypted with AES-256-CBC.

**Key derivation flow:**
```
passphrase + salt (32 bytes random)
    │
    ▼
PBKDF2-HMAC-SHA512 (100,000 iterations)
    │
    ▼
32-byte derived key
    │
    ▼
PRAGMA key = "x'<hex>'"
    │
    ▼
SQLCipher AES-256-CBC encryption
```

**Salt storage:**
- Salt stored in external file (`~/.mortis/mortis.salt`)
- NOT in the encrypted DB (chicken-and-egg problem)
- Salt is not secret, but required for key derivation

### Credential Encryption

Credentials are encrypted at the application layer with AES-256-GCM before storage.

```
plaintext credential
    │
    ▼
AES-256-GCM(key=derived_key, nonce=random_12_bytes)
    │
    ▼
nonce || ciphertext (includes 16-byte auth tag)
    │
    ▼
stored as BLOB in credentials table
```

### Key Rotation

```bash
mortis config rotate-key
```

What happens:
1. Verify old passphrase
2. Generate new salt
3. Derive new key from new passphrase + new salt
4. Execute `PRAGMA rekey = "x'<new_key_hex>'"`
5. Write new salt to external file
6. Update interlock hash in DB

## Receipt Integrity

### Signing Process

1. Build receipt body (header + phases + summary)
2. Serialize to canonical JSON (sorted keys, no whitespace)
3. Compute SHA-256 hash of canonical JSON
4. Sign hash with Ed25519 private key
5. Store signature block in receipt

### Verification Process

1. Read receipt JSON
2. Reconstruct canonical body from header + phases + summary
3. Compute SHA-256 hash
4. Compare with `signature.body_hash`
5. Verify Ed25519 signature against hash
6. Return: Valid / Invalid / Tampered

### Tamper Detection

Any modification to the receipt after signing will be detected:
- Changing any field in header, phases, or summary
- Modifying the signature block
- Removing the signature
- Reordering JSON keys

## Memory Safety

### Zeroization

All sensitive material is zeroized on drop:

```rust
#[derive(ZeroizeOnDrop)]
pub struct DerivedKey {
    bytes: [u8; 32],  // Zeroized on drop
}

#[derive(ZeroizeOnDrop)]
pub struct SigningKeyPair {
    secret: SigningKey,  // Zeroized on drop
}
```

### Passphrase Handling

- Passphrases read via `rpassword` (no echo)
- Stored in `String` (heap-allocated)
- Zeroized after key derivation
- Never logged

### Log Scrubbing

Sensitive data is scrubbed from logs:

| Pattern | Action |
|---------|--------|
| Hex strings (16+ chars) | Replaced with `[REDACTED_HEX]` |
| Base64 blobs (32+ chars) | Replaced with `[REDACTED_B64]` |
| File paths (depth > 3) | Truncated with `[PATH_REDACTED]` |
| Keywords (passphrase, password, etc.) | Triggers redaction |

## Plugin Security

### Isolation

- Plugins are Rust traits (`Send + Sync`)
- No raw FFI or process spawning (except Playwright)
- Plugins receive only typed structs
- Plugins cannot access InventoryDB or ReceiptEngine
- Plugin panics caught by orchestrator

### Timeout Enforcement

Every plugin call is wrapped in `tokio::time::timeout`:

```rust
let result = tokio::time::timeout(
    Duration::from_secs(300),
    plugin.sanitize(asset, method, false),
).await;
```

Default timeouts:
| Operation | Timeout |
|-----------|---------|
| Sanitization plugin | 300 seconds |
| Deletion plugin | 30 seconds |
| Trigger evaluation | 5 seconds |
| DB open + migration | 15 seconds |
| RFC 3161 TSA request | 10 seconds |

## Coercion / Duress Model

MORTIS supports a **duress passphrase** distinct from the primary:

- Executes a reduced, pre-configured plan (e.g., omitting self-destruct)
- Receipt tagged `"coercion": true` for later forensic use
- Existence not detectable from encrypted DB header

```bash
# Configure duress passphrase
mortis config init  # Set primary passphrase
# Then manually configure duress in the plan
```

## What MORTIS Cannot Guarantee

These are documented limitations, not bugs:

1. **Remote deletion is best-effort.** Cloud services may delay, ignore, or partially execute deletion requests.

2. **GDPR Article 17 compliance is not automatic.** MORTIS facilitates deletion requests but does not certify compliance.

3. **Physical media retention.** MORTIS follows NIST SP 800-88 for logical and cryptographic erasure. Physical destruction is out of scope.

4. **Coercion scenarios.** Duress passphrase helps, but cannot protect against compelled biometric unlock.

5. **Anti-forensics completeness.** MORTIS deletes what it's told to delete. Shadow copies, swap files, temp files outside scope, and cloud sync caches are not handled.

## Security Review Checklist

Before production deployment:

- [ ] Passphrase is strong (20+ characters)
- [ ] Passphrase stored in physical safe
- [ ] Database path is on encrypted filesystem
- [ ] Log files are access-restricted
- [ ] Binary verified with `mortis self-check`
- [ ] Receipt verification tested
- [ ] Dry-run tested before live execution
- [ ] Trigger sensitivity reviewed
- [ ] Plugin timeouts configured
- [ ] External security audit completed

## CVE Response

| Severity | Response Time |
|----------|---------------|
| Critical | Patch within 24 hours |
| High | Patch within 72 hours |
| Medium | Patch before next minor release |
| Low | Triage within 1 week |

Report security issues to: security@mortis.dev (GPG key published)
