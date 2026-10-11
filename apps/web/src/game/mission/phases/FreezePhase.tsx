import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { guardianById, type BandId, type Clue, type GuardianId, type Mission, type SceneAnchor } from '@shieldquest/shared';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { StatusShape } from '../../../ui/StatusBadge';
import { ChatThread, PawPrint, type ChatMark } from '../parts/ChatThread';
import { InspectCard } from '../parts/InspectCard';
import type { SurgeState } from '../runReducer';
import {
  AUTO_FREEZE_LINE,
  BOARD_COLUMNS,
  GUARDIAN_COLOR_VARS,
  HOLD_HEADER,
  CROSS_CHECK_RESULT,
  beatViews,
  boardColumn,
  canCrossCheck,
  formatClock,
  initials,
  inspectables,
  liveHeldCounts,
  scanNote,
  sniffTarget,
  type Call,
  type Inspectable,
  type InspectSection,
  type SurgeLine,
} from '../runLogic';
import { PhaseHeading } from './PhaseHeading';
import './phases.css';

/** Stable Scene List key for a clue: its message, or its place. */
export const keyForClue = (clue: Clue): string =>
  clue.target.kind === 'beat' ? `beat:${clue.target.beatId}` : `clue:${clue.id}`;

export interface FreezePhaseProps {
  mission: Mission;
  /** Anchors of the mission's set (SCENES[mission.scene]) for the "People and places" section. */
  sceneAnchors: readonly SceneAnchor[];
  frozenAt: number;
  heldAtSec: number | null;
  autoFrozen: boolean;
  looks: readonly string[];
  calls: Readonly<Record<string, Call>>;
  onCall: (clueId: string, call: Call) => void;
  /** Inspectable key being inspected (shared with the 3D hotspots), or null for the lists. */
  selected: string | null;
  onSelect: (key: string | null) => void;
  /** Guardians unfolded on this device, and those already used this mission (once each). */
  unfolded: Readonly<Partial<Record<GuardianId, boolean>>>;
  guardiansUsed: readonly GuardianId[];
  onGuardian: (guardian: GuardianId, target?: string) => void;
  sniffed: string | null;
  scanned: boolean;
  crossChecked: string | null;
  surge: SurgeState;
  surgeLine: SurgeLine | null;
  /** Press HOLD again to clear a surge (the HOLD button and H key do the same). */
  onSurgeHold: () => void;
  done: boolean;
  onDone: () => void;
  onContinue: () => void;
  /** Gentle Cluepaw nudge (guided missions), or null. */
  nudge?: string | null;
  band: BandId | null;
  reduced?: boolean;
}

type Tab = 'list' | 'chat' | 'board';

const SECTION_TITLE: Record<InspectSection, string> = {
  messages: 'In the chat',
  around: 'Look around',
  people: 'People and places',
};
const SECTION_HINT: Record<InspectSection, string> = {
  messages: 'Messages and things people said.',
  around: 'Quiet details in the scene. Easy to miss.',
  people: 'Everyone and everything else here.',
};

function itemStatus(item: Inspectable, looks: readonly string[], calls: Readonly<Record<string, Call>>) {
  const id = item.clue?.id;
  if (!id) return { word: 'Look', icon: 'eye' as const, state: 'none' };
  if (calls[id] === 'flag') return { word: 'Pinned', icon: 'pin' as const, state: 'flag' };
  if (calls[id] === 'fine') return { word: 'Seems fine', icon: 'check' as const, state: 'fine' };
  if (looks.includes(id)) return { word: 'First look', icon: 'pin' as const, state: 'look' };
  return { word: 'Not checked', icon: 'eye' as const, state: 'open' };
}

/** Shieldfin, the origami manta (decorative). */
function Manta() {
  return (
    <svg viewBox="0 0 120 60" width="140" height="70" aria-hidden="true">
      <path
        d="M60 8 L112 34 L72 30 L64 52 L60 40 L56 52 L48 30 L8 34 Z"
        fill="var(--msn-g-shieldfin, var(--teal))"
        stroke="var(--ink)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M60 8 L60 40" stroke="var(--ink)" strokeWidth="1.5" />
    </svg>
  );
}

/** Investigate while time is held: Scene List, the full chat, the Evidence Board, Guardians and the Surge. */
export function FreezePhase(props: FreezePhaseProps) {
  const {
    mission,
    sceneAnchors,
    frozenAt,
    heldAtSec,
    autoFrozen,
    looks,
    calls,
    onCall,
    selected,
    onSelect,
    unfolded,
    guardiansUsed,
    onGuardian,
    sniffed,
    scanned,
    crossChecked,
    surge,
    surgeLine,
    onSurgeHold,
    done,
    onDone,
    onContinue,
    nudge,
    reduced,
  } = props;
  const [tab, setTab] = useState<Tab>('list');
  const [lure, setLure] = useState(false);
  const tabsId = useId();
  const detailRef = useRef<HTMLHeadingElement>(null);
  const surgeRef = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => inspectables(mission, sceneAnchors), [mission, sceneAnchors]);
  const views = useMemo(() => beatViews(mission, frozenAt, true), [mission, frozenAt]);
  const current = items.find((i) => i.key === selected) ?? null;
  const clueItems = items.filter((i) => i.clue);
  const checked = clueItems.filter((i) => i.clue && calls[i.clue.id]).length;
  const counts = liveHeldCounts(mission, looks, calls);

  const marks = useMemo(() => {
    const m: Record<string, ChatMark> = {};
    for (const id of looks) m[id] = 'look';
    for (const [id, call] of Object.entries(calls)) m[id] = call;
    return m;
  }, [looks, calls]);

  useEffect(() => {
    if (current) detailRef.current?.focus({ preventScroll: false });
  }, [current]);
  // The surge takes focus while it shows, then hands it back to where the player was (or the phase heading).
  const focusBeforeSurge = useRef<HTMLElement | null>(null);
  const surgeWasShowing = useRef(false);
  useEffect(() => {
    if (surge === 'showing') {
      const active = document.activeElement;
      focusBeforeSurge.current = active instanceof HTMLElement && active !== document.body ? active : null;
      surgeWasShowing.current = true;
      surgeRef.current?.focus();
      return;
    }
    setLure(false);
    if (!surgeWasShowing.current) return;
    surgeWasShowing.current = false;
    const prev = focusBeforeSurge.current;
    focusBeforeSurge.current = null;
    const target = prev?.isConnected ? prev : rootRef.current?.querySelector<HTMLElement>('[data-msn-focus]');
    target?.focus({ preventScroll: true });
  }, [surge]);
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const used = (g: GuardianId) => guardiansUsed.includes(g);
  const sniffable = sniffTarget(mission, looks, calls);
  const hasScanTargets = mission.live.beats.some((b) => scanNote(b));

  const select = (key: string) => onSelect(key);
  const nextItem = () => {
    if (!current) return;
    const i = items.indexOf(current);
    const ordered = [...items.slice(i + 1), ...items.slice(0, i)];
    const next = ordered.find((it) => it.clue && !calls[it.clue.id]) ?? ordered[0];
    if (next) select(next.key);
  };

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const order: Tab[] = ['list', 'chat', 'board'];
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = order[(order.indexOf(tab) + step + order.length) % order.length]!;
    setTab(next);
    document.getElementById(`${tabsId}-${next}`)?.focus();
  };

  // ---- Done: the LIVE vs HELD counter ----------------------------------------------------------
  if (done) {
    return (
      <div className="msn-phase msn-freeze">
        <PhaseHeading kicker="S · Spot the Risk" title="What pausing showed you" />
        <div className="msn-counter msn-paper" role="group" aria-labelledby={`${tabsId}-counter`}>
          <h3 id={`${tabsId}-counter`} ref={doneRef} tabIndex={-1} className="sr-only">
            Seen live {counts.live}, found while holding {counts.held}
          </h3>
          <div className="msn-counter__cell">
            <span className="msn-counter__num">{counts.live}</span>
            <span className="msn-counter__word">Seen live</span>
          </div>
          <span className="msn-counter__dot" aria-hidden="true">
            ·
          </span>
          <div className="msn-counter__cell" data-held="">
            <span className="msn-counter__num msn-counter__num--held">{counts.held}</span>
            <span className="msn-counter__word">Found while holding</span>
          </div>
        </div>
        <p className="msn-freeze__counter-note">
          {counts.held > counts.live
            ? 'Pausing let you see more. That is the whole trick of Hold.'
            : counts.live + counts.held === 0
              ? 'Warning signs can be quiet. Next time, Hold and look at each message slowly.'
              : 'Sharp eyes, even under pressure. Holding still gives you time to check.'}
        </p>
        <p className="msn-freeze__private">
          <Icon name="lock" /> Only you see this counter. It stays on this device.
        </p>
        <Button size="lg" block iconRight="arrowRight" onClick={onContinue}>
          Pull the thread
        </Button>
      </div>
    );
  }

  const header = autoFrozen ? (
    <p className="msn-freeze__header" data-auto="">
      <strong>Time froze by itself.</strong> {AUTO_FREEZE_LINE}
    </p>
  ) : (
    <p className="msn-freeze__header">
      <strong>{HOLD_HEADER}</strong>
      {heldAtSec !== null && (
        <span className="msn-freeze__held-at">
          {' '}
          {props.band === 'junior'
            ? 'You held before the moment ended. Well done.'
            : `You held with ${formatClock(mission.live.durationSec - heldAtSec)} still on the clock.`}
        </span>
      )}
    </p>
  );

  const guardianBar =
    (unfolded.cluepaw || unfolded.bytebuddy) && (
      <div className="msn-guardians" role="group" aria-label="Guardian abilities, once each this moment">
        {unfolded.cluepaw && (
          <button
            type="button"
            className="msn-guardians__btn"
            data-guardian="cluepaw"
            disabled={used('cluepaw') || !sniffable}
            onClick={() => {
              if (!sniffable) return;
              onGuardian('cluepaw', sniffable.id);
              select(keyForClue(sniffable));
            }}
          >
            <PawPrint />
            <span>
              <strong>Cluepaw: {guardianById('cluepaw').abilityName}</strong>
              <small>{used('cluepaw') ? 'Used this moment' : sniffable ? 'Finds one sign you have not pinned' : 'Nothing left to sniff'}</small>
            </span>
          </button>
        )}
        {unfolded.bytebuddy && (
          <button
            type="button"
            className="msn-guardians__btn"
            data-guardian="bytebuddy"
            disabled={used('bytebuddy')}
            aria-pressed={scanned}
            onClick={() => onGuardian('bytebuddy')}
          >
            <Icon name="eye" />
            <span>
              <strong>ByteBuddy: {guardianById('bytebuddy').abilityName}</strong>
              <small>
                {scanned
                  ? hasScanTargets
                    ? 'Links, codes, payments and jobs outlined'
                    : 'No links, codes or payments here'
                  : 'Outlines links, codes, payments and job offers'}
              </small>
            </span>
          </button>
        )}
      </div>
    );

  const detail = current && (
    <div className="msn-freeze__detail">
      <div className="msn-freeze__detail-nav">
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => onSelect(null)}>
          <Icon name="arrowLeft" />
          <span>Back to {tab === 'board' ? 'board' : tab === 'chat' ? 'chat' : 'scene list'}</span>
        </button>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={nextItem}>
          <span>Next</span>
          <Icon name="arrowRight" />
        </button>
      </div>
      <h3 ref={detailRef} tabIndex={-1} className="msn-freeze__detail-title">
        Inspect: {current.kind === 'message' ? 'message' : current.title}
      </h3>
      <div className="msn-paper">
        <InspectCard
          mission={mission}
          item={current}
          call={current.clue ? calls[current.clue.id] : undefined}
          firstLook={Boolean(current.clue && looks.includes(current.clue.id))}
          readEarly={Boolean(current.beat && current.beat.at > frozenAt)}
          sniffed={Boolean(current.clue && sniffed === current.clue.id)}
          scanned={scanned}
          crossCheck={
            unfolded.verifox && current.clue && canCrossCheck(current.clue, current.beat)
              ? {
                  used: used('verifox') && crossChecked !== current.clue.id,
                  result: crossChecked === current.clue.id ? CROSS_CHECK_RESULT : null,
                  onUse: () => current.clue && onGuardian('verifox', current.clue.id),
                }
              : null
          }
          onCall={current.clue ? (call) => current.clue && onCall(current.clue.id, call) : undefined}
        />
      </div>
    </div>
  );

  const sections: InspectSection[] = ['messages', 'around', 'people'];

  return (
    <div ref={rootRef} className="msn-phase msn-freeze" style={GUARDIAN_COLOR_VARS} data-surge={surge === 'showing' ? '' : undefined}>
      <PhaseHeading kicker="H · Hold Before Acting" title="Investigate">
        {header}
      </PhaseHeading>

      {surge === 'held' && (
        <p className="msn-freeze__toast" role="status">
          <Icon name="pause" /> You held again when the pressure came back. That is Hold, practised.
        </p>
      )}
      {surge === 'shieldfin' && (
        <div className="msn-freeze__toast" role="status">
          <span className="msn-freeze__manta" aria-hidden="true">
            <Manta />
          </span>
          <span>Shieldfin swam across and blocked the pressure.</span>
        </div>
      )}
      {nudge && (
        <p className="msn-freeze__nudge" role="status">
          <PawPrint /> {nudge}
        </p>
      )}

      {guardianBar}

      {detail ?? (
        <>
          <div className="msn-tabs" role="tablist" aria-label="Investigate views" onKeyDown={onTabKey}>
            {(
              [
                ['list', 'Scene list'],
                ['chat', 'Chat'],
                ['board', 'Board'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                id={`${tabsId}-${id}`}
                type="button"
                role="tab"
                className="msn-tabs__tab"
                aria-selected={tab === id}
                aria-controls={`${tabsId}-${id}-panel`}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
              >
                {label}
                {id === 'board' && <span className="msn-tabs__count">{Object.values(calls).filter((c) => c === 'flag').length}</span>}
              </button>
            ))}
          </div>

          {tab === 'list' && (
            <div role="tabpanel" id={`${tabsId}-list-panel`} aria-labelledby={`${tabsId}-list`} className="msn-scenelist">
              <p className="msn-scenelist__progress">
                Checked {checked} of {clueItems.length} details. Pin the warning signs; mark ordinary details as "Seems fine".
              </p>
              {sections.map((section) => {
                const list = items.filter((i) => i.section === section);
                if (list.length === 0) return null;
                return (
                  <section key={section} className="msn-scenelist__section" aria-labelledby={`${tabsId}-${section}`}>
                    <h3 id={`${tabsId}-${section}`} className="msn-scenelist__title">
                      {SECTION_TITLE[section]}
                      <small>{SECTION_HINT[section]}</small>
                    </h3>
                    <ul className="msn-scenelist__items">
                      {list.map((item) => {
                        const st = itemStatus(item, looks, calls);
                        const early = Boolean(item.beat && item.beat.at > frozenAt);
                        const scan = scanned && scanNote(item.beat);
                        return (
                          <li key={item.key}>
                            <button
                              type="button"
                              className="msn-scenelist__item"
                              data-state={st.state}
                              data-sniffed={item.clue && sniffed === item.clue.id ? '' : undefined}
                              data-scanned={scan ? '' : undefined}
                              onClick={() => select(item.key)}
                            >
                              <span className="msn-scenelist__icon" aria-hidden="true">
                                {item.kind === 'message' ? (
                                  <span className="msn-avatar">{initials(item.detail)}</span>
                                ) : (
                                  <Icon name={item.kind === 'person' ? 'user' : 'eye'} />
                                )}
                              </span>
                              <span className="msn-scenelist__text">
                                <span className="msn-scenelist__name">{item.title}</span>
                                <span className="msn-scenelist__detail">
                                  {item.detail}
                                  {early ? ' · frozen in mid-air' : ''}
                                  {scan ? ' · ByteBuddy outlined this' : ''}
                                  {item.clue && sniffed === item.clue.id ? ' · Cluepaw sniffed this' : ''}
                                </span>
                              </span>
                              <span className="msn-scenelist__state">
                                <Icon name={st.icon} />
                                {st.word}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}

          {tab === 'chat' && (
            <div role="tabpanel" id={`${tabsId}-chat-panel`} aria-labelledby={`${tabsId}-chat`} className="msn-freeze__chat">
              <p className="msn-scenelist__progress">Messages that had not arrived yet hang frozen in mid-air. You can read them early.</p>
              <ChatThread
                mission={mission}
                views={views}
                marks={marks}
                scanned={scanned}
                sniffed={sniffed}
                onClueTap={(clue) => select(keyForClue(clue))}
                tapHint="Inspect"
                announce={false}
                reduced={reduced}
              />
            </div>
          )}

          {tab === 'board' && (
            <div role="tabpanel" id={`${tabsId}-board-panel`} aria-labelledby={`${tabsId}-board`} className="msn-board">
              {BOARD_COLUMNS.map((col) => {
                const pins = mission.clues.filter(
                  (c) => boardColumn(mission, c) === col.id && (calls[c.id] === 'flag' || (calls[c.id] === undefined && looks.includes(c.id))),
                );
                return (
                  <section key={col.id} className="msn-board__col" aria-labelledby={`${tabsId}-col-${col.id}`}>
                    <h3 id={`${tabsId}-col-${col.id}`} className="msn-board__title">
                      <span className="msn-board__letter">{col.id}</span> {col.title}
                      <small>{col.hint}</small>
                    </h3>
                    {pins.length === 0 ? (
                      <p className="msn-board__empty">No pins yet.</p>
                    ) : (
                      <ul className="msn-board__pins">
                        {pins.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              className="msn-board__pin"
                              data-tentative={calls[c.id] ? undefined : ''}
                              onClick={() => select(keyForClue(c))}
                            >
                              <Icon name="pin" />
                              <span>
                                {c.label}
                                {!calls[c.id] && <small> · first look, not confirmed yet</small>}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
              <p className="msn-board__note">
                <StatusShape status="unknown" size={16} /> The board only sorts your pins. It never scores them.
              </p>
            </div>
          )}

          <div className="msn-freeze__done">
            <p className="msn-freeze__done-note">
              {checked < clueItems.length
                ? `${clueItems.length - checked} details still unchecked. Take your time.`
                : 'You checked everything. Ready when you are.'}
            </p>
            <Button block icon="check" onClick={onDone}>
              Done investigating
            </Button>
          </div>
        </>
      )}

      {surge === 'showing' && surgeLine && (
        <div className="msn-surge" role="dialog" aria-modal="false" aria-labelledby={`${tabsId}-surge`}>
          <div className="msn-surge__card">
            <p className="msn-surge__app">
              <Icon name="phone" /> ChatLah · new message
            </p>
            <div className="msn-surge__msg">
              <span className="msn-avatar" data-faceless="">
                {initials(surgeLine.name)}
              </span>
              <div>
                <h3 id={`${tabsId}-surge`} ref={surgeRef} tabIndex={-1} className="msn-surge__name">
                  {surgeLine.name}
                </h3>
                <p className="msn-surge__text">{surgeLine.text}</p>
              </div>
            </div>
            <button type="button" className="msn-surge__lure" onClick={() => setLure(true)}>
              Reply now
            </button>
            {lure && (
              <p className="msn-surge__lure-note" role="status">
                That's what the hurry is for. Nothing was sent.
              </p>
            )}
          </div>
          <p className="msn-surge__calm">The pressure is back. Nothing is timed: press HOLD again to clear it.</p>
          <div className="msn-surge__actions">
            <Button icon="pause" onClick={onSurgeHold}>
              Hold again
            </Button>
            {unfolded.shieldfin && !used('shieldfin') && (
              <Button variant="secondary" onClick={() => onGuardian('shieldfin')}>
                Shieldfin: {guardianById('shieldfin').abilityName}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
