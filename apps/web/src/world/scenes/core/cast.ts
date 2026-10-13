// Who stands where, in which pose, with which face (GAME_DESIGN.md §4.4). Pure logic shared by the 3D scene and
// the Flat View, so both always agree. Manipulators are never embodied: remote contacts are omitted, and a
// stranger who is physically present is drawn as a faceless silhouette, never as a bean.
import type { CastMember, CastRole, Mission, TacticId } from '@shieldquest/shared';
import type { BeanExpression, BeanPose } from '../../kit/Bean';
import type { ThreadBead } from '../../kit/icons';
import type { SceneMode, SceneMood } from '../../contracts';
import type { AnchorSpot } from '../sets/types';
import type { Vec3 } from './staging';

export interface CastPlacement {
  member: CastMember;
  /** 'bean' for people we follow; 'faceless' for strangers who are physically present. */
  kind: 'bean' | 'faceless';
  anchor: string;
  position: Vec3;
  facing: number;
  /** Authored pose (may be overridden per mood by castPose). */
  pose: BeanPose;
  /** Sitting on a seat anchor. */
  seated: boolean;
  isResident: boolean;
}

/** People who should not get a face of their own: strangers (often the manipulator) and anyone marked faceless. */
export const isFaceless = (member: CastMember) => member.faceless === true || member.role === 'stranger';

/**
 * Places every cast member that has an anchor in this set. Standing poses on a seat anchor step forward off the
 * seat; two people at one anchor stand side by side.
 */
export function placeCast(
  mission: Mission,
  anchors: Record<string, AnchorSpot>,
  seats: Readonly<Record<string, Vec3>> = {},
): CastPlacement[] {
  const byAnchor = new Map<string, CastMember[]>();
  for (const member of mission.cast) {
    if (!member.anchor || !anchors[member.anchor]) continue;
    const list = byAnchor.get(member.anchor) ?? [];
    list.push(member);
    byAnchor.set(member.anchor, list);
  }
  const out: CastPlacement[] = [];
  for (const [anchor, members] of byAnchor) {
    const spot = anchors[anchor]!;
    const facing = spot.facing ?? 0;
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    members.forEach((member, i) => {
      const pose: BeanPose = member.pose ?? 'stand';
      const stand = seats[anchor];
      const seated = stand !== undefined && pose === 'sit' && !isFaceless(member);
      const base = stand && !seated ? stand : spot.position;
      // Side-by-side spread: 0, +0.75, -0.75, +1.5 ... along the anchor's right-hand side.
      const side = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * 0.75 * Math.ceil(i / 2);
      out.push({
        member,
        kind: isFaceless(member) ? 'faceless' : 'bean',
        anchor,
        position: [base[0] + fz * side, base[1], base[2] - fx * side],
        facing,
        pose: isFaceless(member) ? (pose === 'phone' ? 'phone' : 'stand') : pose,
        seated,
        isResident: member.id === mission.resident,
      });
    });
  }
  return out;
}

const FACES: Record<CastRole, Record<SceneMood, BeanExpression>> = {
  resident: { neutral: 'neutral', tense: 'worried', warm: 'relieved', sober: 'sad', shiny: 'happy' },
  friend: { neutral: 'neutral', tense: 'worried', warm: 'happy', sober: 'sad', shiny: 'happy' },
  pressurer: { neutral: 'neutral', tense: 'determined', warm: 'neutral', sober: 'worried', shiny: 'smug' },
  trusted: { neutral: 'happy', tense: 'neutral', warm: 'happy', sober: 'worried', shiny: 'neutral' },
  bystander: { neutral: 'neutral', tense: 'neutral', warm: 'happy', sober: 'neutral', shiny: 'neutral' },
  stranger: { neutral: 'neutral', tense: 'neutral', warm: 'neutral', sober: 'neutral', shiny: 'neutral' },
};

/** Expression from the scene mood and the person's role (resident worried while tense, relieved when warm...). */
export function castExpression(role: CastRole, mood: SceneMood, mode: SceneMode, isResident: boolean): BeanExpression {
  if (mode === 'intro') return role === 'trusted' ? 'happy' : 'neutral';
  return FACES[isResident ? 'resident' : role][mood];
}

/** Pose for the moment: the authored pose, with a few gentle mood beats in the outcome. */
export function castPose(p: CastPlacement, mood: SceneMood, mode: SceneMode): BeanPose {
  if (p.kind === 'faceless' || mode !== 'released') return p.pose;
  const role = p.isResident ? 'resident' : p.member.role;
  if (mood === 'warm') {
    if (role === 'trusted') return 'open-arms';
    // The resident puts the phone away; the pushy friend goes quiet.
    if (role === 'resident' && p.pose === 'phone') return p.seated ? 'sit' : 'stand';
    if (role === 'pressurer' && !p.seated) return 'arms-crossed';
  }
  if (mood === 'sober' && role === 'resident' && p.pose === 'stand') return 'arms-crossed';
  return p.pose;
}

/** Chest height of a placement (where a thread starts). */
export const chestHeight = (p: Pick<CastPlacement, 'seated' | 'kind'>) => (p.kind === 'faceless' ? 1.18 : p.seated ? 0.86 : 1.02);

const BEADS: Partial<Record<TacticId, ThreadBead>> = {
  'too-good': 'coin',
  'small-ask': 'coin',
  urgency: 'clock',
  'everyone-does-it': 'crowd',
  authority: 'badge',
  'fake-proof': 'badge',
  loyalty: 'link',
};

/** Tactic beads for the influence string, in the order the tactics first land (at most four, no repeats). */
export function threadBeads(mission: Mission): ThreadBead[] {
  const out: ThreadBead[] = [];
  const beats = [...mission.live.beats].sort((a, b) => a.at - b.at);
  for (const beat of beats) {
    const bead = beat.tactic ? BEADS[beat.tactic] : undefined;
    if (bead && !out.includes(bead)) out.push(bead);
    if (out.length >= 4) break;
  }
  return out;
}

/** Pressure inputs: tactic beats landed by `t`, and in total. */
export function tacticCounts(mission: Mission, t: number): { landed: number; total: number } {
  let landed = 0;
  let total = 0;
  for (const beat of mission.live.beats) {
    if (!beat.tactic) continue;
    total++;
    if (beat.at <= t) landed++;
  }
  return { landed, total };
}
