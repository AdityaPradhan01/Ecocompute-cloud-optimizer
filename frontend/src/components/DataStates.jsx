import React from 'react';
import { useNavigate } from 'react-router-dom';
import { COLOR } from '../theme';

// Real request-lifecycle states (loading / empty / error), replacing the
// prototype's "Preview state" toggle — the design spec explicitly calls
// that control a review-only affordance that should never ship.

export const LoadingSkeletons = ({ tiles = 5 }) => (
  <div style={{ padding: 28 }}>
    <div style={{ border: `2px solid ${COLOR.ink}`, background: COLOR.paper, padding: '16px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{ width: 10, height: 10, background: COLOR.yellow, display: 'block', flex: 'none' }} />
      <span style={{ fontSize: 13, fontWeight: 700 }}>Synchronising telemetry datastore…</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', border: `2px solid ${COLOR.ink}`, background: COLOR.paper }}>
      {Array.from({ length: tiles }).map((_, i) => (
        <div key={i} style={{ padding: '22px 20px', borderRight: `1.5px solid ${COLOR.hairline}` }}>
          <div style={{ height: 9, width: '60%', background: COLOR.hairline, marginBottom: 14 }} />
          <div style={{ height: 28, width: '45%', background: COLOR.track }} />
        </div>
      ))}
    </div>
  </div>
);

export const EmptyFleetState = ({ onSeed }) => {
  const navigate = useNavigate();
  return (
    <div style={{ padding: 28 }}>
      <div style={{ border: `2px solid ${COLOR.ink}`, background: COLOR.paper, padding: '54px 40px', maxWidth: 760 }}>
        <span style={{ display: 'inline-block', width: 40, height: 40, background: COLOR.yellow, border: `2px solid ${COLOR.ink}`, marginBottom: 22 }} />
        <h3 style={{ margin: '0 0 10px', fontSize: 26, letterSpacing: '-0.02em' }}>No fleet snapshot loaded</h3>
        <p style={{ margin: '0 0 22px', maxWidth: '52ch', color: COLOR.body }}>Every figure on this screen is computed from an ingested dataset. Upload a CSV of your instances, or seed the demo fleet to walk the product end to end.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/app')}
            style={{ display: 'inline-flex', padding: '12px 20px', background: COLOR.yellow, color: COLOR.ink, border: `2px solid ${COLOR.ink}`, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
          >
            Go to data intake
          </button>
          {onSeed && (
            <button
              onClick={onSeed}
              style={{ display: 'inline-flex', padding: '12px 20px', background: COLOR.paper, color: COLOR.ink, border: `2px solid ${COLOR.ink}`, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
            >
              Seed demo fleet
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const ErrorFleetState = ({ endpoint, onRetry }) => {
  const navigate = useNavigate();
  return (
    <div style={{ padding: 28 }}>
      <div style={{ border: `2px solid ${COLOR.ink}`, background: COLOR.ink, color: '#fff', padding: '30px 28px', maxWidth: 760 }}>
        <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: COLOR.yellow, marginBottom: 12 }}>Pipeline failure · connection error</span>
        <h3 style={{ margin: '0 0 10px', fontSize: 24, letterSpacing: '-0.02em', color: '#fff' }}>Telemetry API did not respond</h3>
        <p style={{ margin: '0 0 20px', maxWidth: '52ch', color: COLOR.copyDark }}>
          The request to <span style={{ font: '600 12px ui-monospace, Menlo, monospace', color: COLOR.yellow }}>{endpoint}</span> failed. Figures below would be stale, so they are withheld.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={onRetry}
            style={{ padding: '12px 20px', background: COLOR.yellow, color: COLOR.ink, border: `2px solid ${COLOR.yellow}`, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
          >
            Retry now
          </button>
          <button
            onClick={() => navigate('/app/reports')}
            style={{ display: 'inline-flex', padding: '12px 20px', background: 'transparent', color: '#fff', border: '2px solid #4a4a45', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
          >
            View last good report
          </button>
        </div>
      </div>
    </div>
  );
};
