import React, { useState, useEffect } from 'react';
import {
  Zap, Clock, Wifi, MessageSquare, AlertTriangle,
  CheckCircle, X, ToggleLeft, ToggleRight, Activity
} from 'lucide-react';
import {
  TRIGGERS, PLANS, Trigger, TriggerType, triggerTypeLabel, formatRelative
} from '../data/mortisData';

const TRIGGER_ICONS: Record<TriggerType, React.ReactNode> = {
  manual: <Zap size={16} />,
  scheduled: <Clock size={16} />,
  environmental: <Wifi size={16} />,
  remote_signal: <MessageSquare size={16} />,
  dead_man_switch: <AlertTriangle size={16} />,
};

const TRIGGER_COLORS: Record<TriggerType, string> = {
  manual: '#ff9f0a',
  scheduled: '#0a84ff',
  environmental: '#30d158',
  remote_signal: '#bf5af2',
  dead_man_switch: '#ff453a',
};

function DeadManCountdown({ config }: { config: Record<string, string | number | boolean> }) {
  const [remaining, setRemaining] = useState(Number(config.checkin_remaining_seconds || 57600));

  useEffect(() => {
    const t = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const total = Number(config.timeout_seconds || 86400);
  const pct = remaining / total;
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;

  return (
    <div style={{
      padding: '14px 16px',
      background: 'rgba(255,69,58,0.06)',
      border: '1px solid rgba(255,69,58,0.2)',
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: '#86868b' }}>Time until trigger fires</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, color: pct < 0.2 ? '#ff453a' : '#f5f5f7' }}>
          {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
        </span>
      </div>
      <div className="progress-bar" style={{ height: 6 }}>
        <div className="progress-fill" style={{
          width: `${pct * 100}%`,
          background: pct < 0.2 ? '#ff453a' : pct < 0.5 ? '#ff9f0a' : '#30d158',
          transition: 'width 1s linear',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: '#48484a' }}>0h (FIRES)</span>
        <span style={{ fontSize: 10, color: '#48484a' }}>{Math.floor(total / 3600)}h (timeout)</span>
      </div>
    </div>
  );
}

interface TriggerTestModalProps {
  trigger: Trigger;
  onClose: () => void;
}

function TriggerTestModal({ trigger, onClose }: TriggerTestModalProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ confidence: number; would_fire: boolean } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    await new Promise(r => setTimeout(r, 1200));
    const confidence = trigger.type === 'manual' ? 1.0 :
      trigger.type === 'scheduled' ? 0.95 :
      trigger.type === 'dead_man_switch' ? 0.88 : 0.72;
    setResult({
      confidence,
      would_fire: confidence >= trigger.confidence_threshold && trigger.enabled,
    });
    setTesting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ padding: '22px 26px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f7' }}>Test Trigger</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86868b' }}><X size={18} /></button>
          </div>
        </div>
        <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#86868b' }}>
              <span style={{ color: '#e50914' }}>$</span>{' '}
              <span style={{ color: '#79c0ff' }}>mortis trigger test</span>{' '}
              <span style={{ color: '#56d364' }}>--type {trigger.type} --dry-run</span>
            </div>
          </div>

          {result && (
            <div style={{
              padding: '16px',
              background: result.would_fire ? 'rgba(229,9,20,0.06)' : 'rgba(48,209,88,0.06)',
              border: `1px solid ${result.would_fire ? 'rgba(229,9,20,0.2)' : 'rgba(48,209,88,0.2)'}`,
              borderRadius: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                {result.would_fire
                  ? <AlertTriangle size={16} color="#ff453a" />
                  : <CheckCircle size={16} color="#30d158" />}
                <span style={{ fontSize: 14, fontWeight: 700, color: result.would_fire ? '#ff453a' : '#30d158' }}>
                  {result.would_fire ? 'Would fire' : 'Would NOT fire'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#86868b' }}>Confidence score</span>
                  <span style={{ fontWeight: 600, color: '#f5f5f7' }}>{result.confidence.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#86868b' }}>Threshold</span>
                  <span style={{ fontWeight: 600, color: '#f5f5f7' }}>{trigger.confidence_threshold.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#86868b' }}>Trigger enabled</span>
                  <span style={{ fontWeight: 600, color: trigger.enabled ? '#30d158' : '#ff453a' }}>
                    {trigger.enabled ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="progress-bar" style={{ marginTop: 4 }}>
                  <div className="progress-fill" style={{ width: `${result.confidence * 100}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '16px 26px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={handleTest} disabled={testing}>
            {testing ? 'Testing...' : 'Run Test'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TriggerCard({ trigger, onToggle }: { trigger: Trigger; onToggle: (id: string) => void }) {
  const [showTest, setShowTest] = useState(false);
  const plan = PLANS.find(p => p.id === trigger.plan_id);
  const color = TRIGGER_COLORS[trigger.type];

  return (
    <div className="card" style={{ padding: 20, border: trigger.enabled ? `1px solid ${color}18` : undefined }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${color}12`,
          border: `1px solid ${color}25`,
          color: trigger.enabled ? color : '#48484a',
        }}>
          {TRIGGER_ICONS[trigger.type]}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f7' }}>{triggerTypeLabel(trigger.type)}</span>
            <span className={`badge ${trigger.enabled ? 'badge-green' : 'badge-gray'}`}>
              {trigger.enabled ? 'enabled' : 'disabled'}
            </span>
            {trigger.fire_count > 0 && (
              <span className="badge badge-blue">{trigger.fire_count} fires</span>
            )}
          </div>

          {/* Config details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
            {trigger.type === 'scheduled' && trigger.config.cron && (
              <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#86868b' }}>
                cron: <span style={{ color: '#a5d6ff' }}>{String(trigger.config.cron)}</span>
                <span style={{ color: '#48484a', fontFamily: 'inherit' }}> · {String(trigger.config.description)}</span>
              </div>
            )}
            {trigger.type === 'dead_man_switch' && (
              <div style={{ fontSize: 12, color: '#86868b' }}>
                timeout: <span style={{ color: '#ff9f0a', fontFamily: 'JetBrains Mono, monospace' }}>{Number(trigger.config.timeout_seconds) / 3600}h</span>
              </div>
            )}
            {trigger.type === 'environmental' && trigger.config.conditions && (
              <div style={{ fontSize: 12, color: '#86868b' }}>
                conditions: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#86868b' }}>{String(trigger.config.conditions)}</span>
              </div>
            )}
            {trigger.type === 'remote_signal' && (
              <div style={{ fontSize: 12, color: '#86868b' }}>
                channel: <span style={{ color: '#bf5af2' }}>{String(trigger.config.channel)}</span>
                {' · '}keyword: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#a5d6ff' }}>{String(trigger.config.keyword)}</span>
              </div>
            )}
            <div style={{ fontSize: 12, color: '#86868b' }}>
              confidence threshold: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#f5f5f7' }}>{trigger.confidence_threshold}</span>
              {plan && <> · plan: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#ff9f0a' }}>{plan.name}</span></>}
            </div>
          </div>

          {/* Dead man countdown */}
          {trigger.type === 'dead_man_switch' && trigger.enabled && (
            <DeadManCountdown config={trigger.config} />
          )}

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 11, color: '#48484a' }}>
            {trigger.last_evaluated && (
              <span>Last evaluated: <span style={{ color: '#86868b' }}>{formatRelative(trigger.last_evaluated)}</span></span>
            )}
            {trigger.last_fired && (
              <span>Last fired: <span style={{ color: '#86868b' }}>{formatRelative(trigger.last_fired)}</span></span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => onToggle(trigger.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: trigger.enabled ? '#30d158' : '#48484a',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 600,
              padding: '4px 8px',
              borderRadius: 6,
              transition: 'all 0.15s',
            }}
          >
            {trigger.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            {trigger.enabled ? 'Enabled' : 'Disabled'}
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: 11, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => setShowTest(true)}
          >
            <Activity size={11} /> Test
          </button>
        </div>
      </div>

      {showTest && <TriggerTestModal trigger={trigger} onClose={() => setShowTest(false)} />}
    </div>
  );
}

export default function Triggers() {
  const [triggers, setTriggers] = useState(TRIGGERS);

  const handleToggle = (id: string) => {
    setTriggers(prev => prev.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));
  };

  const enabled = triggers.filter(t => t.enabled).length;

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }} className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: '#f5f5f7' }}>Trigger Manager</h1>
          <p style={{ color: '#86868b', fontSize: 13, marginTop: 4 }}>
            {enabled} of {triggers.length} triggers active · Confidence threshold gating
          </p>
        </div>
      </div>

      {/* Trigger type info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {(Object.entries(TRIGGER_ICONS) as [TriggerType, React.ReactNode][]).map(([type, icon]) => {
          const t = triggers.find(tr => tr.type === type);
          const color = TRIGGER_COLORS[type];
          return (
            <div key={type} style={{
              padding: '12px 14px',
              background: t?.enabled ? `${color}08` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${t?.enabled ? `${color}20` : 'rgba(255,255,255,0.04)'}`,
              borderRadius: 12,
              textAlign: 'center',
            }}>
              <div style={{ color: t?.enabled ? color : '#48484a', marginBottom: 6, display: 'flex', justifyContent: 'center' }}>{icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: t?.enabled ? '#c7c7cc' : '#48484a' }}>{triggerTypeLabel(type)}</div>
              <div style={{ fontSize: 10, color: t?.enabled ? '#30d158' : '#48484a', marginTop: 4 }}>
                {t?.enabled ? '● Active' : '○ Inactive'}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {triggers.map(t => <TriggerCard key={t.id} trigger={t} onToggle={handleToggle} />)}
      </div>

      {/* CLI reference */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f7', marginBottom: 12 }}>Trigger CLI Commands</div>
        <div className="terminal">
          <div className="terminal-header">
            <div className="terminal-dot" style={{ background: '#ff5f56' }} />
            <div className="terminal-dot" style={{ background: '#ffbd2e' }} />
            <div className="terminal-dot" style={{ background: '#27c93f' }} />
            <span style={{ fontSize: 11, color: '#48484a', marginLeft: 8 }}>terminal</span>
          </div>
          <div className="terminal-body" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { cmd: 'mortis trigger list', comment: '# List all triggers and status' },
              { cmd: 'mortis trigger test --type manual --dry-run', comment: '# Test without firing' },
              { cmd: 'mortis trigger test --type scheduled --dry-run', comment: '' },
              { cmd: 'mortis trigger disable --type scheduled', comment: '# Disable a trigger' },
              { cmd: 'mortis trigger enable --type dead_man_switch', comment: '# Re-enable a trigger' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}>
                <span className="terminal-prompt">$</span>
                <span className="terminal-cmd">{item.cmd}</span>
                {item.comment && <span className="terminal-comment">{item.comment}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
