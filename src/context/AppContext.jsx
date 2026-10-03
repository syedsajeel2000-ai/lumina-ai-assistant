import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api.js';
import { IconAlert, IconCheckSimple, IconSpark } from '../components/icons.jsx';

/* ── Toasts ─────────────────────────────────────────────────────── */
const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

const TOAST_ICONS = { success: IconCheckSimple, error: IconAlert, info: IconSpark };

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 220);
  }, []);

  const toast = useCallback(
    (message, type = 'success') => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-3), { id, message, type }]);
      setTimeout(() => dismiss(id), 3200);
    },
    [dismiss]
  );

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = TOAST_ICONS[t.type] || IconSpark;
          return (
            <motion.div
              key={t.id}
              className={`toast ${t.type} ${t.leaving ? 'leaving' : ''}`}
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={t.leaving ? { opacity: 0, x: 24 } : { opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            >
              <span className="t-icon"><Icon width={17} height={17} /></span>
              <span>{t.message}</span>
            </motion.div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* ── Auth ───────────────────────────────────────────────────────── */
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    api
      .me()
      .then((d) => live && setUser(d.user))
      .catch(() => live && setUser(null))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  const login = useCallback(async (payload) => {
    const d = await api.login(payload);
    setUser(d.user);
    return d.user;
  }, []);

  const signup = useCallback(async (payload) => {
    const d = await api.signup(payload);
    setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try { const d = await api.me(); setUser(d.user); } catch { /* ignore */ }
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, login, signup, logout, refresh, setUser }}>{children}</AuthCtx.Provider>
  );
}

/* ── Theme ──────────────────────────────────────────────────────── */
const THEME_KEY = 'lumina.theme';
const ThemeCtx = createContext(null);
export const useTheme = () => useContext(ThemeCtx);

function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem(THEME_KEY) || 'system');

  const apply = useCallback((t) => {
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const resolved = t === 'system' ? system : t;
    document.documentElement.dataset.theme = resolved;
  }, []);

  useEffect(() => {
    apply(theme);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => theme === 'system' && apply('system');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [theme, apply]);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
  }, []);

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
