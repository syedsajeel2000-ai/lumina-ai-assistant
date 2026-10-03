import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, streamChat, copyText } from '../lib/api.js';
import { useAuth, useToast } from '../context/AppContext.jsx';
import { Markdown } from '../lib/markdown.jsx';
import { ConfirmDialog, Modal, Skeleton } from '../components/ui.jsx';
import { FadeIn, PopIn, useBtnMotion } from '../lib/motion.jsx';
import {
  IconAlert, IconArrowDown, IconBookmark, IconBookmarkFilled, IconCheckSimple, IconCopy,
  IconEdit, IconGlobe, IconRefreshAlt, IconSend, IconSpark, IconStop, IconThumbsDown, IconThumbsUp, IconTrash
} from '../components/icons.jsx';

/* ── Smart suggestions (client-side intent matching on the draft) ── */
const INTENTS = [
  { re: /\bwrite\b|compose|draft/i, label: '✉️ Write an email', prompt: 'Write a professional email asking my teacher for a meeting.' },
  { re: /\bcaption|social|instagram|facebook|tweet|linkedin\b/i, label: '📱 Social media caption', prompt: 'Write a catchy social media caption about my weekend hiking trip.' },
  { re: /\bcode|function|bug|python|javascript|debug|error\b/i, label: '💻 Help with code', prompt: 'Explain what this JavaScript code does: [paste code]' },
  { re: /\bsummar|tl;?dr|shorten\b/i, label: '📝 Summarize text', prompt: 'Summarize this text in key points: [paste text]' },
  { re: /\bemail|mail\b/i, label: '✉️ Professional email', prompt: 'Write a professional email requesting a project deadline extension.' },
  { re: /\bidea|brainstorm|suggest/i, label: '💡 Brainstorm ideas', prompt: 'Brainstorm 10 ideas for my next blog post.' },
  { re: /\bexplain\b/i, label: '🧠 Explain simply', prompt: 'Explain quantum computing in simple terms.' },
  { re: /\bplan|study|learn|roadmap\b/i, label: '📅 Make a plan', prompt: 'Create a 4-week study plan for learning JavaScript.' },
  { re: /\brewrite|improve|polish|grammar\b/i, label: '✨ Rewrite / improve', prompt: 'Rewrite this text to sound more professional: [paste text]' }
];

const STARTERS = [
  'Write a professional email asking my teacher for a meeting.',
  'Explain React like I am 10.',
  'Brainstorm 10 name ideas for a coffee shop.',
  'Write a Python function to check if a number is prime.',
  'Create a study plan for learning web development in 30 days.'
];

function suggestFor(text) {
  const t = String(text || '');
  if (t.trim().length < 3) return [];
  const out = [];
  for (const i of INTENTS) {
    if (i.re.test(t)) {
      out.push({ label: i.label, prompt: i.prompt });
      if (out.length >= 3) break;
    }
  }
  return out;
}

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/* ── Message row ─────────────────────────────────────────────────── */
function MessageRow({ msg, onAction, savedIds, webSources }) {
  const btnMotion = useBtnMotion();
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';
  const isErr = msg.role === 'error';
  const streaming = msg.streaming;

  async function copy() {
    const ok = await copyText(msg.content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }

  const initial = (msg.authorName || 'You').trim().charAt(0).toUpperCase();

  return (
    <div className={`msg ${isUser ? 'user' : isErr ? 'error' : 'assistant'} ${streaming ? 'streaming' : ''}`}>
      <div className="msg-avatar" aria-hidden="true">
        {isUser ? initial : <IconSpark width={16} height={16} />}
      </div>
      <div className="msg-body">
        <div className="msg-head">
          <span className="who">{isUser ? msg.authorName || 'You' : 'Lumina'}</span>
          {msg.when && <span className="when">{msg.when}</span>}
        </div>

        {isUser ? (
          <div className="msg-content">{msg.content}</div>
        ) : isErr ? (
          <div className="msg-content">
            <div className="err-title"><IconAlert width={15} height={15} /> {msg.title || 'Request failed'}</div>
            <div>{msg.content}</div>
            {msg.onRetry && (
              <div className="mt-8" style={{ display: 'flex', gap: 8 }}>
                <motion.button type="button" className="btn btn-soft btn-sm" onClick={msg.onRetry} {...btnMotion}>
                  <IconRefreshAlt width={14} height={14} /> Retry
                </motion.button>
              </div>
            )}
          </div>
        ) : (
          <div className="msg-content">
            <Markdown text={msg.content} />
            {streaming && !msg.content && (
              <div className="thinking" role="status" aria-live="polite">
                Thinking
                <span className="dots"><i /><i /><i /></span>
              </div>
            )}
            {streaming && msg.content && <span className="caret" />}
          </div>
        )}

        {!streaming && !isErr && !isUser && msg.content && (
          <div className="msg-actions">
            <motion.button type="button" className="icon-btn" aria-label="Copy response" title="Copy" onClick={copy} {...btnMotion}>
              {copied ? <IconCheckSimple width={15} height={15} /> : <IconCopy width={15} height={15} />}
            </motion.button>
            <motion.button
              type="button"
              className={`icon-btn ${savedIds.has(msg.id) ? 'active' : ''}`}
              aria-label="Save response"
              title="Save"
              onClick={() => onAction('save', msg)}
              {...btnMotion}
            >
              {savedIds.has(msg.id) ? <IconBookmarkFilled width={15} height={15} /> : <IconBookmark width={15} height={15} />}
            </motion.button>
            <motion.button type="button" className="icon-btn" aria-label="Regenerate response" title="Regenerate" onClick={() => onAction('regen', msg)} {...btnMotion}>
              <IconRefreshAlt width={15} height={15} />
            </motion.button>
            <motion.button
              type="button"
              className={`icon-btn ${msg.liked === 1 ? 'active' : ''}`}
              aria-label="Like response"
              title="Like"
              onClick={() => onAction('like', msg)}
              {...btnMotion}
            >
              <IconThumbsUp width={15} height={15} />
            </motion.button>
            <motion.button
              type="button"
              className={`icon-btn ${msg.liked === -1 ? 'active' : ''}`}
              aria-label="Dislike response"
              title="Dislike"
              onClick={() => onAction('dislike', msg)}
              {...btnMotion}
            >
              <IconThumbsDown width={15} height={15} />
            </motion.button>
          </div>
        )}
        {!streaming && isUser && (
          <div className="msg-actions">
            <motion.button type="button" className="icon-btn" aria-label="Edit prompt" title="Edit & resend" onClick={() => onAction('edit', msg)} {...btnMotion}>
              <IconEdit width={15} height={15} />
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}

function RenameDialog({ initial, onClose, onSave }) {
  const [val, setVal] = useState(initial || '');
  return (
    <Modal title="Rename conversation" onClose={onClose}>
      <input
        className="input"
        value={val}
        autoFocus
        aria-label="Conversation title"
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && val.trim()) onSave(val.trim()); }}
      />        <div className="modal-foot">
          <motion.button type="button" className="btn btn-ghost" onClick={onClose} {...btnMotion}>Cancel</motion.button>
          <motion.button type="button" className="btn btn-primary" disabled={!val.trim()} onClick={() => onSave(val.trim())} {...btnMotion}>Save</motion.button>
        </div>
    </Modal>
  );
}

/* ── Main chat page ──────────────────────────────────────────────── */
export default function Chat() {
  const toast = useToast();
  const btnMotion = useBtnMotion();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const convoId = params.get('c');

  const [messages, setMessages] = useState([]); // [] = fresh chat, null = loading
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [errorState, setErrorState] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [confirmDel, setConfirmDel] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [showScroll, setShowScroll] = useState(false);
  const [webEnabled, setWebEnabled] = useState(false);
  const [webStatus, setWebStatus] = useState(null); // null | 'searching' | 'reading' | 'done' | 'none'
  const [webSources, setWebSources] = useState([]);

  const scrollRef = useRef(null);
  const taRef = useRef(null);
  const abortRef = useRef(null);
  const streamRef = useRef('');
  const idCounter = useRef(0);
  const skipLoadRef = useRef(null); // conversation id created during an active stream
  const convoIdRef = useRef(null); // always-current conversation id for retries

  const authorName = user?.fullName || user?.username || 'You';
  const firstName = (authorName || 'there').split(/\s+/)[0];

  useEffect(() => {
    convoIdRef.current = convoId ? Number(convoId) : null;
  }, [convoId]);

  /* Load conversation when ?c= changes */
  useEffect(() => {
    // Skip the reload right after we created this conversation mid-stream —
    // its messages are already on screen.
    if (convoId && skipLoadRef.current === convoId) {
      skipLoadRef.current = null;
      return;
    }
    let live = true;
    setErrorState(null);
    setSavedIds(new Set());
    if (!convoId) {
      setMessages([]);
      setTitle('');
      return;
    }
    setLoading(true);
    api.conversation(convoId)
      .then((d) => {
        if (!live) return;
        setMessages(d.conversation.messages);
        setTitle(d.conversation.title);
      })
      .catch(() => {
        if (!live) return;
        setMessages([]);
        setErrorState({ title: 'Conversation not found', message: 'It may have been deleted or belongs to another account.' });
      })
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [convoId]);

  /* AI status (configured + available models) */
  useEffect(() => {
    api.aiStatus().then(setAiStatus).catch(() => setAiStatus({ configured: false, models: [] }));
  }, []);

  /* Prefill from landing / templates */
  useEffect(() => {
    const pre = sessionStorage.getItem('lumina:prefill');
    if (pre) {
      setInput(pre);
      sessionStorage.removeItem('lumina:prefill');
      taRef.current?.focus();
    }
  }, [convoId]);

  /* New Chat event from sidebar */
  useEffect(() => {
    const h = () => {
      setParams({}, { replace: true });
      setInput('');
      setErrorState(null);
    };
    window.addEventListener('lumina:new-chat', h);
    return () => window.removeEventListener('lumina:new-chat', h);
  }, [setParams]);

  /* Auto-scroll management */
  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShowScroll(!isNearBottom() && el.scrollHeight > el.clientHeight + 200);
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [isNearBottom, messages, loading]);

  useEffect(() => {
    scrollToBottom(false);
  }, [convoId, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  /* During streaming, keep pinned to bottom unless the user scrolled up */
  useEffect(() => {
    if (!streaming) return;
    const iv = setInterval(() => {
      if (isNearBottom()) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }, 300);
    return () => clearInterval(iv);
  }, [streaming, isNearBottom]);

  /* ── Sending ─────────────────────────────────────────────────────── */
  const send = useCallback(
    (rawText, { regenerate = false, replaceLastAssistant = false, conversationIdOverride } = {}) => {
      const text = String(rawText ?? '').trim();
      if (!text || streaming) return;

      setInput('');
      setErrorState(null);
      setStreaming(true);
      streamRef.current = '';

      const tempUserId = `tmp-u-${++idCounter.current}`;
      const tempAiId = `tmp-a-${idCounter.current}`;

      setMessages((prev) => {
        const base = [...(Array.isArray(prev) ? prev : [])];
        if (replaceLastAssistant) {
          while (
            base.length &&
            (base[base.length - 1].role === 'assistant' || base[base.length - 1].role === 'error')
          )
            base.pop();
        }
        if (!regenerate) {
          base.push({ id: tempUserId, role: 'user', content: text, authorName, when: fmtTime(new Date().toISOString()) });
        }
        base.push({ id: tempAiId, role: 'assistant', content: '', streaming: true });
        return base;
      });

      const patch = (fn) => setMessages((prev) => prev.map((m) => (m.id === tempAiId ? fn(m) : m)));

      const abort = streamChat(
        {
          conversationId: conversationIdOverride ?? convoIdRef.current,
          message: text,
          regenerate,
          web: webEnabled
        },
        (event, data) => {
          if (event === 'start') {
            if (data.conversationId) convoIdRef.current = data.conversationId;
            if (!convoId && data.conversationId) {
              skipLoadRef.current = String(data.conversationId);
              setParams({ c: String(data.conversationId) }, { replace: true });
            }
          } else if (event === 'web') {
            setWebStatus(data.phase);
            if (data.phase === 'done') setWebSources(data.sources || []);
            else if (data.phase !== 'reading') setWebSources([]);
          } else if (event === 'delta') {
            streamRef.current += data.text;
            patch((m) => ({ ...m, content: streamRef.current }));
          } else if (event === 'title') {
            setTitle(data.title);
            window.dispatchEvent(new Event('lumina:refresh-conversations'));
          } else if (event === 'aborted') {
            setStreaming(false);
            if (data.message) {
              patch((m) => ({ ...m, id: data.message.id, content: data.message.content, streaming: false }));
            } else {
              setMessages((prev) => prev.filter((m) => m.id !== tempAiId));
            }
            window.dispatchEvent(new Event('lumina:refresh-conversations'));
          } else if (event === 'error') {
            setStreaming(false);
            setWebStatus(null);
            setMessages((prev) => prev.map((m) => (m.id === tempAiId ? {
              id: `err-${tempAiId}`,
              role: 'error',
              title: data.kind === 'config' ? 'AI not configured' : data.kind === 'rate_limit' ? 'All providers rate limited' : 'Request failed',
              content: data.error,
              // The user message is already stored server-side, so retry with
              // regenerate=true (never duplicates it) and the real conversation id.
              onRetry: () => send(text, { regenerate: true, replaceLastAssistant: true, conversationIdOverride: convoIdRef.current })
            } : m)));
          } else if (event === 'done') {
            setStreaming(false);
            setWebStatus(null);
            patch((m) => ({
              ...m,
              id: data.assistantMessage.id,
              when: fmtTime(data.assistantMessage.created_at),
              streaming: false
            }));
            setMessages((prev) =>
              prev.map((m) => (m.id === tempUserId && data.userMessage?.id ? { ...m, id: data.userMessage.id } : m))
            );
            window.dispatchEvent(new Event('lumina:refresh-conversations'));
          }
        }
      );
      abortRef.current = abort;
    },
    [convoId, streaming, setParams, authorName, webEnabled]
  );

  /* ── Message actions ─────────────────────────────────────────────── */
  async function handleAction(kind, msg) {
    if (kind === 'save') {
      try {
        await api.saveResponse({
          conversationId: convoId ? Number(convoId) : null,
          title: (title && title !== 'New chat' ? title : msg.content.split('\n')[0]).slice(0, 60) || 'Saved response',
          content: msg.content
        });
        setSavedIds((s) => new Set(s).add(msg.id));
        toast('Response saved', 'success');
      } catch (e) {
        toast(e.message || 'Failed to save response', 'error');
      }
    } else if (kind === 'regen') {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      if (lastUser && !streaming) send(lastUser.content, { regenerate: true, replaceLastAssistant: true });
    } else if (kind === 'like' || kind === 'dislike') {
      const reaction = kind === 'like' ? 1 : -1;
      const next = msg.liked === reaction ? 0 : reaction;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, liked: next } : m)));
      try { await api.reactToMessage(msg.id, next); } catch { /* keep optimistic state */ }
    } else if (kind === 'edit') {
      setInput(msg.content);
      taRef.current?.focus();
    }
  }

  /* ── Conversation management ─────────────────────────────────────── */
  async function deleteConvo() {
    try {
      await api.deleteConversation(convoId);
      toast('Conversation deleted', 'success');
      setConfirmDel(false);
      setParams({}, { replace: true });
      window.dispatchEvent(new Event('lumina:refresh-conversations'));
    } catch (e) {
      toast(e.message || 'Failed to delete conversation', 'error');
      setConfirmDel(false);
    }
  }

  async function renameConvo(newTitle) {
    try {
      await api.renameConversation(convoId, newTitle);
      setTitle(newTitle);
      setRenaming(false);
      toast('Conversation renamed', 'success');
      window.dispatchEvent(new Event('lumina:refresh-conversations'));
    } catch (e) {
      toast(e.message || 'Failed to rename', 'error');
    }
  }

  /* ── Composer ────────────────────────────────────────────────────── */
  const suggestions = useMemo(() => suggestFor(input), [input]);

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !streaming) send(input);
    }
  }

  const canSend = input.trim().length > 0 && !streaming;

  return (
    <div className="chat-layout">
      {convoId && !loading && (
        <div className="chat-toolbar">
          <h2 className="chat-title">{title || 'Conversation'}</h2>
          <div className="grow" />
          <button
            type="button"
            className={`web-toggle ${webEnabled ? 'on' : ''}`}
            aria-pressed={webEnabled}
            title={webEnabled ? 'Web access on — answers can search the web' : 'Enable web access for this chat'}
            onClick={() => setWebEnabled((v) => !v)}
          >
            <IconGlobe width={15} height={15} /> Web
          </button>
          <motion.button type="button" className="icon-btn" aria-label="Rename conversation" title="Rename" onClick={() => setRenaming(true)} {...btnMotion}>
            <IconEdit width={16} height={16} />
          </motion.button>
          <motion.button type="button" className="icon-btn danger" aria-label="Delete conversation" title="Delete" onClick={() => setConfirmDel(true)} {...btnMotion}>
            <IconTrash width={16} height={16} />
          </motion.button>
        </div>
      )}
      <div className="chat-scroll" ref={scrollRef}>
        {loading ? (
          <div className="chat-inner" aria-label="Loading conversation">
            <SkeletonMsg />
            <SkeletonMsg />
            <SkeletonMsg />
          </div>
        ) : messages.length === 0 && !errorState ? (
          <FadeIn className="chat-empty">
            <div className="chat-empty-inner">
              <div className="orb"><IconSpark width={30} height={30} /></div>
              <h2>How can I help, {firstName}?</h2>
              <p>Ask anything below, or start with one of these:</p>
              <div className="starter-grid">
                {STARTERS.map((s, i) => (
                  <FadeIn key={s} delay={0.06 * i} y={6}>
                    <motion.button type="button" className="chip" onClick={() => send(s)} {...btnMotion}>{s}</motion.button>
                  </FadeIn>
                ))}
              </div>
            </div>
          </FadeIn>
        ) : (
          <div className="chat-inner">
            {webStatus && webStatus !== 'done' && (
              <div className="web-status" role="status">
                <IconGlobe width={14} height={14} />
                {webStatus === 'searching' ? 'Searching the web…' : webStatus === 'reading' ? 'Reading sources…' : 'No web results — answering from the model.'}
              </div>
            )}
            {errorState && messages.length === 0 ? (
              <div className="error-panel">
                <h3>{errorState.title}</h3>
                <p>{errorState.message}</p>
                <motion.button type="button" className="btn btn-soft" onClick={() => setParams({}, { replace: true })} {...btnMotion}>Start a new chat</motion.button>
              </div>
            ) : (
              messages.map((m) => <MessageRow key={m.id} msg={m} onAction={handleAction} savedIds={savedIds} webSources={webSources} />)
            )}
            {webSources.length > 0 && !streaming && (
              <div className="web-sources">
                <span className="ws-label"><IconGlobe width={13} height={13} /> Sources:</span>
                {webSources.slice(0, 5).map((s, i) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="ws-link">[{i + 1}] {s.title}</a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="composer-wrap">
        {showScroll && (
          <motion.button type="button" className="scroll-bottom" aria-label="Scroll to latest message" onClick={() => scrollToBottom()} {...btnMotion}>
            <IconArrowDown width={17} height={17} />
          </motion.button>
        )}
        <div className="composer">
          {suggestions.length > 0 && !streaming && (
            <div className="suggestions-bar" aria-label="Smart suggestions">
              {suggestions.map((s) => (
                <motion.button key={s.label} type="button" className="chip"
                  onClick={() => { setInput(s.prompt); taRef.current?.focus(); }} {...btnMotion}>
                  {s.label}
                </motion.button>
              ))}
            </div>
          )}
          <div className="composer-row">
            <textarea
              ref={taRef}
              value={input}
              rows={1}
              placeholder={streaming ? 'Lumina is responding…' : 'Message Lumina…'}
              aria-label="Chat message"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px';
              }}
            />
            {streaming ? (
              <motion.button type="button" className="send-btn stop" aria-label="Stop generating" onClick={() => abortRef.current?.()} {...btnMotion}>
                <IconStop width={16} height={16} />
              </motion.button>
            ) : (
              <PopIn key="send">
                <motion.button type="button" className="send-btn" aria-label="Send message" disabled={!canSend} onClick={() => send(input)} {...btnMotion}>
                  <IconSend width={17} height={17} />
                </motion.button>
              </PopIn>
            )}
          </div>
        </div>
        <div className="composer-hint">
          {aiStatus && !aiStatus.configured
            ? '⚠ AI is not configured — add AI_API_URL, AI_API_KEY and AI_MODEL to your .env (see Settings).'
            : 'Enter to send · Shift + Enter for a new line'}
        </div>
      </div>

      {renaming && <RenameDialog initial={title} onClose={() => setRenaming(false)} onSave={renameConvo} />}
      {confirmDel && (
            <ConfirmDialog
              title="Delete this conversation?"
              message="This permanently removes the conversation and all of its messages. This cannot be undone."
              confirmLabel="Delete"            onConfirm={deleteConvo}
            onClose={() => setConfirmDel(false)}
          />
        )}
    </div>
  );
}

function SkeletonMsg() {
  return (
    <div className="msg" aria-hidden="true">
      <div className="msg-avatar" style={{ background: 'var(--panel-3)' }} />
      <div className="msg-body">
        <Skeleton w="30%" h="12px" />
        <div style={{ height: 8 }} />
        <Skeleton w="85%" h="13px" />
        <div style={{ height: 6 }} />
        <Skeleton w="70%" h="13px" />
      </div>
    </div>
  );
}
