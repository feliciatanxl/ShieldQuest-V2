import { useEffect, useId, useMemo, useRef } from 'react';
import {
  SKILLS,
  guardianById,
  isEarlyHold,
  type ShieldResultView,
  type ShieldSlot,
  type ShieldTile,
  type SkillId,
} from '@shieldquest/shared';
import {
  GUARDIAN_COLOR_VARS,
  GuardianStage,
  MeterBar,
  PhaseHeading,
  ReleasePhase,
  SHIELD_SLOT_LABEL,
  castName,
  exitFor,
  ifThenText,
  safeMotif,
  seededShuffle,
  shieldPreview,
  skillRule,
} from '../../game/mission';
import { useProgress } from '../../state/progress';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { StatusBadge, type Status } from '../../ui/StatusBadge';
import { roleName, squadSeed } from '../logic';
import { act } from './actions';
import type { SeatCtx } from './context';
import { sealKey, useSeatLocal } from './local';
import { DecisionCard } from './VotePanels';

function ReadyLine({ ctx, label, waiting }: { ctx: SeatCtx; label: string; waiting: string }) {
  const { snap, view } = ctx;
  if (view.complete) return null;
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

/** Letters this phone showed, computed here and never sent anywhere (GDD §5.3 step 10, §11.9). */
function personalLetters(ctx: SeatCtx): Partial<Record<SkillId, boolean>> {
  const { mission, snap, local } = ctx;
  const { me } = snap;
  const red = mission.clues.filter((c) => c.redFlag);
  const found = red.filter((c) => me.pins.includes(c.id)).length;
  const falseAlarms = mission.clues.filter((c) => !c.redFlag && me.pins.includes(c.id)).length;
  const firstTrace = mission.influence.options.find((o) => o.id === local.traceAnswers[0]);
  const forecast = mission.forecast.options.find((o) => o.id === local.forecastPick[0]);
  const final =
    me.players > 1
      ? null
      : (me.votes[0]?.round2?.choiceId ??
        local.pendingSeal[sealKey(2, 0)]?.choiceId ??
        me.votes[0]?.round1?.choiceId ??
        local.pendingSeal[sealKey(1, 0)]?.choiceId ??
        null);
  return {
    S: (red.length === 0 || found / red.length >= 0.6) && falseAlarms <= 1,
    H: isEarlyHold(mission, local.heldAtSec),
    I: Boolean(firstTrace?.correct),
    E: Boolean(forecast?.likely),
    L: mission.choices.find((c) => c.id === final)?.safety === 'safe',
  };
}

// ---------------------------------------------------------------------------------------------
// Release

export function ReleasePanel({ ctx }: { ctx: SeatCtx }) {
  const { view, mission, exits, snap, reduced, local, patch } = ctx;
  const { me } = snap;
  const choice = view.decision ? mission.choices.find((c) => c.id === view.decision?.choiceId) : undefined;

  // Pins and seals are dropped when the mission closes, so this phone works out its letters now.
  useEffect(() => {
    if (!local.personal) patch({ personal: personalLetters(ctx) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!choice) {
    return (
      <div className="msn-phase sq-waiting">
        <PhaseHeading kicker="E · Evaluate the Consequences" title="Waiting for your squad’s decision" />
      </div>
    );
  }
  const shared = me.players > 1;
  const first = shared ? null : (me.votes[0]?.round1?.choiceId ?? local.pendingSeal[sealKey(1, 0)]?.choiceId ?? null);
  const confidence = shared ? null : (me.votes[0]?.round1?.confidence ?? local.pendingSeal[sealKey(1, 0)]?.confidence ?? null);
  const decoys = mission.clues.filter((c) => !c.redFlag && me.pins.includes(c.id));
  return (
    <>
      <DecisionCard ctx={ctx} />
      <ReleasePhase
        mission={mission}
        choice={choice}
        exit={exitFor(exits, choice.id)}
        firstVote={first}
        confidence={confidence}
        pinnedDecoys={decoys}
        onContinue={() => undefined}
        reduced={reduced}
        hideContinue
      />
      <ReadyLine ctx={ctx} label="Ready" waiting="Ready. Waiting for your squad…" />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Peer Shield: tiles are dealt by role; the message is assembled across the squad's phones (GDD §6.4)

const OUTCOME: Record<ShieldResultView['outcome'], { status: Status; word: string }> = {
  success: { status: 'safe', word: 'Opened up' },
  partial: { status: 'attention', word: 'Thinking about it' },
  fail: { status: 'risk', word: 'Shut down' },
};

const QUALITY: Record<ShieldTile['quality'], { status: Status; word: string }> = {
  great: { status: 'safe', word: 'Helpful' },
  ok: { status: 'unknown', word: 'Okay' },
  harmful: { status: 'risk', word: 'Backfires' },
};

export function ShieldPanel({ ctx }: { ctx: SeatCtx }) {
  const { view, mission, snap, local, patch, cues } = ctx;
  const { me, squad, session } = snap;
  const ps = mission.peerShield;
  const sv = view.shield;
  const uid = useId();
  const replyRef = useRef<HTMLDivElement>(null);
  const seed = squadSeed(session.code, squad.id, mission.id);
  const dealt = useMemo(() => {
    if (!ps || !sv) return {} as Partial<Record<ShieldSlot, ShieldTile[]>>;
    return Object.fromEntries(sv.slots.map((s) => [s, seededShuffle(ps.slots[s], seed, `${mission.id}:shield:${s}`)])) as Partial<
      Record<ShieldSlot, ShieldTile[]>
    >;
  }, [ps, sv, seed, mission.id]);

  const outcome = sv?.result?.outcome;
  const attempts = sv?.attempts ?? 0;
  const { cue } = cues;
  // Once per sent message: the friend's reaction gets a sound, a caption and focus.
  useEffect(() => {
    if (!outcome) return;
    cue(outcome === 'success' ? 'success' : 'soft-fail');
    replyRef.current?.focus();
    patch({ shieldDelta: null });
  }, [outcome, attempts, cue, patch]);

  if (!ps || !sv) {
    return (
      <div className="msn-phase sq-waiting">
        <PhaseHeading kicker="D · Defend Your Community" title="Getting the message tiles ready…" />
      </div>
    );
  }
  const friend = castName(mission, ps.friend);
  const mine = sv.slots.filter((s) => me.shieldSlots.includes(s) || (sv.owners[s]?.length ?? 0) === 0);
  const filled = sv.slots.every((s) => sv.picks[s]);
  const missing = sv.slots.filter((s) => !sv.picks[s]);
  const beaconReady = squad.guardians.includes('beacon') && !view.guardiansUsed.includes('beacon') && !local.guardiansPressed.includes('beacon');
  const beaconLit = view.guardiansUsed.includes('beacon');
  const tileFor = (slot: ShieldSlot) => ps.slots[slot].find((t) => t.id === sv.picks[slot]);

  const pick = (slot: ShieldSlot, tileId: string) => {
    const before = shieldPreview(ps, sv.picks);
    const after = shieldPreview(ps, { ...sv.picks, [slot]: tileId });
    patch({ shieldDelta: { guard: after.guard - before.guard, doubt: after.doubt - before.doubt } });
    cues.cue('tap', { caption: null });
    void act(ctx, 'shieldTile', { slot, tileId });
  };

  return (
    <div className="msn-phase sq-shield" style={GUARDIAN_COLOR_VARS}>
      <p className="sq-shield__banner">{ps.timeLabel}</p>
      <PhaseHeading kicker="D · Defend Your Community" title={`Help ${friend}`}>
        <p className="sq-lead">{ps.setup}</p>
      </PhaseHeading>

      <ol className="msn-chat sq-shield__chat" aria-label={`Messages from ${friend}`}>
        {ps.messages.map((m, i) => (
          <li key={i} className="msn-chat__row" data-side="in">
            <div className="msn-bubble msn-bubble--chat msn-bubble--in">
              <span className="msn-bubble__who">{castName(mission, m.from)}</span>
              <span className="msn-bubble__text">{m.text}</span>
            </div>
          </li>
        ))}
      </ol>

      <div className="sq-shield__meters" aria-live="polite">
        <MeterBar kind="guard" value={sv.result?.guard ?? sv.guard} delta={local.shieldDelta?.guard} friend={friend} />
        <MeterBar kind="doubt" value={sv.result?.doubt ?? sv.doubt} delta={local.shieldDelta?.doubt} friend={friend} />
      </div>

      <section className="sq-shield__message" aria-labelledby={`${uid}-msg`}>
        <h3 id={`${uid}-msg`} className="sq-shield__msg-title">
          Your squad’s message
        </h3>
        <ol className="sq-shield__parts">
          {sv.slots.map((slot) => {
            const tile = tileFor(slot);
            const owners = sv.owners[slot] ?? [];
            return (
              <li key={slot} data-filled={tile ? '' : undefined}>
                <span className="sq-shield__slot">{SHIELD_SLOT_LABEL[slot].title}</span>
                <span className="sq-shield__text">
                  {tile ? tile.text : owners.length > 0 ? `${owners.map(roleName).join(' or ')} is choosing…` : 'Anyone can choose this part'}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {beaconReady && !sv.result && (
        <button
          type="button"
          className="sq-guardian-btn"
          data-guardian="beacon"
          onClick={() => {
            patch((s) => ({ guardiansPressed: [...s.guardiansPressed, 'beacon'] }));
            void act(ctx, 'guardian', { guardian: 'beacon' });
          }}
        >
          <Icon name="spark" />
          <span>
            <strong>Beacon: {guardianById('beacon').abilityName}</strong>
            <small>Lights up the trusted channel tile for your squad</small>
          </span>
        </button>
      )}

      {!sv.result && (
        <div className="sq-shield__builder">
          {mine.length === 0 ? (
            <p className="sq-lead">Your squad holds the tiles this time. Talk it through: which words would really help {friend}?</p>
          ) : (
            mine.map((slot) => (
              <fieldset key={slot} className="msn-slot">
                <legend className="msn-slot__legend">
                  {SHIELD_SLOT_LABEL[slot].title}
                  <small>{SHIELD_SLOT_LABEL[slot].hint} · your tiles</small>
                </legend>
                <div className="msn-slot__tiles">
                  {(dealt[slot] ?? []).map((tile) => {
                    const lit = beaconLit && slot === 'channel' ? (tile.quality === 'great' ? 'lit' : tile.quality === 'harmful' ? 'dim' : undefined) : undefined;
                    return (
                      <label key={tile.id} className="msn-tile" data-beacon={lit}>
                        <input
                          type="radio"
                          name={`${uid}-${slot}`}
                          value={tile.id}
                          checked={sv.picks[slot] === tile.id}
                          onChange={() => pick(slot, tile.id)}
                        />
                        <span className="msn-tile__text">{tile.text}</span>
                        {lit === 'lit' && (
                          <span className="msn-tile__beacon">
                            <Icon name="spark" /> Beacon: a safe channel
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))
          )}

          {me.canSendShield ? (
            <Button size="lg" block icon="chat" disabled={!filled} onClick={() => void act(ctx, 'shieldSend', {})}>
              {filled ? `Send to ${friend}` : `Waiting for: ${missing.map((s) => SHIELD_SLOT_LABEL[s].title).join(', ')}`}
            </Button>
          ) : (
            <p className="sq-note">
              <Icon name="heart" />{' '}
              {filled ? 'Message ready. Your Peer Supporter sends it.' : `Still to choose: ${missing.map((s) => SHIELD_SLOT_LABEL[s].title).join(', ')}.`}
            </p>
          )}
        </div>
      )}

      {sv.result && (
        <div className="sq-shield__result">
          <div ref={replyRef} tabIndex={-1} className="sq-shield__reply" role="status">
            <StatusBadge status={OUTCOME[sv.result.outcome].status} label={`${friend}: ${OUTCOME[sv.result.outcome].word}`} />
            <div className="msn-bubble msn-bubble--chat msn-bubble--in">
              <span className="msn-bubble__text">{ps.outcomes[sv.result.outcome]}</span>
            </div>
          </div>
          <h3 className="sq-h3">Why each part landed the way it did</h3>
          <ul className="sq-shield__why">
            {sv.slots.map((slot) => {
              const t = tileFor(slot);
              if (!t) return null;
              return (
                <li key={slot}>
                  <StatusBadge status={QUALITY[t.quality].status} label={QUALITY[t.quality].word} />
                  <span>
                    <q>{t.text}</q> {t.why}
                  </span>
                </li>
              );
            })}
          </ul>
          {sv.canRetry && (
            <Button variant="secondary" block icon="rewind" onClick={() => void act(ctx, 'shieldRetry', {})}>
              Try again together
            </Button>
          )}
          <ReadyLine ctx={ctx} label="Ready" waiting="Ready. Waiting for your squad…" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Bond: letters light with the motif; Guardians unfold for the squad (shared credit, no scores)

export function BondPanel({ ctx }: { ctx: SeatCtx }) {
  const { view, mission, snap, local, patch, cues, reduced, renderMode, band } = ctx;
  const { squad } = snap;
  const bond = view.bond;
  const squadLetters = useMemo(() => new Set<SkillId>(bond?.letters ?? []), [bond]);
  const personal = useMemo(() => {
    const p = { ...(local.personal ?? personalLetters(ctx)) };
    if (view.shield?.result?.outcome === 'success') p.D = true;
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.personal, view.shield?.result?.outcome]);
  const lit = SKILLS.map((s) => Boolean(personal[s.id]));

  useEffect(() => {
    if (!bond || useSeatLocal.getState().bondPlayed) return;
    patch({ bondPlayed: true });
    safeMotif(lit);
    cues.showCaption('[six-note S.H.I.E.L.D. melody]');
    if (bond.newlyBonded.length > 0) window.setTimeout(() => cues.cue('unfold'), reduced ? 0 : 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bond]);

  const ifThen = ifThenText(mission);
  const saveIfThen = () => {
    useProgress.getState().saveIfThen(mission.id, ifThen);
    patch({ ifThenSaved: true });
    ctx.announce('Saved on this phone only.');
  };

  return (
    <div className="msn-phase sq-bond" style={GUARDIAN_COLOR_VARS}>
      <PhaseHeading kicker={view.complete ? 'Phones down' : 'Bond'} title={view.complete ? 'Phones down. Look up.' : 'What your squad showed'}>
        <p className="sq-lead">
          {view.complete ? 'Your squad is done. Your facilitator will start the next part soon.' : 'Shared by the whole squad. No scores, no rankings.'}
        </p>
      </PhaseHeading>

      <ol className="sq-letters" aria-label="S.H.I.E.L.D. letters your squad showed">
        {SKILLS.map((s) => {
          const on = squadLetters.has(s.id);
          return (
            <li key={s.id} className="sq-letters__item" data-on={on ? '' : undefined}>
              <span className="sq-letters__letter" aria-hidden="true">
                {s.id}
              </span>
              <span className="sq-letters__name">
                {s.name}
                <span className="sr-only">{on ? ': shown' : ': not this time'}</span>
              </span>
              {on && <Icon name="check" size="1em" />}
            </li>
          );
        })}
      </ol>

      {bond && bond.newlyBonded.length > 0 && (
        <section className="sq-unfold" aria-labelledby="sq-unfold-title">
          <h3 id="sq-unfold-title" className="sq-h3">
            {bond.newlyBonded.length === 1 ? 'A Guardian unfolds' : 'Guardians unfold'}
          </h3>
          <ul className="sq-unfold__list">
            {bond.newlyBonded.map((g) => {
              const gd = guardianById(g);
              return (
                <li key={g} className="sq-unfold__item" data-guardian={g}>
                  <GuardianStage guardian={g} level={1} celebrate={!reduced} renderMode={renderMode} size={6} />
                  <p>
                    <strong>{gd.name}</strong> · {gd.abilityName}
                  </p>
                  <p className="sq-unfold__ability">{gd.ability}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {squad.guardians.length > 0 && (
        <p className="sq-note">
          <Icon name="shield" /> With your squad this session: {squad.guardians.map((g) => guardianById(g).name).join(', ')}.
        </p>
      )}

      <details className="sq-private">
        <summary>
          <Icon name="lock" /> Only on this phone: your own letters
        </summary>
        <ul className="sq-private__list">
          {SKILLS.filter((s) => personal[s.id]).map((s) => (
            <li key={s.id}>
              <strong>{s.id}</strong> {skillRule(s.id, band)}
            </li>
          ))}
          {SKILLS.every((s) => !personal[s.id]) && <li>Every moment is practice. The letters come with time.</li>}
        </ul>
        <p className="sq-private__fine">Worked out on this phone. Nobody else sees it, not even your facilitator.</p>
      </details>

      <section className="sq-ifthen" aria-labelledby="sq-ifthen-title">
        <h3 id="sq-ifthen-title" className="sq-h3">
          Your If-Then card
        </h3>
        <p className="sq-ifthen__text">{ifThen}</p>
        {local.ifThenSaved ? (
          <p className="sq-progress" role="status">
            <Icon name="check" /> Kept on this phone only.
          </p>
        ) : (
          <Button variant="secondary" icon="lock" onClick={saveIfThen}>
            Keep it on this phone
          </Button>
        )}
      </section>

      <ReadyLine ctx={ctx} label="Phones down" waiting="Phones down. Waiting for your squad…" />
    </div>
  );
}
