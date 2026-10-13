// The fallback page for every HTTP status code: /error/:code (and the 404 page, which is /error/404's twin).
// Wording comes from the shared status catalogue, the same one the server uses for its JSON errors and its
// HTML fallback page.
import { Link, useParams, useSearch } from 'wouter';
import { httpStatus, isErrorStatus, type HttpStatusInfo } from '@shieldquest/shared';
import { Button, LinkButton } from '../../ui/Button';
import { safeReturnPath } from '../../ui/errorLink';
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

const goBack = () => (history.length > 1 ? history.back() : location.assign('/'));

function Actions({ info, from }: { info: HttpStatusInfo; from: string | null }) {
  const home = (
    <LinkButton href="/" size="lg" icon="arrowLeft" variant={info.action === 'home' ? 'primary' : 'secondary'}>
      Back to the home page
    </LinkButton>
  );
  const play = (
    <LinkButton href="/play" size="lg" variant="secondary" icon="play">
      Play now
    </LinkButton>
  );
  switch (info.action) {
    case 'retry':
    case 'wait':
      return (
        <>
          <Button size="lg" icon="rewind" onClick={() => (from ? location.assign(from) : goBack())}>
            Try again
          </Button>
          {home}
        </>
      );
    case 'back':
      return (
        <>
          <Button size="lg" icon="arrowLeft" onClick={() => (from ? location.assign(from) : goBack())}>
            Go back
          </Button>
          {home}
        </>
      );
    case 'signin':
      return (
        <>
          <LinkButton href="/portal" size="lg" icon="lock">
            Educator sign-in
          </LinkButton>
          {play}
        </>
      );
    default:
      return (
        <>
          {home}
          {play}
        </>
      );
  }
}

export function ErrorView({ code, from = null }: { code: number; from?: string | null }) {
  const info = httpStatus(code);
  const kicker = isErrorStatus(info.code) ? `Error ${info.code}` : `Status ${info.code}`;
  return (
    <SiteLayout title={`${info.code} ${info.name}`} description={`${info.title} ${info.message}`}>
      <section className="site-404" aria-labelledby="site-404-title">
        <div className="container site-404__inner">
          <Entrance className="site-404__art">
            <FogPlateArt />
          </Entrance>
          <Entrance delay={0.08} className="site-404__copy">
            <p className="site-kicker">{kicker}</p>
            <h1 id="site-404-title">{info.title}</h1>
            <p className="site-pagehero__lead">{info.message}</p>
            <div className="site-actions">
              <Actions info={info} from={from} />
            </div>
            <details className="site-404__details">
              <summary>Technical details</summary>
              <p>
                <b>
                  {info.code} {info.name}
                </b>
                : {info.technical}
              </p>
            </details>
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

/** Route component for /error/:code. Anything that isn't a number shows the 404 page. */
export function ErrorPage() {
  const { code } = useParams<{ code: string }>();
  const from = safeReturnPath(new URLSearchParams(useSearch()).get('from'));
  const n = /^\d{3}$/.test(code ?? '') ? Number(code) : 404;
  return <ErrorView code={n} from={from} />;
}
