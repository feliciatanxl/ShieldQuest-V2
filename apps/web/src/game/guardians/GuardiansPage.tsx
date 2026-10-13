// /play/guardians: the Bond Book. Six Guardians with every earning rule in plain words, the
// Counter-Playbook, private If-Then plans and the player's own record. All of it lives on this device.
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link } from 'wouter';
import { GAME, GUARDIANS, GUARDIAN_BOND_LEVELS, TACTICS, guardianLevel } from '@shieldquest/shared';
import { useProgress } from '../../state/progress';
import { HelpButton } from '../../ui/HelpPanel';
import { Icon, type IconName } from '../../ui/Icon';
import { SettingsButton } from '../../ui/SettingsPanel';
import { MotionRoot, revealInRow, useReducedMotionSetting } from '../hub/kit';
import { seenTactics } from './bondData';
import { GuardianShelf } from './GuardianShelf';
import { Playbook } from './Playbook';
import { IfThenList, RecordStats } from './Record';
import { ResetProgress } from './ResetProgress';
import '../hub/kit.css';
import './guardians.css';

type SectionId = 'guardians' | 'playbook' | 'ifthen' | 'record';

const SECTIONS: { id: SectionId; label: string; icon: IconName }[] = [
  { id: 'guardians', label: 'Guardians', icon: 'spark' },
  { id: 'playbook', label: 'Playbook', icon: 'book' },
  { id: 'ifthen', label: 'If-Then', icon: 'envelope' },
  { id: 'record', label: 'Record', icon: 'eye' },
];

const sectionDomId = (id: SectionId) => `hub-bb-${id}`;

function BondBook() {
  const progress = useProgress((s) => s.progress);
  const reduced = useReducedMotionSetting();
  const [active, setActive] = useState<SectionId>('guardians');
  const [announce, setAnnounce] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const navRef = useRef<HTMLUListElement>(null);
  const jumpLock = useRef(0);

  const unfolded = GUARDIANS.filter((g) => guardianLevel(progress.guardianBond[g.id] ?? 0) > 0).length;
  const marks = GUARDIANS.reduce((n, g) => n + guardianLevel(progress.guardianBond[g.id] ?? 0), 0);
  const maxMarks = GUARDIANS.length * GUARDIAN_BOND_LEVELS.length;
  const pages = seenTactics(progress).size;
  const plans = progress.ifThenCards.length;

  useEffect(() => {
    const before = document.title;
    document.title = 'Bond Book · ShieldQuest';
    return () => {
      document.title = before;
    };
  }, []);

  // Highlight the section being read in the sticky nav (aria-current="location"): the last section whose top
  // has passed a line a third of the way down the screen, or the last one once the page bottom is reached.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (performance.now() < jumpLock.current) return;
      const line = window.innerHeight * 0.33;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current: SectionId = SECTIONS[0]?.id ?? 'guardians';
      for (const s of SECTIONS) {
        const el = document.getElementById(sectionDomId(s.id));
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      if (atBottom) current = SECTIONS[SECTIONS.length - 1]?.id ?? current;
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // On phones the section links scroll sideways: keep the current one visible as the reader moves down.
  useEffect(() => {
    revealInRow(navRef.current, navRef.current?.querySelector('[aria-current]') ?? null, reduced);
  }, [active, reduced]);

  const jump = (e: MouseEvent<HTMLAnchorElement>, id: SectionId) => {
    e.preventDefault();
    const el = document.getElementById(sectionDomId(id));
    if (!el) return;
    // Hold the highlight on the chosen section while a smooth scroll passes the ones in between.
    jumpLock.current = performance.now() + (reduced ? 0 : 900);
    setActive(id);
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    el.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  };

  const afterReset = (message: string) => {
    setAnnounce(message);
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    titleRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className="hub-bb" data-anim={reduced ? 'off' : 'on'}>
      <header className="hub-bb-top">
        <div className="hub-bb-top__bar">
          <Link href="/play" className="hub-bb-back">
            <Icon name="arrowLeft" />
            <span>
              ShieldQuest City<span className="sr-only">: back to the city</span>
            </span>
          </Link>
          <h1 ref={titleRef} tabIndex={-1} className="hub-bb-top__title">
            Bond Book
          </h1>
          <div className="hub-bb-top__tools">
            <SettingsButton />
            <HelpButton />
          </div>
        </div>
        <nav className="hub-bb-nav" aria-label="Bond Book sections">
          <ul ref={navRef}>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${sectionDomId(s.id)}`}
                  className="hub-bb-nav__link"
                  aria-current={active === s.id ? 'location' : undefined}
                  onClick={(e) => jump(e, s.id)}
                >
                  <Icon name={s.icon} size="1.05em" />
                  <span>{s.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="main" className="hub-bb-main">
        <section className="hub-bb-intro" aria-label="Summary">
          <p className="hub-bb-intro__lead">
            Guardians unfold when you <strong>show a skill</strong>, never by luck. Every rule is written here, and
            there is nothing to buy.
          </p>
          <ul className="hub-bb-summary">
            <li>
              <strong>
                {unfolded}/{GUARDIANS.length}
              </strong>{' '}
              Guardians unfolded
            </li>
            <li>
              <strong>
                {marks}/{maxMarks}
              </strong>{' '}
              Bond marks
            </li>
            <li>
              <strong>
                {pages}/{TACTICS.length}
              </strong>{' '}
              Playbook pages
            </li>
          </ul>
        </section>

        <section id={sectionDomId('guardians')} data-section="guardians" className="hub-bb-section" aria-labelledby="hub-bb-guardians-title">
          <header className="hub-bb-section__head">
            <h2 id="hub-bb-guardians-title" tabIndex={-1}>
              Guardians
            </h2>
            <p>
              One Guardian for each S.H.I.E.L.D. skill. Each has three Bond marks, and marks only change how it
              looks.
            </p>
          </header>
          <GuardianShelf progress={progress} />
        </section>

        <section id={sectionDomId('playbook')} data-section="playbook" className="hub-bb-section" aria-labelledby="hub-bb-playbook-title">
          <header className="hub-bb-section__head">
            <h2 id="hub-bb-playbook-title" tabIndex={-1}>
              Counter-Playbook
            </h2>
            <p>
              The tricks manipulators use, and how to beat them. {pages} of {TACTICS.length} pages found. Keep it as
              your field guide.
            </p>
          </header>
          <Playbook progress={progress} />
        </section>

        <section id={sectionDomId('ifthen')} data-section="ifthen" className="hub-bb-section" aria-labelledby="hub-bb-ifthen-title">
          <header className="hub-bb-section__head">
            <h2 id="hub-bb-ifthen-title" tabIndex={-1}>
              Your If-Then plans
            </h2>
            <p>
              <Icon name="lock" size="1em" /> Private. {plans > 0 ? `${plans} saved on this phone only.` : 'Saved on this phone only.'}
            </p>
          </header>
          <IfThenList progress={progress} />
        </section>

        <section id={sectionDomId('record')} data-section="record" className="hub-bb-section" aria-labelledby="hub-bb-record-title">
          <header className="hub-bb-section__head">
            <h2 id="hub-bb-record-title" tabIndex={-1}>
              Your record
            </h2>
            <p>What holding did for you, mission by mission.</p>
          </header>
          <RecordStats progress={progress} />
        </section>

        <section className="hub-bb-section hub-bb-device" aria-labelledby="hub-bb-device-title">
          <header className="hub-bb-section__head">
            <h2 id="hub-bb-device-title">This device</h2>
          </header>
          <ResetProgress onDone={afterReset} />
        </section>

        <p className="ui-disclaimer hub-bb-disclaimer">{GAME.disclaimer}</p>
      </main>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

export default function GuardiansPage() {
  return (
    <MotionRoot>
      <BondBook />
    </MotionRoot>
  );
}
