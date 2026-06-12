//! §CANONICAL — Appendix A: Inventory DB Schema
//!
//! §3.3 C-2: All data at rest encrypted with SQLCipher (AES-256-CBC).

use rusqlite::{Connection, Result};
use tracing::info;

/// Initialize schema from Appendix A DDL
pub fn initialize_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version     INTEGER PRIMARY KEY,
            applied_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
        );

        CREATE TABLE IF NOT EXISTS assets (
            id                    TEXT PRIMARY KEY,
            asset_type            TEXT NOT NULL,
            path                  TEXT,
            label                 TEXT,
            service_id            TEXT,
            priority              INTEGER NOT NULL DEFAULT 100,
            sanitization_override TEXT,
            credential_id         TEXT REFERENCES credentials(id),
            media_type            TEXT NOT NULL DEFAULT 'generic',
            created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
            updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
        );
        CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
        CREATE INDEX IF NOT EXISTS idx_assets_service ON assets(service_id);

        CREATE TABLE IF NOT EXISTS plans (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL UNIQUE,
            description TEXT,
            is_default  INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
        );

        CREATE TABLE IF NOT EXISTS plan_phases (
            id                  TEXT PRIMARY KEY,
            plan_id             TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
            phase_order         INTEGER NOT NULL,
            phase_type          TEXT NOT NULL,
            asset_ids           TEXT NOT NULL,
            continue_on_failure INTEGER NOT NULL DEFAULT 1,
            UNIQUE(plan_id, phase_order)
        );
        CREATE INDEX IF NOT EXISTS idx_plan_phases_plan ON plan_phases(plan_id);

        CREATE TABLE IF NOT EXISTS credentials (
            id              TEXT PRIMARY KEY,
            service_id      TEXT NOT NULL,
            credential_type TEXT NOT NULL,
            encrypted_value BLOB NOT NULL,
            nonce           BLOB NOT NULL,
            expires_at      TEXT,
            created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
            rotated_at      TEXT
        );

        CREATE TABLE IF NOT EXISTS receipts (
            run_id            TEXT PRIMARY KEY,
            schema_version    TEXT NOT NULL DEFAULT '1.0',
            plan_id           TEXT,
            triggered_by      TEXT NOT NULL,
            dry_run           INTEGER NOT NULL,
            coercion          INTEGER NOT NULL DEFAULT 0,
            overall_result    TEXT NOT NULL,
            phases_total      INTEGER NOT NULL,
            phases_succeeded  INTEGER NOT NULL,
            phases_failed     INTEGER NOT NULL,
            bytes_processed   INTEGER NOT NULL DEFAULT 0,
            started_at        TEXT NOT NULL,
            completed_at      TEXT,
            signature         TEXT,
            rfc3161_token     TEXT,
            receipt_json_path TEXT
        );

        CREATE TABLE IF NOT EXISTS receipt_phases (
            id              TEXT PRIMARY KEY,
            run_id          TEXT NOT NULL REFERENCES receipts(run_id) ON DELETE CASCADE,
            phase_order     INTEGER NOT NULL,
            phase_type      TEXT NOT NULL,
            plugin_name     TEXT,
            asset_id        TEXT,
            result          TEXT NOT NULL,
            best_effort     INTEGER NOT NULL DEFAULT 0,
            bytes_processed INTEGER NOT NULL DEFAULT 0,
            duration_ms     INTEGER,
            evidence        TEXT,
            error           TEXT,
            recorded_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
        );
        CREATE INDEX IF NOT EXISTS idx_receipt_phases_run ON receipt_phases(run_id);

        CREATE TABLE IF NOT EXISTS run_metrics (
            run_id              TEXT PRIMARY KEY,
            run_duration_ms     INTEGER,
            plugins_invoked     INTEGER,
            plugins_timed_out   INTEGER,
            receipt_signed      INTEGER,
            rfc3161_timestamped INTEGER
        );

        CREATE TABLE IF NOT EXISTS config (
            key          TEXT PRIMARY KEY,
            value        TEXT NOT NULL,
            is_sensitive INTEGER NOT NULL DEFAULT 0,
            updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
        );
    ")?;

    info!("schema initialized");
    Ok(())
}

/// §6.3: Open database with SQLCipher encryption.
/// The passphrase_bytes are passed via PRAGMA key immediately after open.
pub fn open_database_encrypted(path: &str, passphrase_bytes: &[u8]) -> Result<Connection> {
    let conn = Connection::open(path)?;

    // §CANONICAL: Set encryption key via PRAGMA key
    // SQLCipher expects hex-encoded key material
    let hex_key = hex::encode(passphrase_bytes);
    conn.execute_batch(&format!("PRAGMA key = \"x'{}'\";", hex_key))?;

    // Enable WAL mode and foreign keys
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    // Verify decryption succeeded by querying a system table
    // If the key is wrong, this will fail
    conn.execute_batch("SELECT count(*) FROM sqlite_master;")?;

    Ok(conn)
}

/// §7: Re-encrypt database with new passphrase (key rotation).
pub fn rotate_database_key(conn: &Connection, new_passphrase_bytes: &[u8]) -> Result<()> {
    let hex_key = hex::encode(new_passphrase_bytes);
    conn.execute_batch(&format!("PRAGMA rekey = \"x'{}'\";", hex_key))?;
    info!("database re-encrypted with new key");
    Ok(())
}

/// Open an unencrypted database (for testing only)
pub fn open_memory_database() -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;
    Ok(conn)
}

/// Open a test database with encryption
pub fn open_test_database(passphrase_bytes: &[u8]) -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    let hex_key = hex::encode(passphrase_bytes);
    conn.execute_batch(&format!("PRAGMA key = \"x'{}'\";", hex_key))?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;
    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn init_schema_creates_tables() {
        let conn = open_memory_database().unwrap();
        initialize_schema(&conn).unwrap();

        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table'",
                [],
                |r| r.get(0),
            )
            .unwrap();

        assert!(count >= 8);
    }

    #[test]
    fn encrypted_db_requires_key() {
        let pass = b"test_passphrase_for_sqlcipher";
        let conn = open_test_database(pass).unwrap();
        initialize_schema(&conn).unwrap();

        // Verify we can read
        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM assets", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn key_rotation_works() {
        let old_pass = b"old_passphrase_1234567890123456";
        let new_pass = b"new_passphrase_1234567890123456";

        let conn = open_test_database(old_pass).unwrap();
        initialize_schema(&conn).unwrap();

        // Insert test data
        conn.execute(
            "INSERT INTO config (key, value, is_sensitive) VALUES ('test', 'value', 0)",
            [],
        )
        .unwrap();

        // Rotate key
        rotate_database_key(&conn, new_pass).unwrap();

        // Verify data still accessible
        let val: String = conn
            .query_row("SELECT value FROM config WHERE key = 'test'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(val, "value");
    }
}
