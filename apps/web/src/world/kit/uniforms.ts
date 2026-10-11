// Shared shader uniforms and palette for the kit (pure three.js). One uniform set per canvas.
import { Color, Vector3, Vector4 } from 'three';
import type { SceneMood } from '../contracts';

export type Grade = 'blue-hour' | 'bright-room' | 'daylight';
export const GRADES: readonly Grade[] = ['blue-hour', 'bright-room', 'daylight'];

/** Palette (GAME_DESIGN.md §4.3) as hex strings for 3D use. */
export const PALETTE = {
  nightNavy: '#142033',
  duskIndigo: '#2a2f6b',
  paper: '#f4efe6',
  paper2: '#e9e1d2',
  ink: '#1d2440',
  stillBlue: '#9fb3c8',
  frost: '#cfe8ff',
  school: '#2bb3a3',
  retail: '#f26b5b',
  digi: '#8a6cf0',
  gold: '#f2c14e',
  safe: '#1fb5a8',
  risk: '#ff4d8d',
  attention: '#ffc845',
  unknown: '#9fb3c8',
  windowLit: '#ffd58a',
  windowDark: '#2b3557',
  concrete: '#c9c3d6',
  concreteDark: '#9c97b0',
  asphalt: '#3a3f5c',
  grass: '#5d9a7a',
  leaf: '#3f8f74',
  trunk: '#7a5a48',
  zinc: '#aeb7c9',
  /** Manipulator silhouette: neutral grey-violet, no ethnic or gender coding. */
  faceless: '#6e6a86',
} as const;

/** Grade parameters: x = ambient lift (adds albedo), y = saturation, z = exposure. */
export const GRADE_PARAMS: Record<Grade, [number, number, number]> = {
  'blue-hour': [0, 1, 1],
  // Projector grade: +15% light, lifted shadows, a touch more saturation so it survives washed-out beams.
  'bright-room': [0.13, 1.1, 1.12],
  daylight: [0.05, 1.04, 1.04],
};

/** Mood tints (luminance-preserving): colour + strength. */
export const MOOD_TINT: Record<SceneMood, [string, number]> = {
  neutral: ['#ffffff', 0],
  tense: ['#ff6f91', 0.12],
  warm: ['#ffc27a', 0.14],
  sober: ['#9fb3c8', 0.2],
  shiny: ['#b48cff', 0.14],
};

export interface KitUniforms {
  /** 0 = live colour, 1 = held (drained to still-blue). Tween with useFreeze(). */
  uFreeze: { value: number };
  /** 0 blue-hour, 1 bright-room, 2 daylight (index into GRADES). */
  uGrade: { value: number };
  uGradeParams: { value: Vector3 };
  /** rgb = linear tint, a = strength (0..~0.3). */
  uMood: { value: Vector4 };
  uStill: { value: Color };
  uRimColor: { value: Color };
}

export function createKitUniforms(): KitUniforms {
  return {
    uFreeze: { value: 0 },
    uGrade: { value: 0 },
    uGradeParams: { value: new Vector3(...GRADE_PARAMS['blue-hour']) },
    uMood: { value: new Vector4(1, 1, 1, 0) },
    uStill: { value: new Color(PALETTE.stillBlue) },
    uRimColor: { value: new Color('#7fb2ff').multiplyScalar(0.35) },
  };
}

export function setKitGrade(uniforms: KitUniforms, grade: Grade): void {
  uniforms.uGrade.value = GRADES.indexOf(grade);
  uniforms.uGradeParams.value.set(...GRADE_PARAMS[grade]);
}

/** Target mood vector (for tweening uMood). */
export function moodVector(mood: SceneMood, out = new Vector4()): Vector4 {
  const [hex, strength] = MOOD_TINT[mood];
  const c = new Color(hex);
  return out.set(c.r, c.g, c.b, strength);
}
