import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Shared Framer Motion primitives.
 *
 * Every animation respects `prefers-reduced-motion` (matching the app's CSS):
 * when the OS asks for reduced motion, entrances render instantly and hover
 * feedback becomes a subtle opacity shift instead of movement.
 *
 * Hover lifts are kept intentionally smaller than the CSS `:hover` transforms
 * (e.g. `.card-hover` lifts 3px) so the two never fight — Framer animates the
 * inline `y` transform smoothly while the stylesheet handles the shadow.
 */

const EASE = [0.22, 0.61, 0.36, 1]; // matches var(--ease)

/* Fade + rise on mount. Wraps pages and static sections. */
export function PageFade({ children, delay = 0, y = 12, style, ...rest }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.45, ease: EASE, delay: reduce ? 0 : delay }}
      style={style}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* Lighter fade for list rows, cards and message bubbles. */
export function FadeIn({ children, delay = 0, y = 8, style, ...rest }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.3, ease: EASE, delay: reduce ? 0 : delay }}
      style={style}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* Hover lift for interactive surfaces: cards, chips, buttons, nav rows. */
export function Hoverable({ children, lift = 3, scale, style, ...rest }) {
  const reduce = useReducedMotion();
  const hover = reduce ? { opacity: 0.85 } : { y: -lift, ...(scale ? { scale } : {}) };
  return (
    <motion.div
      whileHover={hover}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      style={style}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* One staggered card/list row: entrance fade + hover lift in a single wrapper.
   Pass `inView` to trigger the entrance when the element scrolls into the
   viewport (once), instead of on mount. */
export function CardMotion({ children, delay = 0, lift = 3, inView = false, amount = 0.2, ...rest }) {
  const reduce = useReducedMotion();
  const hidden = { opacity: 0, y: 10 };
  const shown = { opacity: 1, y: 0 };
  const entrance = reduce
    ? { initial: false, animate: shown }
    : inView
      ? { initial: hidden, whileInView: shown, viewport: { once: true, amount } }
      : { initial: hidden, animate: shown };
  return (
    <motion.div
      {...entrance}
      transition={{ duration: reduce ? 0 : 0.32, ease: EASE, delay: reduce ? 0 : delay }}
      whileHover={reduce ? { opacity: 0.85 } : { y: -lift }}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* Scroll-triggered reveal: fades in the first time it enters the viewport. */
export function Reveal({ children, delay = 0, y = 16, amount = 0.2, className, style, ...rest }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: reduce ? 0 : 0.5, ease: EASE, delay: reduce ? 0 : delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* Scaled fade for dialogs and pop-ins (exit is handled by the CSS/timeout). */
export function PopIn({ children, delay = 0, style, ...rest }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.24, ease: EASE, delay: reduce ? 0 : delay }}
      style={style}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* Shared Framer hover/tap props for every button; spread onto motion.button.
   Respect prefers-reduced-motion: opacity feedback instead of movement. */
export function useBtnMotion() {
  const reduce = useReducedMotion();
  return reduce
    ? { whileHover: { opacity: 0.85 } }
    : { whileHover: { y: -1, scale: 1.015 }, whileTap: { scale: 0.97 } };
}
