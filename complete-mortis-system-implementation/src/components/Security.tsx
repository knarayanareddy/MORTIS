
import { Shield, Lock, AlertTriangle, CheckCircle, Key, Database, Cpu, Hash } from 'lucide-react';
import { THREAT_MODEL, SANITIZATION_MATRIX, EXIT_CODES } from '../data/mortisData';

const CRYPTO_PRIMITIVES = [
  { purpose: 'Database encryption', primitive: 'AES-256-CBC', crate: 'sqlcipher', color: '#e50914' },
  { purpose: 'Key derivation', primitive: 'PBKDF2-HMAC-SHA512', crate: 'ring', color: '#ff9f0a' },
  { purpose: 'Receipt signing', primitive: 'Ed25519', crate: 'ed25519-dalek', color: '#30d158' },
  { purpose: 'Receipt body hash', primitive: 'SHA-256', crate: 'ring', color: '#0a84ff' },
  { purpose: 'Credential encryption', primitive: 'AES-256-GCM', crate: 'aes-gcm', color: '#bf5af2' },
  { purpose: 'Random generation', primitive: 'ChaCha20', crate: 'rand (OsRng)', color: '#ff9f0a' },
  { purpose: 'Memory zeroization', primitive: 'Secure zeroing', crate: 'zeroize', color: '#30d158' },
];

const SEVERITY_CONFIG: Record<string, { color: string; bg: string }> = {
  critical: { color: '#ff453a', bg: 'rgba(255,69,58,0.1)' },
  high: { color: '#ff9f0a', bg: 'rgba(255,159,10,0.1)' },
  medium: { color: '#ffd60a', bg: 'rgba(255,214,10,0.08)' },
  low: { color: '#30d158', bg: 'rgba(48,209,88,0.08)' },
};

const NIST_METHODS: Record<string, { color: string }> = {
  Clear: { color: '#0a84ff' },
  Purge: { color: '#ff9f0a' },
  'N/A': { color: '#86868b' },
};

export default function Security() {
  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 28 }} className="animate-fade-in">
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: '#f5f5f7' }}>Security Model</h1>
        <p style={{ color: '#86868b', fontSize: 13, marginTop: 4 }}>
          Full cryptographic threat model · NIST SP 800-88 aligned
        </p>
      </div>

      {/* Encryption at rest */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Lock size={16} color="#e50914" />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f7' }}>Encryption at Rest</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { title: 'Database', detail: 'SQLCipher AES-256-CBC · User-supplied passphrase', icon: <Database size={14} /> },
            { title: 'Key Derivation', detail: 'PBKDF2-HMAC-SHA512 · 100,000 iterations · 32-byte random salt', icon: <Key size={14} /> },
            { title: 'Credentials', detail: 'AES-256-GCM at application layer · Per-credential IVs', icon: <Lock size={14} /> },
            { title: 'Passphrase', detail: 'Never stored on disk · Zeroized from memory after use', icon: <Shield size={14} /> },
          ].map((item, i) => (
            <div key={i} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ color: '#e50914' }}>{item.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f7' }}>{item.title}</span>
              </div>
              <div style={{ fontSize: 12, color: '#86868b', lineHeight: 1.5 }}>{item.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cryptographic primitives */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Hash size={16} color="#0a84ff" />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f7' }}>Cryptographic Primitives</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Purpose</th>
              <th>Primitive</th>
              <th>Rust Crate</th>
            </tr>
          </thead>
          <tbody>
            {CRYPTO_PRIMITIVES.map((p, i) => (
              <tr key={i}>
                <td><span style={{ fontSize: 12, color: '#c7c7cc' }}>{p.purpose}</span></td>
                <td>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                    color: p.color, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 100,
                    background: `${p.color}12`,
                  }}>
                    {p.primitive}
                  </span>
                </td>
                <td>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#86868b' }}>{p.crate}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Threat Model */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <AlertTriangle size={16} color="#ff9f0a" />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f7' }}>Threat Model</h2>
          <span style={{ fontSize: 11, color: '#86868b' }}>T-1 through T-{THREAT_MODEL.length}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {THREAT_MODEL.map((t) => {
            const cfg = SEVERITY_CONFIG[t.severity];
            return (
              <div key={t.id} style={{
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderRadius: 10,
                display: 'flex', alignItems: 'flex-start', gap: 12,
              }}>
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
                    color: '#48484a', minWidth: 36,
                  }}>{t.id}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 100,
                    background: cfg.bg, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 52, textAlign: 'center',
                  }}>
                    {t.severity}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f7', marginBottom: 3 }}>{t.threat}</div>
                  <div style={{ fontSize: 12, color: '#86868b' }}>{t.mitigation}</div>
                </div>
                <CheckCircle size={14} color="#30d158" style={{ flexShrink: 0, marginTop: 2 }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* NIST Sanitization Matrix */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Cpu size={16} color="#30d158" />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f7' }}>Sanitization Matrix</h2>
          <span style={{ fontSize: 11, color: '#86868b' }}>NIST SP 800-88 Rev.1</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Media Type</th>
              <th>Method</th>
              <th>NIST Level</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {SANITIZATION_MATRIX.map((row, i) => {
              const nist = NIST_METHODS[row.nist] || NIST_METHODS['N/A'];
              return (
                <tr key={i}>
                  <td><span style={{ fontSize: 12, color: '#f5f5f7', fontWeight: 500 }}>{row.media}</span></td>
                  <td><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#86868b' }}>{row.method}</span></td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                      background: `${nist.color}12`, color: nist.color,
                    }}>
                      {row.nist}
                    </span>
                  </td>
                  <td><span style={{ fontSize: 11, color: '#48484a' }}>{row.notes}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Limitations */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <AlertTriangle size={16} color="#ffd60a" />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f7' }}>What MORTIS Cannot Guarantee</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { text: 'Remote deletion is best-effort. Cloud services may delay or ignore deletion requests.', severity: 'medium' },
            { text: 'Physical media destruction (shredding) is out of scope.', severity: 'medium' },
            { text: 'Coercion resistance is limited to duress passphrase; biometric unlock is not protected.', severity: 'high' },
            { text: 'Anti-forensics completeness. Shadow copies, swap files, and cloud sync caches outside scope are not handled.', severity: 'medium' },
          ].map((item, i) => (
            <div key={i} style={{
              padding: '12px 14px',
              background: 'rgba(255,214,10,0.04)',
              border: '1px solid rgba(255,214,10,0.1)',
              borderRadius: 10,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <AlertTriangle size={13} color="#ffd60a" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: '#c7c7cc', lineHeight: 1.5 }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Duress Passphrase */}
      <div className="card" style={{ padding: 24, border: '1px solid rgba(229,9,20,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Shield size={16} color="#e50914" />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f7' }}>Duress Passphrase</h2>
          <span className="badge badge-red">Anti-coercion</span>
        </div>
        <p style={{ fontSize: 13, color: '#86868b', lineHeight: 1.6 }}>
          MORTIS supports a secondary "duress" passphrase that executes a reduced plan
          (e.g., skipping self-destruct phases that would alert an adversary).
          Receipts generated under duress are tagged <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#e50914' }}>"coercion": true</span>.
        </p>
      </div>

      {/* Exit codes */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f7', marginBottom: 16 }}>Exit Codes</div>
        <table className="data-table">
          <thead>
            <tr><th>Code</th><th>Spec §</th><th>Meaning</th><th>Status</th></tr>
          </thead>
          <tbody>
            {EXIT_CODES.map(e => (
              <tr key={e.code}>
                <td>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700,
                    color: e.code === 0 ? '#30d158' : e.code === 1 ? '#ff9f0a' : '#ff453a',
                  }}>{e.code}</span>
                </td>
                <td><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#48484a' }}>{e.spec}</span></td>
                <td><span style={{ fontSize: 12, color: '#c7c7cc' }}>{e.meaning}</span></td>
                <td><CheckCircle size={13} color="#30d158" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
