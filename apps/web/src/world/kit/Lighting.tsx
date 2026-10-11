// Lighting rig (GAME_DESIGN.md §4.3): one hemisphere + one directional light (+ a cool rim on High), fog and an
// optional sky colour, per grade (Blue Hour default, Bright Room for projectors, Daylight for the 10-13 band),
// time of day and scene mood. Also writes the grade and mood into the kit's shared shader uniforms.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Vector4, type DirectionalLight } from 'three';
import type { Mission } from '@shieldquest/shared';
import type { SceneMood } from '../contracts';
import { useKit } from './context';
import { damp, type Vec3 } from './math';
import { moodVector, setKitGrade, type Grade } from './uniforms';

export type TimeOfDay = Mission['timeOfDay'];

interface LightPreset {
  sky: string;
  ground: string;
  hemi: number;
  sun: string;
  sunIntensity: number;
  sunDir: Vec3;
  fog: string;
  background: string;
  rim: string;
  rimIntensity: number;
}

// Blue Hour look: cool indigo sky fill, low warm key, cool rim. Values are physically-based (π ≈ full albedo).
const TIME_PRESETS: Record<TimeOfDay, LightPreset> = {
  morning: {
    sky: '#d3e1ff',
    ground: '#5b5f8c',
    hemi: 1.55,
    sun: '#ffd8c0',
    sunIntensity: 1.9,
    sunDir: [-6, 5, 5],
    fog: '#a6b8de',
    background: '#aec2e8',
    rim: '#ffe2c8',
    rimIntensity: 0.5,
  },
  afternoon: {
    sky: '#dfeaff',
    ground: '#6d7193',
    hemi: 1.65,
    sun: '#fff3df',
    sunIntensity: 2.0,
    sunDir: [3, 9, 5],
    fog: '#b9c9e8',
    background: '#c0d3f2',
    rim: '#d9e8ff',
    rimIntensity: 0.4,
  },
  evening: {
    sky: '#93a3ec',
    ground: '#2a2f6b',
    hemi: 1.55,
    sun: '#ffc48a',
    sunIntensity: 1.8,
    sunDir: [-7, 4, 4],
    fog: '#2a2f6b',
    background: '#1f2856',
    rim: '#7fb2ff',
    rimIntensity: 0.7,
  },
  night: {
    sky: '#6476c2',
    ground: '#1b2048',
    hemi: 1.25,
    sun: '#c3cfff',
    sunIntensity: 1.0,
    sunDir: [4, 8, 3],
    fog: '#142033',
    background: '#142033',
    rim: '#8fb8ff',
    rimIntensity: 0.6,
  },
};

const mixHexes = (a: string, b: string, t: number) => `#${new Color(a).lerp(new Color(b), t).getHexString()}`;

function mixPreset(a: LightPreset, b: LightPreset, t: number): LightPreset {
  const m = (x: number, y: number) => x + (y - x) * t;
  return {
    sky: mixHexes(a.sky, b.sky, t),
    ground: mixHexes(a.ground, b.ground, t),
    hemi: m(a.hemi, b.hemi),
    sun: mixHexes(a.sun, b.sun, t),
    sunIntensity: m(a.sunIntensity, b.sunIntensity),
    sunDir: [m(a.sunDir[0], b.sunDir[0]), m(a.sunDir[1], b.sunDir[1]), m(a.sunDir[2], b.sunDir[2])],
    fog: mixHexes(a.fog, b.fog, t),
    background: mixHexes(a.background, b.background, t),
    rim: mixHexes(a.rim, b.rim, t),
    rimIntensity: m(a.rimIntensity, b.rimIntensity),
  };
}

/** Resolves the light preset for a time of day under a grade. */
export function lightPreset(timeOfDay: TimeOfDay, grade: Grade): LightPreset {
  const base = TIME_PRESETS[timeOfDay];
  if (grade === 'daylight') {
    // Juniors: always a friendly, readable daytime light; evening/night keep only a hint of their colour.
    const t = timeOfDay === 'night' ? 0.65 : timeOfDay === 'evening' ? 0.55 : 0.2;
    return mixPreset(base, TIME_PRESETS.afternoon, t);
  }
  if (grade === 'bright-room') {
    // Projector: +15% light and lifted shadows (ground bounce), so dark scenes do not turn to mud.
    return {
      ...base,
      hemi: base.hemi * 1.15,
      sunIntensity: base.sunIntensity * 1.1,
      ground: mixHexes(base.ground, base.sky, 0.35),
    };
  }
  return base;
}

export interface LightingProps {
  /** Default 'blue-hour'. Projector pages pass 'bright-room'; the 10-13 band 'daylight'. */
  grade?: Grade;
  /** Default 'evening' (the Blue Hour). */
  timeOfDay?: TimeOfDay;
  /** Luminance-preserving tint, tweened over 600 ms (instant under reduced motion). Default 'neutral'. */
  mood?: SceneMood;
  /** Distance fog in the preset colour: true (default near 18 / far 70), false, or explicit distances. */
  fog?: boolean | { near: number; far: number };
  /** Paints the scene background with the preset sky colour (default false: transparent canvas). */
  background?: boolean;
  /** Where the key light points and the shadow camera centres. Default origin. */
  target?: Vec3;
  /** Half-size of the High-tier shadow camera (m). Default 12. */
  shadowExtent?: number;
  /** Overall light multiplier (default 1). */
  intensity?: number;
}

/** One hemisphere + one directional key (+ cool rim on High), fog and grade/mood uniforms. */
export function Lighting({
  grade = 'blue-hour',
  timeOfDay = 'evening',
  mood = 'neutral',
  fog = true,
  background = false,
  target = [0, 0, 0],
  shadowExtent = 12,
  intensity = 1,
}: LightingProps) {
  const { tier, uniforms, reducedMotion, requestFrame, refreshShadows } = useKit();
  const preset = useMemo(() => lightPreset(timeOfDay, grade), [timeOfDay, grade]);
  const key = useRef<DirectionalLight>(null);
  const rim = useRef<DirectionalLight>(null);
  const [tx, ty, tz] = target;
  const shadows = tier === 'high';

  useEffect(() => {
    setKitGrade(uniforms, grade);
    requestFrame();
  }, [uniforms, grade, requestFrame]);

  useEffect(() => {
    for (const light of [key.current, rim.current]) {
      if (!light) continue;
      light.target.position.set(tx, ty, tz);
      light.target.updateMatrixWorld();
    }
    refreshShadows();
    requestFrame();
  }, [tx, ty, tz, preset, refreshShadows, requestFrame]);

  // Mood tint tween.
  const moodTarget = useMemo(() => moodVector(mood, new Vector4()), [mood]);
  useEffect(() => {
    if (reducedMotion) uniforms.uMood.value.copy(moodTarget);
    requestFrame();
  }, [moodTarget, reducedMotion, uniforms, requestFrame]);
  useFrame((_, delta) => {
    const v = uniforms.uMood.value;
    const d = Math.abs(v.x - moodTarget.x) + Math.abs(v.y - moodTarget.y) + Math.abs(v.z - moodTarget.z) + Math.abs(v.w - moodTarget.w);
    if (d < 1e-3) {
      v.copy(moodTarget);
      return;
    }
    if (reducedMotion) v.copy(moodTarget);
    else v.lerp(moodTarget, damp(6, delta));
    requestFrame();
  });

  const [dx, dy, dz] = preset.sunDir;
  const fogRange = typeof fog === 'object' ? fog : { near: 18, far: 70 };

  return (
    <>
      <hemisphereLight args={[preset.sky, preset.ground, preset.hemi * intensity]} />
      <directionalLight
        ref={key}
        color={preset.sun}
        intensity={preset.sunIntensity * intensity}
        position={[tx + dx, ty + dy, tz + dz]}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
      />
      {tier === 'high' && (
        <directionalLight
          ref={rim}
          color={preset.rim}
          intensity={preset.rimIntensity * intensity}
          position={[tx - dx * 0.8, ty + dy * 0.6, tz - dz * 1.2]}
        />
      )}
      {fog !== false && <fog attach="fog" args={[preset.fog, fogRange.near, fogRange.far]} />}
      {background && <color attach="background" args={[preset.background]} />}
    </>
  );
}

export default Lighting;
