// Shared pieces of the Scenario Portal: the page shell (with the disclaimer the GDD requires in the
// Portal header), the educator nav, chip groups built on native inputs, and the sign-in card.

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'wouter';
import { GAME, type LintIssue } from '@shieldquest/shared';
import { Button } from '../ui/Button';
import { HelpButton } from '../ui/HelpPanel';
import { Icon, type IconName } from '../ui/Icon';
import { LogoMark } from '../ui/Logo';
import { SettingsButton } from '../ui/SettingsPanel';
import { StatusBadge, type Status } from '../ui/StatusBadge';
import { PortalError, signIn, signOut, useEducatorSession } from './api';
import './portal.css';

export type PortalTab = 'library' | 'editor' | 'moderation' | 'analytics';

const TABS: { id: PortalTab; label: string; icon: IconName; href: string }[] = [
  { id: 'library', label: 'Library', icon: 'book', href: '/portal?tab=library' },
  { id: 'editor', label: 'Editor', icon: 'text', href: '/portal?tab=editor' },
  { id: 'moderation', label: 'Moment Cards', icon: 'chat', href: '/portal?tab=moderation' },
  { id: 'analytics', label: 'Analytics', icon: 'map', href: '/portal/analytics' },
];

/** Sets the tab title while mounted. */
export function usePageTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} · ShieldQuest`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}

/** Moves focus to the page heading when `key` changes, so screen readers announce the new view. */
export function useFocusHeading<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // Prefer the view's own h1 (tabIndex -1); fall back to the container while a lazy view loads.
    const h = ref.current?.querySelector<HTMLElement>('h1');
    (h ?? ref.current)?.focus();
  }, [key]);
  return ref;
}

export function PortalShell({ children, tab, wide }: { children: ReactNode; tab?: PortalTab; wide?: boolean }) {
  const session = useEducatorSession();
  return (
    <div className="portal">
      <header className="portal-bar">
        <div className="portal-bar__row">
          <Link href="/portal" className="portal-bar__home" aria-label="Scenario Portal start">
            <LogoMark size={30} />
            <span className="portal-bar__title">
              Scenario <b>Portal</b>
            </span>
          </Link>
          <div className="portal-bar__tools">
            {session && (
              <span className="portal-bar__who" title="Signed in to the educator area">
                <Icon name="lock" />
                <span>{session.initials ?? 'Educator'}</span>
              </span>
            )}
            {session && (
              <Button variant="secondary" size="sm" onClick={() => void signOut()}>
                Sign out
              </Button>
            )}
            <HelpButton />
            <SettingsButton />
          </div>
        </div>
        {session && (
          <nav className="portal-tabs" aria-label="Educator area">
            {TABS.map((t) => (
              <Link
                key={t.id}
                href={t.href}
                className={`portal-tabs__link${tab === t.id ? ' is-current' : ''}`}
                aria-current={tab === t.id ? 'page' : undefined}
              >
                <Icon name={t.icon} />
                <span>{t.label}</span>
              </Link>
            ))}
          </nav>
        )}
        <p className="portal-disclaimer">{GAME.disclaimer}</p>
      </header>
      <main id="main" className={`portal-main${wide ? ' portal-main--wide' : ''}`}>
        {children}
      </main>
      <footer className="portal-foot">
        <Link href="/">ShieldQuest home</Link>
        <span aria-hidden="true">·</span>
        <Link href="/safety">Safety &amp; privacy</Link>
        <span aria-hidden="true">·</span>
        <Link href="/educators">For educators</Link>
      </footer>
    </div>
  );
}

export interface ChipOption<T extends string> {
  id: T;
  label: string;
  hint?: string;
  /** A small colour mark beside the word (never colour alone). */
  swatch?: string;
}

interface ChipGroupProps<T extends string> {
  legend: ReactNode;
  hint?: ReactNode;
  options: readonly ChipOption<T>[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  multiple?: boolean;
  max?: number;
  /** Lets a single-choice group be cleared by tapping the chosen chip again. */
  clearable?: boolean;
  invalid?: boolean;
  step?: number;
}

/** Chip-first choices on native radios/checkboxes: keyboard, screen readers and text size just work. */
export function ChipGroup<T extends string>({
  legend,
  hint,
  options,
  value,
  onChange,
  multiple,
  max,
  clearable,
  invalid,
  step,
}: ChipGroupProps<T>) {
  const name = useId();
  const hintId = useId();
  const full = multiple && max !== undefined && value.length >= max;
  return (
    <fieldset className={`portal-field${invalid ? ' is-invalid' : ''}`} aria-describedby={hint ? hintId : undefined}>
      <legend className="portal-field__legend">
        {step !== undefined && <span className="portal-step">{step}</span>}
        <span>{legend}</span>
      </legend>
      {hint && (
        <p id={hintId} className="portal-field__hint">
          {hint}
          {multiple && max !== undefined && (
            <span className="portal-field__count">
              {' '}
              ({value.length} of {max} picked)
            </span>
          )}
        </p>
      )}
      <div className="portal-chips">
        {options.map((o) => {
          const checked = value.includes(o.id);
          return (
            <label key={o.id} className="portal-chip">
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={name}
                value={o.id}
                checked={checked}
                disabled={!checked && full}
                onChange={() => {
                  if (multiple) onChange(checked ? value.filter((v) => v !== o.id) : [...value, o.id]);
                  else onChange([o.id]);
                }}
                onClick={() => {
                  if (!multiple && clearable && checked) onChange([]);
                }}
              />
              <span className="portal-chip__face">
                {o.swatch && <span className="portal-chip__swatch" style={{ background: o.swatch }} aria-hidden="true" />}
                <span className="portal-chip__text">
                  {o.label}
                  {o.hint && <small>{o.hint}</small>}
                </span>
                <Icon name="check" className="portal-chip__tick" />
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** An inline status note: shape + icon + word, never colour alone. */
export function Note({ status, children, live }: { status: Status; children: ReactNode; live?: boolean }) {
  return (
    <div className={`portal-note portal-note--${status}`} role={live ? 'status' : undefined}>
      <StatusBadge status={status} label={status === 'risk' ? 'Fix' : status === 'attention' ? 'Check' : status === 'safe' ? 'OK' : 'Note'} />
      <div className="portal-note__body">{children}</div>
    </div>
  );
}

/** Lint issues grouped into errors and warnings, with their JSON paths. */
export function LintList({ issues, empty }: { issues: readonly LintIssue[]; empty?: ReactNode }) {
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  if (!issues.length) return <Note status="safe">{empty ?? 'No problems found.'}</Note>;
  return (
    <div className="portal-lint">
      {[
        { list: errors, title: 'Errors (must fix before review)', status: 'risk' as const },
        { list: warnings, title: 'Warnings (check before review)', status: 'attention' as const },
      ]
        .filter((g) => g.list.length)
        .map((g) => (
          <section key={g.status} className="portal-lint__group">
            <h4>
              <StatusBadge status={g.status} label={`${g.list.length} ${g.status === 'risk' ? 'error' : 'warning'}${g.list.length === 1 ? '' : 's'}`} />
              <span className="sr-only">: {g.title}</span>
            </h4>
            <ul>
              {g.list.map((i, n) => (
                <li key={`${i.path}-${n}`}>
                  <code>{i.path}</code>
                  <span>{i.message}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

export function lintStatus(errors: number, warnings: number): { status: Status; label: string } {
  if (errors) return { status: 'risk', label: `${errors} error${errors === 1 ? '' : 's'}` };
  if (warnings) return { status: 'attention', label: `${warnings} warning${warnings === 1 ? '' : 's'}` };
  return { status: 'safe', label: 'Checks pass' };
}

/** Passcode sign-in for educators. Initials are optional and only label sign-offs and the activity log. */
export function SignInCard({ headingLevel = 2, onDone }: { headingLevel?: 2 | 3; onDone?: () => void }) {
  const [passcode, setPasscode] = useState('');
  const [initials, setInitials] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passId = useId();
  const initId = useId();
  const errId = useId();
  const H = headingLevel === 2 ? 'h2' : 'h3';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Enter the portal passcode.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(passcode, initials);
      setPasscode('');
      onDone?.();
    } catch (err) {
      setError(err instanceof PortalError ? err.message : 'Sign-in did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="portal-card portal-signin" onSubmit={(e) => void submit(e)} noValidate>
      <H className="portal-card__title">
        <Icon name="lock" /> Educator sign in
      </H>
      <p className="portal-muted">For the ShieldQuest team, educators and facilitators. There are no youth accounts.</p>
      <div className="portal-input">
        <label htmlFor={passId}>Portal passcode</label>
        <input
          id={passId}
          type="password"
          autoComplete="current-password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          required
        />
      </div>
      <div className="portal-input">
        <label htmlFor={initId}>
          Your initials <span className="portal-muted">(optional, for sign-offs, e.g. FT)</span>
        </label>
        <input
          id={initId}
          value={initials}
          onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 4))}
          autoComplete="off"
          inputMode="text"
          maxLength={4}
          pattern="[A-Za-z]{1,4}"
          className="portal-input--short"
        />
      </div>
      {error && (
        <p id={errId} className="portal-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" icon="lock" disabled={busy} block>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
      <p className="portal-fine">Signed-in sessions end after 8 hours or when you close this tab.</p>
    </form>
  );
}

/** Formats an ISO hour for display in the viewer's locale. */
export function formatHour(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
