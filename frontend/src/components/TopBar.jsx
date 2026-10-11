import React from 'react';
import { useNavigate } from 'react-router-dom';
import { COLOR } from '../theme';

const TopBar = ({ pageIndex, pageKicker, pageTitle }) => {
  const navigate = useNavigate();
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 5, background: COLOR.paper, borderBottom: `2px solid ${COLOR.ink}`,
      padding: '18px 28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap'
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
          <span style={{ font: '600 10px ui-monospace, Menlo, monospace', letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted }}>{pageIndex}</span>
          <span style={{ width: 16, height: 2, background: COLOR.ink, display: 'block' }} />
          <span style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted }}>{pageKicker}</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{pageTitle}</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/app/reports')}
          style={{
            display: 'inline-flex', alignItems: 'center', padding: '11px 18px', background: COLOR.yellow, color: COLOR.ink,
            fontWeight: 800, fontSize: 13, letterSpacing: '0.02em', border: `1.5px solid ${COLOR.ink}`, whiteSpace: 'nowrap', cursor: 'pointer'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = COLOR.yellowHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = COLOR.yellow; }}
        >
          Export report
        </button>
      </div>
    </header>
  );
};

export default TopBar;
