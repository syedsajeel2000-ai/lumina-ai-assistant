import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CardMotion, PageFade, useBtnMotion } from '../lib/motion.jsx';
import { IconArrowRight, IconHelp } from '../components/icons.jsx';

const FAQS = [
  {
    q: 'What is this AI assistant?',
    a: (
      <>
        <p>Lumina is a web-based AI assistant for chatting, writing, coding help, summarizing, idea generation and more. Every response is generated live by a real AI model — nothing is scripted or faked.</p>
      </>
    )
  },
  {
    q: 'How do I start a chat?',
    a: (
      <>
        <p>Click <strong>Start Chatting</strong> anywhere, or use <strong>AI Chat → New Chat</strong> in the sidebar. Type your message and press <kbd>Enter</kbd> to send (use <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line).</p>
      </>
    )
  },
  {
    q: 'How do I save a response?',
    a: (
      <>
        <p>Hover over any AI response and click the <strong>bookmark icon</strong>. It is stored in your database and appears under <strong>Saved Responses</strong>, where you can view, copy, rename or delete it.</p>
      </>
    )
  },
  {
    q: 'How do I view chat history?',
    a: (
      <>
        <p>Open <strong>Chat History</strong> in the sidebar. Recent conversations also appear right in the sidebar. Click any conversation to continue it — the AI remembers the earlier context. You can rename or delete conversations from there, too.</p>
      </>
    )
  },
  {
    q: 'How do I use task templates?',
    a: (
      <>
        <p>Open <strong>Templates</strong> and pick a task — Write an Email, Debug Code, Study Plan, Meeting Agenda, and more. Fill in the short form (recipient, purpose, tone…) and press <strong>Generate</strong>. The structured prompt goes to the AI and the result streams in live. You can copy, save or regenerate it.</p>
      </>
    )
  },
  {
    q: 'How do I change the theme?',
    a: (
      <>
        <p>Go to <strong>Settings → Appearance</strong> and choose Light, Dark, or System. Your choice is saved to your account and applied everywhere.</p>
      </>
    )
  },
  {
    q: 'How does the AI API work?',
    a: (
      <>
        <p>Lumina talks to any OpenAI-compatible AI provider (free tiers like Groq, OpenRouter or Hugging Face work great). The provider, API key and model are configured <strong>only on the server</strong> via environment variables (<code>AI_API_URL</code>, <code>AI_API_KEY</code>, <code>AI_MODEL</code>) — the key is never exposed to the browser. The provider layer is abstracted, so switching providers means editing <code>.env</code>, not code.</p>
      </>
    )
  },
  {
    q: 'Why might an AI request fail?',
    a: (
      <>
        <p>The most common reasons:</p>
        <ul>
          <li><strong>Not configured</strong> — <code>AI_API_URL</code>/<code>AI_API_KEY</code>/<code>AI_MODEL</code> are missing in the server's <code>.env</code>.</li>
          <li><strong>Invalid or expired API key</strong> — the provider rejected the key.</li>
          <li><strong>Rate limits</strong> — free tiers limit requests per minute; wait a moment and retry.</li>
          <li><strong>Network issues</strong> — the server cannot reach the provider.</li>
        </ul>
        <p>Lumina shows a clear error with a <strong>Retry</strong> button — it never substitutes fake answers.</p>
      </>
    )
  }
];

export default function Help() {
  const [open, setOpen] = useState(0);
  const btnMotion = useBtnMotion();

  return (
    <PageFade className="page">
      <div className="page-head">
        <h1><IconHelp width={22} height={22} /> Help & FAQ</h1>
        <div className="sub">Everything you need to get the most out of Lumina.</div>
      </div>

      <div className="faq">
        {FAQS.map((f, i) => (
          <CardMotion key={i} delay={i * 0.05} lift={2} className={`card faq-item ${open === i ? 'open' : ''}`}>
            <motion.button type="button" className="faq-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)} {...btnMotion}>
              {f.q}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </motion.button>
            <div className="faq-a" style={{ maxHeight: open === i ? 400 : 0 }}>
              <div className="faq-a-inner">{f.a}</div>
            </div>
          </CardMotion>
        ))}
      </div>

      <div className="landing-cta mt-24">
        <h2>Still stuck?</h2>
        <p>Head to Settings to check the AI connection status, or start a chat and ask Lumina itself — it can explain its own features.</p>
        <motion.div whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 24 }} style={{ display: 'inline-block' }}>
          <Link to="/app/settings" className="btn btn-primary" style={{ marginRight: 10 }}>
            Open Settings <IconArrowRight width={16} height={16} />
          </Link>
        </motion.div>
        <motion.div whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 24 }} style={{ display: 'inline-block' }}>
          <Link to="/app/chat" className="btn btn-ghost">Ask in chat</Link>
        </motion.div>
      </div>
    </PageFade>
  );
}
