import React from 'react';
import { useNavigate } from 'react-router-dom';
import { COLOR, n0, n1 } from '../theme';
import Logo from '../components/Logo';
import useSummary from '../hooks/useSummary';

const RING_R = 68;
const RING_CIRC = 2 * Math.PI * RING_R;

// Standalone, no sidebar/shell — lives in its own small popup window (see
// Sidebar's "Pop-out widget" button, which opens this via window.open at
// the screen's right edge). Same auth as the rest of the app: RequireAuth
// wraps this route, so an unauthenticated popup just redirects to /login.
//
// What actually distinguishes a widget (Windows 11's Widgets board, macOS
// desktop widgets) from a shrunk page, in order of how much it matters:
//  1. It's a floating card with visible margin around it, not content
//     stretched edge-to-edge — edge-to-edge IS page/panel behavior.
//  2. Rounded corners. Every real widget has them; this app's pages
//     deliberately don't (flat, hard-bordered) — a scoped exception here,
//     on purpose, because looking like a widget outranks matching the
//     page chrome for the one surface whose whole job is to not look like
//     a page.
//  3. No boxes-around-labeled-data, no divider lines — plain typography.
// Sizing verified with an actual headless-Chrome screenshot at the real
// popup size before landing here, not guessed.
//
// Two ways this route gets opened, and they need different backdrops:
//  - Sidebar's "Pop-out widget" → a browser window.open() popup. Always
//    opaque (browsers don't let a popup see the real desktop behind it),
//    so it gets a neutral gray backdrop — closest achievable from a tab,
//    but still keeps its native title bar; a hard platform limit, not
//    fixable from here.
//  - electron/main.js → a real frameless, transparent, always-on-top
//    native window. Opened with ?shell=electron on the URL. There the
//    backdrop must be transparent, or it'd paint an opaque rectangle and
//    defeat the entire point of a transparent OS window.
const Widget = () => {
  const navigate = useNavigate();
  const { summary, status } = useSummary(2000);
  const isElectronShell = new URLSearchParams(window.location.search).get('shell') === 'electron';

  const offline = status === 'offline';
  const hasData = !offline && summary && summary.serversScanned > 0;
  const statusText = offline ? 'Backend offline' : (hasData ? 'Working — optimizing data' : 'Online — no data yet');
  const statusColor = offline ? '#b00020' : (hasData ? COLOR.green : COLOR.muted);

  const cpu = hasData ? Math.max(0, Math.min(100, summary.liveCpu)) : 0;
  const ringOffset = RING_CIRC * (1 - cpu / 100);

  const stat = (value, label) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>{value}</span>
      <span style={{ fontSize: 9, letterSpacing: '0.09em', textTransform: 'uppercase', color: COLOR.muted }}>{label}</span>
    </div>
  );

  return (
    <div style={{
      width: '100%', minHeight: '100vh', background: isElectronShell ? 'transparent' : '#e4e4de',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, boxSizing: 'border-box'
    }}>
      <div style={{
        width: '100%', maxWidth: 312, background: COLOR.paper, color: COLOR.ink,
        borderRadius: 26, boxShadow: '0 14px 36px rgba(18,18,17,0.24)', border: `1px solid ${COLOR.hairline2}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 24px 20px',
        fontFamily: "'Archivo', system-ui, sans-serif", boxSizing: 'border-box', textAlign: 'center'
      }}>
        <Logo size={34} busy={hasData} title="EcoCompute" />

        <div style={{ position: 'relative', margin: '16px 0 2px' }}>
          <svg viewBox="0 0 170 170" width={178} height={178}>
            <circle cx="85" cy="85" r={RING_R} fill="none" stroke={COLOR.hairline} strokeWidth="11" />
            <circle
              cx="85" cy="85" r={RING_R} fill="none" stroke={offline ? COLOR.hairline2 : COLOR.yellow} strokeWidth="11"
              strokeDasharray={RING_CIRC} strokeDashoffset={ringOffset} strokeLinecap="round"
              transform="rotate(-90 85 85)" style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
            <text x="85" y="80" textAnchor="middle" fontSize="38" fontWeight="800" fill={COLOR.ink} fontFamily="Archivo, sans-serif">
              {hasData ? Math.round(cpu) : '—'}{hasData ? '%' : ''}
            </text>
            <text x="85" y="103" textAnchor="middle" fontSize="9.5" fill={COLOR.muted} letterSpacing="0.1em" fontFamily="ui-monospace, Menlo, monospace">
              MEAN CPU
            </text>
          </svg>
        </div>

        <span style={{ display: 'block', fontSize: 32, fontWeight: 800, letterSpacing: '-0.025em' }}>
          {hasData ? `₹${n0(summary.totalCostINR)}` : '—'}
        </span>
        <span style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 18 }}>
          Monthly cost
        </span>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 22 }}>
          {stat(hasData ? summary.serversScanned : '—', 'Servers')}
          {stat(hasData ? summary.idleDetected : '—', 'Idle')}
          {stat(hasData ? n0(summary.totalEnergyKWh) : '—', 'kWh')}
          {stat(hasData ? n1(summary.totalCarbonKg) : '—', 'kg CO₂')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${COLOR.hairline}`, width: '100%' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: COLOR.muted }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor, display: 'block' }} />
            {statusText}
          </span>
          {isElectronShell ? (
            // In Electron, an in-SPA navigate() would cram the full
            // Dashboard into this tiny 344px frameless window — target="_blank"
            // is intercepted by main.js's setWindowOpenHandler and handed to
            // the user's real browser instead.
            <a
              href={`${window.location.origin}/app/dashboard`} target="_blank" rel="noopener noreferrer"
              style={{ color: COLOR.muted, fontSize: 10.5, letterSpacing: '0.04em', textDecoration: 'underline' }}
            >
              Open full dashboard · live every 2s
            </a>
          ) : (
            <button
              onClick={() => navigate('/app/dashboard')}
              style={{ background: 'transparent', border: 0, padding: 0, color: COLOR.muted, fontSize: 10.5, letterSpacing: '0.04em', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Open full dashboard · live every 2s
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Widget;
