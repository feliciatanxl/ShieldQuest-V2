// The random code step. Before: the device is given a fresh code to write down. After and Return: the
// stored code is pre-filled (editable), so the two visits can be matched without ever knowing who anyone is.

import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react';
import { assessmentCodeProblem, normalizeAssessmentCode, type AssessmentKind } from '@shieldquest/shared';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { CodeDisplay } from './parts';
import { requestCode, type AssessRecord } from './storage';

type Mode =
  | { at: 'confirm'; code: string }
  | { at: 'making' }
  | { at: 'show'; code: string; lost: boolean }
  | { at: 'type' };

interface CodeStepProps {
  kind: AssessmentKind;
  record: AssessRecord;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onDone: (code: string) => void;
  onBack: () => void;
}

export function CodeStep({ kind, record, headingRef, onDone, onBack }: CodeStepProps) {
  const [mode, setMode] = useState<Mode>(() => {
    if (kind !== 'pre') return { at: 'type' };
    return record.code ? { at: 'confirm', code: record.code } : { at: 'making' };
  });
  const [lost, setLost] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Fetch a server-issued code (falls back to one made on this device when offline).
  useEffect(() => {
    if (mode.at !== 'making') return;
    void requestCode().then((code) => {
      if (alive.current) setMode({ at: 'show', code, lost });
    });
  }, [mode.at, lost]);

  const newCode = (fromLost: boolean) => {
    setLost(fromLost);
    setMode({ at: 'making' });
  };

  if (mode.at === 'confirm') {
    const redo = record.done.pre?.code === mode.code;
    return (
      <section className="assess-step" aria-labelledby="assess-code-h">
        <p className="kicker">Your code</p>
        <h2 id="assess-code-h" ref={headingRef} tabIndex={-1}>
          Is this your code?
        </h2>
        <p>This device already has a code saved. If someone else used this device before you, get a new one.</p>
        <CodeDisplay code={mode.code} size="md" />
        {redo && (
          <p className="assess-note">
            <Icon name="info" /> This code has already done the before check. Doing it again replaces those answers.
          </p>
        )}
        <div className="assess-actions">
          <Button size="lg" iconRight="arrowRight" onClick={() => onDone(mode.code)}>
            Yes, it&apos;s mine
          </Button>
          <Button size="lg" variant="secondary" onClick={() => newCode(false)}>
            No, give me a new code
          </Button>
        </div>
        <BackLink onBack={onBack} />
      </section>
    );
  }

  if (mode.at === 'making') {
    return (
      <section className="assess-step" aria-labelledby="assess-code-h" aria-busy="true">
        <p className="kicker">Your code</p>
        <h2 id="assess-code-h" ref={headingRef} tabIndex={-1}>
          Making your code…
        </h2>
        <div className="assess-spinner" aria-hidden="true" />
        <p role="status">Picking a random code. This takes a second.</p>
      </section>
    );
  }

  if (mode.at === 'show') {
    return (
      <section className="assess-step" aria-labelledby="assess-code-h">
        <p className="kicker">Your code</p>
        <h2 id="assess-code-h" ref={headingRef} tabIndex={-1}>
          {mode.lost ? 'Here is a new code' : 'This is your random code'}
        </h2>
        <CodeDisplay code={mode.code} />
        <div className="assess-savecode">
          <p className="assess-savecode__title">
            <Icon name="eye" /> Write this down or take a screenshot
          </p>
          <p>
            {kind === 'pre'
              ? 'You will need it for the after check, and again for the Return visit in a few weeks. If you have a paper slip, write it there.'
              : 'Keep it for the Return visit in a few weeks.'}
          </p>
          <p className="assess-savecode__small">
            It is random. It says nothing about you, and it is saved on this device to fill in next time.
          </p>
        </div>
        {mode.lost && (
          <p className="assess-note">
            <Icon name="info" /> Your answers still count. They just can&apos;t be compared with your earlier visit.
          </p>
        )}
        <div className="assess-actions">
          <Button size="lg" iconRight="arrowRight" onClick={() => onDone(mode.code)}>
            I&apos;ve saved my code
          </Button>
        </div>
        {kind === 'pre' && (
          <button type="button" className="assess-linkbtn" onClick={() => setMode({ at: 'type' })}>
            I already have a code from my teacher
          </button>
        )}
        <BackLink onBack={onBack} />
      </section>
    );
  }

  return (
    <TypeCode
      kind={kind}
      initial={kind === 'pre' ? '' : (record.code ?? '')}
      headingRef={headingRef}
      onDone={onDone}
      onLost={() => newCode(true)}
      onBack={onBack}
    />
  );
}

interface TypeCodeProps {
  kind: AssessmentKind;
  initial: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onDone: (code: string) => void;
  onLost: () => void;
  onBack: () => void;
}

function TypeCode({ kind, initial, headingRef, onDone, onLost, onBack }: TypeCodeProps) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const problem = assessmentCodeProblem(value);
    if (problem) {
      setError(problem);
      inputRef.current?.focus();
      return;
    }
    onDone(normalizeAssessmentCode(value));
  }

  const title = kind === 'pre' ? 'Type your code' : initial ? 'Check your code' : 'Type your code';
  const lead =
    kind === 'return'
      ? 'Welcome back to ShieldQuest City. Type the code you got at your workshop, so this visit can be matched with your earlier answers.'
      : kind === 'post'
        ? 'Use the same code as your before check, so we can see what changed for the group.'
        : 'Type the code on your paper slip.';

  return (
    <section className="assess-step" aria-labelledby="assess-code-h">
      <p className="kicker">Your code</p>
      <h2 id="assess-code-h" ref={headingRef} tabIndex={-1}>
        {title}
      </h2>
      <p>{lead}</p>
      {initial && kind !== 'pre' && (
        <p className="assess-note">
          <Icon name="info" /> We filled in the code saved on this device. If it isn&apos;t yours, change it.
        </p>
      )}
      <form className="assess-codeform" onSubmit={submit} noValidate>
        <label htmlFor={inputId} className="assess-codeform__label">
          Your code
        </label>
        <input
          ref={inputRef}
          id={inputId}
          className="assess-codeform__input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.toUpperCase());
            if (error) setError(null);
          }}
          onBlur={() => value && setValue(normalizeAssessmentCode(value))}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="go"
          maxLength={20}
          placeholder="KAYA-7K2"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${errorId} ${hintId}` : hintId}
        />
        <p id={hintId} className="assess-codeform__hint">
          A word, a dash and 3 characters. Codes never use 0, O, 1, I or L after the dash.
        </p>
        {error && (
          <p id={errorId} className="assess-codeform__error" role="alert">
            <Icon name="info" /> {error}
          </p>
        )}
        <div className="assess-actions">
          <Button type="submit" size="lg" iconRight="arrowRight">
            Continue
          </Button>
        </div>
      </form>
      {kind !== 'pre' && (
        <details className="assess-lost">
          <summary>I don&apos;t have my code</summary>
          <p>
            No problem. Take a new code instead. Your answers still help, they just can&apos;t be compared with your
            earlier visit.
          </p>
          <Button variant="secondary" onClick={onLost}>
            Get a new code
          </Button>
        </details>
      )}
      <BackLink onBack={onBack} />
    </section>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="assess-linkbtn assess-linkbtn--back" onClick={onBack}>
      <Icon name="arrowLeft" /> Back
    </button>
  );
}
