import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { COLOR, n0, n1 } from '../theme';
import { EmptyFleetState, ErrorFleetState, LoadingSkeletons } from '../components/DataStates';

const axisStyle = { fontFamily: 'Archivo, sans-serif', fontSize: 10, fill: COLOR.muted };

const Analytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    client.get('/api/analytics')
      .then((res) => { setData(res.data); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingSkeletons tiles={3} />;
  if (error) return <ErrorFleetState endpoint="/api/analytics" onRetry={load} />;
  if (!data || !data.top5Highest || data.top5Highest.length === 0) return <EmptyFleetState />;

  const totalCarbon = data.regionData.reduce((a, r) => a + r.currentCarbon, 0) || 1;
  const regionRows = [...data.regionData]
    .map((r) => ({ ...r, share: Math.round((r.currentCarbon / totalCarbon) * 100) }))
    .sort((a, b) => b.share - a.share);

  return (
    <section style={{ flex: 1 }}>
      <div style={{ padding: '22px 28px', background: COLOR.ink, color: '#fff', borderBottom: `2px solid ${COLOR.ink}` }}>
        <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: COLOR.yellow, marginBottom: 14 }}>Insights engine · {regionRows.reduce((a, r) => a + r.count, 0)} instances, {regionRows.length} region{regionRows.length === 1 ? '' : 's'}</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          {data.aiInsights.map((text, i) => (
            <div key={i} style={{ borderLeft: `3px solid ${COLOR.yellow}`, paddingLeft: 14 }}>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.45, color: '#fff' }}>{text}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', borderBottom: `2px solid ${COLOR.ink}`, background: COLOR.paper }}>
        <div style={{ padding: '22px 24px', borderRight: `2px solid ${COLOR.ink}` }}>
          <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 10 }}>Monthly savings target</span>
          <span style={{ display: 'block', fontSize: 'clamp(24px, 2.2vw, 34px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, overflowWrap: 'anywhere' }}>₹{n0(data.summary.monthlySavings)}</span>
        </div>
        <div style={{ padding: '22px 24px', borderRight: `2px solid ${COLOR.ink}`, background: COLOR.yellow }}>
          <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.yellowInk, marginBottom: 10 }}>Projected annual</span>
          <span style={{ display: 'block', fontSize: 'clamp(24px, 2.2vw, 34px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, overflowWrap: 'anywhere' }}>₹{n0(data.summary.annualSavings)}</span>
        </div>
        <div style={{ padding: '22px 24px' }}>
          <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 10 }}>Carbon abatement capacity</span>
          <span style={{ display: 'block', fontSize: 'clamp(24px, 2.2vw, 34px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: COLOR.green }}>{n1(data.summary.carbonSaved)}<span style={{ fontSize: 14, fontWeight: 600 }}> kg CO₂</span></span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', borderBottom: `2px solid ${COLOR.ink}`, background: COLOR.paper }}>
        <div style={{ padding: '22px 24px', borderRight: `2px solid ${COLOR.ink}`, minWidth: 0 }}>
          <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>Heaviest consumers</h4>
          <p style={{ margin: '0 0 14px', fontSize: 11, color: COLOR.muted }}>kWh per month · top five</p>
          <div style={{ height: 170 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.top5Highest}>
                <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={{ stroke: COLOR.ink, strokeWidth: 2 }} />
                <YAxis hide />
                <Tooltip contentStyle={{ fontFamily: 'Archivo, sans-serif', fontSize: 12, border: `1.5px solid ${COLOR.ink}`, borderRadius: 0 }} />
                <Bar dataKey="value" fill={COLOR.ink} radius={[0, 0, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={{ padding: '22px 24px', minWidth: 0 }}>
          <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>Leanest consumers</h4>
          <p style={{ margin: '0 0 14px', fontSize: 11, color: COLOR.muted }}>kWh per month · bottom five</p>
          <div style={{ height: 170 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.top5Lowest}>
                <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={{ stroke: COLOR.ink, strokeWidth: 2 }} />
                <YAxis hide />
                <Tooltip contentStyle={{ fontFamily: 'Archivo, sans-serif', fontSize: 12, border: `1.5px solid ${COLOR.ink}`, borderRadius: 0 }} />
                <Bar dataKey="value" fill={COLOR.green} radius={[0, 0, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', borderBottom: `2px solid ${COLOR.ink}`, background: COLOR.paper }}>
        <div style={{ padding: '22px 24px', borderRight: `2px solid ${COLOR.ink}`, minWidth: 0 }}>
          <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>Cost: current vs optimized</h4>
          <p style={{ margin: '0 0 14px', fontSize: 11, color: COLOR.muted }}>₹ per month, if the queue on Optimize is applied</p>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.costTrend}>
                <CartesianGrid stroke={COLOR.hairline} vertical={false} />
                <XAxis dataKey="timeline" tick={axisStyle} tickLine={false} axisLine={{ stroke: COLOR.ink, strokeWidth: 2 }} />
                <YAxis hide />
                <Tooltip contentStyle={{ fontFamily: 'Archivo, sans-serif', fontSize: 12, border: `1.5px solid ${COLOR.ink}`, borderRadius: 0 }} />
                <Line type="linear" dataKey="Cost" stroke={COLOR.ink} strokeWidth={2.5} dot={{ r: 4, fill: COLOR.yellow, stroke: COLOR.ink, strokeWidth: 1.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={{ padding: '22px 24px', minWidth: 0 }}>
          <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>Carbon: current vs optimized</h4>
          <p style={{ margin: '0 0 14px', fontSize: 11, color: COLOR.muted }}>kg CO₂ per month, same scenario</p>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.carbonTrend}>
                <CartesianGrid stroke={COLOR.hairline} vertical={false} />
                <XAxis dataKey="timeline" tick={axisStyle} tickLine={false} axisLine={{ stroke: COLOR.ink, strokeWidth: 2 }} />
                <YAxis hide />
                <Tooltip contentStyle={{ fontFamily: 'Archivo, sans-serif', fontSize: 12, border: `1.5px solid ${COLOR.ink}`, borderRadius: 0 }} />
                <Line type="linear" dataKey="Carbon" stroke={COLOR.green} strokeWidth={2.5} dot={{ r: 4, fill: '#fff', stroke: COLOR.green, strokeWidth: 1.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ padding: '22px 28px 40px' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 15 }}>Regional comparison</h4>
        <div style={{ border: `2px solid ${COLOR.ink}`, background: COLOR.paper, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 720 }}>
            <thead>
              <tr style={{ background: COLOR.ink, color: '#fff' }}>
                {['Region', 'Instances', 'Grid factor', 'Monthly ₹', 'kg CO₂', 'Share of fleet carbon'].map((h) => (
                  <th key={h} style={{ textAlign: h === 'Region' || h === 'Share of fleet carbon' ? 'left' : 'right', padding: '10px 12px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regionRows.map((r) => (
                <tr key={r.region} style={{ borderBottom: `1px solid ${COLOR.hairline}` }}>
                  <td style={{ padding: '9px 12px', fontWeight: 700, textTransform: 'uppercase', fontSize: 11.5, letterSpacing: '0.04em' }}>{r.label}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>{r.count}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', font: '600 11px ui-monospace, Menlo, monospace' }}>{r.factor}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700 }}>₹{n0(r.currentCost)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>{n1(r.currentCarbon)}</td>
                  <td style={{ padding: '9px 12px', minWidth: 160 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 8, background: COLOR.track, border: `1px solid ${COLOR.hairline2}` }}>
                        <div style={{ height: '100%', width: `${r.share}%`, background: COLOR.yellow }} />
                      </div>
                      <span style={{ fontSize: 11, color: COLOR.muted, flex: 'none' }}>{r.share}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default Analytics;
