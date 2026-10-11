// Small building blocks shared by the public pages.
import type { CSSProperties, ReactNode } from 'react';
import { skillById, type SkillId } from '@shieldquest/shared';
import { LinkButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { CONTACT, type FaqItem, type SiteSource } from './data';
import { Entrance, Reveal } from './motion';

/** Inline style that sets the --site-accent custom property (decorative accents only). */
export function accent(color: string): CSSProperties {
  return { '--site-accent': color } as CSSProperties;
}

/** "A" or "An" for a lowercase noun phrase. */
export function article(phrase: string): string {
  return /^[aeiou]/i.test(phrase) ? 'An' : 'A';
}

export function SectionHead({
  id,
  kicker,
  title,
  lead,
  tone = 'night',
  align = 'start',
}: {
  id: string;
  kicker: string;
  title: string;
  lead?: string;
  tone?: 'night' | 'paper';
  align?: 'start' | 'center';
}) {
  return (
    <Reveal className={`site-head site-head--${tone} site-head--${align}`}>
      <p className="site-kicker">{kicker}</p>
      <h2 id={id}>{title}</h2>
      {lead && <p className="site-head__lead">{lead}</p>}
    </Reveal>
  );
}

/** A S.H.I.E.L.D. letter badge. Sighted users see the letter; screen readers hear the skill name. */
export function LetterChip({ letter }: { letter: SkillId }) {
  return (
    <span className="site-letter">
      <span aria-hidden="true">{letter}</span>
      <span className="sr-only">{skillById(letter).name}</span>
    </span>
  );
}

export function SourceNote({ source }: { source: SiteSource }) {
  return (
    <p className="site-source">
      Source: {source.publisher}, <cite>{source.title}</cite>
    </p>
  );
}

export function Faq({ items, tone = 'night' }: { items: readonly FaqItem[]; tone?: 'night' | 'paper' }) {
  return (
    <div className={`site-faq site-faq--${tone}`}>
      {items.map((f) => (
        <details key={f.q} className="site-faq__item">
          <summary>
            <span>{f.q}</span>
            <Icon name="arrowRight" className="site-faq__chev" />
          </summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  );
}

/** Top band for the inner pages. */
export function PageHero({
  kicker,
  title,
  lead,
  art,
  children,
}: {
  kicker: string;
  title: string;
  lead: string;
  art?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={`site-pagehero${art ? ' site-pagehero--art' : ''}`}>
      <div className="container site-pagehero__inner">
        <div className="site-pagehero__copy">
          <Entrance>
            <p className="site-kicker">{kicker}</p>
            <h1>{title}</h1>
          </Entrance>
          <Entrance delay={0.08}>
            <p className="site-pagehero__lead">{lead}</p>
            {children}
          </Entrance>
        </div>
        {art && (
          <Entrance delay={0.12} className="site-pagehero__art">
            {art}
          </Entrance>
        )}
      </div>
    </section>
  );
}

/**
 * "Partner with us": a way to reach the team, never a form. The email line appears only once
 * the team has set an official address in CONTACT.
 */
export function ContactBlock({ id, title = 'Partner with us' }: { id?: string; title?: string }) {
  const email = CONTACT.email.trim();
  return (
    <div className="site-contact" id={id}>
      <div>
        <h3>
          <Icon name="users" /> {title}
        </h3>
        <p>{CONTACT.text}</p>
        {email ? (
          <p className="site-contact__email">
            Email: <a href={`mailto:${email}`}>{email}</a>
          </p>
        ) : (
          <p className="site-contact__via">{CONTACT.via}</p>
        )}
      </div>
      <LinkButton href="/educators" className="site-btn-ink" iconRight="arrowRight">
        What a pilot looks like
      </LinkButton>
    </div>
  );
}

/** On-page contents for long pages. */
export function OnThisPage({ links }: { links: readonly { href: string; label: string }[] }) {
  return (
    <nav className="site-toc" aria-label="On this page">
      <p className="site-toc__title">On this page</p>
      <ul>
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href}>{l.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
