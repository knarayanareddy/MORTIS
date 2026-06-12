import React, { useState } from 'react';
import {
  Plus, Trash2, Search, HardDrive, Globe,
  FolderOpen, Database, Monitor, Layers, Tag, X
} from 'lucide-react';
import {
  ASSETS, Asset, AssetType, assetTypeLabel, formatBytes, formatDate, formatRelative
} from '../data/mortisData';

const ASSET_ICONS: Record<AssetType, React.ReactNode> = {
  local_file: <HardDrive size={14} />,
  local_dir: <FolderOpen size={14} />,
  db_record: <Database size={14} />,
  browser_profile: <Monitor size={14} />,
  cloud_account: <Globe size={14} />,
  custom: <Layers size={14} />,
};

const ASSET_COLORS: Record<AssetType, string> = {
  local_file: '#0a84ff',
  local_dir: '#ff9f0a',
  db_record: '#bf5af2',
  browser_profile: '#30d158',
  cloud_account: '#e50914',
  custom: '#86868b',
};

interface AddAssetModalProps {
  onClose: () => void;
  onAdd: (asset: Partial<Asset>) => void;
}

function AddAssetModal({ onClose, onAdd }: AddAssetModalProps) {
  const [form, setForm] = useState({
    type: 'local_file' as AssetType,
    path: '',
    label: '',
    priority: 80,
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f5f5f7' }}>Add Asset to Inventory</h2>
              <p style={{ fontSize: 13, color: '#86868b', marginTop: 4 }}>Register a digital asset for MORTIS to manage</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86868b', padding: 4 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: '#86868b', fontWeight: 500, display: 'block', marginBottom: 8 }}>Asset Type</label>
            <select
              className="select-field"
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value as AssetType })}
            >
              {(['local_file', 'local_dir', 'db_record', 'browser_profile', 'cloud_account', 'custom'] as AssetType[]).map(t => (
                <option key={t} value={t}>{assetTypeLabel(t)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#86868b', fontWeight: 500, display: 'block', marginBottom: 8 }}>Label</label>
            <input
              className="input-field"
              placeholder="e.g. SSH Private Key"
              value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value })}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#86868b', fontWeight: 500, display: 'block', marginBottom: 8 }}>Path / Identifier</label>
            <input
              className="input-field mono"
              placeholder={form.type === 'cloud_account' ? 'https://accounts.google.com' : '/path/to/asset'}
              value={form.path}
              onChange={e => setForm({ ...form, path: e.target.value })}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#86868b', fontWeight: 500, display: 'block', marginBottom: 8 }}>
              Priority <span style={{ color: '#48484a' }}>({form.priority})</span>
            </label>
            <input
              type="range" min={1} max={100}
              value={form.priority}
              onChange={e => setForm({ ...form, priority: +e.target.value })}
              style={{ width: '100%', accentColor: '#e50914' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#48484a', marginTop: 4 }}>
              <span>Low (1)</span><span>Critical (100)</span>
            </div>
          </div>

          <div style={{
            padding: '12px 14px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
          }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#86868b' }}>
              <span style={{ color: '#e50914' }}>$</span>{' '}
              <span style={{ color: '#79c0ff' }}>mortis inventory add</span>{' '}
              <span style={{ color: '#56d364' }}>--type {form.type}</span>{' '}
              {form.path && <><span style={{ color: '#56d364' }}>--path "{form.path}"</span>{' '}</>}
              {form.label && <><span style={{ color: '#56d364' }}>--label "{form.label}"</span>{' '}</>}
              <span style={{ color: '#56d364' }}>--priority {form.priority}</span>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 28px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => { onAdd(form); onClose(); }}
            disabled={!form.path || !form.label}
          >
            Add Asset
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Inventory() {
  const [assets, setAssets] = useState<Asset[]>(ASSETS);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<AssetType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = assets.filter(a => {
    const matchSearch = a.label.toLowerCase().includes(search.toLowerCase()) ||
      a.path.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || a.type === filterType;
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const handleAdd = (partial: Partial<Asset>) => {
    const newAsset: Asset = {
      id: crypto.randomUUID(),
      type: partial.type || 'local_file',
      path: partial.path || '',
      label: partial.label || '',
      priority: partial.priority || 80,
      status: 'active',
      added_at: new Date().toISOString(),
    };
    setAssets(prev => [newAsset, ...prev]);
  };

  const handleRemove = (id: string) => {
    if (window.confirm('Remove this asset from inventory? This will not sanitize it.')) {
      setAssets(prev => prev.filter(a => a.id !== id));
      if (selected === id) setSelected(null);
    }
  };

  const selectedAsset = selected ? assets.find(a => a.id === selected) : null;

  const typeCounts = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: '#f5f5f7' }}>Asset Inventory</h1>
          <p style={{ color: '#86868b', fontSize: 13, marginTop: 4 }}>
            {assets.length} assets registered · SQLCipher encrypted
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Add Asset
        </button>
      </div>

      {/* Type summary */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {Object.entries(typeCounts).map(([type, count]) => (
          <button
            key={type}
            onClick={() => setFilterType(filterType === type as AssetType ? 'all' : type as AssetType)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8,
              background: filterType === type ? `${ASSET_COLORS[type as AssetType]}18` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${filterType === type ? `${ASSET_COLORS[type as AssetType]}40` : 'rgba(255,255,255,0.06)'}`,
              cursor: 'pointer',
              transition: 'all 0.15s',
              color: filterType === type ? ASSET_COLORS[type as AssetType] : '#86868b',
              fontSize: 12, fontWeight: 500,
            }}
          >
            <span style={{ color: ASSET_COLORS[type as AssetType] }}>{ASSET_ICONS[type as AssetType]}</span>
            {assetTypeLabel(type as AssetType)}
            <span style={{
              padding: '1px 6px', borderRadius: 100,
              background: `${ASSET_COLORS[type as AssetType]}20`,
              color: ASSET_COLORS[type as AssetType],
              fontSize: 10, fontWeight: 700,
            }}>{count}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#48484a' }} />
          <input
            className="input-field"
            style={{ paddingLeft: 36 }}
            placeholder="Search assets by label or path..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="select-field" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="sanitized">Sanitized</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <div style={{ fontSize: 12, color: '#48484a', whiteSpace: 'nowrap' }}>
          {filtered.length} results
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap: 20 }}>

        {/* Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Type</th>
                <th>Path</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(asset => (
                <tr
                  key={asset.id}
                  onClick={() => setSelected(selected === asset.id ? null : asset.id)}
                  style={{
                    cursor: 'pointer',
                    background: selected === asset.id ? 'rgba(229,9,20,0.04)' : undefined,
                  }}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${ASSET_COLORS[asset.type]}15`,
                        border: `1px solid ${ASSET_COLORS[asset.type]}25`,
                        color: ASSET_COLORS[asset.type],
                      }}>
                        {ASSET_ICONS[asset.type]}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f7' }}>{asset.label}</div>
                        {asset.size_bytes && (
                          <div style={{ fontSize: 11, color: '#48484a' }}>{formatBytes(asset.size_bytes)}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, color: ASSET_COLORS[asset.type], fontWeight: 500 }}>
                      {assetTypeLabel(asset.type)}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#86868b',
                      maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', whiteSpace: 'nowrap',
                    }}>
                      {asset.path}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="progress-bar" style={{ width: 50 }}>
                        <div className="progress-fill" style={{
                          width: `${asset.priority}%`,
                          background: asset.priority >= 90 ? '#ff453a' : asset.priority >= 70 ? '#ff9f0a' : '#30d158',
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#86868b' }}>{asset.priority}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${asset.status === 'active' ? 'badge-green' : asset.status === 'sanitized' ? 'badge-blue' : 'badge-red'}`}>
                      {asset.status}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, color: '#48484a' }}>{formatRelative(asset.added_at)}</span>
                  </td>
                  <td>
                    <button
                      className="btn-danger"
                      style={{ padding: '4px 8px', fontSize: 11 }}
                      onClick={e => { e.stopPropagation(); handleRemove(asset.id); }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#48484a', padding: '40px 0' }}>
                    No assets match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        {selectedAsset && (
          <div className="card animate-slide-in" style={{ padding: 20, height: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f7' }}>Asset Detail</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#48484a' }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${ASSET_COLORS[selectedAsset.type]}15`,
                border: `1px solid ${ASSET_COLORS[selectedAsset.type]}30`,
                color: ASSET_COLORS[selectedAsset.type],
                fontSize: 18,
              }}>
                {ASSET_ICONS[selectedAsset.type]}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f7' }}>{selectedAsset.label}</div>
                <div style={{ fontSize: 11, color: ASSET_COLORS[selectedAsset.type] }}>{assetTypeLabel(selectedAsset.type)}</div>
              </div>
            </div>

            {[
              { label: 'Asset ID', value: selectedAsset.id.slice(0, 8) + '...', mono: true },
              { label: 'Full Path', value: selectedAsset.path, mono: true },
              { label: 'Priority', value: String(selectedAsset.priority) },
              { label: 'Status', value: selectedAsset.status },
              { label: 'Size', value: selectedAsset.size_bytes ? formatBytes(selectedAsset.size_bytes) : 'Unknown' },
              { label: 'Added', value: formatDate(selectedAsset.added_at) },
              { label: 'Last Sanitized', value: selectedAsset.last_sanitized ? formatDate(selectedAsset.last_sanitized) : 'Never' },
            ].map((row, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#48484a', marginBottom: 3 }}>{row.label}</div>
                <div style={{
                  fontSize: 12, color: '#c7c7cc',
                  fontFamily: row.mono ? 'JetBrains Mono, monospace' : undefined,
                  wordBreak: 'break-all',
                }}>
                  {row.value}
                </div>
              </div>
            ))}

            {selectedAsset.tags && selectedAsset.tags.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#48484a', marginBottom: 6 }}>Tags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selectedAsset.tags.map(tag => (
                    <span key={tag} style={{
                      padding: '2px 8px', borderRadius: 100,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      fontSize: 11, color: '#86868b', display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Tag size={9} />{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
              <button className="btn-danger" style={{ flex: 1 }} onClick={() => handleRemove(selectedAsset.id)}>
                Remove
              </button>
            </div>

            <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#86868b' }}>
                <span style={{ color: '#e50914' }}>$</span>{' '}
                <span style={{ color: '#79c0ff' }}>mortis inventory remove</span>{' '}
                <span style={{ color: '#56d364' }}>--id {selectedAsset.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {showAdd && <AddAssetModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
    </div>
  );
}
