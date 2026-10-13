import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import {
  ROOM_CODE_LENGTH,
  SQUAD_TOTEMS,
  isRoomCode,
  isSquadTotemId,
  joinPath,
  normalizeRoomCode,
  type OpenSeatsResponse,
  type SessionInfoResponse,
  type SquadTotemId,
} from '@shieldquest/shared';
import { Button, LinkButton } from '../ui/Button';
import { HelpButton } from '../ui/HelpPanel';
import { Icon } from '../ui/Icon';
import { LogoMark } from '../ui/Logo';
import { SettingsPanel } from '../ui/SettingsPanel';
import { useDocumentTitle } from './hooks';
import { CenterCard, Disclaimer, RoomCode, TotemBadge, TotemShape, errorText } from './parts';
import { SeatApp } from './seat/SeatApp';
import { connectSquad, disconnectSquad, forgetSeat, hasSeatToken, useSeatSnapshot, useSquad } from './socket';
import './join.css';

type Stage =
  | { kind: 'code'; error?: string }
  | { kind: 'checking'; code: string }
  | { kind: 'notice'; code: string; info: SessionInfoResponse }
  | { kind: 'reclaim'; code: string; info: SessionInfoResponse }
  | { kind: 'play'; code: string; squad?: SquadTotemId; reclaimSeatId?: string };

/** Parses /j/CODE and /j/CODE/totem (tent cards). */
function parsePath(location: string): { code: string; totem?: SquadTotemId } {
  const m = /^\/j\/([^/?#]+)(?:\/([^/?#]+))?/.exec(location);
  if (!m) return { code: '' };
  const code = normalizeRoomCode(decodeURIComponent(m[1] ?? ''));
  const t = (m[2] ?? '').toLowerCase();
  return { code, totem: isSquadTotemId(t) ? t : undefined };
}

async function fetchInfo(code: string): Promise<SessionInfoResponse | null> {
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(code)}`, { cache: 'no-store', headers: { accept: 'application/json' } });
    if (res.status === 404) return { exists: false };
    if (!res.ok) return null;
    return (await res.json()) as SessionInfoResponse;
  } catch {
    return null;
  }
}

/** /join and /j/:code — join a squad session from a phone: code, a short notice, then play. */
export default function JoinPage() {
  const [location, navigate] = useLocation();
  const fromPath = parsePath(location);
  const [stage, setStage] = useState<Stage>(() => (isRoomCode(fromPath.code) ? { kind: 'checking', code: fromPath.code } : { kind: 'code' }));
  const [totem, setTotem] = useState<SquadTotemId | null>(fromPath.totem ?? null);
  useDocumentTitle('Join a squad');

  // Leaving the page closes the connection (the seat is kept for a rejoin).
  useEffect(() => () => disconnectSquad(), []);

  const check = useCallback(
    async (code: string) => {
      setStage({ kind: 'checking', code });
      const info = await fetchInfo(code);
      if (!info) {
        setStage({ kind: 'code', error: 'We could not reach the game. Check the Wi-Fi, then try again.' });
        return;
      }
      if (!info.exists || info.phase === 'ended') {
        forgetSeat(code);
        setStage({ kind: 'code', error: 'No live session has that code. Check the big screen and try again.' });
        return;
      }
      if (location !== joinPath(code, fromPath.totem)) navigate(joinPath(code, fromPath.totem), { replace: true });
      // A phone that already has a seat here goes straight back in, even if joins are locked.
      if (hasSeatToken(code)) setStage({ kind: 'play', code });
      else setStage({ kind: 'notice', code, info });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, location],
  );

  const firstCheck = useRef(false);
  useEffect(() => {
    if (firstCheck.current) return;
    firstCheck.current = true;
    if (stage.kind === 'checking') void check(stage.code);
  }, [stage, check]);

  switch (stage.kind) {
    case 'code':
      return <CodeEntry initial={fromPath.code} error={stage.error} onSubmit={(c) => void check(c)} />;
    case 'checking':
      return (
        <JoinShell>
          <p className="sq-join__checking" role="status">
            <span className="sq-join__spinner" aria-hidden="true" /> Finding session <RoomCode code={stage.code} />…
          </p>
        </JoinShell>
      );
    case 'notice':
      return (
        <Notice
          code={stage.code}
          info={stage.info}
          totem={totem}
          onTotem={setTotem}
          onJoin={() => setStage({ kind: 'play', code: stage.code, squad: totem ?? undefined })}
          onReclaim={() => setStage({ kind: 'reclaim', code: stage.code, info: stage.info })}
          onBack={() => {
            navigate('/join', { replace: true });
            setStage({ kind: 'code' });
          }}
        />
      );
    case 'reclaim':
      return (
        <Reclaim
          code={stage.code}
          onPick={(seatId) => setStage({ kind: 'play', code: stage.code, reclaimSeatId: seatId })}
          onBack={() => setStage({ kind: 'notice', code: stage.code, info: stage.info })}
        />
      );
    case 'play':
      return (
        <Play
          key={`${stage.code}:${stage.squad ?? ''}:${stage.reclaimSeatId ?? ''}`}
          code={stage.code}
          squad={stage.squad}
          reclaimSeatId={stage.reclaimSeatId}
          onRetryWithoutSquad={() => setStage({ kind: 'play', code: stage.code })}
          onExit={() => {
            disconnectSquad();
            navigate('/join', { replace: true });
            setStage({ kind: 'code' });
          }}
        />
      );
  }
}

function JoinShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const [settings, setSettings] = useState(false);
  return (
    <main id="main" className="sq-join" data-wide={wide ? '' : undefined}>
      <header className="sq-join__head">
        <span className="sq-join__brand">
          <LogoMark size={30} />
          <span>
            Shield<b>Quest</b> <span className="sq-join__tag">Squad</span>
          </span>
        </span>
        <span className="sq-join__actions">
          <button type="button" className="ui-iconbtn" onClick={() => setSettings(true)} aria-label="Text size and comfort settings">
            <span aria-hidden="true">Aa</span>
          </button>
          <HelpButton />
        </span>
      </header>
      <div className="sq-join__body">{children}</div>
      <Disclaimer className="sq-join__disclaimer" />
      <SettingsPanel open={settings} onClose={() => setSettings(false)} />
    </main>
  );
}

// ---------------------------------------------------------------------------------------------
// 1. Code entry: big monospace, paste-friendly, no personal data

function CodeEntry({ initial, error, onSubmit }: { initial: string; error?: string; onSubmit: (code: string) => void }) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const code = normalizeRoomCode(value);
  const valid = isRoomCode(code);
  useEffect(() => {
    if (error) inputRef.current?.focus();
  }, [error]);

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    // Accept a pasted join link as well as a bare code.
    const text = e.clipboardData.getData('text');
    const fromLink = /\/j\/([A-Za-z0-9-]+)/.exec(text)?.[1];
    const next = normalizeRoomCode(fromLink ?? text).replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH);
    if (next) {
      e.preventDefault();
      setValue(next);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) onSubmit(code);
  };

  return (
    <JoinShell>
      <form className="sq-join__form" onSubmit={submit} noValidate>
        <h1 className="sq-join__title">Join your squad</h1>
        <p className="sq-join__lead">Type the 6-character code from the big screen. No sign-up, no names.</p>
        <label htmlFor="sq-code" className="sq-join__label">
          Session code
        </label>
        <input
          ref={inputRef}
          id="sq-code"
          className="sq-join__code"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g, '').slice(0, 9))}
          onPaste={onPaste}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={9}
          placeholder="H7KQ2M"
          aria-describedby="sq-code-hint sq-code-error"
          aria-invalid={error ? true : undefined}
          autoFocus={!initial}
        />
        <p id="sq-code-hint" className="sq-join__hint">
          Letters and numbers only. There is no letter O or I, and no 0 or 1.
        </p>
        <p id="sq-code-error" className="sq-join__error" role="alert">
          {error ?? ''}
        </p>
        <Button type="submit" size="lg" block iconRight="arrowRight" disabled={!valid}>
          Find my session
        </Button>
      </form>
      <p className="sq-join__alt">
        Playing on your own? <a href="/play">Explore the city solo</a>
      </p>
    </JoinShell>
  );
}

// ---------------------------------------------------------------------------------------------
// 2. Notice: no personal data, step out any time, disclaimer, totem

function Notice({
  code,
  info,
  totem,
  onTotem,
  onJoin,
  onReclaim,
  onBack,
}: {
  code: string;
  info: SessionInfoResponse;
  totem: SquadTotemId | null;
  onTotem: (t: SquadTotemId | null) => void;
  onJoin: () => void;
  onReclaim: () => void;
  onBack: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const squads = info.squads ?? [];
  const locked = info.acceptingJoins === false;
  return (
    <JoinShell>
      <section className="sq-notice" aria-labelledby="sq-notice-title">
        <p className="sq-notice__code">
          Session <RoomCode code={code} />
        </p>
        <h1 id="sq-notice-title" ref={headingRef} tabIndex={-1} className="sq-join__title">
          Before you join
        </h1>
        <ul className="sq-notice__list">
          <li>
            <Icon name="user" /> <span>You get a made-up name, like “Teal Kite”. Nobody types a real name.</span>
          </li>
          <li>
            <Icon name="lock" />{' '}
            <span>We never ask for anything personal, and nothing about you is stored. Please don’t share personal things in the game.</span>
          </li>
          <li>
            <Icon name="users" /> <span>Votes are secret. Your squad only sees counts, and the big screen never shows anyone’s choice.</span>
          </li>
          <li>
            <Icon name="door" /> <span>You can pause or step out any time. Pass is always OK.</span>
          </li>
          <li>
            <Icon name="heart" /> <span>If anything worries you, tap the heart for people who can help.</span>
          </li>
        </ul>

        {squads.length > 0 && !locked && (
          <fieldset className="sq-totems">
            <legend>Tap your table’s totem</legend>
            <div className="sq-totems__grid">
              <label className="sq-totems__opt">
                <input type="radio" name="sq-totem" checked={totem === null} onChange={() => onTotem(null)} />
                <span className="sq-totems__card">
                  <Icon name="spark" size="1.75rem" />
                  <span>Let the game choose</span>
                </span>
              </label>
              {SQUAD_TOTEMS.filter((t) => squads.some((s) => s.id === t.id)).map((t) => (
                <label key={t.id} className="sq-totems__opt">
                  <input type="radio" name="sq-totem" checked={totem === t.id} onChange={() => onTotem(t.id)} />
                  <span className="sq-totems__card">
                    <TotemShape id={t.id} size={36} />
                    <span>
                      {t.name} <span className="sr-only">({t.shape})</span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {totem && squads.length === 0 && (
          <p className="sq-notice__tent">
            Joining at the table of <TotemBadge id={totem} size={24} />
          </p>
        )}

        {locked ? (
          <p className="sq-join__error" role="alert">
            This session is not taking new players right now. Ask your facilitator.
          </p>
        ) : (
          <Button size="lg" block icon="users" onClick={onJoin}>
            I understand. Join
          </Button>
        )}
        <div className="sq-notice__more">
          <button type="button" className="sq-linkbtn" onClick={onReclaim}>
            New phone? Take back your seat
          </button>
          <button type="button" className="sq-linkbtn" onClick={onBack}>
            Use a different code
          </button>
        </div>
      </section>
    </JoinShell>
  );
}

// ---------------------------------------------------------------------------------------------
// Reclaim Seat: tap your old pseudonym (seats disconnected for a while); no identity needed

function Reclaim({ code, onPick, onBack }: { code: string; onPick: (seatId: string) => void; onBack: () => void }) {
  const [seats, setSeats] = useState<OpenSeatsResponse['seats'] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(code)}/open-seats`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      setSeats(((await res.json()) as OpenSeatsResponse).seats);
    } catch {
      setFailed(true);
    }
  }, [code]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <JoinShell>
      <section aria-labelledby="sq-reclaim-title">
        <h1 id="sq-reclaim-title" className="sq-join__title" tabIndex={-1}>
          Take back your seat
        </h1>
        <p className="sq-join__lead">Pick your made-up name. Seats appear here after their phone has been away for 30 seconds.</p>
        {failed && (
          <p className="sq-join__error" role="alert">
            Could not load seats. Check the Wi-Fi.
          </p>
        )}
        {seats === null && !failed && <p role="status">Looking for open seats…</p>}
        {seats && seats.length === 0 && <p role="status">No open seats right now. If your old phone is still on, close the game there first.</p>}
        {seats && seats.length > 0 && (
          <ul className="sq-reclaim">
            {seats.map((s) => (
              <li key={s.seatId}>
                <button type="button" className="sq-reclaim__seat" onClick={() => onPick(s.seatId)}>
                  <TotemShape id={s.squadId} size={28} />
                  <span>
                    <strong>{s.pseudonym}</strong>
                    <small>{SQUAD_TOTEMS.find((t) => t.id === s.squadId)?.name}</small>
                  </span>
                  <Icon name="arrowRight" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="sq-notice__more">
          <Button variant="secondary" icon="rewind" onClick={() => void load()}>
            Refresh
          </Button>
          <Button variant="ghost" icon="arrowLeft" onClick={onBack}>
            Back
          </Button>
        </div>
      </section>
    </JoinShell>
  );
}

// ---------------------------------------------------------------------------------------------
// 3. Play: connect and hand over to the seat UI

function Play({
  code,
  squad,
  reclaimSeatId,
  onRetryWithoutSquad,
  onExit,
}: {
  code: string;
  squad?: SquadTotemId;
  reclaimSeatId?: string;
  onRetryWithoutSquad: () => void;
  onExit: () => void;
}) {
  const snap = useSeatSnapshot();
  const status = useSquad((s) => s.status);
  const error = useSquad((s) => s.error);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const close = connectSquad({ audience: 'seat', code, squad, reclaimSeatId });
    return close;
  }, [code, squad, reclaimSeatId, attempt]);

  if (status === 'failed') {
    const fixable = error === 'joins-locked' || error === 'session-full' || error === 'seat-taken';
    return (
      <JoinShell>
        <CenterCard kicker="Squad" title={error === 'seat-taken' ? 'This seat moved' : 'Could not join'} tone="warn">
          <p role="alert">{error === 'seat-taken' ? 'Your seat is open on another phone or tab now. Use that one, or join again here.' : errorText(error)}</p>
          <div className="sq-center__actions">
            {error === 'squad-full' && (
              <Button icon="spark" onClick={onRetryWithoutSquad}>
                Let the game choose
              </Button>
            )}
            {fixable && (
              <Button icon="rewind" onClick={() => setAttempt((a) => a + 1)}>
                Try again
              </Button>
            )}
            {error === 'seat-taken' && (
              <Button
                variant="secondary"
                onClick={() => {
                  forgetSeat(code);
                  setAttempt((a) => a + 1);
                }}
              >
                Join as a new seat
              </Button>
            )}
            <Button variant="ghost" icon="arrowLeft" onClick={onExit}>
              Enter a different code
            </Button>
          </div>
        </CenterCard>
      </JoinShell>
    );
  }

  if (!snap) {
    return (
      <JoinShell>
        <p className="sq-join__checking" role="status">
          <span className="sq-join__spinner" aria-hidden="true" />
          {status === 'reconnecting' || status === 'offline' ? 'Waiting for the connection…' : 'Joining your squad…'}
        </p>
        {(status === 'reconnecting' || status === 'offline') && (
          <p className="sq-join__lead">School Wi-Fi can be slow. Keep this page open; it keeps trying.</p>
        )}
        <div className="sq-notice__more">
          <LinkButton href="/" variant="ghost" icon="arrowLeft">
            Home
          </LinkButton>
        </div>
      </JoinShell>
    );
  }

  return <SeatApp snap={snap} onLeave={onExit} />;
}
