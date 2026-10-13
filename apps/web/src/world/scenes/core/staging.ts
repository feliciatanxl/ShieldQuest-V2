// Optional staging data a set can carry beside the SetPiece contract (sets/types.ts). MissionScene and the
// Flat View read it when present and fall back to sensible defaults for sets that do not provide it, so any
// set builder can opt in without a contract change. Pure data: no three.js (the Flat View imports this).
import type { SetPiece } from '../sets/types';

export type Vec3 = [number, number, number];

/** A camera framing: where the camera stands, what it looks at, vertical field of view (degrees). */
export interface CameraShot {
  position: Vec3;
  target: Vec3;
  fov?: number;
}

/** A box of rain: `position` is the centre of its floor, `area` its [x, y, z] size (kit <Rain> props). */
export interface RainZone {
  position: Vec3;
  area: Vec3;
  /** 0..1 drop density multiplier. Default 1. */
  intensity?: number;
}

/** A word drawn in the DOM over a sign in the 3D set (signage text never lives inside WebGL). */
export interface WorldLabel {
  position: Vec3;
  text: string;
  /** Visual size: 'sign' (default) or 'small'. */
  size?: 'sign' | 'small';
}

export interface SetStaging {
  /**
   * Where the hidden influence appears for "Pull the String": the feet of a faceless figure standing in a lit
   * window in the set's skyline (GAME_DESIGN.md §4.2, §4.5). `facing` is its yaw (0 faces +z, the camera side).
   */
  influence?: { position: Vec3; facing?: number };
  /**
   * Anchors whose position is a seat (bench, stool, bed edge), mapped to where a standing person goes instead
   * (e.g. beside the stool, not on the table).
   */
  seats?: Readonly<Record<string, Vec3>>;
  /** Where rain falls (outside shelters and rooms). `false` = no rain in this set. Default: the whole set. */
  rain?: RainZone | false;
  /** Four authored stops for the junior rail mode (GAME_DESIGN.md §4.5). Default: derived from the live camera. */
  rail?: readonly CameraShot[];
  /** Sign text shown as DOM labels over the 3D set. */
  labels?: readonly WorldLabel[];
}

export type StagedSetPiece = SetPiece & { staging?: SetStaging };

/** The staging of a set (empty when the set does not provide any). */
export function stagingOf(set: SetPiece): SetStaging {
  return (set as StagedSetPiece).staging ?? {};
}

/** Rectangle in flat viewBox units. */
export interface FlatRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The oblique "diorama" projection a Flat View drawing was made with: X = ox + x*s + z*sx, Y = oy + z*sz - y*s
 * (metres to viewBox units; +z comes towards the viewer and down the page, deeper points shift by sx).
 */
export interface Oblique {
  ox: number;
  oy: number;
  /** viewBox units per metre (horizontal and vertical). */
  s: number;
  /** Downward shift per metre of +z (towards the viewer). */
  sz: number;
  /** Sideways shift per metre of +z (negative: deeper points move right, like a camera standing front-right). */
  sx: number;
}

/** Flat View equivalents of the 3D staging (viewBox units). */
export interface FlatStaging {
  /** When given, cast glyphs are placed by projecting their exact 3D placement (seat stand-ins, side-by-side). */
  oblique?: Oblique;
  /** Where each anchor's hotspot marker goes (the projected anchor + hotspotOffset). Default: above the anchor. */
  hotspots?: Readonly<Record<string, { x: number; y: number }>>;
  /** Rain region(s), or false. Default: the whole drawing. */
  rain?: FlatRect | readonly FlatRect[] | false;
  /** Centre-bottom of the lit window where the faceless influence appears. Default: top-right of the drawing. */
  influence?: { x: number; y: number };
  /** Height of a standing 1.5 m bean in viewBox units. Default: 12% of the viewBox height. */
  beanHeight?: number;
  /** Seat anchors mapped to where a standing glyph goes instead (viewBox units). */
  seats?: Readonly<Record<string, { x: number; y: number }>>;
  /** Per-anchor size factor for depth (things further back are drawn smaller). Default 1. */
  depth?: Readonly<Record<string, number>>;
}

/** The 2D twin of a set (SetPiece['flat']) with optional Flat View staging. */
export type FlatTwin = SetPiece['flat'] & { staging?: FlatStaging };
