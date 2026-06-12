# MORTIS Build Summary — Final (Post Expert Review Fixes)

## Metrics

```
Build warnings:  0
Tests:           104 passed, 0 failed
Lines of Rust:   5,340
Crates:          6
E2E tests:       12
Backward compat: 5
Proptest cases:  7
```

## Expert Issues Fixed

| Issue | Severity | Fix |
|-------|----------|-----|
| **SQLCipher encryption missing** | CRITICAL | `bundled-sqlcipher` feature + `PRAGMA key` in `open_database_encrypted` |
| **Key rotation lockout bug** | CRITICAL | Salt file now written during `config rotate-key` |
| **Receipt verification bypassed** | HIGH | `receipt verify` now calls `ReceiptEngine::verify` + returns correct exit codes |
| **Remote revocation stubbed in orchestrator** | HIGH | `execute_revocation` now iterates plugins, calls `delete()`, records results |
| **Self-destruct was no-op** | MEDIUM | `execute_self_destruct` now deletes `.mortis` dir, salt files, config |
| **Incremental receipt persistence missing** | MEDIUM | `with_persist_fn` callback writes receipt after every phase |
| **Passphrase not zeroized** | MEDIUM | `passphrase.zeroize()` called after use in `cmd_run` |
| **DB key rotation not re-encrypting** | HIGH | `PRAGMA rekey` implemented via `rotate_database_key` |
| **Salt file not updated on rotation** | CRITICAL | Fixed — writes to `db_path.salt` after `PRAGMA rekey` |

## What's Now Implemented

- ✅ SQLCipher AES-256-CBC at-rest encryption (`PRAGMA key`)
- ✅ DB key rotation with `PRAGMA rekey` + salt file update
- ✅ Receipt verification via Ed25519 signature + body hash check
- ✅ Correct exit codes (0=valid, 6=invalid, 7=tampered)
- ✅ Remote revocation orchestrator (calls deletion plugins)
- ✅ Self-destruct phase (deletes .mortis dir + salt + config)
- ✅ Incremental receipt persistence (after each phase)
- ✅ Passphrase zeroization after use
- ✅ Salt stored in external file (not in encrypted DB)
- ✅ All 104 tests passing, 0 warnings
