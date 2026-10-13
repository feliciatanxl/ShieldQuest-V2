import { BANDS, SQUAD_ROLES, guardianForSkill, tacticById, type SkillId } from '@shieldquest/shared';
import { Link } from 'wouter';
import { LinkButton } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { StatusBadge } from '../../ui/StatusBadge';
import { GuardianIcon } from '../../world/flat/GuardianIcon';
import { FrozenPhoneArt } from '../art/Illustrations';
import { Reveal, Stagger, StaggerItem } from '../motion';
import { SiteLayout } from '../SiteLayout';
import { DocSection, LetterChip, OnThisPage, PageCta, PageHero } from '../parts';
import '../home.css';
import '../pages.css';

interface AnatomyStep {
  id: string;
  name: string;
  letters: SkillId[];
  when: string;
  body: string;
  line?: string;
}

/** The squad mission, phase by phase (GAME_DESIGN.md §5.3), in player-facing words. */
const ANATOMY: readonly AnatomyStep[] = [
  {
    id: 'live',
    name: 'Live',
    letters: ['S'],
    when: 'About 45–60 seconds',
    body: 'The moment plays in real time on your own phone: a chat, a deal, a dare. Each time a pressure tactic lands, the Pressure Ring around your HOLD button gains a labelled segment, like URGENCY or KEEP IT SECRET.',
  },
  {
    id: 'hold',
    name: 'HOLD',
    letters: ['H'],
    when: 'Whenever you choose',
    body: 'Press and hold to freeze your world. Colour drains, the rain hangs in the air, and messages that haven’t arrived yet float in mid-air so you can read them early. Wait too long and Lumen freezes for you at the decision second. No penalty, ever.',
    line: 'Time is held. Nothing is rushing you now.',
  },
  {
    id: 'investigate',
    name: 'Investigate',
    letters: ['S', 'I'],
    when: 'Until the shared freeze ends',
    body: 'Orbit the frozen scene, inspect chats, people and places, and pin evidence to the squad’s board. Some clues are red herrings, where “Seems fine” is the right call. One quiet clue has no highlight at all.',
  },
  {
    id: 'string',
    name: 'Pull the string',
    letters: ['I'],
    when: 'During the freeze',
    body: 'Drag from whoever is applying the pressure to the person under it. The string tightens and a Gain Tag shows what they get out of it, such as “Paid S$50 per recruit”. The Influence Tracer can also see hidden strings.',
  },
  {
    id: 'forecast',
    name: 'Sealed forecast',
    letters: ['E'],
    when: 'Before anyone votes',
    body: 'Everyone privately predicts what is most likely three weeks from now. Nobody sees it yet. It is checked later, when the consequence actually lands.',
  },
  {
    id: 'vote',
    name: 'Think, vote, explain',
    letters: ['L'],
    when: 'About 3 minutes',
    body: 'Seal a private vote with how sure you are, see the squad’s anonymous split, then talk it through. Re-seal privately; the majority decides what happens next.',
  },
  {
    id: 'release',
    name: 'Release',
    letters: ['E'],
    when: '30–45 seconds',
    body: 'Time resumes and the outcome plays out. A feedback card names the tactic, a safer move and a way to recover. If something is still in motion, a seed drops onto the timeline.',
    line: 'Lumen will remember this.',
  },
  {
    id: 'aftershock',
    name: 'Aftershock',
    letters: ['E'],
    when: 'A mission later',
    body: 'The delayed consequence lands at the start of a later mission. Everyone traces it back to the choice that planted it, checks their forecast, and gets a Late Hold: a chance to recover.',
  },
  {
    id: 'peer-shield',
    name: 'Peer Shield',
    letters: ['D'],
    when: 'About 3 minutes',
    body: '“Two days later…” A friend is frozen at their own second. The squad builds one message, a tile from each phone, to pull them back without blame.',
  },
  {
    id: 'bond',
    name: 'Bond',
    letters: ['S', 'H', 'I', 'E', 'L', 'D'],
    when: '20 seconds',
    body: 'The letters you showed light up, privately, on your own phone. Guardians unfold for the squad’s shared bonds. Then: phones down.',
  },
];

const SLOTS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'clock', title: 'At the next mission', body: 'The usual place: an Aftershock slot opens the next mission, before anyone is under pressure again.' },
  { icon: 'map', title: 'During a Look Up break', body: 'Only as an anonymous teaser on the Big Screen: “Somewhere in Digi-District, a bank notice is on its way…”' },
  { icon: 'rewind', title: 'At the “+2 weeks” finale', body: 'Everything still pending lands, so nobody walks into the after-check with an unresolved story.' },
];

const TVE: { name: string; body: string }[] = [
  { name: 'Think', body: 'A 10-second breathing ring runs before you can seal. Pick an exit and a forecast, alone.' },
  { name: 'Seal', body: 'Your vote folds into an envelope with one, two or three shields for how sure you are.' },
  { name: 'Reveal', body: 'Anonymous dots on each exit, in shuffled order. Junior squads see a mood instead: United, Mostly agree or Split.' },
  {
    name: 'Explain',
    body: 'Role sentence-starters and reason chips get the talk going. A chip only shows once two people pick it, and a Steelman card asks someone to argue the other side. Pass is always fine.',
  },
  { name: 'Re-seal', body: 'Keep or change your vote, privately. The majority decides; on a tie, the Safety Lead adds a visible “Because…”.' },
];

const SHIELD_SLOTS: { name: string; example: string }[] = [
  { name: 'Opener', example: '“Hey, are you okay? You’ve been quiet.”' },
  { name: 'Reason', example: '“They pay S$50 per recruit. That’s why they’re rushing you.”' },
  { name: 'Offer', example: '“Want me to come with you to ask?”' },
  { name: 'Channel', example: '“Let’s check with the ScamShield Helpline first.”' },
];

const ACCESS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'map',
    title: '2D mode',
    body: 'A full flat view of every scene, with a scene list. Any decision you can make in 3D, you can make in 2D or with a screen reader.',
  },
  { icon: 'text', title: 'Text size 100–200%', body: 'Every word is real text, never baked into the 3D view, so it all grows. Nothing scrolls sideways at 200%.' },
  { icon: 'chat', title: 'Captions on by default', body: 'Every voiced line and meaningful sound is captioned, like [phone buzzes twice].' },
  { icon: 'pause', title: 'Tap to Hold', body: 'Hold time is adjustable from 0.3 to 2 seconds, or switch to a single tap. Every drag has a tap-then-tap alternative.' },
  { icon: 'eye', title: 'Never colour alone', body: 'Every status is a shape, an icon and a word. Squads are told apart by totem shape and name.' },
  { icon: 'clock', title: 'Relaxed timing', body: 'Facilitators can add time, slow every timer down, or switch on Gentle mode: no surges, no countdowns.' },
  { icon: 'spark', title: 'Reduced motion', body: 'Cuts and fades instead of camera flights. No sway, no shake, nothing that flashes.' },
  { icon: 'door', title: 'Pause on every screen', body: 'A calm “Take a break” screen, any time, with no penalty. The facilitator only sees an anonymous count.' },
];

const DIALS: { dial: string; values: [string, string, string] }[] = [
  { dial: 'Live moment', values: ['30–40 s, no countdown', '45–60 s with a countdown', '45–60 s with a countdown'] },
  { dial: 'Choices', values: ['2–3 clear exits', '3 exits', '3–4 exits, including a “stall” option'] },
  { dial: 'Red herrings', values: ['0–1', '1–2', '2–3, plus conflicting evidence'] },
  { dial: 'Vote reveal', values: ['Mood (United / Mostly / Split)', 'Anonymous dots', 'Anonymous dots'] },
  {
    dial: 'Consequences',
    values: ['Gentle; no legal detail or penalties', 'Simplified: investigation, parents informed', 'Legal, financial and social, with “up to” and “may”'],
  },
];

const TOC = [
  { href: '#anatomy', label: 'Mission anatomy' },
  { href: '#consequences', label: 'Delayed consequences' },
  { href: '#think-vote-explain', label: 'Think-Vote-Explain' },
  { href: '#peer-shield', label: 'Peer Shield' },
  { href: '#roles', label: 'Roles' },
  { href: '#solo-or-squad', label: 'Solo or squad' },
  { href: '#accessibility', label: 'Accessibility' },
  { href: '#bands', label: 'Content bands' },
] as const;

function GuardianStrip() {
  const letters: SkillId[] = ['S', 'H', 'I', 'E', 'L', 'D'];
  return (
    <ul className="site-gstrip" aria-label="The six Guardians">
      {letters.map((l) => {
        const g = guardianForSkill(l);
        return (
          <li key={l}>
            <GuardianIcon guardian={g.id} size={40} />
            <span>{g.name}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Anatomy() {
  return (
    <DocSection
      id="anatomy"
      kicker="Mission anatomy"
      title="Ten beats, built around one frozen second."
      lead="Every mission follows the same shape, so the habit carries from one story to the next. A full squad mission takes about 13 minutes."
    >
      <Stagger as="ol" className="site-anatomy">
        {ANATOMY.map((s, i) => (
          <StaggerItem key={s.id} className={`site-anatomy__step${s.id === 'hold' ? ' is-hold' : ''}`}>
            <span className="site-anatomy__num" aria-hidden="true">
              {i + 1}
            </span>
            <div className="site-anatomy__body">
              <h3>{s.name}</h3>
              <p className="site-anatomy__meta">
                <span>
                  <Icon name="clock" /> {s.when}
                </span>
                <span className="site-anatomy__letters">
                  <span className="sr-only">Skills: </span>
                  {s.letters.map((l) => (
                    <LetterChip key={l} letter={l} />
                  ))}
                </span>
              </p>
              <p>{s.body}</p>
              {s.line && <p className="site-anatomy__line">“{s.line}”</p>}
              {s.id === 'bond' && <GuardianStrip />}
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </DocSection>
  );
}

function Consequences() {
  const urgency = tacticById('urgency');
  return (
    <DocSection
      id="consequences"
      kicker="The Delayed Consequence Engine"
      title="Consequences that arrive late, like real ones do."
      lead="In real life the bill, the bank notice or the screenshot turns up days later. So in Lumen, a choice plants a seed that surfaces a mission later."
      tone="tint"
    >
      <div className="site-split site-split--top">
        <div>
          <Reveal>
            <ol className="site-ribbon" aria-label="How a seed travels">
              <li>
                <b>Now</b>
                <span>You decide. The immediate result plays out, and a seed drops: “Something is still in motion.”</span>
              </li>
              <li>
                <b>Next mission</b>
                <span>The Aftershock lands. You trace it back to the choice that planted it and check your forecast.</span>
              </li>
              <li>
                <b>+2 weeks</b>
                <span>The finale fast-forwards the city. Every remaining seed lands, each with a way to recover.</span>
              </li>
            </ol>
          </Reveal>
          <Reveal>
            <h3 className="site-subhead site-subhead--sm">Seeds only land at safe moments</h3>
            <ul className="site-iconlist">
              {SLOTS.map((s) => (
                <li key={s.title}>
                  <span className="site-iconlist__icon">
                    <Icon name={s.icon} />
                  </span>
                  <span>
                    <b>{s.title}</b>
                    {s.body}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
        <div className="site-stack">
          <Reveal className="site-card site-feedback">
            <p className="site-kicker">Every feedback card follows one rule</p>
            <p className="site-feedback__template">
              <b>[The tactic]</b> is designed to <b>[its effect]</b>. A safer move is <b>[an action]</b>. If it already
              happened, <b>[a way to recover]</b>.
            </p>
            <p className="site-feedback__example">
              <span className="site-feedback__label">For example</span>
              <b>{urgency.name}</b> is designed to {urgency.designedTo}. {urgency.counter}
            </p>
            <p className="site-feedback__note">
              It blames the manipulator’s tactic, never the person. Words like “fell for” or “careless” are blocked by our
              content checks.
            </p>
          </Reveal>
          <Reveal>
            <ul className="site-ticks">
              <li>
                <b>Every risky path has a way back.</b> A Late Hold asks “Ren is panicking. What now?” and coming forward
                relights a lantern.
              </li>
              <li>
                <b>Safer choices aren’t a dead end.</b> They get an Afterglow, then “Meanwhile, in another Lumen…” shows
                what the risky path would have cost, so every forecast can still be checked.
              </li>
              <li>
                <b>The room only ever gains light.</b> District trust can dip and recover, but the class’s City Pulse never
                goes down.
              </li>
            </ul>
          </Reveal>
        </div>
      </div>
    </DocSection>
  );
}

function ThinkVoteExplain() {
  return (
    <DocSection
      id="think-vote-explain"
      kicker="Think-Vote-Explain"
      title="Decide alone first. Then talk. Then decide again."
      lead="Private votes stop the loudest voice from deciding for everyone. Talking afterwards is where minds change, and the game counts how many changed towards safer."
    >
      <Stagger as="ol" className="site-flow">
        {TVE.map((s, i) => (
          <StaggerItem key={s.name} className="site-flow__step">
            <span className="site-flow__num" aria-hidden="true">
              {i + 1}
            </span>
            <h3>{s.name}</h3>
            <p>{s.body}</p>
          </StaggerItem>
        ))}
      </Stagger>
      <Reveal className="site-note">
        <Icon name="lock" />
        <p>
          <b>Nobody’s vote is ever shown with their seat.</b> The link between a phone and its vote lives only in memory
          while the session runs. Afterwards, only group counts remain.{' '}
          <Link href="/safety">How we handle data</Link>.
        </p>
      </Reveal>
      <Reveal className="site-note site-note--soft">
        <Icon name="user" />
        <p>
          <b>Playing solo?</b> The Echo Council steps in: three ghost squadmates, clearly labelled as characters, reveal
          their votes with a reason each, including the tempting wrong one. Drag a clue onto the one it answers to change
          their mind.
        </p>
      </Reveal>
    </DocSection>
  );
}

function PeerShield() {
  return (
    <DocSection
      id="peer-shield"
      kicker="Peer Shield"
      title="Practise the words that pull a friend back."
      lead="Knowing a scam is one skill. Saying something to a friend who is about to fall into one is another, and most people never rehearse it."
      tone="tint"
    >
      <div className="site-split site-split--top">
        <Reveal>
          <ol className="site-slots" aria-label="The four parts of a Peer Shield message">
            {SHIELD_SLOTS.map((s) => (
              <li key={s.name}>
                <b>{s.name}</b>
                <span>{s.example}</span>
              </li>
            ))}
          </ol>
          <p className="site-fineprint">Example tiles from a fictional mission. Junior squads use three slots: Opener, Offer, Channel.</p>
        </Reveal>
        <Reveal>
          <ul className="site-ticks">
            <li>
              <b>Tiles are spread across the squad’s phones,</b> so the message only comes together if everyone
              contributes.
            </li>
            <li>
              <b>Two meters react to every tile:</b> GUARD (how defensive the friend feels) and DOUBT (how much they now
              doubt the offer). Each shows an icon, a word, a number and segments.
            </li>
            <li>
              <b>Some tiles are traps:</b> blame, shame, a lecture, a “let’s keep this secret” pact, or a decoy hotline.
              Play one and the friend crosses their arms. You get one retry: it is practice, not a penalty.
            </li>
            <li>
              <b>No free text, ever.</b> The class sees its most-built lines on the Shield Lines Wall in the debrief.
            </li>
          </ul>
        </Reveal>
      </div>
    </DocSection>
  );
}

function Roles() {
  return (
    <DocSection
      id="roles"
      kicker="Rotating roles"
      title="Everyone holds a different piece of the picture."
      lead="Roles rotate every mission, so nobody is always the quiet one. Each role comes with a lens that reveals evidence only that phone can see."
    >
      <Stagger className="site-roles">
        {SQUAD_ROLES.map((r) => (
          <StaggerItem key={r.id} className="site-role">
            <p className="site-role__lens">{r.lens} lens</p>
            <h3>{r.name}</h3>
            <p>{r.job}</p>
          </StaggerItem>
        ))}
      </Stagger>
      <Reveal>
        <p className="site-lead site-roles__foot">
          Everyone can Hold, inspect, pin evidence and vote. Lenses add unique clues; they never decide who gets to take
          part. With four players, two roles merge.
        </p>
      </Reveal>
    </DocSection>
  );
}

function SoloOrSquad() {
  return (
    <DocSection
      id="solo-or-squad"
      kicker="Two ways to play"
      title="On your own, or with the whole class."
      tone="tint"
    >
      <div className="site-twin">
        <Reveal className="site-card site-mode">
          <h3>
            <Icon name="user" /> Solo
          </h3>
          <ul className="site-ticks site-ticks--ink">
            <li>No login, no download. Open the link or scan the poster.</li>
            <li>Each mission takes a few minutes, with the Echo Council as your squad.</li>
            <li>After a few missions, Nightfall: the city rests. A natural place to stop, not an endless feed.</li>
            <li>Guardians and progress stay in the browser on your device. No push notifications.</li>
          </ul>
          <LinkButton href="/play" icon="play">
            Play solo
          </LinkButton>
        </Reveal>
        <Reveal className="site-card site-mode" delay={0.08}>
          <h3>
            <Icon name="users" /> Squad session
          </h3>
          <ul className="site-ticks site-ticks--ink">
            <li>A facilitator runs it from a laptop, with the Big Screen on a projector.</li>
            <li>Students scan a QR code and join squads of 4–5 on their own phones.</li>
            <li>90 minutes: onboarding, two or three missions, a debrief and the before-and-after checks.</li>
            <li>The Big Screen shows the city, never anyone’s choices or scores.</li>
          </ul>
          <div className="site-actions site-actions--tight">
            <LinkButton href="/educators" className="site-btn-ink" iconRight="arrowRight">
              Educator guide
            </LinkButton>
            <LinkButton href="/join" variant="secondary" className="site-btn-outline-ink" icon="qr">
              Join a session
            </LinkButton>
          </div>
        </Reveal>
      </div>
    </DocSection>
  );
}

function Accessibility() {
  return (
    <DocSection
      id="accessibility"
      kicker="Accessibility"
      title="Nobody should need a new phone, perfect eyesight or fast thumbs."
      lead="These are acceptance criteria, not extras. You can change them any time from Comfort settings, including on this website."
    >
      <Stagger className="site-features">
        {ACCESS.map((a) => (
          <StaggerItem key={a.title} className="site-feature">
            <span className="site-feature__icon" aria-hidden="true">
              <Icon name={a.icon} />
            </span>
            <h3>{a.title}</h3>
            <p>{a.body}</p>
          </StaggerItem>
        ))}
      </Stagger>
      <Reveal className="site-statusdemo">
        <p>Every status reads the same in any colour vision:</p>
        <ul>
          <li>
            <StatusBadge status="safe" />
          </li>
          <li>
            <StatusBadge status="risk" />
          </li>
          <li>
            <StatusBadge status="attention" />
          </li>
          <li>
            <StatusBadge status="unknown" />
          </li>
        </ul>
      </Reveal>
    </DocSection>
  );
}

function Bands() {
  return (
    <DocSection
      id="bands"
      kicker="Three content bands"
      title="Same anatomy. Different dials."
      lead="Players choose “Which fits you best?”, never a date of birth. Facilitators pick the band for a class session."
      tone="tint"
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
      <Reveal className="site-tablewrap">
        <table className="site-table site-table--dials">
          <caption>How each band changes the same mission</caption>
          <thead>
            <tr>
              <th scope="col">Dial</th>
              {BANDS.map((b) => (
                <th key={b.id} scope="col">
                  {b.label} <small>({b.ages})</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIALS.map((d) => (
              <tr key={d.dial}>
                <th scope="row">{d.dial}</th>
                {d.values.map((v, i) => (
                  <td key={i} data-label={`${BANDS[i]?.label ?? ''}`}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
    </DocSection>
  );
}

export function HowItWorksPage() {
  return (
    <SiteLayout
      title="How it works"
      description="Inside a ShieldQuest mission: HOLD, investigate, pull the string, decide together, live with delayed consequences and help a friend."
    >
      <PageHero
        kicker="How it works"
        title="Inside the second before."
        lead="Every ShieldQuest mission is built around one frozen moment. Here is what happens inside it, beat by beat, and why each beat is there."
        art={<FrozenPhoneArt />}
      >
        <OnThisPage links={TOC} />
      </PageHero>
      <Anatomy />
      <Consequences />
      <ThinkVoteExplain />
      <PeerShield />
      <Roles />
      <SoloOrSquad />
      <Accessibility />
      <Bands />
      <PageCta
        title="The best way to understand Hold is to press it."
        lead="Play a mission in your browser in a couple of minutes. No download, no account."
      >
        <LinkButton href="/play" size="lg" icon="play">
          Play the demo
        </LinkButton>
        <LinkButton href="/educators" size="lg" variant="secondary" iconRight="arrowRight">
          Bring it to your class
        </LinkButton>
      </PageCta>
    </SiteLayout>
  );
}
