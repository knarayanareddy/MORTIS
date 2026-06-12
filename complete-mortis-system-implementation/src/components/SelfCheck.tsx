import { useState } from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import { SELF_CHECK_RESULTS, SYSTEM_METRICS, formatBytes } from '../data/mortisData';

const CI_GATES = [
  { gate: 'Compile (Linux/macOS/Windows)', tool: 'cargo build', blocking: true, status: 'pass' },
  { gate: 'Unit + integration tests', tool: 'cargo test', blocking: true, status: 'pass' },
  { gate: 'E2E tests', tool: 'cargo test --test e2e', blocking: true, status: 'pass' },
  { gate: 'Linting', tool: 'cargo clippy -- -D warnings', blocking: true, status: 'pass' },
  { gate: 'Formatting', tool: 'cargo fmt --check', blocking: true, status: 'pass' },
  { gate: 'Dependency audit', tool: 'cargo audit', blocking: true, status: 'pass' },
  { gate: 'License check', tool: 'cargo deny check', blocking: true, status: 'pass' },
  { gate: 'MSRV (1.75.0)', tool: 'cargo +1.75.0 build', blocking: true, status: 'pass' },
  { gate: 'Dry-run safety', tool: 'E2E harness', blocking: true, status: 'pass' },
  { gate: 'Receipt tamper detection', tool: 'Integration test', blocking: true, status: 'pass' },
  { gate: 'Reproducible build', tool: 'Two builds, same hash', blocking: true, status: 'pass' },
];

export default function SelfCheck() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(SELF_CHECK_RESULTS);
  const [runCount, setRunCount] = useState(0);
  const [completedChecks, setCompletedChecks] = useState<number[]>(SELF_CHECK_RESULTS.map((_, i) => i));

  const handleRun = async () => {
    setRunning(true);
    setCompletedChecks([]);
    const newResults = results.map(r => ({ ...r }));

    for (let i = 0; i < newResults.length; i++) {
      await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
      newResults[i].duration_ms = Math.floor(Math.random() * 400) + 1;
      newResults[i].passed = Math.random() > 0.02;
      setCompletedChecks(prev => [...prev, i]);
      setResults([...newResults]);
    }

    setRunning(false);
    setRunCount(c => c + 1);
  };

  const allPassed = results.every(r => r.passed);
  const passCount = results.filter(r => r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0);

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }} className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: '#f5f5f7' }}>Self-Check</h1>
          <p style={{ color: '#86868b', fontSize: 13, marginTop: 4 }}>
            SLO benchmark verification · Integrity checks · CI quality gates
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={handleRun}
          disabled={running}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} style={{ animation: running ? 'spin 1s linear infinite' : undefined }} />
          {running ? 'Running...' : 'Run Self-Check'}
        </button>
      </div>

      {/* Overall status */}
      <div style={{
        padding: '20px 24px',
        background: allPassed ? 'rgba(48,209,88,0.06)' : 'rgba(229,9,20,0.06)',
        border: `1px solid ${allPassed ? 'rgba(48,209,88,0.2)' : 'rgba(229,9,20,0.2)'}`,
        borderRadius: 14,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: allPassed ? 'rgba(48,209,88,0.12)' : 'rgba(229,9,20,0.12)' }}>
          {allPassed ? <CheckCircle size={24} color="#30d158" /> : <AlertTriangle size={24} color="#ff453a" />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: allPassed ? '#30d158' : '#ff453a' }}>
            {allPassed ? 'All SLOs met ✅' : `${passCount}/${results.length} checks passed`}
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#86868b', marginTop: 4 }}>
            MORTIS Self-Check v0.1.0 · {totalDuration}ms total · {passCount}/{results.length} passed
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#48484a' }}>Runs this session</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f5f5f7' }}>{runCount}</div>
        </div>
      </div>

      {/* Self-check results */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f7', marginBottom: 18 }}>SLO Benchmarks</div>

        {/* Terminal output */}
        <div className="terminal" style={{ marginBottom: 16 }}>
          <div className="terminal-header">
            <div className="terminal-dot" style={{ background: '#ff5f56' }} />
            <div className="terminal-dot" style={{ background: '#ffbd2e' }} />
            <div className="terminal-dot" style={{ background: '#27c93f' }} />
            <span style={{ fontSize: 11, color: '#48484a', marginLeft: 8 }}>mortis self-check</span>
          </div>
          <div className="terminal-body">
            <div style={{ color: '#c9d1d9', marginBottom: 4 }}>MORTIS Self-Check v0.1.0</div>
            <div style={{ color: '#c9d1d9', marginBottom: 8 }}>=========================================</div>
            {results.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2, opacity: completedChecks.includes(i) ? 1 : 0.3 }}>
                <span style={{ color: '#86868b', minWidth: 180 }}>{r.check}:</span>
                <span style={{ color: '#86868b' }}>{r.duration_ms}ms</span>
                <span style={{ color: r.passed ? '#56d364' : '#f85149' }}>{r.passed ? '✅' : '❌'}</span>
              </div>
            ))}
            {!running && (
              <>
                <div style={{ color: '#c9d1d9', marginTop: 8 }}>=========================================</div>
                <div style={{ color: allPassed ? '#56d364' : '#f85149', marginTop: 4 }}>
                  {allPassed ? 'all SLOs met ✅' : `${results.length - passCount} checks failed ❌`}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Visual cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {results.map((r, i) => (
            <div key={i} style={{
              padding: '12px 14px',
              background: completedChecks.includes(i)
                ? r.passed ? 'rgba(48,209,88,0.04)' : 'rgba(229,9,20,0.06)'
                : 'rgba(255,255,255,0.02)',
              border: `1px solid ${completedChecks.includes(i)
                ? r.passed ? 'rgba(48,209,88,0.15)' : 'rgba(229,9,20,0.2)'
                : 'rgba(255,255,255,0.04)'}`,
              borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 10,
              opacity: completedChecks.includes(i) ? 1 : 0.4,
              transition: 'all 0.3s',
            }}>
              {completedChecks.includes(i) ? (
                r.passed ? <CheckCircle size={14} color="#30d158" /> : <XCircle size={14} color="#ff453a" />
              ) : (
                <Clock size={14} color="#48484a" />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#c7c7cc' }}>{r.check}</div>
                {completedChecks.includes(i) && (
                  <div style={{ fontSize: 10, color: '#48484a', marginTop: 2 }}>{r.duration_ms}ms</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System metrics */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f7', marginBottom: 18 }}>System Metrics</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { label: 'Total Runs', value: String(SYSTEM_METRICS.total_runs), sub: 'All time' },
            { label: 'Success Rate', value: `${Math.round((SYSTEM_METRICS.successful_runs / SYSTEM_METRICS.total_runs) * 100)}%`, sub: `${SYSTEM_METRICS.successful_runs} successful` },
            { label: 'Data Processed', value: formatBytes(SYSTEM_METRICS.total_bytes_processed), sub: 'Across all runs' },
            { label: 'Database Size', value: formatBytes(SYSTEM_METRICS.db_size_bytes), sub: 'SQLCipher encrypted' },
            { label: 'Total Assets', value: String(SYSTEM_METRICS.total_assets), sub: `${SYSTEM_METRICS.active_assets} active` },
            { label: 'Receipts Stored', value: String(SYSTEM_METRICS.receipts_count), sub: 'Signed + persisted' },
          ].map((m, i) => (
            <div key={i} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12 }}>
              <div style={{ fontSize: 10, color: '#48484a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#f5f5f7', marginTop: 6 }}>{m.value}</div>
              <div style={{ fontSize: 11, color: '#48484a', marginTop: 2 }}>{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CI quality gates */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f7', marginBottom: 4 }}>CI Quality Gates</div>
        <div style={{ fontSize: 12, color: '#86868b', marginBottom: 18 }}>All 11 gates must pass before merge</div>
        <table className="data-table">
          <thead>
            <tr><th>Gate</th><th>Tool</th><th>Blocking</th><th>Status</th></tr>
          </thead>
          <tbody>
            {CI_GATES.map((g, i) => (
              <tr key={i}>
                <td><span style={{ fontSize: 12, color: '#c7c7cc' }}>{g.gate}</span></td>
                <td><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#86868b' }}>{g.tool}</span></td>
                <td>
                  <span style={{ fontSize: 11, fontWeight: 600, color: g.blocking ? '#ff9f0a' : '#86868b' }}>
                    {g.blocking ? 'Yes' : 'No'}
                  </span>
                </td>
                <td><CheckCircle size={14} color="#30d158" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Plugin example */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f7', marginBottom: 16 }}>Adding a Custom Plugin</div>
        <div className="terminal">
          <div className="terminal-header">
            <div className="terminal-dot" style={{ background: '#ff5f56' }} />
            <div className="terminal-dot" style={{ background: '#ffbd2e' }} />
            <div className="terminal-dot" style={{ background: '#27c93f' }} />
            <span style={{ fontSize: 11, color: '#48484a', marginLeft: 8 }}>my_plugin.rs</span>
          </div>
          <div className="terminal-body" style={{ fontSize: 12 }}>
            {[
              { text: 'use async_trait::async_trait;', color: '#c9d1d9' },
              { text: 'use mortis_plugins::traits::*;', color: '#c9d1d9' },
              { text: '', color: '#c9d1d9' },
              { text: 'pub struct MyPlugin;', color: '#79c0ff' },
              { text: '', color: '#c9d1d9' },
              { text: '#[async_trait]', color: '#ff9f0a' },
              { text: 'impl SanitizationPlugin for MyPlugin {', color: '#c9d1d9' },
              { text: '    fn name(&self) -> &str { "MyPlugin" }', color: '#c9d1d9' },
              { text: '', color: '#c9d1d9' },
              { text: '    fn supported_media_types(&self) -> &[MediaType] {', color: '#c9d1d9' },
              { text: '        &[MediaType::Generic]', color: '#a5d6ff' },
              { text: '    }', color: '#c9d1d9' },
              { text: '', color: '#c9d1d9' },
              { text: '    async fn sanitize(', color: '#c9d1d9' },
              { text: '        &self, asset: &Asset,', color: '#c9d1d9' },
              { text: '        method: &SanitizationMethod,', color: '#c9d1d9' },
              { text: '        dry_run: bool,', color: '#c9d1d9' },
              { text: '    ) -> Result<SanitizationResult, SanitizationError> {', color: '#c9d1d9' },
              { text: '        if dry_run { /* return preview */ }', color: '#6a737d' },
              { text: '        // actual sanitization logic...', color: '#6a737d' },
              { text: '        Ok(SanitizationResult { success: true, .. })', color: '#56d364' },
              { text: '    }', color: '#c9d1d9' },
              { text: '}', color: '#c9d1d9' },
              { text: '', color: '#c9d1d9' },
              { text: '// Register in orchestrator:', color: '#6a737d' },
              { text: 'orch.add_sanitization_plugin(Box::new(MyPlugin));', color: '#79c0ff' },
            ].map((line, i) => (
              <div key={i} style={{ color: line.color }}>{line.text || '\u00A0'}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
