// Top-down SVG map of the walkable city: the mini-map in 3D mode and the board of the 2D explore mode.
// Decorative (aria-hidden): every place on it is also a real button (2D mode) or in the Nearby list.
import { memo, useMemo, type ReactNode } from 'react';
import { CITY, DISTRICT_SPOTS } from '../../world/city/layout';
import {
  BEACONS,
  EXPLORE_WORLD,
  KIOSKS,
  SHARDS,
  TOWNIE_PLACES,
  fromLocal,
  radialBridge,
  type BoxObstacle,
  type StripArea,
} from '../../world/explore/exploreMap';
import { svgTransform, viewBoxOf, type MapView } from './mapView';

const hexPoints = (x: number, z: number, r: number, corner: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = corner + (i * Math.PI) / 3;
    return `${(x + Math.cos(a) * r).toFixed(2)},${(z + Math.sin(a) * r).toFixed(2)}`;
  }).join(' ');

function stripPoints(s: Pick<StripArea, 'ax' | 'az' | 'bx' | 'bz'>, half: number): string {
  const dx = s.bx - s.ax;
  const dz = s.bz - s.az;
  const len = Math.hypot(dx, dz) || 1;
  const nx = (-dz / len) * half;
  const nz = (dx / len) * half;
  return [
    [s.ax + nx, s.az + nz],
    [s.bx + nx, s.bz + nz],
    [s.bx - nx, s.bz - nz],
    [s.ax - nx, s.az - nz],
  ]
    .map(([x, z]) => `${x!.toFixed(2)},${z!.toFixed(2)}`)
    .join(' ');
}

function boxPoints(b: BoxObstacle): string {
  return [
    [b.x0, b.z0],
    [b.x1, b.z0],
    [b.x1, b.z1],
    [b.x0, b.z1],
  ]
    .map(([lx, lz]) => fromLocal(b.frame, lx!, lz!).map((v) => v.toFixed(2)).join(','))
    .join(' ');
}

const BUILDINGS = EXPLORE_WORLD.obstacles.filter((o): o is BoxObstacle => o.kind === 'box' && o.h >= 4 && !o.roof);
const BRIDGES = EXPLORE_WORLD.areas.filter((a): a is StripArea => a.kind === 'strip');
const FOGGED_BRIDGES = DISTRICT_SPOTS.filter((s) => s.fogged).map(radialBridge);

/** The static city drawing (plates, bridges, buildings), memoised: only the overlays change. */
const CityDrawing = memo(function CityDrawing() {
  return (
    <>
      <circle r={CITY.rim} className="ex-map__rim" />
      {FOGGED_BRIDGES.map((b, i) => (
        <polygon key={`f${i}`} points={stripPoints(b, 2.1)} className="ex-map__bridge ex-map__bridge--fog" />
      ))}
      {BRIDGES.map((b, i) => (
        <polygon key={`b${i}`} points={stripPoints(b, b.half + 0.25)} className="ex-map__bridge" />
      ))}
      <polygon points={hexPoints(0, 0, CITY.hub, 0)} className="ex-map__plate ex-map__plate--hub" />
      {DISTRICT_SPOTS.map((s) => (
        <polygon
          key={s.id}
          points={hexPoints(s.x, s.z, CITY.plate, -s.rotY)}
          className={`ex-map__plate${s.fogged ? ' ex-map__plate--fog' : ''}`}
          style={{ ['--plate' as string]: s.color }}
        />
      ))}
      {BUILDINGS.map((b, i) => (
        <polygon key={`k${i}`} points={boxPoints(b)} className="ex-map__building" />
      ))}
      <rect x={-4.6} y={-4.6} width={9.2} height={9.2} className="ex-map__tower" />
    </>
  );
});

export interface ExploreMapProps {
  view: MapView;
  /** Draw small markers for places (mini-map). The 2D board uses real buttons instead. */
  markers?: boolean;
  /** Shards still to find (markers only). */
  shards?: readonly string[];
  /** Player marker (mini-map): world position and facing. */
  player?: { x: number; z: number; heading: number; color: string } | null;
  className?: string;
  children?: ReactNode;
}

/** The map in a square box. `children` are absolutely positioned overlays (buttons) on top of it. */
export function ExploreMap({ view, markers = false, shards = [], player = null, className, children }: ExploreMapProps) {
  const shardSet = useMemo(() => new Set(shards), [shards]);
  const scale = view.half / 24;
  return (
    <div className={`ex-map${className ? ` ${className}` : ''}`}>
      <svg viewBox={viewBoxOf(view)} className="ex-map__svg" aria-hidden="true" focusable="false">
        <g transform={svgTransform(view)}>
          <CityDrawing />
          {markers && (
            <g>
              {BEACONS.map((b) => (
                <rect
                  key={b.id}
                  x={b.x - 1.4 * scale}
                  y={b.z - 1.4 * scale}
                  width={2.8 * scale}
                  height={2.8 * scale}
                  transform={`rotate(45 ${b.x} ${b.z})`}
                  className="ex-map__beacon"
                />
              ))}
              {KIOSKS.map((k) => (
                <rect key={k.id} x={k.x - 1.3 * scale} y={k.z - 1.3 * scale} width={2.6 * scale} height={2.6 * scale} rx={0.6 * scale} className="ex-map__kiosk" />
              ))}
              {TOWNIE_PLACES.map((t) => (
                <circle key={t.id} cx={t.x} cy={t.z} r={1 * scale} className="ex-map__townie" />
              ))}
              {SHARDS.filter((s) => shardSet.has(s.id)).map((s) => (
                <circle key={s.id} cx={s.x} cy={s.z} r={1.1 * scale} className="ex-map__shard" />
              ))}
            </g>
          )}
          {player && (
            <g transform={`translate(${player.x.toFixed(2)} ${player.z.toFixed(2)}) rotate(${((-player.heading * 180) / Math.PI).toFixed(1)})`}>
              <path d={`M0 ${3.6 * scale} L${-1.9 * scale} ${-0.6 * scale} L${1.9 * scale} ${-0.6 * scale} Z`} className="ex-map__heading" />
              <circle r={1.8 * scale} className="ex-map__player" style={{ fill: player.color }} />
            </g>
          )}
        </g>
      </svg>
      {children}
    </div>
  );
}
