import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { COLOR, n0, n1 } from '../theme';
import ConfirmModal from '../components/ConfirmModal';
import { parseCsvPreview } from '../utils/csvPreview';

const DataIntake = () => {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState({ instances: 0, idle: 0, monthlySavings: 0, carbonAbated: 0 });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // 'upload' | 'seed' | 'clear' | null
  const [busy, setBusy] = useState(false);

  const loadKpis = () => {
    Promise.all([
      client.get('/api/dashboard/summary'),
      client.get('/api/optimize')
    ]).then(([summaryRes, recsRes]) => {
      const summary = summaryRes.data;
      const recs = Array.isArray(recsRes.data) ? recsRes.data : [];
      const monthlySavings = recs.reduce((a, r) => a + (r.currentCostINR || 0) * (r.savingsPercent / 100), 0);
      const carbonAbated = recs.reduce((a, r) => a + (r.currentCarbonKg || 0) * (r.savingsPercent / 100), 0);
      setKpis({ instances: summary.serversScanned, idle: summary.idleDetected, monthlySavings, carbonAbated });
    }).catch(() => {});
  };

  useEffect(() => { loadKpis(); }, []);

  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFile(f);
    setStatus({ label: 'Staged', text: `${f.name} parsed. Review the column map, then ingest.`, accent: COLOR.yellow });

    const reader = new FileReader();
    reader.onload = () => setPreview(parseCsvPreview(String(reader.result || '')));
    reader.readAsText(f);
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setStatus(null);
  };

  const runIngest = async () => {
    setBusy(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await client.post('/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setConfirmTarget(null);
      navigate('/app/dashboard', { state: { banner: { label: 'Ingested', text: res.data.message, accent: COLOR.green } } });
    } catch (err) {
      setConfirmTarget(null);
      setStatus({ label: 'Failed', text: err.response?.data?.message || 'Dataset ingestion failed.', accent: '#b00020' });
    } finally {
      setBusy(false);
    }
  };

  const runSeed = async () => {
    setBusy(true);
    try {
      const res = await client.post('/api/seed-demo');
      setConfirmTarget(null);
      navigate('/app/dashboard', { state: { banner: { label: 'Ingested', text: res.data.message, accent: COLOR.green } } });
    } catch (err) {
      setConfirmTarget(null);
      setStatus({ label: 'Failed', text: 'Demo seed procedure failed internally.', accent: '#b00020' });
    } finally {
      setBusy(false);
    }
  };

  const runClear = async () => {
    setBusy(true);
    try {
      const res = await client.delete('/api/fleet');
      setConfirmTarget(null);
      clearFile();
      setStatus({ label: 'Cleared', text: res.data.message, accent: COLOR.green });
      loadKpis();
    } catch (err) {
      setConfirmTarget(null);
      setStatus({ label: 'Failed', text: 'Could not clear the fleet snapshot.', accent: '#b00020' });
    } finally {
      setBusy(false);
    }
  };

  const stepFill = file ? COLOR.yellowTint : COLOR.paper;
  const stepMark = file ? COLOR.yellow : COLOR.paper;

  return (
    <section style={{ flex: 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', borderBottom: `2px solid ${COLOR.ink}`, background: COLOR.paper }}>
        <div style={{ padding: '44px 28px 40px', borderRight: `2px solid ${COLOR.ink}` }}>
          <span style={{ display: 'inline-block', padding: '4px 9px', background: COLOR.ink, color: COLOR.yellow, fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 22 }}>Release 2.0 · production</span>
          <h2 style={{ margin: '0 0 18px', fontSize: 'clamp(34px, 4.2vw, 52px)', lineHeight: 0.99, letterSpacing: '-0.035em', fontWeight: 800, maxWidth: '15ch' }}>Greener infrastructure. Lower bills.</h2>
          <p style={{ margin: '0 0 26px', maxWidth: '56ch', fontSize: 16, color: COLOR.body }}>EcoCompute reads your fleet's utilization telemetry, prices it against the AWS region it runs in, and returns a ranked list of shutdowns, rightsizings and region migrations — with rupee and CO₂ figures attached to every line.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/app/dashboard')} style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 22px', background: COLOR.yellow, color: COLOR.ink, fontWeight: 800, fontSize: 14, border: `2px solid ${COLOR.ink}`, cursor: 'pointer' }}>Open live dashboard</button>
            <button onClick={() => setConfirmTarget('seed')} style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 22px', background: COLOR.paper, color: COLOR.ink, fontWeight: 800, fontSize: 14, border: `2px solid ${COLOR.ink}`, cursor: 'pointer' }}>Load demo dataset</button>
            <button onClick={() => setConfirmTarget('clear')} style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 22px', background: COLOR.paper, color: '#b00020', fontWeight: 800, fontSize: 14, border: `2px solid #b00020`, cursor: 'pointer' }}>Clear all data</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <div style={{ padding: '24px 22px', borderBottom: `2px solid ${COLOR.ink}`, borderRight: `2px solid ${COLOR.ink}` }}>
            <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 8 }}>Instances under management</span>
            <span style={{ display: 'block', fontSize: 'clamp(28px, 2.6vw, 38px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{kpis.instances}</span>
          </div>
          <div style={{ padding: '24px 22px', borderBottom: `2px solid ${COLOR.ink}` }}>
            <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 8 }}>Idle flagged</span>
            <span style={{ display: 'block', fontSize: 'clamp(28px, 2.6vw, 38px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{kpis.idle}</span>
          </div>
          <div style={{ padding: '24px 22px', borderRight: `2px solid ${COLOR.ink}`, background: COLOR.yellow }}>
            <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.yellowInk, marginBottom: 8 }}>Monthly savings found</span>
            <span style={{ display: 'block', fontSize: 'clamp(24px, 2.2vw, 32px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, overflowWrap: 'anywhere' }}>₹{n0(kpis.monthlySavings)}</span>
          </div>
          <div style={{ padding: '24px 22px' }}>
            <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 8 }}>CO₂ abated / month</span>
            <span style={{ display: 'block', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: COLOR.green }}>{n1(kpis.carbonAbated)}<span style={{ fontSize: 14, fontWeight: 600 }}> kg</span></span>
          </div>
        </div>
      </div>

      <div style={{ padding: '32px 28px 44px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, border: `2px solid ${COLOR.ink}`, background: COLOR.ink, color: '#fff', padding: '16px 20px', marginBottom: 26, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.yellow, marginBottom: 5 }}>Recommended</span>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>Connect a live source instead of uploading</span>
            <span style={{ display: 'block', fontSize: 12, color: COLOR.copyDark, marginTop: 3 }}>Read-only polling from CloudWatch, Azure Monitor, Prometheus or SSH. Instances refresh every few minutes without a CSV.</span>
          </div>
          <button onClick={() => navigate('/app/connections')} style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 18px', background: COLOR.yellow, color: COLOR.ink, border: `2px solid ${COLOR.yellow}`, fontSize: 13, fontWeight: 800, flex: 'none', cursor: 'pointer' }}>Set up a connection</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>Ingest a dataset</h3>
          <span style={{ fontSize: 12, color: COLOR.muted }}>Three steps. The upload replaces the active fleet snapshot.</span>
        </div>

        <div style={{ display: 'flex', border: `2px solid ${COLOR.ink}`, background: COLOR.paper, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, padding: '14px 18px', borderRight: `2px solid ${COLOR.ink}`, display: 'flex', alignItems: 'center', gap: 12, background: stepFill }}>
            <span style={{ flex: 'none', width: 26, height: 26, border: `2px solid ${COLOR.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 12px/1 Archivo, sans-serif', background: stepMark }}>1</span>
            <div><span style={{ display: 'block', fontSize: 13, fontWeight: 800 }}>Choose file</span><span style={{ display: 'block', fontSize: 11, color: COLOR.muted }}>CSV, up to 20 MB</span></div>
          </div>
          <div style={{ flex: 1, minWidth: 200, padding: '14px 18px', borderRight: `2px solid ${COLOR.ink}`, display: 'flex', alignItems: 'center', gap: 12, background: stepFill }}>
            <span style={{ flex: 'none', width: 26, height: 26, border: `2px solid ${COLOR.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 12px/1 Archivo, sans-serif', background: stepMark }}>2</span>
            <div><span style={{ display: 'block', fontSize: 13, fontWeight: 800 }}>Map columns</span><span style={{ display: 'block', fontSize: 11, color: COLOR.muted }}>Six required fields</span></div>
          </div>
          <div style={{ flex: 1, minWidth: 200, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, background: COLOR.paper }}>
            <span style={{ flex: 'none', width: 26, height: 26, border: `2px solid ${COLOR.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 12px/1 Archivo, sans-serif', background: COLOR.paper }}>3</span>
            <div><span style={{ display: 'block', fontSize: 13, fontWeight: 800 }}>Confirm replace</span><span style={{ display: 'block', fontSize: 11, color: COLOR.muted }}>Destructive, logged</span></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', border: `2px solid ${COLOR.ink}`, borderTop: 0, background: COLOR.paper }}>
          <div style={{ padding: '24px 22px', borderRight: `2px solid ${COLOR.ink}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: '26px 20px', border: `2px dashed ${COLOR.ink}`, background: COLOR.canvas, cursor: 'pointer' }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>Drop a CSV here, or browse</span>
              <span style={{ fontSize: 11, color: COLOR.muted }}>Required headers: serverName, region, environment, cpuUtilization, tdp, hourlyRate</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 14px', background: COLOR.ink, color: '#fff', fontSize: 12, fontWeight: 800, letterSpacing: '0.04em' }}>Browse files</span>
              <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
            </label>
            <div style={{ borderTop: `1.5px solid ${COLOR.hairline2}`, paddingTop: 14 }}>
              <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>Selected file</span>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{file ? file.name : 'No file selected'}</span>
              <span style={{ display: 'block', fontSize: 11, color: COLOR.muted }}>{preview ? `${preview.rowCount} rows detected · ${preview.matched} / ${preview.total} headers matched` : 'Or seed the demo fleet to explore first'}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => setConfirmTarget('upload')}
                disabled={!file}
                style={{ padding: '12px 18px', background: COLOR.yellow, color: COLOR.ink, border: `2px solid ${COLOR.ink}`, fontWeight: 800, fontSize: 13, cursor: file ? 'pointer' : 'not-allowed', opacity: file ? 1 : 0.45 }}
              >
                Validate &amp; ingest
              </button>
              <button onClick={clearFile} style={{ padding: '12px 18px', background: COLOR.paper, color: COLOR.ink, border: `2px solid ${COLOR.ink}`, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Clear</button>
            </div>
          </div>
          <div style={{ padding: '24px 22px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted }}>Column map · preview</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: preview && preview.matched === preview.total ? COLOR.green : COLOR.muted }}>
                {preview ? `${preview.matched} / ${preview.total} matched` : `0 / ${6} matched`}
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${COLOR.ink}` }}>
                  <th style={{ textAlign: 'left', padding: '7px 8px 7px 0', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: COLOR.muted, fontWeight: 700 }}>CSV header</th>
                  <th style={{ textAlign: 'left', padding: '7px 8px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: COLOR.muted, fontWeight: 700 }}>Maps to</th>
                  <th style={{ textAlign: 'left', padding: '7px 8px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: COLOR.muted, fontWeight: 700 }}>Sample</th>
                  <th style={{ textAlign: 'right', padding: '7px 0 7px 8px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: COLOR.muted, fontWeight: 700 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(preview ? preview.rows : [
                  { header: 'serverName', field: 'Instance name', sample: '—', ok: null },
                  { header: 'region', field: 'AWS region', sample: '—', ok: null },
                  { header: 'environment', field: 'Environment', sample: '—', ok: null },
                  { header: 'cpuUtilization', field: 'CPU %', sample: '—', ok: null },
                  { header: 'tdp', field: 'Power draw (W)', sample: '—', ok: null },
                  { header: 'hourlyRate', field: 'Hourly rate (₹)', sample: '—', ok: null }
                ]).map((col) => (
                  <tr key={col.header} style={{ borderBottom: `1px solid ${COLOR.hairline}` }}>
                    <td style={{ padding: '8px 8px 8px 0', font: '600 12px ui-monospace, Menlo, monospace' }}>{col.header}</td>
                    <td style={{ padding: 8, fontWeight: 700 }}>{col.field}</td>
                    <td style={{ padding: 8, color: COLOR.muted }}>{col.sample}</td>
                    <td style={{ padding: '8px 0 8px 8px', textAlign: 'right' }}>
                      {col.ok === null ? (
                        <span style={{ display: 'inline-block', padding: '2px 7px', background: COLOR.track, color: COLOR.body, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>—</span>
                      ) : (
                        <span style={{ display: 'inline-block', padding: '2px 7px', background: col.ok ? COLOR.greenTint : '#fde2e2', color: col.ok ? COLOR.green : '#b00020', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{col.ok ? 'ok' : 'missing'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {status && (
          <div style={{ marginTop: 20, border: `2px solid ${COLOR.ink}`, borderLeft: `8px solid ${status.accent}`, background: COLOR.paper, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, flex: 'none' }}>{status.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{status.text}</span>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmTarget}
        title={confirmTarget === 'seed' ? 'Replace the fleet with demo data?' : confirmTarget === 'clear' ? 'Clear all fleet data?' : 'Replace the active fleet snapshot?'}
        body={confirmTarget === 'seed'
          ? 'Seeding loads twelve sample instances across five real AWS regions. All existing instance records are removed.'
          : confirmTarget === 'clear'
            ? 'Removes every instance currently stored. The dashboard, optimize queue, and analytics all go back to empty until you upload or seed data again.'
            : `Ingesting ${file ? file.name : 'this file'} removes every instance currently stored and rebuilds the snapshot from its rows.`}
        cta={busy ? 'Working…' : (confirmTarget === 'seed' ? 'Seed demo fleet' : confirmTarget === 'clear' ? 'Clear all data' : 'Ingest and replace')}
        footnote={confirmTarget === 'clear'
          ? 'This is permanent — there is no archive or undo for a cleared snapshot.'
          : 'The current snapshot is archived to the optimization log before it is overwritten.'}
        onConfirm={confirmTarget === 'seed' ? runSeed : confirmTarget === 'clear' ? runClear : runIngest}
        onCancel={() => setConfirmTarget(null)}
      />
    </section>
  );
};

export default DataIntake;
