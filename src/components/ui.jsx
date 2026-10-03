import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { IconAlert, IconClose } from './icons.jsx';
import { FadeIn, PopIn, useBtnMotion } from '../lib/motion.jsx';

export function Modal({ title, sub, onClose, children, wide }) {
  const btnMotion = useBtnMotion();
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <PopIn
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="row-between">
          <h3>{title}</h3>
          <motion.button type="button" className="icon-btn" aria-label="Close dialog" onClick={onClose} {...btnMotion}>
            <IconClose />
          </motion.button>
        </div>
        {sub && <p className="modal-sub">{sub}</p>}
        {children}
      </PopIn>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', onConfirm, onClose, busy }) {
  const btnMotion = useBtnMotion();
  return (
    <Modal title={title} onClose={onClose}>
      <p className="modal-sub">{message}</p>
      <div className="modal-foot">
        <motion.button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy} {...btnMotion}>
          {cancelLabel}
        </motion.button>
        <motion.button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy} {...btnMotion}>
          {busy ? <span className="spinner" /> : confirmLabel}
        </motion.button>
      </div>
    </Modal>
  );
}

export function EmptyState({ icon, title, message, action }) {
  return (
    <FadeIn className="empty">
      <div className="art">{icon}</div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </FadeIn>
  );
}

export function Skeleton({ w, h, style }) {
  return <div className="skeleton" style={{ width: w, height: h, ...style }} />;
}

export function SkeletonList({ rows = 5 }) {
  return (
    <div className="item-list" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="item-row card" style={{ pointerEvents: 'none' }}>
          <div className="item-main">
            <Skeleton w={`${55 + ((i * 17) % 35)}%`} h="14px" />
            <div style={{ height: 8 }} />
            <Skeleton w={`${35 + ((i * 23) % 40)}%`} h="11px" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorPanel({ title = 'Something went wrong', message, onRetry, retryLabel = 'Retry' }) {
  const btnMotion = useBtnMotion();
  return (
    <FadeIn className="error-panel">
      <div className="art"><IconAlert width={34} height={34} /></div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {onRetry && (
        <motion.button type="button" className="btn btn-primary" onClick={onRetry} {...btnMotion}>{retryLabel}</motion.button>
      )}
    </FadeIn>
  );
}

export function Spinner({ size = 18 }) {
  return <span className="spinner" style={{ width: size, height: size }} />;
}
