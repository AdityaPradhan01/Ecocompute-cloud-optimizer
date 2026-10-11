import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Upload, LayoutDashboard, Activity, SlidersHorizontal, BarChart3, FileText, Server, LogOut, Users, PictureInPicture2, Download } from 'lucide-react';
import { COLOR } from '../theme';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import useSummary from '../hooks/useSummary';
import { canInstall, promptInstall, isStandalone, subscribeInstall } from '../pwa';

const ICON_PROPS = { size: 17, strokeWidth: 1.75, strokeLinecap: 'square', strokeLinejoin: 'miter' };

const NAV_ITEMS = [
  { to: '/app', end: true, label: 'Data intake', Icon: Upload },
  { to: '/app/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/app/detection', label: 'Detection', Icon: Activity },
  { to: '/app/optimize', label: 'Optimize', Icon: SlidersHorizontal },
  { to: '/app/analytics', label: 'Analytics', Icon: BarChart3 },
  { to: '/app/reports', label: 'Reports', Icon: FileText },
  { to: '/app/connections', label: 'Connections', Icon: Server },
  { to: '/app/leads', label: 'Leads', Icon: Users }
];

const openWidget = () => {
  // Must fire synchronously inside the click handler — if this runs after
  // an await, Chrome's popup blocker silently eats it.
  const w = 340, h = 600;
  const left = Math.max(0, Math.round((window.screen.availWidth || window.innerWidth) - w - 16));
  const top = Math.max(0, Math.round(((window.screen.availHeight || window.innerHeight) - h) / 2));
  window.open('/widget', 'ecocompute-widget', `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
};

const Sidebar = ({ collapsed, onToggle }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const railWidth = collapsed ? '72px' : '236px';
  const labelVis = collapsed ? 'none' : 'block';
  const { summary, status } = useSummary(5000); // sidebar footer doesn't need 2s — that's the widget's job
  const [installable, setInstallable] = useState(canInstall());
  const [standalone] = useState(isStandalone());

  useEffect(() => subscribeInstall(setInstallable), []);

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  const onInstall = async () => { await promptInstall(); };

  const offline = status === 'offline';
  const hasData = !offline && summary && summary.serversScanned > 0;
  const liveLabel = offline ? 'BACKEND OFFLINE' : (hasData ? 'OPTIMIZING DATA' : 'IDLE — NO DATA');
  const liveDot = offline ? '#ff6b6b' : (hasData ? COLOR.greenLed : COLOR.mutedDark);

  return (
    <aside style={{
      flex: 'none', width: railWidth, background: COLOR.ink, color: '#fff',
      borderRight: `2px solid ${COLOR.ink}`, position: 'sticky', top: 0, alignSelf: 'flex-start',
      height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.15s ease'
    }}>
      <div style={{ padding: '20px 16px 18px', borderBottom: `2px solid ${COLOR.inkSoft}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={22} busy={hasData} tone="dark" />
          <span style={{ display: labelVis, fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>ECOCOMPUTE</span>
        </div>
        <span style={{ display: labelVis, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.mutedDark, whiteSpace: 'nowrap' }}>Cloud carbon operations</span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', padding: '10px 0', gap: 2 }}>
        {NAV_ITEMS.map(({ to, end, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
              borderLeft: `4px solid ${isActive ? COLOR.yellow : 'transparent'}`,
              background: isActive ? '#232320' : 'transparent',
              color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none'
            })}
          >
            <Icon {...ICON_PROPS} style={{ flex: 'none', display: 'block' }} aria-hidden="true" />
            <span style={{ display: labelVis, whiteSpace: 'nowrap' }}>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', borderTop: `2px solid ${COLOR.inkSoft}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!collapsed && (
          <div className="ec-sidebar-tools" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={openWidget}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px',
                background: 'transparent', border: `1px solid ${COLOR.inkSoft}`, color: '#fff',
                fontSize: 11.5, fontWeight: 700, cursor: 'pointer'
              }}
            >
              <PictureInPicture2 {...ICON_PROPS} size={14} style={{ flex: 'none' }} aria-hidden="true" />
              Pop-out widget
            </button>
            <span style={{ fontSize: 9.5, color: COLOR.mutedDark, padding: '0 10px', lineHeight: 1.4 }}>
              Browser popup — keeps a title bar. For a frameless version docked to your screen edge, run the desktop widget app (<code style={{ font: '600 9.5px ui-monospace, Menlo, monospace' }}>electron/</code> in the repo — see README).
            </span>
            {!standalone && (
              installable ? (
                <button
                  onClick={onInstall}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px',
                    background: COLOR.yellow, border: `1px solid ${COLOR.yellow}`, color: COLOR.ink,
                    fontSize: 11.5, fontWeight: 800, cursor: 'pointer'
                  }}
                >
                  <Download {...ICON_PROPS} size={14} style={{ flex: 'none' }} aria-hidden="true" />
                  Install as app
                </button>
              ) : (
                <span style={{ fontSize: 10.5, color: COLOR.mutedDark, padding: '4px 10px', lineHeight: 1.4 }}>
                  Browser menu → Install EcoCompute
                </span>
              )
            )}
          </div>
        )}

        <div className="ec-sidebar-live-status" style={{ display: collapsed ? 'none' : 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.mutedDark }}>Live status</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#fff' }}>
            <span style={{ flex: 'none', width: 8, height: 8, background: liveDot, display: 'block' }} />
            {liveLabel}
          </span>
          {hasData && (
            <span style={{ fontSize: 11, color: COLOR.mutedDark }}>
              {summary.serversScanned} server{summary.serversScanned === 1 ? '' : 's'} · {Math.round(summary.liveCpu)}% CPU
            </span>
          )}
        </div>
        <button
          onClick={onLogout}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, width: '100%',
            padding: '8px 0', background: 'transparent', border: 0, borderTop: `1px solid ${COLOR.inkSoft}`,
            color: COLOR.mutedDark, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.yellow; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.mutedDark; }}
        >
          <LogOut {...ICON_PROPS} size={14} style={{ flex: 'none', display: 'block' }} aria-hidden="true" />
          {collapsed ? '' : 'Log out'}
        </button>
        <button
          onClick={onToggle}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, width: '100%',
            padding: '8px 0', background: 'transparent', border: 0, borderTop: `1px solid ${COLOR.inkSoft}`,
            color: COLOR.mutedDark, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.yellow; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.mutedDark; }}
        >
          {collapsed ? '»' : '« Collapse rail'}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
