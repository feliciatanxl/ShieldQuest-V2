import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { GAME, helpById } from '@shieldquest/shared';
import { LinkButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import { SettingsPanel } from '../ui/SettingsPanel';
import { SkylineStrip } from './art/Skyline';
import { SiteMotion } from './motion';
import './site.css';

export const NAV = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/educators', label: 'For educators' },
  { href: '/safety', label: 'Safety & privacy' },
  { href: '/about', label: 'About' },
  { href: '/help', label: 'Get help' },
] as const;

const SITE_NAME = 'ShieldQuest';
const DEFAULT_DESCRIPTION =
  'ShieldQuest: a 3D crime- and scam-prevention game for youths that runs in the browser. Choose Right. Protect Together.';

// Path of the last site page shown. Later in-app navigations move focus to the new page's heading
// (so screen readers announce it) without stealing focus on the very first load.
let lastSitePath: string | null = null;

/** Sets document.title and the meta description for the page, restoring both when it unmounts. */
function usePageMeta(title: string | undefined, description: string | undefined) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title ? `${title} · ${SITE_NAME}` : `${SITE_NAME}: ${GAME.hook}`;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prevDesc = meta?.content;
    if (meta) meta.content = description ?? DEFAULT_DESCRIPTION;
    return () => {
      document.title = prevTitle;
      if (meta && prevDesc !== undefined) meta.content = prevDesc;
    };
  }, [title, description]);
}

function isCurrent(location: string, href: string) {
  return location === href || location.startsWith(`${href}/`);
}

function MobileMenu({
  id,
  location,
  onClose,
  onOpenSettings,
}: {
  id: string;
  location: string;
  onClose: (returnFocus: boolean) => void;
  onOpenSettings: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
  }, []);

  return (
    <div id={id} ref={panelRef} className="site-menu">
      <nav aria-label="Main" className="site-menu__nav">
        <ul>
          <li>
            <Link href="/" className="site-menu__link" aria-current={location === '/' ? 'page' : undefined} onClick={() => onClose(false)}>
              Home
            </Link>
          </li>
          {NAV.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                className="site-menu__link"
                aria-current={isCurrent(location, n.href) ? 'page' : undefined}
                onClick={() => onClose(false)}
              >
                {n.label}
                <Icon name="arrowRight" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="site-menu__actions">
        <LinkButton href="/play" size="lg" icon="play" block onClick={() => onClose(false)}>
          Play now
        </LinkButton>
        <LinkButton href="/join" variant="secondary" icon="qr" block onClick={() => onClose(false)}>
          Join a squad session
        </LinkButton>
        <button type="button" className="site-menu__settings" onClick={onOpenSettings}>
          <Icon name="settings" />
          <span>
            Comfort settings
            <small>Text size, motion, 2D mode</small>
          </span>
        </button>
      </div>
      <p className="site-menu__help">
        <Icon name="heart" />
        {/* One text run, so the flex row treats the sentence as a single item. */}
        <span>
          In danger now? Call <strong>{helpById('police-999').contact}</strong>. Not sure if it’s a scam? Call{' '}
          <strong>{helpById('scamshield-1799').contact}</strong>.
        </span>
      </p>
    </div>
  );
}

function SiteHeader({ menuOpen, setMenuOpen }: { menuOpen: boolean; setMenuOpen: (open: boolean) => void }) {
  const [location] = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const menuId = useId();
  const menuBtn = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(
    (returnFocus: boolean) => {
      setMenuOpen(false);
      if (returnFocus) menuBtn.current?.focus();
    },
    [setMenuOpen],
  );

  // Close the overlay menu if the window grows into the desktop layout (the button disappears).
  useEffect(() => {
    if (!menuOpen) return;
    const onResize = () => {
      if (menuBtn.current && getComputedStyle(menuBtn.current).display === 'none') closeMenu(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [menuOpen, closeMenu]);

  // Esc closes the menu from anywhere (including the menu button itself).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen, closeMenu]);

  // Stop the page behind the open menu from scrolling.
  useEffect(() => {
    if (!menuOpen) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <header className={`site-header${menuOpen ? ' is-menu-open' : ''}`}>
      <div className="site-header__bar">
        <Link href="/" className="site-header__logo" aria-label="ShieldQuest home">
          <Logo size={34} />
        </Link>
        <nav aria-label="Main" className="site-header__nav">
          <ul>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="site-header__link" aria-current={isCurrent(location, n.href) ? 'page' : undefined}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header__end">
          <button
            type="button"
            className="ui-iconbtn site-header__settings"
            onClick={() => setSettingsOpen(true)}
            aria-label="Comfort settings: text size, motion and 2D mode"
          >
            <Icon name="settings" />
          </button>
          <LinkButton href="/play" icon="play" className="site-header__cta">
            Play now
          </LinkButton>
          <button
            ref={menuBtn}
            type="button"
            className="ui-iconbtn site-header__menubtn"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </div>
      {menuOpen && (
        <MobileMenu
          id={menuId}
          location={location}
          onClose={closeMenu}
          onOpenSettings={() => {
            closeMenu(false);
            setSettingsOpen(true);
          }}
        />
      )}
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}

function SiteFooter({ inert }: { inert: boolean }) {
  const year = new Date().getFullYear();
  const helpLine = [
    { label: 'Emergency', contact: helpById('police-999').contact },
    { label: 'ScamShield Helpline', contact: helpById('scamshield-1799').contact },
    { label: 'mindline', contact: helpById('mindline-1771').contact.split(' ')[0] ?? '1771' },
  ];
  return (
    <footer className="site-footer" inert={inert}>
      <SkylineStrip className="site-footer__skyline" />
      <div className="site-footer__inner container">
        <div className="site-footer__brand">
          <Logo size={36} />
          <p className="site-footer__tagline">{GAME.tagline}</p>
          <p className="site-footer__blurb">
            A 3D game about the second before a risky choice. Built by youths, for youths, in Singapore.
          </p>
        </div>

        <nav className="site-footer__cols" aria-label="Footer">
          <div>
            <h2 className="site-footer__head">Explore</h2>
            <ul>
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href}>{n.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="site-footer__head">Play</h2>
            <ul>
              <li>
                <Link href="/play">Play now</Link>
              </li>
              <li>
                <Link href="/join">Join a squad session</Link>
              </li>
              <li>
                <Link href="/host">Run a session</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="site-footer__head">For partners</h2>
            <ul>
              <li>
                <Link href="/portal">Scenario Portal</Link>
              </li>
              <li>
                <Link href="/assess">Before &amp; after check</Link>
              </li>
              <li>
                <Link href="/educators">Educator guide</Link>
              </li>
            </ul>
          </div>
        </nav>

        <div className="site-footer__help" role="note" aria-label="Help lines">
          <Icon name="heart" />
          <p>
            {helpLine.map((h, i) => (
              <span key={h.label}>
                {i > 0 && <span aria-hidden="true"> · </span>}
                {h.label} <strong>{h.contact}</strong>
              </span>
            ))}
          </p>
          <Link href="/help" className="site-footer__helplink">
            All help channels
          </Link>
        </div>

        <p className="site-footer__disclaimer">{GAME.disclaimer}</p>
        <p className="site-footer__meta">
          © {year} {GAME.team}. Every person, brand, link and phone number inside the game is fictional.
        </p>
      </div>
    </footer>
  );
}

interface SiteLayoutProps {
  /** Page name for the browser tab, e.g. "For educators". Omit on the home page. */
  title?: string;
  description?: string;
  children: ReactNode;
}

/** Shared chrome for every public page: sticky header, <main id="main">, footer. */
export function SiteLayout({ title, description, children }: SiteLayoutProps) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  usePageMeta(title, description);

  // New page: start at the top (or at the #hash target), and move focus to the page heading.
  useLayoutEffect(() => {
    const hash = window.location.hash.slice(1);
    const target = hash ? document.getElementById(decodeURIComponent(hash)) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
    if (lastSitePath !== null && lastSitePath !== location) {
      const h1 = mainRef.current?.querySelector<HTMLElement>('h1');
      if (h1) {
        h1.setAttribute('tabindex', '-1');
        h1.focus({ preventScroll: true });
      }
    }
    lastSitePath = location;
  }, [location]);

  return (
    <SiteMotion>
      <div className="site">
        <SiteHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
        <main id="main" ref={mainRef} tabIndex={-1} className="site-main" inert={menuOpen}>
          {children}
        </main>
        <SiteFooter inert={menuOpen} />
      </div>
    </SiteMotion>
  );
}
