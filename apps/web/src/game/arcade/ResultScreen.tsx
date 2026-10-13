// End of a mini-game round: score, what to remember, Stars (round, streak, tile, badges) and where to go next.
import { m } from 'motion/react';
import {
  BADGES,
  CLAIM_SCORE,
  DISTRICTS,
  STARS,
  miniGameStars,
  skillById,
  tileById,
  type MiniGameInfo,
  type RewardEvent,
} from '@shieldquest/shared';
import { Button, LinkButton } from '../../ui/Button';
import { StatusShape } from '../../ui/StatusBadge';
import { GAME_ACCENT, StarGlyph, useFocusOnMount, type GameOutcome } from './shared';

export type ArcadeFrom = 'board' | 'explore' | null;

function headline(score: number): string {
  if (score >= 1) return 'Perfect round!';
  if (score >= CLAIM_SCORE) return 'Sharp eyes!';
  if (score >= 0.4) return 'Good effort!';
  return 'Every round makes you sharper';
}

function ScoreRing({ score }: { score: number }) {
  const r = 34;
  const len = 2 * Math.PI * r;
  return (
    <svg className="arc-ring" width="92" height="92" viewBox="0 0 80 80" aria-hidden="true" focusable="false">
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="7" />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke="var(--arc-accent, var(--gold))"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${len * score} ${len}`}
        transform="rotate(-90 40 40)"
      />
      <text x="40" y="46" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="18" fill="var(--text)">
        {Math.round(score * 100)}%
      </text>
    </svg>
  );
}

export function ResultScreen({
  game,
  outcome,
  event,
  isDaily,
  from,
  onPlayAgain,
}: {
  game: MiniGameInfo;
  outcome: GameOutcome;
  event: RewardEvent;
  isDaily: boolean;
  from: ArcadeFrom;
  onPlayAgain: () => void;
}) {
  const headRef = useFocusOnMount<HTMLHeadingElement>();
  const roundStars = miniGameStars(outcome.score, isDaily);
  const skill = skillById(game.skill);
  const claimedTile = event.claimed ? tileById(event.claimed) : undefined;
  const secured = event.secured ? DISTRICTS.find((d) => d.id === event.secured) : undefined;
  const badges = event.badges.map((b) => BADGES.find((x) => x.id === b)).filter((b) => b !== undefined);
  // A board tile was waiting for this game (a roll came back) but the score was under the claim line.
  const missedClaim = from === 'board' && !event.claimed && event.rolls > 0 && outcome.score < CLAIM_SCORE;

  const lines: { label: string; stars: number; tag?: string }[] = [{ label: 'Round score', stars: roundStars, tag: isDaily ? '×2 Today’s pick' : undefined }];
  if (event.streakBonus > 0) lines.push({ label: 'Daily streak bonus', stars: event.streakBonus });
  if (event.claimed) lines.push({ label: 'Tile claimed', stars: STARS.claimTile });
  if (event.secured) lines.push({ label: 'District secured', stars: STARS.secureDistrict });

  return (
    <div className="arc-result" style={{ ['--arc-accent' as string]: GAME_ACCENT[game.id] }}>
      <section className="arc-result__score">
        <ScoreRing score={outcome.score} />
        <div>
          <p className="kicker">{game.name}</p>
          <h2 ref={headRef} tabIndex={-1}>
            {headline(outcome.score)}
          </h2>
          <p className="arc-result__count">
            <strong>
              {outcome.right} of {outcome.total}
            </strong>{' '}
            {outcome.unit}
          </p>
        </div>
      </section>

      <m.section
        className="arc-result__stars"
        aria-labelledby="arc-stars-h"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      >
        <h3 id="arc-stars-h">
          <StarGlyph size={28} />
          <span>
            +{event.stars} Stars<span className="sr-only"> earned</span>
          </span>
        </h3>
        <ul className="arc-result__lines">
          {lines.map((l) => (
            <li key={l.label}>
              <span>
                {l.label}
                {l.tag && <span className="arc-tag arc-tag--gold">{l.tag}</span>}
              </span>
              <strong>+{l.stars}</strong>
            </li>
          ))}
          {event.rolls > 0 && (
            <li>
              <span>City Board roll back</span>
              <strong>+{event.rolls}</strong>
            </li>
          )}
        </ul>
        {claimedTile && (
          <p className="arc-result__claim">
            <StatusShape status="safe" size={20} /> Tile claimed! {claimedTile.label}
            {claimedTile.district ? ` in ${DISTRICTS.find((d) => d.id === claimedTile.district)?.name ?? ''}` : ''} is yours.
          </p>
        )}
        {secured && (
          <p className="arc-result__claim">
            <StatusShape status="safe" size={20} /> {secured.name} is secured!
          </p>
        )}
        {missedClaim && (
          <p className="arc-result__note">
            Score {Math.round(CLAIM_SCORE * 100)}% or more to claim a tile. Land here again for another go.
          </p>
        )}
        {badges.length > 0 && (
          <ul className="arc-result__badges" aria-label="New badges">
            {badges.map((b) => (
              <li key={b.id}>
                <span className="arc-badge" aria-hidden="true">
                  <StarGlyph size={18} />
                </span>
                <span>
                  <strong>Badge: {b.name}</strong>
                  <small>{b.how}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </m.section>

      <section className="arc-result__learn" aria-labelledby="arc-learn-h">
        <h3 id="arc-learn-h">What to remember</h3>
        <p>{outcome.lesson}</p>
        <p className="arc-result__skill">
          <span className="arc-skill" aria-hidden="true">
            {skill.id}
          </span>
          <span>
            You practised <strong>{skill.name}</strong>.
          </span>
        </p>
        <details className="arc-review">
          <summary>Go over every answer</summary>
          <ul>
            {outcome.review.map((r) => (
              <li key={r.id}>
                <StatusShape status={r.ok ? 'safe' : 'attention'} size={18} />
                <span>
                  <strong>
                    {r.title}
                    <span className="sr-only">{r.ok ? ' (you got this)' : ' (missed)'}</span>
                  </strong>
                  <small>{r.detail}</small>
                </span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <div className="arc-actions arc-actions--end">
        {from === 'board' && (
          <LinkButton href="/play/board" size="lg" icon="map">
            Back to the board
          </LinkButton>
        )}
        {from === 'explore' && (
          <LinkButton href="/play/explore" size="lg" icon="pin">
            Back to exploring
          </LinkButton>
        )}
        <Button variant={from ? 'secondary' : 'primary'} size="lg" icon="rewind" onClick={onPlayAgain}>
          Play again
        </Button>
        <LinkButton href="/play/arcade" variant="secondary" size="lg" icon="arrowLeft">
          Back to the Arcade
        </LinkButton>
      </div>
    </div>
  );
}
