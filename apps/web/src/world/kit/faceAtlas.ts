// Bean face atlas (GAME_DESIGN.md §4.4): 8 expressions + a blink, drawn procedurally ONCE into a CanvasTexture.
// The texture is multiplied with the skin vertex colour: white = skin, ink = features, pink = blush.
import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';
import { ATLAS_COLS, ATLAS_MARGIN, ATLAS_ROWS, FACE_SPAN, atlasCellOffset } from './beanGeometry';
import { sharedResource } from './motion';

export type BeanExpression =
  | 'neutral'
  | 'happy'
  | 'smug'
  | 'worried'
  | 'shocked'
  | 'relieved'
  | 'sad'
  | 'determined';

export const BEAN_EXPRESSIONS: readonly BeanExpression[] = [
  'neutral',
  'happy',
  'smug',
  'worried',
  'shocked',
  'relieved',
  'sad',
  'determined',
];

type Cell = BeanExpression | 'blink';
const CELLS: readonly Cell[] = [...BEAN_EXPRESSIONS, 'blink'];

/** UV offset for an expression (or the blink frame). */
export function expressionOffset(expression: Cell): [number, number] {
  const i = Math.max(0, CELLS.indexOf(expression));
  return atlasCellOffset(i % ATLAS_COLS, Math.floor(i / ATLAS_COLS));
}

const CELL = 128;
const INK = '#1d2440';

function drawCell(ctx: CanvasRenderingContext2D, cell: Cell, col: number, row: number): void {
  const ox = col * CELL;
  const oy = row * CELL;
  const inner = (1 - 2 * ATLAS_MARGIN) * CELL;
  // Head-radius units -> pixels (x right, y up), centred on the front of the head.
  const X = (x: number) => ox + ATLAS_MARGIN * CELL + (0.5 + x / (2 * FACE_SPAN[0])) * inner;
  const Y = (y: number) => oy + CELL - (ATLAS_MARGIN * CELL + (0.5 + y / (2 * FACE_SPAN[1])) * inner);
  const SX = inner / (2 * FACE_SPAN[0]);
  const SY = inner / (2 * FACE_SPAN[1]);

  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, CELL, CELL);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(ox, oy, CELL, CELL);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.2;

  const eyeY = 0.06;
  const eyes = [-0.36, 0.36];

  const blush = (alpha = 0.45) => {
    ctx.save();
    ctx.fillStyle = `rgba(255, 140, 130, ${alpha})`;
    for (const x of [-0.58, 0.58]) {
      ctx.beginPath();
      ctx.ellipse(X(x), Y(-0.17), 0.13 * SX, 0.08 * SY, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  const openEye = (x: number, y = eyeY, scale = 1, lookY = 0) => {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(X(x), Y(y + lookY * 0.03), 0.085 * SX * scale, 0.12 * SY * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    // Catch-light (reads as a highlight once multiplied with skin).
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(X(x + 0.03 * scale), Y(y + 0.05 * scale + lookY * 0.03), 1.8 * scale, 0, Math.PI * 2);
    ctx.fill();
  };
  const lid = (x: number, y: number, amount: number, tilt = 0) => {
    // Covers the top of an eye (half-lidded / narrowed), with a lid line.
    ctx.fillStyle = '#ffffff';
    const top = y + 0.14;
    const cut = y + 0.12 - amount * 0.24;
    ctx.beginPath();
    ctx.moveTo(X(x - 0.13), Y(top));
    ctx.lineTo(X(x + 0.13), Y(top));
    ctx.lineTo(X(x + 0.13), Y(cut - tilt));
    ctx.lineTo(X(x - 0.13), Y(cut + tilt));
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(X(x - 0.11), Y(cut + tilt * 0.85));
    ctx.lineTo(X(x + 0.11), Y(cut - tilt * 0.85));
    ctx.stroke();
  };
  const arcEye = (x: number, up: boolean, y = eyeY) => {
    ctx.beginPath();
    if (up) ctx.ellipse(X(x), Y(y - 0.03), 0.1 * SX, 0.08 * SY, 0, Math.PI, Math.PI * 2);
    else ctx.ellipse(X(x), Y(y + 0.03), 0.1 * SX, 0.07 * SY, 0, 0, Math.PI);
    ctx.stroke();
  };
  const brow = (x: number, y: number, innerLift: number, w = 0.13) => {
    // innerLift > 0: inner end higher (worried/sad); < 0: inner end lower (determined).
    const inner = x < 0 ? x + w : x - w;
    const outer = x < 0 ? x - w : x + w;
    ctx.beginPath();
    ctx.moveTo(X(outer), Y(y));
    ctx.lineTo(X(inner), Y(y + innerLift));
    ctx.stroke();
  };
  const mouthCurve = (w: number, y: number, bend: number, left = 0, right = 0) => {
    ctx.beginPath();
    ctx.moveTo(X(-w), Y(y + left));
    ctx.quadraticCurveTo(X(0), Y(y - bend), X(w), Y(y + right));
    ctx.stroke();
  };

  switch (cell) {
    case 'neutral':
      eyes.forEach((x) => openEye(x));
      mouthCurve(0.12, -0.34, 0.04);
      blush(0.25);
      break;
    case 'blink':
      eyes.forEach((x) => {
        ctx.beginPath();
        ctx.moveTo(X(x - 0.1), Y(eyeY));
        ctx.lineTo(X(x + 0.1), Y(eyeY));
        ctx.stroke();
      });
      mouthCurve(0.12, -0.34, 0.04);
      blush(0.25);
      break;
    case 'happy':
      eyes.forEach((x) => arcEye(x, true));
      ctx.fillStyle = '#8c2f3c';
      ctx.beginPath();
      ctx.moveTo(X(-0.2), Y(-0.27));
      ctx.quadraticCurveTo(X(0), Y(-0.6), X(0.2), Y(-0.27));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      blush(0.55);
      break;
    case 'smug':
      eyes.forEach((x) => {
        openEye(x);
        lid(x, eyeY, 0.55);
      });
      brow(-0.36, 0.3, 0.0);
      brow(0.36, 0.36, -0.04);
      mouthCurve(0.15, -0.34, 0.02, 0.03, -0.07);
      break;
    case 'worried':
      eyes.forEach((x) => openEye(x, eyeY, 0.95));
      brow(-0.36, 0.28, 0.08);
      brow(0.36, 0.28, 0.08);
      ctx.beginPath();
      ctx.moveTo(X(-0.13), Y(-0.36));
      ctx.bezierCurveTo(X(-0.06), Y(-0.31), X(-0.02), Y(-0.41), X(0.04), Y(-0.36));
      ctx.bezierCurveTo(X(0.08), Y(-0.32), X(0.11), Y(-0.38), X(0.14), Y(-0.36));
      ctx.stroke();
      // Small sweat drop (frost-blue), a classic comic cue.
      ctx.fillStyle = '#8fc8ff';
      ctx.beginPath();
      ctx.moveTo(X(0.72), Y(0.36));
      ctx.quadraticCurveTo(X(0.8), Y(0.2), X(0.72), Y(0.18));
      ctx.quadraticCurveTo(X(0.64), Y(0.2), X(0.72), Y(0.36));
      ctx.fill();
      break;
    case 'shocked':
      eyes.forEach((x) => {
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.ellipse(X(x), Y(eyeY + 0.02), 0.12 * SX, 0.15 * SY, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(X(x), Y(eyeY + 0.02), 3.2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.lineWidth = 3.2;
      brow(-0.36, 0.38, 0.03);
      brow(0.36, 0.38, 0.03);
      ctx.fillStyle = '#8c2f3c';
      ctx.beginPath();
      ctx.ellipse(X(0), Y(-0.38), 0.08 * SX, 0.11 * SY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case 'relieved':
      eyes.forEach((x) => arcEye(x, false));
      brow(-0.36, 0.3, 0.03, 0.12);
      brow(0.36, 0.3, 0.03, 0.12);
      mouthCurve(0.15, -0.33, 0.09);
      blush(0.5);
      break;
    case 'sad':
      eyes.forEach((x) => openEye(x, eyeY - 0.02, 0.9, -1));
      brow(-0.36, 0.26, 0.09);
      brow(0.36, 0.26, 0.09);
      mouthCurve(0.13, -0.4, -0.08);
      break;
    case 'determined':
      eyes.forEach((x) => {
        openEye(x);
        lid(x, eyeY, 0.3, x < 0 ? -0.025 : 0.025);
      });
      brow(-0.36, 0.3, -0.07);
      brow(0.36, 0.3, -0.07);
      mouthCurve(0.14, -0.35, -0.01, 0.01, 0.01);
      break;
  }
  ctx.restore();
}

function createAtlas(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * CELL;
  canvas.height = ATLAS_ROWS * CELL;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    CELLS.forEach((cell, i) => drawCell(ctx, cell, i % ATLAS_COLS, Math.floor(i / ATLAS_COLS)));
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // No mipmaps: they would bleed neighbouring expression cells into each other.
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Shared, ref-counted face atlas texture (one per page, disposed when no bean is mounted). */
export const faceAtlas = sharedResource(createAtlas, (t) => t.dispose());
