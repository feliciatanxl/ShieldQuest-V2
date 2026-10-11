import { BANDS, GAME, GUARDIANS, LEARNING_LOOP, SKILLS, TACTICS, guardianById, skillById } from '@shieldquest/shared';
import { Link } from 'wouter';
import { LinkButton } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { GuardianIcon } from '../../world';
import { StillpointClock } from '../art/Skyline';
import { ClassroomArt, LoopArt } from '../art/Illustrations';
import { HOME_FAQ, KPIS, LOOP_DETAIL, RESEARCH, ROADMAP, SESSION_BLOCKS, STATS, TEAM } from '../data';
import { HeroVisual } from '../HeroVisual';
import { HoldDemo } from '../HoldDemo';
import { Entrance, Reveal, Stagger, StaggerItem } from '../motion';
import { SiteLayout } from '../SiteLayout';
import { ContactBlock, Faq, LetterChip, SectionHead, SourceNote, accent, article } from '../parts';
import '../home.css';

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
              Scams need you to <span className="site-hero__hurry">hurry</span>. You can{' '}
              <span className="site-hero__hold-word">Hold</span>.
            </h1>
          </Entrance>
          <Entrance delay={0.16}>
            <p className="site-hero__tagline">{GAME.tagline}</p>
            <p className="site-hero__pitch">
              ShieldQuest is a 3D game that runs in your browser. Freeze the second before a risky choice, find the
              clues the pressure was hiding, and decide together what happens next. No download, no account. Play solo,
              or as a whole class.
            </p>
          </Entrance>
          <Entrance delay={0.24} className="site-hero__actions">
            <LinkButton href="/play" size="lg" icon="play">
              Play now
            </LinkButton>
            <LinkButton href="/educators" size="lg" variant="secondary" iconRight="arrowRight">
              Bring it to your class
            </LinkButton>
          </Entrance>
          <Entrance delay={0.32}>
            <ul className="site-hero__facts">
              <li>
                <Icon name="phone" /> Runs in the browser
              </li>
              <li>
                <Icon name="lock" /> No names, no accounts
              </li>
              <li>
                <Icon name="users" /> Solo or squads of 4–5
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

const AUDIENCES: { href: string; icon: IconName; label: string }[] = [
  { href: '/educators', icon: 'book', label: 'For teachers and schools' },
  { href: '#partners', icon: 'users', label: 'For partners and funders' },
  { href: '/play', icon: 'play', label: 'For players' },
];

/** (1) The purpose, in one sentence. */
function Purpose() {
  return (
    <section className="site-purpose" aria-labelledby="purpose-title">
      <h2 id="purpose-title" className="sr-only">
        Why ShieldQuest exists
      </h2>
      <div className="container site-purpose__inner">
        <Reveal>
          <p className="site-kicker">Why ShieldQuest exists</p>
          <p className="site-purpose__line">
            ShieldQuest helps young people <mark>practise the split-second decisions</mark> that scammers and peer
            pressure exploit, before they face them for real.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <ul className="site-purpose__who" aria-label="Jump to">
            {AUDIENCES.map((a) =>
              a.href.startsWith('#') ? (
                <li key={a.href}>
                  <a href={a.href}>
                    <Icon name={a.icon} /> {a.label}
                  </a>
                </li>
              ) : (
                <li key={a.href}>
                  <Link href={a.href}>
                    <Icon name={a.icon} /> {a.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/** (2) The problem, with verified figures only. */
function SecondBefore() {
  const { cases, lost, selfTransfer, youth2025, youthH1, shopTheft } = STATS;
  return (
    <section className="site-section" id="the-second-before" aria-labelledby="sb-title">
      <div className="container">
        <SectionHead
          id="sb-title"
          kicker="The second before"
          title="Most scams don’t break in. They talk people into opening the door."
          lead="Scammers rarely need to hack anything. They manufacture a hurry, a reward or a secret, and wait for one rushed second."
        />
        <Stagger as="div" className="site-stats">
          <StaggerItem as="div" className="site-stat site-stat--pair">
            <div>
              <p className="site-stat__value">{cases.value}</p>
              <p className="site-stat__label">{cases.label}</p>
            </div>
            <div>
              <p className="site-stat__value">
                <small>{lost.prefix} </small>
                {lost.value}
                <small> {lost.unit}</small>
              </p>
              <p className="site-stat__label">{lost.label}</p>
            </div>
            <SourceNote source={cases.source} />
          </StaggerItem>

          <StaggerItem as="div" className="site-stat site-stat--gold">
            <p className="site-stat__value">{selfTransfer.value}</p>
            <p className="site-stat__label">{selfTransfer.label}.</p>
            <p className="site-stat__note">No hacking needed. Just pressure, and a second too short to think.</p>
            <SourceNote source={selfTransfer.source} />
          </StaggerItem>

          <StaggerItem as="div" className="site-stat site-stat--wide">
            <div className="site-stat__split">
              <div>
                <p className="site-stat__value">{youth2025.value}</p>
                <p className="site-stat__label">{youth2025.label}.</p>
              </div>
              <div className="site-bars">
                <p className="site-bars__title">{youth2025.breakdownLabel}:</p>
                <ul>
                  {youth2025.breakdown.map((b) => (
                    <li key={b.label}>
                      <span className="site-bars__label">{b.label}</span>
                      <span className="site-bars__track" aria-hidden="true">
                        <span className="site-bars__fill" style={{ width: `${b.value}%` }} />
                      </span>
                      <span className="site-bars__value">{b.value}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <SourceNote source={youth2025.source} />
          </StaggerItem>

          <StaggerItem as="div" className="site-stat">
            <p className="site-stat__value">{youthH1.value}</p>
            <p className="site-stat__label">{youthH1.label}.</p>
            <div className="site-meter">
              <span className="site-meter__track" aria-hidden="true">
                <span className="site-meter__fill" style={{ width: `${youthH1.share.value}%` }} />
              </span>
              <p>
                <b>{youthH1.share.value}%</b> of those {youthH1.share.label}.
              </p>
            </div>
            <SourceNote source={youthH1.source} />
          </StaggerItem>

          <StaggerItem as="div" className="site-stat">
            <p className="site-stat__value">{shopTheft.value}</p>
            <p className="site-stat__label">{shopTheft.label}.</p>
            <p className="site-stat__note">Dares and “just once” pressure work offline too.</p>
            <SourceNote source={shopTheft.source} />
          </StaggerItem>
        </Stagger>
        <p className="site-fineprint site-stats__foot">
          Figures as published by the Singapore Police Force. ShieldQuest is independent and is not endorsed by SPF.
        </p>
      </div>
    </section>
  );
}

/** (3) The engagement gap. */
function TheGap() {
  return (
    <section className="site-section site-section--tint" id="the-gap" aria-labelledby="gap-title">
      <div className="container">
        <SectionHead
          id="gap-title"
          kicker="The gap"
          title="Everyone has heard the warnings. Nobody has practised the moment."
          lead="Talks and posters tell young people what scams look like. But a real scam doesn’t feel like a poster. It feels like a friend, a deal or a deadline, and it arrives when you’re busy."
        />
        <Reveal className="site-gap">
          <div className="site-gap__col site-gap__col--before">
            <h3>
              <Icon name="eye" /> What usually happens
            </h3>
            <ul>
              <li>A talk in the hall, heard once.</li>
              <li>A poster by the lift, nodded at and forgotten.</li>
              <li>Rules to remember, but no chance to use them under pressure.</li>
              <li>Nobody rehearses saying no to a friend.</li>
            </ul>
          </div>
          <span className="site-gap__arrow" aria-hidden="true">
            <Icon name="arrowRight" />
          </span>
          <div className="site-gap__col site-gap__col--after">
            <h3>
              <Icon name="pause" /> What ShieldQuest does
            </h3>
            <ul>
              <li>
                <b>Practise the pause</b> inside a realistic moment, with the clock running.
              </li>
              <li>
                <b>Think it through together</b> before anyone decides.
              </li>
              <li>
                <b>Live with the consequences</b>, which arrive later, the way real ones do.
              </li>
              <li>
                <b>Rehearse the words</b> that pull a friend back.
              </li>
            </ul>
          </div>
        </Reveal>
        <Reveal>
          <p className="site-gap__line">Scams win by rushing people. So we train the pause.</p>
        </Reveal>
      </div>
    </section>
  );
}

/** (4) The solution: HOLD, with a playable taste. */
function HoldSection() {
  const ringLabels = [...new Set(TACTICS.map((t) => t.ringLabel))];
  return (
    <section className="site-section site-holdsec" id="hold" aria-labelledby="hold-title">
      <div className="container site-holdsec__grid">
        <div className="site-holdsec__copy">
          <SectionHead
            id="hold-title"
            kicker="The solution: Hold is a superpower"
            title="Press and hold. The world stops. The pressure doesn’t get a vote."
          />
          <Reveal>
            <p className="site-lead">
              In the city of Lumen, you are a <b>Holder</b>: one of the few people who can stop time for one second,
              the second before someone makes a choice they can’t take back. Then your squad investigates, decides
              together, and lives with what happens next.
            </p>
            <ul className="site-ticks">
              <li>
                <b>You choose when to Hold.</b> Each player has their own HOLD button. Holding earlier buys more time to
                investigate.
              </li>
              <li>
                <b>The Pressure Ring names each tactic as it lands,</b> so the hurry stops being a feeling and becomes
                something you can point at.
              </li>
              <li>
                <b>Messages that haven’t arrived yet hang in mid-air.</b> Hold early and you can read them before they
                land.
              </li>
              <li>
                <b>Never a penalty.</b> If time runs out, the world freezes for you anyway: you can always pause.
              </li>
            </ul>
            <p className="site-holdsec__ringhead">Tactics the Pressure Ring can name:</p>
            <ul className="site-taglist">
              {ringLabels.map((l) => (
                <li key={l}>{l}</li>
              ))}
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

function MissionLoop() {
  return (
    <section className="site-section" id="how-a-mission-plays" aria-labelledby="loop-title">
      <div className="container">
        <SectionHead
          id="loop-title"
          kicker="How a mission plays"
          title="Six stages. One frozen second at the centre."
          lead="Every mission follows the same loop, so the habit sticks: notice, pause, think it through together, then help someone else."
        />
        <Stagger as="ol" className="site-loop">
          {LEARNING_LOOP.map((stage, i) => {
            const extra = LOOP_DETAIL[i];
            return (
              <StaggerItem key={stage.stage} className="site-loop__step">
                <LoopArt index={i} className="site-loop__art" />
                <div className="site-loop__body">
                  <p className="site-loop__num" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <h3>
                    {stage.stage}
                    {extra?.tag && <span className="site-loop__tag">{extra.tag}</span>}
                  </h3>
                  <p>{stage.detail}</p>
                  {extra && (
                    <p className="site-loop__letters">
                      <span className="sr-only">Skills practised: </span>
                      {extra.letters.map((l) => (
                        <LetterChip key={l} letter={l} />
                      ))}
                    </p>
                  )}
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
        <Reveal className="site-center">
          <LinkButton href="/how-it-works" variant="secondary" iconRight="arrowRight">
            The full mission anatomy
          </LinkButton>
        </Reveal>
      </div>
    </section>
  );
}

const WHY: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'play',
    title: 'Learning by doing',
    body: 'Players practise the pause itself, inside a realistic moment, instead of hearing about it. A habit is built by using it.',
  },
  {
    icon: 'chat',
    title: 'Peer discussion',
    body: 'Everyone votes privately first, then explains. Each squad member sees a different piece of the evidence, so talking is how you win.',
  },
  {
    icon: 'clock',
    title: 'Delayed consequences',
    body: 'Choices come back a mission later as Aftershocks, the way real consequences do. Every risky path also shows a way to recover.',
  },
  {
    icon: 'spark',
    title: 'Transfer to new scenarios',
    body: 'Prompts fade across a session. The last mission, and the after-check, use situations the room has never seen.',
  },
];

/** (5) Why it works. */
function WhyItWorks() {
  return (
    <section className="site-section site-section--tint" id="why-it-works" aria-labelledby="why-title">
      <div className="container">
        <SectionHead
          id="why-title"
          kicker="Why it works"
          title="Not a lecture with graphics. Practice that feels like play."
          lead="ShieldQuest is built on four ideas from game-based learning: do it, discuss it, feel the fallout, then try it somewhere new."
        />
        <Stagger className="site-why">
          {WHY.map((w) => (
            <StaggerItem key={w.title}>
              <span className="site-why__icon" aria-hidden="true">
                <Icon name={w.icon} />
              </span>
              <h3>{w.title}</h3>
              <p>{w.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal className="site-research">
          <b>Grounded in research.</b>
          <span>
            The design draws on game-based learning studies named in the Project SHIELD proposal:{' '}
            {RESEARCH.map((r, i) => (
              <span key={r.authors}>
                {i > 0 && '; '}
                {r.authors} ({r.year}), <cite>{r.venue}</cite>
              </span>
            ))}
            .
          </span>
        </Reveal>
      </div>
    </section>
  );
}

function ShieldFramework() {
  return (
    <section className="site-section" id="shield" aria-labelledby="shield-title">
      <div className="container">
        <SectionHead
          id="shield-title"
          kicker="The S.H.I.E.L.D. framework"
          title="Six skills, practised until they’re reflexes."
          lead="Each letter is a prevention skill the game makes you use, not memorise. Every one has a Guardian who unfolds when your squad shows it."
        />
        <Stagger as="ol" className="site-shield">
          {SKILLS.map((s) => {
            const g = guardianById(s.guardian);
            return (
              <StaggerItem key={s.id} className="site-shield__item">
                <span className="site-shield__letter" aria-hidden="true" style={accent(g.color)}>
                  {s.id}
                </span>
                <h3>
                  <span className="sr-only">{s.id}: </span>
                  {s.name}
                </h3>
                <p>{s.description}</p>
                <p className="site-shield__guardian">
                  <GuardianIcon guardian={g.id} size={28} />
                  <span>
                    Guardian: <b>{g.name}</b>
                  </span>
                </p>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}

function GuardiansGallery() {
  return (
    <section className="site-section site-section--night" id="guardians" aria-labelledby="guardians-title">
      <div className="container">
        <SectionHead
          id="guardians-title"
          kicker="Meet the Guardians"
          title="Origami companions that fold themselves out of the frozen air."
          lead="Show a skill and its Guardian unfolds for your whole squad, with an ability you can use once per mission."
        />
        <Stagger className="site-guardians">
          {GUARDIANS.map((g) => {
            const skill = skillById(g.skill);
            return (
              <StaggerItem key={g.id} className="site-guardian">
                <div className="site-guardian__figure" style={accent(g.color)}>
                  <GuardianIcon guardian={g.id} size={88} />
                </div>
                <h3>{g.name}</h3>
                <p className="site-guardian__creature">
                  {article(g.creature)} {g.creature}
                </p>
                <p className="site-guardian__skill">
                  <LetterChip letter={g.skill} /> {skill.name} · {g.preventionSkill}
                </p>
                <p className="site-guardian__ability">
                  <b>{g.abilityName}:</b> {g.ability}
                </p>
              </StaggerItem>
            );
          })}
        </Stagger>
        <Reveal className="site-noluck">
          <p className="site-noluck__title">
            <Icon name="shield" /> Earned by skill, never by luck.
          </p>
          <ul>
            <li>No loot boxes</li>
            <li>No shop or currency</li>
            <li>No leaderboards</li>
            <li>No random drops</li>
          </ul>
          <p className="site-noluck__body">
            Every Guardian rule is written in plain words in the Bond Book. Bonds are shared by the whole squad and
            saved only on each player’s own device.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

const MEASURE: { icon: IconName; title: string; body: string }[] = [
  { icon: 'clock', title: 'Before', body: 'A five-minute check at the start, linked only to a random code like KAYA-7K2.' },
  { icon: 'check', title: 'After', body: 'A parallel check at the end. The code is pre-filled, so nobody types a name.' },
  { icon: 'rewind', title: 'Return, 2–4 weeks later', body: 'The same code opens a short return check, to see what stuck.' },
];

/** (6) Measurable impact. */
function Impact() {
  return (
    <section className="site-section" id="impact" aria-labelledby="impact-title">
      <div className="container">
        <SectionHead
          id="impact-title"
          kicker="Measurable impact"
          title="Six things we measure, so we know it works, not just that it was fun."
          lead="Every pilot is evaluated against six indicators, measured privately before, after and a few weeks later."
        />
        <Stagger as="ol" className="site-kpis">
          {KPIS.map((k) => (
            <StaggerItem key={k.name} className="site-kpi">
              <h3>{k.name}</h3>
              <p>{k.question}</p>
              <p>
                <b>Measured by:</b> {k.measure.charAt(0).toLowerCase() + k.measure.slice(1)}.
              </p>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal className="site-measure">
          {MEASURE.map((m) => (
            <div key={m.title} className="site-measure__step">
              <Icon name={m.icon} />
              <p>
                <b>{m.title}</b>
                <span>{m.body}</span>
              </p>
            </div>
          ))}
        </Reveal>
        <Reveal>
          <p className="site-fineprint site-stats__foot">
            Check answers are stored separately from gameplay with no way to join the two. Results are reported only for
            groups of five or more.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

const CLASSROOM: { icon: IconName; title: string; body: string }[] = [
  { icon: 'qr', title: 'Scan the QR to join', body: 'No app store, no sign-up. Students are in within seconds on their own phones.' },
  { icon: 'users', title: 'Squads of 4–5', body: 'Every player holds a different lens, so the squad has to talk to see the whole picture.' },
  { icon: 'lock', title: 'Private votes', body: 'Votes are sealed on each phone. The squad only sees an anonymous split.' },
  { icon: 'map', title: 'The Big Screen', body: 'The projector shows the city freezing and lighting up. Never anyone’s choices or scores.' },
  { icon: 'phone', title: 'Works on older phones', body: 'Graphics adjust automatically, and a full 2D mode works on any device.' },
];

/** (7) Built for real classrooms. */
function Classrooms() {
  const total = SESSION_BLOCKS.reduce((n, b) => n + b.minutes, 0);
  return (
    <section className="site-section site-section--tint" id="classrooms" aria-labelledby="class-title">
      <div className="container">
        <div className="site-split">
          <div>
            <SectionHead
              id="class-title"
              kicker="Built for real classrooms"
              title="One projector. A room of phones. Ninety minutes people talk about after."
            />
            <Stagger className="site-iconlist">
              {CLASSROOM.map((c) => (
                <StaggerItem key={c.title}>
                  <span className="site-iconlist__icon">
                    <Icon name={c.icon} />
                  </span>
                  <span>
                    <b>{c.title}</b>
                    {c.body}
                  </span>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
          <Reveal className="site-split__art">
            <ClassroomArt className="site-classroom-art" />
          </Reveal>
        </div>

        <Reveal className="site-session">
          <h3 className="site-session__title">
            <Icon name="clock" /> A {total}-minute session
          </h3>
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
          <div className="site-actions">
            <LinkButton href="/educators" className="site-btn-ink" iconRight="arrowRight">
              Read the educator guide
            </LinkButton>
            <LinkButton href="/host" variant="secondary" icon="qr">
              Run a session
            </LinkButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const PRIVACY: { icon: IconName; title: string; body: string }[] = [
  { icon: 'user', title: 'No names', body: 'Players get a generated nickname. Nobody types who they are.' },
  { icon: 'lock', title: 'No accounts', body: 'No sign-up, no passwords, no email, nothing to forget.' },
  { icon: 'phone', title: 'No downloads', body: 'It runs in the browser. Nothing to install, no permissions asked.' },
  { icon: 'pin', title: 'Progress stays on your device', body: 'Guardians and story progress are saved on the phone, not on a server.' },
  { icon: 'users', title: 'Groups of 5 or more', body: 'Results are only ever shown for groups of at least five. Smaller groups read “< 5”.' },
];

const SAFE_CONTENT: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'shield',
    title: 'Fictional by design',
    body: 'Every brand, person, link and phone number is made up, like ChatLah and Harbour Bank. No real logos.',
  },
  {
    icon: 'heart',
    title: 'Blame the tactic, not the target',
    body: 'Feedback names the manipulator’s trick and shows a way to recover. Nobody is told they “fell for” anything.',
  },
  {
    icon: 'help',
    title: 'Help is always one tap away',
    body: 'Verified help lines appear in every debrief, and Pause works on every screen with no penalty.',
  },
];

/** (8) Safe by design. */
function PrivacyBand() {
  return (
    <section className="site-section site-paperband" id="privacy" aria-labelledby="privacy-title">
      <div className="container">
        <SectionHead
          id="privacy-title"
          kicker="Safe by design"
          title="ShieldQuest doesn’t need to know who you are."
          lead="We built the game so there is nothing personal to leak. That is a design decision, not a setting."
          tone="paper"
        />
        <Stagger className="site-privacy">
          {PRIVACY.map((p) => (
            <StaggerItem key={p.title}>
              <Icon name={p.icon} size="1.75rem" />
              <b>{p.title}</b>
              <span>{p.body}</span>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal className="site-safe">
          {SAFE_CONTENT.map((s) => (
            <div key={s.title} className="site-safe__item">
              <h3>
                <Icon name={s.icon} /> {s.title}
              </h3>
              <p>{s.body}</p>
            </div>
          ))}
        </Reveal>
        <Reveal className="site-actions">
          <LinkButton href="/safety" className="site-btn-ink" iconRight="arrowRight">
            How we handle data
          </LinkButton>
          <LinkButton href="/help" variant="secondary" className="site-btn-outline-ink" icon="heart">
            Get help now
          </LinkButton>
        </Reveal>
      </div>
    </section>
  );
}

function Bands() {
  return (
    <section className="site-section" id="bands" aria-labelledby="bands-title">
      <div className="container">
        <SectionHead
          id="bands-title"
          kicker="Three content bands"
          title="The same city, tuned for every age from 10 to 24."
          lead="Players pick “Which fits you best?”. The game never asks for a date of birth."
        />
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
      </div>
    </section>
  );
}

const PARTNER_POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'check',
    title: 'Outcomes you can report',
    body: 'Six KPIs, measured before, after and on return, with an aggregate impact report at the end of each pilot.',
  },
  {
    icon: 'phone',
    title: 'Budget-light delivery',
    body: 'Runs in any modern browser on phones students already have. No app-store fees, no devices to buy, nothing to install.',
  },
  {
    icon: 'map',
    title: 'Grows as scams evolve',
    body: 'The Scenario Portal adds new missions after two reviews, so content keeps up with new tactics without a new app.',
  },
  {
    icon: 'users',
    title: 'Youth-led, youth-shaped',
    body: 'Built by students and co-designed with young people. Approved youth-made Moment Cards can become missions.',
  },
];

/** (9) roadmap, (10) team and the partner contact block. */
function Partners() {
  return (
    <section className="site-section site-section--tint" id="partners" aria-labelledby="partners-title">
      <div className="container">
        <SectionHead
          id="partners-title"
          kicker="For partners and funders"
          title="A small team, a clear plan, and results you can measure."
          lead="ShieldQuest is designed to be cheap to run, quick to set up and easy to grow, so a good session in one classroom can become a programme."
        />
        <Stagger className="site-partner">
          {PARTNER_POINTS.map((p) => (
            <StaggerItem key={p.title}>
              <span className="site-partner__icon" aria-hidden="true">
                <Icon name={p.icon} />
              </span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </StaggerItem>
          ))}
        </Stagger>

        <div className="site-subsection" id="roadmap">
          <Reveal>
            <h3 className="site-subhead">The pilot roadmap</h3>
          </Reveal>
          <Stagger as="ol" className="site-roadmap">
            {ROADMAP.map((r) => (
              <StaggerItem key={r.title}>
                <span className="site-roadmap__when">{r.step}</span>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
          <p className="site-fineprint site-roadmap__note">
            This is a plan, not an announcement. No pilot, grant or partnership is confirmed until partners agree.
          </p>
        </div>

        <div className="site-subsection" id="team">
          <Reveal>
            <h3 className="site-subhead">The team</h3>
            <p className="site-subhead__lead">
              {GAME.team} is a youth-led student team from Nanyang Polytechnic, building {GAME.project}.
            </p>
          </Reveal>
          <Stagger className="site-team">
            {TEAM.map((t) => (
              <StaggerItem key={t.name}>
                <span className="site-team__mono" aria-hidden="true">
                  {t.initials}
                </span>
                <span>
                  <b>{t.name}</b>
                  <span>
                    {t.role} · Nanyang Polytechnic
                  </span>
                </span>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <Reveal>
          <ContactBlock id="partner-contact" />
        </Reveal>
      </div>
    </section>
  );
}

function HomeFaq() {
  return (
    <section className="site-section" id="faq" aria-labelledby="faq-title">
      <div className="container site-faqwrap">
        <SectionHead
          id="faq-title"
          kicker="Questions"
          title="Good questions, straight answers."
          lead="Something else on your mind? The educator guide and the safety page go deeper."
        />
        <Faq items={HOME_FAQ} />
      </div>
    </section>
  );
}

/** (11) Calls to action. */
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
          <p className="site-cta__lead">
            Play a mission now, bring a squad session to your class, or help us take ShieldQuest to more young people.
          </p>
          <div className="site-actions site-actions--center">
            <LinkButton href="/play" size="lg" icon="play">
              Play the demo
            </LinkButton>
            <LinkButton href="/host" size="lg" variant="secondary" icon="qr">
              Run a class session
            </LinkButton>
            <a href="#partner-contact" className="ui-btn ui-btn--secondary ui-btn--lg">
              <Icon name="users" />
              <span>Partner with us</span>
            </a>
          </div>
          <p className="site-cta__small">
            Joining a class session? <Link href="/join">Enter the room code</Link>.
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
      <Purpose />
      <SecondBefore />
      <TheGap />
      <HoldSection />
      <MissionLoop />
      <WhyItWorks />
      <ShieldFramework />
      <GuardiansGallery />
      <Impact />
      <Classrooms />
      <PrivacyBand />
      <Bands />
      <Partners />
      <HomeFaq />
      <FinalCta />
    </SiteLayout>
  );
}
