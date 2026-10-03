import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, streamChat, copyText } from '../lib/api.js';
import { useToast } from '../context/AppContext.jsx';
import { Markdown } from '../lib/markdown.jsx';
import { EmptyState, ErrorPanel, Skeleton } from '../components/ui.jsx';
import { CardMotion, FadeIn, PageFade, useBtnMotion } from '../lib/motion.jsx';
import {
  IconBook, IconBriefcase, IconBug, IconBulb, IconCalendar, IconCheckSimple, IconCode,
  IconCopy, IconFile, IconGrid, IconList, IconMail, IconMessage, IconPen, IconRefreshAlt,
  IconSearch, IconSpark, IconZap
} from '../components/icons.jsx';

const ICONS = {
  mail: IconMail, briefcase: IconBriefcase, message: IconMessage, pen: IconPen,
  refresh: IconRefreshAlt, check: IconCheckSimple, book: IconBook, bug: IconBug,
  code: IconCode, zap: IconZap, repeat: IconRefreshAlt, file: IconFile, list: IconList,
  calendar: IconCalendar, bulb: IconBulb, spark: IconSpark
};

const CATS = [
  { id: 'all', label: 'All' },
  { id: 'writing', label: '✍️ Writing' },
  { id: 'coding', label: '💻 Coding' },
  { id: 'productivity', label: '⚡ Productivity' }
];

const FIELDS = {
  recipient: { label: 'Recipient', placeholder: 'e.g. my teacher, a client, the HR team' },
  purpose: { label: 'Purpose', placeholder: 'e.g. ask for a meeting about my project' },
  tone: { label: 'Tone', type: 'select', options: ['professional', 'friendly', 'formal', 'casual', 'persuasive', 'apologetic'] },
  details: { label: 'Important details', type: 'textarea', placeholder: 'Anything the AI should know…', optional: true },
  topic: { label: 'Topic', placeholder: 'e.g. remote work productivity' },
  text: { label: 'Your text', type: 'textarea', placeholder: 'Paste the text here…' },
  code: { label: 'Your code', type: 'textarea', placeholder: 'Paste the code here…' },
  language: { label: 'Language / framework', placeholder: 'e.g. JavaScript, Python, React' },
  error: { label: 'Error or unexpected behaviour', type: 'textarea', placeholder: 'Paste the error message…', optional: true },
  requirement: { label: 'What should the code do?', type: 'textarea', placeholder: 'Describe the requirement…' },
  from_language: { label: 'From language', placeholder: 'e.g. Python' },
  to_language: { label: 'To language', placeholder: 'e.g. JavaScript' },
  goal: { label: 'Goal', placeholder: 'e.g. launch my portfolio website' },
  subject: { label: 'Subject', placeholder: 'e.g. machine learning basics' },
  duration: { label: 'Duration', placeholder: 'e.g. 4 weeks, one semester' }
};

function fieldsForTemplate(tpl) {
  const names = [...tpl.prompt_template.matchAll(/{{(\w+)}}/g)].map((m) => m[1]);
  return [...new Set(names)];
}

function buildPrompt(tpl, values) {
  return tpl.prompt_template.replace(/{{(\w+)}}/g, (_, k) => (values[k] || '').trim() || `(${k})`);
}

function tplIcon(tpl, size = 20) {
  const Icon = ICONS[tpl.icon] || IconSpark;
  return <Icon width={size} height={size} />;
}

/* ── Template runner ─────────────────────────────────────────────── */
function Runner({ tpl, onBack }) {
  const toast = useToast();
  const btnMotion = useBtnMotion();
  const fieldNames = useMemo(() => fieldsForTemplate(tpl), [tpl]);
  const [values, setValues] = useState({});
  const [result, setResult] = useState('');
  const [running, setRunning] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const runConvoRef = React.useRef(null); // keep regenerations in one conversation

  function run() {
    // Require every non-optional field to have a value.
    for (const name of fieldNames) {
      const f = FIELDS[name] || { label: name };
      if (!f.optional && !(values[name] || '').trim()) {
        toast(`Please fill in: ${f.label}`, 'error');
        return;
      }
    }
    setError(null);
    setResult('');
    setRunning(true);
    setStreaming(true);
    const prompt = buildPrompt(tpl, values);
    const abort = streamChat({ message: prompt, conversationId: runConvoRef.current }, (event, data) => {
      if (event === 'start') runConvoRef.current = data.conversationId;
      else if (event === 'delta') setResult((r) => r + data.text);
      else if (event === 'done') { setRunning(false); setStreaming(false); }
      else if (event === 'aborted') { setRunning(false); setStreaming(false); }
      else if (event === 'error') {
        setRunning(false);
        setStreaming(false);
        setError(data.error);
      }
    });
    // Stop button support
    runAbort.current = abort;
  }
  const runAbort = React.useRef(null);

  async function saveResult() {
    try {
      await api.saveResponse({
        conversationId: null,
        title: `${tpl.name}${values.topic ? ` — ${values.topic}` : values.recipient ? ` — ${values.recipient}` : ''}`.slice(0, 60),
        content: result
      });
      toast('Response saved', 'success');
    } catch (e) {
      toast(e.message || 'Failed to save response', 'error');
    }
  }

  async function copyResult() {
    const ok = await copyText(result);
    if (ok) {
      setCopied(true);
      toast('Copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <div className="runner">
      <div className="card runner-form">
        <motion.button type="button" className="btn btn-ghost btn-sm mb-16" onClick={onBack} {...btnMotion}>← All templates</motion.button>
        <h2 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 9 }}>
          <span className="feature-icon" style={{ width: 34, height: 34, borderRadius: 10 }}>{tplIcon(tpl, 16)}</span>
          {tpl.name}
        </h2>
        <p className="muted small mb-16">{tpl.description}</p>
        {fieldNames.map((name) => {
          const f = FIELDS[name] || { label: name };
          const id = `f-${name}`;
          return (
            <div className="field" key={name}>
              <label htmlFor={id}>{f.label}{f.optional ? <span className="muted"> · optional</span> : ''}</label>
              {f.type === 'textarea' ? (
                <textarea id={id} className="textarea" placeholder={f.placeholder} rows={4}
                  value={values[name] || ''} onChange={(e) => setValues({ ...values, [name]: e.target.value })} />
              ) : f.type === 'select' ? (
                <select id={id} className="select" value={values[name] || 'professional'}
                  onChange={(e) => setValues({ ...values, [name]: e.target.value })}>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input id={id} className="input" placeholder={f.placeholder}
                  value={values[name] || ''} onChange={(e) => setValues({ ...values, [name]: e.target.value })} />
              )}
            </div>
          );
        })}
        <div className="row wrap">
          <motion.button type="button" className="btn btn-primary" onClick={run} disabled={running} {...btnMotion}>
            {running ? <span className="spinner" /> : <IconSpark width={16} height={16} />}
            {running ? 'Generating…' : 'Generate'}
          </motion.button>
          {running && (
            <motion.button type="button" className="btn btn-soft" onClick={() => runAbort.current?.()} {...btnMotion}>Stop</motion.button>
          )}
        </div>
      </div>

      <div className="card runner-result">
        {error ? (
          <ErrorPanel title="Generation failed" message={error} onRetry={run} />
        ) : running && !result ? (
          <div aria-live="polite">
            <div className="thinking" style={{ marginBottom: 16 }}>Generating<span className="dots"><i /><i /><i /></span></div>
            <Skeleton w="90%" h="13px" /><div style={{ height: 8 }} />
            <Skeleton w="75%" h="13px" /><div style={{ height: 8 }} />
            <Skeleton w="82%" h="13px" /><div style={{ height: 8 }} />
            <Skeleton w="60%" h="13px" /><div style={{ height: 8 }} />
            <Skeleton w="45%" h="13px" />
          </div>
        ) : result ? (
          <FadeIn>
            <Markdown text={result} />
            {streaming && <span className="caret" />}
            {!running && (
              <div className="result-actions">
                <motion.button type="button" className="btn btn-soft btn-sm" onClick={copyResult} {...btnMotion}>
                  {copied ? <IconCheckSimple width={14} height={14} /> : <IconCopy width={14} height={14} />} Copy
                </motion.button>
                <motion.button type="button" className="btn btn-soft btn-sm" onClick={saveResult} {...btnMotion}>
                  Save response
                </motion.button>
                <motion.button type="button" className="btn btn-soft btn-sm" onClick={run} {...btnMotion}>
                  <IconRefreshAlt width={14} height={14} /> Regenerate
                </motion.button>
                <motion.button type="button" className="btn btn-ghost btn-sm" onClick={() => { setResult(''); setError(null); }} {...btnMotion}>
                  Clear
                </motion.button>
              </div>
            )}
          </FadeIn>
        ) : (
          <div className="placeholder">
            <div>
              <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>{tplIcon(tpl, 34)}</div>
              Fill in the form and press <strong>Generate</strong>.<br />
              The structured prompt goes straight to the AI — the result appears here live.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Templates page ──────────────────────────────────────────────── */
export default function Templates() {
  const toast = useToast();
  const btnMotion = useBtnMotion();
  const [params, setParams] = useSearchParams();
  const activeId = params.get('t');

  const [templates, setTemplates] = useState(null);
  const [error, setError] = useState(null);
  const [cat, setCat] = useState(params.get('category') || 'all');
  const [query, setQuery] = useState('');

  function load() {
    setError(null);
    api.templates()
      .then((d) => setTemplates(d.templates))
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);
  useEffect(() => {
    const c = params.get('category');
    if (c) setCat(c);
  }, [params]);

  const active = templates?.find((t) => String(t.id) === activeId) || null;

  const filtered = (templates || []).filter((t) => {
    const okCat = cat === 'all' || t.category === cat;
    const q = query.trim().toLowerCase();
    const okQ = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    return okCat && okQ;
  });

  if (active) return (
    <PageFade className="page">
      <Runner tpl={active} onBack={() => setParams({})} />
    </PageFade>
  );

  return (
    <PageFade className="page">
      <div className="page-head">
        <h1><IconGrid width={22} height={22} /> Task Templates</h1>
        <div className="sub">Predefined AI workflows — pick one, fill the form, get a structured result.</div>
      </div>

      <div className="cat-tabs" role="tablist" aria-label="Template categories">
        {CATS.map((c) => (
          <motion.button key={c.id} type="button" role="tab" aria-selected={cat === c.id}
            className={`cat-tab ${cat === c.id ? 'active' : ''}`}
            onClick={() => setCat(c.id)} {...btnMotion}>
            {c.label}
          </motion.button>
        ))}
      </div>

      <div className="search-box mb-16" style={{ maxWidth: 380 }}>
        <IconSearch width={16} height={16} />
        <input className="input" placeholder="Search tasks…" aria-label="Search tasks"
          value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {templates === null && !error ? (
        <div className="tpl-grid" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <Skeleton w="60%" h="14px" />
              <div style={{ height: 10 }} />
              <Skeleton w="100%" h="11px" />
              <div style={{ height: 6 }} />
              <Skeleton w="80%" h="11px" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorPanel message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconSearch width={28} height={28} />}
          title="No matching tasks found."
          message={`Nothing matches "${query}"${cat !== 'all' ? ' in this category' : ''}.`}
          action={
            <motion.button type="button" className="btn btn-ghost" onClick={() => { setQuery(''); setCat('all'); }} {...btnMotion}>
              Clear filters
            </motion.button>
          }
        />
      ) : (
        <div className="tpl-grid">
          {filtered.map((t, i) => (
            <CardMotion key={t.id} delay={i * 0.05} lift={4} className="motion-cell">
              <button type="button" className="card card-hover tpl-card"
                onClick={() => setParams({ t: String(t.id) })}>
                <div className="row-between">
                  <span className="feature-icon" style={{ width: 40, height: 40, borderRadius: 12 }}>{tplIcon(t)}</span>
                  <span className={`badge badge-${t.category}`}>{t.category}</span>
                </div>
                <h3>{t.name}</h3>
                <p>{t.description}</p>
                <div className="foot">
                  <span className="use">Use template →</span>
                </div>
              </button>
            </CardMotion>
          ))}
        </div>
      )}
    </PageFade>
  );
}
