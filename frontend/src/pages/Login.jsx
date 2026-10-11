import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { COLOR } from '../theme';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const from = location.state?.from?.pathname || '/app';

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLOR.canvas }}>
      <form onSubmit={onSubmit} style={{ width: 360, border: `2px solid ${COLOR.ink}`, background: COLOR.paper, padding: '32px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 26 }}>
          <span style={{ width: 20, height: 20, background: COLOR.ink, display: 'block' }} />
          <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', color: COLOR.ink }}>ECOCOMPUTE</span>
        </div>
        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Sign in</h1>
        <p style={{ margin: '0 0 22px', fontSize: 12.5, color: COLOR.muted }}>Administrator access only.</p>

        <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>Username</label>
        <input
          type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required
          style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${COLOR.ink}`, background: COLOR.paper, fontSize: 14, marginBottom: 16 }}
        />

        <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>Password</label>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
          style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${COLOR.ink}`, background: COLOR.paper, fontSize: 14, marginBottom: 20 }}
        />

        {error && (
          <div style={{ marginBottom: 16, border: `2px solid ${COLOR.ink}`, borderLeft: '8px solid #b00020', padding: '10px 14px', fontSize: 12.5, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <button
          type="submit" disabled={busy}
          style={{ width: '100%', padding: '13px 18px', background: COLOR.yellow, color: COLOR.ink, border: `2px solid ${COLOR.ink}`, fontSize: 14, fontWeight: 800, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
};

export default Login;
