import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { Route, Switch } from 'wouter';
import { applySettingsToDocument, useSettings } from './state/settings';

// Every section is code-split so the public site and the join flow stay small on school Wi-Fi,
// and the 3D chunk (three + R3F) only downloads when a 3D view is actually shown.
const page = <K extends string>(loader: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => loader().then((m) => ({ default: m[name] })));

const site = () => import('./site');
const HomePage = page(site, 'HomePage');
const HowItWorksPage = page(site, 'HowItWorksPage');
const EducatorsPage = page(site, 'EducatorsPage');
const SafetyPage = page(site, 'SafetyPage');
const AboutPage = page(site, 'AboutPage');
const HelpPage = page(site, 'HelpPage');
const NotFoundPage = page(site, 'NotFoundPage');

const HubPage = lazy(() => import('./game/hub/HubPage'));
const MissionPage = lazy(() => import('./game/mission/MissionPage'));
const GuardiansPage = lazy(() => import('./game/guardians/GuardiansPage'));
const NightfallPage = lazy(() => import('./game/mission/NightfallPage'));

const JoinPage = lazy(() => import('./squad/JoinPage'));
const HostPage = lazy(() => import('./squad/HostPage'));
const ScreenPage = lazy(() => import('./squad/ScreenPage'));

const AssessPage = lazy(() => import('./assess/AssessPage'));
const PortalPage = lazy(() => import('./portal/PortalPage'));
const AnalyticsPage = lazy(() => import('./portal/AnalyticsPage'));

// Calibration answers saved offline are retried from any page, not only /assess. The check reads storage
// directly so the assessment code (and @shieldquest/shared) only downloads when something is waiting.
const ASSESS_QUEUE_KEY = 'sq.assess.queue.v1';

function hasQueuedAssessments(): boolean {
  try {
    const raw = localStorage.getItem(ASSESS_QUEUE_KEY);
    return !!raw && raw !== '[]';
  } catch {
    return false;
  }
}

function flushQueuedAssessments(): void {
  if (!hasQueuedAssessments()) return;
  import('./assess/storage')
    .then((m) => m.flushAssessmentQueue())
    .catch(() => undefined);
}

export function App() {
  const textScale = useSettings((s) => s.textScale);
  const motion = useSettings((s) => s.motion);
  useEffect(() => applySettingsToDocument({ textScale, motion }), [textScale, motion]);

  useEffect(() => {
    flushQueuedAssessments();
    window.addEventListener('online', flushQueuedAssessments);
    return () => window.removeEventListener('online', flushQueuedAssessments);
  }, []);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Suspense fallback={<div className="route-loading">Loading…</div>}>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/how-it-works" component={HowItWorksPage} />
          <Route path="/educators" component={EducatorsPage} />
          <Route path="/safety" component={SafetyPage} />
          <Route path="/about" component={AboutPage} />
          <Route path="/help" component={HelpPage} />

          <Route path="/play" component={HubPage} />
          <Route path="/play/m/:id" component={MissionPage} />
          <Route path="/play/guardians" component={GuardiansPage} />
          <Route path="/play/nightfall" component={NightfallPage} />

          <Route path="/join" component={JoinPage} />
          <Route path="/j/:code" component={JoinPage} />
          {/* Tent-card QR codes carry the table's totem: /j/CODE/hornbill */}
          <Route path="/j/:code/:totem" component={JoinPage} />
          <Route path="/host" component={HostPage} />
          <Route path="/host/:code" component={HostPage} />
          <Route path="/screen/:code" component={ScreenPage} />

          <Route path="/assess" component={AssessPage} />
          <Route path="/assess/:kind" component={AssessPage} />
          <Route path="/portal" component={PortalPage} />
          <Route path="/portal/analytics" component={AnalyticsPage} />

          <Route component={NotFoundPage} />
        </Switch>
      </Suspense>
    </>
  );
}
