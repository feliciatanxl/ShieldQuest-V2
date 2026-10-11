// Bean poses (GAME_DESIGN.md §4.4): data presets per rigid part, blended by tween, plus idle and walk layers.
// Rotations are Euler XYZ radians in bean space (bean faces +z; its left is +x). Pure maths: no React.
import { Euler, Matrix4 } from 'three';
import { BEAN_JOINT, BEAN_PART } from './beanGeometry';
import type { Vec3 } from './math';

export type BeanPose =
  | 'stand'
  | 'sit'
  | 'phone'
  | 'lean'
  | 'walk'
  | 'arms-crossed'
  | 'open-arms'
  | 'curl-up'
  | 'turn-towards';

export const BEAN_POSES: readonly BeanPose[] = [
  'stand',
  'sit',
  'phone',
  'lean',
  'walk',
  'arms-crossed',
  'open-arms',
  'curl-up',
  'turn-towards',
];

export interface PoseState {
  /** Whole-figure offset (sitting drops or raises the hips). */
  root: Vec3;
  torso: Vec3;
  head: Vec3;
  armL: Vec3;
  armR: Vec3;
  legL: Vec3;
  legR: Vec3;
  /** Phone visibility 0..1 (scaled in the hands). */
  phone: number;
}

const P = (p: Partial<PoseState>): PoseState => ({
  root: [0, 0, 0],
  torso: [0, 0, 0],
  head: [0, 0, 0],
  armL: [0, 0, 0.1],
  armR: [0, 0, -0.1],
  legL: [0, 0, 0],
  legR: [0, 0, 0],
  phone: 0,
  ...p,
});

/** Pose presets. Seat height for 'sit' is 0.42 m (kit bench and stools). */
export const POSE_PRESETS: Record<BeanPose, PoseState> = {
  stand: P({}),
  sit: P({
    root: [0, 0.06, 0],
    torso: [-0.05, 0, 0],
    armL: [-0.45, 0, 0.12],
    armR: [-0.45, 0, -0.12],
    legL: [-1.35, 0, 0.04],
    legR: [-1.35, 0, -0.04],
  }),
  phone: P({
    torso: [0.06, 0, 0],
    head: [0.38, 0, 0],
    armL: [-1.04, 0, -0.64],
    armR: [-1.04, 0, 0.64],
    phone: 1,
  }),
  lean: P({
    torso: [0.26, 0, 0],
    head: [-0.16, 0, 0],
    armL: [-0.32, 0, 0.12],
    armR: [-0.32, 0, -0.12],
  }),
  walk: P({
    armL: [0.25, 0, 0.08],
    armR: [-0.25, 0, -0.08],
    legL: [-0.3, 0, 0],
    legR: [0.3, 0, 0],
  }),
  'arms-crossed': P({
    torso: [-0.04, 0, 0],
    head: [0.04, 0, 0.07],
    armL: [-1.15, 0, -0.95],
    armR: [-1.0, 0, 0.95],
  }),
  'open-arms': P({
    torso: [-0.05, 0, 0],
    head: [-0.1, 0, 0],
    armL: [-0.7, 0, 1.0],
    armR: [-0.7, 0, -1.0],
  }),
  'curl-up': P({
    root: [0, -0.3, 0],
    torso: [0.5, 0, 0],
    head: [0.35, 0, 0],
    armL: [-1.25, 0, -0.3],
    armR: [-1.25, 0, 0.3],
    legL: [-1.75, 0, 0.05],
    legR: [-1.75, 0, -0.05],
  }),
  'turn-towards': P({
    torso: [0, 0.3, 0],
    head: [0, 0.5, 0],
    armL: [-0.1, 0, 0.1],
    armR: [-0.1, 0, -0.1],
  }),
};

export function clonePose(p: PoseState): PoseState {
  return {
    root: [...p.root],
    torso: [...p.torso],
    head: [...p.head],
    armL: [...p.armL],
    armR: [...p.armR],
    legL: [...p.legL],
    legR: [...p.legR],
    phone: p.phone,
  };
}

const VEC_KEYS = ['root', 'torso', 'head', 'armL', 'armR', 'legL', 'legR'] as const;

/** out = lerp(a, b, t) */
export function blendPose(a: PoseState, b: PoseState, t: number, out: PoseState): PoseState {
  for (const k of VEC_KEYS) {
    const o = out[k];
    const x = a[k];
    const y = b[k];
    o[0] = x[0] + (y[0] - x[0]) * t;
    o[1] = x[1] + (y[1] - x[1]) * t;
    o[2] = x[2] + (y[2] - x[2]) * t;
  }
  out.phone = a.phone + (b.phone - a.phone) * t;
  return out;
}

/**
 * Adds the idle layer (breathing, glances, arm sway) and the walk cycle to a pose, as pure functions of time.
 * `walk` is the walk weight 0..1 (blend towards the walk pose).
 */
export function addMotionLayers(p: PoseState, time: number, phase: number, idle: number, walk: number): void {
  if (idle > 0) {
    const breath = Math.sin(time * 1.7 + phase);
    p.torso[0] += 0.02 * breath * idle;
    p.head[1] += 0.09 * Math.sin(time * 0.37 + phase * 1.3) * idle;
    p.head[0] += 0.03 * Math.sin(time * 0.83 + phase) * idle;
    p.armL[2] += 0.035 * breath * idle;
    p.armR[2] -= 0.035 * breath * idle;
    p.root[1] += 0.005 * breath * idle;
  }
  if (walk > 0) {
    const s = Math.sin(time * Math.PI * 2 * 1.6 + phase);
    p.legL[0] += (0.55 * s - POSE_PRESETS.walk.legL[0]) * walk;
    p.legR[0] += (-0.55 * s - POSE_PRESETS.walk.legR[0]) * walk;
    p.armL[0] += (-0.45 * s - POSE_PRESETS.walk.armL[0]) * walk;
    p.armR[0] += (0.45 * s - POSE_PRESETS.walk.armR[0]) * walk;
    p.root[1] += 0.03 * Math.abs(s) * walk;
  }
}

const _e = new Euler();
const _r = new Matrix4();
const _t = new Matrix4();
const _root = new Matrix4();

/** out = parent * T(pivot) * R(rot) * T(-pivot) */
function joint(out: Matrix4, parent: Matrix4, pivot: Vec3, rot: Vec3): void {
  _e.set(rot[0], rot[1], rot[2], 'XYZ');
  _r.makeRotationFromEuler(_e);
  out.makeTranslation(pivot[0], pivot[1], pivot[2]).multiply(_r);
  out.multiply(_t.makeTranslation(-pivot[0], -pivot[1], -pivot[2]));
  out.premultiply(parent);
}

/** Writes the 8 part matrices for the bean shader. */
export function composeBean(p: PoseState, out: Matrix4[]): void {
  _root.makeTranslation(p.root[0], p.root[1], p.root[2]);
  const torso = out[BEAN_PART.torso]!;
  joint(torso, _root, BEAN_JOINT.hip, p.torso);
  joint(out[BEAN_PART.head]!, torso, BEAN_JOINT.neck, p.head);
  joint(out[BEAN_PART.armL]!, torso, BEAN_JOINT.shoulderL, p.armL);
  joint(out[BEAN_PART.armR]!, torso, BEAN_JOINT.shoulderR, p.armR);
  joint(out[BEAN_PART.legL]!, _root, BEAN_JOINT.hipL, p.legL);
  joint(out[BEAN_PART.legR]!, _root, BEAN_JOINT.hipR, p.legR);
  // Phone: follows the torso, scaled about its centre (0 = hidden in a pocket).
  const phone = out[BEAN_PART.phone]!;
  const s = Math.max(0.0001, p.phone);
  const [cx, cy, cz] = BEAN_JOINT.phone;
  phone
    .makeTranslation(cx, cy, cz)
    .multiply(_r.makeScale(s, s, s))
    .multiply(_t.makeTranslation(-cx, -cy, -cz))
    .premultiply(torso);
  out[BEAN_PART.face]!.copy(out[BEAN_PART.head]!);
}
