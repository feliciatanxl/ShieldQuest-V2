// Synthesized sound + haptics (Web Audio API: no audio files, no licences).
// PLACEHOLDER implementation (no-ops) — replaced by the audio build. The API below is the contract.
import type { DistrictId } from '@shieldquest/shared';

export type Sfx =
  | 'tap'
  | 'holdCharge'
  | 'freeze'
  | 'release'
  | 'tick'
  | 'message'
  | 'clue'
  | 'clueOk'
  | 'seal'
  | 'reveal'
  | 'aftershock'
  | 'afterglow'
  | 'unfold'
  | 'surge'
  | 'success'
  | 'soft-fail'
  | 'pageTurn';

/** Call from the first user gesture (browsers block audio until then). */
export function unlockAudio(): void {}

/** Plays a short synthesized cue. `step` selects a note for sequences (e.g. clue plucks, motif letters 0-5). */
export function playSfx(_name: Sfx, _opts?: { intensity?: number; step?: number }): void {}

/** Plays the six-note S.H.I.E.L.D. motif; `lit` marks which letters (0-5) are lit for this player. */
export function playMotif(_lit: boolean[]): void {}

/** Generative ambient pad for the city hub or a district. Phones in a squad session should not call this. */
export function startAmbient(_where: DistrictId | 'city'): void {}
export function stopAmbient(): void {}

/** Live-phase tension: 0 = calm, 1 = maximum (accelerating tick). */
export function setTension(_level: number): void {}

/** Vibration on supporting devices (Android). No-op on iOS. Respects the Vibration setting. */
export function haptic(_pattern: number | number[]): void {}
