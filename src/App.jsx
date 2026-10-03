import React from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppProviders, useAuth } from './context/AppContext.jsx';
import AppShell from './components/AppShell.jsx';
import Landing from './pages/Landing.jsx';
import { LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage } from './pages/Auth.jsx';
import Chat from './pages/Chat.jsx';
import History from './pages/History.jsx';
import Saved from './pages/Saved.jsx';
import Templates from './pages/Templates.jsx';
import Settings from './pages/Settings.jsx';
import Help from './pages/Help.jsx';
import NotFound from './pages/NotFound.jsx';

function FullPageLoader() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <span className="spinner" style={{ width: 30, height: 30 }} aria-label="Loading" />
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (user) return <Navigate to="/app/chat" replace />;
  return children;
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
          <Route path="/signup" element={<RedirectIfAuthed><SignupPage /></RedirectIfAuthed>} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* App (authenticated) — nested routes render via <Outlet/> */}
          <Route path="/app" element={<RequireAuth><AppShell><Outlet /></AppShell></RequireAuth>}>
            <Route index element={<Navigate to="/app/chat" replace />} />
            <Route path="chat" element={<Chat />} />
            <Route path="history" element={<History />} />
            <Route path="saved" element={<Saved />} />
            <Route path="templates" element={<Templates />} />
            <Route path="settings" element={<Settings />} />
            <Route path="help" element={<Help />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AppProviders>
  );
}
