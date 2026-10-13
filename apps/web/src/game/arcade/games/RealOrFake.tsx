// Real or Fake? Eight mock screens. Call each one Real or Scam: buttons always, swipe if you like,
// or ← / → on a keyboard. After each call, the giveaway is highlighted with a one-line tip.
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { m } from 'motion/react';
import type { RealOrFakeCard } from '@shieldquest/shared';
import { Button } from '../../../ui/Button';
import { StatusBadge, StatusShape } from '../../../ui/StatusBadge';
import { LiveRegion, useAnnounce, useArcadeCues, useFocusOnMount, type GameProps } from '../shared';
import { MockScreen } from './MockScreen';

type Call = 'real' | 'scam';

const SWIPE_AT = 90;

export function realOrFakeScore(answers: readonly { ok: boolean }[], total: number): number {
  return total > 0 ? answers.filter((a) => a.ok).length / total : 0;
}

export function RealOrFake({ round, plain, reduced, onComplete, onResults }: GameProps<{ cards: RealOrFakeCard[] }>) {
  const { cards } = round;
  const cues = useArcadeCues();
  const [live, announce] = useAnnounce();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<{ id: string; said: Call; ok: boolean }[]>([]);
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; id: number } | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const headRef = useFocusOnMount<HTMLHeadingElement>();

  const card = cards[index]!;
  const answer = answers[index];
  const isLast = index === cards.length - 1;
  const right = answers.filter((a) => a.ok).length;

  const call = (said: Call) => {
    if (answer) return;
    const ok = said === card.verdict;
    const next = [...answers, { id: card.id, said, ok }];
    setAnswers(next);
    setDx(0);
    if (ok) cues.good();
    else cues.miss();
    announce(
      `${ok ? 'Right!' : 'Not quite.'} This one is ${card.verdict === 'real' ? 'real' : 'a scam'}. The giveaway: ${card.clue.text}. ${card.tip}`,
    );
    if (next.length === cards.length) {
      const correct = next.filter((a) => a.ok).length;
      onComplete({
        score: realOrFakeScore(next, cards.length),
        right: correct,
        total: cards.length,
        correct,
        unit: 'cards called right',
        lesson: 'Check before you trust: who sent it, what it asks for, and whether you can confirm it yourself. Real messages never need your codes or passwords.',
        review: cards.map((c, i) => ({
          id: c.id,
          ok: next[i]?.ok ?? false,
          title: `${c.from}: ${c.verdict === 'real' ? 'Real' : 'Scam'}`,
          detail: c.tip,
        })),
      });
      cues.done();
    }
  };

  // After a call, move focus to "Next" so Enter carries on (and screen readers land on the feedback).
  useEffect(() => {
    if (answer) feedbackRef.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [answer]);

  // ← Scam, → Real (ignored while a dialog such as Settings is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (answer || e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.querySelector('dialog[open]')) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        call('scam');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        call('real');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const next = () => {
    if (isLast) {
      onResults();
      return;
    }
    cues.tap();
    setIndex((i) => i + 1);
    setDx(0);
    headRef.current?.focus({ preventScroll: true });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (answer || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current = { x: e.clientX, id: e.pointerId };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety.
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    setDx(e.clientX - drag.current.x);
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    if (dx >= SWIPE_AT) call('real');
    else if (dx <= -SWIPE_AT) call('scam');
    else setDx(0);
  };

  const lean = Math.max(-1, Math.min(1, dx / SWIPE_AT));
  const tilt = reduced ? 0 : lean * 6;

  return (
    <div className="arc-rf">
      <LiveRegion text={live} />
      <div className="arc-rf__progress">
        <h2 ref={headRef} tabIndex={-1} className="arc-section-title">
          Card {index + 1} of {cards.length}
        </h2>
        <ol className="arc-rf__dots" aria-label={`${right} right so far`}>
          {cards.map((c, i) => {
            const a = answers[i];
            return (
              <li key={c.id} className={a ? (a.ok ? 'is-ok' : 'is-miss') : i === index ? 'is-now' : ''}>
                {a ? <StatusShape status={a.ok ? 'safe' : 'attention'} size={16} /> : <span className="arc-rf__dot" />}
                <span className="sr-only">{a ? (a.ok ? 'right' : 'missed') : i === index ? 'current' : 'to come'}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="arc-rf__stage">
        <m.div
          key={card.id}
          className={`arc-rf__card${answer ? ' is-called' : ''}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div
            className="arc-rf__swipe"
            style={{ transform: answer ? undefined : `translateX(${dx}px) rotate(${tilt}deg)` }}
            data-dragging={dx !== 0 ? 'true' : undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              drag.current = null;
              setDx(0);
            }}
          >
            {!answer && (
              <>
                <span className="arc-rf__stamp arc-rf__stamp--scam" style={{ opacity: Math.max(0, -lean) }} aria-hidden="true">
                  Scam
                </span>
                <span className="arc-rf__stamp arc-rf__stamp--real" style={{ opacity: Math.max(0, lean) }} aria-hidden="true">
                  Real
                </span>
              </>
            )}
            <MockScreen card={card} plain={plain} reveal={Boolean(answer)} />
          </div>
        </m.div>
      </div>

      {answer ? (
        <section className={`arc-feedback ${answer.ok ? 'is-ok' : 'is-miss'}`} aria-labelledby="arc-rf-fb">
          <h3 id="arc-rf-fb">
            <StatusBadge status={answer.ok ? 'safe' : 'attention'} label={answer.ok ? 'Right!' : 'Not quite'} />
            <span>
              This one is <strong>{card.verdict === 'real' ? 'real' : 'a scam'}</strong>.
            </span>
          </h3>
          <p className="arc-feedback__tip">{card.tip}</p>
          <div className="arc-actions" ref={feedbackRef}>
            <Button size="lg" iconRight="arrowRight" onClick={next}>
              {isLast ? 'See my Stars' : 'Next card'}
            </Button>
          </div>
        </section>
      ) : (
        <div className="arc-rf__calls" role="group" aria-label="Is this real or a scam?">
          <button type="button" className="arc-call arc-call--scam" onClick={() => call('scam')}>
            <StatusShape status="risk" size={22} />
            <span>Scam</span>
            <small aria-hidden="true">← swipe left</small>
          </button>
          <button type="button" className="arc-call arc-call--real" onClick={() => call('real')}>
            <StatusShape status="safe" size={22} />
            <span>Real</span>
            <small aria-hidden="true">swipe right →</small>
          </button>
        </div>
      )}
    </div>
  );
}
