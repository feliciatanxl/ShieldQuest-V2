import { useEffect, useId, useRef, useState } from 'react';
import {
  findPersonalData,
  guardianById,
  guardianForSkill,
  skillById,
  type BandId,
  type GuardianId,
  type Mission,
  type RunSummary,
  type SkillId,
} from '@shieldquest/shared';
import { Button, LinkButton } from '../../../ui/Button';
import { HelpList } from '../../../ui/HelpPanel';
import { Icon } from '../../../ui/Icon';
import { StatusBadge } from '../../../ui/StatusBadge';
import type { RenderMode } from '../../../world';
import { GuardianStage } from '../parts/MissionStage';
import { SKILL_ORDER, skillRule, sortedBeats } from '../runLogic';
import { PhaseHeading } from './PhaseHeading';
import './phases.css';

export interface BondPhaseProps {
  mission: Mission;
  summary: RunSummary;
  levelUps: readonly { guardian: GuardianId; level: number }[];
  heldAtSec: number | null;
  /** The If-Then text saved on this device for this mission, if any. */
  savedIfThen?: string | null;
  onSaveIfThen: (text: string) => void;
  /** Next mission in the same district for this band, or null when the district is done. */
  nextHref: string | null;
  backHref?: string;
  onReplay: () => void;
  /** Plays the six-note motif with the lit letters (called once when the letters start lighting). */
  onMotif?: (lit: boolean[]) => void;
  /** A Guardian unfolds (sound). */
  onUnfold?: () => void;
  reduced?: boolean;
  renderMode?: RenderMode;
  /** Junior players get the rules in simpler words. */
  band?: BandId | null;
}

const LETTER_MS = 420;
const IF_THEN_MAX = 180;

export const ifThenText = (mission: Mission): string => `If ${mission.ifThen.if}, then I will ${mission.ifThen.then}.`;

/** Bond: S.H.I.E.L.D. letters light with the motif, Guardians unfold, LIVE vs HELD, the If-Then card and help. */
export function BondPhase({
  mission,
  summary,
  levelUps,
  heldAtSec,
  savedIfThen,
  onSaveIfThen,
  nextHref,
  backHref = '/play',
  onReplay,
  onMotif,
  onUnfold,
  reduced,
  renderMode,
  band = null,
}: BondPhaseProps) {
  const wildcard = mission.scaffold === 'wildcard';
  const [guess, setGuess] = useState<SkillId[]>([]);
  const [revealed, setRevealed] = useState(!wildcard);
  const [shown, setShown] = useState(0);
  const [text, setText] = useState(savedIfThen ?? ifThenText(mission));
  const [saved, setSaved] = useState(Boolean(savedIfThen));
  const [error, setError] = useState<string | null>(null);
  const motifPlayed = useRef(false);
  const ifThenId = useId();
  const lit = SKILL_ORDER.map((s) => summary.skills.includes(s));

  useEffect(() => {
    if (!revealed) return;
    if (!motifPlayed.current) {
      motifPlayed.current = true;
      onMotif?.(lit);
      if (levelUps.length > 0) window.setTimeout(() => onUnfold?.(), reduced ? 0 : SKILL_ORDER.length * LETTER_MS);
    }
    if (reduced) {
      setShown(SKILL_ORDER.length);
      return;
    }
    if (shown >= SKILL_ORDER.length) return;
    const id = window.setTimeout(() => setShown((n) => n + 1), LETTER_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, shown, reduced]);

  const firstUrgency = sortedBeats(mission).find((b) => b.tactic === 'urgency');
  const calmHold = heldAtSec !== null && (firstUrgency ? heldAtSec < firstUrgency.at : summary.heldEarly);
  // Private mirrors (GAME_DESIGN.md §8): Clean Hold = every genuine warning sign pinned.
  const cleanHold = summary.redFlagsTotal > 0 && summary.live + summary.held >= summary.redFlagsTotal;

  const save = () => {
    const found = findPersonalData(text);
    if (found.length > 0) {
      setError(`Please keep personal details out of your card: remove the ${found.join(', ')}.`);
      return;
    }
    const clean = text.trim();
    if (!clean) {
      setError('Write a short plan, or keep the suggested one.');
      return;
    }
    setError(null);
    onSaveIfThen(clean);
    setSaved(true);
  };

  return (
    <div className="msn-phase msn-bond">
      <PhaseHeading kicker="Bond" title="Moment saved">
        <p className="msn-phase__sub">Your letters are worked out on this device and stay private.</p>
      </PhaseHeading>

      {!revealed && (
        <section className="msn-bond__guess" aria-labelledby={`${ifThenId}-guess`}>
          <h3 id={`${ifThenId}-guess`} className="msn-section-title">
            Wildcard: which steps did you use?
          </h3>
          <p className="msn-phase__sub">Tap the letters you think you used, then see what lit up.</p>
          <ul className="msn-bond__guess-list">
            {SKILL_ORDER.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className="msn-chip"
                  aria-pressed={guess.includes(s)}
                  onClick={() => setGuess((g) => (g.includes(s) ? g.filter((x) => x !== s) : [...g, s]))}
                >
                  <strong>{s}</strong> {skillById(s).name}
                </button>
              </li>
            ))}
          </ul>
          <Button block icon="eye" onClick={() => setRevealed(true)}>
            Show me
          </Button>
        </section>
      )}

      {revealed && (
        <ol className="msn-letters" aria-label="S.H.I.E.L.D. letters this moment">
          {SKILL_ORDER.map((s, i) => {
            const on = lit[i] ?? false;
            const visible = i < shown;
            const skill = skillById(s);
            return (
              <li key={s} className="msn-letter" data-on={on && visible ? '' : undefined} data-visible={visible ? '' : undefined}>
                <span className="msn-letter__badge" aria-hidden="true">
                  {s}
                </span>
                <span className="msn-letter__body">
                  <span className="msn-letter__name">
                    {skill.name}
                    {wildcard && guess.includes(s) && <small> · you said you used it</small>}
                  </span>
                  {visible ? (
                    on ? (
                      <StatusBadge status="safe" label="Lit" />
                    ) : (
                      <span className="msn-letter__rule">
                        <StatusBadge status="unknown" label="Not this time" /> {skillRule(s, band)}
                      </span>
                    )
                  ) : (
                    <span className="sr-only">Lighting…</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {revealed && levelUps.length > 0 && (
        <section className="msn-unfold" aria-labelledby={`${ifThenId}-unfold`}>
          <h3 id={`${ifThenId}-unfold`} className="msn-section-title">
            {levelUps.length === 1 ? 'A Guardian unfolds' : 'Guardians unfold'}
          </h3>
          <ul className="msn-unfold__list">
            {levelUps.map(({ guardian, level }, i) => {
              const g = guardianById(guardian);
              const skill = skillById(g.skill);
              return (
                <li key={guardian} className="msn-unfold__item" style={{ ['--msn-guardian' as string]: g.color }}>
                  <GuardianStage
                    guardian={guardian}
                    level={level}
                    celebrate={level === 1}
                    size={6}
                    // One WebGL canvas at a time keeps older phones safe; the rest use the 2D origami.
                    renderMode={i === 0 ? renderMode : '2d'}
                  />
                  <div className="msn-unfold__text">
                    <p className="msn-unfold__name">
                      {g.name} {level === 1 ? 'unfolded!' : `grew to bond ${'I'.repeat(Math.min(3, level))}`}
                    </p>
                    <p>
                      <strong>Earned by {skill.name}:</strong> {skillRule(g.skill, band)}
                    </p>
                    <p>
                      <strong>Ability, {g.abilityName}:</strong> {g.ability} Once per moment.
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="msn-bond__stats" aria-label="Your private mirrors">
        <div className="msn-counter msn-paper">
          <div className="msn-counter__cell">
            <span className="msn-counter__num">{summary.live}</span>
            <span className="msn-counter__word">Seen live</span>
          </div>
          <span className="msn-counter__dot" aria-hidden="true">
            ·
          </span>
          <div className="msn-counter__cell" data-held="">
            <span className="msn-counter__num msn-counter__num--held">{summary.held}</span>
            <span className="msn-counter__word">Found while holding</span>
          </div>
        </div>
        <ul className="msn-mirrors">
          {calmHold && (
            <li>
              <Icon name="pause" /> <strong>Calm Hold:</strong> you held before the hurry even started.
            </li>
          )}
          {cleanHold && (
            <li>
              <Icon name="eye" /> <strong>Clean Hold:</strong> you pinned every genuine warning sign
              {summary.falseAlarms === 0 ? ', with no false alarms' : ''}.
            </li>
          )}
          {summary.changedMind && (
            <li>
              <Icon name="rewind" /> <strong>Changed your mind:</strong> you weighed new views before your final seal.
            </li>
          )}
          {!summary.heldEarly && (
            <li>
              <Icon name="clock" /> Next time, try pressing HOLD as soon as you feel rushed. {guardianForSkill('H').name} grows when you do.
            </li>
          )}
        </ul>
      </section>

      <section className="msn-ifthen msn-paper" aria-labelledby={`${ifThenId}-title`}>
        <h3 id={`${ifThenId}-title`} className="msn-ifthen__title">
          <Icon name="lock" /> Your If-Then card
        </h3>
        <p className="msn-ifthen__hint">A plan for real life, kept only on this device. Edit it so it sounds like you. No names or personal details.</p>
        <label htmlFor={`${ifThenId}-text`} className="sr-only">
          Your If-Then plan
        </label>
        <textarea
          id={`${ifThenId}-text`}
          className="msn-ifthen__text"
          value={text}
          maxLength={IF_THEN_MAX}
          rows={3}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
          aria-describedby={`${ifThenId}-status`}
        />
        <div className="msn-ifthen__row">
          <Button variant="paper" size="sm" icon={saved ? 'check' : 'pin'} onClick={save}>
            {saved ? 'Saved' : 'Save my card'}
          </Button>
          <span className="msn-ifthen__count" aria-hidden="true">
            {text.length}/{IF_THEN_MAX}
          </span>
        </div>
        <p id={`${ifThenId}-status`} className="msn-ifthen__status" role="status">
          {error ? (
            <>
              <StatusBadge status="attention" label="Check this" /> {error}
            </>
          ) : saved ? (
            'Saved on this device only.'
          ) : (
            ''
          )}
        </p>
      </section>

      <section className="msn-bond__help" aria-labelledby={`${ifThenId}-help`}>
        <h3 id={`${ifThenId}-help`} className="msn-section-title">
          If this happens for real
        </h3>
        <div className="msn-paper">
          <HelpList extra={mission.help} />
        </div>
      </section>

      <div className="msn-bond__actions">
        {nextHref && (
          <LinkButton href={nextHref} size="lg" block iconRight="arrowRight">
            Next moment
          </LinkButton>
        )}
        <LinkButton href={backHref} variant={nextHref ? 'secondary' : 'primary'} size="lg" block icon="map">
          Back to the city
        </LinkButton>
        <Button variant="ghost" block icon="rewind" onClick={onReplay}>
          Replay this moment
        </Button>
        <LinkButton href="/play/nightfall" variant="ghost" block icon="clock">
          Rest for today (Nightfall)
        </LinkButton>
      </div>
    </div>
  );
}
