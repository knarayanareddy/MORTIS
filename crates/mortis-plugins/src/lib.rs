//! §CANONICAL — §5.2 Plugin Trait Contracts
//!
//! Plugin rules:
//! - Plugins must NEVER access InventoryDB or ReceiptEngine directly.
//! - Plugins must NEVER call std::process::exit.
//! - Plugin panics are caught by the Orchestrator and treated as phase failures.
//! - Plugins must not spawn long-lived background threads.
//! - All network I/O must go through the injected client.

pub mod traits;
pub mod sanitization;
pub mod deletion;
pub mod plugin_runner;

pub use traits::*;
pub use plugin_runner::*;
