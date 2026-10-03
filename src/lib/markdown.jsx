import React, { useMemo, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { copyText } from './api.js';

marked.setOptions({ gfm: true, breaks: true });

const COPY_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHECK_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

/** Splits text into markdown / fenced-code segments (handles unclosed fences while streaming). */
export function splitFences(src) {
  const out = [];
  let rest = String(src ?? '');
  const fenceRe = /```([\w+#.-]*)[ \t]*\n?([\s\S]*?)```/g;
  let last = 0;
  let m;
  while ((m = fenceRe.exec(rest)) !== null) {
    if (m.index > last) out.push({ type: 'md', text: rest.slice(last, m.index) });
    out.push({ type: 'code', lang: m[1] || '', code: m[2].replace(/\n$/, '') });
    last = m.index + m[0].length;
  }
  // Unterminated fence while streaming → render as code so far.
  const open = rest.slice(last).match(/^([\s\S]*?)```([\w+#.-]*)[ \t]*\n?([\s\S]*)$/);
  if (open) {
    if (open[1]) out.push({ type: 'md', text: open[1] });
    out.push({ type: 'code', lang: open[2] || '', code: open[3], open: true });
  } else if (last < rest.length) {
    out.push({ type: 'md', text: rest.slice(last) });
  }
  return out;
}

function MdHtml({ text }) {
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(text), { USE_PROFILES: { html: true } }),
    [text]
  );
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function CodeBlock({ language, code, open }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-block">
      <div className="code-head">
        <span>{language || 'code'}{open ? ' · streaming…' : ''}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Copy code"
          onClick={async () => {
            const ok = await copyText(code);
            if (ok) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }
          }}
        >
          <span dangerouslySetInnerHTML={{ __html: copied ? CHECK_SVG : COPY_SVG }} />
        </button>
      </div>
      <pre><code>{code}{open ? '▌' : ''}</code></pre>
    </div>
  );
}

/** Renders AI markdown safely with professional code blocks + working copy buttons. */
export function Markdown({ text }) {
  const segments = useMemo(() => splitFences(text), [text]);
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'code' ? (
          <CodeBlock key={i} language={seg.lang} code={seg.code} open={seg.open} />
        ) : (
          <MdHtml key={i} text={seg.text} />
        )
      )}
    </>
  );
}
