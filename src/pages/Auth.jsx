import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth, useToast } from '../context/AppContext.jsx';
import { api } from '../lib/api.js';
import { PopIn, useBtnMotion } from '../lib/motion.jsx';
import { IconLock, IconSpark } from '../components/icons.jsx';

function BrandMark() {
  return (
    <div className="auth-brand">
      <Link to="/" className="brand"><span className="brand-logo"><IconSpark width={17} height={17} /></span> Lumina</Link>
    </div>
  );
}

function Field({ label, error, hint, children, id }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}

const setFieldErr = (setErr, field, msg) => setErr((e) => ({ ...e, [field]: msg }));
const btnMotion = {
  whileHover: { y: -1, scale: 1.015 },
  whileTap: { scale: 0.97 },
  transition: { type: 'spring', stiffness: 400, damping: 24 }
};

export function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [err, setErr] = useState({});
  const [topErr, setTopErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setTopErr('');
    const fe = {};
    if (!form.identifier.trim()) fe.identifier = 'Enter your email or username.';
    if (!form.password) fe.password = 'Enter your password.';
    setErr(fe);
    if (Object.keys(fe).length) return;

    setBusy(true);
    try {
      await login({ identifier: form.identifier.trim(), password: form.password });
      toast('Welcome back!', 'success');
      navigate('/app/chat');
    } catch (ex) {
      setTopErr(ex.message);
      if (ex.fields) setErr(ex.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <PopIn className="auth-card">
        <BrandMark />
        <h1>Welcome back</h1>
        <p className="sub">Sign in to continue with your AI assistant.</p>
        {topErr && <div className="field-error mb-16" role="alert" style={{ fontSize: '0.9rem' }}>{topErr}</div>}
        <form onSubmit={submit} noValidate>
          <Field id="identifier" label="Email or username" error={err.identifier}>
            <input id="identifier" className={`input ${err.identifier ? 'invalid' : ''}`} type="text" autoComplete="username"
              value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} autoFocus />
          </Field>
          <Field id="password" label="Password" error={err.password}>
            <input id="password" className={`input ${err.password ? 'invalid' : ''}`} type="password" autoComplete="current-password"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <div className="row-between mb-16">
            <span />
            <Link to="/forgot-password" className="small">Forgot password?</Link>
          </div>
          <motion.button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy} {...btnMotion}>
            {busy ? <span className="spinner" /> : 'Sign in'}
          </motion.button>
        </form>
        <div className="auth-foot">New here? <Link to="/signup">Create an account</Link></div>
      </PopIn>
    </div>
  );
}

export function SignupPage() {
  const { signup } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '', confirmPassword: '' });
  const [err, setErr] = useState({});
  const [topErr, setTopErr] = useState('');
  const [busy, setBusy] = useState(false);

  function validate() {
    const fe = {};
    if (!form.fullName.trim()) fe.fullName = 'Full name is required.';
    if (!form.username.trim()) fe.username = 'Username is required.';
    else if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(form.username.trim())) fe.username = 'Use 3–30 letters, numbers, dots, dashes or underscores.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) fe.email = 'Enter a valid email address.';
    if (form.password.length < 8) fe.password = 'Password must be at least 8 characters.';
    if (form.password !== form.confirmPassword) fe.confirmPassword = 'Passwords do not match.';
    return fe;
  }

  async function submit(e) {
    e.preventDefault();
    setTopErr('');
    const fe = validate();
    setErr(fe);
    if (Object.keys(fe).length) return;

    setBusy(true);
    try {
      await signup(form);
      toast('Account created — welcome to Lumina!', 'success');
      navigate('/app/chat');
    } catch (ex) {
      setTopErr(ex.message);
      if (ex.fields) setErr(ex.fields);
    } finally {
      setBusy(false);
    }
  }

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="auth-wrap">
      <PopIn className="auth-card">
        <BrandMark />
        <h1>Create your account</h1>
        <p className="sub">Your chats, saves and settings — all in one place.</p>
        {topErr && <div className="field-error mb-16" role="alert" style={{ fontSize: '0.9rem' }}>{topErr}</div>}
        <form onSubmit={submit} noValidate>
          <Field id="fullName" label="Full name" error={err.fullName}>
            <input id="fullName" className={`input ${err.fullName ? 'invalid' : ''}`} type="text" autoComplete="name" value={form.fullName} onChange={upd('fullName')} autoFocus />
          </Field>
          <Field id="username" label="Username" error={err.username}>
            <input id="username" className={`input ${err.username ? 'invalid' : ''}`} type="text" autoComplete="username" value={form.username} onChange={upd('username')} />
          </Field>
          <Field id="email" label="Email" error={err.email}>
            <input id="email" className={`input ${err.email ? 'invalid' : ''}`} type="email" autoComplete="email" value={form.email} onChange={upd('email')} />
          </Field>
          <Field id="password" label="Password" error={err.password} hint="At least 8 characters.">
            <input id="password" className={`input ${err.password ? 'invalid' : ''}`} type="password" autoComplete="new-password" value={form.password} onChange={upd('password')} />
          </Field>
          <Field id="confirmPassword" label="Confirm password" error={err.confirmPassword}>
            <input id="confirmPassword" className={`input ${err.confirmPassword ? 'invalid' : ''}`} type="password" autoComplete="new-password" value={form.confirmPassword} onChange={upd('confirmPassword')} />
          </Field>
          <motion.button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy} {...btnMotion}>
            {busy ? <span className="spinner" /> : 'Create account'}
          </motion.button>
        </form>
        <div className="auth-foot">Already have an account? <Link to="/login">Sign in</Link></div>
      </PopIn>
    </div>
  );
}

export function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr('Enter a valid email address.'); return; }
    setBusy(true);
    try {
      const d = await api.forgotPassword({ email: email.trim() });
      setResult(d);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <PopIn className="auth-card">
        <BrandMark />
        <h1>Reset your password</h1>
        <p className="sub">Enter your account email and we'll create a reset token for you.</p>
        {result ? (
          <>
            <div className="ai-status mt-16" style={{ alignItems: 'flex-start' }}>
              <IconLock style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{result.message}</span>
            </div>
            {result.resetToken && (
              <>
                <p className="field-hint mt-16">Development mode: use this token on the reset page:</p>
                <div className="env-note" style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{result.resetToken}</div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={btnMotion.transition}>
                  <Link className="btn btn-primary btn-block mt-16" to={`/reset-password?token=${result.resetToken}`}>Continue to reset</Link>
                </motion.div>
              </>
            )}
            <div className="auth-foot"><Link to="/login">Back to sign in</Link></div>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <Field id="email" label="Email" error={err}>
              <input id="email" className={`input ${err ? 'invalid' : ''}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </Field>
            <motion.button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy} {...btnMotion}>
              {busy ? <span className="spinner" /> : 'Create reset token'}
            </motion.button>
            <div className="auth-foot"><Link to="/login">Back to sign in</Link></div>
          </form>
        )}
      </PopIn>
    </div>
  );
}

export function ResetPasswordPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [token, setToken] = useState(new URLSearchParams(window.location.search).get('token') || '');
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [err, setErr] = useState({});
  const [topErr, setTopErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setTopErr('');
    const fe = {};
    if (!token.trim()) fe.token = 'Paste the reset token you received.';
    if (form.password.length < 8) fe.password = 'Password must be at least 8 characters.';
    if (form.password !== form.confirmPassword) fe.confirmPassword = 'Passwords do not match.';
    setErr(fe);
    if (Object.keys(fe).length) return;

    setBusy(true);
    try {
      await api.resetPassword({ token: token.trim(), password: form.password, confirmPassword: form.confirmPassword });
      toast('Password updated. You can now sign in.', 'success');
      navigate('/login');
    } catch (ex) {
      setTopErr(ex.message);
      if (ex.fields) setErr(ex.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <PopIn className="auth-card">
        <BrandMark />
        <h1>Set a new password</h1>
        <p className="sub">Choose a strong new password for your account.</p>
        {topErr && <div className="field-error mb-16" role="alert" style={{ fontSize: '0.9rem' }}>{topErr}</div>}
        <form onSubmit={submit} noValidate>
          <Field id="token" label="Reset token" error={err.token}>
            <input id="token" className={`input ${err.token ? 'invalid' : ''}`} type="text" value={token} onChange={(e) => setToken(e.target.value)} style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem' }} />
          </Field>
          <Field id="newPassword" label="New password" error={err.password}>
            <input id="newPassword" className={`input ${err.password ? 'invalid' : ''}`} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field id="confirmPassword" label="Confirm new password" error={err.confirmPassword}>
            <input id="confirmPassword" className={`input ${err.confirmPassword ? 'invalid' : ''}`} type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
          </Field>
          <motion.button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy} {...btnMotion}>
            {busy ? <span className="spinner" /> : 'Update password'}
          </motion.button>
          <div className="auth-foot"><Link to="/login">Back to sign in</Link></div>
        </form>
      </PopIn>
    </div>
  );
}
