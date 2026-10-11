import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import AppShell from './components/AppShell';
import RequireAuth from './components/RequireAuth';
import Splash from './components/Splash';
import UpdateBanner from './components/UpdateBanner';
import { AuthProvider } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import DataIntake from './pages/DataIntake';
import Dashboard from './pages/Dashboard';
import Detection from './pages/Detection';
import Optimize from './pages/Optimize';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Connections from './pages/Connections';
import Leads from './pages/Leads';
import Widget from './pages/Widget';

// Needs useLocation, which only works inside <Router> — hence the split
// from App() below. Gates product entry points (/login, /app/*) behind
// <Splash> on first load this session. Two deliberate exceptions: "/" is
// the public marketing Landing page — a multi-second "booting the engine"
// sequence makes no sense before a prospect has even seen the product —
// and /widget is meant to sit in its own small popup window (see Sidebar's
// "Pop-out widget" button) and should render instantly.
const AppRoutes = () => {
  const location = useLocation();
  const [booted, setBooted] = useState(false);
  const skipSplash = location.pathname === '/' || location.pathname === '/widget';

  if (!skipSplash && !booted) {
    return <Splash onDone={() => setBooted(true)} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/widget" element={<RequireAuth><Widget /></RequireAuth>} />
      <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<DataIntake />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="detection" element={<Detection />} />
        <Route path="optimize" element={<Optimize />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="reports" element={<Reports />} />
        <Route path="connections" element={<Connections />} />
        <Route path="leads" element={<Leads />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
      <UpdateBanner />
    </AuthProvider>
  );
}

export default App;
