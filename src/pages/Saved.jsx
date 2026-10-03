import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, copyText } from '../lib/api.js';
import { useToast } from '../context/AppContext.jsx';
import { Markdown } from '../lib/markdown.jsx';
import { ConfirmDialog, EmptyState, ErrorPanel, Modal, Skeleton } from '../components/ui.jsx';
import { CardMotion, PageFade, useBtnMotion } from '../lib/motion.jsx';
import { IconBookmark, IconCheckSimple, IconClose, IconCopy, IconEdit, IconSearch, IconTrash } from '../components/icons.jsx';

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function Saved() {
  const toast = useToast();
  const btnMotion = useBtnMotion();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const [viewing, setViewing] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    setError(null);
    api.saved()
      .then((d) => setItems(d.saved))
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function confirmDelete() {
    setBusy(true);
    try {
      await api.deleteSaved(deleting.id);
      toast('Saved response deleted', 'success');
      setDeleting(null);
      load();
    } catch (e) {
      toast(e.message || 'Failed to delete saved response', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveRename() {
    if (!renameVal.trim()) return;
    try {
      await api.renameSaved(renaming.id, renameVal.trim());
      toast('Title updated', 'success');
      setRenaming(null);
      load();
    } catch (e) {
      toast(e.message || 'Failed to rename', 'error');
    }
  }

  async function copy(item) {
    const ok = await copyText(item.content);
    if (ok) {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1600);
    }
  }

  const filtered = (items || []).filter(
    (s) => !query.trim() || s.title.toLowerCase().includes(query.toLowerCase()) || s.content.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <PageFade className="page">
      <div className="page-head">
        <h1><IconBookmark width={22} height={22} /> Saved Responses</h1>
        <div className="sub">Responses you saved from chat — stored in your database.</div>
      </div>

      <div className="search-box mb-16" style={{ maxWidth: 380 }}>
        <IconSearch width={16} height={16} />
        <input
          className="input"
          placeholder="Search saved responses…"
          aria-label="Search saved responses"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {items === null && !error ? (
        <>
          <div className="visually-hidden" role="status">Loading saved responses…</div>
          <div className="saved-grid" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card" style={{ padding: 18 }}>
                <Skeleton w="70%" h="14px" />
                <div style={{ height: 10 }} />
                <Skeleton w="100%" h="11px" />
                <div style={{ height: 6 }} />
                <Skeleton w="90%" h="11px" />
                <div style={{ height: 6 }} />
                <Skeleton w="40%" h="11px" />
              </div>
            ))}
          </div>
        </>
      ) : error ? (
        <ErrorPanel message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<IconBookmark width={28} height={28} />}
          title="No saved responses yet."
          message="Save an AI response from any conversation and it will live here."
          action={<Link to="/app/chat" className="btn btn-primary">Start Chatting</Link>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconSearch width={28} height={28} />}
          title="No matching saved responses."
          message={`Nothing matches "${query}".`}
          action={<motion.button type="button" className="btn btn-ghost" onClick={() => setQuery('')} {...btnMotion}>Clear search</motion.button>}
        />
      ) : (
        <div className="saved-grid">
          {filtered.map((s, i) => (
            <CardMotion key={s.id} delay={i * 0.05} lift={4} className="card card-hover saved-card" onClick={() => setViewing(s)}>
              <div className="t">{s.title}</div>
              <div className="c">{s.content}</div>
              <div className="foot" onClick={(e) => e.stopPropagation()}>
                <span className="when">{fmtDate(s.created_at)}</span>
                <div className="acts">
                  <motion.button type="button" className="icon-btn" aria-label="Copy response" title="Copy" onClick={() => copy(s)} {...btnMotion}>
                    {copiedId === s.id ? <IconCheckSimple width={15} height={15} /> : <IconCopy width={15} height={15} />}
                  </motion.button>
                  <motion.button type="button" className="icon-btn" aria-label="Edit title" title="Rename"
                    onClick={() => { setRenaming(s); setRenameVal(s.title); }} {...btnMotion}>
                    <IconEdit width={15} height={15} />
                  </motion.button>
                  <motion.button type="button" className="icon-btn danger" aria-label="Delete saved response" title="Delete"
                    onClick={() => setDeleting(s)} {...btnMotion}>
                    <IconTrash width={15} height={15} />
                  </motion.button>
                </div>
              </div>
            </CardMotion>
          ))}
        </div>
      )}

      {viewing && (
        <Modal title={viewing.title} onClose={() => setViewing(null)} wide>
          <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
            <Markdown text={viewing.content} />
          </div>
          <div className="modal-foot">
            <motion.button type="button" className="btn btn-ghost" onClick={() => setViewing(null)} {...btnMotion}>Close</motion.button>
            <motion.button type="button" className="btn btn-soft" onClick={() => copy(viewing)} {...btnMotion}>
              {copiedId === viewing.id ? <IconCheckSimple width={15} height={15} /> : <IconCopy width={15} height={15} />} Copy
            </motion.button>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this saved response?"
          message={`"${deleting.title}" will be permanently removed. Your conversations are not affected.`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
          busy={busy}
        />
      )}

      {renaming && (
        <Modal title="Rename saved response" onClose={() => setRenaming(null)}>
          <input className="input" value={renameVal} autoFocus aria-label="Saved response title"
            onChange={(e) => setRenameVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveRename()} />
          <div className="modal-foot">
            <motion.button type="button" className="btn btn-ghost" onClick={() => setRenaming(null)} {...btnMotion}>Cancel</motion.button>
            <motion.button type="button" className="btn btn-primary" disabled={!renameVal.trim()} onClick={saveRename} {...btnMotion}>Save</motion.button>
          </div>
        </Modal>
      )}
    </PageFade>
  );
}
