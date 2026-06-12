
import {
  LayoutDashboard, Database, FileText, Zap, Receipt, Shield,
  Terminal, BookOpen, ChevronRight, Activity, Settings,
  AlertTriangle, Server
} from 'lucide-react';

export type View =
  | 'dashboard'
  | 'inventory'
  | 'plans'
  | 'triggers'
  | 'receipts'
  | 'security'
  | 'cli'
  | 'runbooks'
  | 'architecture'
  | 'selfcheck';

interface SidebarProps {
  active: View;
  onNavigate: (v: View) => void;
}

const NAV_ITEMS: { view: View; icon: React.ReactNode; label: string; badge?: string }[] = [
  { view: 'dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
  { view: 'inventory', icon: <Database size={16} />, label: 'Inventory' },
  { view: 'plans', icon: <FileText size={16} />, label: 'Plans' },
  { view: 'triggers', icon: <Zap size={16} />, label: 'Triggers' },
  { view: 'receipts', icon: <Receipt size={16} />, label: 'Receipts' },
  { view: 'security', icon: <Shield size={16} />, label: 'Security Model' },
  { view: 'architecture', icon: <Server size={16} />, label: 'Architecture' },
  { view: 'cli', icon: <Terminal size={16} />, label: 'CLI Reference' },
  { view: 'runbooks', icon: <BookOpen size={16} />, label: 'Runbooks' },
  { view: 'selfcheck', icon: <Activity size={16} />, label: 'Self-Check' },
];

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside style={{
      width: 220,
      minWidth: 220,
      background: '#080808',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '28px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #e50914, #8b0000)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(229,9,20,0.4)',
            flexShrink: 0,
          }}>
            <AlertTriangle size={16} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', color: '#f5f5f7' }}>MORTIS</div>
            <div style={{ fontSize: 10, color: '#48484a', letterSpacing: '0.06em', fontWeight: 500 }}>v0.1.0 · STABLE</div>
          </div>
        </div>
        <div style={{
          marginTop: 12,
          padding: '6px 10px',
          background: 'rgba(48,209,88,0.08)',
          border: '1px solid rgba(48,209,88,0.15)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#30d158',
            boxShadow: '0 0 8px rgba(48,209,88,0.8)',
          }} />
          <span style={{ fontSize: 11, color: '#30d158', fontWeight: 600 }}>Initialized · Locked</span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        <div style={{ fontSize: 10, color: '#48484a', fontWeight: 600, letterSpacing: '0.1em', padding: '8px 8px 4px', textTransform: 'uppercase' }}>Operations</div>
        {NAV_ITEMS.slice(0, 5).map(item => (
          <button
            key={item.view}
            className="sidebar-item"
            style={{ width: '100%', textAlign: 'left', background: 'none' }}
            onClick={() => onNavigate(item.view)}
            data-active={active === item.view}
          >
            <div style={{
              ...active === item.view ? {
                color: '#e50914',
              } : { color: '#86868b' }
            }}>
              {item.icon}
            </div>
            <span style={{ fontSize: 13, fontWeight: active === item.view ? 600 : 400 }}>{item.label}</span>
            {active === item.view && (
              <ChevronRight size={12} style={{ marginLeft: 'auto', color: '#e50914' }} />
            )}
          </button>
        ))}

        <div style={{ fontSize: 10, color: '#48484a', fontWeight: 600, letterSpacing: '0.1em', padding: '12px 8px 4px', textTransform: 'uppercase' }}>System</div>
        {NAV_ITEMS.slice(5).map(item => (
          <button
            key={item.view}
            className="sidebar-item"
            style={{ width: '100%', textAlign: 'left', background: 'none' }}
            onClick={() => onNavigate(item.view)}
            data-active={active === item.view}
          >
            <div style={{
              ...active === item.view ? { color: '#e50914' } : { color: '#86868b' }
            }}>
              {item.icon}
            </div>
            <span style={{ fontSize: 13, fontWeight: active === item.view ? 600 : 400 }}>{item.label}</span>
            {active === item.view && (
              <ChevronRight size={12} style={{ marginLeft: 'auto', color: '#e50914' }} />
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{
          padding: '10px 12px',
          background: 'rgba(229,9,20,0.06)',
          border: '1px solid rgba(229,9,20,0.12)',
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 11, color: '#86868b', marginBottom: 4 }}>Database</div>
          <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#f5f5f7' }}>~/.mortis/mortis.db</div>
          <div style={{ fontSize: 10, color: '#48484a', marginTop: 2 }}>AES-256-CBC · 4.5 MB</div>
        </div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px' }}>
          <Settings size={12} color="#48484a" />
          <span style={{ fontSize: 11, color: '#48484a' }}>Apache-2.0 License</span>
        </div>
      </div>
    </aside>
  );
}
