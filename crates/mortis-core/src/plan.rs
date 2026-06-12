use mortis_types::plan::*;
use serde::Deserialize;
use std::path::Path;
use uuid::Uuid;

#[derive(Debug, thiserror::Error)]
pub enum PlanError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("toml: {0}")]
    Toml(#[from] toml::de::Error),
    #[error("invalid: {0}")]
    Invalid(String),
}

#[derive(Deserialize)]
struct PlanFile {
    plan: PlanMeta,
    phases: Vec<PhaseConfig>,
}

#[derive(Deserialize)]
struct PlanMeta {
    name: String,
    description: Option<String>,
    is_default: Option<bool>,
}

#[derive(Deserialize)]
struct PhaseConfig {
    phase_type: String,
    asset_ids: Vec<String>,
    continue_on_failure: Option<bool>,
}

pub fn load_plan(path: &Path) -> Result<Plan, PlanError> {
    let content = std::fs::read_to_string(path)?;
    let pf: PlanFile = toml::from_str(&content)?;
    parse_plan(pf)
}

fn parse_plan(pf: PlanFile) -> Result<Plan, PlanError> {
    let mut phases = Vec::new();
    for (i, pc) in pf.phases.iter().enumerate() {
        let pt = PhaseType::from_str_opt(&pc.phase_type)
            .ok_or_else(|| PlanError::Invalid(format!("unknown phase type: {}", pc.phase_type)))?;
        let ids: Vec<Uuid> = pc
            .asset_ids
            .iter()
            .map(|s| Uuid::parse_str(s).map_err(|e| PlanError::Invalid(e.to_string())))
            .collect::<Result<Vec<_>, _>>()?;
        phases.push(PlanPhase {
            id: Uuid::new_v4(),
            phase_order: i as i32,
            phase_type: pt,
            asset_ids: ids,
            continue_on_failure: pc.continue_on_failure.unwrap_or(true),
        });
    }
    if phases.is_empty() {
        return Err(PlanError::Invalid("plan has no phases".to_string()));
    }
    Ok(Plan {
        id: Uuid::new_v4(),
        name: pf.plan.name,
        description: pf.plan.description,
        is_default: pf.plan.is_default.unwrap_or(false),
        phases,
        created_at: chrono::Utc::now(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_plan() {
        let toml = r#"
[plan]
name = "test"
description = "test plan"

[[phases]]
phase_type = "sanitize_local"
asset_ids = ["00000000-0000-0000-0000-000000000001"]
continue_on_failure = true
"#;
        let pf: PlanFile = toml::from_str(toml).unwrap();
        let plan = parse_plan(pf).unwrap();
        assert_eq!(plan.name, "test");
        assert_eq!(plan.phases.len(), 1);
        assert_eq!(plan.phases[0].phase_type, PhaseType::SanitizeLocal);
    }

    #[test]
    fn invalid_phase_type() {
        let toml = r#"
[plan]
name = "x"

[[phases]]
phase_type = "bogus"
asset_ids = ["00000000-0000-0000-0000-000000000001"]
"#;
        let pf: PlanFile = toml::from_str(toml).unwrap();
        assert!(parse_plan(pf).is_err());
    }

    #[test]
    fn empty_phases() {
        let toml = r#"
[plan]
name = "x"

[[phases]]
phase_type = "sanitize_local"
asset_ids = []
"#;
        let pf: PlanFile = toml::from_str(toml).unwrap();
        // Empty asset_ids is valid, but plan needs at least one phase
        let plan = parse_plan(pf).unwrap();
        assert_eq!(plan.phases.len(), 1);
    }
}
