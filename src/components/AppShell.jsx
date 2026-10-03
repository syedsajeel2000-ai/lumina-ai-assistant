import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AppContext.jsx';
import {
  IconBookmark, IconChat, IconClose, IconGrid, IconHelp, IconHistory,
  IconLogout, IconMenu, IconPlus, IconSettings, IconSpark, IconUserRound
} from './icons.jsx';
import { api } from '../lib/api.js';
import { FadeIn, Hoverable, PageFade, useBtnMotion } from '../lib/motion.jsx';

const NAV = [
  { to: '/app/chat', icon: IconChat, label: 'AI Chat', end: true },
  { to: '/app/history', icon: IconHistory, label: 'Chat History' },
  { to: '/app/saved', icon: IconBookmark, label: 'Saved Responses' },
  { to: '/app/templates', icon: IconGrid, label: 'Templates' },
  { to: '/app/settings', icon: IconSettings, label: 'Settings' },
  { to: '/app/help', icon: IconHelp, label: 'Help' }
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const btnMotion = useBtnMotion();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [recent, setRecent] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();

  function loadRecent() {
    api.conversations()
      .then((d) => setRecent(d.conversations.slice(0, 8)))
      .catch(() => {});
  }

  useEffect(() => {
    loadRecent();
  }, [location.pathname, location.search]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const h = () => loadRecent();
    window.addEventListener('lumina:refresh-conversations', h);
    return () => window.removeEventListener('lumina:refresh-conversations', h);
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  const initials = (user?.fullName || user?.username || 'U')
    .split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="shell">
      {drawerOpen && <div className="scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
      <aside className={`sidebar ${drawerOpen ? 'open' : ''}`} aria-label="Primary navigation">
        <div className="sidebar-head">
          <Link to="/" className="brand">
            <span className="brand-logo"><IconSpark width={16} height={16} /></span>
            Lumina
          </Link>
          <motion.button type="button" className="icon-btn" aria-label="Close menu" onClick={() => setDrawerOpen(false)} {...btnMotion}>
            <IconClose />
          </motion.button>
        </div>

        <div className="sidebar-new">
          <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 400, damping: 24 }}>
            <Link to="/app/chat" className="btn new-chat-btn" onClick={() => window.dispatchEvent(new Event('lumina:new-chat'))}>
              <IconPlus width={16} height={16} /> New Chat
            </Link>
          </motion.div>
        </div>

        <nav className="side-nav" aria-label="Sections">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon width={17} height={17} /> {label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-label">Recent</div>
        <div className="recent-list">
          {recent.length === 0 && (
            <div className="nav-label" style={{ padding: '6px 12px', textTransform: 'none', letterSpacing: 0 }}>
              No conversations yet
            </div>
          )}
          {recent.map((c, i) => {
            const active = location.pathname === '/app/chat' && location.search.includes(`c=${c.id}`);
            return (
              <FadeIn key={c.id} delay={i * 0.04} y={4}>
                <Link to={`/app/chat?c=${c.id}`} className={`recent-item ${active ? 'active' : ''}`}>
                  <IconChat width={14} height={14} style={{ flexShrink: 0, opacity: 0.7 }} />
                  <span className="title">{c.title}</span>
                </Link>
              </FadeIn>
            );
          })}
        </div>

        <div className="sidebar-foot">
          <Link to="/app/settings" className="user-pill">
            <span className="avatar">{initials}</span>
            <span className="meta">
              <span className="name">{user?.fullName}</span>
              <span className="mail">{user?.email}</span>
            </span>
          </Link>
          <motion.button type="button" className="btn btn-ghost btn-sm btn-block" onClick={handleLogout} {...btnMotion}>
            <IconLogout width={15} height={15} /> Log out
          </motion.button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <Hoverable lift={1}>
            <button type="button" className="icon-btn" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
              <IconMenu />
            </button>
          </Hoverable>
          <Link to="/" className="brand"><span className="brand-logo"><IconSpark width={15} height={15} /></span> Lumina</Link>
          <div className="grow" />
          <Hoverable lift={1}><Link to="/app/chat" className="icon-btn" aria-label="New chat" onClick={() => window.dispatchEvent(new Event('lumina:new-chat'))}><IconPlus /></Link></Hoverable>
          <Hoverable lift={1}><Link to="/app/settings" className="icon-btn" aria-label="Profile and settings"><IconUserRound /></Link></Hoverable>
        </header>
        <PageFade
          y={6}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          {children}
        </PageFade>
      </div>
    </div>
  );
}
