// Pure helpers for the Big Screen (projector). No DOM, no store.
// Everything here is room- or squad-level and positive: the projector never shows an individual,
// a ranking, a choice or a risky split (GDD §7.3, §11.12).

import {
  SHIELD_SLOT_ORDER,
  SQUAD_TOTEMS,
  districtById,
  guardianById,
  missionById,
  phaseIndex,
  type DebriefView,
  type LiveBeat,
  type MissionTimeline,
  type Mission,
  type ScreenSnapshot,
  type ScreenSquad,
  type ShieldLine,
  type SquadMissionPhase,
  type SquadTotemId,
} from '@shieldquest/shared';
import type { Lantern, MissionMarker } from '../../world';
import { castName, sortedBeats } from '../../game/mission/runLogic';
import { SCREEN_CAPTION, lanternCount, unquote } from '../logic';

// ---------------------------------------------------------------------------------------------
// Where the room is

/**
 * The phase the room as a whole is in: the least advanced squad still playing. The synced phases
 * (Aftershock slot, Role Flip, Live) come from the shared timeline when no squad has a phase yet.
 */
export function roomPhase(snap: Pick<ScreenSnapshot, 'session' | 'squads'>, now: number): SquadMissionPhase | null {
  const { session, squads } = snap;
  if (session.phase !== 'mission' || session.missionComplete) return null;
  let least: SquadMissionPhase | null = null;
  for (const s of squads) {
    if (s.phase === null || s.complete) continue;
    if (least === null || phaseIndex(s.phase) < phaseIndex(least)) least = s.phase;
  }
  if (least) return least;
  return timelinePhase(session.timeline, session.pausedAt ?? now);
}

export function timelinePhase(tl: MissionTimeline | null, at: number): SquadMissionPhase | null {
  if (!tl) return null;
  if (at < tl.roleFlipAt) return 'aftershock';
  if (at < tl.liveAt) return 'role-flip';
  if (at < tl.liveEndsAt) return 'live';
  return 'investigate';
}

/** The shared room clock for the synced phases (and Freeze End), or null when squads run their own timers. */
export function roomDeadline(tl: MissionTimeline | null, phase: SquadMissionPhase | null): { endsAt: number; label: string } | null {
  if (!tl || !phase) return null;
  switch (phase) {
    case 'aftershock':
      return { endsAt: tl.roleFlipAt, label: 'until Role Flip' };
    case 'role-flip':
      return { endsAt: tl.liveAt, label: 'until Live' };
    case 'live':
      return { endsAt: tl.liveEndsAt, label: 'left in Live' };
    case 'investigate':
      return { endsAt: tl.freezeEndAt, label: 'until Freeze End' };
    default:
      return null;
  }
}

export const SCREEN_PHASE_TITLE: Record<SquadMissionPhase, string> = {
  aftershock: 'Something is still in motion',
  'role-flip': 'Roles flip',
  live: 'Live',
  investigate: 'Time is held',
  think: 'Seal Wall',
  reveal: 'Seals open',
  explain: 'Talk it out',
  reseal: 'Keep or change',
  release: 'The city will remember this',
  shield: 'Peer Shield',
  bond: 'Phones down',
};

// ---------------------------------------------------------------------------------------------
// Captions (two lines, >= 40 px on the projector)

/** The newest live line, as a caption: "Dev: bro just do it" (narrator lines are plain scene text). */
export function liveCaption(mission: Mission, t: number): string | null {
  let last: LiveBeat | null = null;
  for (const b of sortedBeats(mission)) if (b.at <= t) last = b;
  if (!last) return null;
  if (last.from === 'narrator' || last.channel === 'scene') return last.text;
  return `${castName(mission, last.from)}: ${last.text}`;
}

export function missionCaption(phase: SquadMissionPhase, mission: Mission | undefined, t: number): string {
  if (phase === 'live' && mission) return liveCaption(mission, t) ?? 'Watch closely. Messages are arriving on every phone.';
  return SCREEN_CAPTION[phase];
}

// ---------------------------------------------------------------------------------------------
// Squad towers (counts only, fixed totem order, never ranked)

export interface LaneView {
  /** Short status line, e.g. "3/5 holding" or "Hornbill decided". */
  status: string;
  /** Segments: frost for holds, lanterns for seals. */
  meter: { filled: number; total: number; kind: 'frost' | 'lantern' } | null;
  /** The lantern beam: the squad decided (never what). */
  beam: boolean;
  /** Per-squad timer (Explain, Re-seal…), or null. */
  endsAt: number | null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function laneView(sq: ScreenSquad, sessionPhase: ScreenSnapshot['session']['phase']): LaneView {
  const base: LaneView = { status: '', meter: null, beam: sq.decided, endsAt: null };
  if (sessionPhase !== 'mission' || sq.phase === null) {
    return { ...base, beam: false, status: plural(sq.connected, 'phone in', 'phones in'), meter: null };
  }
  if (sq.complete) {
    const g = sq.guardians.length > 0 ? ` · ${sq.guardians.map((id) => guardianById(id).name).join(', ')}` : '';
    return { ...base, status: `Phones down${g}` };
  }
  const total = Math.max(sq.connected, sq.sealed.total, sq.holding, 1);
  switch (sq.phase) {
    case 'aftershock':
      return { ...base, status: 'Something from earlier lands' };
    case 'role-flip':
      return { ...base, status: 'Reading role cards' };
    case 'live':
      return { ...base, status: `${sq.holding}/${total} holding`, meter: { filled: sq.holding, total, kind: 'frost' } };
    case 'investigate':
      return {
        ...base,
        status: sq.holding > 0 ? `${sq.holding}/${total} held · looking closely` : 'Looking closely',
        meter: { filled: sq.holding, total, kind: 'frost' },
        endsAt: sq.phaseEndsAt,
      };
    case 'think':
      return {
        ...base,
        status: `${sq.sealed.count} of ${sq.sealed.total} sealed`,
        meter: { filled: sq.sealed.count, total: Math.max(1, sq.sealed.total), kind: 'lantern' },
        endsAt: sq.phaseEndsAt,
      };
    case 'reveal':
      return {
        ...base,
        status: 'Seals open',
        meter: { filled: sq.sealed.count, total: Math.max(1, sq.sealed.total), kind: 'lantern' },
      };
    case 'explain':
      return { ...base, status: 'Talking it out', endsAt: sq.phaseEndsAt };
    case 'reseal':
      return sq.decided
        ? { ...base, status: `${sq.name} decided` }
        : {
            ...base,
            status: `${sq.sealed.count} of ${sq.sealed.total} re-sealed`,
            meter: { filled: sq.sealed.count, total: Math.max(1, sq.sealed.total), kind: 'lantern' },
            endsAt: sq.phaseEndsAt,
          };
    case 'release':
      return { ...base, status: sq.decided ? `${sq.name} decided` : 'Time starts again' };
    case 'shield':
      return { ...base, status: 'Building a message', endsAt: sq.phaseEndsAt };
    case 'bond':
      return {
        ...base,
        status: sq.guardians.length > 0 ? `With ${sq.guardians.map((id) => guardianById(id).name).join(', ')}` : 'Letters lighting up',
      };
  }
}

export const totemColor = (id: SquadTotemId): string => SQUAD_TOTEMS.find((t) => t.id === id)?.color ?? '#f2c14e';

/** Lanterns per squad tower for the city scene (only ever grows within a mission). */
export function screenLanterns(squads: readonly ScreenSquad[], sessionPhase: ScreenSnapshot['session']['phase']): Lantern[] {
  return squads.map((sq) => ({
    squadId: sq.id,
    color: totemColor(sq.id),
    count: sessionPhase === 'lobby' ? sq.connected : lanternCount(sq),
  }));
}

/** Session missions as city markers: played ones are done, the rest are new. */
export function sessionMarkers(snap: Pick<ScreenSnapshot, 'session'>): MissionMarker[] {
  const { session } = snap;
  const out: MissionMarker[] = [];
  session.missionIds.forEach((id, i) => {
    const m = missionById(id);
    if (!m) return;
    const played =
      session.missionIndex !== null && (i < session.missionIndex || (i === session.missionIndex && session.missionComplete));
    out.push({ missionId: id, district: m.district, state: played || session.phase === 'debrief' || session.phase === 'ended' ? 'done' : 'new' });
  });
  return out;
}

/**
 * District light for the city. Open projector mode only, and only upward (the City Pulse only ever
 * grows): the room's average Trust for the current district, never a single squad's.
 */
export function screenTrust(snap: Pick<ScreenSnapshot, 'session' | 'squads'>): Record<string, number> {
  const { session, squads } = snap;
  if (session.options.discreet || session.missionIndex === null) return {};
  const m = missionById(session.missionIds[session.missionIndex] ?? '');
  const values = squads.map((s) => s.trust).filter((v): v is number => typeof v === 'number');
  if (!m || values.length === 0) return {};
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return avg > 0 ? { [m.district]: Math.min(3, Math.round(avg * 10) / 10) } : {};
}

// ---------------------------------------------------------------------------------------------
// Look Up (between missions)

export function lookUpTeaser(snap: Pick<ScreenSnapshot, 'session'>): string | null {
  const { session } = snap;
  const nextIndex = session.missionIndex === null ? 0 : session.missionIndex + 1;
  const next = missionById(session.missionIds[nextIndex] ?? '');
  if (!next) return null;
  const district = districtById(next.district).name;
  // Missions 2-3 open with an Aftershock slot: a class-level teaser, never about a squad.
  return nextIndex > 0
    ? `Somewhere in ${district}, something from earlier is still in motion…`
    : `Mission ${nextIndex + 1} begins in ${district}.`;
}

// ---------------------------------------------------------------------------------------------
// Debrief frames (driven from the projector's keyboard or a presentation clicker)

export type DebriefFrame = 'fast-forward' | 'rewind' | 'flip' | 'minds' | 'clues' | 'forecasts' | 'shield-lines' | 'carry';

export const DEBRIEF_FRAME_TITLE: Record<DebriefFrame, string> = {
  'fast-forward': 'The Long Fast-Forward',
  rewind: 'The Rewind',
  flip: 'Flip the Board',
  minds: 'Stop Frame 1 · Minds changed',
  clues: 'Stop Frame 2 · What we noticed',
  forecasts: 'Stop Frame 3 · Seeing it coming',
  'shield-lines': 'Shield Lines Wall',
  carry: 'Carry it out',
};

export const DEBRIEF_FRAME_CAPTION: Record<DebriefFrame, string> = {
  'fast-forward': 'Two weeks pass in the city. Every seed lands. Watch your phones, then phones down.',
  rewind: 'Let’s rewind to the second before. Phones down, eyes up.',
  flip: 'Every pressure you felt was designed. It was never the resident’s fault.',
  minds: 'Changing your mind is thinking. Here is how the room moved towards safer.',
  clues: 'Signs seen live, and signs found once time was held.',
  forecasts: 'Before choosing, every squad sealed a forecast. Here is what came true.',
  'shield-lines': 'What would you actually say to a friend in this spot?',
  carry: 'Hold. Check. Tell someone you trust.',
};

export function debriefFrames(d: DebriefView | null): DebriefFrame[] {
  const frames: DebriefFrame[] = ['fast-forward', 'rewind', 'flip', 'minds'];
  if (d && d.missions.length > 0) frames.push('clues', 'forecasts');
  if (d && d.missions.some((m) => m.shieldLines.length > 0)) frames.push('shield-lines');
  frames.push('carry');
  return frames;
}

/** The red-flag clue the fewest squads pinned (Cluepaw pounces on it), or null. */
export function mostMissedClue(mission: Mission, clueFinds: Readonly<Record<string, number>>): { label: string; found: number } | null {
  const red = mission.clues.filter((c) => c.redFlag);
  if (red.length === 0) return null;
  const sorted = [...red].sort((a, b) => (clueFinds[a.id] ?? 0) - (clueFinds[b.id] ?? 0));
  const c = sorted[0]!;
  return { label: unquote(c.label), found: clueFinds[c.id] ?? 0 };
}

/** A Shield Line as readable text, in message order. Unknown tiles are skipped. */
export function shieldLineText(mission: Mission, line: Pick<ShieldLine, 'tiles'>): string {
  const ps = mission.peerShield;
  if (!ps) return '';
  return SHIELD_SLOT_ORDER.map((slot) => {
    const id = line.tiles[slot];
    return id ? ps.slots[slot].find((t) => t.id === id)?.text : undefined;
  })
    .filter((t): t is string => Boolean(t))
    .join(' ');
}
