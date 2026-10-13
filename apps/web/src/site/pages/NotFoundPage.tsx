import { Link } from 'wouter';
import { LinkButton } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { FogPlateArt } from '../art/Illustrations';
import { Entrance } from '../motion';
import { SiteLayout } from '../SiteLayout';
import '../pages.css';

const WAYS: { href: string; icon: IconName; label: string; hint: string }[] = [
  { href: '/how-it-works', icon: 'book', label: 'How it works', hint: 'Inside a mission, beat by beat' },
  { href: '/educators', icon: 'users', label: 'For educators', hint: 'Run a 90-minute class session' },
  { href: '/join', icon: 'qr', label: 'Join a squad session', hint: 'Got a room code? Start here' },
  { href: '/help', icon: 'heart', label: 'Get help', hint: 'Helplines and who to call' },
];

export function NotFoundPage() {
  return (
    <SiteLayout title="Page not found" description="This page isn’t on the map of ShieldQuest City. Find your way back to ShieldQuest.">
      <section className="site-404" aria-labelledby="site-404-title">
        <div className="container site-404__inner">
          <Entrance className="site-404__art">
            <FogPlateArt />
          </Entrance>
          <Entrance delay={0.08} className="site-404__copy">
            <p className="site-kicker">Error 404</p>
            <h1 id="site-404-title">This street isn’t on the map yet.</h1>
            <p className="site-pagehero__lead">
              The fog hasn’t lifted over this part of the city. The link may be old, or there may be a typo in the address.
            </p>
            <div className="site-actions">
              <LinkButton href="/" size="lg" icon="arrowLeft">
                Back to the home page
              </LinkButton>
              <LinkButton href="/play" size="lg" variant="secondary" icon="play">
                Play now
              </LinkButton>
            </div>
          </Entrance>
        </div>
        <div className="container">
          <nav aria-label="Popular pages">
            <ul className="site-404__ways">
              {WAYS.map((w) => (
                <li key={w.href}>
                  <Link href={w.href}>
                    <Icon name={w.icon} />
                    <span>
                      <b>{w.label}</b>
                      <small>{w.hint}</small>
                    </span>
                    <Icon name="arrowRight" className="site-404__chev" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
    </SiteLayout>
  );
}
