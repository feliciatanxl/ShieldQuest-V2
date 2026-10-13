// Small building blocks for Calibration screens: paper message cards, option rows and the big code display.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AssessmentMessage, MessageChannel } from '@shieldquest/shared';
import { Icon, type IconName } from '../ui/Icon';

export const CHANNELS: Record<MessageChannel, { label: string; icon: IconName }> = {
  sms: { label: 'Text message', icon: 'phone' },
  chat: { label: 'Chat', icon: 'chat' },
  email: { label: 'Email', icon: 'envelope' },
  app: { label: 'App notification', icon: 'info' },
  game: { label: 'In-game message', icon: 'spark' },
};

// Fictional links (".test" / ".example") are styled like links so they read as real messages, but never navigate.
const LINK_RE = /([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:test|example)(?:\/[^\s,]*)?)/gi;

export function MessageText({ text }: { text: string }) {
  const parts = text.split(LINK_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className="assess-msg__link">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}

interface MessageCardProps {
  message: Pick<AssessmentMessage, 'channel' | 'from'>;
  /** Big letter shown on Twin pair cards ("A" / "B"). */
  letter?: string;
  id?: string;
  children: ReactNode;
  /** Badge shown in the card's header (e.g. "My pick: scam"). */
  badge?: ReactNode;
}

/** A fictional message on a paper card. Built from spans so it can sit inside a <label>. */
export function MessageCard({ message, letter, id, children, badge }: MessageCardProps) {
  const ch = CHANNELS[message.channel];
  return (
    <span className={`assess-msg assess-msg--${message.channel}`} id={id}>
      <span className="assess-msg__head">
        {letter && (
          <span className="assess-msg__letter" aria-hidden="true">
            {letter}
          </span>
        )}
        <span className="assess-msg__channel">
          <Icon name={ch.icon} />
          {ch.label}
        </span>
        {badge}
      </span>
      <span className="assess-msg__from">
        <span className="sr-only">From </span>
        {message.from}
      </span>
      <span className="assess-msg__body">{children}</span>
    </span>
  );
}

interface OptionProps {
  type: 'radio' | 'checkbox';
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
  /** Leading mark (e.g. a letter); defaults to a radio dot or checkbox tick. */
  mark?: ReactNode;
  className?: string;
}

/**
 * One answer option: a native radio or checkbox (so arrow keys, Space and screen readers just work)
 * dressed as a large tappable card. The tick shape marks the choice, never colour alone.
 */
export function Option({ type, name, value, checked, onChange, children, mark, className }: OptionProps) {
  return (
    <label className={`assess-opt assess-opt--${type}${checked ? ' is-on' : ''}${className ? ` ${className}` : ''}`}>
      <input className="assess-opt__input" type={type} name={name} value={value} checked={checked} onChange={onChange} />
      {mark ?? (
        <span className="assess-opt__tick" aria-hidden="true">
          {checked && <Icon name="check" size="1em" />}
        </span>
      )}
      <span className="assess-opt__text">{children}</span>
      {/* A custom mark (letter, number) only changes colour, so a tick confirms the choice by shape too. */}
      {mark && checked && <Icon name="check" className="assess-opt__check" />}
    </label>
  );
}

/** "KAYA-7K2" read out letter by letter, so a screen reader user can copy it down. */
export const spellCode = (code: string): string =>
  code
    .split('')
    .map((c) => (c === '-' ? 'dash' : c))
    .join(' ');

/** The participant's random code, shown big with a copy button. */
export function CodeDisplay({ code, size = 'lg' }: { code: string; size?: 'lg' | 'md' }) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied('idle'), 4000);
  }

  return (
    <div className={`assess-code assess-code--${size}`}>
      <p className="assess-code__value">
        <span aria-hidden="true">{code}</span>
        <span className="sr-only">{spellCode(code)}</span>
      </p>
      {size === 'lg' && (
        <button type="button" className="assess-code__copy" onClick={copy}>
          <Icon name={copied === 'ok' ? 'check' : 'book'} />
          <span>{copied === 'ok' ? 'Copied' : 'Copy code'}</span>
        </button>
      )}
      <p className="assess-code__status" role="status">
        {copied === 'ok' && 'Code copied. Paste it into your notes app too, if you like.'}
        {copied === 'fail' && 'Copying is blocked on this device. Write the code down or take a screenshot.'}
      </p>
    </div>
  );
}

/** Thin progress bar with a visible "4 / 14" count. */
export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="assess-progress">
      <div
        className="assess-progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value} of ${max}`}
      >
        <span className="assess-progress__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="assess-progress__count" aria-hidden="true">
        {value} / {max}
      </span>
    </div>
  );
}

/** Icon row used by the privacy notice. */
export function PrivacyPoint({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <li className="assess-promise">
      <span className="assess-promise__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <span>
        <strong>{title}</strong>
        <span className="assess-promise__text">{children}</span>
      </span>
    </li>
  );
}
