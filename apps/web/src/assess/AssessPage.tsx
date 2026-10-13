// /assess and /assess/:kind — Calibration, the short before / after / Return check (GDD §7.6, §9.4, §11).
//
// Privacy first: the notice comes before any question, the only identifier is a random code, every
// question can be skipped, answers are saved as a draft on the device and queued when offline, and
// nothing personal is ever asked (the band question asks school level, never age).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, useParams, useSearch } from 'wouter';
import {
  ASSESSMENT_MIN_GROUP,
  ASSESSMENT_SECTIONS,
  BANDS,
  GAME,
  assessmentFormFor,
  assessmentItems,
  cleanAnswers,
  estimateMinutes,
  isAssessmentKind,
  isRoomCode,
  normalizeRoomCode,
  scoreAssessment,
  type AssessmentAnswer,
  type AssessmentAnswers,
  type AssessmentKind,
  type AssessmentScores,
  type AssessmentSubmission,
  type BandId,
} from '@shieldquest/shared';
import { useSettings } from '../state/settings';
import { Button } from '../ui/Button';
import { HelpButton } from '../ui/HelpPanel';
import { Icon, type IconName } from '../ui/Icon';
import { LogoMark } from '../ui/Logo';
import { SettingsButton } from '../ui/SettingsPanel';
import { StatusBadge } from '../ui/StatusBadge';
import { CodeStep } from './CodeStep';
import { DoneScreen } from './DoneScreen';
import { ItemView, itemLabel } from './items';
import { Option, PrivacyPoint, Progress } from './parts';
import {
  flushAssessmentQueue,
  isQueued,
  loadRecord,
  queuedCount,
  submitAssessment,
  updateRecord,
  type AssessRecord,
  type DoneEntry,
} from './storage';
import './assess.css';

const KIND_INFO: Record<AssessmentKind, { title: string; when: string; icon: IconName; lead: string }> = {
  pre: {
    title: 'Before you play',
    when: 'At the start of your workshop, before the first mission.',
    icon: 'play',
    lead: "A quick check of how you spot tricks right now. It isn't a test, and it doesn't change your game.",
  },
  post: {
    title: 'After you play',
    when: 'At the end of your workshop. Use the same code as before.',
    icon: 'check',
    lead: 'The same kind of questions as before (but different ones), plus what you thought of ShieldQuest.',
  },
  return: {
    title: 'Return to Lumen',
    when: 'A few weeks later, when your school or centre sends the link.',
    icon: 'rewind',
    lead: 'A short check-in a few weeks later, to see what stayed with you. Bring your code.',
  },
};

const BAND_LEVEL: Record<BandId, { label: string; hint: string }> = {
  junior: { label: 'Primary or lower secondary school', hint: 'Shorter questions with simpler words.' },
  teen: { label: 'Secondary school', hint: 'Questions about chats, games, friends and first jobs.' },
  'young-adult': { label: 'Polytechnic, ITE, JC, university or working', hint: 'Questions about money, work and online deals.' },
};

function useDocumentTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} · ShieldQuest`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}

/** Retries queued answers on arrival and whenever the device comes back online. */
function useQueueFlush(onFlushed: () => void) {
  useEffect(() => {
    let live = true;
    const run = () => {
      if (queuedCount() === 0) return;
      void flushAssessmentQueue().then((r) => {
        if (live && r.sent > 0) onFlushed();
      });
    };
    run();
    window.addEventListener('online', run);
    return () => {
      live = false;
      window.removeEventListener('online', run);
    };
  }, [onFlushed]);
}

/** Moves focus to the new screen's heading after a step change (not on first load), and scrolls to the top. */
function useStepFocus(stepKey: string) {
  const ref = useRef<HTMLHeadingElement | null>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    ref.current?.focus({ preventScroll: true });
  }, [stepKey]);
  return ref;
}

// ---------------------------------------------------------------------------------------------

export default function AssessPage() {
  const params = useParams<{ kind?: string }>();
  const search = useSearch();
  const raw = params.kind?.toLowerCase();
  const kind = isAssessmentKind(raw) ? raw : null;
  const sessionParam = useMemo(() => {
    const s = normalizeRoomCode(new URLSearchParams(search).get('session') ?? '');
    return isRoomCode(s) ? s : undefined;
  }, [search]);

  if (!kind) return <KindPicker unknown={raw !== undefined} sessionCode={sessionParam} />;
  return <AssessFlow key={kind} kind={kind} sessionParam={sessionParam} />;
}

// ---------------------------------------------------------------------------------------------
// Shell

interface ShellProps {
  children: ReactNode;
  progress?: { value: number; max: number };
  exitHref?: string;
  footer?: ReactNode;
}

function Shell({ children, progress, exitHref, footer }: ShellProps) {
  return (
    <div className="assess">
      <header className="assess-bar">
        {exitHref ? (
          <Link href={exitHref} className="assess-bar__exit" aria-label="Leave for now. Your answers stay saved on this device.">
            <Icon name="close" />
          </Link>
        ) : (
          <Link href="/" className="assess-bar__home" aria-label="ShieldQuest home">
            <LogoMark size={30} />
          </Link>
        )}
        <div className="assess-bar__mid">
          {progress ? (
            <Progress value={progress.value} max={progress.max} label="Question progress" />
          ) : (
            <span className="assess-bar__title">Before &amp; after check</span>
          )}
        </div>
        <div className="assess-bar__tools">
          <HelpButton />
          <SettingsButton />
        </div>
      </header>
      <main id="main" className="assess-main">
        <div className="assess-wrap">{children}</div>
      </main>
      {footer}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Picker (/assess)

function KindPicker({ unknown, sessionCode }: { unknown: boolean; sessionCode?: string }) {
  useDocumentTitle('Before & after check');
  const [record, setRecord] = useState<AssessRecord>(loadRecord);
  const [queued, setQueued] = useState(queuedCount);
  const refresh = useCallback(() => {
    setRecord(loadRecord());
    setQueued(queuedCount());
  }, []);
  useQueueFlush(refresh);
  const [sending, setSending] = useState(false);
  const qs = sessionCode ? `?session=${encodeURIComponent(sessionCode)}` : '';

  return (
    <Shell>
      <section className="assess-step" aria-labelledby="assess-pick-h">
        <p className="kicker">Calibration</p>
        <h1 id="assess-pick-h" className="assess-h1">
          Before &amp; after check
        </h1>
        {unknown && (
          <p className="assess-note" role="alert">
            <Icon name="info" /> That link didn&apos;t match a check. Pick one below.
          </p>
        )}
        <p className="assess-lead">
          Three short checks help Team SecurePi see whether ShieldQuest really helps people spot and stop tricks. No
          names, just a random code. About 5 minutes each.
        </p>

        {queued > 0 && (
          <div className="assess-queue" role="status">
            <StatusBadge status="attention" label={queued === 1 ? '1 check waiting to send' : `${queued} checks waiting to send`} />
            <p>They are saved on this device and will send when you are online.</p>
            <Button
              variant="secondary"
              icon="rewind"
              disabled={sending}
              onClick={async () => {
                setSending(true);
                await flushAssessmentQueue();
                refresh();
                setSending(false);
              }}
            >
              {sending ? 'Sending…' : 'Send now'}
            </Button>
          </div>
        )}

        <ul className="assess-kinds">
          {(['pre', 'post', 'return'] as const).map((k) => {
            const info = KIND_INFO[k];
            const done = record.done[k];
            const draft = record.draft?.kind === k ? record.draft : undefined;
            return (
              <li key={k}>
                <Link href={`/assess/${k}${qs}`} className={`assess-kind assess-kind--${k}`}>
                  <span className="assess-kind__icon" aria-hidden="true">
                    <Icon name={info.icon} size="1.5rem" />
                  </span>
                  <span className="assess-kind__body">
                    <span className="assess-kind__title">{info.title}</span>
                    <span className="assess-kind__when">{info.when}</span>
                    {done && (
                      <StatusBadge
                        status={done.pending ? 'attention' : 'safe'}
                        label={done.pending ? 'Done, waiting to send' : 'Done on this device'}
                      />
                    )}
                    {!done && draft && <StatusBadge status="unknown" label={`In progress: question ${draft.index + 1}`} />}
                  </span>
                  <Icon name="arrowRight" className="assess-kind__go" />
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="assess-fine">{GAME.disclaimer}</p>
      </section>
    </Shell>
  );
}

// ---------------------------------------------------------------------------------------------
// The flow for one visit

type Step =
  | { at: 'intro' }
  | { at: 'code' }
  | { at: 'band' }
  | { at: 'item'; index: number }
  | { at: 'review'; error?: string }
  | { at: 'sending' }
  | {
      at: 'done';
      scores: AssessmentScores;
      earlier: { kind: AssessmentKind; entry: DoneEntry } | null;
    };

function withoutDraft(r: AssessRecord): AssessRecord {
  const next: AssessRecord = { ...r };
  delete next.draft;
  return next;
}

function stepKey(s: Step): string {
  return s.at === 'item' ? `item-${s.index}` : s.at;
}

function AssessFlow({ kind, sessionParam }: { kind: AssessmentKind; sessionParam?: string }) {
  const info = KIND_INFO[kind];
  useDocumentTitle(`${info.title} · Calibration`);
  const settingsBand = useSettings((s) => s.band);
  const setSettings = useSettings((s) => s.set);

  const [record, setRecord] = useState<AssessRecord>(loadRecord);
  const refresh = useCallback(() => setRecord(loadRecord()), []);
  useQueueFlush(refresh);

  const draft = record.draft?.kind === kind ? record.draft : undefined;
  // Session tag: the link's ?session=, else the one saved with a matching draft or (for the after check) the before check.
  const sessionCode = sessionParam ?? draft?.sessionCode ?? (kind === 'post' ? record.sessionCode : undefined);

  const [step, setStep] = useState<Step>({ at: 'intro' });
  const [code, setCode] = useState<string | null>(null);
  const [band, setBand] = useState<BandId | null>(null);
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [askBand, setAskBand] = useState(false);
  const headingRef = useStepFocus(stepKey(step));
  const exitHref = sessionParam ? `/assess?session=${encodeURIComponent(sessionParam)}` : '/assess';

  const previewBand: BandId = band ?? record.band ?? settingsBand ?? 'teen';
  const form = code ? assessmentFormFor(code, kind) : 'A';
  const items = useMemo(() => assessmentItems(kind, band ?? previewBand, form), [kind, band, previewBand, form]);
  const minutes = estimateMinutes(items);

  // Save the draft as the person goes, so a locked phone or a refresh never loses answers.
  useEffect(() => {
    if (step.at !== 'item' && step.at !== 'review') return;
    if (!code || !band) return;
    const index = step.at === 'item' ? step.index : Math.max(0, items.length - 1);
    updateRecord((r) => ({
      ...r,
      draft: { kind, code, band, index, answers, ...(sessionCode ? { sessionCode } : {}) },
    }));
  }, [step, code, band, answers, kind, items.length, sessionCode]);

  function resume() {
    if (!draft) return;
    const resumedItems = assessmentItems(kind, draft.band, assessmentFormFor(draft.code, kind));
    const { answers: clean } = cleanAnswers(resumedItems, draft.answers);
    setCode(draft.code);
    setBand(draft.band);
    setAnswers(clean);
    setStep({ at: 'item', index: Math.min(draft.index, resumedItems.length - 1) });
  }

  function startFresh() {
    setRecord(updateRecord((r) => (r.draft?.kind === kind ? withoutDraft(r) : r)));
    setAnswers({});
    setStep({ at: 'code' });
  }

  function codeDone(c: string) {
    setCode(c);
    // Keep the band from the person's earlier visit so before and after use the same questions' level.
    const known = record.code === c ? record.band : undefined;
    const b = askBand ? null : (known ?? settingsBand);
    if (b) {
      setBand(b);
      setStep({ at: 'item', index: 0 });
    } else {
      setStep({ at: 'band' });
    }
  }

  function bandDone(b: BandId) {
    setBand(b);
    // Mirror the hub's onboarding: the game uses the same level (plain language on for the junior band).
    if (!settingsBand) setSettings(b === 'junior' ? { band: b, plainLanguage: true } : { band: b });
    setStep({ at: 'item', index: 0 });
  }

  const setAnswer = (id: string, a: AssessmentAnswer | undefined) =>
    setAnswers((prev) => {
      const next = { ...prev };
      if (a) next[id] = a;
      else delete next[id];
      return next;
    });

  async function send() {
    if (!code || !band) return;
    setStep({ at: 'sending' });
    const ids = new Set(items.map((i) => i.id));
    const clean: AssessmentAnswers = {};
    for (const [id, a] of Object.entries(answers)) if (ids.has(id)) clean[id] = a;
    const sub: AssessmentSubmission = { code, kind, band, answers: clean, ...(sessionCode ? { sessionCode } : {}) };
    const result = await submitAssessment(sub);
    if (result === 'rejected') {
      setStep({
        at: 'review',
        error:
          'ShieldQuest could not accept these answers. They are still saved on this device. Try again, or ask the person running your session for help.',
      });
      return;
    }
    // Private Growth Card: scored on the device, kept on the device (the server scores its own copy).
    const scores = scoreAssessment(items, clean);
    const prev = loadRecord();
    const earlierKind: AssessmentKind | null = kind === 'post' ? 'pre' : kind === 'return' ? 'post' : null;
    const pick = (k: AssessmentKind | null) => {
      const e = k ? prev.done[k] : undefined;
      return k && e && e.code === code ? { kind: k, entry: e } : null;
    };
    const earlier = pick(earlierKind) ?? (kind === 'return' ? pick('pre') : null);
    const entry: DoneEntry = { code, form, at: Math.floor(Date.now() / 3_600_000), scores, pending: result === 'queued' };
    const next = updateRecord((r) => {
      const base = withoutDraft(r);
      // A before check with a different code means someone new is using this device: start their record afresh.
      const newPerson = kind === 'pre' && r.code !== code;
      if (kind === 'pre') delete base.sessionCode;
      return {
        ...base,
        code,
        band,
        ...(sessionCode ? { sessionCode } : {}),
        done: newPerson ? { [kind]: entry } : { ...r.done, [kind]: entry },
      };
    });
    setRecord(next);
    setStep({ at: 'done', scores, earlier });
  }

  // --- Screens ---------------------------------------------------------------------------------

  if (step.at === 'intro') {
    return (
      <Shell>
        <section className="assess-step" aria-labelledby="assess-intro-h">
          <p className="kicker">Calibration</p>
          <h1 id="assess-intro-h" className="assess-h1" ref={headingRef} tabIndex={-1}>
            {info.title}
          </h1>
          <p className="assess-lead">{info.lead}</p>
          <p className="assess-meta">
            <span>
              <Icon name="clock" /> About {minutes} minutes
            </span>
            <span>
              <Icon name="book" /> {items.length} questions
            </span>
          </p>

          <div className="assess-privacy" role="region" aria-labelledby="assess-privacy-h">
            <h2 id="assess-privacy-h" className="assess-privacy__title">
              <Icon name="lock" /> Before you start
            </h2>
            <ul className="assess-privacy__list">
              <PrivacyPoint icon="user" title="No names.">
                We never ask your name, age, school, phone number or email. Please don&apos;t type them anywhere.
              </PrivacyPoint>
              <PrivacyPoint icon="qr" title="Your code is random.">
                It only links your before and after answers. It says nothing about who you are.
              </PrivacyPoint>
              <PrivacyPoint icon="arrowRight" title="You can skip any question.">
                Every question has a Skip button. There are no marks and no penalties.
              </PrivacyPoint>
              <PrivacyPoint icon="users" title={`Only groups of ${ASSESSMENT_MIN_GROUP} or more.`}>
                Results are only ever reported for groups of {ASSESSMENT_MIN_GROUP} or more people, never for one
                person.
              </PrivacyPoint>
            </ul>
          </div>

          {(band ?? record.band ?? settingsBand) && (
            <p className="assess-level">
              Questions for: <strong>{BAND_LEVEL[band ?? record.band ?? settingsBand ?? 'teen'].label}</strong>{' '}
              <button type="button" className="assess-linkbtn" onClick={() => setAskBand((v) => !v)} aria-pressed={askBand}>
                {askBand ? 'Keep this level' : 'Change level'}
              </button>
            </p>
          )}

          <div className="assess-actions">
            {draft ? (
              <>
                <Button size="lg" iconRight="arrowRight" onClick={resume}>
                  Continue (question {draft.index + 1})
                </Button>
                <Button size="lg" variant="secondary" onClick={startFresh}>
                  Start again
                </Button>
              </>
            ) : (
              <Button size="lg" iconRight="arrowRight" onClick={startFresh}>
                I understand, let&apos;s start
              </Button>
            )}
          </div>
          <p className="assess-fine">{GAME.disclaimer}</p>
        </section>
      </Shell>
    );
  }

  if (step.at === 'code') {
    return (
      <Shell exitHref={exitHref}>
        <CodeStep
          kind={kind}
          record={record}
          headingRef={headingRef}
          onDone={codeDone}
          onBack={() => setStep({ at: 'intro' })}
        />
      </Shell>
    );
  }

  if (step.at === 'band') {
    return (
      <Shell exitHref={exitHref}>
        <BandStep
          initial={band ?? record.band ?? settingsBand}
          headingRef={headingRef}
          onDone={bandDone}
          onBack={() => setStep({ at: 'code' })}
        />
      </Shell>
    );
  }

  if (step.at === 'item') {
    const index = Math.min(step.index, items.length - 1);
    const item = items[index];
    if (!item) return null;
    const section = ASSESSMENT_SECTIONS[item.section];
    const answer = answers[item.id];
    const last = index === items.length - 1;
    const goNext = () => setStep(last ? { at: 'review' } : { at: 'item', index: index + 1 });
    const goBack = () => setStep(index === 0 ? { at: 'intro' } : { at: 'item', index: index - 1 });
    // "No warning signs" is a real answer for a flags item, so Next works there even with nothing tapped.
    const isFlags = item.type === 'flags';
    const noneFlagged = isFlags && (answer?.type !== 'flags' || answer.picked.length === 0);
    const canNext = isFlags || answer !== undefined;
    const next = () => {
      if (isFlags && !answer) setAnswer(item.id, { type: 'flags', picked: [] });
      goNext();
    };
    const skip = () => {
      setAnswer(item.id, undefined);
      goNext();
    };

    return (
      <Shell
        exitHref={exitHref}
        progress={{ value: index + 1, max: items.length }}
        footer={
          <nav className="assess-nav" aria-label="Question navigation">
            <div className="assess-nav__in">
              <Button variant="ghost" icon="arrowLeft" onClick={goBack} className="assess-nav__back">
                <span className="assess-nav__txt">Back</span>
              </Button>
              <span className="assess-nav__spacer" />
              {(answer === undefined || noneFlagged) && (
                <Button variant="secondary" onClick={skip}>
                  Skip
                </Button>
              )}
              <Button iconRight="arrowRight" onClick={next} disabled={!canNext} className="assess-nav__next">
                {noneFlagged ? 'None here' : last ? 'Finish' : 'Next'}
              </Button>
            </div>
          </nav>
        }
      >
        <article key={item.id} className="assess-q" aria-labelledby={`q-${item.id}`}>
          <header className="assess-q__head">
            <p className="assess-q__num">
              Question {index + 1} of {items.length}
            </p>
            <h2 id={`q-${item.id}`} className="assess-q__title" ref={headingRef} tabIndex={-1}>
              {section.title}
            </h2>
            <p className="assess-q__hint">{section.hint}</p>
          </header>
          <ItemView item={item} answer={answer} onAnswer={(a) => setAnswer(item.id, a)} />
        </article>
      </Shell>
    );
  }

  if (step.at === 'review' || step.at === 'sending') {
    const answered = items.filter((i) => answers[i.id] !== undefined).length;
    const skipped = items.map((item, index) => ({ item, index })).filter(({ item }) => answers[item.id] === undefined);
    const sending = step.at === 'sending';
    return (
      <Shell exitHref={sending ? undefined : exitHref} progress={{ value: items.length, max: items.length }}>
        <section className="assess-step" aria-labelledby="assess-review-h" aria-busy={sending}>
          <p className="kicker">Nearly done</p>
          <h2 id="assess-review-h" ref={headingRef} tabIndex={-1}>
            Ready to send?
          </h2>
          <p className="assess-lead">
            You answered <strong>{answered}</strong> of {items.length} questions.
            {skipped.length === 0 ? ' Every one. Nice.' : ' Skipping is fine.'}
          </p>
          {step.at === 'review' && step.error && (
            <p className="assess-error" role="alert">
              <Icon name="info" /> {step.error}
            </p>
          )}
          <p className="assess-note">
            <Icon name="lock" /> Only your random code, your level and your answers are sent. Nothing else.
          </p>
          <div className="assess-actions">
            <Button size="lg" icon={sending ? undefined : 'check'} onClick={send} disabled={sending}>
              {sending ? 'Sending…' : 'Send my answers'}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              icon="arrowLeft"
              onClick={() => setStep({ at: 'item', index: items.length - 1 })}
              disabled={sending}
            >
              Back to the questions
            </Button>
          </div>
          {skipped.length > 0 && (
            <div className="assess-skipped">
              <h3 className="assess-skipped__title">Skipped questions</h3>
              <p>Want to answer any of them? Tap one to go back to it.</p>
              <ul>
                {skipped.map(({ item, index }) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="assess-skipped__btn"
                      onClick={() => setStep({ at: 'item', index })}
                      disabled={sending}
                    >
                      <span className="assess-skipped__n">{index + 1}</span>
                      <span>{itemLabel(item)}</span>
                      <Icon name="arrowRight" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="sr-only" role="status">
            {sending ? 'Sending your answers.' : ''}
          </p>
        </section>
      </Shell>
    );
  }

  // step.at === 'done'
  if (!code) return null;
  return (
    <Shell>
      <DoneScreen
        kind={kind}
        code={code}
        pending={isQueued(code, kind)}
        onRetry={async () => {
          await flushAssessmentQueue();
          refresh();
          return isQueued(code, kind);
        }}
        items={items}
        answers={answers}
        scores={step.scores}
        earlier={step.earlier}
        headingRef={headingRef}
        {...(sessionCode ? { sessionCode } : {})}
      />
    </Shell>
  );
}

// ---------------------------------------------------------------------------------------------

interface BandStepProps {
  initial: BandId | null | undefined;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onDone: (band: BandId) => void;
  onBack: () => void;
}

function BandStep({ initial, headingRef, onDone, onBack }: BandStepProps) {
  const [picked, setPicked] = useState<BandId | null>(initial ?? null);
  return (
    <section className="assess-step" aria-labelledby="assess-band-h">
      <p className="kicker">One quick thing</p>
      <h2 id="assess-band-h" ref={headingRef} tabIndex={-1}>
        Which fits you best?
      </h2>
      <p>So the questions fit you. We ask your level, never your age or the name of your school.</p>
      <fieldset className="assess-field">
        <legend className="sr-only">Your level</legend>
        <div className="assess-opts">
          {BANDS.map((b) => (
            <Option key={b.id} type="radio" name="assess-band" value={b.id} checked={picked === b.id} onChange={() => setPicked(b.id)}>
              <strong className="assess-opt__strong">{BAND_LEVEL[b.id].label}</strong>
              <span className="assess-opt__sub">{BAND_LEVEL[b.id].hint}</span>
            </Option>
          ))}
        </div>
      </fieldset>
      <div className="assess-actions">
        <Button size="lg" iconRight="arrowRight" disabled={!picked} onClick={() => picked && onDone(picked)}>
          Continue
        </Button>
        <Button size="lg" variant="ghost" icon="arrowLeft" onClick={onBack}>
          Back
        </Button>
      </div>
      {!picked && <p className="assess-fine">Pick one to continue.</p>}
    </section>
  );
}
