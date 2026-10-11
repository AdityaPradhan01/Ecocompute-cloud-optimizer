import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { COLOR, ZONES, n0, n1, zoneLabel } from '../theme';
import ClassificationChip from '../components/ClassificationChip';
import { EmptyFleetState, ErrorFleetState, LoadingSkeletons } from '../components/DataStates';

const Optimize = () => {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [applying, setApplying] = useState(false);
  const [gridFactors, setGridFactors] = useState(Object.fromEntries(ZONES.map((z) => [z.id, z.factor])));
  const [awsActionBusy, setAwsActionBusy] = useState(null);
  const [awsActionResult, setAwsActionResult] = useState(null);

  const fetchRecommendations = () => {
    client.get('/api/optimize')
      .then((res) => { setItems(res.data); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRecommendations();
    client.get('/api/settings').then((res) => setGridFactors(res.data.gridFactors)).catch(() => {});
  }, []);

  const handleApplyOptimization = async () => {
    setApplying(true);
    try {
      const response = await client.post('/api/optimize/apply');
      setSummary(response.data.metrics);
      fetchRecommendations();
    } catch (err) {
      setError(true);
    } finally {
      setApplying(false);
    }
  };

  const handleAwsShutdown = async (r) => {
    const typed = window.prompt(`This stops a real AWS EC2 instance. Type "${r.serverName}" to confirm.`);
    if (typed !== r.serverName) return;
    setAwsActionBusy(r._id);
    setAwsActionResult(null);
    try {
      await client.post(`/api/optimize/apply-aws/${r._id}`, { confirm: typed });
      setAwsActionResult({ ok: true, text: `${r.serverName} is stopping on AWS.` });
      fetchRecommendations();
    } catch (err) {
      setAwsActionResult({ ok: false, text: err.response?.data?.error || 'Failed to execute the shutdown on AWS.' });
    } finally {
      setAwsActionBusy(null);
    }
  };

  if (loading) return <LoadingSkeletons tiles={4} />;
  if (error) return <ErrorFleetState endpoint="/api/optimize" onRetry={fetchRecommendations} />;
  if (items.length === 0) return <EmptyFleetState onSeed={() => client.post('/api/seed-demo').then(fetchRecommendations)} />;

  const sortedZones = Object.entries(gridFactors).sort((a, b) => a[1] - b[1]);
  const lowestZoneId = sortedZones[0]?.[0];
  const highestZoneId = sortedZones[sortedZones.length - 1]?.[0];

  const recCount = items.filter((r) => r.savingsPercent > 0).length;
  const sortedRecs = [...items].sort((a, b) => (b.currentCostINR * b.savingsPercent) - (a.currentCostINR * a.savingsPercent));

  const deltaCards = summary
    ? [
        { label: 'Monthly savings', value: `₹${n0(summary.monthlySavingsINR)}`, note: `across ${recCount} instances`, bg: COLOR.yellow, fg: COLOR.ink },
        { label: 'Projected annual', value: `₹${n0(summary.annualSavingsINR)}`, note: 'at current utilization', bg: COLOR.paper, fg: COLOR.ink },
        { label: 'Carbon reduction', value: `${n1(summary.co2ReductionKg)} kg`, note: 'CO₂ per month', bg: COLOR.paper, fg: COLOR.green },
        { label: 'Energy saved', value: `${n0(summary.energyReductionKWh)} kWh`, note: 'per month', bg: COLOR.paper, fg: COLOR.ink }
      ]
    : null;

  return (
    <section style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '22px 28px', borderBottom: `2px solid ${COLOR.ink}`, background: COLOR.paper, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: '64ch' }}>
          <h4 style={{ margin: '0 0 4px', fontSize: 16 }}>Active efficiency policies</h4>
          <p style={{ margin: 0, fontSize: 12.5, color: COLOR.body }}>Four rules run in order: shut down idle instances, rightsize the underutilized, schedule off-hours for dev and test, then flag lower-carbon-zone candidates. This button only computes the savings estimate — no infrastructure changes, no cloud API calls. For instances discovered via a live AWS connection, use the red "Shut down on AWS" action in the table below to actually stop that instance.</p>
        </div>
        <button onClick={handleApplyOptimization} disabled={applying} style={{ padding: '13px 22px', background: COLOR.yellow, color: COLOR.ink, border: `2px solid ${COLOR.ink}`, fontWeight: 800, fontSize: 13, cursor: applying ? 'default' : 'pointer', flex: 'none' }}>
          {applying ? 'Computing…' : (summary ? `Estimate computed · ${summary.logsWritten} logs written` : 'Preview savings (no changes)')}
        </button>
      </div>

      {deltaCards && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', borderBottom: `2px solid ${COLOR.ink}`, background: COLOR.paper }}>
          {deltaCards.map((d) => (
            <div key={d.label} style={{ padding: '22px 22px', borderRight: `2px solid ${COLOR.ink}`, background: d.bg }}>
              <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 10 }}>{d.label}</span>
              <span style={{ display: 'block', fontSize: 'clamp(22px, 1.9vw, 32px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: d.fg, overflowWrap: 'anywhere' }}>{d.value}</span>
              <span style={{ display: 'block', fontSize: 11, color: COLOR.muted, marginTop: 8 }}>{d.note}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '22px 28px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <h4 style={{ margin: 0, fontSize: 15 }}>Recommendation queue</h4>
          <span style={{ fontSize: 11, color: COLOR.muted }}>{recCount} actionable of {items.length} instances · ranked by rupee yield</span>
        </div>
        {awsActionResult && (
          <p style={{ margin: '0 0 10px', fontSize: 12.5, fontWeight: 700, color: awsActionResult.ok ? COLOR.green : '#b00020' }}>{awsActionResult.text}</p>
        )}
        <div style={{ border: `2px solid ${COLOR.ink}`, background: COLOR.paper, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 980 }}>
            <thead>
              <tr style={{ background: COLOR.ink, color: '#fff' }}>
                {['Instance', 'Zone', 'CPU', 'Class', 'Current ₹', 'Engine recommendation', 'Yield', 'Action'].map((h) => (
                  <th key={h} style={{ textAlign: h === 'CPU' || h === 'Current ₹' || h === 'Yield' ? 'right' : 'left', padding: '10px 12px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRecs.map((r) => (
                <tr key={r._id} style={{ borderBottom: `1px solid ${COLOR.hairline}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = COLOR.yellowTint; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '9px 12px', fontWeight: 700 }}>{r.serverName}</td>
                  <td style={{ padding: '9px 12px', textTransform: 'uppercase', font: '600 11px ui-monospace, Menlo, monospace' }}>{zoneLabel(r.region)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700 }}>{r.cpuUtilization}%</td>
                  <td style={{ padding: '9px 12px' }}><ClassificationChip classification={r.classification} /></td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>₹{n0(r.currentCostINR)}</td>
                  <td style={{ padding: '9px 12px' }}>{r.recommendation}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800, color: r.savingsPercent > 0 ? COLOR.green : COLOR.muted }}>{r.savingsPercent > 0 ? `−${r.savingsPercent}%` : 'stable'}</td>
                  <td style={{ padding: '9px 12px' }}>
                    {r.isLiveAws && r.recommendation === 'Shutdown Server' ? (
                      <button
                        onClick={() => handleAwsShutdown(r)}
                        disabled={awsActionBusy === r._id}
                        style={{ padding: '6px 10px', background: '#b00020', color: '#fff', border: 0, fontSize: 11, fontWeight: 800, cursor: awsActionBusy === r._id ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {awsActionBusy === r._id ? 'Stopping…' : 'Shut down on AWS'}
                      </button>
                    ) : <span style={{ color: COLOR.muted }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lowestZoneId && highestZoneId && (
          <p style={{ margin: '12px 0 0', fontSize: 11, color: COLOR.muted }}>
            Migration candidates show no rupee yield: the saving is carbon-side only, since {zoneLabel(lowestZoneId)} runs at {gridFactors[lowestZoneId]} gCO₂/kWh against {zoneLabel(highestZoneId)}'s {gridFactors[highestZoneId]}.
          </p>
        )}
      </div>
    </section>
  );
};

export default Optimize;
