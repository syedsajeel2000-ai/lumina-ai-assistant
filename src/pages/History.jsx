import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api.js';
import { useToast } from '../context/AppContext.jsx';
import { ConfirmDialog, EmptyState, ErrorPanel, Modal, SkeletonList } from '../components/ui.jsx';
import { CardMotion, PageFade, useBtnMotion } from '../lib/motion.jsx';
import { IconChat, IconEdit, IconHistory, IconPlus, IconSearch, IconTrash } from '../components/icons.jsx';

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function History() {
  const toast = useToast();
  const btnMotion = useBtnMotion();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    setError(null);
    api.conversations()
      .then((d) => setItems(d.conversations))
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function confirmDelete() {
    setBusy(true);
    try {
      await api.deleteConversation(deleting.id);
      toast('Conversation deleted', 'success');
      setDeleting(null);
      window.dispatchEvent(new Event('lumina:refresh-conversations'));
      load();
    } catch (e) {
      toast(e.message || 'Failed to delete conversation', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveRename() {
    if (!renameVal.trim()) return;
    try {
      await api.renameConversation(renaming.id, renameVal.trim());
      toast('Conversation renamed', 'success');
      setRenaming(null);
      window.dispatchEvent(new Event('lumina:refresh-conversations'));
      load();
    } catch (e) {
      toast(e.message || 'Failed to rename', 'error');
    }
  }

  const filtered = (items || []).filter(
    (c) =>
      !query.trim() ||
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      (c.preview || '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <PageFade className="page">
      <div className="page-head page-head-row">
        <div>
          <h1><IconHistory width={22} height={22} /> Chat History</h1>
          <div className="sub">Every conversation is saved in your private database.</div>
        </div>
        <motion.div whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 24 }}>
          <Link to="/app/chat" className="btn btn-primary"><IconPlus width={16} height={16} /> New Chat</Link>
        </motion.div>
      </div>

      <div className="search-box mb-16" style={{ maxWidth: 380 }}>
        <IconSearch width={16} height={16} />
        <input
          className="input"
          placeholder="Search conversations…"
          aria-label="Search conversations"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {items === null && !error ? (
        <>
          <div className="visually-hidden" role="status">Loading conversations…</div>
          <SkeletonList rows={6} />
        </>
      ) : error ? (
        <ErrorPanel message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<IconHistory width={28} height={28} />}
          title="No conversations yet."
          message="Start chatting and your conversations will appear here automatically."
          action={<Link to="/app/chat" className="btn btn-primary">Start New Chat</Link>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconSearch width={28} height={28} />}
          title="No matching conversations."
          message={`Nothing matches "${query}". Try a different search term.`}
          action={<motion.button type="button" className="btn btn-ghost" onClick={() => setQuery('')} {...btnMotion}>Clear search</motion.button>}
        />
      ) : (
        <div className="item-list">
          {filtered.map((c, i) => (
            <CardMotion key={c.id} delay={i * 0.045} lift={2} className="item-row card card-hover">
              <span className="feature-icon" style={{ width: 38, height: 38, borderRadius: 11 }} aria-hidden="true">
                <IconChat width={17} height={17} />
              </span>
              <Link to={`/app/chat?c=${c.id}`} className="item-main" style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className="item-title">{c.title}</div>
                <div className="item-sub">{c.preview || 'No messages yet'}</div>
              </Link>
              <div className="item-side">
                <span className="date">{fmtDate(c.updated_at)}</span>
                <span className="badge badge-writing" style={{ background: 'var(--panel-2)', color: 'var(--muted)' }}>
                  {c.message_count} msg{c.message_count === 1 ? '' : 's'}
                </span>
              </div>
              <div className="row-actions">
                <motion.button type="button" className="icon-btn" aria-label={`Rename ${c.title}`} title="Rename"
                  onClick={() => { setRenaming(c); setRenameVal(c.title); }} {...btnMotion}>
                  <IconEdit width={15} height={15} />
                </motion.button>
                <motion.button type="button" className="icon-btn danger" aria-label={`Delete ${c.title}`} title="Delete"
                  onClick={() => setDeleting(c)} {...btnMotion}>
                  <IconTrash width={15} height={15} />
                </motion.button>
              </div>
            </CardMotion>
          ))}
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this conversation?"
          message={`"${deleting.title}" and all of its messages will be permanently removed. This cannot be undone.`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
          busy={busy}
        />
      )}

      {renaming && (
        <Modal title="Rename conversation" onClose={() => setRenaming(null)}>
          <input className="input" value={renameVal} autoFocus aria-label="Conversation title"
            onChange={(e) => setRenameVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveRename()} />
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={() => setRenaming(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={!renameVal.trim()} onClick={saveRename}>Save</button>
          </div>
        </Modal>
      )}
    </PageFade>
  );
}
