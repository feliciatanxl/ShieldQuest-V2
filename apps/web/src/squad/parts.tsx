// Shared pieces for the squad clients: totems, role icons, connection banner, countdowns, QR codes.

import { useEffect, useState, type ReactNode } from 'react';
import { GAME, MOOD_LABEL, SQUAD_TOTEMS, type Mood, type SquadRoleId, type SquadTotemId } from '@shieldquest/shared';
import { Icon } from '../ui/Icon';
import { ROLE_ICON, clock, roleName, secondsLeft, totemPath } from './logic';
import { ERROR_TEXT, type ConnStatus, type SendError } from './socket';
import './squad.css';

// ---------------------------------------------------------------------------------------------
// Totems

export function TotemShape({ id, size = 28 }: { id: SquadTotemId; size?: number }) {
  const totem = SQUAD_TOTEMS.find((t) => t.id === id);
  const shape = totem?.shape ?? 'circle';
  const d = totemPath(shape);
  return (
    <svg
      className="sq-totem__shape"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ ['--sq-totem' as string]: totem?.color ?? 'var(--teal)' }}
    >
      {d ? <path d={d} /> : <circle cx="12" cy="12" r="9.5" />}
    </svg>
  );
}

/** Totem = shape + name (never colour alone). */
export function TotemBadge({ id, size = 28, suffix, className }: { id: SquadTotemId; size?: number; suffix?: ReactNode; className?: string }) {
  const totem = SQUAD_TOTEMS.find((t) => t.id === id);
  return (
    <span className={`sq-totem${className ? ` ${className}` : ''}`}>
      <TotemShape id={id} size={size} />
      <span className="sq-totem__name">
        {totem?.name ?? id}
        {suffix}
      </span>
    </span>
  );
}

export function RoleIcon({ role, label = true, size }: { role: SquadRoleId; label?: boolean; size?: string }) {
  return <Icon name={ROLE_ICON[role]} label={label ? roleName(role) : undefined} size={size} />;
}

// ---------------------------------------------------------------------------------------------
// Squad agreement (United / Mostly agree / Split): a dot pattern plus the word, never colour alone

function MoodGlyph({ mood }: { mood: Mood | null }) {
  // Three dots: together (United), two and one (Mostly agree), spread out (Split). Shape, not colour.
  const pos: Record<Mood, [number, number][]> = {
    united: [
      [16, 12],
      [24, 12],
      [20, 19],
    ],
    mostly: [
      [10, 13],
      [18, 13],
      [32, 13],
    ],
    split: [
      [6, 13],
      [20, 13],
      [34, 13],
    ],
  };
  if (!mood) return null;
  return (
    <svg className="sq-mood__glyph" viewBox="0 0 40 26" width="48" height="32" aria-hidden="true">
      {pos[mood].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4.5" />
      ))}
    </svg>
  );
}

export function MoodBadge({ mood }: { mood: Mood | null }) {
  return (
    <span className="sq-mood" data-mood={mood ?? 'none'}>
      <MoodGlyph mood={mood} />
      <span>{mood ? MOOD_LABEL[mood] : 'No seals yet'}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Connection

const STATUS_TEXT: Record<'seat' | 'staff', Partial<Record<ConnStatus, string>>> = {
  seat: {
    connecting: 'Connecting…',
    reconnecting: 'Reconnecting… your answers are safe.',
    offline: 'You are offline. Everything you did is kept; it sends when you are back.',
  },
  // Conductor and Big Screen: the session keeps running on the server while this device catches up.
  staff: {
    connecting: 'Connecting…',
    reconnecting: 'Reconnecting… the session carries on without this screen.',
    offline: 'This device is offline. The session carries on; this screen catches up when it is back.',
  },
};

/** Shown only when something is wrong, so a healthy session stays calm. */
export function ConnectionBanner({ status, pending = 0, staff }: { status: ConnStatus; pending?: number; staff?: boolean }) {
  const text = STATUS_TEXT[staff ? 'staff' : 'seat'][status];
  return (
    <div className="sq-conn" role="status" aria-live="polite" data-show={text ? '' : undefined} data-status={status}>
      {text && (
        <>
          <span className="sq-conn__dot" aria-hidden="true" />
          <span>{text}</span>
          {pending > 0 && <span className="sq-conn__pending">{pending} waiting to send</span>}
        </>
      )}
    </div>
  );
}

export function errorText(error: SendError | null | undefined): string {
  return error ? ERROR_TEXT[error] : '';
}

// ---------------------------------------------------------------------------------------------
// Time

/** "1:23 left" with a timer role. Hidden for Gentle mode (no countdown visuals). */
export function Countdown({ endsAt, now, label = 'left', hidden }: { endsAt: number | null; now: number; label?: string; hidden?: boolean }) {
  if (hidden || endsAt === null) return null;
  const s = secondsLeft(endsAt, now);
  return (
    <span className="sq-countdown" role="timer" aria-live="off" data-low={s <= 10 ? '' : undefined}>
      <Icon name="clock" />
      <span>
        {clock(s)} <span className="sq-countdown__word">{label}</span>
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Page furniture

export function Disclaimer({ className }: { className?: string }) {
  return <p className={`sq-disclaimer${className ? ` ${className}` : ''}`}>{GAME.disclaimer}</p>;
}

export function CenterCard({
  kicker,
  title,
  children,
  actions,
  tone,
}: {
  kicker?: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  tone?: 'calm' | 'warn';
}) {
  return (
    <div className="sq-center">
      <section className="sq-center__card" data-tone={tone} aria-labelledby="sq-center-title">
        {kicker && <p className="kicker">{kicker}</p>}
        <h1 id="sq-center-title" tabIndex={-1}>
          {title}
        </h1>
        {children}
        {actions && <div className="sq-center__actions">{actions}</div>}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// QR code (generated on the device: no network). The encoder is loaded on demand so phones joining a
// session never download it; only the Conductor and the Big Screen draw QR codes.

export function QrCode({ text, size = 240, label }: { text: string; size?: number; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import('qrcode')
      .then(({ toDataURL }) =>
        toDataURL(text, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: Math.max(256, size * 2),
          color: { dark: '#1d2440', light: '#ffffff' },
        }),
      )
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch(() => {
        if (alive) setUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [text, size]);
  return (
    <div className="sq-qr" style={{ width: size, height: size }}>
      {url ? <img src={url} alt={label} width={size} height={size} /> : <span className="sq-qr__wait" aria-hidden="true" />}
    </div>
  );
}

/** Room code split into two groups of three for reading aloud: "H7K Q2M". */
export function RoomCode({ code, className }: { code: string; className?: string }) {
  return (
    <span className={`sq-code${className ? ` ${className}` : ''}`} aria-label={`Room code ${code.split('').join(' ')}`}>
      <span aria-hidden="true">{code.slice(0, 3)}</span>
      <span aria-hidden="true">{code.slice(3)}</span>
    </span>
  );
}

/** Short join URL without the protocol, e.g. "metro.example/j/H7KQ2M". */
export function joinUrl(path: string): { full: string; short: string } {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return { full: `${origin}${path}`, short: `${origin.replace(/^https?:\/\//, '')}${path}` };
}
