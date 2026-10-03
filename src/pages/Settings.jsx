import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api.js';
import { useAuth, useTheme, useToast } from '../context/AppContext.jsx';
import { EmptyState, ErrorPanel } from '../components/ui.jsx';
import { FadeIn, PageFade, useBtnMotion } from '../lib/motion.jsx';
import { IconCpu, IconKey, IconLock, IconMonitor, IconMoon, IconPalette, IconSettings, IconSun, IconUserRound } from '../components/icons.jsx';

export default function Settings() {
  const { user, refresh } = useAuth();
  const btnMotion = useBtnMotion();
  const { theme, setTheme } = useTheme();
  const toast = useToast();

  const [ai, setAi] = useState(null);
  const [aiError, setAiError] = useState(null);

  const [profile, setProfile] = useState({ fullName: '', username: '', email: '' });
  const [profileErr, setProfileErr] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwErr, setPwErr] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [model, setModel] = useState('');
  const [savingModel, setSavingModel] = useState(false);

  useEffect(() => {
    if (user) setProfile({ fullName: user.fullName, username: user.username, email: user.email });
  }, [user]);

  useEffect(() => {
    api.aiStatus().then(setAi).catch((e) => setAiError(e.message));
  }, []);

  useEffect(() => {
    if (user?.preferences?.defaultModel !== undefined) setModel(user.preferences.defaultModel || '');
  }, [user]);

  async function saveProfile(e) {
    e.preventDefault();
    setProfileErr({});
    setSavingProfile(true);
    try {
      await api.updateProfile(profile);
      await refresh();
      toast('Profile updated', 'success');
    } catch (ex) {
      if (ex.fields) setProfileErr(ex.fields);
      toast(ex.message || 'Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwErr('');
    if (pw.newPassword !== pw.confirmPassword) { setPwErr('Passwords do not match.'); return; }
    setSavingPw(true);
    try {
      await api.updatePassword(pw);
      toast('Password changed', 'success');
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (ex) {
      setPwErr(ex.message);
    } finally {
      setSavingPw(false);
    }
  }

  async function changeTheme(t) {
    setTheme(t);
    try { await api.updatePreferences({ theme: t }); } catch { /* local persistence still applies */ }
    toast('Theme saved', 'success');
  }

  async function changeModel(m) {
    setModel(m);
    setSavingModel(true);
    try {
      await api.updatePreferences({ defaultModel: m || null });
      await refresh();
      toast('AI model preference saved', 'success');
    } catch (ex) {
      toast(ex.message || 'Failed to save model preference', 'error');
    } finally {
      setSavingModel(false);
    }
  }

  const THEME_OPTS = [
    { id: 'light', label: 'Light', icon: IconSun },
    { id: 'dark', label: 'Dark', icon: IconMoon },
    { id: 'system', label: 'System', icon: IconMonitor }
  ];
  const themeMotion = {
    whileHover: { y: -2, scale: 1.02 },
    whileTap: { scale: 0.96 },
    transition: { type: 'spring', stiffness: 400, damping: 22 }
  };

  return (
    <PageFade className="page">
      <div className="page-head">
        <h1><IconSettings width={22} height={22} /> Profile & Settings</h1>
        <div className="sub">Your account, appearance and AI preferences — all persisted in SQLite.</div>
      </div>

      <div className="settings-grid">
        {/* ── Profile ─────────────────────────────────────────────── */}
        <FadeIn delay={0.05} className="motion-cell">
        <form className="card settings-card" onSubmit={saveProfile}>
          <h2><IconUserRound width={18} height={18} /> Profile</h2>
          <p className="desc">How you appear in Lumina.</p>
          <div className="field">
            <label htmlFor="s-fullName">Full name</label>
            <input id="s-fullName" className={`input ${profileErr.fullName ? 'invalid' : ''}`}
              value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} />
            {profileErr.fullName && <span className="field-error">{profileErr.fullName}</span>}
          </div>
          <div className="field">
            <label htmlFor="s-username">Username</label>
            <input id="s-username" className={`input ${profileErr.username ? 'invalid' : ''}`}
              value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} />
            {profileErr.username && <span className="field-error">{profileErr.username}</span>}
          </div>
          <div className="field">
            <label htmlFor="s-email">Email</label>
            <input id="s-email" type="email" className={`input ${profileErr.email ? 'invalid' : ''}`}
              value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            {profileErr.email && <span className="field-error">{profileErr.email}</span>}
          </div>
          <motion.button type="submit" className="btn btn-primary" disabled={savingProfile} {...btnMotion}>
            {savingProfile ? <span className="spinner" /> : 'Save profile'}
          </motion.button>
        </form>
        </FadeIn>

        {/* ── Appearance ──────────────────────────────────────────── */}
        <FadeIn delay={0.11} className="motion-cell">
        <div className="card settings-card">
          <h2><IconPalette width={18} height={18} /> Appearance</h2>
          <p className="desc">Choose light, dark, or follow your system. Saved to your account.</p>          <div className="theme-options">
            {THEME_OPTS.map(({ id, label, icon: Icon }) => (
              <motion.button key={id} type="button" className={`theme-opt ${theme === id ? 'active' : ''}`}
                aria-pressed={theme === id} onClick={() => changeTheme(id)} {...themeMotion}>
                <Icon width={20} height={20} /> {label}
              </motion.button>
            ))}
          </div>
        </div>
        </FadeIn>

        {/* ── AI model ────────────────────────────────────────────── */}
        <FadeIn delay={0.17} className="motion-cell">
        <div className="card settings-card">
          <h2><IconCpu width={18} height={18} /> AI model</h2>
          <p className="desc">Default model used for new requests. Only models configured on the server are listed.</p>
          {aiError ? (
            <ErrorPanel message={aiError} />
          ) : !ai ? (
            <div className="skeleton" style={{ height: 52 }} />
          ) : !ai.configured ? (
            <div className="ai-status">
              <span className="status-dot bad" aria-hidden="true" />
              <span>
                AI is not configured on this server. Add at least one provider key (<code>GROQ_API_KEY</code>,{' '}
                <code>COHERE_API_KEY</code>, <code>OPENROUTER_API_KEY</code>, …) to your environment, then restart.&nbsp;
                See <code>.env.example</code> for all supported providers.
              </span>
            </div>
          ) : (
            <>
              <div className="ai-status mb-16">
                <span className="status-dot ok" aria-hidden="true" />
                <span>
                  Connected{ai.provider ? ` · ${ai.provider}` : ''} · default model <strong>{ai.defaultModel}</strong>
                </span>
              </div>
              {Array.isArray(ai.providers) && ai.providers.length > 0 && (
                <div className="provider-chain mb-16">
                  <div className="pc-head">
                    Failover chain — if one provider hits its rate limit, the next takes over automatically.
                  </div>
                  <ol className="pc-list">
                    {ai.providers.map((p, i) => (
                      <li key={p.id || i} className="pc-item">
                        <span className="pc-order">{i + 1}</span>
                        <span className="pc-name">{p.label}</span>
                        <span className="pc-model">
                          {(Array.isArray(p.models) && p.models.length > 1 ? p.models : [p.model]).join(' · ')}
                          {p.host ? ` · ${p.host}` : ''}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {ai.models.length > 1 ? (
                <div className="field">
                  <label htmlFor="s-model">Preferred model</label>
                  <select id="s-model" className="select" value={model} onChange={(e) => changeModel(e.target.value)}>
                    <option value="">Server default</option>
                    {ai.models.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <span className="field-hint">
                    {savingModel ? 'Saving…' : 'Applies to new messages in new conversations.'}
                  </span>
                </div>
              ) : (
                <p className="muted small">One model is configured on the server — no alternatives available.</p>
              )}
            </>
          )}
        </div>
        </FadeIn>

        {/* ── Password ────────────────────────────────────────────── */}
        <FadeIn delay={0.23} className="motion-cell">
        <form className="card settings-card" onSubmit={savePassword}>
          <h2><IconKey width={18} height={18} /> Password</h2>
          <p className="desc">Change your password. You stay signed in on this device.</p>
          {pwErr && <div className="field-error mb-8" role="alert">{pwErr}</div>}
          <div className="field">
            <label htmlFor="s-curPw">Current password</label>
            <input id="s-curPw" type="password" className="input" autoComplete="current-password"
              value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="s-newPw">New password</label>
            <input id="s-newPw" type="password" className="input" autoComplete="new-password"
              value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="s-confPw">Confirm new password</label>
            <input id="s-confPw" type="password" className="input" autoComplete="new-password"
              value={pw.confirmPassword} onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })} />
          </div>
          <motion.button type="submit" className="btn btn-primary" disabled={savingPw} {...btnMotion}>
            {savingPw ? <span className="spinner" /> : <IconLock width={15} height={15} />} Update password
          </motion.button>
        </form>
        </FadeIn>
      </div>
    </PageFade>
  );
}
