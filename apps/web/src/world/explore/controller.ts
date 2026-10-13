// The Explore controller: one mutable object shared by the DOM (joystick, keys, Nearby list) and the 3D view's
// frame loop, so input never re-renders React. Pure (no three.js).
import { SPAWN } from './exploreMap';
import { clampStick, type P2, type Walker } from './movement';

export interface ExploreController extends Walker {
  /** Virtual joystick (x right, y forward), -1..1. */
  stick: { x: number; y: number };
  /** Keyboard (WASD / arrows), -1..1. */
  keys: { x: number; y: number };
  /** Keyboard camera turn (-1 left, 0, 1 right). */
  turn: number;
  /** The camera should cut to the player on the next frame (after a jump from the Nearby list). */
  snap: boolean;
  /** Set by the 3D view: walk to the ground under a screen point (NDC -1..1). Returns false if you can't go there. */
  tapTo: ((nx: number, ny: number) => boolean) | null;
  /** Set by the 3D view: ask for a frame (input changed while the view was idle). */
  wake: (() => void) | null;
}

export function createController(start?: Partial<Pick<Walker, 'x' | 'z' | 'heading' | 'yaw'>>): ExploreController {
  return {
    x: start?.x ?? SPAWN.x,
    z: start?.z ?? SPAWN.z,
    heading: start?.heading ?? SPAWN.heading,
    yaw: start?.yaw ?? SPAWN.yaw,
    path: [],
    stuck: 0,
    stick: { x: 0, y: 0 },
    keys: { x: 0, y: 0 },
    turn: 0,
    snap: true,
    tapTo: null,
    wake: null,
  };
}

/** Combined movement input (stick and keys), clamped to the unit disc. */
export function inputOf(c: Pick<ExploreController, 'stick' | 'keys'>): { x: number; y: number } {
  return clampStick(c.stick.x + c.keys.x, c.stick.y + c.keys.y);
}

/** Jumps the player to a point (Nearby list, 2D map), facing `towards` if given. */
export function jumpTo(c: ExploreController, p: P2, towards?: P2): void {
  c.x = p.x;
  c.z = p.z;
  c.path = [];
  c.stuck = 0;
  if (towards && Math.hypot(towards.x - p.x, towards.z - p.z) > 0.2) {
    c.heading = Math.atan2(towards.x - p.x, towards.z - p.z);
    // Camera behind the player, looking at the place.
    c.yaw = Math.atan2(p.x - towards.x, p.z - towards.z);
  }
  c.snap = true;
  c.wake?.();
}

/** Keys currently held -> keyboard vector (x right, y forward). */
export function keysVector(held: ReadonlySet<string>): { x: number; y: number } {
  const has = (...k: string[]) => k.some((x) => held.has(x));
  const x = (has('d', 'arrowright') ? 1 : 0) - (has('a', 'arrowleft') ? 1 : 0);
  const y = (has('w', 'arrowup') ? 1 : 0) - (has('s', 'arrowdown') ? 1 : 0);
  return clampStick(x, y);
}

/** Keys that turn the camera: Q left, E right. */
export function turnOf(held: ReadonlySet<string>): number {
  return (held.has('e') ? 1 : 0) - (held.has('q') ? 1 : 0);
}

/** Keys Explore handles while moving (lower-case `KeyboardEvent.key`). */
export const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e']);
