// client/src/context/AuthContext.jsx
// client/src/context/AuthContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { API_BASE_URL } from "./config";

const STORAGE_KEY = "sublynk_auth";
const AuthContext = createContext(null);



export function AuthProvider({ children }) {
  // Rehydrate from localStorage immediately (no render flash)
  const stored = (() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  })();

  const [token, setToken] = useState(stored.token || null);
  const [user, setUser] = useState(stored.user || null);
  const [loading, setLoading] = useState(true); // while confirming /me

  const persist = useCallback((tok, usr) => {
    if (!tok) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ token: tok, user: usr || null })
      );
    }
  }, []);

  const logout = useCallback(() => {
    // Clear state and storage
    setToken(null);
    setUser(null);
    persist(null, null);

    // Redirect to home after logout
    window.location.href = "/";
  }, [persist]);

  const login = useCallback(
    (tok, userObj) => {
      setToken(tok);
      setUser(userObj || null);
      persist(tok, userObj);
    },
    [persist]
  );

  // Authenticated fetch wrapper (optional helper)
  const authFetch = useCallback(
    async (url, options = {}) => {
      const headers = { ...(options.headers || {}) };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(url, { ...options, headers });
      // Optionally auto-logout on 401
      if (res.status === 401) logout();
      return res;
    },
    [token, logout]
  );

  // Validate stored token against /me on mount or token change
  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (!cancelled) logout();
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          const usr = data?.user || data || null;
          setUser(usr);
          persist(token, usr);
        }
      } catch {
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMe();
    return () => {
      cancelled = true;
    };
  }, [token, logout, persist]);

  const value = {
    user,
    token,
    isAuthed: !!token && !!user,
    loading,
    login,
    logout,
    authFetch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
