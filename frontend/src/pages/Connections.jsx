import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { COLOR } from '../theme';

const CHIP_STYLE = {
  Live: { bg: COLOR.greenTint, fg: COLOR.green, border: COLOR.greenBorder },
  'Needs auth': { bg: COLOR.yellowTint2, fg: COLOR.yellowInk2, border: COLOR.yellowBorder },
  'Not connected': { bg: COLOR.paper, fg: COLOR.muted, border: COLOR.hairline2 },
  'Coming soon': { bg: COLOR.track, fg: COLOR.muted, border: COLOR.hairline2 },
  Available: { bg: COLOR.track, fg: COLOR.body, border: COLOR.hairline2 }
};

const PROVIDER_OPTIONS = [
  { id: 'aws', label: 'AWS CloudWatch', implemented: true },
  { id: 'azure', label: 'Azure Monitor (coming soon)', implemented: false },
  { id: 'gcp', label: 'Google Cloud Monitoring (coming soon)', implemented: false },
  { id: 'prom', label: 'Prometheus / node_exporter (coming soon)', implemented: false },
  { id: 'ssh', label: 'SSH agentless (coming soon)', implemented: false }
];

const Connections = () => {
  const [state, setState] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const [provider, setProvider] = useState('aws');
  const [authMode, setAuthMode] = useState('role');
  const [roleArn, setRoleArn] = useState('');
  const [externalId, setExternalId] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [regions, setRegions] = useState({});
  const [poll, setPoll] = useState(5);
  const [testState, setTestState] = useState('idle'); // idle | running | ok | failed
  const [testLog, setTestLog] = useState([]);
  const [syncLog, setSyncLog] = useState([]);
  const [saveError, setSaveError] = useState(null);

  const load = () => client.get('/api/connections').then((res) => {
    setState(res.data);
    if (!Object.keys(regions).length && res.data.awsRegions) {
      setRegions(Object.fromEntries(res.data.awsRegions.map((r) => [r.id, r.id === 'ap-south-1'])));
    }
  }).catch(() => {});
  const loadSyncLog = () => client.get('/api/connections/sync-log').then((res) => setSyncLog(res.data)).catch(() => {});

  useEffect(() => { load(); loadSyncLog(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedRegions = Object.keys(regions).filter((k) => regions[k]);

  const generateExternalId = async () => {
    const res = await client.post('/api/connections/generate-external-id');
    setExternalId(res.data.externalId);
  };

  const credentialPayload = () => (authMode === 'role'
    ? { provider: 'aws', authMode, roleArn, externalId, zones: selectedRegions }
    : { provider: 'aws', authMode, accessKeyId, secretAccessKey, zones: selectedRegions });

  const runTest = async () => {
    setTestState('running');
    setSaveError(null);
    setTestLog([{ mark: '›', text: 'Running…', fg: COLOR.mutedDark }]);
    try {
      const res = await client.post('/api/connections/test', credentialPayload());
      setTestState(res.data.passed ? 'ok' : 'failed');
      setTestLog(res.data.steps.map((s) => ({ mark: s.mark, text: s.text, fg: s.ok ? '#ffffff' : COLOR.mutedDark })));
    } catch (err) {
      setTestState('failed');
      setTestLog([{ mark: '!', text: err.response?.data?.error || 'Test request failed.', fg: COLOR.mutedDark }]);
    }
  };

  const saveConnection = async () => {
    setSaveError(null);
    try {
      await client.post('/api/connections', { ...credentialPayload(), pollIntervalMinutes: poll });
      load();
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to save connection.');
    }
  };

  const syncAll = async () => {
    setSyncing(true);
    try {
      await client.post('/api/connections/sync-all');
    } finally {
      setSyncing(false);
      load();
      loadSyncLog();
    }
  };

  if (!state) return null;

  const awsRegions = state.awsRegions || [];
  const canTest = authMode === 'role'
    ? roleArn.trim() && externalId.trim() && selectedRegions.length > 0
    : accessKeyId.trim() && secretAccessKey.trim() && selectedRegions.length > 0;

  return (
    <section style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 28px', background: COLOR.ink, color: '#fff', borderBottom: `2px solid ${COLOR.ink}`, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.yellow, fontWeight: 700 }}>
          <span style={{ width: 8, height: 8, background: COLOR.greenLed, display: 'block', flex: 'none' }} />{state.liveSources} sources live
        </span>
        <span style={{ fontSize: 13 }}>{state.discovered} instances discovered · last poll {state.lastPoll}</span>
        <button onClick={syncAll} disabled={syncing} style={{ marginLeft: 'auto', padding: '9px 16px', background: COLOR.yellow, color: COLOR.ink, border: `2px solid ${COLOR.yellow}`, fontSize: 12, fontWeight: 800, cursor: 'pointer', flex: 'none', whiteSpace: 'nowrap' }}>
          {syncing ? 'Polling all sources…' : 'Sync all now'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', borderBottom: `2px solid ${COLOR.ink}`, background: COLOR.paper }}>
        {state.sources.map((src) => {
          const chip = CHIP_STYLE[src.status] || CHIP_STYLE['Not connected'];
          return (
            <div key={src.provider} style={{ padding: '20px 22px', borderRight: `1.5px solid ${COLOR.hairline}`, borderBottom: `1.5px solid ${COLOR.hairline}`, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, opacity: src.implemented === false ? 0.6 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>{src.name}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: COLOR.muted, marginTop: 3 }}>{src.kind}</span>
                </div>
                <span style={{ flex: 'none', padding: '3px 8px', background: chip.bg, color: chip.fg, border: `1px solid ${chip.border}`, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{src.status}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, paddingTop: 4 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderBottom: `1px solid #f0f0ea`, paddingBottom: 5 }}><span style={{ color: COLOR.muted }}>Scope</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{src.scope}</span></span>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderBottom: `1px solid #f0f0ea`, paddingBottom: 5 }}><span style={{ color: COLOR.muted }}>Instances</span><span style={{ fontWeight: 600 }}>{src.instances}</span></span>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: COLOR.muted }}>Last sync</span><span style={{ fontWeight: 600 }}>{src.sync}</span></span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                <button
                  disabled={src.implemented === false}
                  onClick={() => src.provider === 'csv' ? window.location.assign('/app') : syncAll()}
                  style={{ padding: '8px 13px', background: src.implemented === false ? COLOR.track : (src.status === 'Live' ? COLOR.paper : COLOR.yellow), color: COLOR.ink, border: `1.5px solid ${COLOR.ink}`, fontSize: 11.5, fontWeight: 800, cursor: src.implemented === false ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                >
                  {src.cta}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', borderBottom: `2px solid ${COLOR.ink}`, background: COLOR.paper }}>
        <div style={{ padding: '24px 24px', borderRight: `2px solid ${COLOR.ink}` }}>
          <h4 style={{ margin: '0 0 4px', fontSize: 16 }}>Connect your AWS account</h4>
          <p style={{ margin: '0 0 20px', fontSize: 12.5, color: COLOR.body, maxWidth: '52ch' }}>EcoCompute reads real EC2 instance metadata and CloudWatch CPU metrics. Grant a read-only IAM role or access key — no write scopes beyond the optional shutdown action on the Optimize screen.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${COLOR.ink}`, background: COLOR.paper, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                {PROVIDER_OPTIONS.map((p) => <option key={p.id} value={p.id} disabled={!p.implemented}>{p.label}</option>)}
              </select>
            </div>

            {provider !== 'aws' ? (
              <div style={{ padding: '14px 16px', background: COLOR.track, border: `1.5px dashed ${COLOR.hairline2}`, fontSize: 12.5, color: COLOR.muted }}>
                This provider isn't implemented yet — only AWS is wired up to a real API today.
              </div>
            ) : (
              <>
                <div>
                  <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>Authentication</span>
                  <div style={{ display: 'flex', border: `1.5px solid ${COLOR.ink}`, width: 'fit-content', flexWrap: 'wrap' }}>
                    <button onClick={() => { setAuthMode('role'); setTestState('idle'); }} style={{ padding: '9px 14px', border: 0, borderRight: `1.5px solid ${COLOR.ink}`, background: authMode === 'role' ? COLOR.ink : COLOR.paper, color: authMode === 'role' ? '#fff' : COLOR.ink, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delegated role</button>
                    <button onClick={() => { setAuthMode('key'); setTestState('idle'); }} style={{ padding: '9px 14px', border: 0, background: authMode === 'key' ? COLOR.ink : COLOR.paper, color: authMode === 'key' ? '#fff' : COLOR.ink, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Access key</button>
                  </div>
                </div>

                {authMode === 'role' ? (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>Role ARN</label>
                      <input type="text" value={roleArn} placeholder="arn:aws:iam::123456789012:role/ecocompute-readonly" onChange={(e) => { setRoleArn(e.target.value); setTestState('idle'); }} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${COLOR.ink}`, background: COLOR.paper, font: '600 12.5px ui-monospace, Menlo, monospace' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>External ID</label>
                      {externalId ? (
                        <div style={{ padding: '10px 12px', border: `1.5px solid ${COLOR.ink}`, background: COLOR.yellowTint, font: '700 12.5px ui-monospace, Menlo, monospace', overflowWrap: 'anywhere' }}>{externalId}</div>
                      ) : (
                        <button onClick={generateExternalId} style={{ padding: '10px 14px', background: COLOR.paper, color: COLOR.ink, border: `1.5px solid ${COLOR.ink}`, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Generate external ID</button>
                      )}
                      {externalId && (
                        <p style={{ margin: '8px 0 0', fontSize: 11, color: COLOR.muted }}>Add this as the <code>sts:ExternalId</code> condition on your IAM role's trust policy before testing — this prevents another EcoCompute customer from assuming your role.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>Access key ID</label>
                      <input type="text" value={accessKeyId} placeholder="AKIAXXXXXXXXXXXXXXXX" onChange={(e) => { setAccessKeyId(e.target.value); setTestState('idle'); }} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${COLOR.ink}`, background: COLOR.paper, font: '600 12.5px ui-monospace, Menlo, monospace' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>Secret access key</label>
                      <input type="password" value={secretAccessKey} onChange={(e) => { setSecretAccessKey(e.target.value); setTestState('idle'); }} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${COLOR.ink}`, background: COLOR.paper, font: '600 12.5px ui-monospace, Menlo, monospace' }} />
                    </div>
                  </>
                )}

                <div>
                  <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 8 }}>AWS regions to poll</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {awsRegions.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { setRegions((zs) => ({ ...zs, [r.id]: !zs[r.id] })); setTestState('idle'); }}
                        style={{ padding: '7px 12px', border: `1.5px solid ${COLOR.ink}`, background: regions[r.id] ? COLOR.ink : COLOR.paper, color: regions[r.id] ? '#fff' : COLOR.ink, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {r.label} ({r.id})
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>Poll interval — {poll === 1 ? '1 minute' : `${poll} minutes`}</label>
                  <input type="range" min="1" max="60" value={poll} onChange={(e) => setPoll(parseInt(e.target.value, 10) || 1)} style={{ width: '100%', accentColor: COLOR.yellow }} />
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={runTest} disabled={!canTest} style={{ padding: '12px 18px', background: canTest ? COLOR.yellow : COLOR.track, color: COLOR.ink, border: `2px solid ${COLOR.ink}`, fontSize: 13, fontWeight: 800, cursor: canTest ? 'pointer' : 'not-allowed' }}>
                    {testState === 'running' ? 'Testing…' : (testState === 'ok' ? 'Test again' : 'Test connection')}
                  </button>
                  <button
                    onClick={saveConnection}
                    disabled={testState !== 'ok'}
                    style={{ padding: '12px 18px', background: COLOR.paper, color: COLOR.ink, border: `2px solid ${COLOR.ink}`, fontSize: 13, fontWeight: 800, cursor: testState === 'ok' ? 'pointer' : 'not-allowed', opacity: testState === 'ok' ? 1 : 0.45 }}
                  >
                    Save connection
                  </button>
                </div>
                {saveError && <p style={{ margin: 0, fontSize: 12, color: '#b00020' }}>{saveError}</p>}
              </>
            )}
          </div>
        </div>

        <div style={{ padding: '24px 24px', background: COLOR.ink, color: '#fff', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.yellow }}>Connection test</span>
            <span style={{ font: '700 10px ui-monospace, Menlo, monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: testState === 'ok' ? COLOR.greenLed : (testState === 'running' ? COLOR.yellow : (testState === 'failed' ? '#ff6b6b' : COLOR.mutedDark)) }}>
              {testState === 'ok' ? 'passed' : testState === 'running' ? 'running' : testState === 'failed' ? 'failed' : 'not run'}
            </span>
          </div>
          <div style={{ border: `1.5px solid ${COLOR.inkSoft}`, padding: 16, minHeight: 220 }}>
            {testLog.length === 0
              ? <div style={{ display: 'flex', gap: 10, padding: '4px 0', font: '600 12px/1.5 ui-monospace, Menlo, monospace' }}><span style={{ flex: 'none', color: COLOR.muted }}>›</span><span style={{ color: COLOR.mutedDark }}>No test run yet. This calls real AWS STS/EC2 APIs with the credential you enter.</span></div>
              : testLog.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '4px 0', font: '600 12px/1.5 ui-monospace, Menlo, monospace' }}>
                  <span style={{ flex: 'none', color: COLOR.muted }}>{t.mark}</span>
                  <span style={{ color: t.fg, overflowWrap: 'anywhere' }}>{t.text}</span>
                </div>
              ))}
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 11.5, color: COLOR.mutedDark, maxWidth: '48ch' }}>Credentials are encrypted at rest (AES-256-GCM) so the app can actually poll AWS with them — never stored or logged in plaintext. A failed poll keeps the last good snapshot rather than blanking the dashboard.</p>
        </div>
      </div>

      <div style={{ padding: '22px 28px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <h4 style={{ margin: 0, fontSize: 15 }}>Sync log</h4>
          <span style={{ fontSize: 11, color: COLOR.muted }}>Newest first</span>
        </div>
        <div style={{ border: `2px solid ${COLOR.ink}`, background: COLOR.paper, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 700 }}>
            <thead>
              <tr style={{ background: COLOR.ink, color: '#fff' }}>
                {['Time', 'Source', 'Instances', 'Duration', 'Result'].map((h) => (
                  <th key={h} style={{ textAlign: h === 'Instances' || h === 'Duration' ? 'right' : 'left', padding: '10px 12px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {syncLog.length === 0 && (
                <tr><td colSpan="5" style={{ padding: '18px 12px', textAlign: 'center', color: COLOR.muted }}>No syncs yet — save a connection and sync it, or click "Sync all now".</td></tr>
              )}
              {syncLog.map((l, i) => {
                const chip = l.result === 'ok' ? { bg: COLOR.greenTint, fg: COLOR.green, border: COLOR.greenBorder } : { bg: COLOR.yellowTint2, fg: COLOR.yellowInk2, border: COLOR.yellowBorder };
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${COLOR.hairline}` }}>
                    <td style={{ padding: '9px 12px', font: '600 11.5px ui-monospace, Menlo, monospace', color: COLOR.body }}>{l.time}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 700 }}>{l.source}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>{l.instances}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: COLOR.muted }}>{l.ms}</td>
                    <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 7px', background: chip.bg, color: chip.fg, border: `1px solid ${chip.border}`, fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{l.result}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default Connections;
