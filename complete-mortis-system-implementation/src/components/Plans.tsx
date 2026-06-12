import React, { useState } from 'react';
import {
  Play, Eye, Plus, ChevronRight, ChevronDown,
  CheckCircle, AlertTriangle, Cpu, Globe, Monitor, Database, Skull, X,
  Clock, ToggleLeft, ToggleRight
} from 'lucide-react';
import {
  PLANS, ASSETS, Plan, PhaseType, phaseTypeLabel
} from '../data/mortisData';

const PHASE_ICONS: Record<PhaseType, React.ReactNode> = {
  revoke_remote: <Globe size={13} />,
  sanitize_local: <Cpu size={13} />,
  clear_browser: <Monitor size={13} />,
  wipe_db: <Database size={13} />,
  self_destruct: <Skull size={13} />,
};

const PHASE_COLORS: Record<PhaseType, string> = {
  revoke_remote: '#0a84ff',
  sanitize_local: '#30d158',
  clear_browser: '#ff9f0a',
  wipe_db: '#bf5af2',
  self_destruct: '#ff453a',
};

interface RunModalProps {
  plan: Plan;
  onClose: () => void;
}

function RunModal({ plan, onClose }: RunModalProps) {
  const [dryRun, setDryRun] = useState(true);
  const [passphrase, setPassphrase] = useState('');
  const [noTimestamp, setNoTimestamp] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(-1);

  const handleRun = async () => {
    if (!passphrase) return;
    setRunning(true);
    for (let i = 0; i < plan.phases.length; i++) {
      setCurrentPhase(i);
      await new Promise(r => setTimeout(r, 800 + Math.random() * 400));
    }
    setCurrentPhase(-1);
    setRunning(false);
    setDone(true);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f7' }}>Execute Plan</div>
              <div style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: '#e50914', marginTop: 2 }}>{plan.name}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86868b' }}><X size={18} /></button>
          </div>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!done ? (
            <>
              <div style={{
                padding: '12px 14px',
                background: dryRun ? 'rgba(10,132,255,0.06)' : 'rgba(229,9,20,0.06)',
                border: `1px solid ${dryRun ? 'rgba(10,132,255,0.2)' : 'rgba(229,9,20,0.2)'}`,
                borderRadius: 10,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <AlertTriangle size={14} color={dryRun ? '#0a84ff' : '#ff453a'} />
                <span style={{ fontSize: 13, color: dryRun ? '#0a84ff' : '#ff453a' }}>
                  {dryRun ? 'Dry run — no mutations will occur' : '⚠ LIVE EXECUTION — destructive operations will run'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#86868b' }}>Dry Run (--dry-run)</span>
                <button onClick={() => setDryRun(!dryRun)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dryRun ? '#0a84ff' : '#e50914' }}>
                  {dryRun ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#86868b' }}>Skip RFC 3161 Timestamp (--no-timestamp)</span>
                <button onClick={() => setNoTimestamp(!noTimestamp)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: noTimestamp ? '#e50914' : '#48484a' }}>
                  {noTimestamp ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>

              <div>
                <label style={{ fontSize: 12, color: '#86868b', display: 'block', marginBottom: 8 }}>Passphrase</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Enter passphrase to authorize execution"
                  value={passphrase}
                  onChange={e => setPassphrase(e.target.value)}
                />
              </div>

              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#86868b' }}>
                  <span style={{ color: '#e50914' }}>$ </span>
                  <span style={{ color: '#79c0ff' }}>mortis run</span>
                  <span style={{ color: '#56d364' }}> --plan {plan.name}.toml</span>
                  {dryRun && <span style={{ color: '#56d364' }}> --dry-run</span>}
                  {noTimestamp && <span style={{ color: '#56d364' }}> --no-timestamp</span>}
                </div>
              </div>

              {running && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, color: '#86868b', marginBottom: 4 }}>Executing phases...</div>
                  {plan.phases.map((phase, i) => (
                    <div key={phase.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className={`phase-node ${i < currentPhase ? 'success' : i === currentPhase ? 'running' : 'pending'}`}>
                        {i < currentPhase ? <CheckCircle size={10} /> : i + 1}
                      </div>
                      <span style={{ fontSize: 12, color: i <= currentPhase ? '#c7c7cc' : '#48484a' }}>
                        {phaseTypeLabel(phase.phase_type)}
                      </span>
                      {i === currentPhase && (
                        <span style={{ fontSize: 10, color: '#0a84ff', animation: 'flicker 1s infinite' }}>running...</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircle size={48} color="#30d158" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f7', marginBottom: 8 }}>
                {dryRun ? 'Dry Run Complete' : 'Execution Complete'}
              </div>
              <div style={{ fontSize: 13, color: '#86868b' }}>
                Receipt generated and signed with Ed25519.<br />Run ID stored in ~/.mortis/receipts/
              </div>
              <div style={{ marginTop: 16, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#30d158', background: 'rgba(48,209,88,0.06)', border: '1px solid rgba(48,209,88,0.15)', borderRadius: 8, padding: '10px 14px' }}>
                Exit code: 0 · FULL SUCCESS ✓
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 28px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {!done ? (
            <>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className={dryRun ? 'btn-secondary' : 'btn-primary'}
                style={!dryRun ? { background: '#e50914' } : {}}
                onClick={handleRun}
                disabled={!passphrase || running}
              >
                {running ? 'Executing...' : dryRun ? 'Run Dry Run' : '⚡ Execute Plan'}
              </button>
            </>
          ) : (
            <button className="btn-secondary" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const [expanded, setExpanded] = useState(false);
  const [showRun, setShowRun] = useState(false);

  const assetMap = Object.fromEntries(ASSETS.map(a => [a.id, a]));

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Plan header */}
      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        {plan.is_default && (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e50914', boxShadow: '0 0 8px rgba(229,9,20,0.8)', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700, color: '#f5f5f7' }}>
              {plan.name}
            </span>
            {plan.is_default && <span className="badge badge-red" style={{ fontSize: 9 }}>DEFAULT</span>}
            <span className="badge badge-gray">{plan.phases.length} phases</span>
            <span className="badge badge-gray">{plan.run_count} runs</span>
          </div>
          <div style={{ fontSize: 12, color: '#86868b', marginTop: 4 }}>{plan.description}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86868b', padding: 4, display: 'flex', alignItems: 'center' }}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '6px 12px' }} onClick={() => setShowRun(true)}>
            <Eye size={12} /> Preview
          </button>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '6px 12px' }} onClick={() => setShowRun(true)}>
            <Play size={12} /> Run
          </button>
        </div>
      </div>

      {/* Phase flow */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '16px 20px 20px' }}>
          <div style={{ fontSize: 11, color: '#48484a', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Phase Choreography</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {plan.phases.map((phase, idx) => (
              <div key={phase.id}>
                <div className="phase-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `${PHASE_COLORS[phase.phase_type]}15`,
                      border: `1px solid ${PHASE_COLORS[phase.phase_type]}30`,
                      color: PHASE_COLORS[phase.phase_type],
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {idx + 1}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: PHASE_COLORS[phase.phase_type] }}>{PHASE_ICONS[phase.phase_type]}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f7' }}>{phaseTypeLabel(phase.phase_type)}</span>
                      {phase.plugin_name && (
                        <span style={{ fontSize: 10, color: '#86868b', fontFamily: 'JetBrains Mono, monospace' }}>→ {phase.plugin_name}</span>
                      )}
                      {phase.timeout_seconds && (
                        <span style={{ fontSize: 10, color: '#48484a', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={9} />{phase.timeout_seconds}s
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <span style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 100,
                        background: phase.continue_on_failure ? 'rgba(48,209,88,0.08)' : 'rgba(229,9,20,0.08)',
                        border: `1px solid ${phase.continue_on_failure ? 'rgba(48,209,88,0.15)' : 'rgba(229,9,20,0.15)'}`,
                        color: phase.continue_on_failure ? '#30d158' : '#ff453a',
                      }}>
                        {phase.continue_on_failure ? 'continue on failure' : 'abort on failure'}
                      </span>
                    </div>
                    {phase.asset_ids.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {phase.asset_ids.map(id => {
                          const asset = assetMap[id];
                          return asset ? (
                            <span key={id} style={{
                              fontSize: 10, padding: '2px 8px', borderRadius: 100,
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.06)',
                              color: '#86868b',
                            }}>
                              {asset.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {idx < plan.phases.length - 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 27, height: 16 }}>
                    <div style={{ width: 1, flex: 1, background: 'linear-gradient(180deg, rgba(229,9,20,0.3), rgba(229,9,20,0.1))' }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* TOML preview */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: '#48484a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>TOML Configuration</div>
            <div className="terminal">
              <div className="terminal-header">
                <div className="terminal-dot" style={{ background: '#ff5f56' }} />
                <div className="terminal-dot" style={{ background: '#ffbd2e' }} />
                <div className="terminal-dot" style={{ background: '#27c93f' }} />
                <span style={{ fontSize: 11, color: '#48484a', marginLeft: 8 }}>{plan.name}.toml</span>
              </div>
              <div className="terminal-body" style={{ fontSize: 12 }}>
                <div style={{ color: '#79c0ff' }}>[plan]</div>
                <div>name = <span style={{ color: '#a5d6ff' }}>"{plan.name}"</span></div>
                <div>description = <span style={{ color: '#a5d6ff' }}>"{plan.description}"</span></div>
                <div>is_default = <span style={{ color: '#ff9f0a' }}>{plan.is_default ? 'true' : 'false'}</span></div>
                {plan.phases.map((phase, i) => (
                  <div key={i} style={{ marginTop: 8 }}>
                    <div style={{ color: '#6a737d' }}># Phase {i + 1}</div>
                    <div style={{ color: '#79c0ff' }}>[[phases]]</div>
                    <div>phase_type = <span style={{ color: '#a5d6ff' }}>"{phase.phase_type}"</span></div>
                    {phase.asset_ids.length > 0 && (
                      <div>asset_ids = <span style={{ color: '#a5d6ff' }}>[{phase.asset_ids.map(id => `"${id.slice(0, 8)}..."`).join(', ')}]</span></div>
                    )}
                    <div>continue_on_failure = <span style={{ color: '#ff9f0a' }}>{phase.continue_on_failure ? 'true' : 'false'}</span></div>
                    {phase.timeout_seconds && <div>timeout_seconds = <span style={{ color: '#ff9f0a' }}>{phase.timeout_seconds}</span></div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showRun && <RunModal plan={plan} onClose={() => setShowRun(false)} />}
    </div>
  );
}

export default function Plans() {
  const [plans] = useState(PLANS);

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }} className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: '#f5f5f7' }}>Destruction Plans</h1>
          <p style={{ color: '#86868b', fontSize: 13, marginTop: 4 }}>
            {plans.length} plans configured · TOML-defined execution choreography
          </p>
        </div>
        <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus size={14} /> New Plan
        </button>
      </div>

      {/* Phase type legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {(Object.entries(PHASE_COLORS) as [PhaseType, string][]).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 11, color: '#86868b' }}>{phaseTypeLabel(type)}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {plans.map(plan => <PlanCard key={plan.id} plan={plan} />)}
      </div>
    </div>
  );
}
