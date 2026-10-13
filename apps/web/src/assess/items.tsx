// One view per Calibration item type. Every item is plain DOM (never 3D) so a phone's quality cannot
// bias a score, and every answer is a native radio, checkbox or toggle button for full keyboard use.

import { useEffect, useId, useRef, useState } from 'react';
import {
  CONFIDENCE_LABELS,
  LIKERT_LABELS,
  type AssessmentAnswer,
  type AssessmentItem,
  type ChipsItem,
  type ChoiceItem,
  type ConfidenceValue,
  type FlagsItem,
  type JammedItem,
  type LikertItem,
  type LikertValue,
  type PollItem,
  type TwinItem,
  type TwinPick,
} from '@shieldquest/shared';
import { prefersReducedMotion, useSettings } from '../state/settings';
import { Icon } from '../ui/Icon';
import { StatusBadge, StatusShape } from '../ui/StatusBadge';
import { MessageCard, MessageText, Option } from './parts';

type AnswerOf<T extends AssessmentAnswer['type']> = Extract<AssessmentAnswer, { type: T }>;

interface ViewProps<I extends AssessmentItem> {
  item: I;
  answer: AnswerOf<I['type']> | undefined;
  onAnswer: (answer: AnswerOf<I['type']> | undefined) => void;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const Letter = ({ i }: { i: number }) => (
  <span className="assess-opt__letter" aria-hidden="true">
    {LETTERS[i] ?? i + 1}
  </span>
);

// ---------------------------------------------------------------------------------------------
// Twin pair: which message is the scam? (+ confidence)

function TwinView({ item, answer, onAnswer }: ViewProps<TwinItem>) {
  const name = useId();
  const confName = useId();
  const pick = answer?.pick;
  const setPick = (p: TwinPick) => onAnswer(answer?.confidence ? { type: 'twin', pick: p, confidence: answer.confidence } : { type: 'twin', pick: p });
  const setConf = (c: ConfidenceValue) => pick && onAnswer({ type: 'twin', pick, confidence: c });
  const myPick = <StatusBadge status="risk" label="My pick: scam" />;
  const motion = useSettings((s) => s.motion);
  const confRef = useRef<HTMLFieldSetElement>(null);
  const hadPick = useRef(pick !== undefined);
  // On a phone the confidence question appears below the fold: bring it into view after the first pick.
  useEffect(() => {
    if (!pick || hadPick.current) return;
    hadPick.current = true;
    confRef.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion(motion) ? 'auto' : 'smooth' });
  }, [pick, motion]);

  return (
    <div className="assess-twin">
      <fieldset className="assess-field">
        <legend className="assess-legend">Which one is the scam?</legend>
        <div className="assess-twin__cards">
          {(['a', 'b'] as const).map((side) => {
            const msgId = `${name}-${side}`;
            const on = pick === side || pick === 'both';
            return (
              <label key={side} className={`assess-twin__card${pick === side ? ' is-on' : ''}${on ? ' is-flagged' : ''}`}>
                <input
                  className="assess-opt__input"
                  type="radio"
                  name={name}
                  value={side}
                  checked={pick === side}
                  onChange={() => setPick(side)}
                  aria-label={`Message ${side.toUpperCase()} is the scam`}
                  aria-describedby={msgId}
                />
                <MessageCard message={item[side]} letter={side.toUpperCase()} id={msgId} badge={on ? myPick : undefined}>
                  <MessageText text={item[side].text} />
                </MessageCard>
                <span className="assess-twin__cta" aria-hidden="true">
                  {pick === side ? (
                    <>
                      <Icon name="check" /> Picked as the scam
                    </>
                  ) : (
                    `Tap if ${side.toUpperCase()} is the scam`
                  )}
                </span>
              </label>
            );
          })}
        </div>
        <div className="assess-twin__alt">
          <span className="assess-twin__or" aria-hidden="true">
            Or
          </span>
          <Option type="radio" name={name} value="both" checked={pick === 'both'} onChange={() => setPick('both')}>
            Both look like scams
          </Option>
          <Option type="radio" name={name} value="neither" checked={pick === 'neither'} onChange={() => setPick('neither')}>
            Neither: both look genuine
          </Option>
        </div>
      </fieldset>

      {pick && (
        <fieldset className="assess-field assess-conf" ref={confRef}>
          <legend className="assess-legend assess-legend--sm">How sure are you?</legend>
          <div className="assess-conf__row">
            {([1, 2, 3] as const).map((c) => (
              <Option
                key={c}
                type="radio"
                name={confName}
                value={String(c)}
                checked={answer?.confidence === c}
                onChange={() => setConf(c)}
                className="assess-opt--pill"
                mark={<ConfidenceMark level={c} />}
              >
                {CONFIDENCE_LABELS[c]}
              </Option>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

/** 1-3 filled bars, so confidence reads without colour. */
function ConfidenceMark({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className="assess-confmark" aria-hidden="true">
      {[1, 2, 3].map((b) => (
        <span key={b} className={b <= level ? 'is-on' : ''} />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Red flags: tap every warning sign

function FlagsView({ item, answer, onAnswer }: ViewProps<FlagsItem>) {
  const picked = new Set(answer?.picked ?? []);
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // Keep message order so the stored answer is stable.
    onAnswer({ type: 'flags', picked: item.segments.filter((s) => next.has(s.id)).map((s) => s.id) });
  };
  const count = picked.size;

  return (
    <div className="assess-flags">
      <p className="assess-legend" id={`${item.id}-flags-q`}>
        Which parts of this message are warning signs?
      </p>
      <MessageCard message={item.message}>
        <span className="assess-flags__segs" role="group" aria-labelledby={`${item.id}-flags-q`}>
          {item.segments.map((s) => {
            const on = picked.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className={`assess-seg${on ? ' is-on' : ''}`}
                aria-pressed={on}
                onClick={() => toggle(s.id)}
              >
                {on && (
                  <span className="assess-seg__mark" aria-hidden="true">
                    <StatusShape status="attention" size={16} />
                  </span>
                )}
                <MessageText text={s.text} />
              </button>
            );
          })}
        </span>
      </MessageCard>
      <p className="assess-flags__count" role="status">
        {count === 0
          ? 'Nothing marked yet. Tap a part to mark it.'
          : `${count} marked as ${count === 1 ? 'a warning sign' : 'warning signs'}. Tap again to undo.`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Multiple choice: transfer vignettes, consequences and what to say to a friend

const HORIZON: Record<NonNullable<ChoiceItem['horizon']>, string> = {
  now: 'Right now',
  days: 'A few days later',
  weeks: 'A few weeks later',
  who: 'Who is affected',
};

function ChoiceView({ item, answer, onAnswer }: ViewProps<ChoiceItem>) {
  const name = useId();
  return (
    <div className="assess-choice">
      <div className="assess-scene">
        <span className="assess-scene__tag">
          <Icon name="book" />
          {item.horizon ? HORIZON[item.horizon] : 'The situation'}
        </span>
        <p className="assess-scene__text">{item.scenario}</p>
      </div>
      <fieldset className="assess-field">
        <legend className="assess-legend">{item.question}</legend>
        <div className="assess-opts">
          {item.options.map((o, i) => (
            <Option
              key={o.id}
              type="radio"
              name={name}
              value={o.id}
              checked={answer?.option === o.id}
              onChange={() => onAnswer({ type: 'choice', option: o.id })}
              mark={<Letter i={i} />}
            >
              {o.text}
            </Option>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Likert 1-5

function LikertView({ item, answer, onAnswer }: ViewProps<LikertItem>) {
  const name = useId();
  const labels = LIKERT_LABELS[item.scale];
  return (
    <fieldset className="assess-field assess-likert">
      <legend className="assess-legend">
        <span className="assess-likert__prompt">{item.prompt}</span>
        <span className="assess-likert__statement">{item.statement}</span>
      </legend>
      <div className="assess-likert__scale">
        {labels.map((label, i) => {
          const v = (i + 1) as LikertValue;
          return (
            <Option
              key={v}
              type="radio"
              name={name}
              value={String(v)}
              checked={answer?.value === v}
              onChange={() => onAnswer({ type: 'likert', value: v })}
              className="assess-opt--scale"
              mark={
                <span className="assess-scale__dot" aria-hidden="true" data-level={v}>
                  {v}
                </span>
              }
            >
              {label}
            </Option>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------------------------
// Poll (would you play again?)

function PollView({ item, answer, onAnswer }: ViewProps<PollItem>) {
  const name = useId();
  return (
    <fieldset className="assess-field">
      <legend className="assess-legend">{item.question}</legend>
      <div className="assess-opts assess-opts--row">
        {item.options.map((o) => (
          <Option
            key={o.id}
            type="radio"
            name={name}
            value={o.id}
            checked={answer?.option === o.id}
            onChange={() => onAnswer({ type: 'poll', option: o.id })}
            className="assess-opt--pill"
          >
            {o.text}
          </Option>
        ))}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------------------------
// Reflection chips (no free text anywhere in Calibration)

function ChipsView({ item, answer, onAnswer }: ViewProps<ChipsItem>) {
  const name = useId();
  const chosen = new Set(answer?.chips ?? []);
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const chips = item.chips.filter((c) => next.has(c.id)).map((c) => c.id);
    onAnswer(chips.length ? { type: 'chips', chips } : undefined);
  };
  return (
    <fieldset className="assess-field">
      <legend className="assess-legend">{item.question}</legend>
      <div className="assess-chips">
        {item.chips.map((c) => (
          <Option
            key={c.id}
            type="checkbox"
            name={name}
            value={c.id}
            checked={chosen.has(c.id)}
            onChange={() => toggle(c.id)}
            className="assess-opt--chip"
          >
            {c.text}
          </Option>
        ))}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------------------------
// Return visit: the jammed Freeze. HOLD fails for one second; then a real-world Hold and who to tell.

const JAM_MS = 1000;
const REAL_HOLD_S = 10;

function JammedView({ item, answer, onAnswer }: ViewProps<JammedItem>) {
  const motion = useSettings((s) => s.motion);
  const haptics = useSettings((s) => s.haptics);
  const reduced = prefersReducedMotion(motion);
  const name = useId();
  const tellName = useId();
  const [phase, setPhase] = useState<'ready' | 'jammed' | 'act'>(answer ? 'act' : 'ready');
  const [hold, setHold] = useState<{ state: 'idle' | 'running' | 'done'; left: number }>({ state: 'idle', left: REAL_HOLD_S });
  const actRef = useRef<HTMLHeadingElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const focusAct = useRef(false);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // After the jam, move focus to the question so keyboard and screen reader users land on it.
  useEffect(() => {
    if (phase !== 'act' || !focusAct.current) return;
    focusAct.current = false;
    actRef.current?.focus();
  }, [phase]);

  function pressHold() {
    setPhase('jammed');
    timers.current.push(
      setTimeout(() => {
        focusAct.current = true;
        setPhase('act');
      }, JAM_MS),
    );
  }

  function startRealHold() {
    setHold({ state: 'running', left: REAL_HOLD_S });
    for (let s = 1; s <= REAL_HOLD_S; s++) {
      timers.current.push(
        setTimeout(() => {
          const left = REAL_HOLD_S - s;
          setHold({ state: left === 0 ? 'done' : 'running', left });
          // A short buzz tells a face-down phone that the 10 seconds are up.
          if (left === 0 && haptics) navigator.vibrate?.([120, 80, 120]);
        }, s * 1000),
      );
    }
  }

  const tell = answer?.tell ?? [];
  const update = (option: string | undefined, nextTell: string[]) => {
    if (!option && nextTell.length === 0) onAnswer(undefined);
    else onAnswer(option ? { type: 'jammed', option, tell: nextTell } : { type: 'jammed', tell: nextTell });
  };
  const toggleTell = (id: string) => {
    const next = tell.includes(id) ? tell.filter((t) => t !== id) : [...tell, id];
    update(answer?.option, item.tell.filter((t) => next.includes(t.id)).map((t) => t.id));
  };

  return (
    <div className="assess-jam">
      <MessageCard message={item.message}>
        <MessageText text={item.message.text} />
      </MessageCard>

      {phase !== 'act' && (
        <div className="assess-jam__holdzone">
          <button
            type="button"
            className={`assess-jam__hold${phase === 'jammed' ? ' is-jammed' : ''}${reduced ? ' is-still' : ''}`}
            onClick={pressHold}
            disabled={phase === 'jammed'}
          >
            <Icon name="pause" size="1.6em" />
            <span>{phase === 'jammed' ? 'HOLD…' : 'HOLD'}</span>
          </button>
          <p className="assess-jam__status" role="status">
            {phase === 'ready' ? 'Press HOLD to freeze time, like in the game.' : "HOLD isn't working…"}
          </p>
        </div>
      )}

      {phase === 'act' && (
        <div className="assess-jam__act">
          <div className="assess-jam__banner">
            <StatusBadge status="attention" label="HOLD jammed" />
            <p>No button can pause real life. But you can still make a Hold of your own.</p>
          </div>
          <fieldset className="assess-field">
            <legend className="assess-legend">
              <h3 ref={actRef} tabIndex={-1} className="assess-jam__q">
                {item.question}
              </h3>
            </legend>
            <div className="assess-opts">
              {item.options.map((o, i) => (
                <Option
                  key={o.id}
                  type="radio"
                  name={name}
                  value={o.id}
                  checked={answer?.option === o.id}
                  onChange={() => update(o.id, tell)}
                  mark={<Letter i={i} />}
                >
                  {o.text}
                </Option>
              ))}
            </div>
          </fieldset>

          <section className="assess-realhold" aria-labelledby={`${name}-rh`}>
            <h3 id={`${name}-rh`} className="assess-realhold__title">
              <Icon name="phone" /> Try a real-world Hold
            </h3>
            {hold.state === 'idle' && (
              <>
                <p>Put your phone face down for 10 seconds. Stop replying. Breathe out slowly.</p>
                <button type="button" className="assess-realhold__btn" onClick={startRealHold}>
                  <Icon name="clock" /> <span>Start the 10-second Hold</span>
                </button>
                <p className="assess-realhold__note">Optional. It is not scored.</p>
              </>
            )}
            {hold.state === 'running' && (
              <p className="assess-realhold__count" aria-live="off">
                <span className="assess-realhold__num">{hold.left}</span>
                <span>seconds. Phone down, nothing to answer.</span>
              </p>
            )}
            <p className="sr-only" role="status">
              {hold.state === 'running' && hold.left === REAL_HOLD_S - 1 ? 'Hold started. 10 seconds.' : ''}
              {hold.state === 'done' ? 'Ten seconds done.' : ''}
            </p>
            {hold.state === 'done' && (
              <p className="assess-realhold__done">
                <StatusShape status="safe" size={20} />
                <span>
                  <strong>Done.</strong> That pause is your Hold. Nothing bad happened while you stopped.
                </span>
              </p>
            )}
          </section>

          <fieldset className="assess-field">
            <legend className="assess-legend">{item.tellQuestion}</legend>
            <div className="assess-chips">
              {item.tell.map((t) => (
                <Option
                  key={t.id}
                  type="checkbox"
                  name={tellName}
                  value={t.id}
                  checked={tell.includes(t.id)}
                  onChange={() => toggleTell(t.id)}
                  className="assess-opt--chip"
                >
                  {t.text}
                </Option>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

export interface ItemViewProps {
  item: AssessmentItem;
  answer: AssessmentAnswer | undefined;
  onAnswer: (answer: AssessmentAnswer | undefined) => void;
}

/** Renders any Calibration item. Answers of the wrong type (e.g. from an old draft) are ignored. */
export function ItemView({ item, answer, onAnswer }: ItemViewProps) {
  switch (item.type) {
    case 'twin':
      return <TwinView item={item} answer={answer?.type === 'twin' ? answer : undefined} onAnswer={onAnswer} />;
    case 'flags':
      return <FlagsView item={item} answer={answer?.type === 'flags' ? answer : undefined} onAnswer={onAnswer} />;
    case 'choice':
      return <ChoiceView item={item} answer={answer?.type === 'choice' ? answer : undefined} onAnswer={onAnswer} />;
    case 'likert':
      return <LikertView item={item} answer={answer?.type === 'likert' ? answer : undefined} onAnswer={onAnswer} />;
    case 'poll':
      return <PollView item={item} answer={answer?.type === 'poll' ? answer : undefined} onAnswer={onAnswer} />;
    case 'chips':
      return <ChipsView item={item} answer={answer?.type === 'chips' ? answer : undefined} onAnswer={onAnswer} />;
    case 'jammed':
      return <JammedView item={item} answer={answer?.type === 'jammed' ? answer : undefined} onAnswer={onAnswer} />;
  }
}

/** Short label for an item in the "skipped" list. */
export function itemLabel(item: AssessmentItem): string {
  switch (item.type) {
    case 'twin':
      return `Which is the scam? (${item.a.from} / ${item.b.from})`;
    case 'flags':
      return `Warning signs in a message from ${item.message.from}`;
    case 'choice':
      return item.question;
    case 'likert':
      return item.statement.replace(/^…/, '');
    case 'poll':
    case 'chips':
      return item.question;
    case 'jammed':
      return 'The jammed Freeze';
  }
}
