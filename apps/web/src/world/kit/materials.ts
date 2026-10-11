// The one shared material system (GAME_DESIGN.md §4.2, §10.2): flat-shaded, vertex-coloured MeshLambertMaterial
// patched with onBeforeCompile. Every kit material shares one program per variant and a few uniforms per canvas:
//   uFreeze  0..1  drains colour to still-blue and desaturates (the Hold look; no post-processing pass)
//   uGrade         blue-hour / bright-room (projector) / daylight grade: ambient lift + saturation + exposure
//   uMood          luminance-preserving tint for the scene mood (tense, warm, sober, shiny)
//   uRimColor      cool rim light used on the High tier
// Per-material uniforms: uWarm (keeps colour while frozen), uToon (banded diffuse), uRimOn, uHighlight, uGlowBoost.
// Faces glow through the optional per-vertex `glow` attribute (lit windows, phone screens, lanterns).
// Variants: 'standard'; 'bean' (8 rigid parts posed by uniform matrices + face atlas offset);
// 'guardian' (sheet -> origami animal morph driven by uUnfold).
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  DoubleSide,
  FrontSide,
  Matrix4,
  MeshLambertMaterial,
  ShaderChunk,
  Vector2,
  type ColorRepresentation,
  type Side,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { QualityTier } from '../quality';
import { useKit } from './context';
import { clamp, easeInOutCubic } from './math';
import { createKitUniforms, type KitUniforms } from './uniforms';

export * from './uniforms';
export * from './paint';

/** Fallback uniforms for kit materials created outside an AdaptiveCanvas. */
export const defaultKitUniforms: KitUniforms = createKitUniforms();

/** The surrounding canvas's shared uniforms (each AdaptiveCanvas has its own set). */
export const useKitUniforms = (): KitUniforms => useKit().uniforms;

export type KitVariant = 'standard' | 'bean' | 'guardian';

export interface KitMaterialOptions {
  /** Keeps its colour while time is held (interactive objects, lanterns, Guardians). */
  warm?: boolean;
  /** low = plain flat Lambert; medium/high = softly banded "paper toon" diffuse; high adds a cool rim. */
  tier?: QualityTier;
  /** Multiplies the vertex colours (default white). Geometry without a colour attribute shows this colour. */
  color?: ColorRepresentation;
  vertexColors?: boolean;
  flatShading?: boolean;
  transparent?: boolean;
  opacity?: number;
  side?: Side | 'double';
  depthWrite?: boolean;
  /** Multiplier for the per-vertex `glow` attribute (0 disables glow). */
  glowBoost?: number;
  map?: Texture | null;
  fog?: boolean;
  uniforms?: KitUniforms;
  variant?: KitVariant;
}

export interface KitMaterialUniforms {
  uWarm: { value: number };
  uToon: { value: number };
  uRimOn: { value: number };
  uHighlight: { value: number };
  uGlowBoost: { value: number };
}

export interface BeanMaterialUniforms {
  /** 8 part matrices: 0 torso, 1 left leg, 2 head, 3 left arm, 4 right arm, 5 phone, 6 right leg, 7 unused (face uses 2). */
  uParts: { value: Matrix4[] };
  /** Atlas offset of the current expression cell. */
  uFaceOffset: { value: Vector2 };
}

export interface GuardianMaterialUniforms {
  /** 0 = flat folded sheet, 1 = origami animal. */
  uUnfold: { value: number };
  /** Height of the arc each facet travels along while unfolding. */
  uLift: { value: number };
}

export type KitMaterial = MeshLambertMaterial & {
  userData: {
    kit: KitMaterialUniforms;
    bean?: BeanMaterialUniforms;
    guardian?: GuardianMaterialUniforms;
    shared: KitUniforms;
  };
};

const LAMBERT_DOT = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';

const FRAG_PARS = /* glsl */ `
uniform float uFreeze;
uniform vec3 uGradeParams;
uniform vec4 uMood;
uniform vec3 uStill;
uniform vec3 uRimColor;
uniform float uWarm;
uniform float uToon;
uniform float uRimOn;
uniform float uHighlight;
uniform float uGlowBoost;
varying float vKitGlow;
float kitBand( float x ) {
  // Three soft steps: reads as folded paper under flat shading.
  float s = x * 3.0;
  float b = ( floor( s ) + smoothstep( 0.42, 0.58, fract( s ) ) ) / 3.0;
  return mix( x, b * 0.82 + 0.18 * x, uToon );
}
float kitLum( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }
`;

const FRAG_FINISH = /* glsl */ `
{
  vec3 kitN = normalize( geometryNormal );
  vec3 kitV = normalize( geometryViewDir );
  float kitRim = pow( 1.0 - saturate( dot( kitN, kitV ) ), 2.5 );
  outgoingLight += uRimColor * kitRim * uRimOn;
  outgoingLight += vec3( 1.0, 0.78, 0.34 ) * kitRim * uHighlight * 1.4 + diffuseColor.rgb * uHighlight * 0.18;
  // Grade: ambient lift for washed-out projectors, saturation, exposure.
  outgoingLight += diffuseColor.rgb * uGradeParams.x;
  float kl = kitLum( outgoingLight );
  outgoingLight = mix( vec3( kl ), outgoingLight, uGradeParams.y ) * uGradeParams.z;
  // Mood: luminance-preserving tint.
  vec3 moodTint = uMood.rgb / max( kitLum( uMood.rgb ), 0.001 );
  outgoingLight = mix( outgoingLight, outgoingLight * moodTint, uMood.a );
  // Freeze: drain towards still-blue; warm objects and glowing faces resist.
  float kf = uFreeze * ( 1.0 - uWarm ) * ( 1.0 - 0.55 * clamp( vKitGlow, 0.0, 1.0 ) );
  float fl = kitLum( outgoingLight );
  vec3 frozen = uStill * ( fl / 0.438 ) * 0.92 + uStill * 0.045;
  outgoingLight = mix( outgoingLight, frozen, kf );
}
`;

const BEAN_VERT_PARS = /* glsl */ `
attribute float part;
uniform mat4 uParts[ 8 ];
uniform vec2 uFaceOffset;
`;

// Each facet flies from its place on the paper sheet to its place on the animal along an arc, turning about
// its own axis on the way; aFold.w staggers the start so the fold ripples through the sheet.
const GUARDIAN_VERT_PARS = /* glsl */ `
attribute vec3 aSheet;
attribute vec3 aSheetCentre;
attribute vec3 aCentre;
attribute vec4 aFold;
attribute vec3 aSheetColor;
uniform float uUnfold;
uniform float uLift;
float kitUnfoldE() {
  float u = clamp( ( uUnfold - aFold.w ) / 0.55, 0.0, 1.0 );
  return u * u * ( 3.0 - 2.0 * u );
}
vec3 kitRotate( vec3 v, vec3 axis, float angle ) {
  float c = cos( angle );
  float s = sin( angle );
  return v * c + cross( axis, v ) * s + axis * dot( axis, v ) * ( 1.0 - c );
}
`;

const GUARDIAN_BEGIN = /* glsl */ `
{
  float e = kitUnfoldE();
  float arc = sin( e * 3.14159265 );
  vec3 centre = mix( aSheetCentre, aCentre, e ) + vec3( 0.0, uLift * arc, 0.0 );
  vec3 local = mix( aSheet - aSheetCentre, position - aCentre, e );
  transformed = centre + kitRotate( local, aFold.xyz, arc * 2.4 );
}
`;

let lambertWithBands: string | null = null;
function bandedLambertChunk(): string {
  if (lambertWithBands === null) {
    const src = ShaderChunk.lights_lambert_pars_fragment;
    lambertWithBands = src.includes(LAMBERT_DOT)
      ? src.replace(LAMBERT_DOT, 'float dotNL = kitBand( saturate( dot( geometryNormal, directLight.direction ) ) );')
      : src;
  }
  return lambertWithBands;
}

function patchShader(shader: WebGLProgramParametersWithUniforms, mat: KitMaterial): void {
  const { kit, bean, guardian, shared } = mat.userData;
  Object.assign(shader.uniforms, {
    uFreeze: shared.uFreeze,
    uGradeParams: shared.uGradeParams,
    uMood: shared.uMood,
    uStill: shared.uStill,
    uRimColor: shared.uRimColor,
    ...kit,
  });
  let vs = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vKitGlow;')
    .replace('#include <color_vertex>', '#include <color_vertex>\n  vKitGlow = glow;');
  if (bean) {
    Object.assign(shader.uniforms, bean);
    vs = vs
      .replace('#include <common>', `#include <common>\n${BEAN_VERT_PARS}`)
      .replace(
        '#include <begin_vertex>',
        // Part 7 is the face decal: it follows the head (2) and samples the current expression cell.
        '#include <begin_vertex>\n  int kitPart = int( part + 0.5 );\n' +
          '  transformed = ( uParts[ kitPart == 7 ? 2 : kitPart ] * vec4( transformed, 1.0 ) ).xyz;',
      )
      .replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\n#ifdef USE_MAP\n  if ( part > 6.5 ) vMapUv += uFaceOffset;\n#endif',
      );
  }
  if (guardian) {
    Object.assign(shader.uniforms, guardian);
    vs = vs
      .replace('#include <common>', `#include <common>\n${GUARDIAN_VERT_PARS}`)
      .replace(
        '#include <color_vertex>',
        '#include <color_vertex>\n#ifdef USE_COLOR\n  vColor.rgb = mix( aSheetColor, color.rgb, smoothstep( 0.3, 0.7, kitUnfoldE() ) );\n#endif',
      )
      .replace('vKitGlow = glow;', 'vKitGlow = glow * kitUnfoldE();')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${GUARDIAN_BEGIN}`);
  }
  shader.vertexShader = vs;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
    .replace('#include <lights_lambert_pars_fragment>', bandedLambertChunk())
    .replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * vKitGlow * uGlowBoost;',
    )
    .replace('#include <opaque_fragment>', `${FRAG_FINISH}\n#include <opaque_fragment>`);
}

/**
 * Creates a kit material. All kit materials of one variant compile to the same program, so draw calls stay
 * cheap and the Freeze is one uniform write. Dispose it when done (useKitMaterial does this for you).
 */
export function createKitMaterial(options: KitMaterialOptions = {}): KitMaterial {
  const {
    warm = false,
    tier = 'medium',
    color = '#ffffff',
    vertexColors = true,
    flatShading = true,
    transparent = false,
    opacity = 1,
    side = FrontSide,
    depthWrite,
    glowBoost = 1,
    map = null,
    fog = true,
    uniforms = defaultKitUniforms,
    variant = 'standard',
  } = options;
  const mat = new MeshLambertMaterial({
    color,
    vertexColors,
    flatShading,
    transparent,
    opacity,
    side: side === 'double' ? DoubleSide : side,
    map,
    fog,
  }) as KitMaterial;
  if (depthWrite !== undefined) mat.depthWrite = depthWrite;
  mat.userData = {
    shared: uniforms,
    kit: {
      uWarm: { value: warm ? 1 : 0 },
      uToon: { value: tier === 'low' ? 0 : 0.85 },
      uRimOn: { value: tier === 'high' ? 1 : 0 },
      uHighlight: { value: 0 },
      uGlowBoost: { value: glowBoost },
    },
    bean:
      variant === 'bean'
        ? { uParts: { value: Array.from({ length: 8 }, () => new Matrix4()) }, uFaceOffset: { value: new Vector2(0, 0) } }
        : undefined,
    guardian: variant === 'guardian' ? { uUnfold: { value: 1 }, uLift: { value: 0.6 } } : undefined,
  };
  // Geometry without colour/glow attributes must still render correctly (white vertex colour, no glow):
  // three reads these per-material defaults for any attribute the program declares but the geometry lacks.
  Object.assign(mat, {
    defaultAttributeValues: {
      color: [1, 1, 1],
      glow: [0],
      uv: [0, 0],
      part: [0],
      aSheet: [0, 0, 0],
      aSheetCentre: [0, 0, 0],
      aCentre: [0, 0, 0],
      aFold: [0, 1, 0, 0],
      aSheetColor: [1, 1, 1],
    },
  });
  mat.onBeforeCompile = (shader) => patchShader(shader, mat);
  mat.customProgramCacheKey = () => `sq-kit-${variant}-2`;
  return mat;
}

/** Sets the gold rim highlight on a kit material (0..1), e.g. for a selected prop. */
export function setKitHighlight(material: KitMaterial, amount: number): void {
  material.userData.kit.uHighlight.value = amount;
}

/**
 * Memoised kit material bound to the surrounding canvas's uniforms and tier; disposed on unmount or when
 * options change. Options are compared by value, so inline objects are fine.
 */
export function useKitMaterial(options: Omit<KitMaterialOptions, 'uniforms'> = {}): KitMaterial {
  const kit = useKit();
  const { map, ...rest } = options;
  const tier = rest.tier ?? kit.tier;
  const key = JSON.stringify({ ...rest, tier });
  const material = useMemo(
    () => createKitMaterial({ ...rest, tier, map, uniforms: kit.uniforms }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, map, kit.uniforms],
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

/**
 * Tweens the canvas's shared uFreeze uniform towards `target` (0 = live, 1 = held) over `durationMs`
 * (instant under reduced motion). Call it once per canvas, inside <AdaptiveCanvas>.
 */
export function useFreeze(target: number, durationMs = 400): void {
  const { uniforms, reducedMotion, requestFrame } = useKit();
  const tween = useMemo(
    () => ({ from: uniforms.uFreeze.value, to: clamp(target), elapsed: 0, done: false }),
    [target, uniforms],
  );
  useEffect(() => {
    if (reducedMotion || durationMs <= 0) {
      uniforms.uFreeze.value = tween.to;
      tween.done = true;
    }
    requestFrame();
  }, [tween, durationMs, uniforms, reducedMotion, requestFrame]);
  useFrame((_, delta) => {
    if (tween.done) return;
    tween.elapsed += Math.min(delta, 0.1) * 1000;
    const p = clamp(tween.elapsed / Math.max(1, durationMs));
    uniforms.uFreeze.value = tween.from + (tween.to - tween.from) * easeInOutCubic(p);
    if (p >= 1) tween.done = true;
    else requestFrame();
  });
}
