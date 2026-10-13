// Flat View of a mission scene (GAME_DESIGN.md §4.8): a first-class 2D twin of the 3D MissionScene, built from
// the same scene data at runtime. The set's SVG drawing scaled to fit, the cast as bean glyphs, clue hotspots as
// real buttons, the Hold look (colour drains to still-blue, rain hangs as beads), the influence string to a
// faceless figure in a lit window, and the scene mood. No WebGL and no three.js: this ships in the app shell and
// is also the screen-reader path, the loading state and the fallback after WebGL context losses.
import { useId, useMemo, type CSSProperties } from 'react';
import type { MissionSceneProps } from '../contracts';
import { StatusShape } from '../../ui/StatusBadge';
import { SETS } from '../scenes/sets';
import { castExpression, castPose, placeCast, threadBeads, type CastPlacement } from '../scenes/core/cast';
import { describeScene } from '../scenes/core/describe';
import { pendingCards, placeHotspots } from '../scenes/core/director';
import { project } from '../scenes/core/flat';
import { BeadGlyph, BeanGlyph, FacelessGlyph, InfluenceWindowGlyph } from '../scenes/core/glyphs';
import { stagingOf, type FlatRect, type FlatTwin } from '../scenes/core/staging';
import '../scenes/core/flat-view.css';

type Pt = { x: number; y: number };

const MOOD_TINT: Record<MissionSceneProps['mood'], { color: string; opacity: number }> = {
  neutral: { color: 'transparent', opacity: 0 },
  tense: { color: '#ff4d8d', opacity: 0.1 },
  warm: { color: '#f2c14e', opacity: 0.14 },
  sober: { color: '#2a2f6b', opacity: 0.2 },
  shiny: { color: '#8a6cf0', opacity: 0.12 },
};

const STATE_WORD: Record<'available' | 'found-flag' | 'found-ok', string> = {
  available: 'Look',
  'found-flag': 'Red flag',
  'found-ok': 'Looks OK',
};

function hotspotName(state: 'available' | 'found-flag' | 'found-ok', label: string): string {
  if (state === 'found-flag') return `${label}: flagged as a warning sign`;
  if (state === 'found-ok') return `${label}: checked, looks safe`;
  return `Inspect ${label} (not checked yet)`;
}

/** Deterministic drop positions (same rain on every device). */
function drops(rects: readonly FlatRect[], seed: string, max = 140): { x: number; y: number; r: number }[] {
  const area = rects.reduce((a, r) => a + r.w * r.h, 0);
  if (area <= 0) return [];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 4294967296;
  };
  const out: { x: number; y: number; r: number }[] = [];
  for (const rect of rects) {
    const n = Math.round((max * rect.w * rect.h) / area);
    for (let i = 0; i < n; i++) out.push({ x: rect.x + rand() * rect.w, y: rect.y + rand() * rect.h, r: 0.7 + rand() * 0.8 });
  }
  return out;
}

function MarkerIcon({ state }: { state: 'available' | 'found-flag' | 'found-ok' }) {
  if (state === 'found-flag') return <StatusShape status="risk" size={30} />;
  if (state === 'found-ok') return <StatusShape status="safe" size={30} />;
  return (
    <svg viewBox="0 0 24 24" width={30} height={30} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" fill="rgba(20,32,51,.72)" stroke="var(--attention)" strokeWidth="2" strokeDasharray="3 2.4" />
      <circle cx="10.6" cy="10.6" r="4" fill="none" stroke="#f4efe6" strokeWidth="2" />
      <path d="M13.6 13.6l3.4 3.4" stroke="#f4efe6" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Flat View twin of MissionScene. Same props minus `quality`; fully usable without WebGL. */
export function MissionScene2D(props: Omit<MissionSceneProps, 'quality'>) {
  const { mission, mode, t, hotspots, onHotspot, thread, mood, focusCast } = props;
  const set = SETS[mission.scene];
  const staging = stagingOf(set);
  const twin = set.flat as FlatTwin;
  const fs = twin.staging ?? {};
  const [vx, vy, vw, vh] = twin.viewBox.split(/[\s,]+/).map(Number) as [number, number, number, number];
  const beanH = fs.beanHeight ?? vh * 0.12;
  const uid = useId().replace(/:/g, '');
  const frozen = mode === 'frozen';
  const interactive = (mode === 'frozen' || mode === 'live') && Boolean(onHotspot);

  const placements = useMemo(() => placeCast(mission, set.anchors, staging.seats), [mission, set.anchors, staging.seats]);
  const pending = pendingCards(mission, t, mode);
  const label = useMemo(() => {
    const parts = [describeScene({ mission, setName: set.name, anchors: set.anchors, seats: staging.seats, mode, mood, thread, rain: fs.rain !== false })];
    if (staging.labels && staging.labels.length > 0) parts.push(`Signs: ${staging.labels.map((l) => l.text).join(', ')}.`);
    if (pending > 0) parts.push(`${pending === 1 ? 'One more message is' : `${pending} more messages are`} on the way.`);
    return parts.join(' ');
  }, [mission, set, staging.seats, staging.labels, mode, mood, thread, fs.rain, pending]);

  /** Feet point of a placement: exact projection when the set provides one, else its flat anchor (+ spread). */
  const posOf = useMemo(() => {
    const spreads = new Map<string, number>();
    return (p: CastPlacement): Pt => {
      if (fs.oblique) {
        const [x, y] = project(fs.oblique, p.position);
        return { x, y };
      }
      const seat = !p.seated ? fs.seats?.[p.anchor] : undefined;
      const a = seat ?? twin.anchors[p.anchor] ?? { x: vw / 2, y: vh * 0.7 };
      const i = spreads.get(p.member.id) ?? placements.filter((q) => q.anchor === p.anchor).indexOf(p);
      spreads.set(p.member.id, i);
      const side = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2) * beanH * 0.5;
      return { x: a.x + side, y: a.y };
    };
  }, [fs.oblique, fs.seats, twin.anchors, placements, vw, vh, beanH]);

  const chestOf = (p: CastPlacement): Pt => {
    const f = posOf(p);
    return { x: f.x, y: f.y - beanH * (p.kind === 'faceless' ? 0.62 : p.seated ? 0.45 : 0.55) };
  };

  // Hotspot markers: projected anchor + hotspotOffset when known, else above the anchor; shared anchors spread.
  const spots = useMemo(() => {
    const placed = placeHotspots(hotspots, set.anchors);
    const count = new Map<string, number>();
    for (const h of placed) count.set(h.anchor, (count.get(h.anchor) ?? 0) + 1);
    const seen = new Map<string, number>();
    return placed.map((h) => {
      const n = count.get(h.anchor) ?? 1;
      const i = seen.get(h.anchor) ?? 0;
      seen.set(h.anchor, i + 1);
      const base = fs.hotspots?.[h.anchor] ?? (twin.anchors[h.anchor] ? { x: twin.anchors[h.anchor]!.x, y: twin.anchors[h.anchor]!.y - beanH * 1.15 } : { x: vw / 2, y: vh / 2 });
      const dx = n > 1 ? (i - (n - 1) / 2) * Math.max(beanH * 0.75, vw * 0.075) : 0;
      return { ...h, state: h.state as 'available' | 'found-flag' | 'found-ok', x: base.x + dx, y: base.y };
    });
  }, [hotspots, set.anchors, fs.hotspots, twin.anchors, beanH, vw, vh]);

  // The influence string and its window.
  const resident = placements.find((p) => p.isResident) ?? null;
  const infl: Pt = fs.influence ?? { x: vx + vw * 0.86, y: vy + vh * 0.24 };
  const threadPath = useMemo(() => {
    if (!thread) return null;
    const who = placements.find((p) => p.member.id === thread.from) ?? resident;
    if (!who) return null;
    const a = chestOf(who);
    const b = { x: infl.x, y: infl.y - beanH * 0.42 };
    const sag = thread.revealed ? beanH * 0.08 : beanH * 0.95;
    const c = { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + sag };
    const at = (k: number): Pt => ({
      x: (1 - k) * (1 - k) * a.x + 2 * (1 - k) * k * c.x + k * k * b.x,
      y: (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * c.y + k * k * b.y,
    });
    return { d: `M${a.x} ${a.y} Q${c.x} ${c.y} ${b.x} ${b.y}`, at, fromId: who.member.id };
    // posOf/chestOf derive from the memoised staging above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread, placements, resident, infl.x, infl.y, beanH, posOf]);
  const beads = useMemo(() => threadBeads(mission), [mission]);

  const rainRects: FlatRect[] = fs.rain === false ? [] : fs.rain === undefined ? [{ x: vx, y: vy, w: vw, h: vh }] : Array.isArray(fs.rain) ? [...(fs.rain as readonly FlatRect[])] : [fs.rain as FlatRect];
  const rain = useMemo(() => drops(rainRects, `${mission.id}:${set.id}`, mission.timeOfDay === 'evening' || mission.timeOfDay === 'night' ? 140 : 80), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(rainRects),
    mission.id,
    set.id,
    mission.timeOfDay,
  ]);

  const speaker = mode === 'live' && focusCast ? focusCast : null;
  const sorted = [...placements].sort((a, b) => posOf(a).y - posOf(b).y);
  const tint = MOOD_TINT[mood];
  const Draw = twin.Draw;
  const style = { '--w-flat-ar': `${vw / vh}`, '--w-flat-fall': `${vh}px` } as CSSProperties;
  const pct = (p: Pt): CSSProperties => ({ left: `${((p.x - vx) / vw) * 100}%`, top: `${((p.y - vy) / vh) * 100}%` });

  const glyph = (p: CastPlacement) => {
    const at = posOf(p);
    if (p.kind === 'faceless') {
      return <FacelessGlyph key={p.member.id} x={at.x} y={at.y} height={beanH * 1.1} highlighted={Boolean(thread?.revealed && threadPath?.fromId === p.member.id)} />;
    }
    return (
      <BeanGlyph
        key={p.member.id}
        x={at.x}
        y={at.y}
        height={beanH}
        look={p.member.look}
        seed={p.member.id}
        pose={castPose(p, mood, mode)}
        expression={castExpression(p.member.role, mood, mode, p.isResident)}
        highlighted={Boolean(thread && threadPath?.fromId === p.member.id)}
        speaking={speaker === p.member.id && !p.isResident}
        phoneGlow={speaker === p.member.id && p.isResident}
      />
    );
  };

  // While held, the resident keeps their colour (drawn outside the drained layer).
  const drained = frozen ? sorted.filter((p) => !p.isResident) : sorted;
  const warm = frozen ? sorted.filter((p) => p.isResident) : [];
  const phone = resident ? chestOf(resident) : null;

  return (
    <div className="w-flat" data-mode={mode} data-mood={mood} style={style}>
      <div className="w-flat__frame">
        <svg className="w-flat__svg" viewBox={twin.viewBox} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id={`${uid}-still`} colorInterpolationFilters="sRGB">
              <feColorMatrix type="saturate" values="0.12" />
            </filter>
            <clipPath id={`${uid}-clip`}>
              <rect x={vx} y={vy} width={vw} height={vh} rx={0} />
            </clipPath>
            <clipPath id={`${uid}-rain`}>
              {rainRects.map((r, i) => (
                <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />
              ))}
            </clipPath>
          </defs>
          <g clipPath={`url(#${uid}-clip)`}>
            <g filter={frozen ? `url(#${uid}-still)` : undefined}>
              <Draw timeOfDay={mission.timeOfDay} />
              {drained.map(glyph)}
            </g>
            <rect className="w-flat__still" x={vx} y={vy} width={vw} height={vh} />
            {tint.opacity > 0 && <rect x={vx} y={vy} width={vw} height={vh} fill={tint.color} opacity={tint.opacity} />}
            {warm.map(glyph)}
            {/* Rain: falling streaks while time runs, beads of light hanging in the air while it is held. */}
            {rain.length > 0 &&
              (frozen ? (
                <g className="w-flat__beads">
                  {rain.map((d, i) => (
                    <circle key={i} cx={d.x} cy={d.y} r={d.r * 1.15} fill="#cfe8ff" opacity={0.92} />
                  ))}
                </g>
              ) : (
                <g className="w-flat__rain" clipPath={`url(#${uid}-rain)`}>
                  <g className="w-flat__drops">
                    {rain.map((d, i) => (
                      <line key={i} x1={d.x} y1={d.y - 10} x2={d.x - 1.4} y2={d.y - 10 + 5 + d.r * 2} stroke="#cfe8ff" strokeWidth={0.7} opacity={0.5} />
                    ))}
                    {rain.map((d, i) => (
                      <line key={`b${i}`} x1={d.x} y1={d.y - 10 - vh} x2={d.x - 1.4} y2={d.y - 10 - vh + 5 + d.r * 2} stroke="#cfe8ff" strokeWidth={0.7} opacity={0.5} />
                    ))}
                  </g>
                </g>
              ))}
            {/* Unarrived messages hang as blank paper cards above the resident's phone while time is held. */}
            {phone &&
              Array.from({ length: pending }, (_, i) => (
                <g key={i} transform={`translate(${phone.x + beanH * (0.35 + i * 0.3)} ${phone.y - beanH * (0.5 + i * 0.32)}) rotate(${i % 2 === 0 ? -6 : 5})`}>
                  <rect x={-beanH * 0.2} y={-beanH * 0.13} width={beanH * 0.4} height={beanH * 0.26} rx={beanH * 0.04} fill="#f8f4ec" stroke="#c9c3d6" strokeWidth={0.6} />
                  <rect x={-beanH * 0.13} y={-beanH * 0.05} width={beanH * 0.22} height={beanH * 0.025} fill="#c9c3d6" />
                  <rect x={-beanH * 0.13} y={beanH * 0.02} width={beanH * 0.15} height={beanH * 0.025} fill="#c9c3d6" />
                </g>
              ))}
            {/* Identify the Influence: a string from the cast member to a faceless figure in a lit window. */}
            {thread && threadPath && (
              <g className="w-flat__thread" data-revealed={thread.revealed ? '' : undefined}>
                <InfluenceWindowGlyph x={infl.x} y={infl.y} height={beanH} revealed={thread.revealed} />
                <path d={threadPath.d} fill="none" stroke="#f2c14e" strokeWidth={thread.revealed ? 5 : 3.5} opacity={0.3} strokeLinecap="round" />
                <path
                  d={threadPath.d}
                  fill="none"
                  stroke="#f2c14e"
                  strokeWidth={thread.revealed ? 2 : 1.6}
                  strokeDasharray={thread.revealed ? undefined : '5 4'}
                  strokeLinecap="round"
                />
                {beads.map((bead, i) => {
                  const p = threadPath.at((i + 1) / (beads.length + 1));
                  return <BeadGlyph key={bead} x={p.x} y={p.y} r={Math.min(7.5, beanH * 0.17)} bead={bead} />;
                })}
              </g>
            )}
          </g>
        </svg>
        {spots.length > 0 && (
          <ul className="w-flat__spots" aria-label={interactive ? 'Things to inspect in the scene' : undefined} aria-hidden={interactive ? undefined : true}>
            {spots.map((h) => (
              <li key={h.clueId} className="w-flat__spot" style={pct(h)}>
                {interactive ? (
                  <button type="button" className="w-flat__spot-btn" data-state={h.state} aria-label={hotspotName(h.state, h.label)} onClick={() => onHotspot?.(h.clueId)}>
                    <MarkerIcon state={h.state} />
                    <span className="w-flat__spot-word" aria-hidden="true">
                      {STATE_WORD[h.state]}
                    </span>
                  </button>
                ) : (
                  <span className="w-flat__spot-btn" data-state={h.state}>
                    <MarkerIcon state={h.state} />
                    {h.state !== 'available' && <span className="w-flat__spot-word">{STATE_WORD[h.state]}</span>}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {fs.oblique && staging.labels && staging.labels.length > 0 && (
          <div className="w-flat__signs" aria-hidden="true">
            {staging.labels.map((l, i) => {
              const [x, y] = project(fs.oblique!, l.position);
              return (
                <span key={`${l.text}${i}`} className={`w-flat__sign${l.size === 'small' ? ' w-flat__sign--small' : ''}`} style={pct({ x, y })}>
                  {l.text}
                </span>
              );
            })}
          </div>
        )}
        <div className="w-flat__names" aria-hidden="true">
          {placements
            .filter((p) => p.kind === 'bean')
            .map((p) => (
              <span key={p.member.id} className="w-flat__name" data-resident={p.isResident ? '' : undefined} style={pct(posOf(p))}>
                {p.member.name}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
