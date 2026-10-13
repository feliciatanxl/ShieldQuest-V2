// Thank-you screen: send status (with offline retry), the private before/after Growth Card (computed and
// kept on this device only, GDD §8.8), the Twin pair answers (after the post and Return visits only, so the
// before check never gives answers away) and the way back to the game or the session.

import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  GAME,
  TWIN_PICK_LABELS,
  joinPath,
  type AssessmentAnswers,
  type AssessmentItem,
  type AssessmentKind,
  type AssessmentMetricId,
  type AssessmentScores,
  type TwinItem,
} from '@shieldquest/shared';
import { Button, LinkButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { StatusBadge } from '../ui/StatusBadge';
import { CodeDisplay, MessageCard, MessageText } from './parts';
import { forgetThisDevice, type DoneEntry } from './storage';

interface DoneScreenProps {
  kind: AssessmentKind;
  code: string;
  /** True while the answers are still waiting in the offline queue (kept in sync by the parent). */
  pending: boolean;
  /** Retries the offline queue; resolves to whether these answers are still waiting. */
  onRetry: () => Promise<boolean>;
  items: readonly AssessmentItem[];
  answers: AssessmentAnswers;
  scores: AssessmentScores;
  /** The earlier visit on this device with the same code, for the Growth Card. */
  earlier: { kind: AssessmentKind; entry: DoneEntry } | null;
  sessionCode?: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

const TITLES: Record<AssessmentKind, { title: string; lead: string }> = {
  pre: {
    title: "Thanks! You're all set",
    lead: 'Your answers are in. Now go and play. Afterwards you will do a short after check with the same code.',
  },
  post: {
    title: 'Thank you!',
    lead: 'Your answers help make ShieldQuest better for everyone who plays it next.',
  },
  return: {
    title: 'Thanks for coming back to Lumen',
    lead: 'Your answers show us what people still remember weeks later. That matters a lot.',
  },
};

export function DoneScreen(props: DoneScreenProps) {
  const { kind, code, pending, onRetry, items, answers, scores, earlier, sessionCode, headingRef } = props;
  const [retry, setRetry] = useState<'idle' | 'trying' | 'failed'>('idle');
  const [forgotten, setForgotten] = useState(false);
  const t = TITLES[kind];
  const retryRef = useRef(onRetry);
  retryRef.current = onRetry;

  // School Wi-Fi often reports "online" while the server is unreachable, so keep quietly retrying while pending.
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => void retryRef.current(), 30_000);
    return () => clearInterval(id);
  }, [pending]);

  async function retryNow() {
    setRetry('trying');
    const stillPending = await onRetry();
    setRetry(stillPending ? 'failed' : 'idle');
  }

  const twins = items.filter((i): i is TwinItem => i.type === 'twin');

  return (
    <section className="assess-step assess-done" aria-labelledby="assess-done-h">
      <div className="assess-done__seal" aria-hidden="true">
        <Icon name="check" size="2.2rem" />
      </div>
      <p className="kicker">Calibration</p>
      <h2 id="assess-done-h" ref={headingRef} tabIndex={-1}>
        {t.title}
      </h2>
      <p className="assess-lead">{t.lead}</p>

      <div className="assess-sendstate">
        <div role="status">
          {pending ? (
            <>
              <StatusBadge status="attention" label="Saved on this device" />
              <p>
                We couldn&apos;t reach ShieldQuest just now, so your answers are kept safely on this device. They
                will send automatically once you are back online. If you close this page first, they will send next
                time you open the before &amp; after check.
              </p>
              {retry === 'failed' && <p className="assess-sendstate__fail">Still offline. That&apos;s OK, nothing is lost.</p>}
            </>
          ) : (
            <StatusBadge status="safe" label="Answers sent" />
          )}
        </div>
        {pending && (
          <Button variant="secondary" icon="rewind" onClick={retryNow} disabled={retry === 'trying'}>
            {retry === 'trying' ? 'Trying…' : 'Try sending now'}
          </Button>
        )}
      </div>

      {kind === 'pre' && !forgotten && (
        <div className="assess-keepcode">
          <p className="assess-keepcode__title">Keep your code for the after check</p>
          <CodeDisplay code={code} size="md" />
        </div>
      )}

      {earlier && kind !== 'pre' && <GrowthCard before={earlier} after={scores} kind={kind} />}
      {!earlier && kind !== 'pre' && (
        <p className="assess-note">
          <Icon name="info" /> A private Growth Card appears here when your earlier check was done on this same device
          with this code.
        </p>
      )}

      {kind !== 'pre' && twins.length > 0 && <TwinReview twins={twins} answers={answers} />}

      {kind === 'return' && <p className="assess-closing">{GAME.closing}</p>}

      <div className="assess-actions">
        {sessionCode ? (
          <LinkButton href={joinPath(sessionCode)} size="lg" iconRight="arrowRight">
            Back to your session
          </LinkButton>
        ) : (
          <LinkButton href="/play" size="lg" iconRight="arrowRight">
            {kind === 'pre' ? 'Start playing' : kind === 'return' ? 'Return to Lumen' : 'Keep playing'}
          </LinkButton>
        )}
        <LinkButton href="/" variant="secondary" size="lg" icon="door">
          Home
        </LinkButton>
      </div>

      <details className="assess-lost">
        <summary>Using a shared device?</summary>
        {forgotten ? (
          <p role="status">
            Done. Your code and private scores are no longer on this device.
            {kind === 'pre' ? ' Make sure you wrote your code down.' : ''}
          </p>
        ) : (
          <>
            <p>
              Remove your code and your private Growth Card from this device, so the next person starts fresh. Your
              sent answers are not affected.
            </p>
            <Button
              variant="secondary"
              icon="close"
              onClick={() => {
                forgetThisDevice();
                setForgotten(true);
              }}
            >
              Forget my code on this device
            </Button>
          </>
        )}
      </details>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

const GROWTH_ROWS: { id: AssessmentMetricId; label: string; scale?: true }[] = [
  { id: 'twinAccuracy', label: 'Spotting the scam message' },
  { id: 'flagHitRate', label: 'Warning signs found' },
  { id: 'decisionAccuracy', label: 'Safest move in a new situation' },
  { id: 'consequenceAccuracy', label: 'Seeing what happens later' },
  { id: 'peerJudgement', label: 'Best thing to say to a friend' },
  { id: 'peerConfidence', label: 'Confidence to help a friend', scale: true },
];

const fmt = (v: number, scale?: boolean) => (scale ? `${v.toFixed(1)} of 5` : `${Math.round(v * 100)}%`);

function change(before: number, after: number, scale?: boolean): { word: string; sign: 'up' | 'same' | 'down' } {
  const d = after - before;
  if (scale) {
    if (Math.abs(d) < 0.05) return { word: 'Same', sign: 'same' };
    return d > 0 ? { word: `Up ${d.toFixed(1)}`, sign: 'up' } : { word: `Down ${Math.abs(d).toFixed(1)}`, sign: 'down' };
  }
  const pts = Math.round(d * 100);
  if (pts === 0) return { word: 'Same', sign: 'same' };
  return pts > 0 ? { word: `Up ${pts}`, sign: 'up' } : { word: `Down ${-pts}`, sign: 'down' };
}

const VISIT: Record<AssessmentKind, string> = { pre: 'Before', post: 'After', return: 'Return' };

function GrowthCard({ before, after, kind }: { before: { kind: AssessmentKind; entry: DoneEntry }; after: AssessmentScores; kind: AssessmentKind }) {
  const rows = GROWTH_ROWS.filter((r) => before.entry.scores[r.id] !== undefined && after[r.id] !== undefined);
  const jammed = kind === 'return' ? after.jammedAction : undefined;
  if (!rows.length && jammed === undefined) return null;
  const a = VISIT[before.kind];
  const b = VISIT[kind];

  return (
    <section className="assess-growth" aria-labelledby="assess-growth-h">
      <h3 id="assess-growth-h" className="assess-growth__title">
        <Icon name="spark" /> Your Growth Card
      </h3>
      <p className="assess-growth__private">
        <Icon name="lock" /> Only on this device. Nobody else can see it.
      </p>
      {rows.length > 0 && (
        <p className="assess-growth__legend" aria-hidden="true">
          <span className="assess-growth__swatch assess-growth__bar--a" /> {a}
          <span className="assess-growth__swatch assess-growth__bar--b" /> {b}
        </p>
      )}
      {rows.length > 0 && (
        <table className="assess-growth__table" role="table">
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">Skill</th>
              <th scope="col" role="columnheader">
                {a}
              </th>
              <th scope="col" role="columnheader">
                {b}
              </th>
              <th scope="col" role="columnheader">
                Change
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {rows.map((r) => {
              const x = before.entry.scores[r.id] ?? 0;
              const y = after[r.id] ?? 0;
              const c = change(x, y, r.scale);
              const pct = (v: number) => `${Math.max(0, Math.min(1, r.scale ? (v - 1) / 4 : v)) * 100}%`;
              return (
                <tr key={r.id} role="row">
                  <th scope="row" role="rowheader">
                    {r.label}
                    <span className="assess-growth__bars" aria-hidden="true">
                      <span className="assess-growth__bar assess-growth__bar--a" style={{ width: pct(x) }} />
                      <span className="assess-growth__bar assess-growth__bar--b" style={{ width: pct(y) }} />
                    </span>
                  </th>
                  <td role="cell" data-label={a}>
                    {fmt(x, r.scale)}
                  </td>
                  <td role="cell" data-label={b}>
                    {fmt(y, r.scale)}
                  </td>
                  <td role="cell" data-label="Change" className={`assess-growth__chg assess-growth__chg--${c.sign}`}>
                    {c.word}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {jammed !== undefined && (
        <p className="assess-growth__jam">
          <StatusBadge status={jammed === 1 ? 'safe' : 'unknown'} label={jammed === 1 ? 'Jammed Freeze: you chose to Hold' : 'Jammed Freeze: next time, try a Hold'} />
        </p>
      )}
      <p className="assess-growth__foot">
        Scores move around from day to day. What matters most is what you do when someone tries to rush you.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

function TwinReview({ twins, answers }: { twins: TwinItem[]; answers: AssessmentAnswers }) {
  return (
    <details className="assess-review">
      <summary>
        <Icon name="eye" /> See which messages were scams
      </summary>
      <ol className="assess-review__list">
        {twins.map((t) => {
          const a = answers[t.id];
          const pick = a?.type === 'twin' ? a.pick : undefined;
          return (
            <li key={t.id} className="assess-review__item">
              <div className="assess-review__pair">
                {(['a', 'b'] as const).map((side) => (
                  <MessageCard
                    key={side}
                    message={t[side]}
                    letter={side.toUpperCase()}
                    badge={
                      t.scam === side ? <StatusBadge status="risk" label="Scam" /> : <StatusBadge status="safe" label="Genuine" />
                    }
                  >
                    <MessageText text={t[side].text} />
                  </MessageCard>
                ))}
              </div>
              <p className="assess-review__cue">
                <strong>The trick:</strong> {t.cue}
              </p>
              <p className="assess-review__mine">
                Your answer: {pick ? TWIN_PICK_LABELS[pick] : 'skipped'}
                {pick === t.scam ? ' (spot on)' : ''}
              </p>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
