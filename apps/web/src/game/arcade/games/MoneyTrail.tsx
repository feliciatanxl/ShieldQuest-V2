// Money Trail. An "easy money" offer, then a trail of stops. Tap the next stop to follow the money there,
// then pick what really happens. The last stop is always "what should you do".
import { useEffect, useRef, useState } from 'react';
import { m } from 'motion/react';
import { messageFor, type MoneyTrailScenario, type TrailNodeKind } from '@shieldquest/shared';
import { Button } from '../../../ui/Button';
import { StatusBadge, StatusShape } from '../../../ui/StatusBadge';
import { CoinGlyph } from '../../hub/kit';
import { LiveRegion, MessageCard, useAnnounce, useArcadeCues, type GameProps } from '../shared';

const NODE_PATH: Record<TrailNodeKind, string> = {
  offer: 'M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4V16H5.5A1.5 1.5 0 0 1 4 14.5z',
  victim: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z',
  you: 'M18 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 6 18.5V20M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  account: 'M3.5 7.5h17v11h-17zM3.5 11h17M7 15h3',
  transfer: 'M4 8h13M13 4l4 4-4 4M20 16H7M11 12l-4 4 4 4',
  scammer: 'M3 10c3-3 15-3 18 0-1 5-4 6-6 6-1.5 0-2-1.5-3-1.5S10.5 16 9 16c-2 0-5-1-6-6zM8 11h.01M16 11h.01',
  bank: 'M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  police: 'M12 3l7 3v5.5c0 4.5-3 8.2-7 9.5-4-1.3-7-5-7-9.5V6zM9 12l2 2 4-4',
  friends: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
  choice: 'M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8',
};

function NodeGlyph({ kind }: { kind: TrailNodeKind }) {
  return (
    <svg width="1.4em" height="1.4em" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={NODE_PATH[kind]} />
    </svg>
  );
}

export function MoneyTrail({ round, plain, onComplete, onResults }: GameProps<{ scenario: MoneyTrailScenario }>) {
  const { scenario } = round;
  const { steps } = scenario;
  const cues = useArcadeCues();
  const [live, announce] = useAnnounce();
  /** How many stops the money has reached (0 = still at the offer). */
  const [reached, setReached] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const active = reached - 1; // index of the step being answered, -1 before the first stop
  const step = active >= 0 ? steps[active] : undefined;
  const picked = step ? picks[active] : undefined;
  const pickedOpt = step && picked ? step.options.find((o) => o.id === picked) : undefined;
  const done = picks.length === steps.length;

  useEffect(() => {
    if (reached > 0 && !picked) panelRef.current?.focus({ preventScroll: false });
  }, [reached, picked]);

  useEffect(() => {
    if (picked) feedbackRef.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [picked]);

  const follow = () => {
    if (reached >= steps.length) return;
    cues.tap();
    const s = steps[reached]!;
    setReached((r) => r + 1);
    announce(`The money moves to: ${s.node.label}.`);
  };

  const pick = (optionId: string) => {
    if (!step || picked) return;
    const opt = step.options.find((o) => o.id === optionId)!;
    const next = [...picks, optionId];
    setPicks(next);
    if (opt.correct) cues.good();
    else cues.miss();
    announce(`${opt.correct ? 'Right.' : 'Not quite.'} ${opt.explain}`);
    if (next.length === steps.length) {
      const right = steps.filter((s, i) => s.options.find((o) => o.id === next[i])?.correct).length;
      onComplete({
        score: right / steps.length,
        right,
        total: steps.length,
        unit: 'steps right',
        lesson: scenario.lesson,
        review: steps.map((s, i) => {
          const chosen = s.options.find((o) => o.id === next[i]);
          const good = s.options.find((o) => o.correct)!;
          return { id: s.id, ok: Boolean(chosen?.correct), title: `${s.node.label}: ${s.prompt}`, detail: good.text };
        }),
      });
      cues.done();
    }
  };

  return (
    <div className="arc-mt">
      <LiveRegion text={live} />
      <section className="arc-mt__hook" aria-labelledby="arc-mt-title">
        <h2 id="arc-mt-title" className="arc-section-title">
          {scenario.title}
        </h2>
        <MessageCard channel={scenario.hook.channel} from={scenario.hook.from} label="Fictional offer">
          <p>{messageFor(scenario.hook, plain)}</p>
        </MessageCard>
      </section>

      <ol className="arc-mt__trail" aria-label="The money trail">
        <li className={`arc-mt__stop is-past${reached === 0 ? ' is-here' : ''}`}>
          <span className="arc-mt__node" aria-hidden="true">
            <NodeGlyph kind="offer" />
          </span>
          <span className="arc-mt__label">The offer</span>
          {reached === 0 && (
            <span className="arc-mt__coin" aria-hidden="true">
              <CoinGlyph size={26} />
            </span>
          )}
        </li>
        {steps.map((s, i) => {
          const isReached = i < reached;
          const isNext = i === reached && !done && (reached === 0 || picks.length === reached);
          const isHere = i === reached - 1;
          const chosen = picks[i] ? s.options.find((o) => o.id === picks[i]) : undefined;
          return (
            <li
              key={s.id}
              className={`arc-mt__stop${isReached ? ' is-past' : ''}${isHere ? ' is-here' : ''}${isNext ? ' is-next' : ''}`}
              aria-current={isHere ? 'step' : undefined}
            >
              {isReached ? (
                <>
                  <span className="arc-mt__node" aria-hidden="true">
                    <NodeGlyph kind={s.node.kind} />
                  </span>
                  <span className="arc-mt__label">
                    {s.node.label}
                    {chosen && (
                      <span className="arc-mt__mark">
                        <StatusShape status={chosen.correct ? 'safe' : 'attention'} size={16} />
                        <span className="sr-only">{chosen.correct ? ' (right)' : ' (missed)'}</span>
                      </span>
                    )}
                  </span>
                  {isHere && (
                    <m.span
                      className="arc-mt__coin"
                      aria-hidden="true"
                      initial={{ y: -28, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                    >
                      <CoinGlyph size={26} />
                    </m.span>
                  )}
                </>
              ) : isNext ? (
                <button type="button" className="arc-mt__follow" onClick={follow}>
                  <span className="arc-mt__node arc-mt__node--next" aria-hidden="true">
                    ?
                  </span>
                  <span className="arc-mt__label">
                    Follow the money
                    <small>Tap to see where it goes</small>
                  </span>
                </button>
              ) : (
                <>
                  <span className="arc-mt__node arc-mt__node--locked" aria-hidden="true">
                    ?
                  </span>
                  <span className="arc-mt__label arc-mt__label--locked">
                    <span className="sr-only">Stop {i + 1}: not reached yet</span>
                  </span>
                </>
              )}

              {isHere && (
                <div className="arc-mt__panel" ref={panelRef} tabIndex={-1} aria-labelledby={`arc-mt-q-${s.id}`}>
                  <p className="arc-mt__scene">{s.scene}</p>
                  <h3 id={`arc-mt-q-${s.id}`} className="arc-mt__prompt">
                    {s.prompt}
                  </h3>
                  <div className="arc-mt__options" role="group" aria-labelledby={`arc-mt-q-${s.id}`}>
                    {s.options.map((o) => {
                      const state = !picked ? '' : o.correct ? ' is-right' : o.id === picked ? ' is-wrong' : ' is-dim';
                      return (
                        <button
                          key={o.id}
                          type="button"
                          className={`arc-option${state}`}
                          onClick={() => pick(o.id)}
                          disabled={Boolean(picked)}
                          aria-pressed={picked ? o.id === picked : undefined}
                        >
                          {picked && o.correct && <StatusShape status="safe" size={18} />}
                          {picked && o.id === picked && !o.correct && <StatusShape status="attention" size={18} />}
                          <span>{o.text}</span>
                        </button>
                      );
                    })}
                  </div>
                  {pickedOpt && (
                    <div className={`arc-feedback ${pickedOpt.correct ? 'is-ok' : 'is-miss'}`} ref={feedbackRef}>
                      <p className="arc-feedback__head">
                        <StatusBadge status={pickedOpt.correct ? 'safe' : 'attention'} label={pickedOpt.correct ? 'Right' : 'Not quite'} />
                      </p>
                      <p className="arc-feedback__tip">{pickedOpt.explain}</p>
                      {!pickedOpt.correct && (
                        <p className="arc-feedback__tip">
                          <strong>What really happens:</strong> {s.options.find((o) => o.correct)!.text}
                        </p>
                      )}
                      <div className="arc-actions">
                        {done ? (
                          <Button size="lg" iconRight="arrowRight" onClick={onResults}>
                            See my Stars
                          </Button>
                        ) : (
                          <Button size="lg" icon="arrowRight" onClick={follow}>
                            Follow the money
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
