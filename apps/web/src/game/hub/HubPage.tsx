// /play: the solo game home. First visit runs the short onboarding; after that, the city hub.
import { useEffect } from 'react';
import { useSettings } from '../../state/settings';
import { CityHub } from './CityHub';
import { MotionRoot } from './kit';
import { Onboarding } from './Onboarding';

export default function HubPage() {
  const onboarded = useSettings((s) => s.onboarded);

  useEffect(() => {
    const before = document.title;
    document.title = onboarded ? 'Lumen · ShieldQuest' : 'Welcome · ShieldQuest';
    return () => {
      document.title = before;
    };
  }, [onboarded]);

  return <MotionRoot>{onboarded ? <CityHub /> : <Onboarding />}</MotionRoot>;
}
