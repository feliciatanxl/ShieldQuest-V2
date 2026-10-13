// /play/arcade: three quick games that earn Stars. Today's pick pays double.
import { useEffect, useState } from 'react';
import { m } from 'motion/react';
import { MINI_GAMES, dailyMiniGame, dayKey, skillById, type MiniGameId, type RewardsState } from '@shieldquest/shared';
import { useRewards } from '../../state/rewards';
import { LinkButton } from '../../ui/Button';
import { StatusShape } from '../../ui/StatusBadge';
import { MotionRoot, useReducedMotionSetting } from '../hub/kit';
import { ArcadeTop } from './ArcadeTop';
import { GAME_ACCENT, GameArt, StarGlyph, readArcadeStats, type ArcadeStats } from './shared';
import '../hub/kit.css';
import './arcade.css';

const MINUTES: Record<MiniGameId, string> = {
  wordsearch: '1–2 min',
  'real-or-fake': '2 min',
  'money-trail': '1–2 min',
};

/** Badge progress per game, from the rewards stats (the source of truth for badges). */
function badgeLine(game: MiniGameId, r: RewardsState): { text: string; done: boolean } {
  switch (game) {
    case 'wordsearch':
      return r.badges.includes('wordsearch-ace')
        ? { text: `Wordsearch Ace badge earned · ${r.stats.wordsearchPerfect} perfect`, done: true }
        : { text: 'Find every word in a round for the Wordsearch Ace badge', done: false };
    case 'real-or-fake':
      return r.badges.includes('fake-spotter')
        ? { text: `Fake Spotter badge earned · ${r.stats.fakeCorrect} cards called right`, done: true }
        : { text: `Fake Spotter badge: ${Math.min(r.stats.fakeCorrect, 25)} of 25 cards called right`, done: false };
    case 'money-trail':
      return r.badges.includes('trail-tracer')
        ? { text: `Trail Tracer badge earned · ${r.stats.trailRuns} trails`, done: true }
        : { text: `Trail Tracer badge: ${Math.min(r.stats.trailRuns, 3)} of 3 trails finished`, done: false };
  }
}

export default function ArcadePage() {
  const rewards = useRewards((s) => s.rewards);
  const reduced = useReducedMotionSetting();
  const [stats] = useState<ArcadeStats>(readArcadeStats);
  const today = dailyMiniGame(dayKey(Date.now()));

  useEffect(() => {
    const before = document.title;
    document.title = 'Arcade · ShieldQuest';
    return () => {
      document.title = before;
    };
  }, []);

  return (
    <MotionRoot>
      <div className="arc" data-anim={reduced ? 'off' : 'on'}>
        <ArcadeTop back="/play" backLabel="City" title="Arcade" />
        <main id="main" className="arc-main">
          <section className="arc-hero">
            <p className="kicker">ShieldQuest Arcade</p>
            <h2>Quick games. Real skills.</h2>
            <p className="arc-hero__lead">Two-minute rounds that train your scam radar. Earn Stars, keep your streak going.</p>
            <ul className="arc-summary">
              <li>
                <StarGlyph size={18} />
                <strong>{rewards.stars}</strong> Stars
              </li>
              <li>
                <strong>{rewards.streak}</strong> day streak
              </li>
              <li>
                Today&rsquo;s pick: <strong>{MINI_GAMES.find((g) => g.id === today)?.name}</strong>
              </li>
            </ul>
          </section>

          <ul className="arc-cards">
            {MINI_GAMES.map((g, i) => {
              const s = stats[g.id];
              const skill = skillById(g.skill);
              const badge = badgeLine(g.id, rewards);
              const isToday = g.id === today;
              return (
                <m.li
                  key={g.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 * i, duration: 0.3 }}
                >
                  <article className={`arc-card${isToday ? ' is-today' : ''}`} style={{ ['--arc-accent' as string]: GAME_ACCENT[g.id] }} aria-labelledby={`arc-card-${g.id}`}>
                    {isToday && (
                      <p className="arc-card__today">
                        <StarGlyph size={16} /> Today&rsquo;s pick ×2 Stars
                      </p>
                    )}
                    <div className="arc-card__top">
                      <span className="arc-card__art">
                        <GameArt game={g.id} size={64} />
                      </span>
                      <div>
                        <h3 id={`arc-card-${g.id}`}>{g.name}</h3>
                        <p className="arc-card__pitch">{g.pitch}</p>
                      </div>
                    </div>
                    <p className="arc-card__meta">
                      <span className="arc-skill-chip">
                        <span className="arc-skill" aria-hidden="true">
                          {skill.id}
                        </span>
                        {skill.name}
                      </span>
                      <span className="arc-card__mins">{MINUTES[g.id]}</span>
                    </p>
                    <dl className="arc-card__stats">
                      <div>
                        <dt>Best</dt>
                        <dd>{s ? `${Math.round(s.best * 100)}%` : '–'}</dd>
                      </div>
                      <div>
                        <dt>Played</dt>
                        <dd>{s ? s.plays : 0}</dd>
                      </div>
                    </dl>
                    <p className="arc-card__badge">
                      <StatusShape status={badge.done ? 'safe' : 'unknown'} size={16} />
                      {badge.text}
                    </p>
                    <LinkButton href={`/play/arcade/${g.id}`} size="lg" block iconRight="play">
                      Play<span className="sr-only"> {g.name}</span>
                    </LinkButton>
                  </article>
                </m.li>
              );
            })}
          </ul>

          <section className="arc-more">
            <p>Stars unlock tokens, colours and titles in your Locker. Mini-games on the City Board can claim tiles too.</p>
            <div className="arc-actions">
              <LinkButton href="/play/board" variant="secondary" icon="map">
                City Board
              </LinkButton>
              <LinkButton href="/play/locker" variant="secondary" icon="spark">
                Locker
              </LinkButton>
            </div>
          </section>
        </main>
      </div>
    </MotionRoot>
  );
}
