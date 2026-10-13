// Pure helpers for the squad clients (phone, Conductor, Big Screen). No DOM, no store: easy to test.

import {
  MISSIONS,
  SQUAD_ROLES,
  TACTICS,
  missionById,
  phaseTiming,
  type BandId,
  type HostSnapshot,
  type LensId,
  type Mission,
  type MissionTimeline,
  type RoleAssignment,
  type ScreenSquad,
  type SessionPhase,
  type SquadMissionPhase,
  type SquadRoleId,
  type Tactic,
  type TacticId,
} from '@shieldquest/shared';
import { exitOrder, hashString, residentName, type ExitView } from '../game/mission/runLogic';
import type { IconName } from '../ui/Icon';
import { dashNextAction } from './dash/dashLogic';

// ---------------------------------------------------------------------------------------------
// Roles and lenses

export const ROLE_ICON: Record<SquadRoleId, IconName> = {
  'safety-lead': 'door',
  'evidence-checker': 'eye',
  'peer-supporter': 'heart',
  'influence-tracer': 'thread',
  'future-reader': 'clock',
};

export const LENS_NAME: Record<LensId, string> = {
  path: 'Path',
  clue: 'Clue',
  heart: 'Heart',
  thread: 'Thread',
  ripple: 'Ripple',
};

/** Role sentence starters for Explain (GDD §5.3 step 6): they give everyone a way into the talk. */
export const SENTENCE_STARTER: Record<SquadRoleId, string> = {
  'safety-lead': 'The safest way out that still works is…',
  'evidence-checker': 'We can’t check this ourselves, because…',
  'peer-supporter': 'If I were them right now, I’d feel…',
  'influence-tracer': 'The person pushing gains…',
  'future-reader': 'By next week, this could turn into…',
};

export const roleName = (id: SquadRoleId): string => SQUAD_ROLES.find((r) => r.id === id)?.name ?? id;
export const roleJob = (id: SquadRoleId): string => SQUAD_ROLES.find((r) => r.id === id)?.job ?? '';

export interface RoleCardView {
  name: string;
  job: string;
  lenses: string;
  letter: string;
  starter: string;
  shadow: boolean;
  /** Merged roles' names (after a small squad folds jobs together). */
  alsoCovers: string[];
}

/** What the Role Flip card shows: role, lens, letter, one-line job (GDD §6.6). */
export function roleCard(role: RoleAssignment): RoleCardView {
  const extra = role.covers.filter((r) => r !== role.role);
  return {
    name: role.shadow ? 'Shadow Clue' : roleName(role.role),
    job: role.shadow
      ? 'An extra pair of eyes: look for the clues others walk past, and ask "can we check this?"'
      : roleJob(role.role),
    lenses: role.lenses.map((l) => LENS_NAME[l]).join(', '),
    letter: role.letter,
    starter: SENTENCE_STARTER[role.role],
    shadow: role.shadow,
    alsoCovers: role.shadow ? [] : extra.map(roleName),
  };
}

// ---------------------------------------------------------------------------------------------
// Exits: the whole squad sees the same shuffled order, so "Exit B" means the same thing on every phone.

export const squadSeed = (code: string, squadId: string, missionId: string): number =>
  hashString(`${code}:${squadId}:${missionId}`);

export const squadExits = (mission: Mission, code: string, squadId: string): ExitView[] =>
  exitOrder(mission, squadSeed(code, squadId, mission.id));

// ---------------------------------------------------------------------------------------------
// Phases and time

export const PHASE_LABEL: Record<SquadMissionPhase, string> = {
  aftershock: 'Aftershock',
  'role-flip': 'Role Flip',
  live: 'Live',
  investigate: 'Investigate',
  think: 'Think and seal',
  reveal: 'Reveal',
  explain: 'Explain',
  reseal: 'Re-seal',
  release: 'Release',
  shield: 'Peer Shield',
  bond: 'Bond',
};

export const SESSION_PHASE_LABEL: Record<SessionPhase, string> = {
  lobby: 'Lobby',
  'room-freeze': 'Room Freeze',
  mission: 'Mission',
  debrief: 'Debrief',
  ended: 'Ended',
};

/** Big Screen caption per phase (never anything about a person or a split). */
export const SCREEN_CAPTION: Record<SquadMissionPhase, string> = {
  aftershock: 'Something from earlier is still in motion. Watch your phones.',
  'role-flip': 'Your roles are flipping. Read your card.',
  live: 'It’s happening live. Any phone can press HOLD.',
  investigate: 'Time is held. Look closely. Pin what feels wrong.',
  think: 'Think on your own first. Seal your vote.',
  reveal: 'Your squad’s seals are in. Split decisions are normal.',
  explain: 'Eyes up. Talk it out with your squad.',
  reseal: 'Keep your exit, or change it. Changing your mind is thinking.',
  release: 'Time starts again. The city will remember this.',
  shield: 'A friend needs help. Build the message together.',
  bond: 'Phones down. See what your squad unlocked.',
};

/** Conductor script prompts for the current phase (GDD §7.3 script panel). */
export const PHASE_SCRIPT: Record<SquadMissionPhase, string> = {
  aftershock: 'Let squads read their Aftershock. Ask: “Who saw this coming?” Telling someone is always the right late move.',
  'role-flip': 'Ask each squad to read their role card out loud, one line each.',
  live: 'Stay quiet. Let the pressure land. Holding early is the skill, not speed.',
  investigate: 'Walk the room. Ask: “What can you check yourself? Who gains?” No hints about the answer.',
  think: 'Silence for the breathing ring. Everyone seals on their own.',
  reveal: 'If a squad is split: “Split decisions are normal. Talk it out.”',
  explain: 'Eyes up. Ask a quiet voice first. Steelman cards argue the other side, not their own view.',
  reseal: 'Remind them: keeping or changing are both fine. Changing your mind is thinking.',
  release: 'Point to the tactic, never the person: “The trick was designed to rush you.”',
  shield: 'Ask: “What would you actually say to a friend?” Tiles are dealt by role.',
  bond: 'Phones down. Celebrate the squad, not a score.',
};

export const secondsLeft = (endsAt: number | null, now: number): number =>
  endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));

/** m:ss for a countdown. */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Seconds into the live moment from the shared t0 (frozen while the session is paused). */
export function liveSeconds(tl: MissionTimeline, now: number, pausedAt: number | null, durationSec: number): number {
  const at = pausedAt ?? now;
  return Math.min(durationSec, Math.max(0, (at - tl.liveAt) / 1000));
}

/** "2 min" / "45 s" for how long a seat has been away. */
export function awayLabel(ms: number): string {
  if (ms <= 0) return '';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`;
}

// ---------------------------------------------------------------------------------------------
// Conductor: the one big button and pacing

export interface NextAction {
  label: string;
  hint: string;
}

/** What the Conductor's Next button will do right now (mirrors the server's `next` command). */
export function nextAction(h: HostSnapshot): NextAction {
  const { session } = h;
  // An open Squad Dash takes the big button (the server routes `next` to the Dash too).
  if (h.dash && session.phase !== 'ended') return dashNextAction(h.dash, session.phase);
  const ids = session.missionIds;
  const upcoming = session.missionIndex === null ? 0 : session.missionIndex + 1;
  const nextMission = upcoming < ids.length ? missionById(ids[upcoming] ?? '') : undefined;
  const startNext: NextAction = nextMission
    ? { label: `Start Mission ${upcoming + 1}`, hint: nextMission.title }
    : { label: 'Open the debrief', hint: 'The Long Fast-Forward lands every remaining Seed.' };
  switch (session.phase) {
    case 'lobby':
      return session.roomFreeze.done ? startNext : { label: 'Start the Room Freeze', hint: 'Everyone presses and holds together.' };
    case 'room-freeze':
      return { label: 'End the Room Freeze', hint: 'Back to the lobby, ready for Mission 1.' };
    case 'debrief':
      return { label: 'End the session', hint: 'Closes the room. Phones show the closing card.' };
    case 'ended':
      return { label: 'Session ended', hint: '' };
    case 'mission': {
      if (session.missionComplete) return startNext;
      const phases = h.squads.map((s) => s.phase).filter((p): p is SquadMissionPhase => p !== null);
      if (phases.includes('aftershock')) return { label: 'Skip to Role Flip', hint: 'Moves the whole room on.' };
      if (phases.includes('role-flip')) return { label: 'Start Live now', hint: 'Every phone starts the moment together.' };
      if (phases.includes('live')) return { label: 'End Live now', hint: 'Phones that have not held freeze gently.' };
      return { label: 'Next phase', hint: 'Moves every squad on one step.' };
    }
  }
}

/** Minutes each mission usually takes (GDD §5.3 durations). */
export function missionBudgetMin(mission: Mission | undefined, index: number): number {
  if (!mission) return 12;
  if (mission.scaffold === 'wildcard') return 9;
  return index > 0 ? 14 : 13;
}

export interface Pacing {
  state: 'on-track' | 'behind' | 'ahead' | 'unknown';
  /** Minutes behind (positive) or ahead (negative). */
  minutes: number;
  message: string;
}

/**
 * Ahead/behind against the run sheet: missions are budgeted from when Mission 1 opened.
 * More than 4 min behind before the last mission suggests dropping it (GDD §7.2).
 */
export function pacing(h: HostSnapshot, firstMissionAt: number | null, now: number): Pacing {
  const { session } = h;
  if (firstMissionAt === null || session.missionIndex === null || session.phase !== 'mission') {
    return { state: 'unknown', minutes: 0, message: 'Pacing starts when Mission 1 opens.' };
  }
  const ids = session.missionIds;
  let budget = 0;
  for (let i = 0; i <= session.missionIndex; i++) budget += missionBudgetMin(missionById(ids[i] ?? ''), i);
  const elapsedMin = (now - firstMissionAt) / 60_000;
  // While a mission runs, compare against the share of its budget that should be used by now.
  const tl = session.timeline;
  let expected = budget;
  if (tl && !session.missionComplete) {
    const thisBudget = missionBudgetMin(missionById(ids[session.missionIndex] ?? ''), session.missionIndex);
    const inMission = Math.max(0, (now - tl.openedAt) / 60_000);
    expected = budget - thisBudget + Math.min(inMission, thisBudget);
    const over = inMission - thisBudget;
    if (over > 1) {
      const behind = Math.round(over + Math.max(0, elapsedMin - inMission - (budget - thisBudget)));
      return {
        state: 'behind',
        minutes: behind,
        message: dropHint(behind, session.missionIndex, ids.length, `This mission is running ${Math.round(over)} min long.`),
      };
    }
  }
  const diff = Math.round(elapsedMin - expected);
  if (diff >= 2) return { state: 'behind', minutes: diff, message: dropHint(diff, session.missionIndex, ids.length, `About ${diff} min behind the run sheet.`) };
  if (diff <= -2) return { state: 'ahead', minutes: diff, message: `About ${-diff} min ahead. Room for a longer debrief.` };
  return { state: 'on-track', minutes: diff, message: 'On track with the run sheet.' };
}

function dropHint(behind: number, index: number, total: number, lead: string): string {
  if (behind > 4 && index < total - 1) return `${lead} Consider skipping the last mission and going to the debrief.`;
  if (behind > 2) return `${lead} Explain is the easiest place to save time.`;
  return lead;
}

// ---------------------------------------------------------------------------------------------
// Big Screen

/** Lanterns on a squad's tower: they only ever grow within a mission (holds, seals, a decision, Guardians). */
export function lanternCount(sq: ScreenSquad): number {
  return Math.max(sq.holding, sq.sealed.count) + (sq.decided ? 1 : 0) + sq.guardians.length;
}

export interface TacticMoment {
  tactic: Tactic;
  /** Where it was used: the mission and the line that carried it. */
  moments: { missionTitle: string; who: string; text: string }[];
}

/** Flip the Board: every tactic used in the session's missions, strung to the moment it was used (GDD §7.2). */
export function flipBoard(missionIds: readonly string[]): TacticMoment[] {
  const byTactic = new Map<TacticId, TacticMoment['moments']>();
  for (const id of missionIds) {
    const m = MISSIONS.find((x) => x.id === id);
    if (!m) continue;
    for (const beat of [...m.live.beats].sort((a, b) => a.at - b.at)) {
      if (!beat.tactic) continue;
      const list = byTactic.get(beat.tactic) ?? [];
      if (list.some((x) => x.missionTitle === m.title)) continue;
      const who = beat.from === 'narrator' ? 'The scene' : (m.cast.find((c) => c.id === beat.from)?.name ?? 'Someone');
      list.push({ missionTitle: m.title, who, text: beat.text });
      byTactic.set(beat.tactic, list);
    }
  }
  return TACTICS.filter((t) => byTactic.has(t.id)).map((tactic) => ({ tactic, moments: byTactic.get(tactic.id) ?? [] }));
}

/** "It was never Ren's fault. It was a script." with the session's residents. */
export function scriptLine(missionIds: readonly string[]): string {
  const names = [...new Set(missionIds.map((id) => missionById(id)).filter((m): m is Mission => !!m).map(residentName))];
  const who = names.length === 0 ? 'their' : names.length === 1 ? `${names[0]}’s` : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}’s`;
  return `It was never ${who} fault. It was a script.`;
}

/** Drops the quote marks round a label that is itself a quotation, so it can sit inside <q> without doubling up. */
export function unquote(text: string): string {
  const t = text.trim();
  const m = /^["'“‘]([\s\S]*)["'”’]$/.exec(t);
  return m ? (m[1] ?? '').trim() : t;
}

/** Missions a Conductor can pick for a band, in a sensible session order (Guided, Light, Wildcard). */
export function missionsForSession(band: BandId): Mission[] {
  const rank = { guided: 0, light: 1, wildcard: 2 } as const;
  return MISSIONS.filter((m) => m.bands.includes(band)).sort((a, b) => rank[a.scaffold] - rank[b.scaffold]);
}

/** Planned minutes for a playlist, for the create form. */
export function playlistMinutes(ids: readonly string[]): number {
  return ids.reduce((sum, id, i) => sum + missionBudgetMin(missionById(id), i), 0);
}

/** Seconds of Explain and Think for a mission (for the create form's timing note). */
export function timingSummary(band: BandId, mission: Mission, relaxed: boolean): string {
  const t = phaseTiming({ band, scaffold: mission.scaffold, relaxed });
  return `Think ${t.think} s · Explain ${clock(t.explain)} · Peer Shield ${clock(t.shield)}`;
}

// ---------------------------------------------------------------------------------------------
// Totems

/** 24×24 path for a squad totem shape (squads are told apart by shape + name, never colour alone). */
export function totemPath(shape: string): string | null {
  switch (shape) {
    case 'triangle':
      return 'M12 3 21.5 20h-19z';
    case 'square':
      return 'M4.5 4.5h15v15h-15z';
    case 'diamond':
      return 'M12 2.5 21.5 12 12 21.5 2.5 12z';
    case 'star':
      return 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z';
    case 'hexagon':
      return 'M12 2.5l8.3 4.75v9.5L12 21.5l-8.3-4.75v-9.5z';
    default:
      return null;
  }
}
