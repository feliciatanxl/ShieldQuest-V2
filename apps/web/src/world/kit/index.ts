/**
 * The ShieldQuest 3D kit (GAME_DESIGN.md §4.2-4.6, §10.2): everything the City Hub, the mission sets and the
 * projector build their scenes from. All of it is code-built from primitives (no model, texture, HDR or font
 * downloads) and shares ONE flat-shaded, vertex-coloured material system so the Hold "Freeze", the projector
 * grade and the scene mood are single uniform writes.
 *
 * Usage pattern:
 * ```tsx
 * <AdaptiveCanvas quality={quality} ariaLabel="Void deck at dusk: two friends on a bench" camera={{ position: [6, 5, 8], fov: 30 }}>
 *   <Lighting timeOfDay={mission.timeOfDay} mood={mood} />
 *   <Freeze amount={mode === 'frozen' ? 1 : 0} />          // tweens the shared uFreeze uniform (400 ms)
 *   <KitMesh geometry={setGeometry} />                     // one merged geometry per set (mergeKit)
 *   <Bean look={cast.look} pose="phone" position={spot.position} facing={spot.facing} frozen={frozen} t={t} />
 *   <Hotspot position={...} state="available" label="Notice board" onSelect={...} />
 *   <Rain />
 * </AdaptiveCanvas>
 * ```
 * Rules of the kit: components read tier, uniforms and reduced motion from the surrounding AdaptiveCanvas
 * (useKit); animations request frames themselves (frameloop "demand"); geometries and materials are disposed
 * on unmount; all readable text lives in the DOM.
 * @module world/kit
 */

// --- Canvas, context, motion ------------------------------------------------------------------------------

/** The ONE <Canvas> wrapper: tier budgets, adaptive resolution, context-loss recovery, role="img". */
export { AdaptiveCanvas, type AdaptiveCanvasProps, type AdaptiveCanvasCamera, type PerformanceReport } from './AdaptiveCanvas';
/** Per-canvas kit context (tier, shared uniforms, reduced motion, requestFrame, DOM overlay, refreshShadows). */
export { KitContext, useKit, type KitContextValue } from './context';
/** Reduced motion (Motion setting or OS preference), shared GPU resources. */
export { useReducedMotion, isReducedMotion, sharedResource, useShared, type SharedResource } from './motion';
/** Pure maths helpers (deterministic randomness keeps scenery identical on every device). */
export {
  clamp,
  lerp,
  smoothstep,
  easeInOutCubic,
  easeOutCubic,
  easeOutBack,
  bump,
  damp,
  hashString,
  seededRandom,
  pick,
  type Vec3,
} from './math';

// --- Materials, uniforms, painting -----------------------------------------------------------------------

/** Shared material system: createKitMaterial / useKitMaterial / useFreeze and the uniforms behind them. */
export {
  createKitMaterial,
  useKitMaterial,
  useKitUniforms,
  useFreeze,
  setKitHighlight,
  defaultKitUniforms,
  type KitMaterial,
  type KitMaterialOptions,
  type KitMaterialUniforms,
  type KitVariant,
  type BeanMaterialUniforms,
  type GuardianMaterialUniforms,
} from './materials';
/** <Freeze amount>: component form of useFreeze (call inside AdaptiveCanvas). */
export { Freeze, type FreezeProps } from './Freeze';
/** Palette, grades (blue-hour / bright-room / daylight) and mood tints. */
export {
  PALETTE,
  GRADES,
  GRADE_PARAMS,
  MOOD_TINT,
  createKitUniforms,
  setKitGrade,
  moodVector,
  type Grade,
  type KitUniforms,
} from './uniforms';
/** Vertex-colour painting and geometry plumbing (per-face colours, glow, baked AO, merging). */
export {
  toKitGeometry,
  isKitGeometry,
  paintFaces,
  setGlow,
  bakeAO,
  mixHex,
  tones,
  place,
  mergeKit,
  triangleCount,
  geometryFromTriangles,
  type FaceInfo,
  type BakeAOOptions,
  type Placement,
} from './paint';

// --- Geometry builders -----------------------------------------------------------------------------------

/** Code-built low-poly props: each returns ONE kit geometry (origin at ground centre, facing +z, metres). */
export {
  GeoBuilder,
  hdbBlock,
  shophouse,
  coveredWalkway,
  tree,
  lampPost,
  bench,
  tableSet,
  kiosk,
  fence,
  signboard,
  road,
  ground,
  hexPlate,
  facelessFigure,
  facelessWindow,
  lantern,
  FACELESS_HEIGHT,
  FACELESS_CHEST,
  LANTERN_HEIGHT,
  type BoxColors,
  type HdbBlockOptions,
  type ShophouseOptions,
  type CoveredWalkwayOptions,
  type TreeKind,
  type TreeOptions,
  type LampPostOptions,
  type BenchOptions,
  type TableSetOptions,
  type KioskOptions,
  type FenceOptions,
  type SignboardOptions,
  type RoadOptions,
  type GroundOptions,
  type HexPlateOptions,
  type FacelessPose,
  type FacelessWindowOptions,
} from './geometry';
/** React helpers: memoised/disposed geometry, one-draw-call meshes and instances, blob shadows. */
export {
  useKitGeometry,
  KitMesh,
  KitInstances,
  BlobShadow,
  type KitMeshProps,
  type KitInstance,
  type KitInstancesProps,
  type BlobShadowProps,
} from './KitMesh';

// --- Scene components ------------------------------------------------------------------------------------

/** NPC bean (≤ 300 triangles, 8 expressions, 12 hair/headwear silhouettes, tweened pose presets). */
export {
  Bean,
  BEAN_SIZE,
  type BeanProps,
  type BeanLook,
  type BeanHair,
  type BeanOutfit,
  type BeanPose,
  type BeanExpression,
} from './Bean';
export { BEAN_HAIRS, SKIN_TONES, buildBeanGeometry, resolveBeanLook } from './beanGeometry';
export { BEAN_POSES, POSE_PRESETS } from './beanPoses';
export { BEAN_EXPRESSIONS } from './faceAtlas';
/** Faceless manipulator silhouette (never embodied: no face, no gender or ethnic coding). */
export { Faceless, facelessAnchor, type FacelessProps } from './Faceless';
/** Instanced rain that freezes drop by drop into glowing beads. */
export { Rain, type RainProps } from './Rain';
/** Clue hotspot: state by shape + icon (+ DOM button for keyboard and screen readers). */
export { Hotspot, type HotspotProps } from './Hotspot';
/** "Pull the String": glowing tube with tactic beads. */
export { Thread, type ThreadProps } from './Thread';
export { THREAD_BEADS, type ThreadBead, type IconCell } from './icons';
/** Paper lanterns: one, or many in one instanced draw call. */
export {
  Lantern,
  Lanterns,
  LANTERN_SIZE,
  type LanternProps,
  type LanternsProps,
  type LanternItem,
  type LanternRise,
} from './Lantern';
/** Lighting rig per grade, time of day and mood (hemisphere + key (+ rim on High) + fog). */
export { Lighting, lightPreset, type LightingProps, type TimeOfDay } from './Lighting';
