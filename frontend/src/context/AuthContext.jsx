import React, { createContext, useContext, useState, useCallback } from 'react';
import client, { getToken, setToken, clearToken, isTokenExpired } from '../api/client';

const AuthContext = createContext(null);

// A token merely *existing* in storage used to be enough to count as
// "authenticated" — an expired-but-present token would still render the
// protected shell for a frame before the first API call 401'd and bounced
// to /login. initialToken is only kept if it isn't already expired, so
// that gap is closed on the very first render, not after a round trip.
const initialToken = (() => {
  const t = getToken();
  return t && !isTokenExpired(t) ? t : null;
})();

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(initialToken);

  const login = useCallback(async (username, password) => {
    const res = await client.post('/api/auth/login', { username, password });
    setToken(res.data.token);
    setTokenState(res.data.token);
    return res.data;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
