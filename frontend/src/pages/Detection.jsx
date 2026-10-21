import React, { useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import { COLOR, ZONES, n0, n1 } from '../theme';

const CLS_NOTES = {
  Idle: 'Under the idle threshold for the sampled window. The engine will recommend a full shutdown — the entire monthly cost is recoverable.',
  Underutilized: 'Below the optimal band. A smaller instance type carries this load; expect a meaningful cut in the line item.',
  Optimal: 'Sized correctly. Remaining gains come from moving the workload to a cleaner-grid region.',
  Overloaded: 'Above the overloaded threshold. Cost is justified but headroom is thin; scale out before the next traffic peak.'
};
const CLS_ACTIONS = { Idle: 'Shut down', Underutilized: 'Rightsize', Optimal: 'Hold', Overloaded: 'Scale out' };
const CLS_BANNER_BG = { Idle: COLOR.yellowTint2, Underutilized: COLOR.yellowTint2, Optimal: COLOR.greenTint, Overloaded: COLOR.paper };

const Detection = () => {
  const [tdp, setTdp] = useState('165');
  const [util, setUtil] = useState(45);
  const [region, setRegion] = useState('ap-south-1');
  const [rate, setRate] = useState('9.40');
  const [metrics, setMetrics] = useState(null);
  const [settings, setSettings] = useState(null);
  const [justRecomputed, setJustRecomputed] = useState(false);
  const justRecomputedTimer = useRef(null);

  useEffect(() => {
    client.get('/api/settings').then((res) => setSettings(res.data)).catch(() => {});
  }, []);

  useEffect(() => () => clearTimeout(justRecomputedTimer.current), []);

  const gridFactors = settings?.gridFactors || Object.fromEntries(ZONES.map((z) => [z.id, z.factor]));
  const pue = settings?.pue ?? 1.2;

  const recompute = () => {
    client.post('/api/detection/calculate', { tdp, utilization: util, region, hourlyRate: rate })
      .then((res) => {
        setMetrics(res.data);
        // Visible confirmation even when the numbers come back unchanged
        // (e.g. clicking the button with no edited inputs) — otherwise a
        // same-value response looks identical to the click doing nothing.
        setJustRecomputed(true);
        clearTimeout(justRecomputedTimer.current);
        justRecomputedTimer.current = setTimeout(() => setJustRecomputed(false), 900);
      })
      .catch((err) => setMetrics(err.response?.data ? { error: err.response.data.error } : { error: 'Calculation failed.' }));
  };

  // Recomputes on every input change — debounced so a drag on the CPU
  // slider doesn't fire a request per pixel, while still needing no submit.
  useEffect(() => {
    const t = setTimeout(recompute, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tdp, util, region, rate]);

  const dCls = metrics?.classification;

  const regionCompare = useMemo(() => {
    if (!metrics || metrics.error) return [];
    const energyKWh = parseFloat(metrics.energyKWh);
    return ZONES.map((z) => {
      const factor = gridFactors[z.id] ?? z.factor;
      const carbon = (energyKWh * pue * factor) / 1000;
      const currentCarbon = parseFloat(metrics.carbonKg);
      const delta = carbon - currentCarbon;
      return {
        id: z.id, label: z.label, factor,
        carbon: n1(carbon),
        delta: z.id === region ? 'current' : (delta > 0 ? `+${n1(delta)}` : n1(delta)),
        deltaFg: z.id === region ? COLOR.muted : (delta > 0 ? COLOR.ink : COLOR.green),
        rowBg: z.id === region ? COLOR.yellowTint2 : COLOR.paper
      };
    });
  }, [metrics, region, gridFactors, pue]);

  return (
    <section style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start' }}>
      <div style={{ padding: '26px 24px', borderRight: `2px solid ${COLOR.ink}`, background: COLOR.paper, minHeight: '100%' }}>
        <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>Resource characteristics</h4>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: COLOR.muted }}>Figures recompute as you type. Nothing is written to the fleet.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>Power draw — TDP watts</label>
            <input type="number" value={tdp} onChange={(e) => setTdp(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${COLOR.ink}`, background: COLOR.paper, color: COLOR.ink, fontSize: 14, fontWeight: 700 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>CPU utilization — {util}%</label>
            <input type="range" min="0" max="100" value={util} onChange={(e) => setUtil(parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: COLOR.yellow }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: COLOR.muted, marginTop: 4 }}><span>Idle</span><span>Optimal</span><span>Overloaded</span></div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>AWS region</label>
            <select value={region} onChange={(e) => setRegion(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${COLOR.ink}`, background: COLOR.paper, color: COLOR.ink, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {ZONES.map((z) => (
                <option key={z.id} value={z.id}>{z.label} — {gridFactors[z.id] ?? z.factor} gCO₂/kWh</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>Hourly rate — ₹</label>
            <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${COLOR.ink}`, background: COLOR.paper, color: COLOR.ink, fontSize: 14, fontWeight: 700 }} />
          </div>
          <button onClick={recompute} style={{ padding: '13px 18px', background: justRecomputed ? COLOR.green : COLOR.yellow, color: justRecomputed ? '#fff' : COLOR.ink, border: `2px solid ${COLOR.ink}`, fontWeight: 800, fontSize: 13, textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s ease' }}>{justRecomputed ? 'Recomputed ✓' : 'Recompute diagnostics'}</button>
          <div style={{ borderTop: `1.5px solid ${COLOR.hairline2}`, paddingTop: 14 }}>
            <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 8 }}>Constants in use</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, font: '600 11px ui-monospace, Menlo, monospace', color: COLOR.body }}>
              <span>PUE = {pue}</span>
              <span>HOURS_PER_MONTH = 730</span>
              <span>GRID = {gridFactors[region] ?? '—'} gCO₂/kWh</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ padding: '10px 26px', borderBottom: `2px solid ${COLOR.ink}`, background: COLOR.ink, color: COLOR.yellow, fontSize: 11, fontWeight: 700, letterSpacing: '0.02em' }}>
          Hypothetical instance — not tied to your uploaded fleet. This panel only reflects the values entered on the left.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: '20px 26px', borderBottom: `2px solid ${COLOR.ink}`, background: dCls ? CLS_BANNER_BG[dCls] : COLOR.paper, flexWrap: 'wrap' }}>
          <div>
            <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>Profile classification</span>
            <h3 style={{ margin: 0, fontSize: 30, letterSpacing: '-0.025em' }}>{dCls || (metrics?.error ? 'Error' : '—')}</h3>
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: COLOR.body, maxWidth: '60ch' }}>{metrics?.error || (dCls && CLS_NOTES[dCls]) || ''}</p>
          </div>
          {dCls && <span style={{ display: 'inline-block', padding: '9px 16px', background: COLOR.ink, color: '#fff', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{CLS_ACTIONS[dCls]}</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', background: COLOR.paper, borderBottom: `2px solid ${COLOR.ink}` }}>
          <div style={{ padding: '26px 24px', borderRight: `2px solid ${COLOR.ink}` }}>
            <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 10 }}>Energy consumption</span>
            <span style={{ display: 'block', fontSize: 'clamp(30px, 3vw, 42px)', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1 }}>{metrics?.energyKWh ?? '—'}<span style={{ fontSize: 16, fontWeight: 600 }}> kWh</span></span>
            <span style={{ display: 'block', font: '600 11px ui-monospace, Menlo, monospace', color: COLOR.muted, marginTop: 12 }}>(TDP × 730 × CPU%) ÷ 100000</span>
          </div>
          <div style={{ padding: '26px 24px' }}>
            <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 10 }}>Carbon footprint</span>
            <span style={{ display: 'block', fontSize: 'clamp(30px, 3vw, 42px)', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1, color: COLOR.green }}>{metrics?.carbonKg ?? '—'}<span style={{ fontSize: 16, fontWeight: 600 }}> kg CO₂</span></span>
            <span style={{ display: 'block', font: '600 11px ui-monospace, Menlo, monospace', color: COLOR.muted, marginTop: 12 }}>(Energy × PUE × Grid) ÷ 1000</span>
          </div>
        </div>

        <div style={{ padding: '26px 24px', background: COLOR.yellow, borderBottom: `2px solid ${COLOR.ink}` }}>
          <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.yellowInk, marginBottom: 10 }}>Estimated monthly cost</span>
          <span style={{ display: 'block', fontSize: 'clamp(34px, 3.6vw, 52px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>₹{metrics?.costINR !== undefined ? n0(metrics.costINR) : '—'}</span>
          <span style={{ display: 'block', font: '600 11px ui-monospace, Menlo, monospace', color: COLOR.yellowInk, marginTop: 12 }}>Hourly rate × 730 hours</span>
        </div>

        <div style={{ padding: '24px 26px 40px' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 15 }}>Same instance, other AWS regions</h4>
          <div style={{ border: `2px solid ${COLOR.ink}`, background: COLOR.paper }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: COLOR.ink, color: '#fff' }}>
                  <th style={{ textAlign: 'left', padding: '9px 12px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Region</th>
                  <th style={{ textAlign: 'right', padding: '9px 12px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Grid factor</th>
                  <th style={{ textAlign: 'right', padding: '9px 12px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>kg CO₂ / mo</th>
                  <th style={{ textAlign: 'right', padding: '9px 12px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Δ vs current</th>
                </tr>
              </thead>
              <tbody>
                {regionCompare.map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${COLOR.hairline}`, background: r.rowBg }}>
                    <td style={{ padding: '9px 12px', fontWeight: 700 }}>{r.label}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', font: '600 11px ui-monospace, Menlo, monospace' }}>{r.factor}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>{r.carbon}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: r.deltaFg }}>{r.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Detection;
