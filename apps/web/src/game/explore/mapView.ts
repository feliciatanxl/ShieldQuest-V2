// Views of the top-down Explore map (pure): the whole city (mini-map, 2D overview) and one view per walkable
// area for the 2D explore mode, where places are far enough apart for 44 px buttons on a 360 px phone.
import { CITY, spotById } from '../../world/city/layout';
import {
  OPEN_DISTRICTS,
  PLACES,
  WORLD_FRAME,
  radialBridge,
  toLocal,
  type AreaId,
  type Frame,
  type Place,
} from '../../world/explore/exploreMap';

export type ViewId = 'city' | Exclude<AreaId, 'bridge'>;

export interface MapView {
  id: ViewId;
  label: string;
  /** View centre and rotation: the view shows frame-local coordinates (a district's front faces down). */
  frame: Frame;
  /** Half the side of the square shown (m). */
  half: number;
}

export const CITY_VIEW: MapView = { id: 'city', label: 'Whole city', frame: WORLD_FRAME, half: CITY.rim + 4 };

export const AREA_VIEWS: readonly MapView[] = [
  { id: 'hub', label: 'Stillpoint Plaza', frame: WORLD_FRAME, half: 24 },
  ...OPEN_DISTRICTS.map((s) => ({ id: s.id, label: s.name, frame: { x: s.x, z: s.z, rotY: s.rotY }, half: 23 }) as MapView),
];

export const viewById = (id: ViewId): MapView => (id === 'city' ? CITY_VIEW : AREA_VIEWS.find((v) => v.id === id) ?? AREA_VIEWS[0]!);

/** Map position (0..1 from the top-left) of a world point in a view. Outside the view gives values outside 0..1. */
export function project(view: MapView, x: number, z: number): { u: number; v: number } {
  const [lx, lz] = toLocal(view.frame, x, z);
  return { u: (lx + view.half) / (2 * view.half), v: (lz + view.half) / (2 * view.half) };
}

/** SVG transform that draws world coordinates in a view (pair with viewBox = viewBoxOf(view)). */
export function svgTransform(view: MapView): string {
  const deg = (view.frame.rotY * 180) / Math.PI;
  return `rotate(${deg.toFixed(3)}) translate(${(-view.frame.x).toFixed(3)} ${(-view.frame.z).toFixed(3)})`;
}

export const viewBoxOf = (view: MapView) => `${-view.half} ${-view.half} ${view.half * 2} ${view.half * 2}`;

/** Places that belong to an area view (the 2D explore mode lists exactly these on the map). */
export function placesIn(view: ViewId, places: readonly Place[] = PLACES): Place[] {
  if (view === 'city') return [];
  return places.filter((p) => p.area === view);
}

/** Where you arrive when you "walk" to an area in 2D: just onto the plate from its bridge (or the plaza front). */
export function arrivalPoint(view: ViewId): { x: number; z: number } {
  if (view === 'city' || view === 'hub') return { x: 0, z: 9.5 };
  const b = radialBridge(spotById(view));
  return { x: b.bx, z: b.bz };
}
