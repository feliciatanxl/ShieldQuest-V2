// Motion helpers for the public site. LazyMotion + `m` keeps the animation runtime small,
// and every helper renders plain, static markup when the player prefers reduced motion.
import type { ReactNode } from 'react';
import { LazyMotion, MotionConfig, domAnimation, m, type Variants } from 'motion/react';
import { prefersReducedMotion, useSettings } from '../state/settings';

const EASE = [0.22, 1, 0.36, 1] as const;

export function useReducedMotion(): boolean {
  const motion = useSettings((s) => s.motion);
  return prefersReducedMotion(motion);
}

export function SiteMotion({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>{children}</MotionConfig>
    </LazyMotion>
  );
}

const VIEWPORT = { once: true, margin: '0px 0px -10% 0px' } as const;

/** Fades content up the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </m.div>
  );
}

const listVariants: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

type ListTag = 'ul' | 'ol' | 'div';

/** A list whose items cascade in. Use with <StaggerItem>. */
export function Stagger({ as = 'ul', className, children }: { as?: ListTag; className?: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) {
    if (as === 'ol') return <ol className={className}>{children}</ol>;
    if (as === 'div') return <div className={className}>{children}</div>;
    return <ul className={className}>{children}</ul>;
  }
  const common = { className, variants: listVariants, initial: 'hidden', whileInView: 'show', viewport: VIEWPORT } as const;
  if (as === 'ol') return <m.ol {...common}>{children}</m.ol>;
  if (as === 'div') return <m.div {...common}>{children}</m.div>;
  return <m.ul {...common}>{children}</m.ul>;
}

export function StaggerItem({ as = 'li', className, children }: { as?: 'li' | 'div'; className?: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) return as === 'div' ? <div className={className}>{children}</div> : <li className={className}>{children}</li>;
  return as === 'div' ? (
    <m.div className={className} variants={itemVariants}>
      {children}
    </m.div>
  ) : (
    <m.li className={className} variants={itemVariants}>
      {children}
    </m.li>
  );
}

/** Hero entrance: children rise in sequence on first paint. */
export function Entrance({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </m.div>
  );
}
