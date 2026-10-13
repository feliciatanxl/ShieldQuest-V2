import { GAME, SKILLS, type SkillId } from '@shieldquest/shared';
import { Link } from 'wouter';
import { LinkButton } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { StillpointClock } from '../art/Skyline';
import { RESEARCH, ROADMAP, TEAM } from '../data';
import { Reveal, Stagger, StaggerItem } from '../motion';
import { SiteLayout } from '../SiteLayout';
import { ContactBlock, DocSection, LetterChip, PageHero } from '../parts';
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

function TeamSection() {
  return (
    <DocSection
      id="team"
      kicker="The team"
      title={`${GAME.team}: two students, one stubborn idea.`}
      lead="We are a youth-led team from Nanyang Polytechnic. We get the same rushed messages, too-good deals and “just this once” dares as everyone else our age, so we decided to build the practice we wished existed."
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

      <TeamSection />

      <DocSection id="principles" kicker="What we stand for" title="Five promises we design by." tone="tint">
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
              Lumen, the pause becomes a button you can press, and then a habit you keep.
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
            See <Link href="/how-it-works">how a mission plays</Link> to find each of these ideas in action.
          </p>
        </Reveal>
      </DocSection>

      <section className="site-section site-section--tight" aria-label="Disclaimer and contact">
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
