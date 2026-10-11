import React from 'react';
import { COLOR } from '../theme';

// Replaces window.confirm for destructive actions (CSV ingest / demo seed
// replacing the active fleet snapshot).
const ConfirmModal = ({ open, title, body, cta, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(18,18,17,0.72)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50
    }}>
      <div style={{ background: COLOR.paper, border: `2px solid ${COLOR.ink}`, maxWidth: 520, width: '100%', boxShadow: '0 18px 44px rgba(0,0,0,0.35)' }}>
        <div style={{ padding: '20px 24px', borderBottom: `2px solid ${COLOR.ink}`, background: COLOR.yellow }}>
          <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: COLOR.yellowInk, marginBottom: 6 }}>Destructive action</span>
          <h3 style={{ margin: 0, fontSize: 22, letterSpacing: '-0.02em' }}>{title}</h3>
        </div>
        <div style={{ padding: '22px 24px' }}>
          <p style={{ margin: '0 0 8px', fontSize: 13.5, color: COLOR.body }}>{body}</p>
          <p style={{ margin: 0, fontSize: 12, color: COLOR.muted }}>The current snapshot is archived to the optimization log before it is overwritten.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '0 24px 22px', flexWrap: 'wrap' }}>
          <button
            onClick={onConfirm}
            style={{ padding: '12px 20px', background: COLOR.ink, color: '#fff', border: `2px solid ${COLOR.ink}`, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
          >
            {cta}
          </button>
          <button
            onClick={onCancel}
            style={{ padding: '12px 20px', background: COLOR.paper, color: COLOR.ink, border: `2px solid ${COLOR.ink}`, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = COLOR.canvas; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = COLOR.paper; }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
