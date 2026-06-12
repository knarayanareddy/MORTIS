use chrono::Utc;
use rusqlite::{params, Connection, Result};
use uuid::Uuid;

pub fn add_asset(
    conn: &Connection,
    asset_type: &str,
    path: Option<&str>,
    label: Option<&str>,
    service_id: Option<&str>,
    priority: i32,
    sanitization_override: Option<&str>,
    credential_id: Option<&str>,
    media_type: &str,
) -> Result<String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO assets (id,asset_type,path,label,service_id,priority,sanitization_override,credential_id,media_type,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
        params![id, asset_type, path, label, service_id, priority, sanitization_override, credential_id, media_type, now, now],
    )?;
    Ok(id)
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct AssetRow {
    pub id: String,
    pub asset_type: String,
    pub path: Option<String>,
    pub label: Option<String>,
    pub service_id: Option<String>,
    pub priority: i32,
    pub sanitization_override: Option<String>,
    pub credential_id: Option<String>,
    pub media_type: String,
    pub created_at: String,
    pub updated_at: String,
}

pub fn list_assets(conn: &Connection) -> Result<Vec<AssetRow>> {
    let mut stmt = conn.prepare(
        "SELECT id,asset_type,path,label,service_id,priority,sanitization_override,credential_id,media_type,created_at,updated_at
         FROM assets ORDER BY priority DESC, created_at ASC",
    )?;
    let rows = stmt
        .query_map([], |r| {
            Ok(AssetRow {
                id: r.get(0)?,
                asset_type: r.get(1)?,
                path: r.get(2)?,
                label: r.get(3)?,
                service_id: r.get(4)?,
                priority: r.get(5)?,
                sanitization_override: r.get(6)?,
                credential_id: r.get(7)?,
                media_type: r.get(8)?,
                created_at: r.get(9)?,
                updated_at: r.get(10)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn get_asset(conn: &Connection, id: &str) -> Result<Option<AssetRow>> {
    let mut stmt = conn.prepare(
        "SELECT id,asset_type,path,label,service_id,priority,sanitization_override,credential_id,media_type,created_at,updated_at
         FROM assets WHERE id=?1",
    )?;
    let mut rows = stmt.query_map(params![id], |r| {
        Ok(AssetRow {
            id: r.get(0)?,
            asset_type: r.get(1)?,
            path: r.get(2)?,
            label: r.get(3)?,
            service_id: r.get(4)?,
            priority: r.get(5)?,
            sanitization_override: r.get(6)?,
            credential_id: r.get(7)?,
            media_type: r.get(8)?,
            created_at: r.get(9)?,
            updated_at: r.get(10)?,
        })
    })?;
    match rows.next() {
        Some(r) => Ok(Some(r?)),
        None => Ok(None),
    }
}

pub fn remove_asset(conn: &Connection, id: &str) -> Result<bool> {
    Ok(conn.execute("DELETE FROM assets WHERE id=?1", params![id])? > 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{initialize_schema, open_memory_database};

    #[test]
    fn add_list_remove() {
        let conn = open_memory_database().unwrap();
        initialize_schema(&conn).unwrap();

        let id = add_asset(&conn, "local_file", Some("/tmp/x"), Some("test"), None, 100, None, None, "generic").unwrap();
        assert_eq!(list_assets(&conn).unwrap().len(), 1);

        let row = get_asset(&conn, &id).unwrap().unwrap();
        assert_eq!(row.path, Some("/tmp/x".to_string()));

        assert!(remove_asset(&conn, &id).unwrap());
        assert_eq!(list_assets(&conn).unwrap().len(), 0);
    }

    #[test]
    fn get_nonexistent_returns_none() {
        let conn = open_memory_database().unwrap();
        initialize_schema(&conn).unwrap();
        assert!(get_asset(&conn, "nonexistent").unwrap().is_none());
    }
}
