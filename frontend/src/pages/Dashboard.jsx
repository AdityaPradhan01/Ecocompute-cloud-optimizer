import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import client from '../api/client';
import { COLOR, n0, n1, zoneLabel } from '../theme';
import ClassificationChip from '../components/ClassificationChip';
import { LoadingSkeletons, EmptyFleetState, ErrorFleetState } from '../components/DataStates';

const POLL_MS = 2000;
const HISTORY_CAP = 48;

function buildLinePath(values, w, top, bottom) {
  if (values.length < 2) return { path: '', area: '' };
  const max = Math.max(...values) * 1.12 || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => ({ x: i * step, y: bottom - (v / max) * (bottom - top) }));
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
  return { path, area: `${path} L${w} ${bottom} L0 ${bottom} Z` };
}

const Dashboard = () => {
  const location = useLocation();
  const [summary, setSummary] = useState(null);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [banner, setBanner] = useState(location.state?.banner || null);
  const [baseline, setBaseline] = useState(null);
  const historyRef = useRef([]);
  const [, forceTick] = useState(0);

  const poll = () => {
    Promise.all([
      client.get('/api/dashboard/summary'),
      client.get('/api/dashboard/resources')
    ]).then(([summaryRes, resourcesRes]) => {
      setSummary(summaryRes.data);
      setResources(resourcesRes.data);
      setError(false);
      setLoading(false);
      setBaseline((b) => b || summaryRes.data);
      historyRef.current = [...historyRef.current, summaryRes.data.liveCpu].slice(-HISTORY_CAP);
      forceTick((t) => t + 1);
    }).catch(() => {
      setError(true);
      setLoading(false);
    });
  };

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <LoadingSkeletons />;
  if (error) return <ErrorFleetState endpoint="/api/dashboard/summary" onRetry={poll} />;
  if (!summary || summary.serversScanned === 0) return <EmptyFleetState onSeed={() => client.post('/api/seed-demo').then(poll)} />;

  const regionSet = new Set(resources.map((r) => r.region));
  const counts = { Idle: 0, Underutilized: 0, Optimal: 0, Overloaded: 0 };
  resources.forEach((r) => { if (counts[r.classification] !== undefined) counts[r.classification]++; });
  const splitColor = { Idle: COLOR.ink, Underutilized: COLOR.yellow, Optimal: COLOR.green, Overloaded: COLOR.mutedDark };
  const splits = Object.keys(counts).map((k) => ({
    label: k, count: counts[k], pct: resources.length ? Math.round((counts[k] / resources.length) * 100) : 0, color: splitColor[k]
  }));

  const pctChange = (cur, base) => (base ? ((cur - base) / base) * 100 : 0);
  const deltaChip = (cur, base, lowerIsBetter = true) => {
    const change = pctChange(cur, base);
    if (Math.abs(change) < 0.1) return { text: 'stable', bg: COLOR.track, fg: COLOR.body };
    const improved = lowerIsBetter ? change < 0 : change > 0;
    return {
      text: `${change > 0 ? '+' : ''}${change.toFixed(1)}% since open`,
      bg: improved ? COLOR.greenTint : COLOR.yellowTint2,
      fg: improved ? COLOR.green : COLOR.yellowInk2
    };
  };

  const idleDelta = baseline && summary.idleDetected > baseline.idleDetected
    ? { text: `+${summary.idleDetected - baseline.idleDetected} this session`, bg: COLOR.yellow, fg: COLOR.yellowInk }
    : { text: 'stable', bg: COLOR.track, fg: COLOR.body };
  const energyDelta = deltaChip(summary.totalEnergyKWh, baseline?.totalEnergyKWh);
  const carbonDelta = deltaChip(summary.totalCarbonKg, baseline?.totalCarbonKg);
  const costDelta = deltaChip(summary.totalCostINR, baseline?.totalCostINR);

  const tiles = [
    { label: 'Instances ingested', value: resources.length, unit: 'virtual machines', delta: 'stable', bg: COLOR.track, fg: COLOR.body },
    { label: 'Idle flagged', value: summary.idleDetected, unit: 'below classification threshold', delta: idleDelta.text, bg: idleDelta.bg, fg: idleDelta.fg },
    { label: 'Energy footprint', value: n0(summary.totalEnergyKWh), unit: 'kWh per month', delta: energyDelta.text, bg: energyDelta.bg, fg: energyDelta.fg },
    { label: 'Carbon footprint', value: n0(summary.totalCarbonKg), unit: 'kg CO₂ per month', delta: carbonDelta.text, bg: carbonDelta.bg, fg: carbonDelta.fg },
    { label: 'Operations cost', value: `₹${n0(summary.totalCostINR)}`, unit: 'per month, all zones', delta: costDelta.text, bg: costDelta.bg, fg: costDelta.fg }
  ];

  const loadLine = buildLinePath(historyRef.current, 640, 14, 168);

  return (
    <div>
      {banner && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 28px', background: COLOR.paper, borderBottom: `2px solid ${COLOR.ink}`, borderLeft: `8px solid ${banner.accent}` }}>
          <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted }}>{banner.label}</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{banner.text}</span>
          <button onClick={() => setBanner(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 0, cursor: 'pointer', color: COLOR.muted, fontSize: 16 }}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 28px', background: COLOR.ink, color: '#fff', borderBottom: `2px solid ${COLOR.ink}`, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.yellow, fontWeight: 700 }}>
          <span style={{ width: 8, height: 8, background: COLOR.greenLed, display: 'block', flex: 'none' }} />Stream active
        </span>
        <span style={{ fontSize: 13 }}>Fleet running at <span style={{ fontWeight: 800, fontSize: 17, color: COLOR.yellow }}>{Math.round(summary.liveCpu)}%</span> mean computational load · {regionSet.size} region{regionSet.size === 1 ? '' : 's'} · refreshed just now</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', borderBottom: `2px solid ${COLOR.ink}`, background: COLOR.paper }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ padding: '22px 20px', borderRight: `2px solid ${COLOR.ink}`, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 10 }}>{t.label}</span>
            <span style={{ display: 'block', fontSize: 'clamp(24px, 2.1vw, 34px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, overflowWrap: 'anywhere' }}>{t.value}</span>
            <span style={{ display: 'block', fontSize: 11, color: COLOR.muted, marginTop: 8 }}>{t.unit}</span>
            <span style={{ display: 'inline-block', marginTop: 12, padding: '2px 7px', background: t.bg, color: t.fg, fontSize: 10, fontWeight: 800, letterSpacing: '0.04em' }}>{t.delta}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', borderBottom: `2px solid ${COLOR.ink}`, background: COLOR.paper }}>
        <div style={{ padding: '22px 24px', borderRight: `2px solid ${COLOR.ink}`, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <h4 style={{ margin: 0, fontSize: 15, letterSpacing: '0.01em' }}>Fleet load, this session</h4>
            <span style={{ fontSize: 11, color: COLOR.muted }}>% mean CPU · sampled every 2s</span>
          </div>
          <svg viewBox="0 0 640 170" width="100%" height="170" preserveAspectRatio="none" role="img" aria-label="Fleet CPU load this session">
            {[42, 80, 118, 156].map((y) => <line key={y} x1="0" y1={y} x2="640" y2={y} stroke={COLOR.hairline} strokeWidth="1" />)}
            <path d={loadLine.area} fill={COLOR.yellowTint2} />
            <path d={loadLine.path} fill="none" stroke={COLOR.ink} strokeWidth="2.5" />
            <line x1="0" y1="168" x2="640" y2="168" stroke={COLOR.ink} strokeWidth="2" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: COLOR.muted, marginTop: 6 }}>
            <span>opened</span><span>now</span>
          </div>
        </div>
        <div style={{ padding: '22px 24px', minWidth: 0 }}>
          <h4 style={{ margin: '0 0 14px', fontSize: 15 }}>Classification split</h4>
          {splits.map((s) => (
            <div key={s.label} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                <span style={{ fontWeight: 700 }}>{s.label}</span>
                <span style={{ color: COLOR.muted }}>{s.count} · {s.pct}%</span>
              </div>
              <div style={{ height: 10, background: COLOR.track, border: `1px solid ${COLOR.hairline2}` }}>
                <div style={{ height: '100%', width: `${s.pct}%`, background: s.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '22px 28px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <h4 style={{ margin: 0, fontSize: 15 }}>Instance register</h4>
          <span style={{ fontSize: 11, color: COLOR.muted }}>{resources.length} rows · sorted by monthly cost</span>
        </div>
        <div style={{ border: `2px solid ${COLOR.ink}`, background: COLOR.paper, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 820 }}>
            <thead>
              <tr style={{ background: COLOR.ink, color: '#fff' }}>
                {['Instance', 'Region', 'Env', 'CPU', 'Class', 'kWh / mo', 'kg CO₂', '₹ / mo'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 3 || i > 4 ? 'right' : 'left', padding: '10px 12px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resources.map((n) => (
                <tr key={n._id} style={{ borderBottom: `1px solid ${COLOR.hairline}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = COLOR.yellowTint; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '9px 12px', fontWeight: 700 }}>{n.serverName}</td>
                  <td style={{ padding: '9px 12px', textTransform: 'uppercase', font: '600 11px ui-monospace, Menlo, monospace', letterSpacing: '0.04em' }}>{zoneLabel(n.region)}</td>
                  <td style={{ padding: '9px 12px', color: COLOR.muted, textTransform: 'uppercase', fontSize: 11 }}>{n.environment}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700 }}>{n.cpuUtilization}%</td>
                  <td style={{ padding: '9px 12px' }}><ClassificationChip classification={n.classification} /></td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>{n0(n.energyKWh)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>{n1(n.carbonKg)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700 }}>₹{n0(n.costINR)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
