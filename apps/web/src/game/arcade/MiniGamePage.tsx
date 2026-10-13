// /play/arcade/:game — one round of a mini-game for the player's band, then the result screen.
// Stars are recorded exactly once, the moment a round is decided. Leaving mid-round records nothing.
// ?from=board or ?from=explore adds a "Back to ..." button (the board claims its landed tile itself).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearch } from 'wouter';
import {
  BANDS,
  MINI_GAMES,
  dailyMiniGame,
  dayKey,
  mulberry32,
  pickRound,
  roundIds,
  type BandId,
  type MiniGameId,
  type MiniGameInfo,
  type MiniGameRound,
  type RewardEvent,
} from '@shieldquest/shared';
import { useRewards } from '../../state/rewards';
import { useSettings } from '../../state/settings';
import { Button, LinkButton } from '../../ui/Button';
import { MotionRoot, useReducedMotionSetting } from '../hub/kit';
import { ArcadeTop } from './ArcadeTop';
import { MoneyTrail } from './games/MoneyTrail';
import { RealOrFake } from './games/RealOrFake';
import { Wordsearch } from './games/Wordsearch';
import { ResultScreen, type ArcadeFrom } from './ResultScreen';
import { GAME_ACCENT, newSeed, readRecent, rememberRecent, saveArcadePlay, type GameOutcome } from './shared';
import '../hub/kit.css';
import './arcade.css';

const HOW: Record<MiniGameId, string> = {
  wordsearch: 'Read the message, then find its red-flag words in the grid.',
  'real-or-fake': 'Is each screen real or a scam? Look for the giveaway.',
  'money-trail': 'Follow the "easy money" and pick what really happens at each stop.',
};

interface Dealt {
  round: MiniGameRound;
  seed: number;
  n: number;
}

function deal(game: MiniGameId, band: BandId, n: number): Dealt {
  const seed = newSeed();
  const round = pickRound(game, band, mulberry32(seed), readRecent(game));
  rememberRecent(game, roundIds(round));
  return { round, seed, n };
}

function useFrom(): ArcadeFrom {
  const search = useSearch();
  const from = new URLSearchParams(search).get('from');
  return from === 'board' || from === 'explore' ? from : null;
}

export default function MiniGamePage() {
  const params = useParams<{ game: string }>();
  const info = MINI_GAMES.find((g) => g.id === params.game);
  const band = useSettings((s) => s.band);

  useEffect(() => {
    const before = document.title;
    document.title = `${info?.name ?? 'Arcade'} · ShieldQuest`;
    return () => {
      document.title = before;
    };
  }, [info]);

  if (!info) return <UnknownGame />;
  return <MotionRoot>{band ? <Runner key={`${info.id}-${band}`} info={info} band={band} /> : <BandPick info={info} />}</MotionRoot>;
}

function Runner({ info, band }: { info: MiniGameInfo; band: BandId }) {
  const from = useFrom();
  const plain = useSettings((s) => s.plainLanguage);
  const gentle = useSettings((s) => s.gentle);
  const reduced = useReducedMotionSetting();
  const [dealt, setDealt] = useState<Dealt>(() => deal(info.id, band, 0));
  const [result, setResult] = useState<{ outcome: GameOutcome; event: RewardEvent; isDaily: boolean } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const recorded = useRef(-1);

  const onComplete = useCallback(
    (outcome: GameOutcome) => {
      // Exactly once per round, however a game reports it.
      if (recorded.current === dealt.n) return;
      recorded.current = dealt.n;
      const isDaily = dailyMiniGame(dayKey(Date.now())) === info.id;
      const event = useRewards.getState().miniGame({ game: info.id, score: outcome.score, correct: outcome.correct });
      // The result screen already shows this reward; don't replay it as a toast on the next page.
      useRewards.getState().clearEvent();
      saveArcadePlay(info.id, outcome.score);
      setResult({ outcome, event, isDaily });
    },
    [dealt.n, info.id],
  );

  const onResults = useCallback(() => {
    setShowResults(true);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const playAgain = () => {
    setDealt((d) => deal(info.id, band, d.n + 1));
    setResult(null);
    setShowResults(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const back = from === 'board' ? '/play/board' : from === 'explore' ? '/play/explore' : '/play/arcade';
  const backLabel = from === 'board' ? 'Board' : from === 'explore' ? 'Explore' : 'Arcade';
  const isDailyNow = dailyMiniGame(dayKey(Date.now())) === info.id;
  const common = {
    seed: dealt.seed,
    plain,
    gentle,
    reduced,
    onComplete,
    onResults,
  };

  return (
    <div className="arc" data-anim={reduced ? 'off' : 'on'} style={{ ['--arc-accent' as string]: GAME_ACCENT[info.id] }}>
      <ArcadeTop back={back} backLabel={backLabel} title={info.name} />
      <main id="main" className="arc-main arc-main--game">
        {showResults && result ? (
          <ResultScreen game={info} outcome={result.outcome} event={result.event} isDaily={result.isDaily} from={from} onPlayAgain={playAgain} />
        ) : (
          <>
            <p className="arc-how">
              {HOW[info.id]}
              {isDailyNow && <span className="arc-tag arc-tag--gold">Today&rsquo;s pick ×2 Stars</span>}
            </p>
            {dealt.round.game === 'wordsearch' && (
              <Wordsearch key={dealt.n} {...common} band={band} round={{ puzzle: dealt.round.puzzle }} />
            )}
            {dealt.round.game === 'real-or-fake' && <RealOrFake key={dealt.n} {...common} round={{ cards: dealt.round.cards }} />}
            {dealt.round.game === 'money-trail' && <MoneyTrail key={dealt.n} {...common} round={{ scenario: dealt.round.scenario }} />}
          </>
        )}
      </main>
    </div>
  );
}

/** First visit without a band (players normally choose one in onboarding). */
function BandPick({ info }: { info: MiniGameInfo }) {
  const set = useSettings((s) => s.set);
  return (
    <div className="arc">
      <ArcadeTop back="/play/arcade" backLabel="Arcade" title={info.name} />
      <main id="main" className="arc-main arc-main--game">
        <section className="arc-panel">
          <h2>Who&rsquo;s playing?</h2>
          <p>Pick your age group so the game fits you. You can change it any time in Settings.</p>
          <div className="arc-actions">
            {BANDS.map((b) => (
              <Button
                key={b.id}
                variant="paper"
                size="lg"
                onClick={() => set(b.id === 'junior' ? { band: b.id, plainLanguage: true } : { band: b.id })}
              >
                {b.label} ({b.ages})
              </Button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function UnknownGame() {
  return (
    <div className="arc">
      <ArcadeTop back="/play/arcade" backLabel="Arcade" title="Arcade" />
      <main id="main" className="arc-main arc-main--game">
        <section className="arc-panel">
          <h2>That game isn&rsquo;t here</h2>
          <p>The link may be a little off. All the games are in the Arcade.</p>
          <LinkButton href="/play/arcade" size="lg" icon="arrowLeft">
            Back to the Arcade
          </LinkButton>
        </section>
      </main>
    </div>
  );
}
