import { useState } from 'react';
import Sidebar, { View } from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Plans from './components/Plans';
import Triggers from './components/Triggers';
import Receipts from './components/Receipts';
import Security from './components/Security';
import Architecture from './components/Architecture';
import CLIReference from './components/CLIReference';
import Runbooks from './components/Runbooks';
import SelfCheck from './components/SelfCheck';

export default function App() {
  const [view, setView] = useState<View>('dashboard');

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <Dashboard />;
      case 'inventory': return <Inventory />;
      case 'plans': return <Plans />;
      case 'triggers': return <Triggers />;
      case 'receipts': return <Receipts />;
      case 'security': return <Security />;
      case 'architecture': return <Architecture />;
      case 'cli': return <CLIReference />;
      case 'runbooks': return <Runbooks />;
      case 'selfcheck': return <SelfCheck />;
      default: return <Dashboard />;
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#050505',
      overflow: 'hidden',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(229,9,20,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(229,9,20,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Radial glow top-right */}
      <div style={{
        position: 'fixed',
        top: -200,
        right: -200,
        width: 600,
        height: 600,
        background: 'radial-gradient(circle, rgba(229,9,20,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <Sidebar active={view} onNavigate={setView} />

      <main style={{
        flex: 1,
        overflowY: 'auto',
        position: 'relative',
        zIndex: 1,
        maxHeight: '100vh',
      }}>
        {renderView()}
      </main>
    </div>
  );
}
