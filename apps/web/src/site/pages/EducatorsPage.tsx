import { Component, Suspense, lazy, type ReactNode } from 'react';
import { BANDS, GAME, helpById, type HelpChannelId } from '@shieldquest/shared';
import { Link } from 'wouter';
import { LinkButton } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { StatusBadge } from '../../ui/StatusBadge';
import { ClassroomArt } from '../art/Illustrations';
import { KPIS, RUN_SHEET, SESSION_BLOCKS, type FaqItem } from '../data';
import { Reveal, Stagger, StaggerItem } from '../motion';
import { SiteLayout } from '../SiteLayout';
import { ContactBlock, DocSection, Faq, OnThisPage, PageCta, PageHero } from '../parts';
import '../home.css';
import '../pages.css';

const MissionCatalogue = lazy(() => import('./MissionCatalogue'));

/** If the mission list chunk fails to load (flaky Wi-Fi), say so instead of breaking the page. */
class CatalogueBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <p className="site-note site-note--soft">
          <Icon name="info" />
          <span>The mission list couldn’t load. Check your connection and refresh the page.</span>
        </p>
      );
    }
    return this.props.children;
  }
}

const TOC = [
  { href: '#who', label: 'Who it’s for' },
  { href: '#what-you-need', label: 'What you need' },
  { href: '#how-to-run', label: 'How to run it' },
  { href: '#run-sheet', label: '90-minute run sheet' },
  { href: '#topics', label: 'Bands and topics' },
  { href: '#safeguarding', label: 'Safeguarding' },
  { href: '#evaluation', label: 'Evaluation' },
  { href: '#kit', label: 'Offline kit' },
  { href: '#portal', label: 'Scenario Portal' },
] as const;

const WHO: { icon: IconName; title: string; body: string }[] = [
  { icon: 'book', title: 'Teachers and form tutors', body: 'Character and citizenship lessons, cyber wellness periods, or the last week of term.' },
  { icon: 'users', title: 'Youth workers and CCAs', body: 'Youth groups, uniformed groups and student clubs who want something people actually join in.' },
  { icon: 'map', title: 'Community partners', body: 'Community centres and outreach teams running sessions for young people aged 10 to 24.' },
  { icon: 'spark', title: 'Polytechnics, ITE and universities', body: 'Orientation, residential life and student-wellbeing programmes for 17 to 24 year olds.' },
];

const NEEDS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'map', title: 'A projector or TV, plus a laptop', body: 'The laptop runs the session; the projector shows the Big Screen. Mirroring works too.' },
  {
    icon: 'phone',
    title: 'Students’ phones, or shared devices',
    body: 'One phone per player is best. Older phones work too: graphics adjust automatically, and a full 2D mode runs on any device. If devices are short, Shared Seat passes one phone around with a cover screen for private votes.',
  },
  {
    icon: 'spark',
    title: 'Wi-Fi, with a 4G hotspot as backup',
    body: 'A whole session is designed to use under 3 MB per phone. The host screen runs a network check before you start.',
  },
  { icon: 'check', title: 'Nothing to install', body: 'No app store, no accounts, no student emails. Everything runs in the browser.' },
];

const STEPS: { title: string; body: ReactNode }[] = [
  {
    title: 'Open the host screen',
    body: (
      <>
        On the laptop, open <Link href="/host">Run a session</Link> about ten minutes early and put it on the projector.
      </>
    ),
  },
  { title: 'Pick a band and 2–3 missions', body: 'Choose the content band for your class, then two core missions and an optional third.' },
  {
    title: 'Show the QR code',
    body: 'Students scan it, set their comfort settings and tap their table’s totem. Each phone gets a generated nickname. Nobody types a name.',
  },
  { title: 'The Room Freeze', body: '“Everyone, press and hold.” The whole room practises HOLD together, then plays a 75-second practice moment.' },
  { title: 'Play the missions', body: 'One big Next button always does the right thing. Look Up breaks freeze every phone between missions.' },
  { title: 'Debrief: Flip the Board', body: 'The Big Screen turns the city around to reveal the manipulator’s corkboard: every tactic, strung to the moment it was used.' },
  {
    title: 'The after-check',
    body: (
      <>
        Students take the short <Link href="/assess">before &amp; after check</Link> again. Their random code is
        pre-filled.
      </>
    ),
  },
];

const GROUND_RULES = ['Respect each other’s views.', 'Nobody has to share anything personal.', 'Pause and Pass are always OK.'];

const SAFE_TOOLS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'heart',
    title: 'No disclosure required',
    body: 'No screen ever asks about personal experience. Every mission and debrief prompt is about a fictional character.',
  },
  {
    icon: 'door',
    title: 'Step out any time',
    body: 'Pause is on every screen, with no penalty. You see only an anonymous count of how many players are on a break.',
  },
  {
    icon: 'info',
    title: 'Content notes and skips',
    body: 'Every mission card carries a content note. You can skip a scenario, switch on Calm Mode, or use Gentle mode for a squad.',
  },
  {
    icon: 'eye',
    title: 'You never see individual answers',
    body: 'Squad agreement shows as United, Mostly agree or Split. Never a vote, a session code or a name.',
  },
];

const SAFE_HELP: HelpChannelId[] = ['scamshield-1799', 'mindline-1771', 'sos-1767', 'tinkle-friend', 'police-999'];

const KIT = [
  'Scene cards with lift-the-flap clues',
  'Exit cards and face-down vote tokens',
  'Sealed Aftershock envelopes',
  'Peer Shield tile cards',
  'A HOLD card',
  'Paper before-and-after forms',
];

const EDU_FAQ: readonly FaqItem[] = [
  {
    q: 'Do I need to be good with technology?',
    a: 'No. If you can open a website on a laptop and plug in a projector, you can run a session. The host screen gives you a script for each phase and one big Next button. A rehearsal mode lets you practise with pretend squads.',
  },
  {
    q: 'What if the school Wi-Fi blocks it?',
    a: 'The host screen checks the network before you start. If it is blocked, students can switch to mobile data or a 4G hotspot: a session is designed to use under 3 MB per phone.',
  },
  {
    q: 'What if some students don’t have a phone?',
    a: 'Use Shared Seat: one device is passed around the squad, with a cover screen so votes stay private. Squads of 3 to 6 are supported.',
  },
  {
    q: 'We only have one period. Can we run a shorter session?',
    a: 'The full design is 90 minutes. The third mission is optional and drops automatically if the room runs behind. For a shorter slot, play one or two missions and keep the debrief, because that is where most of the learning lands.',
  },
  {
    q: 'What happens if a student gets upset?',
    a: 'They can press Pause at any time and step away. Check in with them privately, follow your organisation’s safeguarding procedure, and point them to the help channels on the Help Card. The game never asks anyone to share their own experiences.',
  },
  {
    q: 'Is this endorsed by the police or a government agency?',
    a: `No. ${GAME.disclaimer} S.H.I.E.L.D. is designed to sit alongside national messages like “Add, Check, Tell”, in our own words and without official logos.`,
  },
];

function Who() {
  return (
    <DocSection
      id="who"
      kicker="Who it’s for"
      title="For anyone who works with young people aged 10 to 24."
      lead="You don’t need to be a scam expert. The game carries the content; you carry the room."
    >
      <Stagger className="site-features site-features--4">
        {WHO.map((w) => (
          <StaggerItem key={w.title} className="site-feature">
            <span className="site-feature__icon" aria-hidden="true">
              <Icon name={w.icon} />
            </span>
            <h3>{w.title}</h3>
            <p>{w.body}</p>
          </StaggerItem>
        ))}
      </Stagger>
    </DocSection>
  );
}

function WhatYouNeed() {
  return (
    <DocSection id="what-you-need" kicker="What you need" title="One projector, a room of phones, nothing to install." tone="tint">
      <div className="site-split">
        <Stagger className="site-iconlist">
          {NEEDS.map((n) => (
            <StaggerItem key={n.title}>
              <span className="site-iconlist__icon">
                <Icon name={n.icon} />
              </span>
              <span>
                <b>{n.title}</b>
                {n.body}
              </span>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal className="site-split__art">
          <ClassroomArt className="site-classroom-art" />
        </Reveal>
      </div>
    </DocSection>
  );
}

function HowToRun() {
  return (
    <DocSection
      id="how-to-run"
      kicker="How to run it"
      title="Seven steps, and the game keeps time for you."
      lead="Try a mission yourself first so you know how HOLD feels. Then, on the day:"
    >
      <Stagger as="ol" className="site-steps">
        {STEPS.map((s, i) => (
          <StaggerItem key={s.title} className="site-steps__item">
            <span className="site-steps__num" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
      <Reveal className="site-actions">
        <LinkButton href="/host" size="lg" icon="qr">
          Run a session
        </LinkButton>
        <LinkButton href="/play" size="lg" variant="secondary" icon="play">
          Try a mission first
        </LinkButton>
      </Reveal>
    </DocSection>
  );
}

function RunSheet() {
  const total = SESSION_BLOCKS.reduce((n, b) => n + b.minutes, 0);
  return (
    <DocSection
      id="run-sheet"
      kicker="The run sheet"
      title={`The ${total}-minute session, minute by minute.`}
      lead="Screen time comes in short bursts of 9 to 14 minutes, with Look Up breaks in between and phones dimmed while squads talk."
      tone="tint"
    >
      <Reveal className="site-session site-session--flush">
        <div className="site-session__bar" aria-hidden="true">
          {SESSION_BLOCKS.map((b) => (
            <span key={b.id} className={`site-session__seg site-session__seg--${b.id}`} style={{ flexGrow: b.minutes }}>
              <span>{b.minutes}</span>
            </span>
          ))}
        </div>
        <ol className="site-session__list">
          {SESSION_BLOCKS.map((b) => (
            <li key={b.id} className={`site-session__item site-session__item--${b.id}`}>
              <b>
                {b.minutes} min · {b.label}
              </b>
              <span>{b.detail}</span>
            </li>
          ))}
        </ol>
      </Reveal>
      <Reveal className="site-tablewrap">
        <table className="site-table site-table--runsheet">
          <caption>Run sheet for a 90-minute squad session</caption>
          <thead>
            <tr>
              <th scope="col">Clock</th>
              <th scope="col">What happens</th>
            </tr>
          </thead>
          <tbody>
            {RUN_SHEET.map((r) => (
              <tr key={r.clock} className={r.segment ? 'is-segment' : undefined}>
                <th scope="row">
                  <span className="site-table__clock">{r.clock}</span>
                  {r.segment && <span className="site-table__segment">{r.segment}</span>}
                </th>
                <td>{r.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
    </DocSection>
  );
}

function Topics() {
  return (
    <DocSection
      id="topics"
      kicker="Content bands and topics"
      title="Real tactics, fictional stories, tuned to the age in the room."
      lead="Each band gets its own wording, number of choices and level of consequence detail. The Junior band never sees legal penalties."
    >
      <Stagger className="site-bands">
        {BANDS.map((b, i) => (
          <StaggerItem key={b.id} className={`site-band site-band--${i}`}>
            <p className="site-band__ages">
              {b.ages}
              <small> years</small>
            </p>
            <h3>{b.label}</h3>
            <p className="site-band__segment">{b.segment}</p>
            <p>{b.design}</p>
          </StaggerItem>
        ))}
      </Stagger>
      <Reveal className="site-subsection">
        <h3 className="site-subhead">The missions</h3>
        <p className="site-subhead__lead">
          <b>Guided</b> missions show a prompt under every letter. <b>Light</b> missions show the letters only.{' '}
          <b>Wildcard</b> missions drop the prompts and use a situation the room hasn’t seen, to test whether the habit
          transfers.
        </p>
        <CatalogueBoundary>
          <Suspense fallback={<p className="site-loading">Loading the mission list…</p>}>
            <MissionCatalogue />
          </Suspense>
        </CatalogueBoundary>
      </Reveal>
    </DocSection>
  );
}

function Safeguarding() {
  return (
    <DocSection
      id="safeguarding"
      kicker="Safeguarding"
      title="Built so nobody has to share, and anybody can step out."
      lead="Scams and peer pressure can touch real lives. These guardrails are built into the game, and these habits help in the room."
      tone="paper"
    >
      <div className="site-twin">
        <Reveal className="site-rules">
          <h3>Ground rules to read aloud</h3>
          <ol>
            {GROUND_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
          <p>
            Read the disclaimer aloud too: <q>{GAME.disclaimer}</q>
          </p>
        </Reveal>
        <Stagger className="site-iconlist site-iconlist--ink">
          {SAFE_TOOLS.map((t) => (
            <StaggerItem key={t.title}>
              <span className="site-iconlist__icon">
                <Icon name={t.icon} />
              </span>
              <span>
                <b>{t.title}</b>
                {t.body}
              </span>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
      <Reveal className="site-card site-card--outline">
        <h3>If a student tells you something worrying</h3>
        <p>
          Thank them, don’t probe in front of the group, and follow your school’s or organisation’s safeguarding and
          reporting procedure. If someone is in danger now, call <b>999</b>. These channels are shown in every debrief:
        </p>
        <ul className="site-minihelp">
          {SAFE_HELP.map((id) => {
            const h = helpById(id);
            return (
              <li key={id}>
                <b>{h.name}</b>
                <span className="site-minihelp__contact">{h.contact}</span>
                {h.hours && <span className="site-minihelp__hours">{h.hours}</span>}
              </li>
            );
          })}
        </ul>
        <p>
          <Link href="/help">All help channels</Link> · <Link href="/safety">Safety and privacy</Link>
        </p>
      </Reveal>
    </DocSection>
  );
}

function Evaluation() {
  return (
    <DocSection
      id="evaluation"
      kicker="Evaluation"
      title="Measure what changed, without knowing who anyone is."
      lead="Each pilot is evaluated against six indicators, using short checks before, after and a few weeks later."
    >
      <Stagger as="ol" className="site-codeflow">
        <StaggerItem>
          <b>Before</b>
          <span>About 5 minutes, at the start. Each phone gets a random code like</span>
          <code>KAYA-7K2</code>
        </StaggerItem>
        <StaggerItem>
          <b>After</b>
          <span>A parallel check at the end. The code is pre-filled, so nobody types anything about themselves.</span>
        </StaggerItem>
        <StaggerItem>
          <b>Return, 2–4 weeks later</b>
          <span>
            Your organisation shares the return link through its own channels. The code opens a short check and one new
            mission. We never send messages.
          </span>
        </StaggerItem>
      </Stagger>
      <Reveal className="site-tablewrap">
        <table className="site-table site-table--kpis">
          <caption>The six indicators</caption>
          <thead>
            <tr>
              <th scope="col">Indicator</th>
              <th scope="col">Main measure</th>
              <th scope="col">In-game signal (group totals only)</th>
            </tr>
          </thead>
          <tbody>
            {KPIS.map((k) => (
              <tr key={k.name}>
                <th scope="row">
                  <span className="site-table__title">{k.name}</span>
                  <span className="site-table__sub">{k.question}</span>
                </th>
                <td data-label="Main measure">{k.measure}</td>
                <td data-label="In-game signal">{k.signal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
      <Reveal className="site-note">
        <Icon name="lock" />
        <p>
          Check answers are linked only to the random code and stored separately from gameplay, with no way to join the
          two. Results are only ever reported for groups of five or more; smaller groups show “&lt; 5”. Paper forms with
          the same code are available as a backup.
        </p>
      </Reveal>
    </DocSection>
  );
}

function Kit() {
  return (
    <DocSection
      id="kit"
      kicker="Printable offline kit"
      title="No screens? The same session on paper."
      lead="A Paper Bridge kit, printed from the same content as the game, so a session can still run when devices or Wi-Fi can’t."
      tone="tint"
    >
      <Reveal className="site-card site-kit">
        <div className="site-kit__head">
          <h3>Paper Bridge kit</h3>
          <StatusBadge status="unknown" label="Planned" />
        </div>
        <ul className="site-ticks site-ticks--ink site-kit__list">
          {KIT.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
        <p className="site-kit__note">
          The disclaimer is printed on every component, and there are no official logos. The kit is planned for the pilot
          phase and isn’t available to download yet.
        </p>
      </Reveal>
    </DocSection>
  );
}

function Portal() {
  return (
    <DocSection
      id="portal"
      kicker="Scenario Portal"
      title="New scams appear every month. New missions can too."
      lead="The Scenario Portal is where the team, educators and facilitators write, check and publish missions, so content keeps up with new tactics without a new app."
    >
      <div className="site-split site-split--top">
        <Reveal>
          <ul className="site-ticks">
            <li>
              <b>Automatic content checks</b> flag real brands, personal details, real phone numbers or links, outdated
              helplines, reading level and blaming language.
            </li>
            <li>
              <b>Two sign-offs before anything is published:</b> one for content accuracy with a cited source, one for
              safeguarding and tone.
            </li>
            <li>
              <b>Youth-made Moment Cards:</b> after a session, players can suggest a fictional moment. An educator moderates
              every card before the team builds it out.
            </li>
            <li>
              <b>For adults only.</b> There are no youth accounts anywhere in ShieldQuest.
            </li>
          </ul>
        </Reveal>
        <Reveal className="site-card site-portalcard">
          <Icon name="book" size="2rem" />
          <h3>Open the Scenario Portal</h3>
          <p>For the team and invited educators and facilitators.</p>
          <LinkButton href="/portal" className="site-btn-ink" iconRight="arrowRight">
            Scenario Portal
          </LinkButton>
        </Reveal>
      </div>
    </DocSection>
  );
}

export function EducatorsPage() {
  return (
    <SiteLayout
      title="For educators"
      description="Run a 90-minute ShieldQuest session: a projector, students’ phones and nothing to install. Run sheet, safeguarding guidance and evaluation."
    >
      <PageHero
        kicker="For educators"
        title="Run a session your class will still talk about next week."
        lead="ShieldQuest is a 90-minute facilitated session for one projector and a room of phones. Nothing to install, no student accounts, and a script for every minute."
        art={<ClassroomArt />}
      >
        <div className="site-actions">
          <LinkButton href="/host" size="lg" icon="qr">
            Run a session
          </LinkButton>
          <LinkButton href="/play" size="lg" variant="secondary" icon="play">
            Try it yourself
          </LinkButton>
        </div>
        <OnThisPage links={TOC} />
      </PageHero>
      <Who />
      <WhatYouNeed />
      <HowToRun />
      <RunSheet />
      <Topics />
      <Safeguarding />
      <Evaluation />
      <Kit />
      <Portal />
      <section className="site-section" aria-labelledby="edu-faq-title">
        <div className="container site-faqwrap">
          <div className="site-head">
            <p className="site-kicker">Questions</p>
            <h2 id="edu-faq-title">What educators ask us.</h2>
          </div>
          <Faq items={EDU_FAQ} />
        </div>
      </section>
      <section className="site-section site-section--tight" aria-label="Contact">
        <div className="container">
          <ContactBlock
            title="Want a pilot at your school or youth organisation?"
            headingLevel={2}
            action={{ href: '/about', label: 'About the team' }}
          />
        </div>
      </section>
      <PageCta title="Ready when your class is." lead="Open the host screen, pick a band and show the QR code." />
    </SiteLayout>
  );
}
