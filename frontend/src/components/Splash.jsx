import React, { useEffect, useRef, useState } from 'react';
import { COLOR } from '../theme';
import Logo from './Logo';
import client from '../api/client';

const SESSION_KEY = 'ecocompute_splash_played';

// Grid cells behind the logo — same square-pixel language as the Landing
// hero's CELLS array, far fewer of them (this is a brief overlay, not a
// scroll-driven centerpiece). A handful pulse; the rest sit static.
const GRID_COLS = 10;
const GRID_ROWS = 6;
const PULSE_CELLS = new Set([3, 8, 14, 21, 27, 33, 41, 47, 52]);

const STEPS = [
  { key: 'starting', text: 'Starting EcoCompute engine', pct: 8 },
  { key: 'connecting', text: 'Connecting to data service', pct: 30 },
  { key: 'inventory', text: 'Loading server inventory', pct: 55 },
  { key: 'optimizing', text: 'Optimizing energy & carbon data', pct: 82 },
  { key: 'ready', text: 'Ready', pct: 100 }
];

// Plays once per browser session (sessionStorage) — reopening the SPA in
// the same tab/session won't replay it, matching how a real desktop app's
// splash only shows on launch, not on every window focus. The /widget
// route never renders this component at all (see App.js).
const Splash = ({ onDone }) => {
  // Read synchronously, before first paint — a repeat session this way
  // renders nothing at all, instead of flashing one frame of the full
  // overlay before the effect below fires onDone() and tears it down.
  const [alreadyPlayed] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [offline, setOffline] = useState(false);
  const [exiting, setExiting] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    if (alreadyPlayed) {
      doneRef.current = true;
      onDone();
      return;
    }

    let cancelled = false;
    const advance = (i) => { if (!cancelled) setStepIndex(i); };

    const run = async () => {
      advance(0);
      await new Promise((r) => setTimeout(r, 650));

      advance(1);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      try {
        // Public health check, not an authenticated endpoint — this splash
        // plays on /login too, before any token exists. Hitting an
        // authenticated route here always 401s pre-login and used to make
        // every single fresh session falsely report "offline mode", even
        // with a perfectly healthy backend.
        await client.get('/api/health', { signal: controller.signal });
      } catch {
        if (!cancelled) setOffline(true);
      } finally {
        clearTimeout(timeout);
      }

      advance(2);
      await new Promise((r) => setTimeout(r, 550));

      advance(3);
      await new Promise((r) => setTimeout(r, 650));

      advance(4);
      await new Promise((r) => setTimeout(r, 450));

      if (cancelled) return;
      sessionStorage.setItem(SESSION_KEY, '1');
      setExiting(true);
      await new Promise((r) => setTimeout(r, 450));
      if (!cancelled && !doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    };

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (alreadyPlayed) return null;

  const step = STEPS[stepIndex];
  // Pre-login, the health check can only confirm the backend itself is
  // reachable — not inventory contents, which need an authenticated
  // session. No fabricated count here; honest either way.
  const statusText = stepIndex === 1 && offline
    ? 'Starting in offline mode — no connection to the data service'
    : stepIndex === 2
      ? offline
        ? 'Server inventory unavailable — offline, showing nothing until reconnected'
        : 'Data service reachable'
      : step.text;

  return (
    <div className={`ec-splash-fade${exiting ? ' ec-splash-exit' : ''}`} style={{
      position: 'fixed', inset: 0, zIndex: 100, background: COLOR.canvas,
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', inset: 0, display: 'grid',
        gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
        gap: 2, padding: 2, opacity: 0.1
      }}>
        {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, i) => (
          <span key={i} className={PULSE_CELLS.has(i) ? 'ec-splash-cell' : undefined} style={{ border: `1px solid ${COLOR.hairline2}`, display: 'block' }} />
        ))}
      </div>

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, padding: 24, maxWidth: 420, width: '100%' }}>
        <Logo size={88} busy title="EcoCompute" />

        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 800, letterSpacing: '-0.03em', color: COLOR.ink }}>ECOCOMPUTE</h1>
          <p style={{ margin: 0, fontSize: 12.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: COLOR.muted }}>Cloud Optimizer — Detect · Quantify · Act</p>
        </div>

        <div style={{ width: '100%' }}>
          <div style={{ height: 4, background: COLOR.hairline, width: '100%' }}>
            <div style={{ height: '100%', width: `${step.pct}%`, background: COLOR.ink, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, minHeight: 18 }}>
            <span style={{ width: 6, height: 6, background: offline && stepIndex >= 1 ? '#b00020' : COLOR.green, display: 'block', flex: 'none' }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: COLOR.body, font: '600 12.5px ui-monospace, Menlo, monospace' }}>{statusText}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Splash;
