// Pure game rules shared by solo play, squad sessions and tests. No I/O, no randomness, no clocks:
// callers pass timestamps in, so everything here is deterministic and easy to unit-test.

import { GUARDIAN_BOND_LEVELS, guardianForSkill, type GuardianId, type SkillId, type TacticId } from './framework';
import type { AftershockSpec, Choice, Mission, PeerShield, ShieldSlot, ShieldTile } from './mission';

/** Everything the player did in one mission, as captured by the mission player. */
export interface RunInput {
  missionId: string;
  /** Seconds into the live phase when the player chose to Hold, or null if time auto-froze. */
  heldAtSec: number | null;
  /** Clue ids tapped while the moment was still live. */
  liveFound: string[];
  /** Clue ids found after freezing time. */
  frozenFound: string[];
  traceOptionId: string | null;
  forecastOptionId: string | null;
  firstVote: string;
  confidence: 1 | 2 | 3;
  finalChoice: string;
  shieldPicks?: Partial<Record<ShieldSlot, string>>;
  /** Guardian abilities used this mission. */
  guardiansUsed: GuardianId[];
}

export interface ShieldResult {
  guard: number;
  doubt: number;
  outcome: 'success' | 'partial' | 'fail';
  score: number;
  tiles: ShieldTile[];
}

export interface RunSummary {
  missionId: string;
  /** Red flags found live vs after holding — the "LIVE 2 · HELD 7" counter. */
  live: number;
  held: number;
  redFlagsTotal: number;
  /** Ordinary details mistakenly flagged as red flags. */
  falseAlarms: number;
  heldEarly: boolean;
  traceCorrect: boolean;
  forecastLikely: boolean;
  choice: Choice;
  changedMind: boolean;
  /** Confident vote for a risky option: triggers a private, on-device hypercorrection note. */
  confidentRisk: boolean;
  shield?: ShieldResult;
  skills: SkillId[];
  tacticsSeen: TacticId[];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
/** Progress is plain JSON, so a JSON round-trip is a safe deep copy in every runtime. */
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export function choiceById(mission: Mission, id: string): Choice {
  const c = mission.choices.find((x) => x.id === id);
  if (!c) throw new Error(`Mission ${mission.id} has no choice ${id}`);
  return c;
}

/** Holding in the first 70% of the live phase counts as "holding before acting". */
export function isEarlyHold(mission: Mission, heldAtSec: number | null): boolean {
  return heldAtSec !== null && heldAtSec <= mission.live.durationSec * 0.7;
}

export function evaluateShield(shield: PeerShield, picks: Partial<Record<ShieldSlot, string>>): ShieldResult {
  let guard = shield.start.guard;
  let doubt = shield.start.doubt;
  const tiles: ShieldTile[] = [];
  let score = 0;
  for (const slot of ['opener', 'reason', 'offer', 'channel'] as const) {
    const tile = shield.slots[slot].find((t) => t.id === picks[slot]);
    if (!tile) continue;
    tiles.push(tile);
    guard = clamp(guard + tile.guard, 0, 100);
    doubt = clamp(doubt + tile.doubt, 0, 100);
    score += tile.quality === 'great' ? 2 : tile.quality === 'ok' ? 1 : -2;
  }
  const harmful = tiles.some((t) => t.quality === 'harmful');
  const outcome: ShieldResult['outcome'] =
    !harmful && doubt >= 60 && guard <= 40 ? 'success' : harmful && guard >= 60 ? 'fail' : 'partial';
  return { guard, doubt, outcome, score, tiles };
}

export function evaluateRun(mission: Mission, run: RunInput): RunSummary {
  const redFlags = new Set(mission.clues.filter((c) => c.redFlag).map((c) => c.id));
  const uniq = (ids: string[]) => [...new Set(ids)];
  const liveFound = uniq(run.liveFound);
  const frozenFound = uniq(run.frozenFound).filter((id) => !liveFound.includes(id));
  const live = liveFound.filter((id) => redFlags.has(id)).length;
  const held = frozenFound.filter((id) => redFlags.has(id)).length;
  const falseAlarms = [...liveFound, ...frozenFound].filter((id) => !redFlags.has(id)).length;

  const choice = choiceById(mission, run.finalChoice);
  const first = choiceById(mission, run.firstVote);
  const traceCorrect = mission.influence.options.some((o) => o.id === run.traceOptionId && o.correct);
  const forecastLikely = mission.forecast.options.some((o) => o.id === run.forecastOptionId && o.likely);
  const shield = mission.peerShield && run.shieldPicks ? evaluateShield(mission.peerShield, run.shieldPicks) : undefined;
  const heldEarly = isEarlyHold(mission, run.heldAtSec);

  const skills: SkillId[] = [];
  const foundShare = redFlags.size === 0 ? 1 : (live + held) / redFlags.size;
  if (foundShare >= 0.6 && falseAlarms <= 1) skills.push('S');
  if (heldEarly) skills.push('H');
  if (traceCorrect) skills.push('I');
  if (forecastLikely) skills.push('E');
  if (choice.safety === 'safe') skills.push('L');
  if (shield?.outcome === 'success') skills.push('D');

  const tacticsSeen = uniq(
    [...mission.live.beats.map((b) => b.tactic), ...mission.clues.map((c) => c.tactic)].filter(
      (t): t is TacticId => Boolean(t),
    ),
  ) as TacticId[];

  return {
    missionId: mission.id,
    live,
    held,
    redFlagsTotal: redFlags.size,
    falseAlarms,
    heldEarly,
    traceCorrect,
    forecastLikely,
    choice,
    changedMind: first.id !== choice.id,
    confidentRisk: first.safety === 'risky' && run.confidence === 3,
    shield,
    skills,
    tacticsSeen,
  };
}

// ---------------------------------------------------------------------------------------------
// Progress (stored on the device only — never uploaded) and the Delayed Consequence Engine.

export interface PendingAftershock {
  /** Unique per scheduling: `${missionId}:${aftershockId}`. */
  key: string;
  missionId: string;
  choiceId: string;
  aftershockId: string;
  /** Lands once completedCount reaches this number. */
  dueAt: number;
  forecastLikely: boolean;
}

export interface ResolvedAftershock {
  key: string;
  missionId: string;
  recoveredWell: boolean;
  at: number;
}

export interface Progress {
  version: 1;
  completedCount: number;
  runs: Record<string, { bestSafety: Choice['safety']; plays: number; lastAt: number; lastChoice: string }>;
  skillEvidence: Record<SkillId, number>;
  guardianBond: Record<GuardianId, number>;
  tacticsSeen: TacticId[];
  wallet: number;
  /** City light per district, -3..+3 (protective choices light lanterns, Aftershocks dim them until recovered). */
  districtTrust: Record<string, number>;
  pending: PendingAftershock[];
  resolved: ResolvedAftershock[];
  ifThenCards: { missionId: string; text: string; at: number }[];
  /** Totals for the end-of-session stats ("you found 3x more red flags after holding"). */
  totals: { liveFlags: number; heldFlags: number; holds: number; missions: number };
}

export function emptyProgress(): Progress {
  return {
    version: 1,
    completedCount: 0,
    runs: {},
    skillEvidence: { S: 0, H: 0, I: 0, E: 0, L: 0, D: 0 },
    guardianBond: { verifox: 0, echo: 0, beacon: 0, shieldfin: 0, cluepaw: 0, bytebuddy: 0 },
    tacticsSeen: [],
    wallet: 0,
    districtTrust: {},
    pending: [],
    resolved: [],
    ifThenCards: [],
    totals: { liveFlags: 0, heldFlags: 0, holds: 0, missions: 0 },
  };
}

const SAFETY_RANK: Record<Choice['safety'], number> = { risky: 0, unsure: 1, safe: 2 };

/** Applies a finished mission to progress. Returns the new progress and the Guardians that unfolded or grew. */
export function applyRun(
  progress: Progress,
  mission: Mission,
  summary: RunSummary,
  now: number,
): { progress: Progress; guardianLevelUps: { guardian: GuardianId; level: number }[] } {
  const p: Progress = clone(progress);
  const completedCount = p.completedCount + 1;
  p.completedCount = completedCount;

  const prev = p.runs[mission.id];
  const bestSafety =
    prev && SAFETY_RANK[prev.bestSafety] >= SAFETY_RANK[summary.choice.safety] ? prev.bestSafety : summary.choice.safety;
  p.runs[mission.id] = { bestSafety, plays: (prev?.plays ?? 0) + 1, lastAt: now, lastChoice: summary.choice.id };

  const levelUps: { guardian: GuardianId; level: number }[] = [];
  for (const skill of summary.skills) {
    p.skillEvidence[skill] += 1;
    const g = guardianForSkill(skill).id;
    const before = guardianLevel(p.guardianBond[g]);
    p.guardianBond[g] += 1;
    const after = guardianLevel(p.guardianBond[g]);
    if (after > before) levelUps.push({ guardian: g, level: after });
  }

  p.tacticsSeen = [...new Set([...p.tacticsSeen, ...summary.tacticsSeen])];
  const fx = summary.choice.outcome.effects;
  p.wallet += fx.wallet ?? 0;
  p.districtTrust[mission.district] = clamp((p.districtTrust[mission.district] ?? 0) + (fx.trust ?? 0), -3, 3);

  const shock = summary.choice.aftershock;
  if (shock) {
    const key = `${mission.id}:${shock.id}`;
    p.pending = p.pending.filter((x) => x.key !== key);
    p.pending.push({
      key,
      missionId: mission.id,
      choiceId: summary.choice.id,
      aftershockId: shock.id,
      dueAt: completedCount + shock.afterMissions,
      forecastLikely: summary.forecastLikely,
    });
  }

  p.totals.liveFlags += summary.live;
  p.totals.heldFlags += summary.held;
  p.totals.holds += summary.heldEarly ? 1 : 0;
  p.totals.missions += 1;
  return { progress: p, guardianLevelUps: levelUps };
}

/** Aftershocks that should land now (before the next mission starts, or when the player ends a session). */
export function dueAftershocks(progress: Progress, endOfSession = false): PendingAftershock[] {
  return progress.pending.filter((a) => endOfSession || a.dueAt <= progress.completedCount);
}

export function findAftershock(missions: readonly Mission[], pending: PendingAftershock): {
  mission: Mission;
  choice: Choice;
  spec: AftershockSpec;
} | null {
  const mission = missions.find((m) => m.id === pending.missionId);
  const choice = mission?.choices.find((c) => c.id === pending.choiceId);
  const spec = choice?.aftershock;
  return mission && choice && spec ? { mission, choice, spec } : null;
}

/** Lands an Aftershock: applies its effects, then the Late Hold recovery. Coming forward is always rewarded. */
export function resolveAftershock(
  progress: Progress,
  missions: readonly Mission[],
  key: string,
  recoveryOptionId: string,
  now: number,
): Progress {
  const p: Progress = clone(progress);
  const pending = p.pending.find((x) => x.key === key);
  if (!pending) return p;
  const found = findAftershock(missions, pending);
  p.pending = p.pending.filter((x) => x.key !== key);
  if (!found) return p;
  const { mission, spec } = found;
  const fx = spec.effects;
  p.wallet += fx.wallet ?? 0;
  let trust = (p.districtTrust[mission.district] ?? 0) + (fx.trust ?? 0);
  const option = spec.recovery?.options.find((o) => o.id === recoveryOptionId);
  // An Afterglow has no recovery step; it simply lands.
  const recoveredWell = spec.polarity === 'protective' || Boolean(option?.good);
  if (recoveredWell && spec.polarity === 'risk') {
    // Late Hold: telling someone relights a lantern and grows Beacon — never shamed for acting late.
    trust += 1;
    p.guardianBond.beacon += 1;
    p.skillEvidence.L += 1;
  }
  p.districtTrust[mission.district] = clamp(trust, -3, 3);
  p.resolved.push({ key, missionId: mission.id, recoveredWell, at: now });
  return p;
}

export function guardianLevel(bond: number): number {
  return GUARDIAN_BOND_LEVELS.filter((t) => bond >= t).length;
}

export function isGuardianUnfolded(progress: Progress, id: GuardianId): boolean {
  return guardianLevel(progress.guardianBond[id]) >= 1;
}

/** Feedback card text in the fixed offender-focused template. */
export function feedbackSentence(
  card: { designedTo?: string; saferMove: string; ifItHappened: string },
  tacticName: string,
  tacticDesignedTo: string,
): { tactic: string; designedTo: string; saferMove: string; ifItHappened: string } {
  return {
    tactic: tacticName,
    designedTo: card.designedTo ?? tacticDesignedTo,
    saferMove: card.saferMove,
    ifItHappened: card.ifItHappened,
  };
}
