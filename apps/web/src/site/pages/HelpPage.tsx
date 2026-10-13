import { GAME, HELP_CHANNELS, helpById } from '@shieldquest/shared';
import { Link } from 'wouter';
import { Icon, type IconName } from '../../ui/Icon';
import { HELP_GROUPS, PLAYER_FAQ } from '../data';
import { Reveal, Stagger, StaggerItem } from '../motion';
import { SiteLayout } from '../SiteLayout';
import { Faq, PageHero, SectionHead } from '../parts';
import '../home.css';
import '../pages.css';

const GROUP_ICON: Record<string, IconName> = { check: 'eye', report: 'shield', talk: 'chat' };

/** Quick moves for the moments people most often land here (from the Help Card, GAME_DESIGN.md §9.5). */
const RIGHT_NOW: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'pause',
    title: 'Not sure about a message?',
    body: 'Don’t reply, click or pay yet. Check it first with the ScamShield Helpline on 1799. A real offer can wait.',
  },
  {
    icon: 'lock',
    title: 'Money moved or details shared?',
    body: 'Call your bank straight away, using the number in its official app or on your card. Then make a police report.',
  },
  {
    icon: 'eye',
    title: 'Something harmful online?',
    body: 'Screenshot it, block the account and report it on the platform. Then tell a trusted adult.',
  },
];

export function HelpPage() {
  const police = helpById('police-999');
  const sms = helpById('police-sms-70999');
  const asOf = HELP_CHANNELS[0]?.asOf;
  return (
    <SiteLayout
      title="Get help"
      description="Emergency 999 or SMS 70999. ScamShield Helpline 1799. mindline 1771. Who to call to check a scam, report one, or talk to someone in Singapore."
    >
      <PageHero
        kicker="Get help"
        title="You don’t have to handle it alone."
        lead="Whether it’s a scam, a dare that went wrong or something that’s just weighing on you, these people can help. Nobody will blame you for asking."
      >
        <div className="site-emergency" role="note" aria-labelledby="site-emergency-title">
          <h2 id="site-emergency-title" className="site-emergency__title">
            <Icon name="heart" /> In danger right now?
          </h2>
          <div className="site-emergency__lines">
            <p>
              <span className="site-emergency__label">Call</span>
              <span className="site-emergency__num">{police.contact}</span>
              <span className="site-emergency__when">{police.when}</span>
            </p>
            <p>
              <span className="site-emergency__label">Can’t talk safely?</span>
              <span className="site-emergency__num">{sms.contact}</span>
              <span className="site-emergency__when">{sms.when}</span>
            </p>
          </div>
        </div>
      </PageHero>

      <section className="site-section site-section--tight" aria-labelledby="right-now-title">
        <div className="container">
          <h2 id="right-now-title" className="site-subhead">
            If it’s happening now
          </h2>
          <Stagger className="site-features">
            {RIGHT_NOW.map((r) => (
              <StaggerItem key={r.title} className="site-feature">
                <span className="site-feature__icon" aria-hidden="true">
                  <Icon name={r.icon} />
                </span>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {HELP_GROUPS.map((g, gi) => (
        <section
          key={g.id}
          id={g.id}
          className={`site-section site-section--tight${gi % 2 === 0 ? ' site-section--tint' : ''}`}
          aria-labelledby={`help-${g.id}-title`}
        >
          <div className="container">
            <Reveal className="site-helphead">
              <span className="site-helphead__icon" aria-hidden="true">
                <Icon name={GROUP_ICON[g.id] ?? 'help'} />
              </span>
              <div>
                <h2 id={`help-${g.id}-title`}>{g.title}</h2>
                <p>{g.intro}</p>
              </div>
            </Reveal>
            <Stagger className="site-helpcards">
              {g.ids.map((id) => {
                const h = helpById(id);
                return (
                  <StaggerItem key={id} className={`site-helpcard${h.junior ? ' is-junior' : ''}`}>
                    <h3>{h.name}</h3>
                    <p className="site-helpcard__contact">{h.contact}</p>
                    <p className="site-helpcard__when">{h.when}</p>
                    <p className="site-helpcard__meta">
                      {h.hours && (
                        <span>
                          <Icon name="clock" /> {h.hours}
                        </span>
                      )}
                      {h.junior && (
                        <span>
                          <Icon name="user" /> Good for under-13s
                        </span>
                      )}
                    </p>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </div>
        </section>
      ))}

      <section className="site-section site-section--tight" aria-labelledby="junior-title">
        <div className="container">
          <Reveal className="site-junior">
            <svg viewBox="0 0 72 72" aria-hidden="true" focusable="false" className="site-junior__art">
              <path d="M36 6 l24 9 v17 c0 15 -10 27 -24 32 c-14 -5 -24 -17 -24 -32 v-17 z" fill="#2bb3a3" opacity="0.3" />
              <path d="M36 6 l24 9 v17 c0 15 -10 27 -24 32 c-14 -5 -24 -17 -24 -32 v-17 z" fill="none" stroke="#2bb3a3" strokeWidth="3" />
              <circle cx="29" cy="29" r="5.5" fill="#f4efe6" />
              <rect x="22" y="36" width="14" height="16" rx="7" fill="#f4efe6" />
              <circle cx="44" cy="31" r="5.5" fill="#f2c14e" />
              <rect x="37" y="38" width="14" height="15" rx="7" fill="#f2c14e" />
            </svg>
            <div>
              <h2 id="junior-title">Under 13? Here’s the short version.</h2>
              <ul className="site-ticks">
                <li>If something online makes you feel worried, scared or rushed, stop and tell a grown-up you trust: a parent, a teacher or your school counsellor.</li>
                <li>You won’t get in trouble for asking. Telling someone is the brave move.</li>
                <li>
                  Want someone to talk to? Call <b>Tinkle Friend</b> on <b>{helpById('tinkle-friend').contact}</b> on
                  weekday afternoons, or <b>mindline</b> on <b>1771</b> any time.
                </li>
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="site-section site-section--tint" id="faq" aria-labelledby="faq-title">
        <div className="container site-faqwrap">
          <SectionHead
            id="faq-title"
            kicker="Questions about the game"
            title="Good questions, straight answers."
            lead="Something else on your mind? The safety page and the educator guide go deeper."
          />
          <Faq items={PLAYER_FAQ} />
        </div>
      </section>

      <section className="site-section site-section--tight" aria-label="About these contacts">
        <div className="container">
          <div className="site-note site-note--soft">
            <Icon name="info" />
            <p>
              ShieldQuest is a game, not a helpline: nobody on the team can see your messages or answer calls. Contacts
              are shown as plain text and were last checked{asOf ? ` on ${asOf}` : ''}; they are re-checked before every
              pilot phase. {GAME.disclaimer} <Link href="/safety">Safety and privacy</Link>.
            </p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
