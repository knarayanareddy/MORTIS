use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TriggerType {
    Manual,
    Scheduled(String),
    Environmental(EnvCondition),
    RemoteSignal(SignalSource),
    DeadManSwitch(i64),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EnvCondition {
    DiskFull { threshold_percent: u8 },
    NetworkChange,
    Geofence { lat: f64, lon: f64, radius_m: f64 },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SignalSource {
    Sms,
    Signal,
    Webhook { url: String },
    EmailKeyword { keyword: String },
}

#[derive(Debug, Clone)]
pub struct TriggerEvaluation {
    pub should_fire: bool,
    pub confidence: f32,
    pub reason: String,
    pub evaluated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct TriggerContext {
    pub current_time: DateTime<Utc>,
    pub environment: HashMap<String, String>,
    pub last_checkin: Option<DateTime<Utc>>,
    pub network_interfaces: Vec<String>,
    pub disk_usage_percent: f64,
}
