import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BECAUSE_TILES,
  MAX_REASON_CHIPS,
  REASON_CHIPS,
  type BecauseTileId,
  type ReasonChipId,
  type RevealView,
} from '@shieldquest/shared';
import { ExitGroup, ExitPatternSwatch, PhaseHeading, ThinkPhase, exitFor, type ExitView } from '../../game/mission';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { SENTENCE_STARTER, roleCard } from '../logic';
import { Countdown, MoodBadge } from '../parts';
import { act, sealVote } from './actions';
import type { SeatCtx } from './context';
import { ForecastStep } from './InvestigatePanel';
import { sealKey } from './local';

const range = (n: number) => Array.from({ length: Math.max(1, n) }, (_, i) => i);

// ---------------------------------------------------------------------------------------------
// Pass-and-play cover (a shared device keeps each player's vote private)

function PassCover({ player, players, round, onOpen }: { player: number; players: number; round: 1 | 2; onOpen: () => void }) {
  return (
    <div className="msn-phase sq-cover">
      <PhaseHeading kicker={round === 1 ? 'Shared phone · private vote' : 'Shared phone · private re-seal'} title={`Player ${player + 1} of ${players}`}>
        <p className="sq-lead">Pass the phone to player {player + 1}. Everyone else, look away for a moment.</p>
      </PhaseHeading>
      <div className="sq-cover__shield" aria-hidden="true">
        <Icon name="lock" size="3rem" />
      </div>
      <Button size="lg" block icon="eye" onClick={onOpen}>
        Only I can see the screen
      </Button>
    </div>
  );
}

function SealProgress({ ctx }: { ctx: SeatCtx }) {
  const { view } = ctx;
  return (
    <p className="sq-progress" role="status">
      <Icon name="envelope" /> {view.sealed.count} of {view.sealed.total} sealed
    </p>
  );
}

// ---------------------------------------------------------------------------------------------
// Think: (sealed forecast if it was skipped) -> breathing lock -> Exit + confidence = seal

export function ThinkPanel({ ctx }: { ctx: SeatCtx }) {
  const { snap, local, patch } = ctx;
  const { me } = snap;
  const players = me.players;
  const shared = players > 1;
  const sealed = (p: number) => Boolean(me.votes[p]?.round1) || Boolean(local.pendingSeal[sealKey(1, p)]);
  const current = range(players).find((p) => !sealed(p)) ?? null;

  if (current === null) return <ThinkSealed ctx={ctx} />;
  if (shared && !local.uncovered.includes(sealKey(1, current))) {
    return (
      <PassCover player={current} players={players} round={1} onOpen={() => patch((s) => ({ uncovered: [...s.uncovered, sealKey(1, current)] }))} />
    );
  }
  const forecastFromServer = Boolean(me.votes[current]?.forecast) && !local.forecastSent.includes(current);
  if (!forecastFromServer && !local.forecastSeen.includes(current)) {
    return <ForecastStep ctx={ctx} player={current} onContinue={() => patch((s) => ({ forecastSeen: [...s.forecastSeen, current] }))} />;
  }
  return <ThinkSeal key={current} ctx={ctx} player={current} />;
}

function ThinkSeal({ ctx, player }: { ctx: SeatCtx; player: number }) {
  const { view, mission, exits, snap, now } = ctx;
  // The breathing ring runs on the server's lock: a phone that arrives late gets a shorter ring.
  const [lockSeconds] = useState(() => Math.max(0, Math.ceil(((view.sealLockUntil ?? now) - now) / 1000)));
  return (
    <>
      <ThinkPhase
        mission={mission}
        exits={exits}
        firstVote={null}
        confidence={null}
        onSeal={(choiceId, confidence) => {
          ctx.cues.cue('seal');
          ctx.announce('Your vote is sealed. Nobody else can see it.');
          void sealVote(ctx, 1, player, choiceId, confidence);
        }}
        onContinue={() => undefined}
        lockSeconds={lockSeconds}
        paused={snap.session.paused}
        hideContinue
      />
      <SealProgress ctx={ctx} />
    </>
  );
}

function ThinkSealed({ ctx }: { ctx: SeatCtx }) {
  const { snap, local, mission, exits } = ctx;
  const { me } = snap;
  if (me.players > 1) {
    return (
      <div className="msn-phase sq-waiting">
        <PhaseHeading kicker="L · Lead the Right Choice" title="Every player has sealed">
          <p className="sq-lead">Put the phone back in the middle of the table. Votes stay private, even on a shared phone.</p>
        </PhaseHeading>
        <SealProgress ctx={ctx} />
      </div>
    );
  }
  const v = me.votes[0]?.round1;
  const pending = local.pendingSeal[sealKey(1, 0)];
  const choiceId = v?.choiceId ?? pending?.choiceId ?? null;
  const confidence = v?.confidence ?? pending?.confidence ?? 2;
  return (
    <>
      <ThinkPhase
        mission={mission}
        exits={exits}
        firstVote={choiceId}
        confidence={choiceId ? confidence : null}
        onSeal={() => undefined}
        onContinue={() => undefined}
        hideContinue
      />
      <p className="sq-lead">Waiting for your squad. When everyone has sealed, you will see how the squad split, as dots only.</p>
      <SealProgress ctx={ctx} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Reveal: counts only (dots on each Exit), or Mood for the junior band

/** Dots per Exit in the squad's order. `mine` tags this phone's own seal (never on a shared phone). */
export function RevealDots({ reveal, exits, mine }: { reveal: RevealView; exits: readonly ExitView[]; mine?: string | null }) {
  if (reveal.kind === 'mood') {
    return (
      <div className="sq-reveal sq-reveal--mood" role="group" aria-label="How your squad sealed">
        <MoodBadge mood={reveal.mood} />
        <p className="sq-reveal__total">
          {reveal.total} {reveal.total === 1 ? 'seal' : 'seals'}
        </p>
      </div>
    );
  }
  const count = (id: string) => reveal.counts.find((c) => c.choiceId === id)?.n ?? 0;
  return (
    <div className="sq-reveal" role="group" aria-label="How your squad sealed">
      <ul className="sq-reveal__exits">
        {exits.map((e) => {
          const n = count(e.choice.id);
          return (
            <li key={e.choice.id} className="sq-reveal__exit" data-empty={n === 0 ? '' : undefined}>
              <span className="sq-reveal__badge">
                <ExitPatternSwatch pattern={e.pattern} size={32} />
                <span className="sq-reveal__letter">{e.letter}</span>
              </span>
              <span className="sq-reveal__label">{e.choice.label}</span>
              <span className="sq-reveal__dots">
                <span aria-hidden="true">{n > 0 ? '●'.repeat(n) : '○'}</span>
                <span className="sq-reveal__n">
                  {n} {n === 1 ? 'seal' : 'seals'}
                </span>
              </span>
              {mine === e.choice.id && <span className="sq-reveal__mine">Your seal</span>}
            </li>
          );
        })}
      </ul>
      {reveal.mood && (
        <p className="sq-reveal__mood">
          <MoodBadge mood={reveal.mood} />
        </p>
      )}
    </div>
  );
}

function ReadyButton({ ctx, label, waiting }: { ctx: SeatCtx; label: string; waiting: string }) {
  const { snap, view } = ctx;
  if (snap.me.ready) {
    return (
      <p className="sq-progress" role="status">
        <Icon name="check" /> {waiting}
      </p>
    );
  }
  return (
    <Button size="lg" block icon="check" onClick={() => void act(ctx, 'ready', { phase: view.phase })}>
      {label}
    </Button>
  );
}

const ownChoice = (ctx: SeatCtx, round: 1 | 2): string | null => {
  const { me } = ctx.snap;
  if (me.players > 1) return null;
  const v = round === 1 ? me.votes[0]?.round1 : me.votes[0]?.round2;
  return v?.choiceId ?? ctx.local.pendingSeal[sealKey(round, 0)]?.choiceId ?? null;
};

export function RevealPanel({ ctx }: { ctx: SeatCtx }) {
  const { view, exits } = ctx;
  const reveal = view.reveal;
  const split = reveal?.kind === 'dots' ? reveal.mood !== 'united' : reveal?.mood !== 'united';
  return (
    <div className="msn-phase sq-revealphase">
      <PhaseHeading kicker="Reveal" title="How your squad sealed">
        <p className="sq-lead">Counts only. Nobody can see who chose what.</p>
      </PhaseHeading>
      {reveal ? <RevealDots reveal={reveal} exits={exits} mine={ownChoice(ctx, 1)} /> : <p role="status">Opening the seals…</p>}
      {reveal && reveal.total > 0 && split && <p className="sq-callout">Split decisions are normal. Talk it out.</p>}
      <ReadyButton ctx={ctx} label="Ready to talk" waiting="Ready. Waiting for your squad…" />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Explain: spoken talk with role sentence starters, reason chips (shown at >= 2), a random Steelman card

export function ExplainPanel({ ctx }: { ctx: SeatCtx }) {
  const { snap, view, exits, local, patch, now, gentle } = ctx;
  const { me, squad } = snap;
  const players = me.players;
  const [player, setPlayer] = useState(0);
  const serverChips = me.votes[player]?.reasons ?? [];
  const [draft, setDraft] = useState<Record<number, ReasonChipId[]>>({});
  const chips = draft[player] ?? serverChips;
  const card = me.role ? roleCard(me.role) : null;
  const starters = me.role ? [...new Set([me.role.role, ...me.role.covers])] : [];
  const steelExit = me.steelman ? exitFor(exits, me.steelman.choiceId) : undefined;
  const echoReady = squad.guardians.includes('echo') && !view.guardiansUsed.includes('echo') && !local.guardiansPressed.includes('echo');
  const steelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (me.steelman && !local.steelmanPassed) steelRef.current?.focus();
  }, [me.steelman, local.steelmanPassed]);

  const toggleChip = (id: ReasonChipId) => {
    const next = chips.includes(id) ? chips.filter((c) => c !== id) : [...chips, id].slice(-MAX_REASON_CHIPS);
    setDraft((d) => ({ ...d, [player]: next }));
    void act(ctx, 'reasons', { chips: next, player });
  };

  if (local.eyesUp) {
    return (
      <div className="msn-phase sq-eyesup">
        <h2 className="sq-h2" tabIndex={-1} data-msn-focus="">
          Eyes up
        </h2>
        <p className="sq-eyesup__line">Talk with your squad. Your phone can rest.</p>
        {card && <p className="sq-eyesup__starter">“{card.starter}”</p>}
        <Countdown endsAt={view.phaseEndsAt} now={now} hidden={gentle} />
        <Button size="lg" block icon="phone" onClick={() => patch({ eyesUp: false })}>
          Back to my phone
        </Button>
      </div>
    );
  }

  return (
    <div className="msn-phase sq-explain">
      <PhaseHeading kicker="L · Lead the Right Choice" title="Talk it out">
        <p className="sq-lead">Say why, out loud. Use your role’s starter if it helps. Pass is always OK.</p>
      </PhaseHeading>

      <div className="sq-explain__tools">
        <Button variant="secondary" icon="eye" onClick={() => patch({ eyesUp: true })}>
          Eyes up
        </Button>
        {!view.explainExtended && (
          <Button variant="ghost" icon="clock" onClick={() => void act(ctx, 'extendExplain', {})}>
            30 s more, please
          </Button>
        )}
      </div>

      {view.reveal && <RevealDots reveal={view.reveal} exits={exits} mine={ownChoice(ctx, 1)} />}

      {card && (
        <section className="sq-starter" aria-labelledby="sq-starter-title">
          <h3 id="sq-starter-title" className="sq-starter__title">
            Your starter{starters.length > 1 ? 's' : ''} · {card.name}
          </h3>
          <ul>
            {starters.map((r) => (
              <li key={r}>“{SENTENCE_STARTER[r]}”</li>
            ))}
          </ul>
        </section>
      )}

      {me.steelman && !local.steelmanPassed && steelExit && (
        <article ref={steelRef} tabIndex={-1} className="sq-steelman" aria-labelledby="sq-steel-title">
          <p className="sq-steelman__kicker">
            <Icon name="users" /> Steelman card
          </p>
          <h3 id="sq-steel-title" className="sq-steelman__title">
            Make the best case for Exit {steelExit.letter}
          </h3>
          <p className="sq-steelman__exit">
            <ExitPatternSwatch pattern={steelExit.pattern} size={24} /> {steelExit.choice.label}
          </p>
          <p className="sq-steelman__note">Dealt at random. It says nothing about how you voted. Argue it well, then decide for yourself.</p>
          <Button variant="secondary" onClick={() => patch({ steelmanPassed: true })}>
            Pass
          </Button>
        </article>
      )}

      <section className="sq-chips" aria-labelledby="sq-chips-title">
        <h3 id="sq-chips-title" className="sq-chips__title">
          What matters most here? <small>Pick up to {MAX_REASON_CHIPS}</small>
        </h3>
        {players > 1 && (
          <div className="sq-players" role="group" aria-label="Whose reasons">
            {range(players).map((p) => (
              <button key={p} type="button" className="sq-players__btn" aria-pressed={p === player} onClick={() => setPlayer(p)}>
                Player {p + 1}
              </button>
            ))}
          </div>
        )}
        <ul className="sq-chips__list">
          {REASON_CHIPS.map((c) => {
            const on = chips.includes(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className="msn-chip"
                  aria-pressed={on}
                  disabled={!on && chips.length >= MAX_REASON_CHIPS}
                  onClick={() => toggleChip(c.id)}
                >
                  {on && <Icon name="check" />} {c.label}
                </button>
              </li>
            );
          })}
        </ul>
        <ChipBoardView ctx={ctx} />
      </section>

      {echoReady && (
        <button
          type="button"
          className="sq-guardian-btn"
          data-guardian="echo"
          onClick={() => {
            patch((s) => ({ guardiansPressed: [...s.guardiansPressed, 'echo'] }));
            void act(ctx, 'guardian', { guardian: 'echo' });
          }}
        >
          <Icon name="users" />
          <span>
            <strong>Echo: Second Opinion</strong>
            <small>One more minute, and one more teammate argues the other side</small>
          </span>
        </button>
      )}

      <ReadyButton ctx={ctx} label="We’re ready to re-seal" waiting="Ready. Waiting for your squad…" />
    </div>
  );
}

function ChipBoardView({ ctx }: { ctx: SeatCtx }) {
  const board = ctx.view.chips;
  if (!board || board.players === 0) {
    return <p className="sq-chips__board-empty">Reasons two or more of you share will show here.</p>;
  }
  const label = (id: ReasonChipId) => REASON_CHIPS.find((c) => c.id === id)?.label ?? id;
  return (
    <div className="sq-chips__board" role="status" aria-live="polite">
      <p className="sq-chips__board-title">Your squad’s shared reasons</p>
      {board.chips.length > 0 ? (
        <ul>
          {board.chips.map((c) => (
            <li key={c.chipId}>
              <span>{label(c.chipId)}</span> <strong>{c.n}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p>No reason is shared by two or more yet.</p>
      )}
      {board.other > 0 && <p className="sq-chips__other">Other reasons: {board.other}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Re-seal: keep or change privately; a tie goes to the Safety Lead with a visible "Because…" tile

export function DecisionCard({ ctx }: { ctx: SeatCtx }) {
  const { view, exits } = ctx;
  const d = view.decision;
  if (!d) return null;
  const exit = exitFor(exits, d.choiceId);
  const because = d.tieBreak?.because ? BECAUSE_TILES.find((t) => t.id === d.tieBreak?.because)?.label : null;
  return (
    <section className="sq-decision" aria-labelledby="sq-decision-title">
      <p className="sq-decision__kicker">Squad decision</p>
      <h3 id="sq-decision-title" className="sq-decision__title">
        {exit && <ExitPatternSwatch pattern={exit.pattern} size={28} />} Exit {exit?.letter}: {exit?.choice.label}
      </h3>
      <p className="sq-decision__minds">
        {d.mindsChanged === 0 ? 'No minds changed.' : `${d.mindsChanged} ${d.mindsChanged === 1 ? 'mind' : 'minds'} changed.`} Changing your mind
        is thinking, not weakness.
      </p>
      {d.tieBreak && (
        <p className="sq-decision__tie">
          <Icon name="door" />{' '}
          {d.tieBreak.by === 'safety-lead' && because
            ? `It was a tie. The Safety Lead chose: ${because.toLowerCase()}.`
            : 'It was a tie and time ran out, so the safest tied exit was used.'}
        </p>
      )}
    </section>
  );
}

function TieBreak({ ctx }: { ctx: SeatCtx }) {
  const { view, exits, now, gentle } = ctx;
  const tie = view.tie!;
  const options = exits.filter((e) => tie.options.includes(e.choice.id));
  const [pick, setPick] = useState<string | null>(null);
  const [because, setBecause] = useState<BecauseTileId | null>(null);
  return (
    <div className="msn-phase sq-tie">
      <PhaseHeading kicker="L · Safety Lead" title="It’s a tie. You choose, with a reason">
        <p className="sq-lead">Pick one of the tied exits, then the reason your whole squad will see.</p>
      </PhaseHeading>
      <Countdown endsAt={tie.endsAt} now={now} hidden={gentle} />
      <ExitGroup exits={options} value={pick} onChange={setPick} label="Tied exits" keyboard={false} />
      <fieldset className="sq-because">
        <legend>Because…</legend>
        {BECAUSE_TILES.map((t) => (
          <label key={t.id} className="sq-because__tile">
            <input type="radio" name="sq-because" value={t.id} checked={because === t.id} onChange={() => setBecause(t.id)} />
            <span>{t.label}</span>
          </label>
        ))}
      </fieldset>
      <Button
        size="lg"
        block
        icon="check"
        disabled={!pick || !because}
        onClick={() => {
          if (pick && because) void act(ctx, 'tiebreak', { choiceId: pick, because });
        }}
      >
        Decide for the squad
      </Button>
    </div>
  );
}

export function ResealPanel({ ctx }: { ctx: SeatCtx }) {
  const { snap, view, local, patch, now, gentle } = ctx;
  const { me } = snap;
  const players = me.players;
  const shared = players > 1;

  if (view.decision) {
    return (
      <div className="msn-phase sq-decided">
        <PhaseHeading kicker="L · Lead the Right Choice" title="Your squad decided" />
        <DecisionCard ctx={ctx} />
        <p className="sq-lead">Time starts again in a moment.</p>
      </div>
    );
  }
  if (view.tie) {
    if (me.tieBreaker) return <TieBreak ctx={ctx} />;
    return (
      <div className="msn-phase sq-waiting">
        <PhaseHeading kicker="Re-seal" title="It’s a tie">
          <p className="sq-lead">Your Safety Lead is choosing one of the tied exits, with a reason you will all see.</p>
        </PhaseHeading>
        <Countdown endsAt={view.tie.endsAt} now={now} hidden={gentle} />
      </div>
    );
  }

  const sealed = (p: number) => Boolean(me.votes[p]?.round2) || Boolean(local.pendingSeal[sealKey(2, p)]);
  const current = range(players).find((p) => !sealed(p)) ?? null;
  if (current === null) {
    const final = ownChoice(ctx, 2);
    const exit = exitFor(ctx.exits, final);
    return (
      <div className="msn-phase sq-waiting">
        <PhaseHeading kicker="L · Lead the Right Choice" title={shared ? 'Every player has re-sealed' : 'Re-sealed'}>
          {exit && (
            <p className="sq-lead">
              <ExitPatternSwatch pattern={exit.pattern} size={24} /> Your final seal: Exit {exit.letter}. Only you can see this.
            </p>
          )}
        </PhaseHeading>
        <SealProgress ctx={ctx} />
      </div>
    );
  }
  if (shared && !local.uncovered.includes(sealKey(2, current))) {
    return (
      <PassCover player={current} players={players} round={2} onOpen={() => patch((s) => ({ uncovered: [...s.uncovered, sealKey(2, current)] }))} />
    );
  }
  return <ResealChoice key={current} ctx={ctx} player={current} />;
}

function ResealChoice({ ctx, player }: { ctx: SeatCtx; player: number }) {
  const { exits } = ctx;
  const first = ctx.snap.me.players > 1 ? null : ownChoice(ctx, 1);
  const [picked, setPicked] = useState<string | null>(first);
  const tags: Record<string, string> = first ? { [first]: 'Your first seal' } : {};
  let label: ReactNode = 'Re-seal';
  if (picked && first) label = picked === first ? 'Keep it and re-seal' : 'Change and re-seal';
  return (
    <div className="msn-phase sq-reseal">
      <PhaseHeading kicker="L · Lead the Right Choice" title="Keep or change">
        <p className="sq-lead">Privately. The squad’s choice is the majority; nobody sees who chose what.</p>
      </PhaseHeading>
      <ExitGroup exits={exits} value={picked} onChange={setPicked} label="Your final exit" tags={tags} />
      <Button
        size="lg"
        block
        icon="envelope"
        disabled={!picked}
        onClick={() => {
          if (!picked) return;
          ctx.cues.cue('seal');
          ctx.announce('Your final choice is sealed.');
          void sealVote(ctx, 2, player, picked);
        }}
      >
        {label}
      </Button>
      <SealProgress ctx={ctx} />
    </div>
  );
}
