use chrono::Utc;
use mortis_types::trigger::*;
use tracing::{debug, info};

pub struct TriggerManager {
    triggers: Vec<ManagedTrigger>,
}

struct ManagedTrigger {
    name: String,
    trigger_type: TriggerType,
    confidence_threshold: f32,
    enabled: bool,
}

impl TriggerManager {
    pub fn new() -> Self {
        Self { triggers: Vec::new() }
    }

    pub fn add(&mut self, name: String, tt: TriggerType) {
        self.triggers.push(ManagedTrigger {
            name,
            trigger_type: tt,
            confidence_threshold: 0.8,
            enabled: true,
        });
    }

    pub fn evaluate_all(&self) -> Option<TriggerEvaluation> {
        let ctx = TriggerContext {
            current_time: Utc::now(),
            environment: std::env::vars().collect(),
            last_checkin: None,
            network_interfaces: Vec::new(),
            disk_usage_percent: 0.0,
        };

        for t in &self.triggers {
            if !t.enabled { continue; }
            let eval = evaluate(&t.trigger_type, &ctx);
            debug!(trigger = %t.name, fire = eval.should_fire, conf = eval.confidence, reason = %eval.reason);
            if eval.should_fire && eval.confidence >= t.confidence_threshold {
                info!(trigger = %t.name, "trigger fired");
                return Some(eval);
            }
        }
        None
    }

    pub fn disable(&mut self, name: &str) {
        for t in &mut self.triggers {
            if t.name == name {
                t.enabled = false;
            }
        }
    }

    pub fn enable(&mut self, name: &str) {
        for t in &mut self.triggers {
            if t.name == name {
                t.enabled = true;
            }
        }
    }

    pub fn list(&self) -> Vec<(&str, &TriggerType, bool)> {
        self.triggers.iter().map(|t| (t.name.as_str(), &t.trigger_type, t.enabled)).collect()
    }
}

fn evaluate(tt: &TriggerType, ctx: &TriggerContext) -> TriggerEvaluation {
    match tt {
        TriggerType::Manual => TriggerEvaluation {
            should_fire: false,
            confidence: 1.0,
            reason: "manual: requires explicit invocation".to_string(),
            evaluated_at: ctx.current_time,
        },
        TriggerType::Scheduled(cron_expr) => {
            match cron_expr.parse::<cron::Schedule>() {
                Ok(sched) => {
                    let now = ctx.current_time;
                    let window = now - chrono::Duration::minutes(1);
                    if let Some(prev) = sched.after(&window).next() {
                        if prev <= now {
                            return TriggerEvaluation {
                                should_fire: true,
                                confidence: 1.0,
                                reason: format!("cron matched: {}", cron_expr),
                                evaluated_at: now,
                            };
                        }
                    }
                    TriggerEvaluation {
                        should_fire: false,
                        confidence: 1.0,
                        reason: "cron not due".to_string(),
                        evaluated_at: now,
                    }
                }
                Err(e) => TriggerEvaluation {
                    should_fire: false,
                    confidence: 0.0,
                    reason: format!("bad cron: {}", e),
                    evaluated_at: ctx.current_time,
                },
            }
        }
        TriggerType::Environmental(EnvCondition::DiskFull { threshold_percent }) => {
            let usage = ctx.disk_usage_percent;
            TriggerEvaluation {
                should_fire: usage >= *threshold_percent as f64,
                confidence: 1.0,
                reason: format!("disk {:.1}% threshold {}%", usage, threshold_percent),
                evaluated_at: ctx.current_time,
            }
        }
        TriggerType::Environmental(EnvCondition::NetworkChange) => TriggerEvaluation {
            should_fire: false,
            confidence: 0.0,
            reason: "network change: not implemented".to_string(),
            evaluated_at: ctx.current_time,
        },
        TriggerType::Environmental(EnvCondition::Geofence { .. }) => TriggerEvaluation {
            should_fire: false,
            confidence: 0.0,
            reason: "geofence: not implemented".to_string(),
            evaluated_at: ctx.current_time,
        },
        TriggerType::RemoteSignal(_) => TriggerEvaluation {
            should_fire: false,
            confidence: 0.0,
            reason: "remote signal: no signal received".to_string(),
            evaluated_at: ctx.current_time,
        },
        TriggerType::DeadManSwitch(secs) => {
            if let Some(last) = ctx.last_checkin {
                let elapsed = (ctx.current_time - last).num_seconds();
                TriggerEvaluation {
                    should_fire: elapsed > *secs,
                    confidence: 1.0,
                    reason: format!("dead man switch: {}s elapsed / {}s threshold", elapsed, secs),
                    evaluated_at: ctx.current_time,
                }
            } else {
                TriggerEvaluation {
                    should_fire: false,
                    confidence: 0.0,
                    reason: "dead man switch: no checkin recorded".to_string(),
                    evaluated_at: ctx.current_time,
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manual_never_auto_fires() {
        let mut mgr = TriggerManager::new();
        mgr.add("manual".to_string(), TriggerType::Manual);
        assert!(mgr.evaluate_all().is_none());
    }

    #[test]
    fn list_triggers() {
        let mut mgr = TriggerManager::new();
        mgr.add("a".to_string(), TriggerType::Manual);
        mgr.add("b".to_string(), TriggerType::Scheduled("0 0 * * * *".to_string()));
        assert_eq!(mgr.list().len(), 2);
    }

    #[test]
    fn disable_enable() {
        let mut mgr = TriggerManager::new();
        mgr.add("t".to_string(), TriggerType::Manual);
        mgr.disable("t");
        assert!(!mgr.list()[0].2);
        mgr.enable("t");
        assert!(mgr.list()[0].2);
    }
}
