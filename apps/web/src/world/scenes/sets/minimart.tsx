import { lazy } from 'react';
import type { Mission } from '@shieldquest/shared';
import type { SetPiece, SetPieceProps } from './types';
import { MINIMART_ANCHORS, MINIMART_CAMERA, MINIMART_OBLIQUE as O, MINIMART_STAGING, MM, MM_BALLOONS } from './parts/minimart.layout';
import { FBox, FPoly, FlatSky, flatAnchorsOf, flatPoint, flatStagingOf, isNight, litPattern, pts } from '../core/flat';
import type { FlatTwin, StagedSetPiece, Vec3 } from '../core/staging';

// S3 Mall Atrium and MiniMart 24 (with the phone-accessory shop). The 3D geometry is lazy (three.js stays out
// of the Flat View and the app shell); the anchors, camera and Flat View twin below are plain data shared with
// it (parts/minimart.layout.ts).
const Minimart3D = lazy(() => import('./parts/minimart.3d'));

/** Suspends while the 3D chunk loads, so the scene appears all at once (MissionScene covers it with the Flat View). */
function MinimartComponent(props: SetPieceProps) {
  return <Minimart3D {...props} />;
}

const W = 400;
const H = 250;
const BRAND = '#e8505b';
const SHOP_FLOOR = '#eef3f6';
const SHOP_WALL = '#e3efea';
const MALL_FLOOR = '#efe6d6';
const MALL_WALL = '#efe6d8';
const GOLD = '#f2c14e';

/** A vertical rectangle facing the camera at depth z. */
const face = (x0: number, y0: number, x1: number, y1: number, z: number): Vec3[] => [
  [x0, y0, z],
  [x1, y0, z],
  [x1, y1, z],
  [x0, y1, z],
];

/** A floor rectangle at height y. */
const floorRect = (x0: number, z0: number, x1: number, z1: number, y = 0): Vec3[] => [
  [x0, y, z1],
  [x1, y, z1],
  [x1, y, z0],
  [x0, y, z0],
];

/** A shelf gondola with its promo end cap and a few product stripes along its visible side. */
function FlatGondola({ x, z0, z1, cap, goods }: { x: number; z0: number; z1: number; cap: string; goods: readonly string[] }) {
  const hw = 0.35;
  return (
    <g>
      <FBox o={O} min={[x - hw, 0, z0]} max={[x + hw, 1.45, z1]} front={cap} top="#c9c3d6" side="#e9e4ef" />
      {[0.35, 0.8, 1.2].map((y, r) => (
        <g key={y}>
          {goods.map((c, i) => {
            const za = z0 + 0.1 + (i * (z1 - z0 - 0.2)) / goods.length;
            const zb = za + (z1 - z0 - 0.2) / goods.length - 0.08;
            return <FPoly key={c + i} o={O} fill={goods[(i + r) % goods.length]!} p={[[x + hw, y - 0.22, zb], [x + hw, y - 0.22, za], [x + hw, y, za], [x + hw, y, zb]]} />;
          })}
        </g>
      ))}
      <FPoly o={O} fill="#f4efe6" p={face(x - hw - 0.04, 1.45, x + hw + 0.04, 1.75, z1 + 0.08)} />
    </g>
  );
}

/** Flat View drawing: the same diorama from the front-right, at the same proportions as the 3D set. */
function MinimartFlat({ timeOfDay }: { timeOfDay: Mission['timeOfDay'] }) {
  const night = isNight(timeOfDay);
  const { floor: f, wallZ: wz, wallH, shop, door: d, fridges: fr, counter: ct, backShelf: bs, booth: bo, phoneShop: ps, upper: up, walkway: wk } = MM;
  const lit = litPattern(10, night ? 0.75 : 0.35, 23);
  const windows = [];
  let wi = 0;
  for (let x = -7.3; x < 7.2; x += 1.85) {
    wi++;
    if (x + 1.5 > MM.influenceX - 0.95 && x < MM.influenceX + 0.95) continue;
    const on = lit[wi]!;
    windows.push(
      <g key={x}>
        <FPoly o={O} fill={on ? '#ffd58a' : night ? '#2b3557' : '#bcd3ea'} p={face(x, 3.95, x + 1.5, 5.6, up.z1)} />
        <FPoly o={O} fill={['#2bb3a3', '#f26b5b', '#8a6cf0', '#f2c14e'][wi % 4]!} p={face(x - 0.05, 5.65, x + 1.55, 5.95, up.z1)} />
      </g>,
    );
  }
  const doorW = (fr.x1 - fr.x0) / fr.doors;
  const cctv = flatPoint(O, MM.cctv);
  const wheel = flatPoint(O, [MM.wheel.at[0], MM.wheel.y, MM.wheel.at[2]]);
  const prize = MM.prize;
  const st = MM.standee.at;
  const pl = MM.planter;
  const tree = flatPoint(O, [(pl.x0 + pl.x1) / 2, 1.85, (pl.z0 + pl.z1) / 2]);
  const benchAt = MM.bench.at;
  const leaf = (d.x1 - d.x0) / 2;
  return (
    <g>
      <FlatSky width={W} height={H} timeOfDay={timeOfDay} />
      {/* The mall's upper storey, its windows and the walkway with its glass rail. */}
      <FBox o={O} min={[f.x0, up.y0, up.z0]} max={[f.x1, up.y1, up.z1]} front="#efe6d8" side="#d8cdbb" top="#8f9ab8" />
      <FBox o={O} min={[f.x0 - 0.05, up.y1, up.z0]} max={[f.x1 + 0.05, up.y1 + 0.22, up.z1 + 0.2]} front="#b24a50" top="#8f9ab8" />
      {windows}
      {/* Back walls, then the floors: shop tiles, mall stone, the phone shop's planks. */}
      <FPoly o={O} fill={SHOP_WALL} p={face(shop.x0, 0, shop.x1, wallH, wz)} />
      <FPoly o={O} fill={MALL_WALL} p={face(shop.x1, 0, f.x1, wallH, wz)} />
      <FBox o={O} min={[f.x0, -0.5, f.z0]} max={[f.x1, 0, f.z1]} front="#a39a8c" top={MALL_FLOOR} side="#8f877b" />
      <FPoly o={O} fill={SHOP_FLOOR} p={floorRect(shop.x0, f.z0, shop.x1, shop.front)} />
      {[-6.4, -5.2, -4.0, -2.8, -1.6, -0.4].map((x) => (
        <polyline key={x} points={pts(O, [x, 0, f.z0], [x, 0, shop.front])} stroke="#cddce6" strokeWidth={0.5} />
      ))}
      <FPoly o={O} fill="#c99a6b" p={floorRect(ps.x0, f.z0, f.x1, ps.front)} />
      <ellipse cx={flatPoint(O, [3, 0, -0.9]).x} cy={flatPoint(O, [3, 0, -0.9]).y} rx={2.15 * O.s} ry={2.15 * O.sz} fill="none" stroke="#e6c77a" strokeWidth={1.4} />
      <FPoly o={O} fill={BRAND} p={face(shop.x0, 0, shop.x1, 0.14, wz)} />
      {/* Fridges with the brand lightbox above them. */}
      <FBox o={O} min={[fr.x0, 0, wz]} max={[fr.x1, fr.h, wz + fr.depth]} front="#eef2f7" side="#dfe5ee" top="#c9d3e0" />
      <FPoly o={O} fill={BRAND} p={face(fr.x0, fr.h - 0.2, fr.x1, fr.h - 0.04, wz + fr.depth)} />
      {Array.from({ length: fr.doors }, (_, i) => {
        const x0 = fr.x0 + i * doorW + 0.05;
        return (
          <g key={i}>
            <FPoly o={O} fill="#d6f0ff" p={face(x0, 0.12, x0 + doorW - 0.1, fr.h - 0.26, wz + fr.depth)} />
            {[0.4, 0.8, 1.2].map((y, r) => (
              <polyline key={y} points={pts(O, [x0 + 0.06, y, wz + fr.depth], [x0 + doorW - 0.16, y, wz + fr.depth])} stroke={['#f26b5b', '#2bb3a3', '#f2c14e'][(i + r) % 3]} strokeWidth={2.4} />
            ))}
          </g>
        );
      })}
      <FBox o={O} min={[MM.brand.x0, MM.brand.y0, wz]} max={[MM.brand.x1, MM.brand.y1, wz + 0.12]} front="#fff6e0" top="#9c3b42" />
      <circle cx={flatPoint(O, [MM.brand.x0 + 0.32, 2.6, wz + 0.12]).x} cy={flatPoint(O, [MM.brand.x0 + 0.32, 2.6, wz + 0.12]).y} r={4} fill={GOLD} stroke={BRAND} strokeWidth={1.6} />
      {/* Restocking shelf, the dome camera on its bracket and the yellow notice below it. */}
      <FBox o={O} min={[bs.x0, 0, wz]} max={[bs.x1, 2.0, wz + bs.depth]} front="#4d5470" top="#7f8fb5" side="#5b6487" />
      {[0.75, 1.23, 1.71].map((y, r) => (
        <polyline key={y} points={pts(O, [bs.x0 + 0.08, y, wz + bs.depth], [bs.x1 - 0.08, y, wz + bs.depth])} stroke={['#f4efe6', '#7cc4ff', '#c4a3ff'][r]} strokeWidth={4} strokeDasharray="3 1.6" />
      ))}
      <FPoly o={O} fill={GOLD} p={face(MM.cctv[0] - 0.36, 2.04, MM.cctv[0] + 0.36, 2.36, wz)} />
      <rect x={cctv.x - 3} y={cctv.y - 2.4} width={6} height={2.4} fill="#f4efe6" />
      <path d={`M ${cctv.x - 3.2} ${cctv.y} a 3.2 3.2 0 0 0 6.4 0 z`} fill="#2c3149" />
      {/* Phone-accessory shop: display of cases, side walls, glass counter, the lightbox fascia. */}
      <FPoly o={O} fill="#4d5470" p={face(ps.x0 + 0.2, 0.6, ps.x1 - 0.2, 2.4, wz)} />
      {Array.from({ length: 24 }, (_, i) => {
        const c = i % 8;
        const r = Math.floor(i / 8);
        const x0 = ps.x0 + 0.38 + c * 0.27;
        const y0 = 0.82 + r * 0.52;
        return <FPoly key={i} o={O} fill={['#ff9ec4', '#7fd6cf', '#f2c14e', '#c4a3ff', '#f26b5b', '#f4efe6'][(c + r * 3) % 6]!} p={face(x0, y0, x0 + 0.15, y0 + 0.36, wz)} />;
      })}
      <FBox o={O} min={[ps.x0 - 0.08, 0, wz]} max={[ps.x0 + 0.08, wallH, ps.front]} front="#6c5bd6" side={MALL_WALL} />
      <FBox o={O} min={[ps.counter.x0, 0, ps.counter.z0]} max={[ps.counter.x1, 1, ps.counter.z1]} front="#cfe8ff" top="#e9f4ff" side="#9fb8d8" />
      <FBox o={O} min={[ps.x0 - 0.08, 2.75, ps.front - 0.12]} max={[f.x1, 3.3, ps.front]} front="#f4f1ff" side="#4b3fa8" />
      <FPoly o={O} fill="#8a6cf0" p={face(ps.x0 - 0.08, 2.75, f.x1, 2.81, ps.front)} />
      {/* Walkway along the upper storey, its rail and the columns carrying it. */}
      <FBox o={O} min={[f.x0, up.y0, wz]} max={[f.x1, wk.y1, wk.z1]} front="#f4efe6" top="#d8cdbb" />
      <polyline points={pts(O, [f.x0, wk.y1 + 0.82, wk.z1], [MM.influenceX - 1.15, wk.y1 + 0.82, wk.z1])} stroke="#cfe8ff" strokeWidth={1.2} />
      <polyline points={pts(O, [MM.influenceX + 1.15, wk.y1 + 0.82, wk.z1], [f.x1, wk.y1 + 0.82, wk.z1])} stroke="#cfe8ff" strokeWidth={1.2} />
      {MM.columns.map((c) => (
        <FBox key={c[0]} o={O} min={[c[0] - 0.2, 0, c[2] - 0.2]} max={[c[0] + 0.2, up.y0, c[2] + 0.2]} front="#f4efe6" side="#ddd5c6" />
      ))}
      {/* Wall shelving, the two low gondolas, the counter and the self-checkout. */}
      <FBox o={O} min={[shop.x0, 0, MM.wallShelf.z0]} max={[shop.x0 + MM.wallShelf.depth, MM.wallShelf.h, MM.wallShelf.z1]} front="#d9dde6" side="#cfd5e0" top="#b9c1cf" />
      {[0.4, 0.8, 1.2, 1.6].map((y, i) => (
        <polyline key={y} points={pts(O, [shop.x0 + 0.46, y - 0.15, MM.wallShelf.z1 - 0.1], [shop.x0 + 0.46, y - 0.15, MM.wallShelf.z0 + 0.1])} stroke={['#7cc4ff', '#f2c14e', '#2bb3a3', '#f26b5b'][i]} strokeWidth={3} strokeDasharray="2.4 1.2" />
      ))}
      <FlatGondola x={MM.gondolas[0].x} z0={MM.gondolas[0].z0} z1={MM.gondolas[0].z1} cap="#f59e42" goods={['#f59e42', '#f2c14e', '#e8505b', '#7cc47f']} />
      <FlatGondola x={MM.gondolas[1].x} z0={MM.gondolas[1].z0} z1={MM.gondolas[1].z1} cap="#f27aa0" goods={['#ff9ec4', '#c4a3ff', '#f4efe6', '#7fd6cf']} />
      <FBox o={O} min={[ct.x0, 0, ct.z0]} max={[ct.x1, ct.h, ct.z1]} front={BRAND} top="#e4e7ee" side="#9c3b42" />
      <FPoly o={O} fill="#fff6e0" p={face(ct.x0 + 0.06, 0.45, ct.x1 - 0.06, 0.55, ct.z1)} />
      <FBox o={O} min={[-0.75, ct.h, -3.42]} max={[-0.35, ct.h + 0.4, -3.12]} front="#3d4766" top="#7fd6cf" />
      <FBox o={O} min={[MM.kiosk[0] - 0.25, 0, MM.kiosk[2] - 0.2]} max={[MM.kiosk[0] + 0.25, 0.95, MM.kiosk[2] + 0.2]} front="#eef2f7" side="#d9dde6" top="#c9cdd6" />
      <FBox o={O} min={[MM.kiosk[0] - 0.3, 0.95, MM.kiosk[2] - 0.12]} max={[MM.kiosk[0] + 0.3, 1.38, MM.kiosk[2] + 0.02]} front="#4d5470" top="#7fd6cf" />
      <circle cx={flatPoint(O, [MM.kiosk[0] - 0.22, 1.86, MM.kiosk[2]]).x} cy={flatPoint(O, [MM.kiosk[0] - 0.22, 1.86, MM.kiosk[2]]).y} r={1.8} fill="#1fb5a8" />
      {/* The partition between the shop and the atrium. */}
      <FBox o={O} min={[shop.x1 - 0.08, 0, wz]} max={[shop.x1 + 0.08, wallH, shop.front]} front={BRAND} side={MALL_WALL} top="#cfc6b4" />
      {/* Lucky-draw booth: backdrop with its gold burst, balloon arch, counter, prize pedestal, wheel, standee. */}
      <FBox o={O} min={[bo.x0, 0, bo.backZ - 0.12]} max={[bo.x1, bo.h, bo.backZ]} front={BRAND} top={GOLD} side="#b84a52" />
      <ellipse cx={flatPoint(O, [3, 1.95, bo.backZ]).x} cy={flatPoint(O, [3, 1.95, bo.backZ]).y} rx={0.66 * O.s} ry={0.66 * O.s} fill={GOLD} stroke="#fff6e0" strokeWidth={1.4} />
      {MM_BALLOONS.map((p, i) => {
        const c = flatPoint(O, p);
        return <circle key={i} cx={c.x} cy={c.y} r={3.4} fill={[BRAND, GOLD, '#ffffff', '#2bb3a3', '#ff9ec4'][i % 5]} stroke="#b84a52" strokeWidth={0.4} />;
      })}
      <FBox o={O} min={[bo.counter.x0, 0, bo.counter.z0]} max={[bo.counter.x1, 1, bo.counter.z1]} front={GOLD} top="#fff6e0" side="#b8923a" />
      {[0, 1, 2, 3].map((i) => (
        <FPoly key={i} o={O} fill={BRAND} p={face(bo.counter.x0 + 0.1 + i * 0.4, 0.1, bo.counter.x0 + 0.26 + i * 0.4, 0.9, bo.counter.z1)} />
      ))}
      <FBox o={O} min={[prize[0] - 0.3, 0, prize[2] - 0.3]} max={[prize[0] + 0.3, 0.95, prize[2] + 0.3]} front="#f4efe6" top={GOLD} side="#ddd5c6" />
      <FPoly o={O} fill="#2c3149" p={face(prize[0] - 0.26, 1.05, prize[0] + 0.26, 1.42, prize[2])} />
      <FPoly o={O} fill="#9fd8ff" p={face(prize[0] - 0.22, 1.09, prize[0] + 0.22, 1.38, prize[2])} />
      <polyline points={pts(O, [MM.wheel.at[0] - 0.4, 0, MM.wheel.at[2]], [MM.wheel.at[0], MM.wheel.y, MM.wheel.at[2]], [MM.wheel.at[0] + 0.4, 0, MM.wheel.at[2]])} fill="none" stroke="#3d4766" strokeWidth={1.4} />
      {Array.from({ length: 8 }, (_, i) => {
        const a0 = (i / 8) * Math.PI * 2;
        const a1 = ((i + 1) / 8) * Math.PI * 2;
        const r = MM.wheel.r * O.s;
        return (
          <path
            key={i}
            d={`M ${wheel.x} ${wheel.y} L ${(wheel.x + Math.cos(a0) * r).toFixed(1)} ${(wheel.y + Math.sin(a0) * r).toFixed(1)} A ${r} ${r} 0 0 1 ${(wheel.x + Math.cos(a1) * r).toFixed(1)} ${(wheel.y + Math.sin(a1) * r).toFixed(1)} Z`}
            fill={[BRAND, GOLD, '#2bb3a3', '#fff6e0'][i % 4]}
          />
        );
      })}
      <polygon points={`${wheel.x - 2.2},${wheel.y - MM.wheel.r * O.s - 3.4} ${wheel.x + 2.2},${wheel.y - MM.wheel.r * O.s - 3.4} ${wheel.x},${wheel.y - MM.wheel.r * O.s + 1.2}`} fill={GOLD} />
      <FPoly o={O} fill="#fff6e0" p={face(st[0] - 0.3, 0.05, st[0] + 0.3, 1.7, st[2])} stroke="#c9cdd6" />
      <FPoly o={O} fill={BRAND} p={face(st[0] - 0.28, 1.4, st[0] + 0.28, 1.66, st[2])} />
      <FPoly o={O} fill="#1d2440" p={face(st[0] - 0.16, 0.77, st[0] + 0.16, 1.09, st[2])} />
      <FPoly o={O} fill="#ffffff" p={face(st[0] - 0.08, 0.85, st[0] + 0.08, 1.01, st[2])} />
      {/* Shopfront: sill, posts, the door header and its two leaves slid open. */}
      <FBox o={O} min={[shop.x0, 0, shop.front - 0.12]} max={[d.x0 - 0.05, 0.35, shop.front]} front={BRAND} top="#f4efe6" />
      <FBox o={O} min={[d.x1 + 0.05, 0, shop.front - 0.12]} max={[shop.x1, 0.35, shop.front]} front={BRAND} top="#f4efe6" />
      <FPoly o={O} fill="#3d4766" p={floorRect(d.x0 + 0.13, shop.front + 0.28, d.x1 - 0.13, shop.front + 0.87, 0.01)} stroke={BRAND} />
      {[d.x0 - 0.05, d.x1 + 0.05].map((x) => (
        <FBox key={x} o={O} min={[x - 0.05, 0, shop.front - 0.1]} max={[x + 0.05, d.h + 0.18, shop.front]} front="#c9cdd6" />
      ))}
      {[d.x0 - leaf, d.x1].map((x) => (
        <g key={x}>
          <FPoly o={O} fill="none" stroke="#c9cdd6" p={face(x + 0.03, 0.02, x + leaf - 0.03, d.h - 0.04, shop.front + 0.08)} />
          <polyline points={pts(O, [x + 0.06, 1.0, shop.front + 0.08], [x + leaf - 0.06, 1.0, shop.front + 0.08])} stroke={BRAND} strokeWidth={1.2} />
        </g>
      ))}
      <FBox o={O} min={[d.x0 - 0.85, d.h, shop.front - 0.04]} max={[d.x1 + 0.85, d.h + 0.18, shop.front + 0.14]} front="#dfe2e8" top="#c9cdd6" />
      {/* Atrium: the planter with its tree, and a bench. */}
      <FBox o={O} min={[pl.x0, 0, pl.z0]} max={[pl.x1, 0.5, pl.z1]} front="#c9b8a2" top="#5a4a3e" side="#b3a38e" />
      <circle cx={tree.x} cy={tree.y} r={17} fill="#3f8f74" />
      <circle cx={tree.x - 5} cy={tree.y - 5} r={9} fill="#5aa88a" />
      <FBox o={O} min={[benchAt[0] - 0.8, 0.38, benchAt[2] - 0.2]} max={[benchAt[0] + 0.8, 0.42, benchAt[2] + 0.2]} front="#a8744c" top="#c99a6b" />
      <FBox o={O} min={[benchAt[0] - 0.7, 0, benchAt[2]]} max={[benchAt[0] - 0.62, 0.38, benchAt[2] + 0.1]} front="#4d5470" />
      <FBox o={O} min={[benchAt[0] + 0.62, 0, benchAt[2]]} max={[benchAt[0] + 0.7, 0.38, benchAt[2] + 0.1]} front="#4d5470" />
    </g>
  );
}

const flat: FlatTwin = {
  viewBox: `0 0 ${W} ${H}`,
  Draw: MinimartFlat,
  anchors: flatAnchorsOf(O, MINIMART_ANCHORS),
  staging: flatStagingOf(O, MINIMART_ANCHORS, MINIMART_STAGING),
};

const minimartSet: StagedSetPiece = {
  id: 'minimart',
  name: 'Mall atrium and MiniMart 24',
  anchors: MINIMART_ANCHORS,
  camera: MINIMART_CAMERA,
  Component: MinimartComponent,
  flat,
  staging: MINIMART_STAGING,
};

export const minimart: SetPiece = minimartSet;
