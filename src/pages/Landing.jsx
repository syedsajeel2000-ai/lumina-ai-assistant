import React, { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { useAuth } from '../context/AppContext.jsx';
import {
  IconArrowRight, IconBulb, IconChat, IconCode, IconGlobe, IconGrid, IconList, IconMail,
  IconPen, IconRefreshAlt, IconSpark, IconZap
} from '../components/icons.jsx';
import { CardMotion, PageFade, Reveal } from '../lib/motion.jsx';

const FEATURES = [
  { icon: IconChat, title: 'AI Chat', desc: 'Ask anything — get clear, sourced, streaming answers with full conversation memory.', to: '/app/chat', prompt: null },
  { icon: IconGlobe, title: 'Web Access', desc: 'Flip the Web toggle and Lumina searches the live internet, reads pages and cites its sources.', to: '/app/chat', prompt: null },
  { icon: IconPen, title: 'Writing Assistant', desc: 'Emails, posts, captions and blog intros drafted in your voice and tone.', to: '/app/templates?category=writing', prompt: 'Help me write a short blog introduction about remote work productivity.' },
  { icon: IconCode, title: 'Coding Assistant', desc: 'Explain, debug, generate, optimize and convert code with explanations.', to: '/app/templates?category=coding', prompt: 'Write a JavaScript function that debounces another function, with usage examples.' },
  { icon: IconList, title: 'Text Summarizer', desc: 'Turn long text into a crisp overview plus the key points that matter.', to: '/app/templates?category=productivity', prompt: 'Summarize this in three bullet points: [paste your text]' },
  { icon: IconMail, title: 'Email Generator', desc: 'Ready-to-send emails with subject lines, tailored to recipient and tone.', to: '/app/templates?category=writing', prompt: 'Write a professional email asking my teacher for a meeting.' },
  { icon: IconBulb, title: 'Idea Generator', desc: 'Ten fresh ideas on any topic — from safe bets to bold swings.', to: '/app/templates?category=productivity', prompt: 'Brainstorm 10 ideas for a weekend side project.' },
  { icon: IconRefreshAlt, title: 'Never Rate Limited', desc: 'Groq, Cohere, OpenRouter, Cerebras, Mistral, HF and Ollama form a failover chain — one hits its limit, the next answers.', to: '/app/chat', prompt: null },
  { icon: IconZap, title: 'Smart Suggestions', desc: 'Live, relevant suggestions as you type so you never start from a blank box.', to: '/app/chat', prompt: null }
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  /* ── 3D hero: pointer-driven tilt (spring-smoothed, depth-layered) ── */
  const sceneRef = useRef(null);
  const mx = useMotionValue(0); // -1 … 1 across the hero width
  const my = useMotionValue(0); // -1 … 1 across the hero height
  const sx = useSpring(mx, { stiffness: 60, damping: 16 });
  const sy = useSpring(my, { stiffness: 60, damping: 16 });

  const rotateX = useTransform(sy, [-1, 1], [7, -7]);
  const rotateY = useTransform(sx, [-1, 1], [-9, 9]);
  const orbDriftX = useTransform(sx, [-1, 1], [26, -26]);
  const orbDriftY = useTransform(sy, [-1, 1], [18, -18]);
  const glassX = useTransform(sx, [-1, 1], [-14, 14]);
  const glassY = useTransform(sy, [-1, 1], [-10, 10]);
  const chipX = useTransform(sx, [-1, 1], [10, -10]);
  const chipY = useTransform(sy, [-1, 1], [8, -8]);

  function handleTilt(e) {
    if (reduceMotion) return;
    const el = sceneRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
    my.set(((e.clientY - r.top) / r.height) * 2 - 1);
  }
  function resetTilt() {
    mx.set(0);
    my.set(0);
  }

  function start(prompt) {
    if (prompt) sessionStorage.setItem('lumina:prefill', prompt);
    navigate(user ? '/app/chat' : '/signup');
  }

  return (
    <div className="landing">
      <div className="hero-orb o1" aria-hidden="true" />
      <div className="hero-orb o2" aria-hidden="true" />
      <div className="hero-orb o3" aria-hidden="true" />

      <nav className="landing-nav" aria-label="Main">
        <Link to="/" className="brand"><span className="brand-logo"><IconSpark width={16} height={16} /></span> Lumina</Link>
        <div className="links">
          <a href="#features" className="hide-sm">Capabilities</a>
          <a href="#about" className="hide-sm">About</a>
          <a href="#how" className="hide-sm">How it works</a>
          {user ? (
            <Link to="/app/chat" className="btn btn-primary btn-sm">Open assistant</Link>
          ) : (
            <>
              <Link to="/login" className="hide-sm">Sign in</Link>
              <Link to="/signup" className="btn btn-primary btn-sm">Get started</Link>
            </>
          )}
        </div>
      </nav>

      <PageFade>
        <section
          className="hero hero-3d"
          ref={sceneRef}
          onMouseMove={handleTilt}
          onMouseLeave={resetTilt}
        >
          <motion.div className="hero-3d-scene" style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}>
            {/* depth layer 1 — background orb */}
            <motion.div className="hero-3d-orb" style={{ x: orbDriftX, y: orbDriftY }} aria-hidden="true" />

            <motion.div
              className="hero-eyebrow"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1], delay: 0.05 }}
            >
              <IconSpark width={14} height={14} /> Your everyday AI assistant
            </motion.div>
            <motion.h1
              initial={{ opacity:0, y:18 }}
              animate={{ opacity:1, y:0 }}
              transition={{ duration:0.55, ease:[0.22,0.61,0.36,1], delay:0.12 }}
            >
              Your AI assistant for <span className="grad">everything you make</span>
            </motion.h1>
            <motion.p
              className="lead"
              initial={{ opacity:0, y:18 }}
              animate={{ opacity:1, y:0 }}
              transition={{ duration:0.55, ease:[0.22,0.61,0.36,1], delay:0.2 }}
            >
              Ask questions, generate text, get coding help, write emails, brainstorm ideas,
              summarize content and rewrite anything — powered by a real AI model, streaming
              live as it thinks.
            </motion.p>
            <motion.div
              className="hero-cta"
              initial={{ opacity:0, y:18 }}
              animate={{ opacity:1, y:0 }}
              transition={{ duration:0.55, ease:[0.22,0.61,0.36,1], delay:0.28 }}
            >
              <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }} transition={{ type:'spring', stiffness:400, damping:22 }}>
                <Link to={user ? '/app/chat' : '/signup'} className="btn btn-primary btn-lg">
                  Start Chatting <IconArrowRight width={17} height={17} />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }} transition={{ type:'spring', stiffness:400, damping:22 }}>
                <Link to="/app/templates" className="btn btn-ghost btn-lg">Explore Tasks</Link>
              </motion.div>
            </motion.div>

            {/* depth layer 2 — glass panel with depth icon */}
            <motion.div
              className="hero-3d-glass"
              style={{ x: glassX, y: glassY, z: 60 }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1], delay: 0.4 }}
              aria-hidden="true"
            >
              <motion.div
                className="hero-3d-glass-icon"
                animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <IconChat width={22} height={22} />
              </motion.div>
            </motion.div>

            {/* depth layer 3 — floating chips */}
            <motion.div className="hero-3d-chip c1" style={{ x: chipX, y: chipY, z: 90 }} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.55, type: 'spring', stiffness: 260, damping: 20 }} aria-hidden="true">
              <IconZap width={13} height={13} /> Real-time
            </motion.div>
            <motion.div className="hero-3d-chip c2" style={{ x: chipX, y: chipY, z: 110 }} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.68, type: 'spring', stiffness: 260, damping: 20 }} aria-hidden="true">
              <IconBulb width={13} height={13} /> AI ideas
            </motion.div>
          </motion.div>

        <div className="hero-tags">
          {['Ask questions', 'Web access', 'Coding help', 'Write emails', 'Brainstorm ideas', 'Summarize', 'Rewrite', 'Cited sources'].map((t) => (
            <span key={t} className="chip" style={{ cursor: 'default' }}>{t}</span>
          ))}
        </div>
      </section>

      <Reveal>
      <section className="section" id="features" aria-labelledby="features-h">
        <div className="section-head">
          <h2 id="features-h">One assistant, every workflow</h2>
          <p>Pick a capability to jump straight into a working flow — every card leads to a live AI feature.</p>
        </div>
        <div className="feature-grid">
          {FEATURES.map(({ icon: Icon, title, desc, to, prompt }, i) => (
            <CardMotion key={title} delay={0.06 * i} lift={5} inView className="motion-cell">
              <button type="button" className="card card-hover feature-card" onClick={() => start(prompt)}>
                <span className="feature-icon"><Icon width={21} height={21} /></span>
                <h3>{title}</h3>
                <p>{desc}</p>
                <span className="go">Try it <IconArrowRight width={14} height={14} /></span>
              </button>
            </CardMotion>
          ))}
        </div>
      </section>
      </Reveal>

      <Reveal>
      <section className="section" id="how" aria-labelledby="how-h">
        <div className="section-head">
          <h2 id="how-h">How it works</h2>
          <p>From sign-up to saved answers in three steps.</p>
        </div>
        <div className="steps">
          {[
            { n: 1, title: 'Create your account', desc: 'Sign up in seconds. Your conversations, saved responses and preferences live in a private SQLite database tied to your account.' },
            { n: 2, title: 'Chat or pick a task', desc: 'Ask anything in the chat, or use a template — Write an Email, Debug Code, Study Plan — and fill in a short form.' },
            { n: 3, title: 'Save what matters', desc: 'Copy any response with one click, save the keepers, and revisit every conversation from your history — anytime.' }
          ].map(({ n, title, desc }, i) => (
            <CardMotion key={n} delay={0.1 * i} lift={3} inView className="motion-cell">
              <div className="card step">
                <div className="num">{n}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            </CardMotion>
          ))}
        </div>
      </section>
      </Reveal>

      <Reveal>
        <section className="section about-section" id="about" aria-labelledby="about-h">
          <div className="section-head">
            <h2 id="about-h">What is Lumina?</h2>
            <p>A full-stack, open AI assistant you actually own.</p>
          </div>
          <div className="about-grid">
            <div className="card about-card">
              <span className="feature-icon"><IconSpark width={20} height={20} /></span>
              <h3>Real streaming AI</h3>
              <p>
                Every answer is generated live by real AI models — streamed token-by-token over SSE.
                Nothing scripted, nothing faked. Ask, and watch it think.
              </p>
            </div>
            <div className="card about-card">
              <span className="feature-icon"><IconGlobe width={20} height={20} /></span>
              <h3>Connected to the web</h3>
              <p>
                Toggle web access in any chat and Lumina searches the internet, reads the top pages
                and answers with inline citations — current events included.
              </p>
            </div>
            <div className="card about-card">
              <span className="feature-icon"><IconRefreshAlt width={20} height={20} /></span>
              <h3>Multi-provider resilience</h3>
              <p>
                Groq, Cohere, OpenRouter, Cerebras, Mistral, Hugging Face and local Ollama plug into one
                failover chain. Rate limit on one? The next answers — the chat just keeps flowing.
              </p>
            </div>
            <div className="card about-card">
              <span className="feature-icon"><IconChat width={20} height={20} /></span>
              <h3>Yours, end to end</h3>
              <p>
                React + Vite front end, Node/Express API, SQLite storage — self-hostable, private by
                design, with per-user isolation for every conversation, save and preference.
              </p>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
      <section className="section">
        <div className="landing-cta">
          <h2>Ready when you are</h2>
          <p>Real AI. Real streaming. Your history, saved responses and settings — persisted and private.</p>
          <div className="hero-cta" style={{ marginBottom: 0 }}>
            <Link to={user ? '/app/chat' : '/signup'} className="btn btn-primary btn-lg">Start Chatting</Link>
            <Link to="/app/templates" className="btn btn-soft btn-lg">Explore Tasks</Link>
          </div>
        </div>
      </section>
      </Reveal>

      <footer className="landing-foot">
        Lumina — an original, Copilot-inspired AI assistant demo. Built with React, Express, SQLite and a real AI API.
      </footer>
      </PageFade>
    </div>
  );
}
