import { GAME, HELP_CHANNELS } from '@shieldquest/shared';
import { Link } from 'wouter';
import { Icon, type IconName } from '../../ui/Icon';
import { NEVER_COLLECT, RETENTION, WHAT_WE_USE } from '../data';
import { Reveal, Stagger, StaggerItem } from '../motion';
import { SiteLayout } from '../SiteLayout';
import { ContactBlock, DocSection, OnThisPage, PageHero } from '../parts';
import '../home.css';
import '../pages.css';

const TOC = [
  { href: '#at-a-glance', label: 'At a glance' },
  { href: '#where-data-lives', label: 'Where data lives' },
  { href: '#retention', label: 'How long we keep it' },
  { href: '#content-safety', label: 'Content safety' },
  { href: '#wellbeing', label: 'Wellbeing' },
  { href: '#accessibility', label: 'Accessibility' },
  { href: '#contact', label: 'Questions' },
] as const;

const PLACES: { icon: IconName; where: string; title: string; points: string[] }[] = [
  {
    icon: 'phone',
    where: 'On your device',
    title: 'Solo play',
    points: [
      'Your settings, Guardians, story progress and If-Then card are saved in your browser on that device only.',
      'No API accepts them, so they never reach our server.',
      'Clearing the site data in your browser removes them.',
    ],
  },
  {
    icon: 'users',
    where: 'In memory, during the session',
    title: 'Squad sessions',
    points: [
      'Which seat sealed which vote is held only in server memory while the session runs.',
      'Only group counts are saved, such as “3 minds changed towards safer”.',
      'A random seat token lets a dropped phone rejoin. It identifies a seat, not a person.',
      'The facilitator and the Big Screen never see an individual’s vote, code or nickname.',
    ],
  },
  {
    icon: 'check',
    where: 'Under a random code',
    title: 'Before-and-after checks',
    points: [
      'Answers are linked to a random code like KAYA-7K2, never to a name.',
      'They are stored separately from gameplay, with no way to join the two.',
      'The code never appears in links, web addresses or logs.',
    ],
  },
  {
    icon: 'eye',
    where: 'As group totals only',
    title: 'Analytics',
    points: [
      'Counts per session, squad or mission. There is no per-person record anywhere.',
      'Any group smaller than five is shown as “< 5”.',
      'Solo counters (mission, band, choice) carry no identifier at all.',
      'No third-party analytics, ads, trackers, fonts or CDNs. Our server logs leave out IP addresses and device details.',
      'Like any website, our hosting network sees connection addresses to deliver pages. We don’t store them.',
    ],
  },
];

const CONTENT_RULES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'shield',
    title: 'Fictional brands, people and places',
    body: 'ChatLah, Barang Market, QuikGig, Harbour Bank, MetroPay and CityPass are all made up. Fake links end in .test or .example, and fake phone numbers look like 8XXX XXXX.',
  },
  {
    icon: 'heart',
    title: 'Feedback blames the tactic, not the target',
    body: 'Every feedback card names the manipulator’s trick, a safer move and a way to recover. Blaming words are blocked by automatic checks.',
  },
  {
    icon: 'user',
    title: 'Manipulators have no face',
    body: 'They appear only as a chat handle or a faceless silhouette, never as a person to fear or admire.',
  },
  {
    icon: 'spark',
    title: 'No scare tactics',
    body: 'No handcuffs, no shaking cameras, no horror. The Junior band never sees legal penalties or age thresholds.',
  },
  {
    icon: 'lock',
    title: 'Never a how-to',
    body: 'Shop-theft and money-mule missions teach how to recognise and refuse the ask, never how the offence works.',
  },
  {
    icon: 'check',
    title: 'Two reviews before any pilot',
    body: 'Each mission is checked by two people, one for accuracy with a cited source and one for safeguarding and tone, before it reaches a pilot.',
  },
];

const WELLBEING = [
  'Pause works on every screen, with no penalty.',
  'No screen ever asks about personal experience.',
  'Every mission card carries a content note, and facilitators can skip a scenario.',
  'Help channels are one tap away in every debrief and from the help button.',
  'Simulated scam messages never leave the game: no real texts, emails or calls.',
  'No leaderboards, rankings, loot boxes or real money. Stars are earned by playing, never bought.',
];

const ACCESSIBILITY = [
  'All readable text is real text, sized to the text-size setting (100–200%).',
  'Captions are on by default for every voiced line and meaningful sound.',
  'A full 2D mode, so no decision ever needs the 3D view.',
  'Status is always a shape, an icon and a word, never colour alone.',
  'Tap targets of at least 48 pixels, full keyboard play and tap-to-hold.',
  'Reduced motion swaps camera flights for cuts and fades.',
];

function AtAGlance() {
  return (
    <DocSection
      id="at-a-glance"
      kicker="At a glance"
      title="What we never collect, and the little we use."
      lead="ShieldQuest is designed so there is nothing personal to leak. Players are never asked who they are."
    >
      <div className="site-twin">
        <Reveal className="site-card site-collect site-collect--never">
          <h3 className="site-collect__title">
            <span className="site-collect__mark" aria-hidden="true">
              <Icon name="close" />
            </span>
            Never collected
          </h3>
          <ul>
            {NEVER_COLLECT.map((n) => (
              <li key={n}>
                <Icon name="close" className="site-collect__icon" />
                <span>
                  <span className="sr-only">Never collected: </span>
                  {n}
                </span>
              </li>
            ))}
          </ul>
          <p className="site-collect__foot">
            The game asks for no permissions: no camera, microphone, location, contacts or notifications. In-game forms
            are pictures to inspect, never fields to type into.
          </p>
        </Reveal>
        <Reveal className="site-card site-collect site-collect--use" delay={0.08}>
          <h3 className="site-collect__title">
            <span className="site-collect__mark" aria-hidden="true">
              <Icon name="check" />
            </span>
            Used, and why
          </h3>
          <ul>
            {WHAT_WE_USE.map((w) => (
              <li key={w.title}>
                <Icon name="check" className="site-collect__icon" />
                <span>
                  <b>{w.title}</b>
                  {w.detail}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </DocSection>
  );
}

function WhereDataLives() {
  return (
    <DocSection
      id="where-data-lives"
      kicker="Where data lives"
      title="Most of it never leaves the phone."
      tone="tint"
    >
      <Stagger className="site-places">
        {PLACES.map((p) => (
          <StaggerItem key={p.title} className="site-place">
            <p className="site-place__where">
              <Icon name={p.icon} /> {p.where}
            </p>
            <h3>{p.title}</h3>
            <ul>
              {p.points.map((pt) => (
                <li key={pt}>{pt}</li>
              ))}
            </ul>
          </StaggerItem>
        ))}
      </Stagger>
      <Reveal className="site-note">
        <Icon name="info" />
        <p>
          <b>Plain language, PDPA-aligned.</b> We designed ShieldQuest around the principles of Singapore’s Personal
          Data Protection Act: collect as little as possible, say clearly why, keep it only as long as needed, and
          protect it. This page is a plain-language notice, not a legal certification. Participating institutions share
          their own participant notice before a pilot.
        </p>
      </Reveal>
    </DocSection>
  );
}

function Retention() {
  return (
    <DocSection id="retention" kicker="Retention" title="How long we keep things.">
      <Reveal className="site-tablewrap">
        <table className="site-table site-table--retention">
          <caption>What is kept, and for how long</caption>
          <thead>
            <tr>
              <th scope="col">What</th>
              <th scope="col">How long</th>
            </tr>
          </thead>
          <tbody>
            {RETENTION.map((r) => (
              <tr key={r.what}>
                <th scope="row">{r.what}</th>
                <td data-label="How long">{r.keep}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
    </DocSection>
  );
}

function ContentSafety() {
  return (
    <DocSection
      id="content-safety"
      kicker="Content safety"
      title="Realistic enough to practise on. Safe enough for a classroom."
      lead="Every mission is checked automatically and by people before it reaches a player."
      tone="paper"
    >
      <Stagger className="site-features site-features--paper">
        {CONTENT_RULES.map((c) => (
          <StaggerItem key={c.title} className="site-feature">
            <span className="site-feature__icon" aria-hidden="true">
              <Icon name={c.icon} />
            </span>
            <h3>{c.title}</h3>
            <p>{c.body}</p>
          </StaggerItem>
        ))}
      </Stagger>
      <Reveal>
        <p className="site-fineprint site-fineprint--ink">
          Real help channels are kept in one list and re-checked before every pilot phase. Last verified{' '}
          {HELP_CHANNELS[0]?.asOf ?? 'before launch'}. <Link href="/help">See all help channels</Link>.
        </p>
      </Reveal>
    </DocSection>
  );
}

function Wellbeing() {
  return (
    <DocSection id="wellbeing" kicker="Wellbeing" title="You can always step out.">
      <Reveal>
        <ul className="site-ticks site-ticks--cols">
          {WELLBEING.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </Reveal>
    </DocSection>
  );
}

function AccessibilityStatement() {
  return (
    <DocSection
      id="accessibility"
      kicker="Accessibility statement"
      title="Built to be played by everyone."
      lead="We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA across the game and this website, and to test every release with screen readers, keyboard-only play and colour-vision filters."
      tone="tint"
    >
      <Reveal>
        <ul className="site-ticks site-ticks--cols">
          {ACCESSIBILITY.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p className="site-lead">
          The 3D city is a visual extra. Everything it shows is also available as text or in 2D mode. If something
          doesn’t work for you, please tell the person running your session so the team can fix it.
        </p>
      </Reveal>
    </DocSection>
  );
}

export function SafetyPage() {
  return (
    <SiteLayout
      title="Safety and privacy"
      description="ShieldQuest collects no names, accounts or contact details. See what we never collect, where data lives, how long it is kept and how content is kept safe."
    >
      <PageHero
        kicker="Safety & privacy"
        title="Nothing personal to protect, by design."
        lead="No names. No accounts. No downloads. Solo progress stays on your device, and squad results are only ever group totals."
      >
        <OnThisPage links={TOC} />
      </PageHero>
      <AtAGlance />
      <WhereDataLives />
      <Retention />
      <ContentSafety />
      <Wellbeing />
      <AccessibilityStatement />
      <section className="site-section" id="contact" aria-labelledby="contact-title">
        <div className="container">
          <Reveal className="site-disclaimer">
            <Icon name="info" />
            <p>{GAME.disclaimer}</p>
          </Reveal>
          <Reveal>
            <ContactBlock
              headingId="contact-title"
              title="Questions about data or safety?"
              text="Ask the school or organisation running your session. They can reach Team SecurePi through Nanyang Polytechnic. We don’t collect emails or messages through this website."
              headingLevel={2}
              action={{ href: '/help', label: 'Get help now' }}
            />
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}
