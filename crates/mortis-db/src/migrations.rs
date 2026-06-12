use rusqlite::{Connection, Result};
use tracing::info;

pub const CURRENT_VERSION: i32 = 1;

pub fn get_applied_version(conn: &Connection) -> Result<i32> {
    let v: Option<i32> =
        conn.query_row("SELECT MAX(version) FROM schema_migrations", [], |r| r.get(0))?;
    Ok(v.unwrap_or(0))
}

pub fn apply_migrations(conn: &Connection) -> Result<i32> {
    let current = get_applied_version(conn)?;
    info!(current, target = CURRENT_VERSION, "checking migrations");

    if current < 1 {
        conn.execute("INSERT OR IGNORE INTO schema_migrations (version) VALUES (1)", [])?;
    }

    let new = get_applied_version(conn)?;
    info!(new, "migrations applied");
    Ok(new)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{initialize_schema, open_memory_database};

    #[test]
    fn migration_versioning() {
        let conn = open_memory_database().unwrap();
        initialize_schema(&conn).unwrap();

        assert_eq!(get_applied_version(&conn).unwrap(), 0);
        assert_eq!(apply_migrations(&conn).unwrap(), 1);
        assert_eq!(get_applied_version(&conn).unwrap(), 1);
    }
}
