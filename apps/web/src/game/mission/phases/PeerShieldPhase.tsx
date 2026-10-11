import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Mission, PeerShield, ShieldResult, ShieldSlot, ShieldTile } from '@shieldquest/shared';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { StatusBadge, type Status } from '../../../ui/StatusBadge';
import { MeterBar } from '../parts/MeterBar';
import { SHIELD_SLOT_LABEL, castName, initials, residentName, seededShuffle, shieldPreview } from '../runLogic';
import { PhaseHeading } from './PhaseHeading';
import './phases.css';

export interface PeerShieldPhaseProps {
  mission: Mission;
  shield: PeerShield;
  /** Slots in play (junior: Opener, Offer, Channel). */
  slots: readonly ShieldSlot[];
  picks: Partial<Record<ShieldSlot, string>>;
  result: ShieldResult | null;
  tries: number;
  maxTries: number;
  seed: number;
  onPick: (slot: ShieldSlot, tileId: string) => void;
  onSend: () => void;
  onRetry: () => void;
  onContinue: () => void;
  /** Beacon's Safe Channel: lights the trusted channel tile and dims the decoy (once, if unfolded). */
  beacon?: { unfolded: boolean; used: boolean; onUse: () => void } | null;
  hideContinue?: boolean;
}

const OUTCOME: Record<ShieldResult['outcome'], { status: Status; word: string }> = {
  success: { status: 'safe', word: 'Opened up' },
  partial: { status: 'attention', word: 'Thinking about it' },
  fail: { status: 'risk', word: 'Shut down' },
};

const QUALITY: Record<ShieldTile['quality'], { status: Status; word: string }> = {
  great: { status: 'safe', word: 'Helpful' },
  ok: { status: 'unknown', word: 'Okay' },
  harmful: { status: 'risk', word: 'Backfires' },
};

/** Peer Shield: build a message from tiles to help a friend facing the same pressure. GUARD and DOUBT react live. */
export function PeerShieldPhase({
  mission,
  shield,
  slots,
  picks,
  result,
  tries,
  maxTries,
  seed,
  onPick,
  onSend,
  onRetry,
  onContinue,
  beacon,
  hideContinue,
}: PeerShieldPhaseProps) {
  const friend = castName(mission, shield.friend);
  const me = residentName(mission);
  const uid = useId();
  const [delta, setDelta] = useState<{ guard: number; doubt: number } | null>(null);
  const replyRef = useRef<HTMLDivElement>(null);

  const dealt = useMemo(
    () => Object.fromEntries(slots.map((s) => [s, seededShuffle(shield.slots[s], seed, `${mission.id}:shield:${s}`)])) as Record<ShieldSlot, ShieldTile[]>,
    [slots, shield.slots, seed, mission.id],
  );
  const preview = result ? { guard: result.guard, doubt: result.doubt } : shieldPreview(shield, picks);
  const ready = slots.every((s) => picks[s]);
  const pickedTiles = slots.map((s) => shield.slots[s].find((t) => t.id === picks[s])).filter((t): t is ShieldTile => Boolean(t));
  const canRetry = result && result.outcome !== 'success' && tries < maxTries;
  const beaconLit = Boolean(beacon?.used);

  useEffect(() => {
    if (result) replyRef.current?.focus();
    else setDelta(null);
  }, [result]);

  const pick = (slot: ShieldSlot, tileId: string) => {
    const before = shieldPreview(shield, picks);
    const after = shieldPreview(shield, { ...picks, [slot]: tileId });
    setDelta({ guard: after.guard - before.guard, doubt: after.doubt - before.doubt });
    onPick(slot, tileId);
  };

  return (
    <div className="msn-phase msn-shield">
      <p className="msn-shield__banner">{shield.timeLabel}</p>
      <PhaseHeading kicker="D · Defend Your Community" title={`Help ${friend}`}>
        <p className="msn-phase__sub">{shield.setup}</p>
      </PhaseHeading>

      <ol className="msn-chat msn-shield__chat" aria-label={`Messages from ${friend}`}>
        {shield.messages.map((m, i) => (
          <li key={i} className="msn-chat__row" data-side="in">
            <span className="msn-avatar" aria-hidden="true">
              {initials(castName(mission, m.from))}
            </span>
            <div className="msn-bubble msn-bubble--chat msn-bubble--in">
              <span className="msn-bubble__who">{castName(mission, m.from)}</span>
              <span className="msn-bubble__text">{m.text}</span>
            </div>
          </li>
        ))}
      </ol>

      <div className="msn-shield__meters" aria-live="polite">
        <MeterBar kind="guard" value={preview.guard} delta={delta?.guard} friend={friend} />
        <MeterBar kind="doubt" value={preview.doubt} delta={delta?.doubt} friend={friend} />
      </div>

      {beacon?.unfolded && !beacon.used && !result && (
        <button type="button" className="msn-guardians__btn" data-guardian="beacon" onClick={beacon.onUse}>
          <Icon name="spark" />
          <span>
            <strong>Beacon: Safe Channel</strong>
            <small>Lights up the trusted channel and dims the decoy</small>
          </span>
        </button>
      )}

      {!result && (
        <div className="msn-shield__builder">
          {slots.map((slot, n) => (
            <fieldset key={slot} className="msn-slot">
              <legend className="msn-slot__legend">
                <span className="msn-slot__n">{n + 1}</span> {SHIELD_SLOT_LABEL[slot].title}
                <small>{SHIELD_SLOT_LABEL[slot].hint}</small>
              </legend>
              <div className="msn-slot__tiles">
                {dealt[slot].map((tile) => {
                  const lit = beaconLit && slot === 'channel' ? (tile.quality === 'great' ? 'lit' : tile.quality === 'harmful' ? 'dim' : undefined) : undefined;
                  return (
                    <label key={tile.id} className="msn-tile" data-beacon={lit}>
                      <input
                        type="radio"
                        name={`${uid}-${slot}`}
                        value={tile.id}
                        checked={picks[slot] === tile.id}
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
          ))}

          <div className="msn-shield__preview" aria-live="polite">
            <p className="msn-shield__preview-label">{me}'s message</p>
            <div className="msn-bubble msn-bubble--chat msn-bubble--out">
              <span className="msn-bubble__text">
                {pickedTiles.length > 0 ? pickedTiles.map((t) => t.text).join(' ') : 'Pick a tile in each part to build the message.'}
              </span>
            </div>
          </div>

          <Button size="lg" block icon="chat" disabled={!ready} onClick={onSend}>
            Send to {friend}
          </Button>
        </div>
      )}

      {result && (
        <div className="msn-shield__result">
          <div ref={replyRef} tabIndex={-1} className="msn-shield__reply" role="status">
            <StatusBadge status={OUTCOME[result.outcome].status} label={`${friend}: ${OUTCOME[result.outcome].word}`} />
            <div className="msn-bubble msn-bubble--chat msn-bubble--in">
              <span className="msn-bubble__text">{shield.outcomes[result.outcome]}</span>
            </div>
          </div>

          <h3 className="msn-section-title">Why each part landed the way it did</h3>
          <ul className="msn-shield__why">
            {result.tiles.map((t) => (
              <li key={t.id}>
                <StatusBadge status={QUALITY[t.quality].status} label={QUALITY[t.quality].word} />
                <span>
                  <q>{t.text}</q> {t.why}
                </span>
              </li>
            ))}
          </ul>

          <div className="msn-shield__actions">
            {canRetry && (
              <Button variant="secondary" block icon="rewind" onClick={onRetry}>
                Try again
              </Button>
            )}
            {!hideContinue && (
              <Button size="lg" block iconRight="arrowRight" onClick={onContinue}>
                See what you learned
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
