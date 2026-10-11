import { Component, Suspense, memo, type ReactNode } from 'react';
import {
  GuardianFigure,
  GuardianIcon,
  MissionScene,
  MissionScene2D,
  useRenderMode,
  type GuardianFigureProps,
  type MissionSceneProps,
  type RenderMode,
} from '../../../world';
import './parts.css';

/** Falls back to the 2D twin if the 3D chunk fails to load or WebGL throws (e.g. context loss on old phones). */
class StageBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface MissionStageProps extends Omit<MissionSceneProps, 'quality'> {
  /** Override the render mode; defaults to the player's Quality setting (useRenderMode). */
  renderMode?: RenderMode;
  /** Short description of what the scene shows, for the region label. */
  label?: string;
}

/**
 * The mission scene: lazy 3D MissionScene (three.js loads only here) with MissionScene2D as the loading,
 * error and 2D-mode fallback. Memoised: pass stable hotspots/thread/onHotspot and update `t` at most 10x a second.
 */
export const MissionStage = memo(function MissionStage({ renderMode, label, ...scene }: MissionStageProps) {
  const auto = useRenderMode();
  const mode = renderMode ?? auto;
  const flat = <MissionScene2D {...scene} />;
  return (
    <div className="msn-stage" role="region" aria-label={label ?? `Scene: ${scene.mission.title}`}>
      {mode === '2d' ? (
        flat
      ) : (
        <StageBoundary fallback={flat}>
          <Suspense fallback={flat}>
            <MissionScene {...scene} quality={mode} />
          </Suspense>
        </StageBoundary>
      )}
    </div>
  );
});

export interface GuardianStageProps extends Omit<GuardianFigureProps, 'quality'> {
  renderMode?: RenderMode;
  /** Size of the 2D icon / 3D box in rem. */
  size?: number;
}

/** A Guardian for the Bond screen: 3D origami figure, or the 2D GuardianIcon in 2D mode and while loading. */
export function GuardianStage({ renderMode, size = 8, ...props }: GuardianStageProps) {
  const auto = useRenderMode();
  const mode = renderMode ?? auto;
  const px = size * 16;
  const flat = <GuardianIcon guardian={props.guardian} level={props.level} size={px} />;
  return (
    <div className="msn-guardian-stage" style={{ width: `${size}rem`, height: `${size}rem` }}>
      {mode === '2d' ? (
        flat
      ) : (
        <StageBoundary fallback={flat}>
          <Suspense fallback={flat}>
            <GuardianFigure {...props} quality={mode} />
          </Suspense>
        </StageBoundary>
      )}
    </div>
  );
}
