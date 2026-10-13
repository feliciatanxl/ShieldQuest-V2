import { GAME, SKILLS, type SkillId } from '@shieldquest/shared';
import { Link } from 'wouter';
import { LinkButton } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { StillpointClock } from '../art/Skyline';
import { RESEARCH, ROADMAP, STATS, TEAM } from '../data';
import { Reveal, Stagger, StaggerItem } from '../motion';
import { SiteLayout } from '../SiteLayout';
import { ContactBlock, DocSection, LetterChip, PageHero, SourceNote } from '../parts';
import '../home.css';
import '../pages.css';

const PIECES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'play', title: 'The game', body: 'ShieldQuest: a 3D browser game for solo play and 90-minute class sessions, with a full 2D mode.' },
  { icon: 'book', title: 'The facilitator toolkit', body: 'A host screen, a Big Screen for the projector, a minute-by-minute run sheet and debrief scripts.' },
  { icon: 'map', title: 'The Scenario Portal', body: 'Where reviewed missions are written and published, so the game keeps up as scams change.' },
  { icon: 'check', title: 'The evaluation', body: 'Before, after and return checks against six indicators, reported only for groups of five or more.' },
];

const PRINCIPLES: { title: string; body: string }[] = [
  { title: 'Youth-led', body: 'Built by students, shaped by co-design with the young people it is for.' },
  { title: 'Practice over posters', body: 'People remember what they did more than what they were told. So players do the pause themselves.' },
  { title: 'Private by default', body: 'No names, no accounts, no tracking. If we don’t collect it, it can’t leak.' },
  { title: 'Never blame the target', body: 'Scams are scripts written by professionals. Our feedback calls out the script, not the person.' },
  { title: 'Honest about what’s next', body: 'We describe plans as plans. Nothing on this site claims an approval or a partnership that hasn’t happened.' },
];

const CAMPAIGN_MAP: { campaign: string; letters: SkillId[]; body: string }[] = [
  { campaign: 'Check', letters: ['S', 'H', 'I', 'E'], body: 'Spot the risk, hold, identify who gains and think through what happens next before you reply, click or pay.' },
  { campaign: 'Tell', letters: ['L', 'D'], body: 'Lead the safer choice and speak up for friends, family and trusted adults.' },
  { campaign: 'Add', letters: [], body: 'ByteBuddy’s tips cover the security features worth adding to your phone and accounts.' },
];

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

/** The problem, with verified figures only (see STATS in data.ts). */
function SecondBefore() {
  const { cases, lost, selfTransfer, youth2025, youthH1, shopTheft } = STATS;
  return (
    <DocSection
      id="the-second-before"
      kicker="The second before"
      title="Most scams don’t break in. They talk people into opening the door."
      lead="Scammers rarely need to hack anything. They manufacture a hurry, a reward or a secret, and wait for one rushed second."
      tone="tint"
    >
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
    </DocSection>
  );
}

/** Why awareness alone isn't enough. */
function TheGap() {
  return (
    <DocSection
      id="the-gap"
      kicker="The gap"
      title="Everyone has heard the warnings. Nobody has practised the moment."
      lead="Talks and posters tell young people what scams look like. But a real scam doesn’t feel like a poster. It feels like a friend, a deal or a deadline, and it arrives when you’re busy."
    >
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
    </DocSection>
  );
}

function TeamSection() {
  return (
    <DocSection
      id="team"
      kicker="The team"
      title={`${GAME.team}: two students, one stubborn idea.`}
      lead="We are a youth-led team from Nanyang Polytechnic. We get the same rushed messages, too-good deals and “just this once” dares as everyone else our age, so we decided to build the practice we wished existed."
      tone="tint"
    >
      <Stagger className="site-team site-team--about">
        {TEAM.map((t) => (
          <StaggerItem key={t.name}>
            <span className="site-team__mono" aria-hidden="true">
              {t.initials}
            </span>
            <span>
              <b>{t.name}</b>
              <span>{t.role} · Nanyang Polytechnic</span>
            </span>
          </StaggerItem>
        ))}
      </Stagger>
    </DocSection>
  );
}

export function AboutPage() {
  return (
    <SiteLayout
      title="About"
      description={`About ${GAME.project} and ${GAME.team}, the youth-led Nanyang Polytechnic team building ShieldQuest.`}
    >
      <PageHero
        kicker={`About ${GAME.project}`}
        title="Built by youths, for the second before."
        lead={`${GAME.name} is the game at the heart of ${GAME.project}, a youth-led crime- and scam-prevention project by ${GAME.team} from Nanyang Polytechnic.`}
        art={
          <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false" className="site-about-clock">
            <defs>
              <radialGradient id="site-about-glow" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="#f2c14e" stopOpacity="0.35" />
                <stop offset="1" stopColor="#f2c14e" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="100" cy="100" r="98" fill="url(#site-about-glow)" />
            <StillpointClock cx={100} cy={100} rad={62} />
          </svg>
        }
      >
        <div className="site-actions">
          <LinkButton href="/play" size="lg" icon="play">
            Play the demo
          </LinkButton>
          <a href="#partner" className="ui-btn ui-btn--secondary ui-btn--lg">
            <Icon name="users" />
            <span>Partner with us</span>
          </a>
        </div>
      </PageHero>

      <DocSection
        id="project"
        kicker={GAME.project}
        title="Practise the split-second decisions, before they’re real."
        lead="Scammers and peer pressure both win the same way: by rushing people past the moment where they would have stopped to think. Project SHIELD trains that moment."
      >
        <Stagger className="site-features site-features--4">
          {PIECES.map((p) => (
            <StaggerItem key={p.title} className="site-feature">
              <span className="site-feature__icon" aria-hidden="true">
                <Icon name={p.icon} />
              </span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal>
          <ol className="site-shieldrow" aria-label="The S.H.I.E.L.D. skills">
            {SKILLS.map((s) => (
              <li key={s.id}>
                <span className="site-shieldrow__letter" aria-hidden="true">
                  {s.id}
                </span>
                <span>{s.name}</span>
              </li>
            ))}
          </ol>
        </Reveal>
      </DocSection>

      <SecondBefore />
      <TheGap />

      <TeamSection />

      <DocSection id="principles" kicker="What we stand for" title="Five promises we design by.">
        <Stagger as="ol" className="site-principles">
          {PRINCIPLES.map((p, i) => (
            <StaggerItem key={p.title}>
              <span className="site-principles__num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </DocSection>

      <DocSection
        id="partners"
        kicker="For partners and funders"
        title="A small team, a clear plan, and results you can measure."
        lead="ShieldQuest is designed to be cheap to run, quick to set up and easy to grow, so a good session in one classroom can become a programme."
        tone="tint"
      >
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
        <Reveal className="site-center">
          <a href="#partner" className="ui-btn ui-btn--secondary">
            <Icon name="users" />
            <span>Partner with us</span>
          </a>
        </Reveal>
      </DocSection>

      <DocSection
        id="plan"
        kicker="The plan"
        title="Where ShieldQuest goes next."
        lead="Pilots are planned from early 2027, starting with tertiary students, subject to partner confirmation."
      >
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
      </DocSection>

      <DocSection
        id="campaigns"
        kicker="Alongside national campaigns"
        title="Adding practice to messages young people already know."
        lead="ShieldQuest doesn’t replace national campaigns; it gives players somewhere to rehearse them. We describe the link in our own words, and use no official logos or artwork."
        tone="tint"
      >
        <div className="site-twin">
          <Reveal className="site-card">
            <h3>“I can ACT against scams”: Add, Check, Tell</h3>
            <ul className="site-campaign">
              {CAMPAIGN_MAP.map((c) => (
                <li key={c.campaign}>
                  <b>{c.campaign}</b>
                  {c.letters.length > 0 && (
                    <span className="site-campaign__letters">
                      <span className="sr-only">S.H.I.E.L.D. skills: </span>
                      {c.letters.map((l) => (
                        <LetterChip key={l} letter={l} />
                      ))}
                    </span>
                  )}
                  <span className="site-campaign__body">{c.body}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal className="site-card" delay={0.08}>
            <h3>“Stop and Check”</h3>
            <p>
              The advice to take a breath before responding to a suspicious message is exactly what HOLD trains. In
              ShieldQuest City, the pause becomes a button you can press, and then a habit you keep.
            </p>
            <p className="site-fineprint site-fineprint--ink">
              ShieldQuest is independent. It is not affiliated with or endorsed by the organisations behind these
              campaigns.
            </p>
          </Reveal>
        </div>
      </DocSection>

      <DocSection
        id="research"
        kicker="Grounded in research"
        title="Why a game, and not another talk."
        lead="The design draws on game-based learning research named in the Project SHIELD proposal: learning by doing, discussing with peers, feeling delayed consequences and practising transfer to new situations."
      >
        <Reveal>
          <ul className="site-refs">
            {RESEARCH.map((r) => (
              <li key={r.authors}>
                <Icon name="book" />
                <span>
                  {r.authors} ({r.year}). <cite>{r.venue}</cite>.
                </span>
              </li>
            ))}
          </ul>
          <p className="site-lead">
            See <Link href="/how-it-works#why-it-works">why it works</Link> and{' '}
            <Link href="/how-it-works">how a mission plays</Link> to find each of these ideas in action.
          </p>
        </Reveal>
      </DocSection>

      <section className="site-section site-section--tight" id="disclaimer" aria-label="Disclaimer and contact">
        <div className="container">
          <Reveal className="site-disclaimer">
            <Icon name="info" />
            <p>{GAME.disclaimer}</p>
          </Reveal>
          <Reveal>
            <ContactBlock id="partner" headingLevel={2} action={{ href: '/educators', label: 'What a pilot looks like' }} />
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}
