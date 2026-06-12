use chrono::Utc;
use rusqlite::{params, Connection, Result};

pub fn get_config(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM config WHERE key=?1")?;
    let mut rows = stmt.query_map(params![key], |r| r.get(0))?;
    match rows.next() {
        Some(r) => Ok(Some(r?)),
        None => Ok(None),
    }
}

pub fn set_config(conn: &Connection, key: &str, value: &str, sensitive: bool) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR REPLACE INTO config (key,value,is_sensitive,updated_at) VALUES (?1,?2,?3,?4)",
        params![key, value, sensitive as i32, now],
    )?;
    Ok(())
}

pub fn delete_config(conn: &Connection, key: &str) -> Result<bool> {
    Ok(conn.execute("DELETE FROM config WHERE key=?1", params![key])? > 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{initialize_schema, open_memory_database};

    #[test]
    fn roundtrip() {
        let conn = open_memory_database().unwrap();
        initialize_schema(&conn).unwrap();
        set_config(&conn, "k", "v", false).unwrap();
        assert_eq!(get_config(&conn, "k").unwrap(), Some("v".to_string()));
    }

    #[test]
    fn delete() {
        let conn = open_memory_database().unwrap();
        initialize_schema(&conn).unwrap();
        set_config(&conn, "k", "v", false).unwrap();
        assert!(delete_config(&conn, "k").unwrap());
        assert_eq!(get_config(&conn, "k").unwrap(), None);
    }
}
