import { memo, useMemo, useState } from 'react';
import type { Mission } from '@shieldquest/shared';
import { Icon } from '../../../ui/Icon';
import { ChatThread, type ChatMark } from '../parts/ChatThread';
import { REPLY_CHIPS, beatViews, formatClock, replyChipsAt, residentName, sortedBeats } from '../runLogic';
import './phases.css';

const Chat = memo(ChatThread);

export interface LivePhaseProps {
  mission: Mission;
  /** Seconds into the live phase (update at most 10 times a second). */
  t: number;
  /** Clue ids with a "first look" pin. */
  looks: readonly string[];
  /** Tap on a clue-bearing message: drops a first-look pin (untimed, unscored). */
  onLook: (clueId: string) => void;
  /** Countdown visuals (off for the junior band and Gentle mode: pressure comes through the characters). */
  showCountdown: boolean;
  replyTried: boolean;
  /** A reply chip was tapped. Nothing is sent and nothing is lost. */
  onReply: () => void;
  reduced?: boolean;
}

/** Live: the ChatLah thread with typing dots, clue shimmer, first-look pins, reply chips and the countdown. */
export function LivePhase({ mission, t, looks, onLook, showCountdown, replyTried, onReply, reduced }: LivePhaseProps) {
  const [lastReply, setLastReply] = useState<string | null>(null);
  const raw = beatViews(mission, t, false);
  // Only re-render the thread when a beat changes state, not on every clock tick.
  const signature = raw.map((v) => v.state[0]).join('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const views = useMemo(() => raw, [mission, signature]);
  const marks = useMemo(() => Object.fromEntries(looks.map((id) => [id, 'look' as ChatMark])), [looks]);
  const onClueTap = useMemo(() => (clue: { id: string }) => onLook(clue.id), [onLook]);

  const remaining = mission.live.durationSec - t;
  const lastBeatAt = useMemo(() => Math.max(0, ...sortedBeats(mission).map((b) => b.at)), [mission]);
  const showChips = t >= replyChipsAt(mission);
  const showDecision = t >= lastBeatAt;
  const who = residentName(mission);

  return (
    <div className="msn-phase msn-live">
      <div className="msn-live__bar">
        {showCountdown ? (
          <p className="msn-live__clock" data-low={remaining <= 10 ? '' : undefined}>
            <Icon name="clock" />
            <span className="sr-only">Time left: </span>
            <span aria-hidden="true">{formatClock(remaining)}</span>
          </p>
        ) : (
          <p className="msn-live__clock" data-gentle="">
            <Icon name="chat" /> Live
          </p>
        )}
        <p className="msn-live__looks">
          <Icon name="pin" /> First looks: {looks.length}
          <span className="sr-only">. Tap a message that catches your eye to pin it. Untimed and unscored.</span>
        </p>
      </div>

      <h2 className="sr-only" tabIndex={-1} data-msn-focus="">
        Live: {mission.title}
      </h2>

      <Chat
        mission={mission}
        views={views}
        marks={marks}
        shimmer
        onClueTap={onClueTap}
        tapHint="Tap to pin a first look"
        reduced={reduced}
      />

      {showDecision && (
        <p className="msn-live__decision" aria-live="polite">
          {mission.live.decisionPrompt}
        </p>
      )}

      {showChips && (
        <div className="msn-live__reply" role="group" aria-label={`Quick replies for ${who}`}>
          {REPLY_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className="msn-live__chip"
              onClick={() => {
                setLastReply(chip);
                onReply();
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}
      <p className="msn-live__reply-note" role="status">
        {replyTried && lastReply ? (
          <>
            <Icon name="info" /> "{lastReply}" stays unsent. That's what the hurry is for. Nothing was sent.
          </>
        ) : null}
      </p>
    </div>
  );
}
