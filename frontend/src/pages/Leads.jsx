import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { COLOR } from '../theme';

// Admin-only view of what the public Landing page's "Book a walkthrough"
// form has captured (backend: GET/PATCH /api/leads, behind requireAuth —
// the public submission endpoint is a separate, unauthenticated route).
// Note: in the single-tenant-per-customer deployment model (see
// docs/CUSTOMER_ONBOARDING.md), this screen is only meaningful on the one
// public marketing deployment — a customer's own private instance will
// just show an empty list here, which is harmless.
const STATUS_STYLE = {
  new: { bg: COLOR.yellowTint2, fg: COLOR.yellowInk2, border: COLOR.yellowBorder },
  contacted: { bg: COLOR.track, fg: COLOR.body, border: COLOR.hairline2 },
  provisioned: { bg: COLOR.greenTint, fg: COLOR.green, border: COLOR.greenBorder },
  closed: { bg: COLOR.paper, fg: COLOR.muted, border: COLOR.hairline2 }
};
const STATUSES = ['new', 'contacted', 'provisioned', 'closed'];

const Leads = () => {
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const load = () => client.get('/api/leads')
    .then((res) => { setLeads(res.data); setError(false); })
    .catch(() => setError(true));

  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    setUpdatingId(id);
    try {
      await client.patch(`/api/leads/${id}`, { status });
      load();
    } finally {
      setUpdatingId(null);
    }
  };

  if (error) return (
    <div style={{ padding: 28 }}>
      <div style={{ border: `2px solid ${COLOR.ink}`, background: COLOR.ink, color: '#fff', padding: '30px 28px', maxWidth: 600 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 22, color: '#fff' }}>Couldn't load leads</h3>
        <button onClick={load} style={{ padding: '11px 18px', background: COLOR.yellow, color: COLOR.ink, border: 0, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Retry</button>
      </div>
    </div>
  );

  if (!leads) return null;

  if (leads.length === 0) {
    return (
      <div style={{ padding: 28 }}>
        <div style={{ border: `2px solid ${COLOR.ink}`, background: COLOR.paper, padding: '54px 40px', maxWidth: 680 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 24, letterSpacing: '-0.02em' }}>No leads yet</h3>
          <p style={{ margin: 0, color: COLOR.body, maxWidth: '52ch' }}>Submissions from the Landing page's "Book a walkthrough" form will show up here. On a customer's own dedicated instance this will typically stay empty — it's only relevant on the one deployment you use for sales.</p>
        </div>
      </div>
    );
  }

  return (
    <section style={{ padding: '22px 28px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0, fontSize: 15 }}>Sales queue</h4>
        <span style={{ fontSize: 11, color: COLOR.muted }}>{leads.length} total · newest first</span>
      </div>
      <div style={{ border: `2px solid ${COLOR.ink}`, background: COLOR.paper, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 880 }}>
          <thead>
            <tr style={{ background: COLOR.ink, color: '#fff' }}>
              {['Submitted', 'Company', 'Contact', 'Size', 'Message', 'Status'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const chip = STATUS_STYLE[l.status] || STATUS_STYLE.new;
              return (
                <tr key={l._id} style={{ borderBottom: `1px solid ${COLOR.hairline}` }}>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', font: '600 11.5px ui-monospace, Menlo, monospace', color: COLOR.body }}>{new Date(l.createdAt).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 700 }}>{l.company}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ display: 'block' }}>{l.name}</span>
                    <span style={{ display: 'block', color: COLOR.muted, fontSize: 11.5 }}>{l.workEmail}</span>
                  </td>
                  <td style={{ padding: '9px 12px', color: COLOR.muted }}>{l.companySize || '—'}</td>
                  <td style={{ padding: '9px 12px', maxWidth: 260, color: COLOR.body }}>{l.message || '—'}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <select
                      value={l.status}
                      onChange={(e) => setStatus(l._id, e.target.value)}
                      disabled={updatingId === l._id}
                      style={{ padding: '4px 8px', border: `1.5px solid ${chip.border}`, background: chip.bg, color: chip.fg, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer' }}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default Leads;
