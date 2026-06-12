import { useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';

interface Command {
  name: string;
  description: string;
  syntax: string;
  examples: string[];
  flags?: string[];
  exitCodes?: string[];
  creates?: string[];
}

const COMMANDS: Command[] = [
  {
    name: 'mortis config init',
    description: 'Initialize MORTIS configuration. Creates encrypted database and salt file.',
    syntax: 'mortis config init [OPTIONS]',
    examples: [
      'mortis config init',
      'mortis config init --passphrase-env MORTIS_PASS',
      'mortis --db /secure/path/mortis.db config init',
    ],
    flags: [
      '--passphrase-env <VAR>  Read passphrase from environment variable',
      '--db <PATH>             Custom database path',
    ],
    creates: [
      '~/.mortis/mortis.db     SQLCipher-encrypted database',
      '~/.mortis/mortis.salt   PBKDF2 salt (32 bytes, base64-encoded)',
    ],
  },
  {
    name: 'mortis config rotate-key',
    description: 'Re-encrypt the database with a new passphrase.',
    syntax: 'mortis config rotate-key [OPTIONS]',
    examples: [
      'mortis config rotate-key',
      'mortis config rotate-key --old-passphrase-env OLD --new-passphrase-env NEW',
    ],
    flags: [
      '--old-passphrase-env <VAR>  Old passphrase env variable',
      '--new-passphrase-env <VAR>  New passphrase env variable',
    ],
  },
  {
    name: 'mortis inventory add',
    description: 'Register a digital asset in the inventory.',
    syntax: 'mortis inventory add --type <TYPE> --path <PATH> [OPTIONS]',
    examples: [
      'mortis inventory add --type local_file --path /path/to/secret.txt --label "Secret"',
      'mortis inventory add --type local_dir  --path /path/to/secrets/  --priority 90',
      'mortis inventory add --type cloud_account --path "https://accounts.google.com" --label "Google"',
    ],
    flags: [
      '--type <TYPE>      Asset type: local_file|local_dir|db_record|browser_profile|cloud_account|custom',
      '--path <PATH>      Path or identifier of the asset',
      '--label <LABEL>    Human-readable label',
      '--priority <N>     Priority 1-100 (default: 80)',
    ],
  },
  {
    name: 'mortis inventory list',
    description: 'List all assets in the inventory.',
    syntax: 'mortis inventory list [OPTIONS]',
    examples: [
      'mortis inventory list',
      'mortis inventory list --format json',
    ],
    flags: ['--format <FMT>   Output format: table|json (default: table)'],
  },
  {
    name: 'mortis inventory remove',
    description: 'Remove an asset from the inventory (does not sanitize it).',
    syntax: 'mortis inventory remove --id <UUID> [--force]',
    examples: [
      'mortis inventory remove --id <uuid>',
      'mortis inventory remove --id <uuid> --force',
    ],
    flags: [
      '--id <UUID>   Asset UUID from inventory list',
      '--force       Skip confirmation prompt',
    ],
  },
  {
    name: 'mortis run',
    description: 'Execute a destruction plan.',
    syntax: 'mortis run --plan <PATH> [OPTIONS]',
    examples: [
      'mortis run --plan emergency.toml --dry-run',
      'mortis run --plan emergency.toml',
      'mortis run --plan emergency.toml --no-timestamp',
      'mortis run --plan emergency.toml --passphrase-env MORTIS_PASS',
    ],
    flags: [
      '--plan <PATH>            Path to plan TOML file',
      '--dry-run                Preview only — no mutations',
      '--no-timestamp           Skip RFC 3161 timestamping',
      '--passphrase-env <VAR>   Read passphrase from environment variable',
      '--resume-from <PHASE>    Resume from a specific phase (after interruption)',
    ],
    exitCodes: [
      '0  Full success',
      '1  Partial success (some phases failed)',
      '2  Passphrase verification failed',
      '3  Plan load failed',
    ],
  },
  {
    name: 'mortis receipt verify',
    description: 'Verify a receipt\'s cryptographic Ed25519 signature.',
    syntax: 'mortis receipt verify --receipt <PATH> [--rfc3161]',
    examples: [
      'mortis receipt verify --receipt ~/.mortis/receipts/<run-id>.receipt.json',
      'mortis receipt verify --receipt <path> --rfc3161',
    ],
    flags: [
      '--receipt <PATH>  Path to receipt JSON file',
      '--rfc3161         Also verify RFC 3161 timestamp if present',
    ],
    exitCodes: [
      '0  Valid signature',
      '6  Invalid (schema error)',
      '7  Tampered (signature/hash mismatch)',
    ],
  },
  {
    name: 'mortis receipt list',
    description: 'List recent receipts.',
    syntax: 'mortis receipt list [--last <N>]',
    examples: [
      'mortis receipt list',
      'mortis receipt list --last 50',
    ],
    flags: ['--last <N>  Number of receipts to show (default: 10)'],
  },
  {
    name: 'mortis receipt inspect',
    description: 'Show full detail of a specific receipt.',
    syntax: 'mortis receipt inspect --run-id <UUID>',
    examples: ['mortis receipt inspect --run-id <uuid>'],
    flags: ['--run-id <UUID>  Run UUID to inspect'],
  },
  {
    name: 'mortis receipt finalize',
    description: 'Finalize an interrupted receipt (after power loss mid-run).',
    syntax: 'mortis receipt finalize --run-id <UUID>',
    examples: ['mortis receipt finalize --run-id <uuid>'],
    flags: ['--run-id <UUID>  UUID of interrupted run'],
  },
  {
    name: 'mortis receipt export',
    description: 'Export a receipt in human-readable format.',
    syntax: 'mortis receipt export --receipt <PATH> --format <FMT>',
    examples: ['mortis receipt export --receipt <path> --format json'],
    flags: [
      '--receipt <PATH>  Path to receipt file',
      '--format <FMT>    Output format: json',
    ],
  },
  {
    name: 'mortis trigger test',
    description: 'Test a trigger without firing the plan (dry-run mode).',
    syntax: 'mortis trigger test --type <TYPE> [--dry-run]',
    examples: [
      'mortis trigger test --type manual --dry-run',
      'mortis trigger test --type scheduled --dry-run',
    ],
    flags: [
      '--type <TYPE>  Trigger type: manual|scheduled|environmental|remote_signal|dead_man_switch',
      '--dry-run      Do not fire; only evaluate confidence',
    ],
    exitCodes: ['0  Would fire (confidence ≥ threshold)', '8  Would NOT fire'],
  },
  {
    name: 'mortis trigger list',
    description: 'List all configured triggers and their status.',
    syntax: 'mortis trigger list',
    examples: ['mortis trigger list'],
  },
  {
    name: 'mortis trigger disable / enable',
    description: 'Enable or disable a trigger type.',
    syntax: 'mortis trigger disable|enable --type <TYPE>',
    examples: [
      'mortis trigger disable --type scheduled',
      'mortis trigger enable --type scheduled',
    ],
    flags: ['--type <TYPE>  Trigger type to modify'],
  },
  {
    name: 'mortis self-check',
    description: 'Run SLO benchmarks and integrity verification.',
    syntax: 'mortis self-check',
    examples: ['mortis self-check'],
  },
];

const GLOBAL_OPTIONS = [
  ['--db <DB>', 'Database path [default: ~/.mortis/mortis.db]'],
  ['--passphrase-env <VAR>', 'Read passphrase from environment variable'],
  ['-v, --verbose', 'Verbose output'],
  ['--log-level <LEVEL>', 'Log level: trace|debug|info|warn|error [default: info]'],
  ['-h, --help', 'Print help'],
  ['-V, --version', 'Print version'],
];

const ENV_VARS = [
  ['MORTIS_PASS', 'Passphrase (use with --passphrase-env)'],
  ['MORTIS_DB', 'Default database path override'],
  ['RUST_LOG', 'Log level override'],
];

function CommandBlock({ cmd }: { cmd: Command }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
          padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <span style={{ color: open ? '#e50914' : '#48484a' }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#0a84ff' }}>
          {cmd.name}
        </span>
        <span style={{ fontSize: 12, color: '#86868b' }}>{cmd.description}</span>
      </button>

      {open && (
        <div style={{ padding: '0 18px 18px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {/* Syntax */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, color: '#48484a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>Syntax</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, padding: '8px 12px', background: '#0a0a0a', borderRadius: 8, color: '#79c0ff', border: '1px solid rgba(255,255,255,0.04)' }}>
              {cmd.syntax}
            </div>
          </div>

          {/* Examples */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, color: '#48484a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>Examples</div>
            <div className="terminal">
              <div className="terminal-header">
                <div className="terminal-dot" style={{ background: '#ff5f56' }} />
                <div className="terminal-dot" style={{ background: '#ffbd2e' }} />
                <div className="terminal-dot" style={{ background: '#27c93f' }} />
              </div>
              <div className="terminal-body">
                {cmd.examples.map((ex, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4, cursor: 'pointer' }} onClick={() => copy(ex)}>
                    <span className="terminal-prompt">$</span>
                    <span className="terminal-cmd">{ex}</span>
                    {copied === ex && <span style={{ fontSize: 10, color: '#30d158', marginLeft: 'auto' }}>✓</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Flags */}
          {cmd.flags && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, color: '#48484a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>Flags</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {cmd.flags.map((f, i) => {
                  const [flag, ...desc] = f.split('  ');
                  return (
                    <div key={i} style={{ display: 'flex', gap: 16, padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#56d364', minWidth: 200, flexShrink: 0 }}>{flag}</span>
                      <span style={{ fontSize: 11, color: '#86868b' }}>{desc.join('  ')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Exit codes */}
          {cmd.exitCodes && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, color: '#48484a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>Exit Codes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {cmd.exitCodes.map((e, i) => {
                  const [code, ...rest] = e.split('  ');
                  const codeNum = parseInt(code.trim());
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, minWidth: 20,
                        color: codeNum === 0 ? '#30d158' : codeNum <= 3 ? '#ff9f0a' : '#ff453a',
                      }}>{code.trim()}</span>
                      <span style={{ fontSize: 11, color: '#86868b' }}>{rest.join('  ')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Creates */}
          {cmd.creates && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, color: '#48484a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>Creates</div>
              {cmd.creates.map((c, i) => {
                const [file, ...desc] = c.split('  ');
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '5px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#79c0ff', minWidth: 220 }}>{file.trim()}</span>
                    <span style={{ fontSize: 11, color: '#86868b' }}>{desc.join('  ')}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CLIReference() {
  const [search, setSearch] = useState('');

  const filtered = COMMANDS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }} className="animate-fade-in">
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: '#f5f5f7' }}>CLI Reference</h1>
        <p style={{ color: '#86868b', fontSize: 13, marginTop: 4 }}>
          Complete command reference · Click any command to expand
        </p>
      </div>

      {/* Quick install */}
      <div className="terminal">
        <div className="terminal-header">
          <div className="terminal-dot" style={{ background: '#ff5f56' }} />
          <div className="terminal-dot" style={{ background: '#ffbd2e' }} />
          <div className="terminal-dot" style={{ background: '#27c93f' }} />
          <span style={{ fontSize: 11, color: '#48484a', marginLeft: 8 }}>Quick Start</span>
        </div>
        <div className="terminal-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <span className="terminal-comment"># 1. Install</span>
            <div><span className="terminal-prompt">$</span> <span className="terminal-cmd">cargo install --path crates/mortis-cli</span></div>
          </div>
          <div>
            <span className="terminal-comment"># 2. Initialize</span>
            <div><span className="terminal-prompt">$</span> <span className="terminal-cmd">mortis config init</span></div>
          </div>
          <div>
            <span className="terminal-comment"># 3. Self-check</span>
            <div><span className="terminal-prompt">$</span> <span className="terminal-cmd">mortis self-check</span></div>
            <div style={{ paddingLeft: 16 }}>
              <div style={{ color: '#c9d1d9', fontSize: 12 }}>MORTIS Self-Check v0.1.0</div>
              <div style={{ color: '#c9d1d9', fontSize: 12 }}>=========================================</div>
              <div style={{ color: '#56d364', fontSize: 12 }}>passphrase_init: 343ms ✅</div>
              <div style={{ color: '#56d364', fontSize: 12 }}>passphrase_verify: 343ms ✅</div>
              <div style={{ color: '#56d364', fontSize: 12 }}>receipt_sign: 0ms ✅</div>
              <div style={{ color: '#56d364', fontSize: 12 }}>receipt_verify: 0ms ✅</div>
              <div style={{ color: '#c9d1d9', fontSize: 12 }}>=========================================</div>
              <div style={{ color: '#56d364', fontSize: 12 }}>all SLOs met ✅</div>
            </div>
          </div>
        </div>
      </div>

      {/* Global options */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f7', marginBottom: 14 }}>Global Options</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {GLOBAL_OPTIONS.map(([flag, desc], i) => (
            <div key={i} style={{ display: 'flex', gap: 16, padding: '7px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#56d364', minWidth: 220, flexShrink: 0 }}>{flag}</span>
              <span style={{ fontSize: 12, color: '#86868b' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Environment variables */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f7', marginBottom: 14 }}>Environment Variables</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ENV_VARS.map(([varName, desc], i) => (
            <div key={i} style={{ display: 'flex', gap: 16, padding: '7px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#ff9f0a', minWidth: 140, flexShrink: 0 }}>{varName}</span>
              <span style={{ fontSize: 12, color: '#86868b' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 400 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#48484a' }} />
        <input className="input-field" style={{ paddingLeft: 36 }} placeholder="Search commands..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Commands */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, color: '#48484a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {filtered.length} commands
        </div>
        {filtered.map(cmd => <CommandBlock key={cmd.name} cmd={cmd} />)}
      </div>
    </div>
  );
}
