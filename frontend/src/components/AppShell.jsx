import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { COLOR } from '../theme';

const PAGES = {
  '/app': { idx: '00', kicker: 'Data intake', title: 'Bring your fleet into EcoCompute' },
  '/app/dashboard': { idx: '01', kicker: 'Live operations', title: 'Sustainability operations dashboard' },
  '/app/detection': { idx: '02', kicker: 'Sandbox', title: 'Telemetry detection' },
  '/app/optimize': { idx: '03', kicker: 'Policy engine', title: 'Resource optimization' },
  '/app/analytics': { idx: '04', kicker: 'Executive view', title: 'Analytics and intelligence' },
  '/app/reports': { idx: '05', kicker: 'Exports and settings', title: 'Reports and configuration' },
  '/app/connections': { idx: '06', kicker: 'Live sources', title: 'Connect your real servers' },
  '/app/leads': { idx: '07', kicker: 'Sales queue', title: 'Walkthrough requests' }
};

const AppShell = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const page = PAGES[location.pathname] || PAGES['/app'];

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '100vh', background: COLOR.canvas }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: COLOR.canvas }}>
        <TopBar pageIndex={page.idx} pageKicker={page.kicker} pageTitle={page.title} />
        <Outlet />
      </main>
    </div>
  );
};

export default AppShell;
