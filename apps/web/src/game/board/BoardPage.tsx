// /play/board: the City Board. A ring of 21 tiles around ShieldQuest City (DOM + SVG, no WebGL, so it runs on
// any school phone). Roll the die to move, then play the tile you land on to claim it for your district.
// The die only moves your token: nothing here is bought, and Stars are earned by playing.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import {
  BOARD,
  BOARD_DISTRICTS,
  DAILY_ROLLS,
  GAME,
  MAX_ROLLS,
  STARS,
  dailyMiniGame,
  dayKey,
  districtById,
  miniGameById,
  tileById,
} from '@shieldquest/shared';
import { useProgress } from '../../state/progress';
import { useRewards } from '../../state/rewards';
import { useSettings } from '../../state/settings';
import { LinkButton } from '../../ui/Button';
import { HelpButton } from '../../ui/HelpPanel';
import { Icon } from '../../ui/Icon';
import { SettingsButton } from '../../ui/SettingsPanel';
import { Sheet } from '../../ui/Sheet';
import { StatusBadge } from '../../ui/StatusBadge';
import { DistrictPlate, MotionRoot, useReducedMotionSetting, useSfx } from '../hub/kit';
import { DieGlyph, FlameGlyph, StarGlyph } from '../rewards/glyphs';
import { RewardToast } from '../rewards/RewardToast';
import { liveStreak } from '../rewards/live';
import { TokenArt } from '../rewards/tokens';
import { BoardGlyph } from './BoardGlyph';
import {
  TILE_RADIUS,
  TOKEN_RADIUS,
  boardProgress,
  districtArc,
  isCorner,
  landingSentence,
  ringPoint,
  tileAria,
  tileGlyph,
  tileName,
} from './boardData';
import { TileCard } from './TileCard';
import '../hub/kit.css';
import './board.css';

const DICE_MS = 650;
const DICE_FRAME_MS = 80;
const HOP_MS = 300;

type Phase = 'idle' | 'dice' | 'moving';

function CityBoard() {
  const rewards = useRewards((s) => s.rewards);
  const progress = useProgress((s) => s.progress);
  const band = useSettings((s) => s.band);
  const reduced = useReducedMotionSetting();
  const sfx = useSfx();

  const [shownPos, setShownPos] = useState(rewards.position);
  const [phase, setPhase] = useState<Phase>('idle');
  const [face, setFace] = useState(5);
  const [hop, setHop] = useState(0);
  const [card, setCard] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [note, setNote] = useState<{ id: number; text: string; detail?: string } | null>(null);
  const timers = useRef<number[]>([]);
  const rollRef = useRef<HTMLButtonElement>(null);

  const today = dayKey(Date.now());
  const streak = liveStreak(rewards);
  const daily = dailyMiniGame(today);
  const dailyInfo = miniGameById(daily);
  const districts = useMemo(() => boardProgress(rewards.claimed), [rewards.claimed]);
  const landed = rewards.landed ? tileById(rewards.landed) ?? null : null;
  const cardTile = card ? tileById(card) ?? null : null;
  const busy = phase !== 'idle';
  const canRoll = !busy && !rewards.landed && rewards.rolls > 0;

  useEffect(() => {
    const before = document.title;
    document.title = 'City Board · ShieldQuest';
    return () => {
      document.title = before;
    };
  }, []);

  // Daily free rolls (once per Singapore day; never removes banked rolls).
  useEffect(() => {
    const added = useRewards.getState().topUp();
    if (added > 0) setNote({ id: Date.now(), text: `+${added} daily ${added === 1 ? 'roll' : 'rolls'}`, detail: 'Fresh rolls for today.' });
  }, []);

  // Keep the token in sync when the position changes outside an animation (e.g. a reset in Settings).
  useEffect(() => {
    if (phase === 'idle') setShownPos(rewards.position);
  }, [rewards.position, phase]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const finish = useCallback(
    (die: number, passedHq: boolean) => {
      setPhase('idle');
      const s = useRewards.getState().rewards;
      const tile = BOARD[s.position]!;
      setAnnounce(landingSentence(die, tile, passedHq));
      if (s.landed) {
        sfx('reveal');
        setCard(s.landed);
      } else {
        sfx(tile.kind === 'bonus' ? 'success' : 'tap');
        rollRef.current?.focus();
      }
    },
    [sfx],
  );

  const onRoll = () => {
    if (!canRoll) return;
    const before = useRewards.getState().rewards.position;
    const r = useRewards.getState().roll();
    if (!r) return;
    const passedHq = before + r.die >= BOARD.length;
    sfx('tap');
    setAnnounce('Rolling the die…');
    if (reduced) {
      setFace(r.die);
      setShownPos(r.path[r.path.length - 1]!);
      setPhase('moving');
      later(() => finish(r.die, passedHq), 60);
      return;
    }
    setPhase('dice');
    const frames = Math.floor(DICE_MS / DICE_FRAME_MS);
    for (let f = 0; f < frames; f++) {
      later(() => setFace(((r.die + f * 5) % 6) + 1), f * DICE_FRAME_MS);
    }
    later(() => {
      setFace(r.die);
      setPhase('moving');
    }, DICE_MS);
    r.path.forEach((p, i) => {
      later(
        () => {
          setShownPos(p);
          setHop((h) => h + 1);
          sfx('tick', { step: i });
        },
        DICE_MS + 120 + i * HOP_MS,
      );
    });
    later(() => finish(r.die, passedHq), DICE_MS + 120 + r.path.length * HOP_MS + 120);
  };

  const onSkip = () => {
    useRewards.getState().skip();
    sfx('tap');
    setCard(null);
    setAnnounce('Tile skipped. Roll again when you are ready.');
    later(() => rollRef.current?.focus(), 40);
  };

  const closeCard = () => {
    const stillPending = useRewards.getState().rewards.landed === card;
    setCard(null);
    if (stillPending) setAnnounce('Your tile is waiting. Open it again from the middle of the board.');
    later(() => rollRef.current?.focus(), 40);
  };

  const tokenAt = ringPoint(shownPos, TOKEN_RADIUS);
  const centreHint = busy
    ? phase === 'dice'
      ? 'Rolling…'
      : 'Moving…'
    : landed
      ? 'Finish or skip your tile'
      : rewards.rolls > 0
        ? 'Tap to roll'
        : 'No rolls left today';

  return (
    <div className="brd" data-anim={reduced ? 'off' : 'on'}>
      <header className="brd-top">
        <div className="brd-top__bar">
          <Link href="/play" className="brd-back">
            <Icon name="arrowLeft" />
            <span className="brd-back__text">
              City<span className="sr-only">: back to ShieldQuest City</span>
            </span>
          </Link>
          <h1 className="brd-top__title">City Board</h1>
          <div className="brd-top__tools">
            <Link href="/play/locker" className="ui-iconbtn" aria-label="Locker: tokens, colours, titles and badges" title="Locker">
              <TokenArt id={rewards.equipped.token} color={rewards.equipped.color} size={28} />
            </Link>
            <SettingsButton />
            <HelpButton />
          </div>
        </div>
        <ul className="brd-stats" aria-label="Your rewards">
          <li className="hub-chip" title="Stars are earned by playing. You can't buy them.">
            <StarGlyph size={18} />
            <span>{rewards.stars}</span>
            <span className="hub-chip__word">Stars</span>
          </li>
          <li className="hub-chip" title="Play a challenge each day to keep your streak.">
            <FlameGlyph size={18} lit={streak > 0} />
            <span>{streak}</span>
            <span className="hub-chip__word">day streak</span>
          </li>
          <li className="hub-chip">
            <DieGlyph size={18} face={3} />
            <span>{rewards.rolls}</span>
            <span className="hub-chip__word">{rewards.rolls === 1 ? 'roll' : 'rolls'}</span>
          </li>
        </ul>
      </header>

      <main id="main" className="brd-main">
        <section className="brd-boardwrap" aria-labelledby="brd-board-title">
          <h2 id="brd-board-title" className="sr-only">
            The board
          </h2>
          <div className="brd-ring">
            <svg className="brd-track" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
              <circle cx="50" cy="50" r={TILE_RADIUS} className="brd-track__base" />
              {BOARD_DISTRICTS.map((d) => (
                <path key={d} d={districtArc(d)} className="brd-track__arc" style={{ stroke: districtById(d).color }} />
              ))}
              <circle cx="50" cy="50" r={TILE_RADIUS - 8.5} className="brd-track__inner" />
            </svg>

            <ol className="brd-tiles" aria-label={`Board tiles, ${BOARD.length} in a loop`}>
              {BOARD.map((t, i) => {
                const p = ringPoint(i, TILE_RADIUS);
                const claimed = rewards.claimed.includes(t.id);
                const here = i === shownPos;
                const d = t.district ? districtById(t.district) : null;
                const cls = [
                  'brd-tile',
                  isCorner(t) ? 'brd-tile--corner' : '',
                  `brd-tile--${t.kind}`,
                  claimed ? 'is-claimed' : '',
                  here ? 'is-here' : '',
                  rewards.landed === t.id && !busy ? 'is-landed' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <li
                    key={t.id}
                    className={cls}
                    style={{ left: `${p.x}%`, top: `${p.y}%`, ['--tile-c' as string]: d?.color ?? 'var(--gold)' }}
                    aria-label={tileAria(t, i, claimed, here)}
                  >
                    <BoardGlyph glyph={tileGlyph(t)} size="58%" />
                    {claimed && (
                      <span className="brd-tile__check" aria-hidden="true">
                        <Icon name="check" size="100%" />
                      </span>
                    )}
                    {t.kind === 'minigame' && t.minigame === daily && !claimed && (
                      <span className="brd-tile__x2" aria-hidden="true">
                        ×2
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>

            <div
              className="brd-token"
              style={{ left: `${tokenAt.x}%`, top: `${tokenAt.y}%` }}
              data-moving={phase === 'moving' ? 'true' : undefined}
              aria-hidden="true"
            >
              <span key={hop} className="brd-token__hop">
                <TokenArt id={rewards.equipped.token} color={rewards.equipped.color} size="100%" />
              </span>
            </div>

            <div className="brd-centre">
              {landed && !busy ? (
                <button type="button" className="brd-dice brd-dice--tile" onClick={() => setCard(landed.id)} ref={rollRef}>
                  <span className="brd-dice__face brd-dice__face--tile">
                    <BoardGlyph glyph={tileGlyph(landed)} size="62%" />
                  </span>
                  <span className="brd-dice__label">Open tile</span>
                  <span className="sr-only">: {tileName(landed)}. Finish or skip it to roll again.</span>
                </button>
              ) : (
                <button
                  type="button"
                  ref={rollRef}
                  className="brd-dice"
                  onClick={onRoll}
                  disabled={!canRoll}
                  aria-describedby="brd-centre-hint"
                  data-rolling={phase === 'dice' ? 'true' : undefined}
                >
                  <span className="brd-dice__face">
                    <DieGlyph size="100%" face={face} />
                  </span>
                  <span className="brd-dice__label">Roll</span>
                </button>
              )}
              <p className="brd-centre__rolls">
                <strong>{rewards.rolls}</strong> {rewards.rolls === 1 ? 'roll' : 'rolls'} left
              </p>
              <p id="brd-centre-hint" className="brd-centre__hint">
                {centreHint}
              </p>
            </div>
          </div>

          <ul className="brd-legend" aria-label="Tile key">
            <li>
              <span className="brd-legend__tile">
                <BoardGlyph glyph="wordsearch" size={16} />
              </span>
              Mini-game
            </li>
            <li>
              <span className="brd-legend__tile">
                <BoardGlyph glyph="mission" size={16} />
              </span>
              Mission
            </li>
            <li>
              <span className="brd-legend__tile">
                <BoardGlyph glyph="chance" size={16} />
              </span>
              Signal Check
            </li>
            <li>
              <span className="brd-legend__tile is-claimed">
                <BoardGlyph glyph="mission" size={16} />
                <span className="brd-tile__check">
                  <Icon name="check" size="100%" />
                </span>
              </span>
              Claimed
            </li>
          </ul>
        </section>

        <aside className="brd-side" aria-label="Today and districts">
          {rewards.rolls === 0 && !landed && !busy && (
            <section className="brd-panel brd-panel--paper" aria-labelledby="brd-out-title">
              <h2 id="brd-out-title" className="brd-panel__title">
                Out of rolls
              </h2>
              <p>
                Come back tomorrow for {DAILY_ROLLS} free rolls, or earn rolls now: every finished mini-game or mission gives one back
                (up to {MAX_ROLLS}).
              </p>
              <div className="hub-sheet-actions">
                <LinkButton href="/play/arcade" icon="play">
                  Arcade
                </LinkButton>
                <LinkButton href="/play" variant="secondary" icon="map">
                  Play a mission
                </LinkButton>
              </div>
            </section>
          )}

          <section className="brd-panel brd-panel--paper" aria-labelledby="brd-daily-title">
            <p className="brd-panel__kicker">
              <Icon name="spark" size="1em" /> Mini-game of the day
            </p>
            <h2 id="brd-daily-title" className="brd-panel__title">
              {dailyInfo.name}{' '}
              <span className="brd-x2">
                <StarGlyph size={14} /> ×2 Stars
              </span>
            </h2>
            <p>{dailyInfo.pitch}</p>
            <LinkButton href={`/play/arcade/${daily}`} icon="play" size="sm">
              Play now<span className="sr-only">: {dailyInfo.name}</span>
            </LinkButton>
          </section>

          <section className="brd-panel" aria-labelledby="brd-districts-title">
            <h2 id="brd-districts-title" className="brd-panel__title">
              Districts
            </h2>
            <p className="brd-panel__sub">Claim all 6 tiles to secure a district (+{STARS.secureDistrict} Stars).</p>
            <ul className="brd-districts">
              {districts.map((d) => (
                <li key={d.district} className={d.secured ? 'is-secured' : undefined}>
                  <DistrictPlate district={d.district} color={d.color} size={34} />
                  <div className="brd-districts__text">
                    <span className="brd-districts__name">{d.name}</span>
                    <span className="brd-meter" aria-hidden="true" style={{ ['--tile-c' as string]: d.color }}>
                      {Array.from({ length: d.total }, (_, i) => (
                        <span key={i} className={i < d.claimed ? 'is-on' : undefined} />
                      ))}
                    </span>
                  </div>
                  {d.secured ? (
                    <StatusBadge status="safe" label="Secured" />
                  ) : (
                    <span className="brd-districts__count">
                      {d.claimed}/{d.total}
                      <span className="sr-only"> tiles claimed</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <details className="brd-panel brd-rules">
            <summary>How the board works</summary>
            <ul>
              <li>You get {DAILY_ROLLS} free rolls each day. Finishing a tile gives a roll back.</li>
              <li>Land on a tile, then play it. Do well to claim it for its district.</li>
              <li>Passing HQ: +{STARS.passHq} Stars. Hawker Break: +{STARS.bonusTile} Stars.</li>
              <li>You can always skip a tile. There is no penalty.</li>
              <li>Stars are earned by playing. You can't buy them. Spend them on looks in your Locker.</li>
            </ul>
          </details>

          <p className="ui-disclaimer brd-disclaimer">{GAME.disclaimer}</p>
        </aside>
      </main>

      <Sheet open={Boolean(cardTile)} onClose={closeCard} title={cardTile ? tileName(cardTile) : 'Tile'}>
        {cardTile && (
          <TileCard
            key={cardTile.id}
            tile={cardTile}
            pending={rewards.landed === cardTile.id}
            claimed={rewards.claimed.includes(cardTile.id)}
            band={band}
            progress={progress}
            dailyGame={daily}
            onSkip={onSkip}
            onClose={closeCard}
          />
        )}
      </Sheet>

      <RewardToast hold={busy || Boolean(cardTile)} note={note} />
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

export default function BoardPage() {
  return (
    <MotionRoot>
      <CityBoard />
    </MotionRoot>
  );
}
