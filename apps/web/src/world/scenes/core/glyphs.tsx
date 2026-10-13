// Flat View glyphs (GAME_DESIGN.md §4.4, §4.8): the 2D twins of the kit's beans, the faceless silhouette, the
// influence window and the string's tactic beads. Drawn in a 36-unit-tall box with the feet at the origin and
// scaled to the set's bean height. Pure SVG (no three.js): this ships with the Flat View in the app shell.
import type { CastMember } from '@shieldquest/shared';
// Type-only and pure imports: neither pulls three.js into the Flat View.
import type { ThreadBead } from '../../kit/icons';
import { pick } from '../../kit/math';

/** Same tone lists as the kit's bean builder, so a cast member looks the same in both views. */
const SKIN_TONES = ['#f3d2b8', '#e9bd98', '#d9a077', '#bf8257', '#9a6342', '#71472f'] as const;
const HAIR_COLORS = ['#1e1a22', '#2b211f', '#3a2a22', '#4b3426', '#22232f', '#5a3b2a'] as const;

export type GlyphPose = 'stand' | 'sit' | 'phone' | 'lean' | 'walk' | 'arms-crossed' | 'open-arms' | 'curl-up' | 'turn-towards';
export type GlyphExpression = 'neutral' | 'happy' | 'smug' | 'worried' | 'shocked' | 'relieved' | 'sad' | 'determined';

const INK = '#1d2440';

function Face({ expression, cy }: { expression: GlyphExpression; cy: number }) {
  const eyeY = cy - 0.4;
  const m = cy + 3.6;
  const closed = expression === 'relieved' || expression === 'happy';
  const eyes = closed ? (
    <>
      <path d={`M-3.6 ${eyeY + 0.4} q1 -1.4 2 0`} fill="none" stroke={INK} strokeWidth={0.9} strokeLinecap="round" />
      <path d={`M1.6 ${eyeY + 0.4} q1 -1.4 2 0`} fill="none" stroke={INK} strokeWidth={0.9} strokeLinecap="round" />
    </>
  ) : expression === 'smug' ? (
    <>
      <path d={`M-3.6 ${eyeY} h2`} stroke={INK} strokeWidth={1} strokeLinecap="round" />
      <path d={`M1.6 ${eyeY} h2`} stroke={INK} strokeWidth={1} strokeLinecap="round" />
    </>
  ) : (
    <>
      <circle cx={-2.6} cy={eyeY} r={expression === 'shocked' ? 1.2 : 0.95} fill={INK} />
      <circle cx={2.6} cy={eyeY} r={expression === 'shocked' ? 1.2 : 0.95} fill={INK} />
    </>
  );
  let mouth;
  switch (expression) {
    case 'happy':
      mouth = <path d={`M-2.6 ${m - 0.8} Q0 ${m + 2} 2.6 ${m - 0.8}`} fill="none" stroke={INK} strokeWidth={0.95} strokeLinecap="round" />;
      break;
    case 'relieved':
      mouth = <path d={`M-1.8 ${m - 0.4} Q0 ${m + 1.2} 1.8 ${m - 0.4}`} fill="none" stroke={INK} strokeWidth={0.9} strokeLinecap="round" />;
      break;
    case 'smug':
      mouth = <path d={`M-2.2 ${m} Q1 ${m + 1.2} 2.8 ${m - 1.2}`} fill="none" stroke={INK} strokeWidth={0.9} strokeLinecap="round" />;
      break;
    case 'worried':
    case 'sad':
      mouth = <path d={`M-2.3 ${m + 0.6} Q0 ${m - 1.2} 2.3 ${m + 0.6}`} fill="none" stroke={INK} strokeWidth={0.9} strokeLinecap="round" />;
      break;
    case 'shocked':
      mouth = <ellipse cx={0} cy={m} rx={1.2} ry={1.5} fill={INK} />;
      break;
    default:
      mouth = <path d={`M-1.9 ${m} h3.8`} stroke={INK} strokeWidth={0.9} strokeLinecap="round" />;
  }
  const by = cy - 3.3;
  const brows =
    expression === 'worried' || expression === 'sad' ? (
      <path d={`M-4 ${by + 0.6} L-1.4 ${by - 0.3} M4 ${by + 0.6} L1.4 ${by - 0.3}`} stroke={INK} strokeWidth={0.8} strokeLinecap="round" />
    ) : expression === 'determined' ? (
      <path d={`M-4 ${by - 0.4} L-1.3 ${by + 0.6} M4 ${by - 0.4} L1.3 ${by + 0.6}`} stroke={INK} strokeWidth={0.9} strokeLinecap="round" />
    ) : expression === 'shocked' ? (
      <path d={`M-4 ${by - 0.8} q1.3 -1 2.6 0 M1.4 ${by - 0.8} q1.3 -1 2.6 0`} fill="none" stroke={INK} strokeWidth={0.8} strokeLinecap="round" />
    ) : null;
  return (
    <g>
      {eyes}
      {brows}
      {mouth}
    </g>
  );
}

function Hair({ hair, color, accent, cy }: { hair: string; color: string; accent: string; cy: number }) {
  const top = cy - 7.6;
  switch (hair) {
    case 'none':
      return null;
    case 'buzz':
      return <path d={`M-7.4 ${cy - 1} A7.5 7.5 0 0 1 7.4 ${cy - 1} Q0 ${cy - 4.5} -7.4 ${cy - 1}Z`} fill={color} opacity={0.55} />;
    case 'long':
      return (
        <g fill={color}>
          <path d={`M-7.8 ${cy} A7.8 7.8 0 0 1 7.8 ${cy} Q0 ${cy - 5} -7.8 ${cy}Z`} />
          <rect x={-8.6} y={cy - 2} width={3.2} height={10.5} rx={1.6} />
          <rect x={5.4} y={cy - 2} width={3.2} height={10.5} rx={1.6} />
        </g>
      );
    case 'bun':
      return (
        <g fill={color}>
          <path d={`M-7.6 ${cy - 0.6} A7.6 7.6 0 0 1 7.6 ${cy - 0.6} Q0 ${cy - 4.6} -7.6 ${cy - 0.6}Z`} />
          <circle cx={0} cy={top - 2.2} r={3.2} />
        </g>
      );
    case 'ponytail':
      return (
        <g fill={color}>
          <path d={`M-7.6 ${cy - 0.6} A7.6 7.6 0 0 1 7.6 ${cy - 0.6} Q0 ${cy - 4.6} -7.6 ${cy - 0.6}Z`} />
          <ellipse cx={8.4} cy={cy + 1.5} rx={2.2} ry={4.6} />
        </g>
      );
    case 'cap':
      return (
        <g fill={accent}>
          <path d={`M-7.9 ${cy - 1} A7.9 7.9 0 0 1 7.9 ${cy - 1}Z`} />
          <rect x={1} y={cy - 2.2} width={10.5} height={2.2} rx={1.1} />
        </g>
      );
    case 'beanie':
      return (
        <g fill={accent}>
          <path d={`M-8 ${cy - 0.4} A8 8 0 0 1 8 ${cy - 0.4}Z`} />
          <rect x={-8.2} y={cy - 2.4} width={16.4} height={2.6} rx={1.2} />
          <circle cx={0} cy={top - 1} r={2} />
        </g>
      );
    case 'hijab':
      return (
        <path
          d={`M0 ${top - 1.2} C-9.5 ${top - 1.2} -10.4 ${cy + 5} -9.6 ${cy + 9.5} L9.6 ${cy + 9.5} C10.4 ${cy + 5} 9.5 ${top - 1.2} 0 ${top - 1.2}Z`}
          fill={accent}
        />
      );
    case 'curly':
      return (
        <g fill={color}>
          {[-6, -3, 0, 3, 6].map((x) => (
            <circle key={x} cx={x} cy={top + 1.6 + Math.abs(x) * 0.25} r={2.9} />
          ))}
        </g>
      );
    case 'puffs':
      return (
        <g fill={color}>
          <path d={`M-7.6 ${cy - 0.6} A7.6 7.6 0 0 1 7.6 ${cy - 0.6} Q0 ${cy - 4.6} -7.6 ${cy - 0.6}Z`} />
          <circle cx={-6.8} cy={top + 0.6} r={3.2} />
          <circle cx={6.8} cy={top + 0.6} r={3.2} />
        </g>
      );
    case 'spiky':
      return <path d={`M-7.6 ${cy - 0.5} L-6 ${top - 2} L-3 ${top} L0 ${top - 3} L3 ${top} L6 ${top - 2} L7.6 ${cy - 0.5} Q0 ${cy - 4} -7.6 ${cy - 0.5}Z`} fill={color} />;
    default:
      return <path d={`M-7.6 ${cy - 0.6} A7.6 7.6 0 0 1 7.6 ${cy - 0.6} Q0 ${cy - 4.6} -7.6 ${cy - 0.6}Z`} fill={color} />;
  }
}

export interface BeanGlyphProps {
  x: number;
  y: number;
  /** Height of a standing bean in viewBox units. */
  height: number;
  look: CastMember['look'] & { skin?: string; hairColor?: string };
  seed: string;
  pose: GlyphPose;
  expression: GlyphExpression;
  highlighted?: boolean;
  /** Speaking now (live): a small speech bubble. */
  speaking?: boolean;
  /** A message just landed on their phone: the screen glows. */
  phoneGlow?: boolean;
}

/** A bean in the Flat View: capsule body, round head, hair silhouette and one of eight faces. */
export function BeanGlyph({ x, y, height, look, seed, pose, expression, highlighted, speaking, phoneGlow }: BeanGlyphProps) {
  const s = height / 36;
  const skin = look.skin ?? pick(SKIN_TONES, `${seed}:skin`);
  const hairColor = look.hairColor ?? pick(HAIR_COLORS, `${seed}:hair`);
  const sit = pose === 'sit';
  const curl = pose === 'curl-up';
  const drop = sit ? 6 : curl ? 12 : 0;
  const headY = -30 + drop + (pose === 'phone' ? 0.8 : 0);
  const lean = pose === 'lean' ? 7 : 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={9.5} ry={2.4} fill={INK} opacity={0.25} />
      {highlighted && <ellipse cx={0} cy={0} rx={12} ry={3.4} fill="none" stroke="#f2c14e" strokeWidth={1.8} />}
      <g transform={lean ? `rotate(${lean})` : undefined}>
        {/* Legs */}
        {curl ? null : sit ? (
          <g fill={look.accent}>
            <rect x={-6} y={-6} width={5} height={6} rx={2} />
            <rect x={1} y={-6} width={5} height={6} rx={2} />
          </g>
        ) : pose === 'walk' ? (
          <g fill={look.accent}>
            <rect x={-5} y={-11} width={4.2} height={11} rx={2} transform="rotate(14 -3 -11)" />
            <rect x={1} y={-11} width={4.2} height={11} rx={2} transform="rotate(-14 3 -11)" />
          </g>
        ) : (
          <g fill={look.accent}>
            <rect x={-5.2} y={-11} width={4.4} height={11} rx={2} />
            <rect x={0.8} y={-11} width={4.4} height={11} rx={2} />
          </g>
        )}
        {/* Body */}
        {curl ? (
          <ellipse cx={0} cy={-8} rx={10} ry={8} fill={look.body} />
        ) : (
          <rect x={-8} y={-26 + drop} width={16} height={18} rx={7} fill={look.body} />
        )}
        {/* Arms */}
        {pose === 'open-arms' ? (
          <g stroke={look.body} strokeWidth={3.4} strokeLinecap="round">
            <path d={`M-7 ${-21 + drop} L-13 ${-27 + drop}`} />
            <path d={`M7 ${-21 + drop} L13 ${-27 + drop}`} />
          </g>
        ) : pose === 'arms-crossed' ? (
          <rect x={-8.6} y={-20 + drop} width={17.2} height={4.4} rx={2.2} fill={look.accent} opacity={0.9} />
        ) : pose === 'phone' ? (
          <g>
            <path d={`M-7 ${-21} Q-6 -15 -2 -16 M7 ${-21} Q6 -15 2 -16`} fill="none" stroke={look.body} strokeWidth={3.2} strokeLinecap="round" />
            <rect x={-2.6} y={-20.5} width={5.2} height={7.4} rx={1} fill={INK} />
            <rect x={-1.8} y={-19.7} width={3.6} height={5.4} rx={0.6} fill={phoneGlow ? '#e8f6ff' : '#7fb2e6'} />
            {phoneGlow && <circle cx={0} cy={-17} r={6} fill="#bfe3ff" opacity={0.35} />}
          </g>
        ) : curl ? null : (
          <g fill={look.body}>
            <rect x={-10.4} y={-24 + drop} width={3.4} height={11} rx={1.7} />
            <rect x={7} y={-24 + drop} width={3.4} height={11} rx={1.7} />
          </g>
        )}
        {/* Head, hair, face */}
        {look.hair === 'hijab' && <Hair hair="hijab" color={hairColor} accent={look.accent} cy={headY} />}
        <circle cx={0} cy={headY} r={7.4} fill={skin} />
        {look.hair !== 'hijab' && <Hair hair={look.hair ?? 'short'} color={hairColor} accent={look.accent} cy={headY} />}
        <Face expression={expression} cy={headY + 0.6} />
      </g>
      {speaking && (
        <g transform={`translate(9 ${headY - 9})`}>
          <path d="M0 0 h12 a3 3 0 0 1 3 3 v4 a3 3 0 0 1 -3 3 h-7 l-3 3 v-3 h-2 a3 3 0 0 1 -3 -3 v-4 a3 3 0 0 1 3 -3z" fill="#f4efe6" stroke={INK} strokeWidth={0.7} />
          {[2.8, 6.4, 10].map((cx) => (
            <circle key={cx} cx={cx} cy={5} r={1} fill={INK} />
          ))}
        </g>
      )}
    </g>
  );
}

/** The faceless silhouette: no face, no hair, no clothing cues (GAME_DESIGN.md §4.4). */
export function FacelessGlyph({ x, y, height, highlighted, opacity = 0.88 }: { x: number; y: number; height: number; highlighted?: boolean; opacity?: number }) {
  const s = height / 36;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={9} ry={2.2} fill={INK} opacity={0.22} />
      <g fill="#6e6a86" opacity={opacity}>
        <path d="M-6.5 0 L-7.5 -18 Q-9 -26 -4 -27 L4 -27 Q9 -26 7.5 -18 L6.5 0Z" />
        <ellipse cx={0} cy={-32.5} rx={5.2} ry={5.8} />
      </g>
      {highlighted && <path d="M-6.5 0 L-7.5 -18 Q-9 -26 -4 -27 L4 -27 Q9 -26 7.5 -18 L6.5 0Z" fill="none" stroke="#f2c14e" strokeWidth={1.4} />}
    </g>
  );
}

/** The lit window where the hidden influence stands: `x, y` is the centre-bottom of the pane. */
export function InfluenceWindowGlyph({ x, y, height, revealed }: { x: number; y: number; height: number; revealed: boolean }) {
  const w = height * 0.82;
  const h = height * 0.78;
  return (
    <g>
      <rect x={x - w / 2 - 3} y={y - h - 3} width={w + 6} height={h + 6} fill="#4a4670" rx={1.5} />
      <rect x={x - w / 2} y={y - h} width={w} height={h} fill="#ffd58a" />
      {revealed && <rect x={x - w / 2 - 3} y={y - h - 3} width={w + 6} height={h + 6} fill="none" stroke="#f2c14e" strokeWidth={2} rx={1.5} />}
      <g fill="#6e6a86" opacity={0.92}>
        <path d={`M${x - w * 0.3} ${y} Q${x - w * 0.32} ${y - h * 0.42} ${x} ${y - h * 0.44} Q${x + w * 0.32} ${y - h * 0.42} ${x + w * 0.3} ${y}Z`} />
        <ellipse cx={x} cy={y - h * 0.62} rx={w * 0.15} ry={h * 0.17} />
      </g>
      <path d={`M${x - w / 2} ${y - h} l${w * 0.22} ${h * 0.12} v${h * 0.78} l${-w * 0.22} ${h * 0.1}Z`} fill="#c98ba0" opacity={0.85} />
      <path d={`M${x + w / 2} ${y - h} l${-w * 0.22} ${h * 0.12} v${h * 0.78} l${w * 0.22} ${h * 0.1}Z`} fill="#c98ba0" opacity={0.85} />
    </g>
  );
}

/** A tactic bead on the string: coin (gain), clock (urgency), crowd (social proof), badge (authority), link. */
export function BeadGlyph({ x, y, r, bead }: { x: number; y: number; r: number; bead: ThreadBead }) {
  const k = r / 6;
  let icon;
  switch (bead) {
    case 'coin':
      icon = (
        <g>
          <circle r={3.6} fill="#f2c14e" stroke={INK} strokeWidth={0.7} />
          <path d="M1.3 -1.5 Q0 -2.4 -1.2 -1.6 Q-1.9 -0.6 0 0 Q1.9 0.6 1.2 1.6 Q0 2.4 -1.3 1.5" fill="none" stroke={INK} strokeWidth={0.8} strokeLinecap="round" />
        </g>
      );
      break;
    case 'clock':
      icon = (
        <g fill="none" stroke={INK} strokeWidth={0.9} strokeLinecap="round">
          <circle r={3.4} />
          <path d="M0 0 v-2.2 M0 0 l1.6 1" />
        </g>
      );
      break;
    case 'crowd':
      icon = (
        <g fill={INK}>
          <circle cx={-2.4} cy={-0.6} r={1.2} />
          <circle cx={0} cy={-1.4} r={1.3} />
          <circle cx={2.4} cy={-0.6} r={1.2} />
          <path d="M-4 3 q1.6 -3 3.2 0 M-1.6 2.6 q1.6 -3.4 3.2 0 M0.8 3 q1.6 -3 3.2 0" />
        </g>
      );
      break;
    case 'badge':
      icon = <path d="M0 -3.6 l3 1.2 v2.2 c0 2 -1.3 3.4 -3 4 c-1.7 -0.6 -3 -2 -3 -4 v-2.2z" fill={INK} />;
      break;
    default:
      icon = (
        <g fill="none" stroke={INK} strokeWidth={0.9}>
          <rect x={-3.8} y={-1.4} width={4} height={2.8} rx={1.4} />
          <rect x={-0.2} y={-1.4} width={4} height={2.8} rx={1.4} />
        </g>
      );
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <circle r={6} fill="#f4efe6" stroke="#f2c14e" strokeWidth={1.4} />
      {icon}
    </g>
  );
}
