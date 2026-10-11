import React, { useEffect, useState } from 'react';
import { COLOR } from '../theme';
import { subscribeUpdate, applyUpdate } from '../pwa';

// A new service worker build doesn't take over automatically (see
// public/service-worker.js — no skipWaiting() on install) specifically so
// this banner can ask first. Without it, a customer's tab could silently
// stay pinned to a stale cached build after you ship an update. No-op in
// dev (subscribeUpdate only ever fires if a service worker is registered,
// which pwa.js only does in production).
const UpdateBanner = () => {
  const [available, setAvailable] = useState(false);

  useEffect(() => subscribeUpdate(setAvailable), []);

  if (!available) return null;

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
      padding: '12px 20px', background: COLOR.ink, borderTop: `2px solid ${COLOR.yellow}`, flexWrap: 'wrap'
    }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>A new version of EcoCompute is ready.</span>
      <button
        onClick={applyUpdate}
        style={{ padding: '8px 16px', background: COLOR.yellow, color: COLOR.ink, border: 0, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
      >
        Refresh now
      </button>
    </div>
  );
};

export default UpdateBanner;
