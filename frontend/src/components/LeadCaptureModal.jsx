import React, { useState } from 'react';
import { COLOR } from '../theme';
import client from '../api/client';

// Public — no auth token on this request, unlike the rest of the app's API
// calls (client.js attaches one if present, but there's none to attach
// before login). Backend: POST /api/leads (routes/leads.js), rate-limited
// and honeypot-guarded (see backend/controllers/leadsController.js).
const LeadCaptureModal = ({ open, onClose }) => {
  const [form, setForm] = useState({ name: '', workEmail: '', company: '', companySize: '', message: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, text } | null

  if (!open) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      await client.post('/api/leads', form);
      setResult({ ok: true, text: "Thanks — we'll be in touch within a day to set up your instance." });
      setForm({ name: '', workEmail: '', company: '', companySize: '', message: '', website: '' });
    } catch (err) {
      setResult({ ok: false, text: err.response?.data?.error || 'Something went wrong — please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const field = (key, label, type = 'text', required = true) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>{label}{required ? '' : ' (optional)'}</label>
      <input
        type={type} value={form[key]} onChange={set(key)} required={required}
        style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${COLOR.ink}`, background: COLOR.paper, fontSize: 14 }}
      />
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(18,18,17,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50 }}>
      <form onSubmit={submit} style={{ background: COLOR.paper, border: `2px solid ${COLOR.ink}`, maxWidth: 480, width: '100%', boxShadow: '0 18px 44px rgba(0,0,0,0.35)' }}>
        <div style={{ padding: '20px 24px', borderBottom: `2px solid ${COLOR.ink}`, background: COLOR.yellow, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: COLOR.yellowInk, marginBottom: 6 }}>Book a walkthrough</span>
            <h3 style={{ margin: 0, fontSize: 22, letterSpacing: '-0.02em' }}>Tell us about your fleet</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 0, cursor: 'pointer', fontSize: 20, color: COLOR.yellowInk, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '22px 24px' }}>
          {/* Honeypot: real visitors never see this field (off-screen, not just
              display:none — some bots skip hidden fields but still fill
              off-screen ones, so this layers both signals). */}
          <input
            type="text" value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off"
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            aria-hidden="true"
          />

          {field('name', 'Your name')}
          {field('workEmail', 'Work email', 'email')}
          {field('company', 'Company')}
          {field('companySize', 'Company size', 'text', false)}
          <div style={{ marginBottom: 4 }}>
            <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>What are you hoping to find? (optional)</label>
            <textarea
              value={form.message} onChange={set('message')} rows={3}
              style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${COLOR.ink}`, background: COLOR.paper, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

          {result && (
            <div style={{ marginTop: 14, marginBottom: 4, border: `2px solid ${COLOR.ink}`, borderLeft: `8px solid ${result.ok ? COLOR.green : '#b00020'}`, padding: '10px 14px', fontSize: 12.5, fontWeight: 600 }}>
              {result.text}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '0 24px 22px', flexWrap: 'wrap' }}>
          <button
            type="submit" disabled={busy || result?.ok}
            style={{ padding: '12px 20px', background: COLOR.ink, color: '#fff', border: `2px solid ${COLOR.ink}`, fontWeight: 800, fontSize: 13, cursor: busy || result?.ok ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? 'Sending…' : (result?.ok ? 'Sent' : 'Request a walkthrough')}
          </button>
          <button
            type="button" onClick={onClose}
            style={{ padding: '12px 20px', background: COLOR.paper, color: COLOR.ink, border: `2px solid ${COLOR.ink}`, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
          >
            {result?.ok ? 'Close' : 'Cancel'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LeadCaptureModal;
