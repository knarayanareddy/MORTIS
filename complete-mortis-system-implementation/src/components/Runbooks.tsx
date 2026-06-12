import { useState } from 'react';
import { ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import { RUNBOOKS } from '../data/mortisData';

export default function Runbooks() {
  const [open, setOpen] = useState<string | null>('RB-01');

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }} className="animate-fade-in">
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: '#f5f5f7' }}>Runbooks</h1>
        <p style={{ color: '#86868b', fontSize: 13, marginTop: 4 }}>
          Operational procedures for common MORTIS scenarios and incident recovery
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {RUNBOOKS.map(rb => (
          <button
            key={rb.id}
            onClick={() => setOpen(rb.id === open ? null : rb.id)}
            style={{
              padding: '12px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
              background: open === rb.id ? 'rgba(229,9,20,0.08)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${open === rb.id ? 'rgba(229,9,20,0.25)' : 'rgba(255,255,255,0.05)'}`,
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: open === rb.id ? '#e50914' : '#48484a', marginBottom: 4, fontWeight: 700 }}>{rb.id}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#c7c7cc', lineHeight: 1.3 }}>{rb.title}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {RUNBOOKS.map(rb => (
          <div key={rb.id} className="card" style={{ overflow: 'hidden' }}>
            <button
              onClick={() => setOpen(rb.id === open ? null : rb.id)}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              <span style={{ color: open === rb.id ? '#e50914' : '#48484a' }}>
                {open === rb.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#48484a', minWidth: 48 }}>{rb.id}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f7' }}>{rb.title}</div>
                <div style={{ fontSize: 12, color: '#86868b', marginTop: 2 }}>{rb.symptom}</div>
              </div>
              <span className="badge badge-gray">{rb.steps.filter(s => !s.startsWith('#')).length} commands</span>
            </button>

            {open === rb.id && (
              <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ marginTop: 16, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(255,214,10,0.04)', border: '1px solid rgba(255,214,10,0.1)', borderRadius: 8 }}>
                    <AlertTriangle size={13} color="#ffd60a" />
                    <span style={{ fontSize: 12, color: '#c7c7cc' }}><strong style={{ color: '#ffd60a' }}>Symptom:</strong> {rb.symptom}</span>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: '#48484a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>
                  Resolution Steps
                </div>

                <div className="terminal">
                  <div className="terminal-header">
                    <div className="terminal-dot" style={{ background: '#ff5f56' }} />
                    <div className="terminal-dot" style={{ background: '#ffbd2e' }} />
                    <div className="terminal-dot" style={{ background: '#27c93f' }} />
                    <span style={{ fontSize: 11, color: '#48484a', marginLeft: 8 }}>{rb.id}: {rb.title}</span>
                  </div>
                  <div className="terminal-body">
                    {rb.steps.map((step, i) => (
                      <div key={i} style={{ marginBottom: 6 }}>
                        {rb.comments[i] && rb.comments[i] !== '' && (
                          <div style={{ color: '#6a737d', fontSize: 12 }}>{rb.comments[i]}</div>
                        )}
                        {step.startsWith('#') ? (
                          <div style={{ color: '#6a737d', fontSize: 12 }}>{step}</div>
                        ) : (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span className="terminal-prompt">$</span>
                            <span className="terminal-cmd">{step}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
