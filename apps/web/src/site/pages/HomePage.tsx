import { BANDS, GAME } from '@shieldquest/shared';
import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { LinkButton } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { StillpointClock } from '../art/Skyline';
import { LoopArt } from '../art/Illustrations';
import { HeroVisual } from '../HeroVisual';
import { HoldDemo } from '../HoldDemo';
import { Entrance, Reveal, Stagger, StaggerItem } from '../motion';
import { SiteLayout } from '../SiteLayout';
import { SectionHead } from '../parts';
import '../home.css';
import '../pages.css';

// The home page sells the game in five beats: what it is, the hook (try HOLD), how it works,
// why you can trust it, and a closing call to action. The detail lives on the inner pages.

/** (1) What ShieldQuest is, and the two ways in. */
function Hero() {
  return (
    <section className="site-hero" aria-labelledby="site-hero-title">
      <div className="site-hero__inner container">
        <div className="site-hero__copy">
          <Entrance>
            <p className="site-kicker">
              <span className="site-kicker__dot" aria-hidden="true" /> {GAME.project} · a game by {GAME.team}
            </p>
          </Entrance>
          <Entrance delay={0.08}>
            <h1 id="site-hero-title" className="site-hero__title">
              Stop time. Spot the scam. Make the <span className="site-hero__hold-word">call</span>.
            </h1>
          </Entrance>
          <Entrance delay={0.16}>
            <p className="site-hero__tagline">{GAME.tagline}</p>
            <p className="site-hero__pitch">
              ShieldQuest is a 3D game you play in your browser. Freeze the second before a risky choice, find the red
              flags, and decide what happens next.
            </p>
          </Entrance>
          <Entrance delay={0.24} className="site-hero__actions">
            <LinkButton href="/play" size="lg" icon="play">
              Play now
            </LinkButton>
            <LinkButton href="/host" size="lg" variant="secondary" icon="qr">
              Run a class session
            </LinkButton>
          </Entrance>
          <Entrance delay={0.32}>
            <ul className="site-hero__facts">
              <li>
                <Icon name="phone" /> No download
              </li>
              <li>
                <Icon name="lock" /> No sign-up
              </li>
              <li>
                <Icon name="users" /> Solo or with your class
              </li>
            </ul>
          </Entrance>
        </div>
        <Entrance delay={0.12} className="site-hero__frame">
          <HeroVisual />
        </Entrance>
      </div>
    </section>
  );
}

/** (2) The hook, with a playable taste of HOLD. */
function HoldSection() {
  return (
    <section className="site-section site-holdsec" id="hold" aria-labelledby="hold-title">
      <div className="container site-holdsec__grid">
        <div className="site-holdsec__copy">
          <SectionHead
            id="hold-title"
            kicker="Your one superpower"
            title={
              <>
                Scams need you to <span className="site-hero__hurry">hurry</span>. You can{' '}
                <span className="site-hero__hold-word">Hold</span>.
              </>
            }
            lead="Press and hold, and the world stops. The pressure can’t rush you any more. Now you get to think."
          />
          <Reveal>
            <ul className="site-ticks">
              <li>
                <b>The Pressure Ring</b> names each trick the moment it lands.
              </li>
              <li>
                <b>Hold early</b> and you can read messages before they even arrive.
              </li>
              <li>
                <b>No penalty, ever.</b> Run out of time and the world freezes for you anyway.
              </li>
            </ul>
          </Reveal>
        </div>
        <Reveal className="site-holdsec__demo" delay={0.1}>
          <h3 className="site-holdsec__demo-title">
            <Icon name="play" /> Try it: hold the moment
          </h3>
          <HoldDemo />
        </Reveal>
      </div>
    </section>
  );
}

/** Each step borrows an illustration from the learning-loop set (Explore, Protect, Decide). */
const STEPS: { art: number; title: string; body: ReactNode }[] = [
  {
    art: 0,
    title: 'Scan the QR',
    body: 'In class, scan the code on the big screen. On your own, just tap Play now. No app, no sign-up.',
  },
  {
    art: 5,
    title: 'Squad up',
    body: 'Team up in a squad of 4–5. Every phone sees a different clue, so you have to talk. Playing solo? Three in-game squadmates help you out.',
  },
  {
    art: 3,
    title: 'Make the call',
    body: 'Hold the moment, spot the red flags and vote in secret. Then decide together. Your choice comes back later, just like in real life.',
  },
];

/** (3) How it works, in three steps, plus the play loop between missions. */
function HowItWorks() {
  return (
    <section className="site-section site-section--tint" id="how-it-works" aria-labelledby="how-title">
      <div className="container">
        <SectionHead id="how-title" kicker="How it works" title="Three steps. Nothing to install." />
        <Stagger as="ol" className="site-loop">
          {STEPS.map((s, i) => (
            <StaggerItem key={s.title} className="site-loop__step">
              <LoopArt index={s.art} className="site-loop__art" />
              <div className="site-loop__body">
                <p className="site-loop__num" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal>
          <p className="site-lead site-home__more">
            Playing on your own? Roll the <b>City Board</b>, play quick mini-games like <b>Red-Flag Wordsearch</b>,{' '}
            <b>Real or Fake?</b> and <b>Money Trail</b>, earn <b>Stars</b> and unlock new looks.
          </p>
        </Reveal>
        <Reveal className="site-center">
          <LinkButton href="/how-it-works" variant="secondary" iconRight="arrowRight">
            See how a mission plays
          </LinkButton>
        </Reveal>
      </div>
    </section>
  );
}

const TRUST: { icon: IconName; title: string; body: ReactNode }[] = [
  {
    icon: 'lock',
    title: 'No names, no accounts, no emails',
    body: (
      <>
        Nothing personal to leak. Your progress stays on your device. <Link href="/safety">How we keep it safe</Link>
      </>
    ),
  },
  {
    icon: 'users',
    title: 'Made for ages 10 to 24',
    body: `${BANDS.map((b) => `${b.label} ${b.ages}`).join(' · ')}. You pick the one that fits.`,
  },
  {
    icon: 'heart',
    title: 'Made by youths, for youths',
    body: (
      <>
        Built by {GAME.team}, a student team at Nanyang Polytechnic. <Link href="/about#partner">Partner with us</Link>
      </>
    ),
  },
  {
    icon: 'info',
    title: 'Not an official SPF product',
    body: (
      <>
        A student project. Every scenario, person and brand is made up.{' '}
        <Link href="/about#disclaimer">Read the disclaimer</Link>
      </>
    ),
  },
];

/** (4) One compact trust strip: privacy, ages, who made it, and the disclaimer. */
function TrustStrip() {
  return (
    <section className="site-section site-section--tight site-paperband" id="trust" aria-labelledby="trust-title">
      <div className="container">
        <SectionHead id="trust-title" kicker="Safe by design" title="Safe to play. Honest about who we are." tone="paper" />
        <Stagger className="site-privacy site-privacy--4">
          {TRUST.map((t) => (
            <StaggerItem key={t.title}>
              <Icon name={t.icon} size="1.75rem" />
              <b>{t.title}</b>
              <span>{t.body}</span>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/** (5) Closing call to action. */
function FinalCta() {
  return (
    <section className="site-cta" aria-labelledby="cta-title">
      <div className="container site-cta__inner">
        <Reveal>
          <svg className="site-cta__clock" viewBox="0 0 80 80" aria-hidden="true" focusable="false">
            <StillpointClock cx={40} cy={40} rad={30} />
          </svg>
          <p className="site-kicker">Ready when you are</p>
          <h2 id="cta-title">{GAME.closing}</h2>
          <p className="site-cta__lead">Play your first mission in a couple of minutes, or bring a squad session to your class.</p>
          <div className="site-actions site-actions--center">
            <LinkButton href="/play" size="lg" icon="play">
              Play now
            </LinkButton>
            <LinkButton href="/host" size="lg" variant="secondary" icon="qr">
              Run a class session
            </LinkButton>
          </div>
          <p className="site-cta__small">
            Joining a class? <Link href="/join">Enter the room code</Link>. Teaching?{' '}
            <Link href="/educators">Read the educator guide</Link>.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <SiteLayout description={`ShieldQuest: ${GAME.hook} A 3D scam- and crime-prevention game for youths. ${GAME.tagline}`}>
      <Hero />
      <HoldSection />
      <HowItWorks />
      <TrustStrip />
      <FinalCta />
    </SiteLayout>
  );
}
