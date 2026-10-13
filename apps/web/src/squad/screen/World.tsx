// The projector's backdrop: the city (lobby, Room Freeze, Look Up, debrief) or the current mission's set.
// Purely visual: every word the room needs is in the DOM frame on top, so the backdrop is inert.

import { Component, Suspense, memo, type ReactNode } from 'react';
import type { Mission } from '@shieldquest/shared';
import { MissionStage } from '../../game/mission';
import { CityMap2D, CityScene, type CitySceneProps, type RenderMode, type SceneMode, type SceneMood } from '../../world';

class WorldBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  componentDidCatch(): void {
    // WebGL lost or unsupported on this projector laptop: the 2D city carries on.
  }
  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export type CityView = Omit<CitySceneProps, 'quality' | 'onSelectDistrict' | 'onSelectMission'>;

export const ScreenCity = memo(function ScreenCity({ renderMode, ...city }: CityView & { renderMode: RenderMode }) {
  const flat = <CityMap2D {...city} />;
  if (renderMode === '2d') return flat;
  return (
    <WorldBoundary fallback={flat}>
      <Suspense fallback={flat}>
        <CityScene {...city} quality={renderMode} />
      </Suspense>
    </WorldBoundary>
  );
});

export interface MissionView {
  mission: Mission;
  mode: SceneMode;
  t: number;
  mood: SceneMood;
  focusCast: string | null;
}

const NO_HOTSPOTS: never[] = [];

/** The live moment on the projector: same t0 as the phones, no clue highlights (so the phones matter). */
export const ScreenMission = memo(function ScreenMission({ renderMode, ...v }: MissionView & { renderMode: RenderMode }) {
  return (
    <MissionStage
      mission={v.mission}
      mode={v.mode}
      t={v.t}
      hotspots={NO_HOTSPOTS}
      thread={null}
      mood={v.mood}
      focusCast={v.focusCast}
      renderMode={renderMode}
      label={`Scene: ${v.mission.title}`}
    />
  );
});
