import { Database, Shield, Terminal, Box, ArrowDown } from 'lucide-react';
import { CRATE_STRUCTURE, SPEC_COMPLIANCE } from '../data/mortisData';

export default function Architecture() {
  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 28 }} className="animate-fade-in">
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: '#f5f5f7' }}>Architecture</h1>
        <p style={{ color: '#86868b', fontSize: 13, marginTop: 4 }}>
          System design · Crate structure · Phase choreography · Spec compliance
        </p>
      </div>

      {/* System Diagram */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f7', marginBottom: 20 }}>System Architecture Diagram</div>

        {/* ASCII art rendered as visual diagram */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* User layer */}
          <div style={{
            padding: '16px 20px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: '#48484a', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 6 }}>User / Operator</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
              {['CLI commands', 'Config files', 'Trigger signals'].map(s => (
                <span key={s} style={{ fontSize: 12, color: '#86868b', padding: '4px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>{s}</span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ArrowDown size={16} color="#e50914" />
          </div>

          {/* MORTIS Process */}
          <div style={{
            padding: '20px',
            background: 'rgba(229,9,20,0.04)',
            border: '1px solid rgba(229,9,20,0.15)',
            borderRadius: 14,
          }}>
            <div style={{ fontSize: 11, color: '#e50914', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 16 }}>MORTIS Process</div>

            {/* CLI + Core side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Terminal size={14} color="#0a84ff" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#f5f5f7' }}>CLI Layer (clap)</span>
                </div>
                <div style={{ fontSize: 11, color: '#86868b' }}>Secure input · SLO benchmarks · Output formatting</div>
              </div>
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f5f5f7', marginBottom: 8 }}>Core Engine</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'TriggerManager', desc: 'Event detection · Confidence scoring' },
                    { label: 'Orchestrator', desc: 'Phase runner · Error handling' },
                    { label: 'PassphraseInterlock', desc: 'Gates all destructive ops', full: true },
                  ].map((item) => (
                    <div key={item.label} style={{
                      padding: '8px 10px',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8,
                      gridColumn: item.full ? '1 / -1' : undefined,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#c7c7cc', fontFamily: 'JetBrains Mono, monospace' }}>{item.label}</div>
                      <div style={{ fontSize: 10, color: '#48484a', marginTop: 2 }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Plugin layer */}
            <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f5f5f7', marginBottom: 10 }}>Plugin Layer</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { label: 'SanitizationPlugin', desc: 'NIST SP 800-88', color: '#30d158' },
                  { label: 'DeletionPlugin', desc: 'Remote revoke', color: '#0a84ff' },
                  { label: 'InventoryConnector', desc: 'Asset discovery', color: '#ff9f0a' },
                ].map(p => (
                  <div key={p.label} style={{ padding: '8px 10px', background: `${p.color}08`, border: `1px solid ${p.color}15`, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: p.color, fontFamily: 'JetBrains Mono, monospace' }}>{p.label}</div>
                    <div style={{ fontSize: 10, color: '#48484a', marginTop: 2 }}>{p.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Persistence + Crypto side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Database size={13} color="#bf5af2" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#f5f5f7' }}>Persistence Layer</span>
                </div>
                <div style={{ fontSize: 11, color: '#86868b', marginBottom: 8 }}>SQLCipher AES-256-CBC</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {['Inventory', 'Receipts', 'Credentials', 'Config', 'Metrics'].map(t => (
                    <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(191,90,242,0.08)', color: '#bf5af2', border: '1px solid rgba(191,90,242,0.15)' }}>{t}</span>
                  ))}
                </div>
              </div>
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Shield size={13} color="#e50914" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#f5f5f7' }}>Crypto Engine</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {['Ed25519', 'SHA-256', 'PBKDF2', 'AES-256-GCM', 'RFC 3161', 'zeroize'].map(t => (
                    <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(229,9,20,0.08)', color: '#ff453a', border: '1px solid rgba(229,9,20,0.15)' }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phase Choreography */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f7', marginBottom: 20 }}>Phase Choreography</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { label: 'TRIGGER FIRED', color: '#e50914', steps: [] },
            { label: '[1] PassphraseInterlock.verify()', color: '#ff9f0a', steps: ['fail → ABORT (exit 2)'] },
            { label: '[2] InventoryDB.load_plan()', color: '#ff9f0a', steps: ['fail → ABORT (exit 3)'] },
            { label: '[3] Orchestrator.begin_run(plan, dry_run)', color: '#0a84ff', steps: [] },
            { label: '    ├→ Revoke remote accounts (DeletionPlugins)', color: '#86868b', steps: ['partial fail → log + tag receipt + CONTINUE'] },
            { label: '    ├→ Sanitize local assets (SanitizationPlugins)', color: '#86868b', steps: ['partial fail → log + tag receipt + CONTINUE'] },
            { label: '    ├→ Clear browser state (BrowserStatePlugin)', color: '#86868b', steps: ['partial fail → log + tag receipt + CONTINUE'] },
            { label: '    ├→ Wipe DB records', color: '#86868b', steps: ['partial fail → log + tag receipt + CONTINUE'] },
            { label: '    └→ Self-destruct config (optional)', color: '#86868b', steps: ['partial fail → log + tag receipt + CONTINUE'] },
            { label: '[4] ReceiptEngine.build_and_sign()', color: '#30d158', steps: [] },
            { label: '[5] ReceiptEngine.timestamp_via_rfc3161() [optional]', color: '#30d158', steps: [] },
            { label: '[6] Receipt persisted (DB + JSON file)', color: '#30d158', steps: ['EXIT 0=success · 1=partial · 2+=abort'] },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                <div style={{ width: 1, flex: 1, background: i === 0 ? 'transparent' : 'rgba(229,9,20,0.2)' }} />
                {i < 12 && <div style={{ width: 6, height: 6, borderRadius: '50%', background: step.color, flexShrink: 0 }} />}
                <div style={{ width: 1, flex: 1, background: i === 11 ? 'transparent' : 'rgba(229,9,20,0.2)' }} />
              </div>
              <div style={{ paddingLeft: 12, paddingBottom: 12, flex: 1 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: step.color, lineHeight: 1.4 }}>{step.label}</div>
                {step.steps.map((s, j) => (
                  <div key={j} style={{ fontSize: 11, color: '#48484a', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>{s}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Crate Structure */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Box size={16} color="#ff9f0a" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f7' }}>Crate Structure</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Crate</th><th>Purpose</th><th>Key Dependencies</th></tr>
          </thead>
          <tbody>
            {CRATE_STRUCTURE.map((c, i) => (
              <tr key={i}>
                <td>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#e50914' }}>{c.crate}</span>
                </td>
                <td><span style={{ fontSize: 12, color: '#c7c7cc' }}>{c.purpose}</span></td>
                <td><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#86868b' }}>{c.deps}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Spec Compliance */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f7', marginBottom: 18 }}>Spec Compliance (MORTIS.md)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SPEC_COMPLIANCE.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: s.status === 'implemented' ? 'rgba(48,209,88,0.12)' : 'rgba(10,132,255,0.12)',
                border: `1px solid ${s.status === 'implemented' ? 'rgba(48,209,88,0.25)' : 'rgba(10,132,255,0.25)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 12 }}>{s.status === 'implemented' ? '✓' : '📋'}</span>
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f7', fontFamily: 'JetBrains Mono, monospace' }}>{s.section}</span>
              </div>
              <span style={{
                fontSize: 9, padding: '2px 7px', borderRadius: 100,
                background: s.status === 'implemented' ? 'rgba(48,209,88,0.1)' : 'rgba(10,132,255,0.1)',
                color: s.status === 'implemented' ? '#30d158' : '#0a84ff',
                border: `1px solid ${s.status === 'implemented' ? 'rgba(48,209,88,0.2)' : 'rgba(10,132,255,0.2)'}`,
                fontWeight: 700, textTransform: 'uppercase',
              }}>
                {s.status}
              </span>
              <span style={{ fontSize: 11, color: '#48484a' }}>{s.notes}</span>
            </div>
          ))}
        </div>
      </div>

      {/* File structure */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f7', marginBottom: 16 }}>Project File Structure</div>
        <div className="terminal">
          <div className="terminal-header">
            <div className="terminal-dot" style={{ background: '#ff5f56' }} />
            <div className="terminal-dot" style={{ background: '#ffbd2e' }} />
            <div className="terminal-dot" style={{ background: '#27c93f' }} />
            <span style={{ fontSize: 11, color: '#48484a', marginLeft: 8 }}>MORTIS/</span>
          </div>
          <div className="terminal-body" style={{ fontSize: 11 }}>
            {[
              ['MORTIS/', '', '#8b949e'],
              ['├── Cargo.toml', 'Workspace root', '#6a737d'],
              ['├── README.md', 'This file', '#6a737d'],
              ['├── MORTIS.md', 'Full engineering specification', '#6a737d'],
              ['├── deny.toml', 'License allowlist (cargo-deny)', '#6a737d'],
              ['├── .github/workflows/ci.yml', 'CI pipeline (11 quality gates)', '#6a737d'],
              ['├── scripts/', '', '#8b949e'],
              ['│   ├── build-reproducible.sh', '', '#6a737d'],
              ['│   ├── generate-sbom.sh', '', '#6a737d'],
              ['│   └── sign-release.sh', '', '#6a737d'],
              ['├── tests/', '', '#8b949e'],
              ['│   ├── e2e.rs', 'End-to-end CLI tests', '#6a737d'],
              ['│   └── backward_compat.rs', 'Receipt backward compatibility', '#6a737d'],
              ['└── crates/', '', '#8b949e'],
              ['    ├── mortis-types/', 'Shared types (zero deps)', '#e50914'],
              ['    ├── mortis-crypto/', 'Cryptographic primitives', '#e50914'],
              ['    ├── mortis-plugins/', 'Plugin system', '#e50914'],
              ['    ├── mortis-db/', 'SQLCipher persistence', '#e50914'],
              ['    ├── mortis-core/', 'Core engine', '#e50914'],
              ['    └── mortis-cli/', 'CLI binary', '#e50914'],
            ].map(([line, comment, color], i) => (
              <div key={i} style={{ display: 'flex', gap: 16 }}>
                <span style={{ color: color as string, fontFamily: 'JetBrains Mono, monospace' }}>{line}</span>
                {comment && <span style={{ color: '#6a737d' }}>{'# ' + comment}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
