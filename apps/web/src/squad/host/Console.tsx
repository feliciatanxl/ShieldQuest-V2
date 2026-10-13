import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import {
  HOLD_BUCKETS,
  ROOM_MIN_N,
  SESSION_OPTION_KEYS,
  SQUAD_LIMITS,
  SQUAD_TOTEMS,
  missionById,
  type ChoiceCount,
  type HostCommand,
  type HostSnapshot,
  type Mission,
  type SessionOptionKey,
  type SquadMissionPhase,
} from '@shieldquest/shared';
import { Button, LinkButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { StatusBadge, type Status } from '../../ui/StatusBadge';
import { useDocumentTitle, useWakeLock } from '../hooks';
import { PHASE_LABEL, PHASE_SCRIPT, SESSION_PHASE_LABEL, clock, nextAction, pacing, secondsLeft, unquote } from '../logic';
import { CenterCard, ConnectionBanner, QrCode, RoomCode, TotemShape, joinUrl } from '../parts';
import {
  ERROR_TEXT,
  connectSquad,
  forgetHostKey,
  hostCommand,
  loadHostKey,
  saveHostKey,
  serverNow,
  useHostSnapshot,
  useServerNow,
  useSquad,
} from '../socket';
import { DashPanel } from '../dash/DashPanel';
import { dashClockSec, dashStageLabel } from '../dash/dashLogic';
import { ConductorHeader } from './ConductorHeader';
import { ProbeCheck } from './ProbeCheck';
import { SquadCard } from './SquadCard';

const OPTION_LABEL: Record<SessionOptionKey, { label: string; hint: string }> = {
  gentle: { label: 'Gentle mode', hint: 'No surges, no countdown visuals' },
  discreet: { label: 'Discreet projector', hint: 'Class-level effects only' },
  calm: { label: 'Calm mode', hint: 'Slower timers, softer audio' },
  relaxed: { label: 'Relaxed timing', hint: '1.5× for new phases' },
  autoAdvance: { label: 'Auto-advance', hint: 'Move on when all are ready' },
};

const SAFETY_STATUS: Record<Mission['choices'][number]['safety'], Status> = { safe: 'safe', unsure: 'attention', risky: 'risk' };

function isTyping(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/** Reads a key handed over in the URL fragment (#k=…, never sent to the server) and removes it from the address bar. */
function takeKeyFromHash(code: string): void {
  const m = /[#&]k=([A-Za-z0-9_-]{16,128})/.exec(window.location.hash);
  if (!m?.[1]) return;
  saveHostKey(code, m[1]);
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

/** /host/:code — the Conductor console. */
export function Console({ code }: { code: string }) {
  const [hostKey, setHostKey] = useState<string | null>(() => {
    takeKeyFromHash(code);
    return loadHostKey(code);
  });
  const status = useSquad((s) => s.status);
  const error = useSquad((s) => s.error);
  const snap = useHostSnapshot();
  useDocumentTitle(`Conductor · ${code}`);

  useEffect(() => {
    if (!hostKey) return;
    return connectSquad({ audience: 'host', code, hostKey });
  }, [code, hostKey]);

  useEffect(() => {
    if (status === 'failed' && error === 'unauthorized') {
      forgetHostKey(code);
      setHostKey(null);
    }
  }, [status, error, code]);

  if (!hostKey) return <KeyNeeded code={code} onKey={(k) => (saveHostKey(code, k), setHostKey(k))} wrong={error === 'unauthorized'} />;
  if (status === 'failed') {
    return (
      <div className="sq-host">
        <ConductorHeader />
        <CenterCard kicker="Conductor" title={error === 'ended' || error === 'not-found' ? 'This session has ended' : 'Could not open the console'} tone="warn">
          <p>{error ? ERROR_TEXT[error] : ''}</p>
          <div className="sq-center__actions">
            <LinkButton href="/host" icon="play">
              Create a new session
            </LinkButton>
          </div>
        </CenterCard>
      </div>
    );
  }
  if (!snap) {
    return (
      <div className="sq-host">
        <ConductorHeader />
        <p className="sq-host__loading" role="status">
          Opening the console for <RoomCode code={code} />…
        </p>
      </div>
    );
  }
  return <ConsoleView snap={snap} hostKey={hostKey} />;
}

function KeyNeeded({ code, onKey, wrong }: { code: string; onKey: (k: string) => void; wrong: boolean }) {
  const [value, setValue] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const k = value.trim();
    if (k.length >= 16) onKey(k);
  };
  return (
    <div className="sq-host">
      <ConductorHeader />
      <CenterCard kicker={`Session ${code}`} title="This console needs its Conductor key">
        <p>
          The key stays in the browser tab that created the session. To run it from this device, scan the “Pair another device” QR on
          the original console, or paste the key below.
        </p>
        {wrong && (
          <p className="sq-error" role="alert">
            That key did not match this session.
          </p>
        )}
        <form onSubmit={submit} className="sq-keyform">
          <label htmlFor="sq-hostkey">Conductor key</label>
          <input id="sq-hostkey" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" spellCheck={false} />
          <Button type="submit" disabled={value.trim().length < 16}>
            Open console
          </Button>
        </form>
        <div className="sq-center__actions">
          <LinkButton href="/host" variant="secondary" icon="play">
            Create a new session instead
          </LinkButton>
        </div>
      </CenterCard>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function ConsoleView({ snap, hostKey }: { snap: HostSnapshot; hostKey: string }) {
  const { session, room, squads } = snap;
  const [, navigate] = useLocation();
  const status = useSquad((s) => s.status);
  const pending = useSquad((s) => s.pending);
  const now = useServerNow(500);
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'skip' | 'end'>(null);
  const [shortcuts, setShortcuts] = useState(false);
  const [busy, setBusy] = useState(false);
  useWakeLock(session.phase !== 'ended');

  // Pacing starts when Mission 1 opens; kept for this tab only.
  const firstKey = `sq.host.first:${session.code}`;
  const [firstMissionAt, setFirstMissionAt] = useState<number | null>(() => {
    try {
      const v = Number(sessionStorage.getItem(firstKey));
      return Number.isFinite(v) && v > 0 ? v : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (firstMissionAt !== null || session.missionIndex !== 0 || !session.timeline) return;
    const at = session.timeline.openedAt;
    setFirstMissionAt(at);
    try {
      sessionStorage.setItem(firstKey, String(at));
    } catch {
      // Ignore.
    }
  }, [firstMissionAt, session.missionIndex, session.timeline, firstKey]);

  const run = useCallback(async (cmd: HostCommand, ok?: string) => {
    setBusy(true);
    const res = await hostCommand(cmd);
    setBusy(false);
    if (!res.ok) setToast(ERROR_TEXT[res.error]);
    else if (ok) setToast(ok);
  }, []);
  const command = useCallback((cmd: HostCommand) => void run(cmd), [run]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const openScreen = useCallback(() => {
    window.open(snap.session.screenPath, `sq-screen-${session.code}`, 'noopener');
  }, [snap.session.screenPath, session.code]);

  const next = nextAction(snap);
  const ended = session.phase === 'ended';
  const pause = useCallback(() => command(session.paused ? { type: 'resume' } : { type: 'pause' }), [command, session.paused]);

  // Keyboard: N next, P freeze/unfreeze phones, E +30 s, B Big Screen, L lock joins, ? shortcuts.
  const keyRef = useRef({ next: () => command({ type: 'next' }), pause, openScreen, lock: () => undefined as void });
  keyRef.current = {
    next: () => command({ type: 'next' }),
    pause,
    openScreen,
    lock: () => command({ type: 'lockJoins', locked: session.acceptingJoins }),
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || document.querySelector('dialog[open]')) return;
      const k = e.key.toLowerCase();
      if (k === 'n') keyRef.current.next();
      else if (k === 'p') keyRef.current.pause();
      else if (k === 'e') void hostCommand({ type: 'extend', sec: 30 });
      else if (k === 'b') keyRef.current.openScreen();
      else if (k === 'l') keyRef.current.lock();
      else if (e.key === '?') setShortcuts(true);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const join = joinUrl(session.joinPath);
  const pace = pacing(snap, firstMissionAt, now);
  const mission = session.missionIndex !== null ? missionById(session.missionIds[session.missionIndex] ?? '') : undefined;
  const phases = squads.map((s) => s.phase).filter((p): p is SquadMissionPhase => p !== null);
  const mainPhase = phases[0] ?? null;
  const tl = session.timeline;
  const syncedEnd = tl && mainPhase === 'role-flip' ? tl.liveAt : tl && mainPhase === 'live' ? tl.liveEndsAt : tl && mainPhase === 'aftershock' ? tl.roleFlipAt : null;
  const dash = snap.dash ?? null;
  const dashLeft = dash ? dashClockSec(dash, now, session.paused) : null;

  return (
    <div className="sq-host" data-paused={session.paused ? '' : undefined}>
      <ConnectionBanner status={status} pending={pending} staff />
      <ConductorHeader>
        <span className="sq-chead__code">
          <RoomCode code={session.code} />
        </span>
        <span className="sq-chead__status" data-status={status}>
          <span className="sq-dot" data-on={status === 'online' ? '' : undefined} aria-hidden="true" />
          {status === 'online' ? 'Live' : status}
        </span>
        <Button size="sm" variant="secondary" icon="external" onClick={openScreen}>
          Open Big Screen
        </Button>
        <button type="button" className="ui-iconbtn" onClick={() => setShortcuts(true)} aria-label="Keyboard shortcuts">
          <span aria-hidden="true">?</span>
        </button>
      </ConductorHeader>

      <main id="main" className="sq-console">
        {/* ---- Control bar ---- */}
        <section className="sq-ctrl" aria-labelledby="sq-ctrl-title">
          <div className="sq-ctrl__now">
            <p className="sq-ctrl__kicker">
              {mission && session.phase === 'mission'
                ? `Mission ${(session.missionIndex ?? 0) + 1} of ${session.missionIds.length}: ${mission.title}`
                : SESSION_PHASE_LABEL[session.phase]}
              {session.paused ? ' · Phones frozen' : ''}
            </p>
            <h1 id="sq-ctrl-title" className="sq-ctrl__title">
              {dash ? (
                <>
                  Squad Dash · {dashStageLabel(dash)}
                  {dashLeft !== null && <span className="sq-ctrl__clock">{clock(dashLeft)}</span>}
                </>
              ) : session.phase === 'mission' && !session.missionComplete && mainPhase
                ? squadsSummary(phases)
                : session.phase === 'mission' && session.missionComplete
                  ? 'Mission complete: Look Up time'
                  : SESSION_PHASE_LABEL[session.phase]}
              {!dash && syncedEnd !== null && !session.paused && <span className="sq-ctrl__clock">{clock(secondsLeft(syncedEnd, now))}</span>}
            </h1>
          </div>
          <div className="sq-ctrl__main">
            <Button size="lg" icon="arrowRight" disabled={ended || busy} onClick={() => command({ type: 'next' })} aria-describedby="sq-next-hint">
              {next.label}
            </Button>
            <p id="sq-next-hint" className="sq-ctrl__hint">
              {next.hint} <kbd>N</kbd>
            </p>
          </div>
          <div className="sq-ctrl__row" role="group" aria-label="Session controls">
            <button type="button" className="sq-cbtn" disabled={(dash ? dashLeft === null : !tl) || ended} onClick={() => command({ type: 'extend', sec: 30 })}>
              <Icon name="clock" /> +30 s <kbd>E</kbd>
            </button>
            <button type="button" className="sq-cbtn" aria-pressed={session.paused} disabled={ended} onClick={pause}>
              <Icon name={session.paused ? 'play' : 'pause'} /> {session.paused ? 'Unfreeze phones' : 'Freeze all phones'} <kbd>P</kbd>
            </button>
            {session.phase === 'mission' && !session.missionComplete && (
              <button type="button" className="sq-cbtn sq-cbtn--warn" onClick={() => setConfirm('skip')}>
                <Icon name="close" /> Skip scenario
              </button>
            )}
            {session.phase === 'lobby' && !session.roomFreeze.done && (
              <button type="button" className="sq-cbtn" onClick={() => command({ type: 'startRoomFreeze' })}>
                <Icon name="spark" /> Room Freeze
              </button>
            )}
            {session.phase === 'room-freeze' && (
              <button type="button" className="sq-cbtn" onClick={() => command({ type: 'endRoomFreeze' })}>
                <Icon name="check" /> End Room Freeze
              </button>
            )}
            {!ended && (
              <button type="button" className="sq-cbtn sq-cbtn--warn" onClick={() => setConfirm('end')}>
                <Icon name="door" /> {session.phase === 'debrief' ? 'End session' : 'Go to debrief'}
              </button>
            )}
          </div>
          {session.phase === 'mission' && (
            <p className={`sq-pace sq-pace--${pace.state}`} role="status">
              <Icon name="clock" /> {pace.message}
            </p>
          )}
          {mainPhase && session.phase === 'mission' && !session.missionComplete && (
            <p className="sq-script">
              <strong>Say:</strong> {PHASE_SCRIPT[mainPhase]}
            </p>
          )}
        </section>

        {ended && (
          <section className="sq-panel sq-panel--wide sq-panel--ended" aria-labelledby="sq-ended-title">
            <h2 id="sq-ended-title" className="sq-panel__title">
              Session ended
            </h2>
            <p>Thank you. Only anonymous counts were kept for the impact report. No seat, name or vote link survives.</p>
            <Button icon="play" onClick={() => navigate('/host')}>
              New session
            </Button>
          </section>
        )}
        {snap.debrief && <DebriefView snap={snap} />}
        {dash && <DashPanel snap={snap} now={now} command={command} busy={busy} />}
        <div className="sq-console__main">
          {/* ---- Squads ---- */}
          <section className="sq-panel sq-squadspanel" aria-labelledby="sq-squads-title">
            <h2 id="sq-squads-title" className="sq-panel__title">
              Squads <small>{squads.length === 0 ? 'Squads appear as phones join' : `${squads.length} squads · made-up names only`}</small>
            </h2>
            <div className="sq-grid">
              {squads.map((sq) => (
                <SquadCard key={sq.id} squad={sq} snap={snap} now={now} command={command} />
              ))}
            </div>
          </section>

          {/* ---- Room ---- */}
          <section className="sq-panel" aria-labelledby="sq-room-title">
            <h2 id="sq-room-title" className="sq-panel__title">
              Room
            </h2>
            <dl className="sq-roomstats">
              <div>
                <dt>Lanterns lit</dt>
                <dd>{room.lanterns}</dd>
              </div>
              <div>
                <dt>Holds made</dt>
                <dd>{room.holdsMade}</dd>
              </div>
              <div>
                <dt>Minds changed towards safer</dt>
                <dd>{room.mindsChangedSafer}</dd>
              </div>
              <div>
                <dt>Room Freeze peak</dt>
                <dd>{Math.round(room.roomFreeze.peak * 100)}%</dd>
              </div>
              <div>
                <dt>Asking for help</dt>
                <dd>
                  {room.needHelp}
                  {room.needHelp > 0 && (
                    <button type="button" className="sq-linkbtn" onClick={() => command({ type: 'clearHelp' })}>
                      Clear all
                    </button>
                  )}
                </dd>
              </div>
              <div>
                <dt>On a break</dt>
                <dd>{room.onBreak}</dd>
              </div>
              {session.phase === 'debrief' && (
                <div>
                  <dt>“I see it differently”</dt>
                  <dd>{room.seeDifferently}</dd>
                </div>
              )}
            </dl>
            <HoldBucketsView buckets={room.holdBuckets} />
            <RoomVotesView snap={snap} />
          </section>

        </div>
        <div className="sq-console__side">
          {/* ---- Join ---- */}
          <section className="sq-panel sq-joinpanel" aria-labelledby="sq-join-title">
            <h2 id="sq-join-title" className="sq-panel__title">
              Join
            </h2>
            <div className="sq-joinpanel__body">
              <QrCode text={join.full} size={168} label={`QR code to join session ${session.code}`} />
              <div>
                <RoomCode code={session.code} className="sq-joinpanel__code" />
                <p className="sq-joinpanel__url">{join.short}</p>
                <p className="sq-joinpanel__count">
                  <Icon name="phone" /> {room.connected} of {room.seats} phones connected
                </p>
                <label className="sq-toggle sq-toggle--inline">
                  <input type="checkbox" checked={!session.acceptingJoins} onChange={(e) => command({ type: 'lockJoins', locked: e.target.checked })} />
                  <span className="sq-toggle__text">
                    <strong>Lock joins</strong> <small>Known phones can still rejoin</small>
                  </span>
                </label>
              </div>
            </div>
            {session.phase === 'lobby' && (
              <div className="sq-ctrl__row">
                <button type="button" className="sq-cbtn" disabled={squads.length >= SQUAD_LIMITS.maxSquads} onClick={() => command({ type: 'addSquad' })}>
                  <Icon name="users" /> Add a squad
                </button>
                <button type="button" className="sq-cbtn" disabled={squads.length < 2} onClick={() => command({ type: 'balanceSquads' }, )}>
                  <Icon name="spark" /> Even out squads
                </button>
              </div>
            )}
            <details className="sq-details">
              <summary>Pre-flight: network check</summary>
              <ProbeCheck />
            </details>
            <TentCards code={session.code} count={snap.config.squadCount ?? SQUAD_LIMITS.maxSquads} />
            <PairDevice code={session.code} hostKey={hostKey} />
          </section>

          {/* ---- Squad Dash (start) ---- */}
          {!dash && !ended && session.phase !== 'debrief' && <DashPanel snap={snap} now={now} command={command} busy={busy} />}

          {/* ---- Playlist ---- */}
          <section className="sq-panel" aria-labelledby="sq-playlist-title">
            <h2 id="sq-playlist-title" className="sq-panel__title">
              Missions
            </h2>
            <ol className="sq-playlist">
              {session.missionIds.map((id, i) => {
                const m = missionById(id);
                const current = session.missionIndex === i;
                const done = session.missionIndex !== null && i < session.missionIndex;
                return (
                  <li key={id} data-current={current ? '' : undefined} data-done={done ? '' : undefined}>
                    <span className="sq-playlist__n">{i + 1}</span>
                    <span className="sq-playlist__title">
                      {m?.title ?? id}
                      <small>{m ? `${m.scaffold === 'wildcard' ? 'Wildcard Sprint' : m.scaffold === 'light' ? 'Light' : 'Guided'} · ${m.theme}` : ''}</small>
                    </span>
                    {current && !session.missionComplete ? (
                      <span className="sq-tag">Playing</span>
                    ) : (
                      <button
                        type="button"
                        className="sq-cbtn"
                        disabled={session.phase !== 'lobby' && !(session.phase === 'mission' && session.missionComplete)}
                        onClick={() => command({ type: 'startMission', index: i })}
                      >
                        <Icon name="play" /> {done || (current && session.missionComplete) ? 'Play again' : 'Start'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          {/* ---- Options ---- */}
          <section className="sq-panel" aria-labelledby="sq-options-title">
            <h2 id="sq-options-title" className="sq-panel__title">
              Options
            </h2>
            {SESSION_OPTION_KEYS.map((key) => (
              <label key={key} className="sq-toggle">
                <input type="checkbox" checked={snap.config[key]} onChange={(e) => command({ type: 'setOption', key, value: e.target.checked })} />
                <span className="sq-toggle__text">
                  <strong>{OPTION_LABEL[key].label}</strong>
                  <small>{OPTION_LABEL[key].hint}</small>
                </span>
              </label>
            ))}
          </section>

        </div>
      </main>

      {toast && (
        <p className="sq-toast" role="status">
          {toast}
        </p>
      )}

      <Sheet open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === 'skip' ? 'Skip this scenario?' : session.phase === 'debrief' ? 'End the session?' : 'Go to the debrief?'}>
        {confirm === 'skip' ? (
          <p>The mission ends now for every squad. Use this if the content is not right for the room today. Nobody is told why.</p>
        ) : session.phase === 'debrief' ? (
          <p>The room closes. Phones show the closing card and the check-out link. Only anonymous counts are kept.</p>
        ) : (
          <p>The Long Fast-Forward lands every remaining Seed on the phones, then the debrief opens on the Big Screen.</p>
        )}
        <div className="sq-sheet-actions">
          <Button variant="secondary" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const c = confirm;
              setConfirm(null);
              if (c === 'skip') command({ type: 'endMission' });
              else command({ type: 'endSession' });
            }}
          >
            {confirm === 'skip' ? 'Skip scenario' : session.phase === 'debrief' ? 'End session' : 'Open debrief'}
          </Button>
        </div>
      </Sheet>

      <Sheet open={shortcuts} onClose={() => setShortcuts(false)} title="Keyboard shortcuts">
        <dl className="sq-keys">
          <div>
            <dt>
              <kbd>N</kbd>
            </dt>
            <dd>Next (the one big button)</dd>
          </div>
          <div>
            <dt>
              <kbd>P</kbd>
            </dt>
            <dd>Freeze or unfreeze all phones</dd>
          </div>
          <div>
            <dt>
              <kbd>E</kbd>
            </dt>
            <dd>+30 s for every squad</dd>
          </div>
          <div>
            <dt>
              <kbd>B</kbd>
            </dt>
            <dd>Open the Big Screen</dd>
          </div>
          <div>
            <dt>
              <kbd>L</kbd>
            </dt>
            <dd>Lock or unlock joins</dd>
          </div>
        </dl>
      </Sheet>
    </div>
  );
}

/** "Explain (3) · Re-seal (1)": where the squads are. */
function squadsSummary(phases: SquadMissionPhase[]): string {
  const counts = new Map<SquadMissionPhase, number>();
  for (const p of phases) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts.entries()].map(([p, n]) => (counts.size === 1 ? PHASE_LABEL[p] : `${PHASE_LABEL[p]} (${n})`)).join(' · ');
}

function HoldBucketsView({ buckets }: { buckets: HostSnapshot['room']['holdBuckets'] }) {
  const total = HOLD_BUCKETS.reduce((s, b) => s + buckets[b], 0);
  if (total === 0) return null;
  const label: Record<(typeof HOLD_BUCKETS)[number], string> = { '0-5': '0-5 s', '5-15': '5-15 s', '15-30': '15-30 s', '30+': '30 s+', late: 'Late' };
  return (
    <div className="sq-buckets">
      <p className="sq-buckets__title">When phones held (this mission)</p>
      <ul>
        {HOLD_BUCKETS.map((b) => (
          <li key={b}>
            <span className="sq-buckets__label">{label[b]}</span>
            <span className="sq-buckets__bar" style={{ ['--w' as string]: `${(buckets[b] / total) * 100}%` }} aria-hidden="true" />
            <span className="sq-buckets__n">{buckets[b]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Room-level vote counts: Conductor only, never shown to students, and only at n >= 5 from 2+ squads. */
function RoomVotesView({ snap }: { snap: HostSnapshot }) {
  const votes = snap.room.votes;
  const mission = votes ? missionById(votes.missionId) : undefined;
  return (
    <div className="sq-votes">
      <p className="sq-votes__title">
        <Icon name="lock" /> Room votes <span className="sq-tag">Conductor only · not shown to students</span>
      </p>
      {!votes || !mission || (!votes.first && !votes.final) ? (
        <p className="sq-votes__empty">Room counts appear once at least {ROOM_MIN_N} votes from 2 or more decided squads are in.</p>
      ) : (
        <table className="sq-votes__table">
          <thead>
            <tr>
              <th scope="col">Exit</th>
              <th scope="col">First seal</th>
              <th scope="col">Final</th>
            </tr>
          </thead>
          <tbody>
            {mission.choices.map((c) => (
              <tr key={c.id}>
                <th scope="row">
                  <StatusBadge status={SAFETY_STATUS[c.safety]} /> {c.label}
                </th>
                <td>{countFor(votes.first, c.id)}</td>
                <td>{countFor(votes.final, c.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const countFor = (counts: ChoiceCount[] | null, id: string): string => {
  if (!counts) return '—';
  return String(counts.find((c) => c.choiceId === id)?.n ?? 0);
};

function DebriefView({ snap }: { snap: HostSnapshot }) {
  const d = snap.debrief!;
  return (
    <section className="sq-panel sq-panel--wide" aria-labelledby="sq-debrief-title">
      <h2 id="sq-debrief-title" className="sq-panel__title">
        Debrief prompts <small>Room level, positive trends only</small>
      </h2>
      <div className="sq-debriefgrid">
        {d.missions.map((m) => {
          const mission = missionById(m.missionId);
          const missed = mission
            ? mission.clues.filter((c) => c.redFlag).sort((a, b) => (m.clueFinds[a.id] ?? 0) - (m.clueFinds[b.id] ?? 0))[0]
            : undefined;
          return (
            <article key={m.missionId} className="sq-debriefcard">
              <h3>{mission?.title ?? m.missionId}</h3>
              <ul>
                <li>Holds made: {m.holdsMade}</li>
                <li>
                  Seen live {m.liveFlags} · found while holding {m.heldFlags}
                </li>
                <li>Minds changed towards safer: {m.mindsChangedSafer}</li>
                <li>
                  Forecasts that saw it coming: {m.forecastLikely} of {m.forecastTotal}
                </li>
                {missed && (
                  <li>
                    Most-missed sign: <q>{unquote(missed.label)}</q> ({m.clueFinds[missed.id] ?? 0} of {m.squads} squads)
                  </li>
                )}
              </ul>
              <p className="sq-script">
                <strong>Ask:</strong> “What would you actually say to a friend in this spot?”
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Print: totem tent cards (QR to /j/CODE/totem)

function TentCards({ code, count }: { code: string; count: number }) {
  const [show, setShow] = useState(false);
  const totems = SQUAD_TOTEMS.slice(0, Math.max(SQUAD_LIMITS.minSquads, Math.min(count, SQUAD_TOTEMS.length)));
  useEffect(() => {
    if (!show) return;
    // Give the QR images a moment to render before the print dialog opens.
    const t = window.setTimeout(() => {
      window.print();
      setShow(false);
    }, 600);
    return () => window.clearTimeout(t);
  }, [show]);
  return (
    <>
      <Button size="sm" variant="ghost" icon="qr" onClick={() => setShow(true)}>
        Print totem tent cards
      </Button>
      {show && (
        <div className="sq-print" aria-hidden="true">
          {totems.map((t) => {
            const url = joinUrl(`/j/${code}/${t.id}`);
            return (
              <div key={t.id} className="sq-print__card">
                <TotemShape id={t.id} size={96} />
                <p className="sq-print__name">{t.name}</p>
                <QrCode text={url.full} size={180} label={`Join ${t.name}`} />
                <p className="sq-print__url">{url.short}</p>
                <p className="sq-print__fine">Scan to join · no download, no names</p>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Pair a co-facilitator's phone or tablet as a remote: the key travels in the URL fragment, never to the server. */
function PairDevice({ code, hostKey }: { code: string; hostKey: string }) {
  const url = useMemo(() => `${window.location.origin}/host/${code}#k=${hostKey}`, [code, hostKey]);
  return (
    <details className="sq-details">
      <summary>Pair another device as a remote</summary>
      <p className="sq-details__fine">
        Anyone who scans this can run the session. Show it only to a co-facilitator, then close this panel.
      </p>
      <QrCode text={url} size={160} label="QR code to open this console on another device" />
    </details>
  );
}

// Keep serverNow referenced for debugging in the console (window.__sqNow) without exporting app state.
if (typeof window !== 'undefined') (window as unknown as { __sqNow?: () => number }).__sqNow = serverNow;
