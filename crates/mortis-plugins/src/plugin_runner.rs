//! Plugin runner with panic catching — §5.2
//!
//! "Plugin panics are caught by the Orchestrator and treated as phase failures."

use std::future::Future;
use std::time::Duration;
use tokio::time::timeout;
use tracing::error;

/// Run a plugin future with panic catching and timeout.
/// Returns Ok(result) or PluginRunError.
pub async fn run_plugin_with_guard<F, T>(
    plugin_name: &str,
    timeout_duration: Duration,
    future: F,
) -> Result<T, PluginRunError>
where
    F: Future<Output = T> + Send + 'static,
    T: Send + 'static,
{
    // Wrap in tokio::task::spawn to catch panics
    let handle = tokio::task::spawn(future);

    match timeout(timeout_duration, handle).await {
        Ok(Ok(result)) => Ok(result),
        Ok(Err(join_err)) => {
            if join_err.is_panic() {
                let panic_msg = extract_panic_message(join_err);
                error!(plugin = plugin_name, panic = %panic_msg, "plugin panicked");
                Err(PluginRunError::Panic {
                    plugin: plugin_name.to_string(),
                    message: panic_msg,
                })
            } else {
                Err(PluginRunError::Cancelled {
                    plugin: plugin_name.to_string(),
                })
            }
        }
        Err(_elapsed) => {
            error!(plugin = plugin_name, "plugin timed out");
            Err(PluginRunError::Timeout {
                plugin: plugin_name.to_string(),
                timeout_ms: timeout_duration.as_millis() as u64,
            })
        }
    }
}

fn extract_panic_message(err: tokio::task::JoinError) -> String {
    match err.try_into_panic() {
        Ok(panic) => {
            if let Some(s) = panic.downcast_ref::<&str>() {
                s.to_string()
            } else if let Some(s) = panic.downcast_ref::<String>() {
                s.clone()
            } else {
                "unknown panic".to_string()
            }
        }
        Err(_) => "task cancelled".to_string(),
    }
}

#[derive(Debug, thiserror::Error)]
pub enum PluginRunError {
    #[error("plugin {plugin} panicked: {message}")]
    Panic { plugin: String, message: String },
    #[error("plugin {plugin} timed out after {timeout_ms}ms")]
    Timeout { plugin: String, timeout_ms: u64 },
    #[error("plugin {plugin} was cancelled")]
    Cancelled { plugin: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn normal_completion() {
        let result = run_plugin_with_guard("test", Duration::from_secs(5), async { 42 })
            .await
            .unwrap();
        assert_eq!(result, 42);
    }

    #[tokio::test]
    async fn timeout_enforced() {
        let result = run_plugin_with_guard("slow", Duration::from_millis(50), async {
            tokio::time::sleep(Duration::from_secs(10)).await;
            42
        })
        .await;
        assert!(matches!(result, Err(PluginRunError::Timeout { .. })));
    }

    #[tokio::test]
    async fn panic_caught() {
        let result = run_plugin_with_guard("panicker", Duration::from_secs(5), async {
            panic!("oh no!");
        })
        .await;
        assert!(matches!(result, Err(PluginRunError::Panic { .. })));
    }
}
