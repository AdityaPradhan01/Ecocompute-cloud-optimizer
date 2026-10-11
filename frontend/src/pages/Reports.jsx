import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { COLOR, ZONES } from '../theme';
import { generateReportPdf } from '../utils/reportPdf';

const PERIOD_SLUG = {
  month: () => {
    const d = new Date();
    return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).replace(' ', '-').toLowerCase();
  },
  quarter: () => {
    const d = new Date();
    return `q${Math.floor(d.getMonth() / 3) + 1}-${d.getFullYear()}`;
  },
  year: () => `fy${new Date().getFullYear()}`
};

const SECTION_META = {
  exec: 'Executive summary',
  ledger: 'Carbon ledger',
  register: 'Instance register',
  roadmap: 'Optimization roadmap',
  method: 'Methodology and grid sources'
};

const Reports = () => {
  const [period, setPeriod] = useState('month');
  const [sections, setSections] = useState({ exec: true, ledger: true, register: true, roadmap: true, method: false });
  const [ready, setReady] = useState(null);
  const [settings, setSettings] = useState(null);
  const [factorDraft, setFactorDraft] = useState({});
  const [thresholdDraft, setThresholdDraft] = useState(null);
  const [auditRows, setAuditRows] = useState([]);
  const [saveStatus, setSaveStatus] = useState(null);
  const [scheduleStatus, setScheduleStatus] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [sendingId, setSendingId] = useState(null);

  const loadSettings = () => {
    client.get('/api/settings').then((res) => {
      setSettings(res.data);
      setFactorDraft(res.data.gridFactors);
      setThresholdDraft({ idleBelow: res.data.idleBelow, underutilizedBelow: res.data.underutilizedBelow, overloadedAbove: res.data.overloadedAbove, pue: res.data.pue });
    }).catch(() => {});
  };
  const loadAudit = () => client.get('/api/audit-log').then((res) => setAuditRows(res.data)).catch(() => {});
  const loadSchedules = () => client.get('/api/reports/schedule').then((res) => {
    setSchedules(res.data.schedules || []);
    setSmtpConfigured(!!res.data.smtpConfigured);
  }).catch(() => {});

  useEffect(() => { loadSettings(); loadAudit(); loadSchedules(); }, []);

  const toggleSection = (key) => {
    setSections((s) => ({ ...s, [key]: !s[key] }));
    setReady(null);
  };

  const handleGenerate = async () => {
    try {
      const [resourcesRes, recsRes, analyticsRes] = await Promise.all([
        client.get('/api/dashboard/resources'),
        client.get('/api/optimize'),
        client.get('/api/analytics')
      ]);
      const result = generateReportPdf({
        period: period === 'month' ? 'This month' : period === 'quarter' ? 'This quarter' : 'Fiscal year',
        periodSlug: PERIOD_SLUG[period](),
        sections,
        resources: resourcesRes.data,
        recommendations: recsRes.data,
        analytics: analyticsRes.data,
        settings,
        auditRows
      });
      setReady(result);
    } catch (err) {
      setReady({ error: true });
    }
  };

  const handleSaveConfig = async () => {
    try {
      const res = await client.put('/api/settings', { ...thresholdDraft, gridFactors: factorDraft });
      setSettings((s) => ({ ...s, ...res.data }));
      setSaveStatus({ ok: true, text: 'Configuration saved.' });
      loadAudit();
    } catch (err) {
      setSaveStatus({ ok: false, text: 'Failed to save configuration.' });
    }
  };

  const handleSchedule = async () => {
    const email = window.prompt('Send the monthly ESG report to which email address?');
    if (!email) return;
    try {
      const res = await client.post('/api/reports/schedule', { email, period });
      setScheduleStatus({
        ok: true,
        text: res.data.smtpConfigured
          ? `Scheduled for ${email}. This deployment has SMTP configured — it will send automatically on the next due date.`
          : `Scheduled for ${email}. This deployment has no SMTP configured yet, so it's saved but won't send until SMTP_HOST/SMTP_USER/SMTP_PASS are set.`
      });
      loadAudit();
      loadSchedules();
    } catch (err) {
      setScheduleStatus({ ok: false, text: err.response?.data?.error || 'Failed to schedule.' });
    }
  };

  const handleSendNow = async (id) => {
    setSendingId(id);
    try {
      await client.post(`/api/reports/schedule/${id}/send-now`);
      loadSchedules();
      loadAudit();
    } catch (err) {
      loadSchedules(); // pick up the lastSendError the backend recorded
    } finally {
      setSendingId(null);
    }
  };

  if (!settings || !thresholdDraft) return null;

  const periodBtn = (key, label) => (
    <button
      onClick={() => { setPeriod(key); setReady(null); }}
      style={{ padding: '9px 15px', border: 0, borderRight: key !== 'year' ? `1.5px solid ${COLOR.ink}` : 0, background: period === key ? COLOR.ink : COLOR.paper, color: period === key ? COLOR.paper : COLOR.ink, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
    >
      {label}
    </button>
  );

  return (
    <section style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', alignItems: 'start' }}>
      <div style={{ padding: '26px 24px', borderRight: `2px solid ${COLOR.ink}`, background: COLOR.paper, minHeight: '100%' }}>
        <h4 style={{ margin: '0 0 4px', fontSize: 16 }}>Build a sustainability report</h4>
        <p style={{ margin: '0 0 22px', fontSize: 12.5, color: COLOR.body, maxWidth: '58ch' }}>Reports are generated from the active fleet snapshot and the optimization log. Finance sees rupee figures; the ESG annexe carries the CO₂ ledger with grid factors cited.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 8 }}>Reporting period</span>
            <div style={{ display: 'flex', border: `1.5px solid ${COLOR.ink}`, width: 'fit-content', flexWrap: 'wrap' }}>
              {periodBtn('month', 'This month')}
              {periodBtn('quarter', 'Quarter')}
              {periodBtn('year', 'Fiscal year')}
            </div>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 8 }}>Sections included</span>
            <div style={{ border: `1.5px solid ${COLOR.ink}` }}>
              {Object.entries(SECTION_META).map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: `1px solid ${COLOR.hairline}`, cursor: 'pointer' }}>
                  <input type="checkbox" checked={sections[key]} onChange={() => toggleSection(key)} style={{ width: 16, height: 16, accentColor: COLOR.ink, flex: 'none' }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 8 }}>Delivery</span>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={handleGenerate} style={{ padding: '13px 20px', background: COLOR.yellow, color: COLOR.ink, border: `2px solid ${COLOR.ink}`, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                {ready && !ready.error ? 'Regenerate PDF' : 'Generate PDF'}
              </button>
              <button onClick={handleSchedule} style={{ padding: '13px 20px', background: COLOR.paper, color: COLOR.ink, border: `2px solid ${COLOR.ink}`, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Schedule monthly email</button>
            </div>
            {ready && !ready.error && (
              <div style={{ marginTop: 14, borderLeft: `8px solid ${COLOR.green}`, borderTop: `1.5px solid ${COLOR.ink}`, borderRight: `1.5px solid ${COLOR.ink}`, borderBottom: `1.5px solid ${COLOR.ink}`, padding: '12px 16px', background: COLOR.paper }}>
                <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, display: 'block', marginBottom: 4 }}>Ready</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{ready.filename} · {ready.pageCount} pages</span>
              </div>
            )}
            {ready?.error && <p style={{ marginTop: 12, fontSize: 12, color: '#b00020' }}>Report generation failed — check your connection and try again.</p>}
            {scheduleStatus && <p style={{ marginTop: 12, fontSize: 12, color: scheduleStatus.ok ? COLOR.green : '#b00020' }}>{scheduleStatus.text}</p>}
          </div>

          {schedules.length > 0 && (
            <div style={{ marginTop: 22, borderTop: `1.5px solid ${COLOR.hairline2}`, paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted }}>Scheduled recipients</span>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: smtpConfigured ? COLOR.green : COLOR.muted }}>{smtpConfigured ? 'SMTP configured' : 'SMTP not configured'}</span>
              </div>
              {schedules.map((s) => (
                <div key={s._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${COLOR.hairline}`, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, overflowWrap: 'anywhere' }}>{s.email} <span style={{ color: COLOR.muted, fontWeight: 600 }}>· {s.period}</span></span>
                    <span style={{ display: 'block', fontSize: 11, color: s.lastSendError ? '#b00020' : COLOR.muted }}>
                      {s.lastSendError ? `Last attempt failed: ${s.lastSendError}` : (s.lastSentAt ? `Last sent ${new Date(s.lastSentAt).toLocaleString('en-IN')}` : 'Never sent yet')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleSendNow(s._id)}
                    disabled={sendingId === s._id || !smtpConfigured}
                    title={smtpConfigured ? 'Send this report immediately, for real, right now' : 'Set SMTP_HOST/SMTP_USER/SMTP_PASS on the backend to enable sending'}
                    style={{ padding: '7px 12px', background: smtpConfigured ? COLOR.ink : COLOR.track, color: smtpConfigured ? '#fff' : COLOR.muted, border: 0, fontSize: 11, fontWeight: 800, cursor: smtpConfigured ? 'pointer' : 'not-allowed', flex: 'none', whiteSpace: 'nowrap' }}
                  >
                    {sendingId === s._id ? 'Sending…' : 'Send now'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ padding: '24px 26px', borderBottom: `2px solid ${COLOR.ink}`, background: COLOR.paper }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 15 }}>Grid carbon factors</h4>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: COLOR.muted }}>Approximate country-level grid intensity per AWS region — editable per deployment. Override with your own utility data for compliance-grade reporting.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${COLOR.ink}` }}>
                <th style={{ textAlign: 'left', padding: '8px 8px 8px 0', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: COLOR.muted }}>Region</th>
                <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: COLOR.muted }}>gCO₂/kWh (approx.)</th>
              </tr>
            </thead>
            <tbody>
              {ZONES.map((z) => (
                <tr key={z.id} style={{ borderBottom: `1px solid ${COLOR.hairline}` }}>
                  <td style={{ padding: '9px 8px 9px 0', fontWeight: 700 }}>{z.label}</td>
                  <td style={{ padding: '9px 0', textAlign: 'right' }}>
                    <input
                      type="number" value={factorDraft[z.id] ?? z.factor}
                      onChange={(e) => { setFactorDraft((d) => ({ ...d, [z.id]: e.target.value })); setSaveStatus(null); }}
                      style={{ width: 72, padding: '4px 6px', border: `1.5px solid ${COLOR.ink}`, font: '600 12px ui-monospace, Menlo, monospace', textAlign: 'right' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '24px 26px', borderBottom: `2px solid ${COLOR.ink}`, background: COLOR.paper }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 15 }}>Classification thresholds</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
            {[
              ['idleBelow', 'Idle below (%)'], ['underutilizedBelow', 'Underutilized below (%)'],
              ['overloadedAbove', 'Overloaded above (%)'], ['pue', 'Data-centre PUE']
            ].map(([key, label]) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>{label}</label>
                <input
                  type="number" step={key === 'pue' ? '0.01' : '1'}
                  value={thresholdDraft[key]}
                  onChange={(e) => { setThresholdDraft((d) => ({ ...d, [key]: e.target.value })); setSaveStatus(null); }}
                  style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${COLOR.ink}`, fontSize: 14, fontWeight: 700 }}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={handleSaveConfig} style={{ padding: '10px 16px', background: COLOR.ink, color: '#fff', border: `2px solid ${COLOR.ink}`, fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>Save configuration</button>
            {saveStatus && <span style={{ fontSize: 12, color: saveStatus.ok ? COLOR.green : '#b00020' }}>{saveStatus.text}</span>}
          </div>
        </div>

        <div style={{ padding: '24px 26px 40px', background: COLOR.ink, color: '#fff' }}>
          <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: COLOR.yellow, marginBottom: 10 }}>Audit trail</span>
          {auditRows.length === 0 && <span style={{ fontSize: 12.5, color: COLOR.copyDark }}>No events logged yet.</span>}
          {auditRows.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, padding: '10px 0', borderBottom: `1px solid ${COLOR.inkSoft}` }}>
              <span style={{ flex: 'none', font: '600 11px ui-monospace, Menlo, monospace', color: COLOR.mutedDark }}>{a.time}</span>
              <span style={{ fontSize: 12.5, color: '#fff' }}>{a.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Reports;
