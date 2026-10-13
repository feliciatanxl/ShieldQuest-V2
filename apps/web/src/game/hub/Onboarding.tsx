// First-run gate for solo play (GDD §7.1): the hook, the disclaimer and data notice, "Which fits you best?"
// (a school level, never an age or birthday), and a hands-on HOLD rehearsal. Nothing typed, nothing uploaded.
import { useCallback, useId, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Link, useLocation } from 'wouter';
import { BANDS, GAME, missionById, type BandId } from '@shieldquest/shared';
import { useSettings } from '../../state/settings';
import { Button } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { LogoMark } from '../../ui/Logo';
import { HelpButton } from '../../ui/HelpPanel';
import { SettingsButton } from '../../ui/SettingsPanel';
import { HoldDemo } from './HoldDemo';
import { TUTORIAL_ID } from './hubData';
import { Stillpoint, useReducedMotionSetting, useSfx } from './kit';
import './onboarding.css';

type Step = 'welcome' | 'band' | 'hold';
const STEPS: { id: Step; label: string }[] = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'band', label: 'Your level' },
  { id: 'hold', label: 'How to Hold' },
];

/** Plain-words description of each band's experience (labels stay school levels, not ages). */
const BAND_BLURB: Record<BandId, string> = {
  junior: 'Shorter moments, simpler words and two or three clear choices.',
  teen: 'Group pressure, branching stories and choices that come back later.',
  'young-adult': 'Trickier evidence, money and work decisions, and grey areas.',
};

const PROMISES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'user', title: 'No names, no sign-up', text: 'We never ask who you are. There is no account.' },
  { icon: 'phone', title: 'Nothing to download', text: 'It runs right here in your browser.' },
  { icon: 'lock', title: 'Your progress stays on this phone', text: 'Guardians, notes and stats are saved only on this device.' },
];

const HOLD_STEPS: { title: string; text: string }[] = [
  {
    title: 'Watch the moment',
    text: 'A scene plays out live. The Pressure Ring names each trick as it lands, like URGENCY or BIG REWARD.',
  },
  {
    title: 'Hold',
    text: 'Press and hold HOLD. Time freezes for you, and only you. Nothing is rushing you now.',
  },
  {
    title: 'Look, then choose',
    text: 'Find the red flags, pull the string to see who gains, then pick the safer move. Time runs again after.',
  },
];

export function Onboarding() {
  const savedBand = useSettings((s) => s.band);
  const set = useSettings((s) => s.set);
  const [step, setStep] = useState<Step>('welcome');
  const [band, setBand] = useState<BandId | null>(savedBand);
  const [, navigate] = useLocation();
  const moved = useRef(false);
  const reduced = useReducedMotionSetting();
  const sfx = useSfx();
  const bandName = useId();
  const tutorial = missionById(TUTORIAL_ID);
  const index = STEPS.findIndex((s) => s.id === step);

  // The next step mounts only after the old one has animated out, so focus is moved from a callback ref
  // (an effect on `step` would focus the outgoing heading). Screen readers and keyboards follow along,
  // and the new card starts at the top instead of wherever the old one was scrolled to.
  const headingRef = useCallback((el: HTMLHeadingElement | null) => {
    if (!el || !moved.current) return;
    moved.current = false;
    window.scrollTo({ top: 0 });
    el.focus({ preventScroll: true });
  }, []);

  const go = (next: Step) => {
    sfx('pageTurn');
    moved.current = true;
    setStep(next);
  };

  const saveBand = () => {
    if (!band) return;
    // Plain language is switched on for the junior band; other bands keep whatever the player chose.
    set(band === 'junior' ? { band, plainLanguage: true } : { band });
    go('hold');
  };

  const finish = (playTutorial: boolean) => {
    sfx('success');
    set({ onboarded: true });
    if (playTutorial && tutorial) navigate(`/play/m/${tutorial.id}`);
  };

  const slide = reduced ? { opacity: 0 } : { opacity: 0, x: 28 };

  return (
    <div className="hub-ob" data-anim={reduced ? 'off' : 'on'}>
      <header className="hub-ob__top">
        <Link href="/" className="hub-ob__home" aria-label="ShieldQuest home page">
          <LogoMark size={34} />
          <span className="hub-ob__brand">
            Shield<b>Quest</b>
          </span>
        </Link>
        <div className="hub-ob__tools">
          <SettingsButton />
          <HelpButton />
        </div>
      </header>

      <main id="main" className="hub-ob__main">
        <ol className="hub-ob__steps" aria-label="Setup progress">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              aria-current={s.id === step ? 'step' : undefined}
              className={i < index ? 'is-done' : i === index ? 'is-now' : undefined}
            >
              <span className="hub-ob__dot" aria-hidden="true">
                {i < index ? <Icon name="check" size="0.9em" /> : i + 1}
              </span>
              <span className="hub-ob__steplabel">
                <span className="sr-only">
                  Step {i + 1} of {STEPS.length}:{' '}
                </span>
                {s.label}
                {i < index && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          ))}
        </ol>

        <AnimatePresence mode="wait" initial={false}>
          <m.section
            key={step}
            className={`hub-ob__card hub-ob__card--${step}`}
            aria-labelledby="hub-ob-title"
            initial={slide}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -28 }}
            transition={{ duration: reduced ? 0.12 : 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 'welcome' && (
              <>
                <div className="hub-ob__art">
                  <Stillpoint size={120} />
                </div>
                <p className="kicker">Welcome to {GAME.city}</p>
                <h1 id="hub-ob-title" ref={headingRef} tabIndex={-1}>
                  {GAME.hook}
                </h1>
                <p className="hub-ob__lead">
                  In Lumen, every risky moment is caught one second before it happens. Help the people who live here
                  spot the tricks, hold before acting, and choose the safer way out.
                </p>
                <ul className="hub-ob__promises">
                  {PROMISES.map((p) => (
                    <li key={p.title}>
                      <span className="hub-ob__picon" aria-hidden="true">
                        <Icon name={p.icon} />
                      </span>
                      <span>
                        <strong>{p.title}</strong>
                        <span className="hub-ob__ptext">{p.text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="hub-ob__disclaimer">
                  <Icon name="info" /> {GAME.disclaimer}
                </p>
                <div className="hub-ob__actions">
                  <Button size="lg" iconRight="arrowRight" onClick={() => go('band')}>
                    Let&apos;s go
                  </Button>
                </div>
              </>
            )}

            {step === 'band' && (
              <>
                <p className="kicker">Pick what suits you</p>
                <h1 id="hub-ob-title" ref={headingRef} tabIndex={-1}>
                  Which fits you best?
                </h1>
                <p className="hub-ob__lead">
                  This picks the moments and words that suit you. We never ask your age or your birthday.
                </p>
                <fieldset className="hub-ob__bands">
                  <legend className="sr-only">Your school level</legend>
                  {BANDS.map((b) => (
                    <label key={b.id} className={`hub-ob__band${band === b.id ? ' is-picked' : ''}`}>
                      <input
                        type="radio"
                        name={bandName}
                        value={b.id}
                        checked={band === b.id}
                        onChange={() => {
                          sfx('tap');
                          setBand(b.id);
                        }}
                      />
                      <span className="hub-ob__bandmark" aria-hidden="true">
                        <Icon name="check" size="0.95em" />
                      </span>
                      <span className="hub-ob__bandtext">
                        <strong>{b.segment}</strong>
                        <span>{BAND_BLURB[b.id]}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <p className="hub-ob__note">
                  <Icon name="settings" /> You can change this any time in Comfort settings.
                </p>
                <div className="hub-ob__actions">
                  <Button variant="ghost" icon="arrowLeft" onClick={() => go('welcome')}>
                    Back
                  </Button>
                  <Button size="lg" iconRight="arrowRight" disabled={!band} onClick={saveBand}>
                    Continue
                  </Button>
                </div>
                {!band && (
                  <p className="hub-ob__note hub-ob__note--quiet" aria-live="polite">
                    Choose one to continue.
                  </p>
                )}
              </>
            )}

            {step === 'hold' && (
              <>
                <p className="kicker">Your one power</p>
                <h1 id="hub-ob-title" ref={headingRef} tabIndex={-1}>
                  How to Hold
                </h1>
                <ol className="hub-ob__how">
                  {HOLD_STEPS.map((s, i) => (
                    <li key={s.title}>
                      <span className="hub-ob__hownum" aria-hidden="true">
                        {i + 1}
                      </span>
                      <span>
                        <strong>{s.title}</strong>
                        <span className="hub-ob__ptext">{s.text}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <h2 className="hub-ob__tryit">Try it now</h2>
                <HoldDemo band={band} />
                <div className="hub-ob__actions">
                  <Button variant="ghost" icon="arrowLeft" onClick={() => go('band')}>
                    Back
                  </Button>
                  {tutorial ? (
                    <>
                      <Button variant="secondary" onClick={() => finish(false)}>
                        Explore the city first
                      </Button>
                      <Button size="lg" icon="play" onClick={() => finish(true)}>
                        Play the tutorial
                      </Button>
                    </>
                  ) : (
                    <Button size="lg" iconRight="arrowRight" onClick={() => finish(false)}>
                      Enter Lumen
                    </Button>
                  )}
                </div>
                {tutorial && (
                  <p className="hub-ob__note">
                    <Icon name="clock" /> The tutorial, &ldquo;{tutorial.title}&rdquo;, takes about two minutes.
                  </p>
                )}
              </>
            )}
          </m.section>
        </AnimatePresence>
      </main>
    </div>
  );
}
