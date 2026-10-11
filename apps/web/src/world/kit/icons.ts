// Shared icon atlas for in-world markers (GAME_DESIGN.md §4.2-4.3): clue hotspot states and the Influence
// bead icons, drawn procedurally ONCE into a CanvasTexture (no image files, no fonts from the network).
// Status markers always pair colour with a distinct shape and an icon: dotted ring + magnifier (available),
// jagged hatched burst + "!" (risk), rounded shield + tick (safe). The word lives in the DOM.
import { CanvasTexture, LinearMipmapLinearFilter, PlaneGeometry, SRGBColorSpace } from 'three';
import { sharedResource } from './motion';
import { PALETTE } from './uniforms';

export type ThreadBead = 'coin' | 'clock' | 'crowd' | 'badge' | 'link';
export const THREAD_BEADS: readonly ThreadBead[] = ['coin', 'clock', 'crowd', 'badge', 'link'];

export type IconCell = 'available' | 'found-flag' | 'found-ok' | ThreadBead;
const CELLS: readonly IconCell[] = ['available', 'found-flag', 'found-ok', 'coin', 'clock', 'crowd', 'badge', 'link'];

const COLS = 4;
const ROWS = 2;
const SIZE = 256;

type Ctx = CanvasRenderingContext2D;

function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/** Disc with a paper rim: the base of every bead. */
function beadDisc(ctx: Ctx, fill: string): void {
  circle(ctx, 128, 128, 104);
  ctx.fillStyle = PALETTE.paper;
  ctx.fill();
  circle(ctx, 128, 128, 92);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawAvailable(ctx: Ctx): void {
  // Dotted outer ring (shape cue, not colour), dark inner disc, magnifier icon.
  ctx.save();
  ctx.setLineDash([16, 13]);
  ctx.lineCap = 'round';
  ctx.lineWidth = 11;
  ctx.strokeStyle = PALETTE.attention;
  circle(ctx, 128, 128, 108);
  ctx.stroke();
  ctx.restore();
  circle(ctx, 128, 128, 80);
  ctx.fillStyle = 'rgba(20, 32, 51, 0.9)';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = PALETTE.attention;
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.strokeStyle = PALETTE.paper;
  ctx.lineWidth = 13;
  circle(ctx, 116, 116, 30);
  ctx.stroke();
  ctx.lineWidth = 17;
  ctx.beginPath();
  ctx.moveTo(139, 139);
  ctx.lineTo(166, 166);
  ctx.stroke();
}

function burstPath(ctx: Ctx, points: number, outer: number, inner: number): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = 128 + Math.cos(a) * r;
    const y = 128 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawFlag(ctx: Ctx): void {
  // Jagged burst with diagonal hatching (the risk shape), "!" icon.
  burstPath(ctx, 12, 116, 84);
  ctx.fillStyle = PALETTE.risk;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 7;
  for (let d = -256; d < 512; d += 22) {
    ctx.beginPath();
    ctx.moveTo(d, 0);
    ctx.lineTo(d + 256, 256);
    ctx.stroke();
  }
  ctx.restore();
  burstPath(ctx, 12, 116, 84);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#6b1235';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#6b1235';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(114, 62, 28, 82, 12);
  ctx.fill();
  ctx.stroke();
  circle(ctx, 128, 172, 15);
  ctx.fill();
  ctx.stroke();
}

function shieldPath(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(128, 22);
  ctx.quadraticCurveTo(176, 44, 214, 42);
  ctx.quadraticCurveTo(222, 150, 128, 236);
  ctx.quadraticCurveTo(34, 150, 42, 42);
  ctx.quadraticCurveTo(80, 44, 128, 22);
  ctx.closePath();
}

function drawOk(ctx: Ctx): void {
  // Rounded shield (the safe shape) with a tick.
  shieldPath(ctx);
  ctx.fillStyle = PALETTE.safe;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#0b5a53';
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.moveTo(84, 128);
  ctx.lineTo(116, 160);
  ctx.lineTo(174, 94);
  ctx.stroke();
}

function drawCoin(ctx: Ctx): void {
  beadDisc(ctx, PALETTE.gold);
  circle(ctx, 128, 128, 70);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#b8862a';
  ctx.stroke();
  // A drawn "$" (two arcs and a bar) so no font is needed.
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#6b4a12';
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.arc(128, 106, 24, -0.2 * Math.PI, 0.5 * Math.PI, true);
  ctx.arc(128, 150, 24, -0.5 * Math.PI, 0.8 * Math.PI, false);
  ctx.stroke();
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(128, 66);
  ctx.lineTo(128, 190);
  ctx.stroke();
}

function drawClock(ctx: Ctx): void {
  beadDisc(ctx, PALETTE.paper2);
  circle(ctx, 128, 128, 70);
  ctx.lineWidth = 10;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.lineWidth = i % 3 === 0 ? 8 : 4;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 56, 128 + Math.sin(a) * 56);
    ctx.lineTo(128 + Math.cos(a) * 64, 128 + Math.sin(a) * 64);
    ctx.stroke();
  }
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128, 82);
  ctx.moveTo(128, 128);
  ctx.lineTo(162, 146);
  ctx.stroke();
  ctx.strokeStyle = PALETTE.risk;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(128, 128, 84, -0.5 * Math.PI, 0.15 * Math.PI);
  ctx.stroke();
}

function drawCrowd(ctx: Ctx): void {
  beadDisc(ctx, PALETTE.digi);
  const person = (x: number, y: number, s: number, fill: string) => {
    ctx.fillStyle = fill;
    circle(ctx, x, y - 26 * s, 17 * s);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y + 22 * s, 30 * s, 26 * s, 0, Math.PI, 0);
    ctx.fill();
  };
  person(86, 136, 0.85, '#d9cffc');
  person(170, 136, 0.85, '#d9cffc');
  person(128, 146, 1.05, PALETTE.paper);
}

function drawBadge(ctx: Ctx): void {
  // A generic rosette (never a real crest or police badge).
  beadDisc(ctx, '#38bdf8');
  ctx.fillStyle = PALETTE.paper;
  ctx.beginPath();
  for (let i = 0; i < 32; i++) {
    const r = i % 2 === 0 ? 62 : 52;
    const a = (i / 32) * Math.PI * 2;
    const x = 128 + Math.cos(a) * r;
    const y = 118 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1e6f99';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 34 : 15;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = 128 + Math.cos(a) * r;
    const y = 118 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.paper;
  ctx.beginPath();
  ctx.moveTo(100, 166);
  ctx.lineTo(90, 210);
  ctx.lineTo(110, 200);
  ctx.lineTo(122, 214);
  ctx.lineTo(124, 170);
  ctx.closePath();
  ctx.moveTo(156, 166);
  ctx.lineTo(166, 210);
  ctx.lineTo(146, 200);
  ctx.lineTo(134, 214);
  ctx.lineTo(132, 170);
  ctx.closePath();
  ctx.fill();
}

function drawLink(ctx: Ctx): void {
  beadDisc(ctx, PALETTE.retail);
  ctx.save();
  ctx.translate(128, 128);
  ctx.rotate(-Math.PI / 4);
  ctx.lineWidth = 15;
  ctx.strokeStyle = PALETTE.paper;
  ctx.beginPath();
  ctx.roundRect(-62, -20, 68, 40, 20);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-6, -20, 68, 40, 20);
  ctx.stroke();
  ctx.restore();
}

const DRAW: Record<IconCell, (ctx: Ctx) => void> = {
  available: drawAvailable,
  'found-flag': drawFlag,
  'found-ok': drawOk,
  coin: drawCoin,
  clock: drawClock,
  crowd: drawCrowd,
  badge: drawBadge,
  link: drawLink,
};

export interface IconAtlas {
  texture: CanvasTexture;
  /** A 1 x 1 plane per cell, its UVs mapped to that cell (share it; do not dispose). */
  planes: Record<IconCell, PlaneGeometry>;
}

function createIconAtlas(): IconAtlas {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * SIZE;
  canvas.height = ROWS * SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    CELLS.forEach((cell, i) => {
      ctx.save();
      ctx.translate((i % COLS) * SIZE, Math.floor(i / COLS) * SIZE);
      ctx.beginPath();
      ctx.rect(0, 0, SIZE, SIZE);
      ctx.clip();
      DRAW[cell](ctx);
      ctx.restore();
    });
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 2;
  texture.needsUpdate = true;
  const planes = {} as Record<IconCell, PlaneGeometry>;
  CELLS.forEach((cell, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const plane = new PlaneGeometry(1, 1);
    const uv = plane.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) {
      uv.setXY(k, (col + uv.getX(k)) / COLS, 1 - (row + 1) / ROWS + uv.getY(k) / ROWS);
    }
    uv.needsUpdate = true;
    planes[cell] = plane;
  });
  return { texture, planes };
}

/** Shared, ref-counted icon atlas (disposed when no marker uses it). */
export const iconAtlas = sharedResource(createIconAtlas, ({ texture, planes }) => {
  texture.dispose();
  for (const p of Object.values(planes)) p.dispose();
});
