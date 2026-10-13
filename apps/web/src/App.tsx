import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { applySettingsToDocument, useSettings } from './state/settings';
import { AppErrorBoundary } from './ui/AppErrorBoundary';

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
const ErrorPage = page(site, 'ErrorPage');

const HubPage = lazy(() => import('./game/hub/HubPage'));
const MissionPage = lazy(() => import('./game/mission/MissionPage'));
const GuardiansPage = lazy(() => import('./game/guardians/GuardiansPage'));
const NightfallPage = lazy(() => import('./game/mission/NightfallPage'));
const RestorePage = lazy(() => import('./game/save/RestorePage'));
const SaveConflict = lazy(() => import('./game/save/SaveConflict'));
const BoardPage = lazy(() => import('./game/board/BoardPage'));
const LockerPage = lazy(() => import('./game/board/LockerPage'));
const ArcadePage = lazy(() => import('./game/arcade/ArcadePage'));
const MiniGamePage = lazy(() => import('./game/arcade/MiniGamePage'));
const ExplorePage = lazy(() => import('./game/explore/ExplorePage'));

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

// Save Card auto-sync (state/saveCard.ts) starts on game routes only, and only on a device that has made a card.
// Like the queue check above, this reads storage directly so the sync code downloads only when it has work to do.
const SAVE_CARD_KEY = 'sq.savecard.v1';

/** Starts sync if this device has a Save Card. True when it does. */
function startSaveCardSync(): boolean {
  try {
    if (!localStorage.getItem(SAVE_CARD_KEY)) return false;
  } catch {
    return false;
  }
  import('./state/saveCard')
    .then((m) => m.startAutoSync())
    .catch(() => undefined);
  return true;
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

  const [location] = useLocation();
  const inGame = location === '/play' || location.startsWith('/play/');
  // Set once sync has started, so the "newer progress from another device" prompt can show on game pages.
  const [hasSaveCard, setHasSaveCard] = useState(false);
  useEffect(() => {
    if (inGame && startSaveCardSync()) setHasSaveCard(true);
  }, [inGame]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <AppErrorBoundary resetKey={location}>
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
            <Route path="/play/restore" component={RestorePage} />
            <Route path="/play/board" component={BoardPage} />
            <Route path="/play/locker" component={LockerPage} />
            <Route path="/play/arcade" component={ArcadePage} />
            <Route path="/play/arcade/:game" component={MiniGamePage} />
            <Route path="/play/explore" component={ExplorePage} />

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

            <Route path="/error/:code" component={ErrorPage} />
            <Route component={NotFoundPage} />
          </Switch>
        </Suspense>
      </AppErrorBoundary>
      {hasSaveCard && inGame && location !== '/play/restore' && (
        <Suspense fallback={null}>
          <SaveConflict />
        </Suspense>
      )}
    </>
  );
}
