// Pure helpers for the Bond Book. Every rule shown here mirrors the engine's deterministic rules
// (evaluateRun in @shieldquest/shared): no luck, no shop, no ranking. Nothing here touches storage.
import {
  GUARDIANS,
  GUARDIAN_BOND_LEVELS,
  TACTICS,
  guardianLevel,
  type GuardianId,
  type Progress,
  type TacticId,
} from '@shieldquest/shared';

/** How each Guardian is earned, in plain words (matches the engine's skill rules one-to-one). */
export const EARN_RULE: Record<GuardianId, string> = {
  cluepaw: 'Spot most of the red flags in a moment (at least 6 in 10) without more than one false alarm.',
  echo: 'Hold early: press HOLD yourself before the moment freezes on its own.',
  verifox: 'Pull the String all the way to the person who really gains from the plan.',
  bytebuddy: 'Seal a forecast of what happens next, and have it match what really happens.',
  beacon: 'Choose the safer way out, or come forward and get help after an Aftershock lands (a Late Hold).',
  shieldfin: 'Build a Peer Shield message that reaches your friend without blame or shame.',
};

/** One-line tip on where the skill is practised, so the next mark feels reachable (not a grind). */
export const EARN_TIP: Record<GuardianId, string> = {
  cluepaw: 'Tip: while time is held, look at small things: names, links, prices and who is watching.',
  echo: 'Tip: the earlier you Hold, the more time you get to look around.',
  verifox: 'Tip: ask who gets the money, the photo or the favour at the end of the chain.',
  bytebuddy: 'Tip: think one step past the reward. What could happen next week?',
  beacon: 'Tip: telling someone you trust always counts, even after things go wrong.',
  shieldfin: 'Tip: name the trick, not the person, and offer a way out together.',
};

export const MARK_NUMERALS = ['I', 'II', 'III'] as const;

export interface BondState {
  id: GuardianId;
  bond: number;
  /** 0 = still folded; 1-3 = Bond marks I-III. */
  level: number;
  /** Demonstrations needed for the next mark, or null when all three marks are folded in. */
  nextAt: number | null;
}

export function bondState(progress: Progress, id: GuardianId): BondState {
  const bond = Math.max(0, progress.guardianBond[id] ?? 0);
  const level = guardianLevel(bond);
  const nextAt = GUARDIAN_BOND_LEVELS[level] ?? null;
  return { id, bond, level, nextAt };
}

export function allBonds(progress: Progress): BondState[] {
  return GUARDIANS.map((g) => bondState(progress, g.id));
}

/** Plain-words status for a Guardian's bond (always paired with a shape in the UI). */
export function bondWord(level: number): string {
  if (level <= 0) return 'Still folded';
  if (level >= MARK_NUMERALS.length) return 'All three Bond marks';
  return `Bond mark ${MARK_NUMERALS[level - 1]}`;
}

export function nextStepText(s: BondState, name: string): string {
  if (s.nextAt === null) return `${name} has every Bond mark. Each new demonstration still counts on your record.`;
  const left = s.nextAt - s.bond;
  const target = s.level === 0 ? `unfold ${name}` : `fold in Bond mark ${MARK_NUMERALS[s.level]}`;
  return `${left} more ${left === 1 ? 'time' : 'times'} to ${target}.`;
}

export function seenTactics(progress: Progress): Set<TacticId> {
  const known = new Set<TacticId>(TACTICS.map((t) => t.id));
  return new Set(progress.tacticsSeen.filter((t) => known.has(t)));
}

export interface HoldInsight {
  live: number;
  held: number;
  /** The headline comparison, worded to credit holding (never to judge the player). */
  line: string;
}

export function holdInsight(totals: Progress['totals']): HoldInsight {
  const { liveFlags: live, heldFlags: held } = totals;
  let line: string;
  if (live + held === 0) line = 'Play a mission and Hold to see how much more you notice when time stops.';
  else if (live === 0) line = 'Every red flag you found, you found while holding. Holding gave you the time to look.';
  else if (held > live) {
    const ratio = Math.round((held / live) * 10) / 10;
    line = `You found ${ratio.toLocaleString('en-SG')}× more red flags after holding.`;
  } else if (held === live) line = 'You found as many red flags while holding as you did live. Holding earlier gives you more time.';
  else line = 'You spot a lot live. Holding earlier still buys extra time to check the small things.';
  return { live, held, line };
}

const DATE_FMT = new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short' });

export function shortDate(at: number): string {
  try {
    return DATE_FMT.format(new Date(at));
  } catch {
    return '';
  }
}
