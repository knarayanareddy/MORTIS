// ─── MORTIS Complete Data Model ───────────────────────────────────────────────

export type AssetType = 'local_file' | 'local_dir' | 'db_record' | 'browser_profile' | 'cloud_account' | 'custom';
export type PhaseType = 'revoke_remote' | 'sanitize_local' | 'clear_browser' | 'wipe_db' | 'self_destruct';
export type TriggerType = 'manual' | 'scheduled' | 'environmental' | 'remote_signal' | 'dead_man_switch';
export type AssetStatus = 'active' | 'sanitized' | 'pending' | 'failed';
export type PhaseResult = 'success' | 'partial' | 'failed' | 'skipped' | 'running' | 'pending';
export type OverallResult = 'success' | 'partial' | 'failed' | 'dry_run';
export type SanitizationMethod = 'overwrite_random' | 'crypto_erase' | 'overwrite_zeros' | 'key_discard' | 'overwrite_vacuum' | 'api_deletion' | 'delete_overwrite';

export interface Asset {
  id: string;
  type: AssetType;
  path: string;
  label: string;
  priority: number;
  status: AssetStatus;
  size_bytes?: number;
  added_at: string;
  last_sanitized?: string;
  tags?: string[];
}

export interface PlanPhase {
  id: string;
  phase_order: number;
  phase_type: PhaseType;
  asset_ids: string[];
  continue_on_failure: boolean;
  timeout_seconds?: number;
  plugin_name?: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  phases: PlanPhase[];
  created_at: string;
  last_run?: string;
  run_count: number;
}

export interface ReceiptPhase {
  phase_order: number;
  phase_type: PhaseType;
  plugin_name: string;
  result: PhaseResult;
  bytes_processed: number;
  duration_ms: number;
  assets_affected: number;
  error?: string;
}

export interface Receipt {
  run_id: string;
  schema_version: string;
  triggered_by: TriggerType;
  dry_run: boolean;
  coercion: boolean;
  plan_name: string;
  started_at: string;
  completed_at: string;
  phases: ReceiptPhase[];
  overall_result: OverallResult;
  phases_total: number;
  phases_succeeded: number;
  phases_failed: number;
  bytes_processed: number;
  signature: {
    algorithm: string;
    public_key_id: string;
    body_hash: string;
    value: string;
  };
  rfc3161_token: string | null;
  exit_code: number;
}

export interface Trigger {
  id: string;
  type: TriggerType;
  enabled: boolean;
  confidence_threshold: number;
  last_evaluated?: string;
  last_fired?: string;
  config: Record<string, string | number | boolean>;
  plan_id: string;
  fire_count: number;
}

export interface SelfCheckResult {
  check: string;
  duration_ms: number;
  passed: boolean;
  message?: string;
}

export interface SystemMetrics {
  db_size_bytes: number;
  total_assets: number;
  active_assets: number;
  sanitized_assets: number;
  total_runs: number;
  successful_runs: number;
  partial_runs: number;
  failed_runs: number;
  total_bytes_processed: number;
  receipts_count: number;
  last_run?: string;
  uptime_seconds: number;
}

// ─── SEED DATA ─────────────────────────────────────────────────────────────────

export const ASSETS: Asset[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    type: 'local_file',
    path: '/home/user/.ssh/id_rsa',
    label: 'SSH Private Key',
    priority: 100,
    status: 'active',
    size_bytes: 3247,
    added_at: '2026-01-15T10:00:00Z',
    tags: ['crypto', 'ssh', 'critical'],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    type: 'local_file',
    path: '/home/user/Documents/secrets.vault',
    label: 'Secrets Vault',
    priority: 95,
    status: 'active',
    size_bytes: 1048576,
    added_at: '2026-01-16T09:30:00Z',
    tags: ['vault', 'credentials'],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    type: 'local_dir',
    path: '/home/user/Projects/classified/',
    label: 'Classified Projects',
    priority: 90,
    status: 'active',
    size_bytes: 524288000,
    added_at: '2026-01-17T14:20:00Z',
    tags: ['source-code', 'classified'],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    type: 'cloud_account',
    path: 'https://accounts.google.com',
    label: 'Google Workspace',
    priority: 80,
    status: 'active',
    added_at: '2026-01-18T11:00:00Z',
    tags: ['cloud', 'email', 'drive'],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    type: 'cloud_account',
    path: 'https://github.com',
    label: 'GitHub Account',
    priority: 85,
    status: 'active',
    added_at: '2026-01-18T11:15:00Z',
    tags: ['cloud', 'code', 'repos'],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440006',
    type: 'browser_profile',
    path: '/home/user/.mozilla/firefox/default',
    label: 'Firefox Default Profile',
    priority: 70,
    status: 'active',
    size_bytes: 209715200,
    added_at: '2026-01-19T08:45:00Z',
    tags: ['browser', 'cookies', 'history'],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440007',
    type: 'db_record',
    path: 'postgresql://localhost:5432/app_db',
    label: 'Production DB Records',
    priority: 88,
    status: 'active',
    added_at: '2026-01-20T12:00:00Z',
    tags: ['database', 'pii', 'production'],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440008',
    type: 'local_file',
    path: '/home/user/.gnupg/secring.gpg',
    label: 'GPG Secret Keyring',
    priority: 98,
    status: 'sanitized',
    size_bytes: 4096,
    added_at: '2026-01-10T10:00:00Z',
    last_sanitized: '2026-06-01T03:00:00Z',
    tags: ['crypto', 'gpg', 'critical'],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440009',
    type: 'local_dir',
    path: '/tmp/sensitive-cache/',
    label: 'Sensitive Cache',
    priority: 60,
    status: 'sanitized',
    size_bytes: 52428800,
    added_at: '2026-02-01T09:00:00Z',
    last_sanitized: '2026-06-10T02:00:00Z',
    tags: ['cache', 'temp'],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440010',
    type: 'cloud_account',
    path: 'https://aws.amazon.com',
    label: 'AWS Root Account',
    priority: 92,
    status: 'active',
    added_at: '2026-02-05T11:30:00Z',
    tags: ['cloud', 'aws', 'critical'],
  },
];

export const PLANS: Plan[] = [
  {
    id: 'plan-001',
    name: 'emergency_wipe',
    description: 'Full emergency data destruction — all assets, all phases',
    is_default: true,
    run_count: 3,
    created_at: '2026-01-15T12:00:00Z',
    last_run: '2026-06-01T03:00:00Z',
    phases: [
      { id: 'ph-001-1', phase_order: 0, phase_type: 'revoke_remote', asset_ids: ['550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440010'], continue_on_failure: true, timeout_seconds: 30, plugin_name: 'DeletionPlugin' },
      { id: 'ph-001-2', phase_order: 1, phase_type: 'sanitize_local', asset_ids: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003'], continue_on_failure: true, timeout_seconds: 120, plugin_name: 'FileOverwritePlugin' },
      { id: 'ph-001-3', phase_order: 2, phase_type: 'clear_browser', asset_ids: ['550e8400-e29b-41d4-a716-446655440006'], continue_on_failure: true, timeout_seconds: 60, plugin_name: 'BrowserStatePlugin' },
      { id: 'ph-001-4', phase_order: 3, phase_type: 'wipe_db', asset_ids: ['550e8400-e29b-41d4-a716-446655440007'], continue_on_failure: false, timeout_seconds: 90, plugin_name: 'DatabaseRecordPlugin' },
      { id: 'ph-001-5', phase_order: 4, phase_type: 'self_destruct', asset_ids: [], continue_on_failure: true, plugin_name: 'SelfDestructPlugin' },
    ],
  },
  {
    id: 'plan-002',
    name: 'crypto_purge',
    description: 'Cryptographic material only — SSH keys, GPG, certificates',
    is_default: false,
    run_count: 7,
    created_at: '2026-01-20T09:00:00Z',
    last_run: '2026-06-10T02:00:00Z',
    phases: [
      { id: 'ph-002-1', phase_order: 0, phase_type: 'sanitize_local', asset_ids: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440008'], continue_on_failure: false, timeout_seconds: 30, plugin_name: 'FileOverwritePlugin' },
    ],
  },
  {
    id: 'plan-003',
    name: 'cloud_revoke',
    description: 'Remote account revocation — cloud services only',
    is_default: false,
    run_count: 2,
    created_at: '2026-02-01T10:00:00Z',
    phases: [
      { id: 'ph-003-1', phase_order: 0, phase_type: 'revoke_remote', asset_ids: ['550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440010'], continue_on_failure: true, timeout_seconds: 60, plugin_name: 'DeletionPlugin' },
    ],
  },
  {
    id: 'plan-004',
    name: 'minimal_cache',
    description: 'Browser and cache cleanup — low impact, frequent use',
    is_default: false,
    run_count: 14,
    created_at: '2026-02-10T11:00:00Z',
    last_run: '2026-06-12T00:00:00Z',
    phases: [
      { id: 'ph-004-1', phase_order: 0, phase_type: 'clear_browser', asset_ids: ['550e8400-e29b-41d4-a716-446655440006'], continue_on_failure: true, timeout_seconds: 30, plugin_name: 'BrowserStatePlugin' },
      { id: 'ph-004-2', phase_order: 1, phase_type: 'sanitize_local', asset_ids: ['550e8400-e29b-41d4-a716-446655440009'], continue_on_failure: true, timeout_seconds: 30, plugin_name: 'DirectorySanitizePlugin' },
    ],
  },
];

export const RECEIPTS: Receipt[] = [
  {
    run_id: 'run-a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    schema_version: '1.0',
    triggered_by: 'manual',
    dry_run: false,
    coercion: false,
    plan_name: 'crypto_purge',
    started_at: '2026-06-12T14:22:01Z',
    completed_at: '2026-06-12T14:22:03Z',
    phases: [
      { phase_order: 0, phase_type: 'sanitize_local', plugin_name: 'FileOverwritePlugin', result: 'success', bytes_processed: 7343, duration_ms: 87, assets_affected: 2 },
    ],
    overall_result: 'success',
    phases_total: 1,
    phases_succeeded: 1,
    phases_failed: 0,
    bytes_processed: 7343,
    signature: { algorithm: 'Ed25519', public_key_id: 'dGVzdGtleQ', body_hash: 'a3f8d2e1b4c7f9a0b2d4e6f8a1c3e5d7f9b2c4d6e8f0a2c4d6e8f0a2c4d6e8f0', value: 'dGVzdHNpZ25hdHVyZQ' },
    rfc3161_token: 'MHQwagIBADANBgkqhkiG9w0BAQsFAAQgYuHPqw==',
    exit_code: 0,
  },
  {
    run_id: 'run-b2c3d4e5-f6a7-8901-bcde-f12345678901',
    schema_version: '1.0',
    triggered_by: 'scheduled',
    dry_run: false,
    coercion: false,
    plan_name: 'minimal_cache',
    started_at: '2026-06-12T00:00:02Z',
    completed_at: '2026-06-12T00:00:09Z',
    phases: [
      { phase_order: 0, phase_type: 'clear_browser', plugin_name: 'BrowserStatePlugin', result: 'success', bytes_processed: 209715200, duration_ms: 4200, assets_affected: 1 },
      { phase_order: 1, phase_type: 'sanitize_local', plugin_name: 'DirectorySanitizePlugin', result: 'success', bytes_processed: 52428800, duration_ms: 2800, assets_affected: 1 },
    ],
    overall_result: 'success',
    phases_total: 2,
    phases_succeeded: 2,
    phases_failed: 0,
    bytes_processed: 262144000,
    signature: { algorithm: 'Ed25519', public_key_id: 'dGVzdGtleQ', body_hash: 'f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f1e2', value: 'c2NoZWR1bGVkU2lnbg' },
    rfc3161_token: null,
    exit_code: 0,
  },
  {
    run_id: 'run-c3d4e5f6-a7b8-9012-cdef-123456789012',
    schema_version: '1.0',
    triggered_by: 'manual',
    dry_run: true,
    coercion: false,
    plan_name: 'emergency_wipe',
    started_at: '2026-06-11T16:44:00Z',
    completed_at: '2026-06-11T16:44:01Z',
    phases: [
      { phase_order: 0, phase_type: 'revoke_remote', plugin_name: 'DeletionPlugin', result: 'success', bytes_processed: 0, duration_ms: 12, assets_affected: 3 },
      { phase_order: 1, phase_type: 'sanitize_local', plugin_name: 'FileOverwritePlugin', result: 'success', bytes_processed: 0, duration_ms: 8, assets_affected: 3 },
      { phase_order: 2, phase_type: 'clear_browser', plugin_name: 'BrowserStatePlugin', result: 'success', bytes_processed: 0, duration_ms: 5, assets_affected: 1 },
      { phase_order: 3, phase_type: 'wipe_db', plugin_name: 'DatabaseRecordPlugin', result: 'success', bytes_processed: 0, duration_ms: 6, assets_affected: 1 },
      { phase_order: 4, phase_type: 'self_destruct', plugin_name: 'SelfDestructPlugin', result: 'success', bytes_processed: 0, duration_ms: 3, assets_affected: 0 },
    ],
    overall_result: 'dry_run',
    phases_total: 5,
    phases_succeeded: 5,
    phases_failed: 0,
    bytes_processed: 0,
    signature: { algorithm: 'Ed25519', public_key_id: 'dGVzdGtleQ', body_hash: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5', value: 'ZHJ5UnVuU2lnbmF0dXJl' },
    rfc3161_token: null,
    exit_code: 0,
  },
  {
    run_id: 'run-d4e5f6a7-b8c9-0123-defa-234567890123',
    schema_version: '1.0',
    triggered_by: 'dead_man_switch',
    dry_run: false,
    coercion: false,
    plan_name: 'cloud_revoke',
    started_at: '2026-06-10T18:30:00Z',
    completed_at: '2026-06-10T18:30:45Z',
    phases: [
      { phase_order: 0, phase_type: 'revoke_remote', plugin_name: 'DeletionPlugin', result: 'partial', bytes_processed: 0, duration_ms: 44800, assets_affected: 2, error: 'AWS rate limit exceeded; 1 of 3 accounts revoked' },
    ],
    overall_result: 'partial',
    phases_total: 1,
    phases_succeeded: 0,
    phases_failed: 1,
    bytes_processed: 0,
    signature: { algorithm: 'Ed25519', public_key_id: 'dGVzdGtleQ', body_hash: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6', value: 'cGFydGlhbFNpZ25hdA' },
    rfc3161_token: 'MHQwagIBADANBgkqhkiG9w0BAQsFAAQgZmFrZXRzYQ==',
    exit_code: 1,
  },
  {
    run_id: 'run-e5f6a7b8-c9d0-1234-efab-345678901234',
    schema_version: '1.0',
    triggered_by: 'manual',
    dry_run: false,
    coercion: false,
    plan_name: 'emergency_wipe',
    started_at: '2026-06-01T03:00:00Z',
    completed_at: '2026-06-01T03:00:08Z',
    phases: [
      { phase_order: 0, phase_type: 'revoke_remote', plugin_name: 'DeletionPlugin', result: 'success', bytes_processed: 0, duration_ms: 3200, assets_affected: 3 },
      { phase_order: 1, phase_type: 'sanitize_local', plugin_name: 'FileOverwritePlugin', result: 'success', bytes_processed: 525340672, duration_ms: 3400, assets_affected: 3 },
      { phase_order: 2, phase_type: 'clear_browser', plugin_name: 'BrowserStatePlugin', result: 'success', bytes_processed: 209715200, duration_ms: 800, assets_affected: 1 },
      { phase_order: 3, phase_type: 'wipe_db', plugin_name: 'DatabaseRecordPlugin', result: 'success', bytes_processed: 0, duration_ms: 400, assets_affected: 1 },
      { phase_order: 4, phase_type: 'self_destruct', plugin_name: 'SelfDestructPlugin', result: 'skipped', bytes_processed: 0, duration_ms: 0, assets_affected: 0 },
    ],
    overall_result: 'success',
    phases_total: 5,
    phases_succeeded: 4,
    phases_failed: 0,
    bytes_processed: 735055872,
    signature: { algorithm: 'Ed25519', public_key_id: 'dGVzdGtleQ', body_hash: 'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7', value: 'ZnVsbFdpcGVTaWduYXR1cmU' },
    rfc3161_token: 'MHQwagIBADANBgkqhkiG9w0BAQsFAAQgZnVsbFdpcGU=',
    exit_code: 0,
  },
];

export const TRIGGERS: Trigger[] = [
  {
    id: 'trg-001',
    type: 'manual',
    enabled: true,
    confidence_threshold: 1.0,
    last_evaluated: '2026-06-12T14:22:01Z',
    last_fired: '2026-06-12T14:22:01Z',
    config: {},
    plan_id: 'plan-002',
    fire_count: 10,
  },
  {
    id: 'trg-002',
    type: 'scheduled',
    enabled: true,
    confidence_threshold: 1.0,
    last_evaluated: '2026-06-12T00:00:00Z',
    last_fired: '2026-06-12T00:00:02Z',
    config: { cron: '0 0 0 * * *', description: 'Every day at midnight' },
    plan_id: 'plan-004',
    fire_count: 42,
  },
  {
    id: 'trg-003',
    type: 'dead_man_switch',
    enabled: true,
    confidence_threshold: 0.9,
    last_evaluated: '2026-06-12T18:00:00Z',
    last_fired: '2026-06-10T18:30:00Z',
    config: { timeout_seconds: 86400, last_checkin: '2026-06-12T10:00:00Z', checkin_remaining_seconds: 57600 },
    plan_id: 'plan-003',
    fire_count: 1,
  },
  {
    id: 'trg-004',
    type: 'environmental',
    enabled: false,
    confidence_threshold: 0.8,
    last_evaluated: '2026-06-11T20:00:00Z',
    config: { conditions: 'network_change,geofence_exit', geofence_radius_km: 50 },
    plan_id: 'plan-001',
    fire_count: 0,
  },
  {
    id: 'trg-005',
    type: 'remote_signal',
    enabled: false,
    confidence_threshold: 0.85,
    config: { channel: 'signal_messenger', keyword: 'MORTIS_EXECUTE', verified_sender: '+1-555-0100' },
    plan_id: 'plan-001',
    fire_count: 0,
  },
];

export const SELF_CHECK_RESULTS: SelfCheckResult[] = [
  { check: 'passphrase_init', duration_ms: 343, passed: true },
  { check: 'passphrase_verify', duration_ms: 339, passed: true },
  { check: 'receipt_sign', duration_ms: 1, passed: true },
  { check: 'receipt_verify', duration_ms: 0, passed: true },
  { check: 'db_integrity', duration_ms: 12, passed: true },
  { check: 'crypto_primitives', duration_ms: 5, passed: true },
  { check: 'plugin_registry', duration_ms: 2, passed: true },
  { check: 'salt_file_present', duration_ms: 0, passed: true },
  { check: 'schema_version', duration_ms: 1, passed: true },
];

export const SYSTEM_METRICS: SystemMetrics = {
  db_size_bytes: 4718592,
  total_assets: 10,
  active_assets: 8,
  sanitized_assets: 2,
  total_runs: 26,
  successful_runs: 22,
  partial_runs: 3,
  failed_runs: 1,
  total_bytes_processed: 2147483648,
  receipts_count: 26,
  last_run: '2026-06-12T14:22:03Z',
  uptime_seconds: 2419200,
};

export const ACTIVITY_DATA = [
  { date: 'Jun 6', runs: 2, bytes: 450 },
  { date: 'Jun 7', runs: 1, bytes: 210 },
  { date: 'Jun 8', runs: 3, bytes: 980 },
  { date: 'Jun 9', runs: 0, bytes: 0 },
  { date: 'Jun 10', runs: 2, bytes: 320 },
  { date: 'Jun 11', runs: 4, bytes: 1200 },
  { date: 'Jun 12', runs: 3, bytes: 760 },
];

// ─── HELPERS ────────────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function assetTypeLabel(t: AssetType): string {
  const map: Record<AssetType, string> = {
    local_file: 'Local File',
    local_dir: 'Local Directory',
    db_record: 'Database Record',
    browser_profile: 'Browser Profile',
    cloud_account: 'Cloud Account',
    custom: 'Custom',
  };
  return map[t];
}

export function phaseTypeLabel(t: PhaseType): string {
  const map: Record<PhaseType, string> = {
    revoke_remote: 'Revoke Remote',
    sanitize_local: 'Sanitize Local',
    clear_browser: 'Clear Browser',
    wipe_db: 'Wipe Database',
    self_destruct: 'Self-Destruct',
  };
  return map[t];
}

export function triggerTypeLabel(t: TriggerType): string {
  const map: Record<TriggerType, string> = {
    manual: 'Manual',
    scheduled: 'Scheduled',
    environmental: 'Environmental',
    remote_signal: 'Remote Signal',
    dead_man_switch: "Dead Man's Switch",
  };
  return map[t];
}

export const EXIT_CODES = [
  { code: 0, spec: '§5.1', meaning: 'Full success', implemented: true },
  { code: 1, spec: '§5.1', meaning: 'Partial success (some phases failed)', implemented: true },
  { code: 2, spec: '§5.1', meaning: 'Passphrase verification failed', implemented: true },
  { code: 3, spec: '§5.1', meaning: 'Plan load failed', implemented: true },
  { code: 4, spec: '§5.1', meaning: 'Database error', implemented: true },
  { code: 5, spec: '§5.1', meaning: 'Not found', implemented: true },
  { code: 6, spec: '§5.1', meaning: 'Invalid receipt (schema error)', implemented: true },
  { code: 7, spec: '§5.1', meaning: 'Tampered (signature/hash mismatch)', implemented: true },
  { code: 8, spec: '§5.1', meaning: 'Trigger would not fire', implemented: true },
  { code: 9, spec: '§5.1', meaning: 'Integrity check failed', implemented: true },
];

export const THREAT_MODEL = [
  { id: 'T-1', threat: 'Passphrase brute-force', mitigation: 'PBKDF2 100k iterations + 32-byte salt', severity: 'critical' },
  { id: 'T-2', threat: 'Receipt tampering', mitigation: 'Ed25519 signature + canonical JSON hash', severity: 'high' },
  { id: 'T-3', threat: 'Plugin panic / crash', mitigation: 'Orchestrator catch; treated as phase failure', severity: 'medium' },
  { id: 'T-4', threat: 'Plugin timeout', mitigation: 'Configurable per-plugin timeout enforcement', severity: 'medium' },
  { id: 'T-5', threat: 'Memory dump / cold boot', mitigation: 'All key material zeroized on drop (zeroize crate)', severity: 'high' },
  { id: 'T-6', threat: 'Supply chain attack', mitigation: 'Reproducible builds + cosign signing + SBOM', severity: 'high' },
  { id: 'T-7', threat: 'False positive trigger', mitigation: 'Dry-run-first policy + confidence threshold', severity: 'medium' },
  { id: 'T-8', threat: 'Coercion / duress', mitigation: 'Secondary duress passphrase with reduced plan', severity: 'high' },
  { id: 'T-9', threat: 'Incomplete cloud deletion', mitigation: 'Best-effort with receipt tagging; no guarantee', severity: 'low' },
  { id: 'T-10', threat: 'SSD wear leveling bypass', mitigation: 'Cryptographic erase recommended for flash media', severity: 'medium' },
  { id: 'T-11', threat: 'Log forensics', mitigation: 'Logs destroyed in self_destruct phase', severity: 'medium' },
  { id: 'T-12', threat: 'DB schema version mismatch', mitigation: 'Schema version checked at startup', severity: 'low' },
];

export const SANITIZATION_MATRIX = [
  { media: 'HDD (magnetic)', method: 'Overwrite (1-pass, random)', notes: 'Multi-pass adds no benefit per NIST SP 800-88', nist: 'Clear' },
  { media: 'SSD / NVMe', method: 'Cryptographic Erase', notes: 'Overwrite unreliable due to wear leveling', nist: 'Purge' },
  { media: 'eMMC / SD Card', method: 'Cryptographic Erase', notes: 'Same as SSD — flash media', nist: 'Purge' },
  { media: 'RAM disk / tmpfs', method: 'Overwrite (1-pass, zeros)', notes: 'Ephemeral storage', nist: 'Clear' },
  { media: 'Encrypted volume', method: 'Discard encryption key', notes: 'Key discard = data unrecoverable', nist: 'Purge' },
  { media: 'Database records', method: 'Overwrite fields + VACUUM', notes: 'Include WAL + journal files', nist: 'Clear' },
  { media: 'Browser profile', method: 'Delete + overwrite free space', notes: 'Includes LocalStorage, IndexedDB, cookies', nist: 'Clear' },
  { media: 'Cloud storage', method: 'API deletion (best-effort)', notes: 'Cannot guarantee cloud erasure', nist: 'N/A' },
];

export const CRATE_STRUCTURE = [
  { crate: 'mortis-types', purpose: 'Shared types, zero internal deps', deps: 'serde, chrono, uuid' },
  { crate: 'mortis-crypto', purpose: 'Ed25519, SHA-256, PBKDF2, AES-256-GCM, RFC 3161', deps: 'ring, ed25519-dalek, aes-gcm' },
  { crate: 'mortis-plugins', purpose: 'Plugin traits + built-in sanitization/deletion', deps: 'async-trait, walkdir' },
  { crate: 'mortis-db', purpose: 'SQLCipher persistence, Appendix A schema', deps: 'rusqlite (bundled-sqlcipher)' },
  { crate: 'mortis-core', purpose: 'Orchestrator, passphrase interlock, triggers, scrubbing', deps: 'mortis-crypto, mortis-plugins' },
  { crate: 'mortis-cli', purpose: 'CLI binary, secure input, SLO benchmarks', deps: 'clap, rpassword, zeroize' },
];

export const SPEC_COMPLIANCE = [
  { section: 'Appendix A (DB Schema)', status: 'implemented', notes: 'SQLCipher with all tables' },
  { section: 'Appendix B (Receipt Schema)', status: 'implemented', notes: 'JSON schema + Ed25519 signature' },
  { section: 'Appendix C (Sanitization Matrix)', status: 'implemented', notes: 'NIST SP 800-88 aligned' },
  { section: 'Appendix D (Threat/Mitigation)', status: 'documented', notes: 'All T-1 through T-12' },
  { section: '§5.2 (Plugin Traits)', status: 'implemented', notes: 'Async traits with timeout enforcement' },
  { section: '§7 (Crypto Model)', status: 'implemented', notes: 'All primitives from audited crates' },
];

export const RUNBOOKS = [
  {
    id: 'RB-01',
    title: 'Power Loss Mid-Run',
    symptom: 'Process killed during execution.',
    steps: [
      'mortis receipt list',
      'mortis receipt finalize --run-id <id>',
      'mortis receipt inspect --run-id <id>',
      'mortis run --plan <path> --resume-from <phase>',
    ],
    comments: ['# Check for interrupted receipt', '# Finalize partial receipt', '# Review completed phases', '# Re-run remaining phases manually'],
  },
  {
    id: 'RB-02',
    title: 'Passphrase Forgotten',
    symptom: 'There is no recovery. The database is encrypted; there is no master key escrow.',
    steps: [
      '# Option 1: Use passphrase backup (physical safe)',
      '# Option 2: Restore database backup from before rotation',
      'rm ~/.mortis/mortis.db && mortis config init',
    ],
    comments: ['', '', '# Option 3: Delete and re-initialize'],
  },
  {
    id: 'RB-03',
    title: 'Plugin Failure',
    symptom: 'Remote deletion is best-effort. Exit code 1 = partial success.',
    steps: [
      'mortis receipt inspect --run-id <id>',
      'mortis run --plan <path> --phases <plugin_name>',
    ],
    comments: ['# Inspect failure detail', '# Re-run specific phase only'],
  },
  {
    id: 'RB-04',
    title: 'Receipt Verification',
    symptom: 'Need to audit or present cryptographic proof of destruction.',
    steps: [
      'mortis receipt verify --receipt <path>',
      'mortis receipt verify --receipt <path> --rfc3161',
      'mortis receipt export --receipt <path> --format json',
    ],
    comments: ['# Verify Ed25519 signature', '# Verify with RFC 3161 timestamp', '# Export human-readable format'],
  },
  {
    id: 'RB-05',
    title: 'False Positive Trigger',
    symptom: 'Trigger fired unexpectedly without intended activation.',
    steps: [
      'mortis trigger disable --type <type>',
      'mortis receipt inspect --run-id <last>',
      '# Edit plan file and adjust trigger sensitivity',
      'mortis trigger enable --type <type>',
    ],
    comments: ['# Stop trigger immediately', '# Review what happened', '', '# Re-enable after adjustment'],
  },
  {
    id: 'RB-06',
    title: 'Self-Check Fails',
    symptom: 'SLO benchmark or integrity check fails.',
    steps: [
      'mortis self-check',
      './scripts/build-reproducible.sh',
    ],
    comments: ['# Verify binary integrity', '# Re-download and verify if fails'],
  },
  {
    id: 'RB-07',
    title: 'Safe Testing',
    symptom: 'Need to test MORTIS without risk to real assets.',
    steps: [
      'mortis --db /tmp/test.db config init --passphrase-env TEST_PASS',
      'export TEST_PASS="test123"',
      'mortis --db /tmp/test.db inventory add --type local_file --path /tmp/test_secret.txt',
      'mortis --db /tmp/test.db run --plan test.toml --dry-run',
      'mortis --db /tmp/test.db receipt list',
      'mortis --db /tmp/test.db run --plan test.toml',
    ],
    comments: ['# Use isolated database', '', '# Add test assets', '# Dry-run first', '# Verify dry-run receipt', '# Only then run live'],
  },
];
