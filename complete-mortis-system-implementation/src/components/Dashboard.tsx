import { useState, useEffect } from 'react';
import {
  Shield, Database, FileText, Zap, CheckCircle, AlertTriangle,
  TrendingUp, Activity, Lock, Server, Cpu
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  SYSTEM_METRICS, RECEIPTS, TRIGGERS, ACTIVITY_DATA,
  formatBytes, formatDate, formatRelative
} from '../data/mortisData';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#141414',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
      }}>
        <div style={{ color: '#86868b', marginBottom: 4 }}>{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const latestReceipts = RECEIPTS.slice(0, 3);
  const activeTriggers = TRIGGERS.filter(t => t.enabled).length;
  const successRate = Math.round((SYSTEM_METRICS.successful_runs / SYSTEM_METRICS.total_runs) * 100);

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 28 }} className="animate-fade-in">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', color: '#f5f5f7' }}>
            Control Center
          </h1>
          <p style={{ color: '#86868b', fontSize: 14, marginTop: 4 }}>
            MORTIS · Machine-Operated Responsive Total Infrastructure Sanitizer
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700, color: '#f5f5f7', letterSpacing: '-0.02em' }}>
            {time.toLocaleTimeString('en-US', { hour12: false })}
          </div>
          <div style={{ fontSize: 12, color: '#86868b', marginTop: 2 }}>
            {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      <div style={{
        background: 'rgba(229,9,20,0.06)',
        border: '1px solid rgba(229,9,20,0.18)',
        borderRadius: 12,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{ color: '#ffd60a', flexShrink: 0 }}>
          <AlertTriangle size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f7' }}>Dead Man's Switch active — </span>
          <span style={{ fontSize: 13, color: '#86868b' }}>Next check-in required within 16h 0m · Plan: cloud_revoke</span>
        </div>
        <div style={{
          padding: '4px 12px',
          background: 'rgba(229,9,20,0.12)',
          border: '1px solid rgba(229,9,20,0.2)',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          color: '#ff453a',
          cursor: 'pointer',
          flexShrink: 0,
        }}>
          Check In
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          {
            label: 'Total Assets',
            value: SYSTEM_METRICS.total_assets,
            sub: `${SYSTEM_METRICS.active_assets} active · ${SYSTEM_METRICS.sanitized_assets} sanitized`,
            icon: <Database size={18} />,
            color: '#0a84ff',
          },
          {
            label: 'Total Runs',
            value: SYSTEM_METRICS.total_runs,
            sub: `${successRate}% success rate`,
            icon: <Activity size={18} />,
            color: '#30d158',
          },
          {
            label: 'Data Processed',
            value: formatBytes(SYSTEM_METRICS.total_bytes_processed),
            sub: 'Across all sanitization runs',
            icon: <TrendingUp size={18} />,
            color: '#ff9f0a',
          },
          {
            label: 'Active Triggers',
            value: `${activeTriggers}/${TRIGGERS.length}`,
            sub: 'Monitoring for activation',
            icon: <Zap size={18} />,
            color: '#e50914',
          },
        ].map((m, i) => (
          <div key={i} className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div className="metric-label">{m.label}</div>
                <div className="metric-value" style={{ color: '#f5f5f7', marginTop: 8 }}>{m.value}</div>
                <div style={{ fontSize: 12, color: '#48484a', marginTop: 6 }}>{m.sub}</div>
              </div>
              <div style={{
                width: 36, height: 36,
                background: `${m.color}18`,
                border: `1px solid ${m.color}28`,
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: m.color, flexShrink: 0,
              }}>
                {m.icon}
              </div>
            </div>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: 2,
              background: `linear-gradient(90deg, ${m.color}40, ${m.color}00)`,
            }} />
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>

        {/* Activity Chart */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f7' }}>Execution Activity</div>
              <div style={{ fontSize: 12, color: '#86868b', marginTop: 2 }}>Last 7 days · runs + MB processed</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 11, color: '#86868b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#e50914', display: 'inline-block' }} /> Runs
              </span>
              <span style={{ fontSize: 11, color: '#86868b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#0a84ff', display: 'inline-block' }} /> MB
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={ACTIVITY_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="runsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e50914" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#e50914" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="bytesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0a84ff" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#0a84ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#48484a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#48484a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="runs" name="Runs" stroke="#e50914" strokeWidth={2} fill="url(#runsGrad)" dot={false} />
              <Area type="monotone" dataKey="bytes" name="MB" stroke="#0a84ff" strokeWidth={2} fill="url(#bytesGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Run breakdown */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f7', marginBottom: 6 }}>Run Results</div>
          <div style={{ fontSize: 12, color: '#86868b', marginBottom: 20 }}>All time breakdown</div>

          {[
            { label: 'Successful', value: SYSTEM_METRICS.successful_runs, total: SYSTEM_METRICS.total_runs, color: '#30d158' },
            { label: 'Partial', value: SYSTEM_METRICS.partial_runs, total: SYSTEM_METRICS.total_runs, color: '#ff9f0a' },
            { label: 'Failed', value: SYSTEM_METRICS.failed_runs, total: SYSTEM_METRICS.total_runs, color: '#ff453a' },
          ].map((item, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#86868b' }}>{item.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#f5f5f7' }}>
                  {item.value} <span style={{ color: '#48484a' }}>/ {item.total}</span>
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{
                  width: `${(item.value / item.total) * 100}%`,
                  background: `linear-gradient(90deg, ${item.color}, ${item.color}88)`,
                }} />
              </div>
            </div>
          ))}

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#86868b' }}>Receipts stored</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f5f5f7' }}>{SYSTEM_METRICS.receipts_count}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <span style={{ fontSize: 12, color: '#86868b' }}>DB size</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f5f5f7' }}>{formatBytes(SYSTEM_METRICS.db_size_bytes)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Recent Receipts */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f7', marginBottom: 16 }}>Recent Receipts</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {latestReceipts.map((r) => (
              <div key={r.run_id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: r.overall_result === 'success' ? 'rgba(48,209,88,0.1)' :
                    r.overall_result === 'partial' ? 'rgba(255,159,10,0.1)' :
                    r.dry_run ? 'rgba(10,132,255,0.1)' : 'rgba(229,9,20,0.1)',
                  border: `1px solid ${r.overall_result === 'success' ? 'rgba(48,209,88,0.2)' :
                    r.overall_result === 'partial' ? 'rgba(255,159,10,0.2)' :
                    r.dry_run ? 'rgba(10,132,255,0.2)' : 'rgba(229,9,20,0.2)'}`,
                }}>
                  {r.overall_result === 'success' ? <CheckCircle size={14} color="#30d158" /> :
                    r.overall_result === 'partial' ? <AlertTriangle size={14} color="#ff9f0a" /> :
                    r.dry_run ? <Shield size={14} color="#0a84ff" /> :
                    <AlertTriangle size={14} color="#ff453a" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f7', fontFamily: 'JetBrains Mono, monospace' }}>
                      {r.plan_name}
                    </span>
                    {r.dry_run && (
                      <span className="badge badge-blue" style={{ fontSize: 9 }}>DRY RUN</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#48484a', marginTop: 2 }}>
                    {formatRelative(r.completed_at)} · {r.triggered_by.replace('_', ' ')} · exit {r.exit_code}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: r.overall_result === 'success' ? '#30d158' : r.overall_result === 'partial' ? '#ff9f0a' : '#0a84ff' }}>
                    {r.overall_result === 'dry_run' ? 'DRY RUN' : r.overall_result.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 10, color: '#48484a', marginTop: 1 }}>{formatBytes(r.bytes_processed)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f7', marginBottom: 16 }}>System Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Core Engine', status: 'operational', icon: <Cpu size={14} /> },
              { label: 'Crypto Engine', status: 'operational', icon: <Lock size={14} /> },
              { label: 'Database (SQLCipher)', status: 'operational', icon: <Database size={14} /> },
              { label: 'Plugin Registry', status: 'operational', icon: <Server size={14} /> },
              { label: 'Trigger Manager', status: 'operational', icon: <Zap size={14} /> },
              { label: 'Receipt Engine', status: 'operational', icon: <FileText size={14} /> },
              { label: 'Passphrase Interlock', status: 'locked', icon: <Shield size={14} /> },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: '#86868b', flexShrink: 0 }}>{s.icon}</div>
                <span style={{ fontSize: 13, color: '#c7c7cc', flex: 1 }}>{s.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: s.status === 'operational' ? '#30d158' : '#ffd60a',
                    boxShadow: s.status === 'operational' ? '0 0 6px rgba(48,209,88,0.8)' : '0 0 6px rgba(255,214,10,0.8)',
                  }} />
                  <span style={{ fontSize: 11, color: s.status === 'operational' ? '#30d158' : '#ffd60a', fontWeight: 600 }}>
                    {s.status === 'operational' ? 'Operational' : 'Locked'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 11, color: '#48484a', marginBottom: 6 }}>Last run</div>
            <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#86868b' }}>
              {SYSTEM_METRICS.last_run ? formatDate(SYSTEM_METRICS.last_run) : 'Never'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
