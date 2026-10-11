// Public website entry. App.tsx lazy-loads these named exports, so this chunk never pulls in
// three.js: the 3D city arrives only through the lazy exports of '../world'.
import { LinkButton } from '../ui/Button';
import { PageHero } from './parts';
import { SiteLayout } from './SiteLayout';

export { HomePage } from './pages/HomePage';

// Temporary inner pages while the full versions are written.
function Interim({ kicker, title }: { kicker: string; title: string }) {
  return (
    <SiteLayout title={title}>
      <PageHero kicker={kicker} title={title} lead="This page is being written. In the meantime, try a mission.">
        <div className="site-actions">
          <LinkButton href="/play" icon="play">
            Play now
          </LinkButton>
        </div>
      </PageHero>
    </SiteLayout>
  );
}

export const HowItWorksPage = () => <Interim kicker="How it works" title="How it works" />;
export const EducatorsPage = () => <Interim kicker="For educators" title="For educators" />;
export const SafetyPage = () => <Interim kicker="Safety & privacy" title="Safety and privacy" />;
export const AboutPage = () => <Interim kicker="About" title="About Project SHIELD" />;
export const HelpPage = () => <Interim kicker="Get help" title="Get help" />;
export const NotFoundPage = () => <Interim kicker="404" title="This street isn’t on the map yet" />;
