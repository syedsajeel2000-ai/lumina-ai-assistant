import React from 'react';
import { Link } from 'react-router-dom';
import { PageFade } from '../lib/motion.jsx';
import { IconArrowLeft, IconChat, IconSpark } from '../components/icons.jsx';

export default function NotFound() {
  return (
    <PageFade className="nf-wrap">
      <div className="hero-orb o1" aria-hidden="true" />
      <div className="hero-orb o3" aria-hidden="true" />
      <div>
        <div className="nf-code">404</div>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 6 }}>Page Not Found</h1>
        <p className="muted" style={{ maxWidth: 380, margin: '0 auto 26px' }}>
          The page you are looking for doesn't exist, moved, or was deleted.
        </p>
        <div className="hero-cta" style={{ marginBottom: 0 }}>
          <Link to="/" className="btn btn-primary btn-lg"><IconArrowLeft width={16} height={16} /> GO HOME</Link>
          <Link to="/app/chat" className="btn btn-ghost btn-lg"><IconChat width={16} height={16} /> START CHAT</Link>
        </div>
      </div>
    </PageFade>
  );
}
