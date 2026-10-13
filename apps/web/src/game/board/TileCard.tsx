// What to do on the tile you landed on: play the mini-game, play a mission, or answer a quick question.
// Skipping is always allowed and costs nothing.
import { useId, useState } from 'react';
import { Link } from 'wouter';
import {
  CLAIM_SCORE,
  STARS,
  districtById,
  miniGameById,
  miniGameStars,
  pickChance,
  type BandId,
  type BoardTile,
  type ChanceQuestion,
  type DistrictId,
  type MiniGameId,
  type Progress,
} from '@shieldquest/shared';
import { useRewards } from '../../state/rewards';
import { Button, LinkButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { StatusBadge } from '../../ui/StatusBadge';
import { DistrictPlate, readStored, writeStored } from '../hub/kit';
import { SCAFFOLD_LABEL } from '../hub/hubData';
import { StarGlyph } from '../rewards/glyphs';
import { BoardGlyph } from './BoardGlyph';
import { missionChoices, tileGlyph, tileKindWord } from './boardData';

const RECENT_KEY = 'sq.board.recentChance.v1';
const RECENT_MAX = 12;

export interface TileCardProps {
  tile: BoardTile;
  /** Still the landed tile (not yet finished or skipped). */
  pending: boolean;
  claimed: boolean;
  band: BandId | null;
  progress: Progress;
  dailyGame: MiniGameId;
  onSkip: () => void;
  onClose: () => void;
}

export function TileCard({ tile, pending, claimed, band, progress, dailyGame, onSkip, onClose }: TileCardProps) {
  const d = tile.district ? districtById(tile.district) : null;
  return (
    <div className="brd-card">
      <p className="brd-card__meta">
        {d ? (
          <DistrictPlate district={d.id} color={d.color} size={26} />
        ) : (
          <span className="brd-card__corner" aria-hidden="true">
            <BoardGlyph glyph={tileGlyph(tile)} size={18} />
          </span>
        )}
        <span>
          {tileKindWord(tile)}
          {d && ` · ${d.name}`}
        </span>
        {claimed && (
          <span className="brd-card__owned">
            <Icon name="check" size="1em" /> Claimed
          </span>
        )}
      </p>

      {tile.kind === 'minigame' && tile.minigame && (
        <MiniGameBody game={tile.minigame} daily={dailyGame === tile.minigame} claimed={claimed} pending={pending} />
      )}
      {tile.kind === 'mission' && tile.district && (
        <MissionBody district={tile.district} band={band} progress={progress} claimed={claimed} pending={pending} />
      )}
      {tile.kind === 'chance' && <ChanceBody band={band} claimable={Boolean(tile.district) && !claimed} pending={pending} onDone={onClose} />}

      {pending && (
        <div className="brd-card__skip">
          <Button variant="ghost" size="sm" icon="arrowRight" onClick={onSkip}>
            Skip this tile
          </Button>
          <p>No penalty. You can roll again straight away.</p>
        </div>
      )}
      {!pending && tile.kind !== 'chance' && (
        <div className="hub-sheet-actions">
          <Button variant="secondary" onClick={onClose}>
            Back to the board
          </Button>
        </div>
      )}
    </div>
  );
}

function ClaimLine({ claimed }: { claimed: boolean }) {
  return claimed ? (
    <p className="brd-card__note">
      <Icon name="check" size="1em" /> You already claimed this tile. Play again for Stars and a bonus roll.
    </p>
  ) : null;
}

function MiniGameBody({ game, daily, claimed, pending }: { game: MiniGameId; daily: boolean; claimed: boolean; pending: boolean }) {
  const info = miniGameById(game);
  const max = miniGameStars(1, daily);
  return (
    <>
      <p className="brd-card__lead">
        {info.pitch}
        {daily && (
          <span className="brd-x2">
            <StarGlyph size={14} /> ×2 today
          </span>
        )}
      </p>
      <ul className="brd-card__rules">
        <li>Up to {max} Stars{daily ? ' (double: it is the mini-game of the day)' : ''}.</li>
        {!claimed && <li>Score {Math.round(CLAIM_SCORE * 100)}% or more to claim this tile (+{STARS.claimTile} Stars).</li>}
        <li>Finishing gives you a roll back.</li>
      </ul>
      <ClaimLine claimed={claimed} />
      {pending && (
        <div className="hub-sheet-actions">
          <LinkButton href={`/play/arcade/${game}?from=board`} icon="play" size="lg">
            Play {info.name}
          </LinkButton>
        </div>
      )}
    </>
  );
}

function MissionBody({
  district,
  band,
  progress,
  claimed,
  pending,
}: {
  district: DistrictId;
  band: BandId | null;
  progress: Progress;
  claimed: boolean;
  pending: boolean;
}) {
  const choices = missionChoices(district, band, progress);
  const [first, ...others] = choices;
  if (!first) {
    return (
      <p className="brd-card__lead">
        No missions are open here yet. Skip this tile and roll again.
      </p>
    );
  }
  const { mission, fresh } = first;
  return (
    <>
      <p className="brd-card__lead">Play any story mission in {districtById(district).name}. Every path counts: the lesson is in the debrief.</p>
      <div className="brd-mission">
        <p className="brd-mission__kicker">{fresh ? 'New for you' : 'Replay'} · {SCAFFOLD_LABEL[mission.scaffold]}</p>
        <h3 className="brd-mission__title">{mission.title}</h3>
        <p className="brd-mission__premise">{mission.premise}</p>
      </div>
      <ul className="brd-card__rules">
        <li>
          {fresh ? `${STARS.missionFirst}+ Stars for a first play` : `${STARS.missionReplay} Stars for a replay`}
          {!claimed && `, and you claim this tile (+${STARS.claimTile})`}.
        </li>
      </ul>
      <ClaimLine claimed={claimed} />
      {pending && (
        <>
          <div className="hub-sheet-actions">
            <LinkButton href={`/play/m/${mission.id}?from=board`} icon="play" size="lg">
              Play<span className="sr-only">: {mission.title}</span>
            </LinkButton>
          </div>
          {others.length > 0 && (
            <details className="ui-details brd-card__more">
              <summary>Pick a different mission</summary>
              <ul>
                {others.slice(0, 4).map(({ mission: m, fresh: f }) => (
                  <li key={m.id}>
                    <Link href={`/play/m/${m.id}?from=board`}>{m.title}</Link>{' '}
                    <span>{f ? '(new)' : '(replay)'}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </>
  );
}

function ChanceBody({ band, claimable: claimableNow, pending, onDone }: { band: BandId | null; claimable: boolean; pending: boolean; onDone: () => void }) {
  const [q] = useState<ChanceQuestion>(() => {
    const recent = readStored<string[]>('local', RECENT_KEY, []);
    const pick = pickChance(band, Math.random, recent);
    writeStored('local', RECENT_KEY, [pick.id, ...recent.filter((id) => id !== pick.id)].slice(0, RECENT_MAX));
    return pick;
  });
  const [picked, setPicked] = useState<string | null>(null);
  // Answering claims the tile: keep the wording from before the answer.
  const [claimable] = useState(claimableNow);
  const promptId = useId();

  const answer = (id: string) => {
    if (picked || !pending) return;
    setPicked(id);
    useRewards.getState().chance(id === q.answer);
  };

  if (!pending && !picked) {
    return (
      <>
        <p className="brd-card__lead">This question is finished.</p>
        <div className="hub-sheet-actions">
          <Button variant="secondary" onClick={onDone}>
            Back to the board
          </Button>
        </div>
      </>
    );
  }

  const correct = picked === q.answer;
  const right = q.options.find((o) => o.id === q.answer)!;
  return (
    <>
      <p className="brd-card__lead">
        {q.kind === 'scam-or-safe' ? 'Scam or safe?' : 'Quick question.'} Right answers earn {STARS.chanceCorrect} Stars
        {claimable ? ' and claim this tile' : ''}.
      </p>
      <p id={promptId} className="brd-quiz__prompt">
        {q.prompt}
      </p>
      <div className="brd-quiz__options" role="group" aria-labelledby={promptId}>
        {q.options.map((o) => {
          const state = !picked ? '' : o.id === q.answer ? 'is-right' : o.id === picked ? 'is-wrong' : 'is-dim';
          return (
            <button
              key={o.id}
              type="button"
              className={`brd-quiz__opt ${state}`}
              onClick={() => answer(o.id)}
              disabled={Boolean(picked)}
              aria-pressed={picked === o.id}
            >
              {picked && o.id === q.answer && <Icon name="check" />}
              {picked && o.id === picked && o.id !== q.answer && <Icon name="close" />}
              <span>{o.text}</span>
              {picked && o.id === q.answer && <span className="sr-only"> (right answer)</span>}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="brd-quiz__result" role="status">
          <StatusBadge status={correct ? 'safe' : 'attention'} label={correct ? `Correct! +${STARS.chanceCorrect} Stars` : 'Not quite, and that is how we learn'} />
          {!correct && (
            <p className="brd-quiz__answer">
              Answer: <strong>{right.text}</strong>
            </p>
          )}
          <p className="brd-quiz__why">{q.why}</p>
          <div className="hub-sheet-actions">
            <Button onClick={onDone} iconRight="arrowRight">
              Back to the board
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
