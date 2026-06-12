use mortis_types::receipt::*;
use rusqlite::{params, Connection, Result};
use uuid::Uuid;

pub fn save_receipt(conn: &Connection, receipt: &Receipt, json_path: Option<&str>) -> Result<()> {
    let sig_json = receipt.signature.as_ref().map(|s| serde_json::to_string(s).unwrap_or_default());

    // Only set plan_id if it exists in the plans table
    let plan_id_str = receipt.header.plan_id.map(|id| id.to_string());
    let plan_id_valid = if let Some(ref pid) = plan_id_str {
        conn.query_row(
            "SELECT COUNT(*) FROM plans WHERE id = ?1",
            params![pid],
            |r| r.get::<_, i32>(0),
        ).unwrap_or(0) > 0
    } else {
        false
    };

    conn.execute(
        "INSERT OR REPLACE INTO receipts
         (run_id,schema_version,plan_id,triggered_by,dry_run,coercion,overall_result,
          phases_total,phases_succeeded,phases_failed,bytes_processed,
          started_at,completed_at,signature,rfc3161_token,receipt_json_path)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)",
        params![
            receipt.header.run_id.to_string(),
            receipt.header.schema_version,
            if plan_id_valid { plan_id_str } else { None },
            receipt.header.triggered_by,
            receipt.header.dry_run as i32,
            receipt.header.coercion as i32,
            receipt.summary.overall_result,
            receipt.summary.phases_total,
            receipt.summary.phases_succeeded,
            receipt.summary.phases_failed,
            receipt.summary.bytes_processed as i64,
            receipt.header.started_at.to_rfc3339(),
            receipt.header.completed_at.map(|dt| dt.to_rfc3339()),
            sig_json,
            receipt.rfc3161_token,
            json_path,
        ],
    )?;

    for phase in &receipt.phases {
        let pid = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO receipt_phases
             (id,run_id,phase_order,phase_type,plugin_name,asset_id,result,best_effort,bytes_processed,duration_ms,evidence,error,recorded_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
            params![
                pid,
                receipt.header.run_id.to_string(),
                phase.phase_order,
                phase.phase_type,
                phase.plugin_name,
                phase.asset_id.map(|id| id.to_string()),
                phase.result,
                phase.best_effort as i32,
                phase.bytes_processed as i64,
                phase.duration_ms.map(|ms| ms as i64),
                phase.evidence,
                phase.error,
                phase.recorded_at.to_rfc3339(),
            ],
        )?;
    }

    Ok(())
}

#[derive(Debug, serde::Serialize)]
pub struct ReceiptRow {
    pub run_id: String,
    pub overall_result: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub triggered_by: String,
    pub dry_run: bool,
}

pub fn get_receipt(conn: &Connection, run_id: &str) -> Result<Option<ReceiptRow>> {
    let mut stmt = conn.prepare(
        "SELECT run_id,overall_result,started_at,completed_at,triggered_by,dry_run FROM receipts WHERE run_id=?1",
    )?;
    let mut rows = stmt.query_map(params![run_id], |r| {
        Ok(ReceiptRow {
            run_id: r.get(0)?,
            overall_result: r.get(1)?,
            started_at: r.get(2)?,
            completed_at: r.get(3)?,
            triggered_by: r.get(4)?,
            dry_run: r.get::<_, i32>(5)? != 0,
        })
    })?;
    match rows.next() {
        Some(r) => Ok(Some(r?)),
        None => Ok(None),
    }
}

pub fn list_receipts(conn: &Connection, limit: i32) -> Result<Vec<ReceiptRow>> {
    let mut stmt = conn.prepare(
        "SELECT run_id,overall_result,started_at,completed_at,triggered_by,dry_run
         FROM receipts ORDER BY started_at DESC LIMIT ?1",
    )?;
    let rows = stmt
        .query_map(params![limit], |r| {
            Ok(ReceiptRow {
                run_id: r.get(0)?,
                overall_result: r.get(1)?,
                started_at: r.get(2)?,
                completed_at: r.get(3)?,
                triggered_by: r.get(4)?,
                dry_run: r.get::<_, i32>(5)? != 0,
            })
        })?
        .collect::<Result<Vec<_>>>()?;
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{initialize_schema, open_memory_database};
    use chrono::Utc;
    use mortis_types::receipt::{Receipt, ReceiptHeader, ReceiptPhase, ReceiptSummary};

    fn make_test_receipt() -> Receipt {
        Receipt {
            header: ReceiptHeader {
                run_id: Uuid::new_v4(),
                schema_version: "1.0".to_string(),
                triggered_by: "test".to_string(),
                dry_run: false,
                coercion: false,
                plan_id: None,
                started_at: Utc::now(),
                completed_at: Some(Utc::now()),
            },
            phases: vec![ReceiptPhase {
                phase_order: 0,
                phase_type: "sanitize_local".to_string(),
                plugin_name: Some("FileOverwritePlugin".to_string()),
                asset_id: Some(Uuid::new_v4()),
                result: "success".to_string(),
                best_effort: false,
                bytes_processed: 512,
                duration_ms: Some(100),
                evidence: None,
                error: None,
                recorded_at: Utc::now(),
            }],
            summary: ReceiptSummary {
                overall_result: "success".to_string(),
                phases_total: 1,
                phases_succeeded: 1,
                phases_failed: 0,
                bytes_processed: 512,
            },
            signature: None,
            rfc3161_token: None,
        }
    }

    #[test]
    fn save_and_get_receipt() {
        let conn = open_memory_database().unwrap();
        initialize_schema(&conn).unwrap();

        let receipt = make_test_receipt();
        let run_id = receipt.header.run_id.to_string();

        save_receipt(&conn, &receipt, None).unwrap();
        let row = get_receipt(&conn, &run_id).unwrap().unwrap();
        assert_eq!(row.overall_result, "success");
    }

    #[test]
    fn list_receipts_works() {
        let conn = open_memory_database().unwrap();
        initialize_schema(&conn).unwrap();

        for _ in 0..3 {
            save_receipt(&conn, &make_test_receipt(), None).unwrap();
        }

        let rows = list_receipts(&conn, 10).unwrap();
        assert_eq!(rows.len(), 3);
    }
}
