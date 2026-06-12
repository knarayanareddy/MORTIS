import { useState } from 'react';
import {
  CheckCircle, Shield,
  Clock, Search, X, Download,
  Hash, Key, Lock, Eye, Copy
} from 'lucide-react';
import {
  RECEIPTS, Receipt, phaseTypeLabel,
  formatDate, formatRelative, formatBytes
} from '../data/mortisData';

const RESULT_CONFIG: Record<string, { color: string; label: string }> = {
  success: { color: '#30d158', label: 'SUCCESS' },
  partial: { color: '#ff9f0a', label: 'PARTIAL' },
  failed: { color: '#ff453a', label: 'FAILED' },
  dry_run: { color: '#0a84ff', label: 'DRY RUN' },
  skipped: { color: '#86868b', label: 'SKIPPED' },
  running: { color: '#0a84ff', label: 'RUNNING' },
  pending: { color: '#48484a', label: 'PENDING' },
};

function ReceiptDetail({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  const [copied, setCopied] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'phases' | 'signature' | 'json'>('overview');

  const handleVerify = async () => {
    setVerifying(true);
    await new Promise(r => setTimeout(r, 1400));
    setVerified(true);
    setVerifying(false);
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const result = RESULT_CONFIG[receipt.overall_result] || RESULT_CONFIG.failed;

  const jsonObj = {
    header: {
      run_id: receipt.run_id,
      schema_version: receipt.schema_version,
      triggered_by: receipt.triggered_by,
      dry_run: receipt.dry_run,
      coercion: receipt.coercion,
      started_at: receipt.started_at,
      completed_at: receipt.completed_at,
    },
    phases: receipt.phases,
    summary: {
      overall_result: receipt.overall_result,
      phases_total: receipt.phases_total,
      phases_succeeded: receipt.phases_succeeded,
      phases_failed: receipt.phases_failed,
      bytes_processed: receipt.bytes_processed,
    },
    signature: receipt.signature,
    rfc3161_token: receipt.rfc3161_token,
  };

  const jsonPreview = JSON.stringify(jsonObj, null, 2);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, width: '100%' }}>
        <div style={{ padding: '22px 26px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f7' }}>Receipt Inspector</div>
                <span style={{
                  padding: '2px 8px', borderRadius: 100,
                  background: `${result.color}15`,
                  border: `1px solid ${result.color}30`,
                  color: result.color, fontSize: 10, fontWeight: 700,
                }}>
                  {result.label}
                </span>
                {receipt.dry_run && <span className="badge badge-blue">DRY RUN</span>}
                {receipt.coercion && <span className="badge badge-red">COERCION</span>}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#48484a', marginTop: 4 }}>
                {receipt.run_id}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86868b' }}><X size={18} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 26px', display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {(['overview', 'phases', 'signature', 'json'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '12px 14px',
                fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
                color: activeTab === tab ? '#f5f5f7' : '#86868b',
                borderBottom: activeTab === tab ? '2px solid #e50914' : '2px solid transparent',
                transition: 'all 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ padding: '22px 26px', maxHeight: '60vh', overflowY: 'auto' }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Plan', value: receipt.plan_name, mono: true },
                  { label: 'Exit Code', value: String(receipt.exit_code), mono: true },
                  { label: 'Triggered By', value: receipt.triggered_by.replace(/_/g, ' '), mono: false },
                  { label: 'Schema Version', value: receipt.schema_version, mono: true },
                  { label: 'Started', value: formatDate(receipt.started_at), mono: false },
                  { label: 'Completed', value: formatDate(receipt.completed_at), mono: false },
                  { label: 'Data Processed', value: formatBytes(receipt.bytes_processed), mono: false },
                  { label: 'RFC 3161 Timestamp', value: receipt.rfc3161_token ? 'Present' : 'None', mono: false },
                ].map((row, i) => (
                  <div key={i} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 10, color: '#48484a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{row.label}</div>
                    <div style={{ fontSize: 12, color: '#c7c7cc', fontFamily: row.mono ? 'JetBrains Mono, monospace' : undefined, fontWeight: 600 }}>
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  { label: 'Total', value: receipt.phases_total, color: '#86868b' },
                  { label: 'Succeeded', value: receipt.phases_succeeded, color: '#30d158' },
                  { label: 'Failed', value: receipt.phases_failed, color: '#ff453a' },
                  { label: 'Exit', value: receipt.exit_code, color: receipt.exit_code === 0 ? '#30d158' : '#ff9f0a' },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '12px', background: `${s.color}08`, borderRadius: 10, border: `1px solid ${s.color}15` }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: '#86868b', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'phases' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {receipt.phases.map((phase, i) => {
                const cfg = RESULT_CONFIG[phase.result] || RESULT_CONFIG.failed;
                return (
                  <div key={i} style={{
                    padding: '14px 16px',
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${cfg.color}15`,
                    borderRadius: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`,
                        color: cfg.color, fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {i}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#f5f5f7' }}>{phaseTypeLabel(phase.phase_type)}</span>
                      <span style={{ fontSize: 11, color: '#86868b', fontFamily: 'JetBrains Mono, monospace' }}>{'→'} {phase.plugin_name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 20, fontSize: 11 }}>
                      <span style={{ color: '#86868b' }}>Duration: <span style={{ color: '#f5f5f7', fontFamily: 'JetBrains Mono, monospace' }}>{phase.duration_ms}ms</span></span>
                      <span style={{ color: '#86868b' }}>Bytes: <span style={{ color: '#f5f5f7', fontFamily: 'JetBrains Mono, monospace' }}>{formatBytes(phase.bytes_processed)}</span></span>
                      <span style={{ color: '#86868b' }}>Assets: <span style={{ color: '#f5f5f7' }}>{phase.assets_affected}</span></span>
                    </div>
                    {phase.error && (
                      <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(229,9,20,0.06)', borderRadius: 6, fontSize: 11, color: '#ff453a', fontFamily: 'JetBrains Mono, monospace' }}>
                        {phase.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'signature' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                padding: '14px 16px',
                background: verified ? 'rgba(48,209,88,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${verified ? 'rgba(48,209,88,0.2)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  {verified ? <CheckCircle size={16} color="#30d158" /> : <Lock size={16} color="#86868b" />}
                  <span style={{ fontSize: 14, fontWeight: 700, color: verified ? '#30d158' : '#f5f5f7' }}>
                    {verified ? 'Signature Verified ✓' : 'Ed25519 Signature'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#86868b' }}>Algorithm: Ed25519 · RFC 8032</div>
              </div>

              {[
                { label: 'Algorithm', value: receipt.signature.algorithm, icon: <Key size={12} /> },
                { label: 'Public Key ID', value: receipt.signature.public_key_id, icon: <Key size={12} /> },
                { label: 'Body Hash (SHA-256)', value: receipt.signature.body_hash, icon: <Hash size={12} /> },
                { label: 'Signature Value', value: receipt.signature.value, icon: <Shield size={12} /> },
                { label: 'RFC 3161 Token', value: receipt.rfc3161_token || 'None', icon: <Clock size={12} /> },
              ].map((row, i) => (
                <div key={i} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ color: '#48484a' }}>{row.icon}</span>
                    <span style={{ fontSize: 10, color: '#48484a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{row.label}</span>
                    <button
                      onClick={() => copyText(row.value, row.label)}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: copied === row.label ? '#30d158' : '#48484a', fontSize: 10 }}
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#86868b', wordBreak: 'break-all' }}>
                    {row.value}
                  </div>
                </div>
              ))}

              <button className="btn-primary" onClick={handleVerify} disabled={verifying} style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                <Shield size={14} />
                {verifying ? 'Verifying...' : 'Verify Signature'}
              </button>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="terminal">
              <div className="terminal-header">
                <div className="terminal-dot" style={{ background: '#ff5f56' }} />
                <div className="terminal-dot" style={{ background: '#ffbd2e' }} />
                <div className="terminal-dot" style={{ background: '#27c93f' }} />
                <span style={{ fontSize: 11, color: '#48484a', marginLeft: 8 }}>{receipt.run_id.slice(0, 8)}.receipt.json</span>
                <button
                  onClick={() => copyText(jsonPreview, 'json')}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: copied === 'json' ? '#30d158' : '#48484a', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Copy size={11} /> {copied === 'json' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="terminal-body" style={{ fontSize: 11, maxHeight: '400px', overflowY: 'auto' }}>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#c9d1d9', margin: 0 }}>
                  {jsonPreview}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '14px 26px 20px', display: 'flex', gap: 10, borderTop: '1px solid rgba(255,255,255,0.04)', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Download size={12} /> Export JSON
          </button>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Receipts() {
  const [receipts] = useState(RECEIPTS);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Receipt | null>(null);

  const filtered = receipts.filter(r => {
    const matchSearch = r.run_id.includes(search) || r.plan_name.includes(search);
    const matchFilter = filter === 'all' ||
      (filter === 'success' && r.overall_result === 'success') ||
      (filter === 'partial' && r.overall_result === 'partial') ||
      (filter === 'dry_run' && r.dry_run) ||
      (filter === 'signed' && !!r.rfc3161_token);
    return matchSearch && matchFilter;
  });

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }} className="animate-fade-in">
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: '#f5f5f7' }}>Receipt Archive</h1>
        <p style={{ color: '#86868b', fontSize: 13, marginTop: 4 }}>
          Cryptographically signed destruction records · Ed25519 + RFC 3161
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total', value: receipts.length, color: '#86868b' },
          { label: 'Successful', value: receipts.filter(r => r.overall_result === 'success').length, color: '#30d158' },
          { label: 'Partial', value: receipts.filter(r => r.overall_result === 'partial').length, color: '#ff9f0a' },
          { label: 'With RFC 3161', value: receipts.filter(r => r.rfc3161_token).length, color: '#0a84ff' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#48484a', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#48484a' }} />
          <input className="input-field" style={{ paddingLeft: 36 }} placeholder="Search by run ID or plan name..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['all', 'success', 'partial', 'dry_run', 'signed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              background: filter === f ? 'rgba(229,9,20,0.12)' : 'rgba(255,255,255,0.04)',
              border: filter === f ? '1px solid rgba(229,9,20,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: filter === f ? '#f5f5f7' : '#86868b',
              transition: 'all 0.15s',
            }}
          >
            {f === 'dry_run' ? 'Dry Run' : f === 'signed' ? 'RFC 3161' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Run ID</th>
              <th>Plan</th>
              <th>Trigger</th>
              <th>Result</th>
              <th>Phases</th>
              <th>Data</th>
              <th>Signature</th>
              <th>When</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const cfg = RESULT_CONFIG[r.overall_result] || RESULT_CONFIG.failed;
              return (
                <tr key={r.run_id} onClick={() => setSelected(r)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {r.dry_run && <span className="badge badge-blue" style={{ fontSize: 9 }}>DRY</span>}
                      {r.coercion && <span className="badge badge-red" style={{ fontSize: 9 }}>DRS</span>}
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#86868b' }}>
                        {r.run_id.slice(4, 12)}…
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#c7c7cc' }}>{r.plan_name}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: '#86868b' }}>{r.triggered_by.replace(/_/g, ' ')}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: '#86868b' }}>
                      <span style={{ color: '#30d158' }}>{r.phases_succeeded}</span>/{r.phases_total}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#86868b' }}>
                      {formatBytes(r.bytes_processed)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, color: '#30d158' }}>Ed25519</span>
                      {r.rfc3161_token && <span style={{ fontSize: 9, color: '#0a84ff' }}>+ 3161</span>}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, color: '#48484a' }}>{formatRelative(r.completed_at)}</span>
                  </td>
                  <td>
                    <Eye size={14} color="#48484a" style={{ cursor: 'pointer' }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CLI commands */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f7', marginBottom: 12 }}>Receipt CLI Commands</div>
        <div className="terminal">
          <div className="terminal-header">
            <div className="terminal-dot" style={{ background: '#ff5f56' }} />
            <div className="terminal-dot" style={{ background: '#ffbd2e' }} />
            <div className="terminal-dot" style={{ background: '#27c93f' }} />
          </div>
          <div className="terminal-body" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[
              ['mortis receipt list', '# Last 10 receipts'],
              ['mortis receipt list --last 50', '# Last 50 receipts'],
              ['mortis receipt inspect --run-id <uuid>', '# Full receipt detail'],
              ['mortis receipt verify --receipt <path>', '# Verify Ed25519 signature'],
              ['mortis receipt verify --receipt <path> --rfc3161', '# Verify with timestamp'],
              ['mortis receipt finalize --run-id <uuid>', '# Finalize interrupted receipt'],
              ['mortis receipt export --receipt <path> --format json', '# Export as JSON'],
            ].map(([cmd, comment], i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}>
                <span className="terminal-prompt">$</span>
                <span className="terminal-cmd">{cmd}</span>
                <span className="terminal-comment">{comment}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selected && <ReceiptDetail receipt={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
