import React from 'react';
import { COLOR } from '../theme';

// The app's mark, animated: a 3x3 pixel-grid "rack" (same hard-edged,
// square-cell language as the Landing page's hero rack grid — no rounded
// corners, no circles, no gradients) inside a rotating corner-bracket
// reticle. Idle state breathes gently (slow ring, steady LEDs); `busy`
// speeds the ring up, blinks the LEDs, and sweeps a scan line — the same
// motion vocabulary already defined once in index.css (.ec-logo-*) so the
// Splash screen and the sidebar's live logo stay visually identical.
//
// Used both live (this component) and frozen (frontend/scripts/icon-source.svg
// is a separate, static master used to generate the installed-app icons —
// a live animated node is the wrong source for a PNG snapshot).
//
// `tone` says what surface the logo sits on, not what the logo "is" — the
// ring/brackets/grid are ink-colored by default (tone="light", for the
// paper/canvas backgrounds every page uses) and flip to paper-colored for
// tone="dark" (the one case so far: Sidebar's ink-black rail). Getting this
// wrong means ink-on-ink — the mark silently disappears, not an error.
const Logo = ({ size = 40, busy = false, title = 'EcoCompute', tone = 'light' }) => {
  const mark = tone === 'dark' ? COLOR.paper : COLOR.ink;
  const cells = [
    [1, 0, 1],
    [0, 1, 0],
    [1, 1, 0]
  ];
  const ledCell = busy ? [1, 1] : null; // row,col of the one cell that blinks when busy

  return (
    <div
      className={busy ? 'ec-logo-busy' : ''}
      role="img"
      aria-label={`${title} — ${busy ? 'working' : 'idle'}`}
      style={{ position: 'relative', width: size, height: size, flex: 'none' }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block', overflow: 'visible' }}>
        {/* breathing glow, behind everything */}
        <rect x="18" y="18" width="64" height="64" fill="none" stroke={COLOR.yellow} strokeWidth="10" className="ec-logo-glow" style={{ filter: 'blur(6px)' }} />

        {/* outer dashed ring, counter-rotating, slower */}
        <rect x="6" y="6" width="88" height="88" fill="none" stroke={mark} strokeWidth="2" strokeDasharray="8 7" className="ec-logo-ring-slow" />

        {/* 4 corner brackets, rotating */}
        <g className="ec-logo-ring">
          {[[14, 14, 0], [86, 14, 90], [86, 86, 180], [14, 86, 270]].map(([cx, cy, rot], i) => (
            <path
              key={i}
              d="M -10 -2 H -2 V -10"
              stroke={mark}
              strokeWidth="4"
              strokeLinecap="square"
              fill="none"
              transform={`translate(${cx} ${cy}) rotate(${rot})`}
            />
          ))}
        </g>

        {/* the 3x3 rack grid */}
        <g>
          {cells.map((row, r) => row.map((filled, c) => {
            const x = 30 + c * 14;
            const y = 30 + r * 14;
            const isLed = ledCell && r === ledCell[0] && c === ledCell[1];
            return (
              <rect
                key={`${r}-${c}`}
                x={x} y={y} width="11" height="11"
                fill={isLed ? COLOR.yellow : (filled ? mark : 'none')}
                stroke={mark}
                strokeWidth="1.5"
                className={isLed ? 'ec-logo-led' : undefined}
              />
            );
          }))}
        </g>

        {/* scan line — only rendered while busy */}
        {busy && (
          <rect x="28" y="28" width="44" height="2" fill={COLOR.yellow} className="ec-logo-scan" />
        )}
      </svg>
    </div>
  );
};

export default Logo;
