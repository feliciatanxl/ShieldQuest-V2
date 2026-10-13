// /portal: the Scenario Management Portal. A public landing with two paths, "Pitch a mission idea"
// (youth Moment Cards) and "Educator sign in", then the educator area (Library, Editor, Moment Cards).
// Views live in the query string (?view=pitch, ?tab=library|editor|moderation) so they can be bookmarked.

import { lazy, Suspense, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Button, LinkButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { useEducatorSession, verifySession } from './api';
import { PortalShell, SignInCard, useFocusHeading, usePageTitle, type PortalTab } from './parts';
import { PitchForm } from './PitchForm';
import { StatusCheck } from './StatusCheck';

// The educator area pulls in every mission script and the editor; youths pitching never download it.
const EducatorArea = lazy(() => import('./EducatorArea'));

const EDUCATOR_TABS = ['library', 'editor', 'moderation'] as const;
type EducatorTab = (typeof EDUCATOR_TABS)[number];

function Landing({ onPitch }: { onPitch: () => void }) {
  const session = useEducatorSession();
  const [, navigate] = useLocation();
  return (
    <div className="portal-landing">
      <section className="portal-hero">
        <p className="kicker">Scenario Portal</p>
        <h1 tabIndex={-1}>New tricks appear every month. New missions can too.</h1>
        <p className="portal-lead">
          Young people pitch moments they think others should practise. Educators check every idea, and the ShieldQuest team
          builds the best ones into missions with two sign-offs before anyone plays them.
        </p>
      </section>
      <div className="portal-paths">
        <section className="portal-path portal-path--pitch" aria-labelledby="portal-path-pitch">
          <div className="portal-path__art" aria-hidden="true">
            <span className="portal-path__card portal-path__card--a" />
            <span className="portal-path__card portal-path__card--b" />
            <Icon name="spark" size="2.25rem" />
          </div>
          <h2 id="portal-path-pitch">Pitch a mission idea</h2>
          <p>
            Got an idea for a scam or a pressure moment players should spot? Build a Moment Card from chips in about three
            minutes. No sign-up, no names.
          </p>
          <Button size="lg" icon="spark" onClick={onPitch}>
            Start a Moment Card
          </Button>
          <StatusCheck headingLevel={3} />
        </section>
        <section className="portal-path portal-path--educator" aria-label="Educators">
          {session ? (
            <div className="portal-card">
              <h2 className="portal-card__title">
                <Icon name="book" /> Educator area
              </h2>
              <p className="portal-muted">You are signed in{session.initials ? ` as ${session.initials}` : ''}.</p>
              {session.devPasscode && (
                <p className="portal-fine">Development passcode in use. Set PORTAL_PASSCODE before any pilot.</p>
              )}
              <div className="portal-actions portal-actions--stack">
                <Button icon="book" onClick={() => navigate('/portal?tab=library')}>
                  Mission Library
                </Button>
                <Button variant="secondary" icon="chat" onClick={() => navigate('/portal?tab=moderation')}>
                  Moment Cards queue
                </Button>
                <LinkButton href="/portal/analytics" variant="secondary" icon="map">
                  Analytics
                </LinkButton>
              </div>
            </div>
          ) : (
            <SignInCard />
          )}
        </section>
      </div>
    </div>
  );
}

export default function PortalPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const session = useEducatorSession();
  const params = new URLSearchParams(search);
  const view = params.get('view');
  const tabParam = params.get('tab');
  const tab: EducatorTab | null = EDUCATOR_TABS.includes(tabParam as EducatorTab) ? (tabParam as EducatorTab) : null;
  const viewKey = view ?? tab ?? 'home';
  usePageTitle(view === 'pitch' ? 'Pitch a mission idea' : tab ? `Scenario Portal: ${tab}` : 'Scenario Portal');
  const mainRef = useFocusHeading<HTMLDivElement>(viewKey);

  useEffect(() => {
    void verifySession();
  }, []);

  const shellTab: PortalTab | undefined = tab ?? undefined;
  return (
    <PortalShell tab={shellTab} wide={!!tab}>
      <div ref={mainRef} tabIndex={-1} className="portal-view">
        {view === 'pitch' ? (
          <PitchForm onBack={() => navigate('/portal')} />
        ) : tab ? (
          session ? (
            <Suspense fallback={<p className="portal-loading">Loading the educator area…</p>}>
              <EducatorArea tab={tab} params={params} />
            </Suspense>
          ) : (
            <div className="portal-gate">
              <h1 tabIndex={-1}>Sign in to continue</h1>
              <p className="portal-lead">The Library, Editor and Moment Cards queue are for educators and the ShieldQuest team.</p>
              <SignInCard />
            </div>
          )
        ) : (
          <Landing onPitch={() => navigate('/portal?view=pitch')} />
        )}
      </div>
    </PortalShell>
  );
}
