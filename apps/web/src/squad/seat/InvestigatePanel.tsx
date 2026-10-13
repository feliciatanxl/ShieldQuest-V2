import { useEffect, useMemo } from 'react';
import { SCENES, guardianById, type GuardianId, type SceneAnchor } from '@shieldquest/shared';
import {
  FreezePhase,
  ForecastPhase,
  LivePhase,
  TracePhase,
  hashString,
  surgeLine,
  type Call,
} from '../../game/mission';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { StatusShape } from '../../ui/StatusBadge';
import { Countdown, RoleIcon } from '../parts';
import { act } from './actions';
import type { SeatCtx } from './context';
import { useSeatLocal } from './local';

// ---------------------------------------------------------------------------------------------
// Live: the same moment on every phone, from the shared t0

export function LivePanel({ ctx, t, looks, onLook }: { ctx: SeatCtx; t: number; looks: readonly string[]; onLook: (clueId: string) => void }) {
  const { mission, band, gentle, reduced, local, patch, view } = ctx;
  return (
    <>
      <LivePhase
        mission={mission}
        t={t}
        looks={looks}
        onLook={onLook}
        showCountdown={band !== 'junior' && !gentle}
        replyTried={local.replyTried}
        onReply={() => patch({ replyTried: true })}
        reduced={reduced}
      />
      {view.holding > 0 && (
        <p className="sq-note" role="status">
          <Icon name="pause" /> {view.holding === 1 ? 'Someone in your squad has held.' : `${view.holding} in your squad have held.`} You can Hold
          too.
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Investigate: scene list -> LIVE vs HELD counter -> the String -> sealed forecast -> waiting

interface InvestigateProps {
  ctx: SeatCtx;
  frozenAt: number;
  calls: Readonly<Record<string, Call>>;
  looks: readonly string[];
  onGuardian: (guardian: GuardianId, target?: string) => void;
  onHold: () => void;
}

export function InvestigatePanel({ ctx, frozenAt, calls, looks, onGuardian, onHold }: InvestigateProps) {
  const { snap, view, mission, band, reduced, local, patch, cues, now, gentle } = ctx;
  const { me, squad, session } = snap;
  const anchors = SCENES[mission.scene] as readonly SceneAnchor[];
  const unfolded = useMemo(
    () => Object.fromEntries(squad.guardians.map((g) => [g, true])) as Partial<Record<GuardianId, boolean>>,
    [squad.guardians],
  );
  const used = useMemo(() => [...new Set([...view.guardiansUsed, ...local.guardiansPressed])], [view.guardiansUsed, local.guardiansPressed]);
  const inInvestigate = view.phase === 'investigate';
  const freezeEndAt = session.timeline?.freezeEndAt ?? view.phaseEndsAt;

  // Done on this phone: tell the server once the squad phase is Investigate (Live ends for everyone together).
  useEffect(() => {
    if (inInvestigate && local.step === 'waiting' && !me.ready) void act(ctx, 'ready', { phase: 'investigate' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inInvestigate, local.step, me.ready]);

  const onCall = (clueId: string, call: Call) => {
    const st = useSeatLocal.getState();
    st.patch({ confirmed: call === 'flag' && !st.confirmed.includes(clueId) ? [...st.confirmed, clueId] : st.confirmed });
    const n = Object.keys(calls).length;
    cues.cue(call === 'flag' ? 'clue' : 'clueOk', { step: n, caption: call === 'flag' ? '[soft pluck: pinned]' : '[soft tick]' });
    void act(ctx, 'pin', { clueId, live: false, ...(call === 'fine' ? { fine: true } : {}) });
  };

  const freezeClock = (
    <p className="sq-note sq-note--clock">
      <Icon name="clock" /> {inInvestigate ? 'Freeze End' : 'Time stays held until Freeze End'}
      <Countdown endsAt={freezeEndAt} now={now} hidden={gentle} />
    </p>
  );

  if (local.step === 'scene' || local.step === 'counter') {
    return (
      <>
        <FreezePhase
          mission={mission}
          sceneAnchors={anchors}
          frozenAt={frozenAt}
          heldAtSec={local.heldAtSec}
          autoFrozen={local.heldAtSec === null}
          looks={looks}
          calls={calls}
          onCall={onCall}
          selected={local.selected}
          onSelect={(key) => patch({ selected: key })}
          unfolded={unfolded}
          guardiansUsed={used}
          onGuardian={onGuardian}
          sniffed={local.sniffed}
          scanned={local.scanned}
          crossChecked={local.crossChecked}
          surge={local.surge}
          surgeLine={surgeLine(mission)}
          onSurgeHold={onHold}
          done={local.step === 'counter'}
          onDone={() => {
            patch({ step: 'counter', selected: null });
            cues.cue('reveal', { caption: '[counter clicks up]' });
          }}
          onContinue={() => patch({ step: 'trace' })}
          nudge={null}
          band={band}
          reduced={reduced}
        />
        {local.step === 'scene' && !local.selected && (
          <>
            {freezeClock}
            <SquadBoard ctx={ctx} />
          </>
        )}
        {local.step === 'counter' && <SquadBoard ctx={ctx} compact />}
      </>
    );
  }

  if (local.step === 'trace') {
    return (
      <TracePhase
        mission={mission}
        pulled={local.threadPulled}
        answers={local.traceAnswers}
        onPull={() => {
          patch({ threadPulled: true });
          cues.cue('reveal', { caption: '[thread pulls tight]' });
        }}
        onAnswer={(optionId) => {
          const first = local.traceAnswers.length === 0;
          patch({ traceAnswers: [...local.traceAnswers, optionId] });
          // The first answer is the squad's I evidence; a second try is practice and stays on the phone.
          if (first) void act(ctx, 'trace', { optionId, player: 0 });
        }}
        onContinue={() => patch({ step: me.votes[0]?.forecast ? 'waiting' : 'forecast' })}
        seed={hashString(`${session.code}:${squad.id}:trace`)}
        reduced={reduced}
      />
    );
  }

  if (local.step === 'forecast') {
    return <ForecastStep ctx={ctx} player={0} onContinue={() => patch({ step: 'waiting' })} />;
  }

  // Waiting for the squad.
  return (
    <div className="msn-phase sq-waiting">
      <h2 className="sq-h2" tabIndex={-1} data-msn-focus="">
        Done. Waiting for your squad
      </h2>
      <p className="sq-lead">
        When everyone taps Done, or at Freeze End, you will all choose an Exit. Until then you can keep looking.
      </p>
      {freezeClock}
      <SquadBoard ctx={ctx} />
      <Button
        variant="secondary"
        block
        icon="eye"
        onClick={() => {
          patch({ step: 'scene' });
          if (inInvestigate && me.ready) void act(ctx, 'ready', { phase: 'investigate', on: false });
        }}
      >
        Keep looking
      </Button>
    </div>
  );
}

/** Sealed forecast for one player (in Investigate, or at the start of Think if it was skipped). */
export function ForecastStep({ ctx, player, onContinue }: { ctx: SeatCtx; player: number; onContinue: () => void }) {
  const { mission, local, patch, snap, cues } = ctx;
  const sealed = Boolean(snap.me.votes[player]?.forecast) || local.forecastSent.includes(player);
  return (
    <div className="sq-forecast">
      <ForecastPhase
        forecast={mission.forecast}
        missionId={mission.id}
        selected={local.forecastPick[player] ?? null}
        sealed={sealed}
        onPick={(optionId) => {
          patch((s) => ({ forecastPick: { ...s.forecastPick, [player]: optionId } }));
          cues.cue('tap', { caption: null });
        }}
        onSeal={() => {
          const optionId = useSeatLocal.getState().forecastPick[player];
          if (!optionId) return;
          patch((s) => ({ forecastSent: [...s.forecastSent, player] }));
          cues.cue('seal');
          void act(ctx, 'forecast', { optionId, player });
        }}
        onContinue={onContinue}
        seed={hashString(`${snap.session.code}:${snap.squad.id}:${player}`)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The squad's Evidence Board: pins tagged by role icon only, never a name (GDD §5.3 step 3)

export function SquadBoard({ ctx, compact }: { ctx: SeatCtx; compact?: boolean }) {
  const { view, mission } = ctx;
  const board = view.board;
  const label = (clueId: string) => mission.clues.find((c) => c.id === clueId)?.label ?? 'A detail';
  return (
    <section className="sq-board" aria-labelledby="sq-board-title">
      <h3 id="sq-board-title" className="sq-board__title">
        <Icon name="pin" /> Squad board
      </h3>
      <p className="sq-board__totals">
        Seen live: <strong>{board.liveFlags}</strong> · Found while holding: <strong>{board.heldFlags}</strong>
      </p>
      {!compact && (
        <>
          {board.pins.length === 0 ? (
            <p className="sq-board__empty">No pins yet. Anything your squad pins shows up here with their role icon.</p>
          ) : (
            <ul className="sq-board__pins">
              {board.pins.map((p) => (
                <li key={p.clueId}>
                  <span className="sq-board__label">{label(p.clueId)}</span>
                  <span className="sq-board__roles">
                    {p.roles.map((r, i) => (
                      <RoleIcon key={`${r}-${i}`} role={r} />
                    ))}
                    {p.live && <span className="sq-board__live">first look</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {board.cleared.length > 0 && (
            <p className="sq-board__cleared">
              <StatusShape status="safe" size={16} /> Seems fine: {board.cleared.map((p) => label(p.clueId)).join(' · ')}
            </p>
          )}
          {board.tracedRoles.length > 0 && (
            <p className="sq-board__traced">
              <Icon name="thread" /> String pulled by:{' '}
              {board.tracedRoles.map((r) => (
                <RoleIcon key={r} role={r} />
              ))}
            </p>
          )}
        </>
      )}
      <p className="sq-board__note">The board sorts pins. It never scores anyone.</p>
      {ctx.snap.squad.guardians.length > 0 && !compact && (
        <p className="sq-board__guardians">
          Guardians with your squad: {ctx.snap.squad.guardians.map((g) => guardianById(g).name).join(', ')}
        </p>
      )}
    </section>
  );
}
