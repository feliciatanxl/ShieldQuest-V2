// Aggregated analytics for the portal dashboard (GDD §7.5). Reads only counts-only session aggregates
// and the separately stored Calibration responses, which are summarised (never listed). Every cell built
// from fewer than 5 people or squads is suppressed here, before anything leaves the server, and the
// CSV export is built from the same suppressed report.

import {
  ASSESSMENT_METRICS,
  HOLD_BUCKETS,
  missionById,
  summarise,
  toHourIso,
  type AssessmentResponse,
  type AssessmentSummary,
  type BandId,
  type Mission,
  type MissionAggregate,
  type SessionAggregate,
} from '@shieldquest/shared';
import { ASSESSMENT_COLLECTION } from '../assess/routes';
import { collection } from '../store';
import { customMissions } from './missions';
import {
  HOLD_BUCKET_LABEL,
  PORTAL_MIN_GROUP,
  SUPPRESSED_TEXT,
  type AnalyticsFilter,
  type AnalyticsReport,
  type CalibrationRow,
  type KpiCard,
  type MissionRow,
  type SessionRow,
  type SignalRow,
  type Stat,
} from './model';

export const AGGREGATE_COLLECTION = 'session-aggregates';
const MIN = PORTAL_MIN_GROUP;

const round = (x: number, dp = 3) => Math.round(x * 10 ** dp) / 10 ** dp;

/** A count of people or squads: 0 stays 0, 1-4 is suppressed. */
export const safeCount = (n: number): number | null => (n === 0 || n >= MIN ? n : null);

/** A rate or mean whose denominator counts people or squads. `contributors` decides suppression. */
export function stat(numerator: number, denominator: number, contributors = denominator): Stat {
  if (contributors === 0 || denominator === 0) return { n: 0, value: null, suppressed: false };
  if (contributors < MIN) return { n: null, value: null, suppressed: true };
  return { n: contributors, value: round(numerator / denominator), suppressed: false };
}

const sum = <T>(list: readonly T[], f: (x: T) => number) => list.reduce((s, x) => s + f(x), 0);
const holdsMade = (m: MissionAggregate) => m.holdBuckets['0-5'] + m.holdBuckets['5-15'] + m.holdBuckets['15-30'] + m.holdBuckets['30+'];
const holdsAll = (m: MissionAggregate) => holdsMade(m) + m.holdBuckets.late;
const shifts = (m: MissionAggregate) => m.shiftedSafer + m.shiftedRiskier + m.unchanged;
const shieldSends = (m: MissionAggregate) => m.shieldOutcomes.success + m.shieldOutcomes.partial + m.shieldOutcomes.fail;

function normalizeHour(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? toHourIso(t) : null;
}

export function normalizeFilter(q: { band?: string; from?: string; to?: string }): AnalyticsFilter {
  const band = q.band === 'junior' || q.band === 'teen' || q.band === 'young-adult' ? (q.band as BandId) : null;
  let from = normalizeHour(q.from);
  let to = normalizeHour(q.to);
  if (from && to && from > to) [from, to] = [to, from];
  return { band, from, to };
}

const inRange = (hourIso: string, f: AnalyticsFilter) => (!f.from || hourIso >= f.from) && (!f.to || hourIso <= f.to);

function calibrationRows(summary: AssessmentSummary, kpi: string): CalibrationRow[] {
  const k = summary.kpis.find((x) => x.id === kpi);
  if (!k) return [];
  const retention = kpi === 'retention';
  return k.metrics.map((m) => {
    const info = ASSESSMENT_METRICS.find((x) => x.id === m.id);
    return {
      metricId: m.id,
      label: m.label,
      format: m.format,
      higherIsBetter: m.higherIsBetter,
      min: info?.min ?? 0,
      max: info?.max ?? 1,
      pre: m.pre,
      post: m.post,
      return: m.return,
      change: retention ? m.returnVsPost : m.postVsPre,
      changeLabel: retention ? 'Return vs after (same people)' : 'After vs before (same people)',
    };
  });
}

/** Pure report builder (also used by the tests). */
export function computeAnalytics(
  allAggregates: readonly SessionAggregate[],
  allResponses: readonly AssessmentResponse[],
  filter: AnalyticsFilter,
  opts: { now: number; missionLookup?: (id: string) => Mission | undefined } = { now: Date.now() },
): AnalyticsReport {
  const lookup = opts.missionLookup ?? missionById;
  const aggs = allAggregates.filter((a) => (!filter.band || a.band === filter.band) && inRange(a.createdAt, filter));
  const responses = allResponses.filter((r) => (!filter.band || r.band === filter.band) && inRange(r.createdAtHour, filter));
  const summary = summarise(responses);
  const missions = aggs.flatMap((a) => a.perMission);
  const squadMissions = sum(missions, (m) => m.squads);

  const isWildcard = (m: MissionAggregate) => lookup(m.missionId)?.scaffold === 'wildcard';
  const wildcard = missions.filter(isWildcard);
  const lateHold = { good: sum(aggs, (a) => a.lateHold.good), total: sum(aggs, (a) => a.lateHold.total) };
  // Rates below are summed over missions, so one player counts once per mission. Suppression must be decided
  // on distinct people (seats) or squads, never on player-missions: 3 players x 3 missions is still 3 people.
  const seatsAll = sum(aggs, (a) => a.seatsTotal);
  const squadsAll = sum(aggs, (a) => a.squadsTotal);
  const wildSeats = sum(aggs.filter((a) => a.perMission.some(isWildcard)), (a) => a.seatsTotal);
  const people = (num: number, den: number, seats = seatsAll) => stat(num, den, Math.min(den, seats));
  const bySquad = (num: number, den: number) => stat(num, den, Math.min(den, squadsAll));
  const flags = { live: sum(missions, (m) => m.liveFlags), held: sum(missions, (m) => m.heldFlags) };
  const sends = sum(missions, shieldSends);
  const sessions = aggs.length;

  const signal = (id: string, label: string, unit: string, s: Stat, format: SignalRow['format'] = 'percent'): SignalRow => ({
    id,
    label,
    unit,
    format,
    stat: s,
  });
  const countStat = (n: number): Stat => {
    const c = safeCount(n);
    return { n: c, value: c, suppressed: c === null };
  };

  const inGame: Record<string, SignalRow[]> = {
    risk: [
      signal('held-flags', 'Red flags pinned while held (share of all flags pinned)', 'squads', stat(flags.held, flags.live + flags.held, Math.min(squadMissions, squadsAll))),
      signal('flags-per-squad', 'Red flags pinned per squad', 'squads', bySquad(flags.live + flags.held, squadMissions), 'number'),
    ],
    decision: [
      signal('wildcard-first-safe', 'Wildcard missions: safest Exit on the first, private seal', 'players', people(sum(wildcard, (m) => m.firstSafe), sum(wildcard, (m) => m.firstTotal), wildSeats)),
      signal('first-safe', 'All missions: safest Exit on the first seal', 'players', people(sum(missions, (m) => m.firstSafe), sum(missions, (m) => m.firstTotal))),
      signal('final-safe', 'All missions: safest Exit after discussion', 'players', people(sum(missions, (m) => m.finalSafe), sum(missions, (m) => m.finalTotal))),
    ],
    consequence: [
      signal('forecast', 'Forecasts that picked a likely consequence', 'players', people(sum(missions, (m) => m.forecastLikely), sum(missions, (m) => m.forecastTotal))),
      signal('trace', 'Influence traced to whoever really gains', 'players', people(sum(missions, (m) => m.traceCorrect), sum(missions, (m) => m.traceTotal))),
      signal('late-hold', 'Good recovery choice after an Aftershock (Late Hold)', 'players', people(lateHold.good, lateHold.total)),
    ],
    peer: [
      signal('shield-success', 'Peer Shield messages that helped the friend', 'squads', bySquad(sum(missions, (m) => m.shieldOutcomes.success), sends)),
      signal('trap-tiles', 'Trap tiles per Peer Shield message', 'squads', bySquad(sum(missions, (m) => m.trapTiles), sends), 'number'),
    ],
    retention: [
      signal('return-visits', 'Return visits completed', 'people', countStat(summary.responses.return ?? 0), 'number'),
      signal('matched-return', 'People with both an after check and a Return visit', 'people', countStat(summary.matched.postReturn ?? 0), 'number'),
    ],
    engagement: [
      signal('sessions', 'Squad sessions run', 'sessions', countStat(sessions), 'number'),
      signal('session-complete', 'Sessions that reached the end', 'sessions', stat(aggs.filter((a) => a.complete).length, sessions)),
      signal('mission-complete', 'Squad missions played to the end', 'squads', bySquad(sum(missions, (m) => m.squadsCompleted), squadMissions)),
      signal('hold-rate', 'Players who pressed HOLD themselves (before the auto-freeze)', 'players', people(sum(missions, holdsMade), sum(missions, holdsAll))),
      signal('shift-safer', 'Players who moved to a safer Exit after discussion', 'players', people(sum(missions, (m) => m.shiftedSafer), sum(missions, shifts))),
    ],
  };

  const kpis: KpiCard[] = summary.kpis.map((k) => ({
    id: k.id,
    number: k.number,
    label: k.label,
    measure: k.measure,
    calibration: calibrationRows(summary, k.id),
    signals: inGame[k.id] ?? [],
  }));

  const holdLatency = HOLD_BUCKETS.map((bucket) => ({
    bucket,
    label: HOLD_BUCKET_LABEL[bucket],
    n: seatsAll > 0 && seatsAll < MIN ? null : safeCount(sum(missions, (m) => m.holdBuckets[bucket])),
  }));

  const byMission = new Map<string, MissionAggregate[]>();
  for (const m of missions) byMission.set(m.missionId, [...(byMission.get(m.missionId) ?? []), m]);
  const missionRows: MissionRow[] = [...byMission.entries()].map(([missionId, list]) => {
    const def = lookup(missionId);
    const squads = sum(list, (m) => m.squads);
    const clueFinds = new Map<string, number>();
    for (const m of list) for (const [clue, n] of Object.entries(m.clueFinds)) clueFinds.set(clue, (clueFinds.get(clue) ?? 0) + n);
    const redFlags = def?.clues.filter((c) => c.redFlag) ?? [];
    const missed =
      squads >= MIN && redFlags.length
        ? redFlags
            .map((c) => ({ clueId: c.id, label: c.label, found: stat(clueFinds.get(c.id) ?? 0, squads) }))
            .sort((a, b) => (a.found.value ?? 0) - (b.found.value ?? 0))[0] ?? null
        : null;
    const decided = new Map<string, number>();
    for (const m of list) for (const [choice, n] of Object.entries(m.decisions)) decided.set(choice, (decided.get(choice) ?? 0) + n);
    const choiceIds = def ? def.choices.map((c) => c.id) : [...decided.keys()];
    return {
      missionId,
      title: def?.title ?? missionId,
      scaffold: def?.scaffold ?? null,
      squads: countStat(squads),
      completion: stat(sum(list, (m) => m.squadsCompleted), squads),
      holdRate: stat(sum(list, holdsMade), sum(list, holdsAll)),
      firstSafe: stat(sum(list, (m) => m.firstSafe), sum(list, (m) => m.firstTotal)),
      finalSafe: stat(sum(list, (m) => m.finalSafe), sum(list, (m) => m.finalTotal)),
      shiftedSafer: stat(sum(list, (m) => m.shiftedSafer), sum(list, shifts)),
      forecast: stat(sum(list, (m) => m.forecastLikely), sum(list, (m) => m.forecastTotal)),
      trace: stat(sum(list, (m) => m.traceCorrect), sum(list, (m) => m.traceTotal)),
      shieldSuccess: stat(sum(list, (m) => m.shieldOutcomes.success), sum(list, shieldSends)),
      mostMissed: missed,
      decisions: choiceIds.map((choiceId) => {
        const choice = def?.choices.find((c) => c.id === choiceId);
        return { choiceId, label: choice?.label ?? choiceId, safety: choice?.safety ?? 'unknown', squads: safeCount(decided.get(choiceId) ?? 0) };
      }),
    };
  });
  missionRows.sort((a, b) => (b.squads.n ?? 0) - (a.squads.n ?? 0) || a.title.localeCompare(b.title));

  const sessionRows: SessionRow[] = [...aggs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((a) => ({
      hour: a.createdAt,
      band: a.band,
      seats: safeCount(a.seatsTotal),
      squads: safeCount(a.squadsTotal),
      missionsCompleted: a.missionsCompleted,
      complete: a.complete,
      holdRate: stat(sum(a.perMission, holdsMade), sum(a.perMission, holdsAll), Math.min(sum(a.perMission, holdsAll), a.seatsTotal)),
      shiftedSafer: stat(sum(a.perMission, (m) => m.shiftedSafer), sum(a.perMission, shifts), Math.min(sum(a.perMission, shifts), a.seatsTotal)),
      // Lanterns are earned by the whole room, but a room of 1-4 players would still reveal their choices.
      lanterns: safeCount(a.seatsTotal) === null ? null : a.lanterns,
    }));

  return {
    generatedAt: toHourIso(opts.now),
    filter,
    minGroup: MIN,
    totals: {
      sessions: safeCount(sessions),
      completeSessions: safeCount(aggs.filter((a) => a.complete).length),
      seats: safeCount(sum(aggs, (a) => a.seatsTotal)),
      missionsCompleted: safeCount(sum(aggs, (a) => a.missionsCompleted)),
      responses: summary.responses,
      matched: { prePost: summary.matched.prePost, postReturn: summary.matched.postReturn },
    },
    kpis,
    holdLatency,
    missions: missionRows,
    sessions: sessionRows,
  };
}

/** Loads the stores and builds the report. Custom missions are looked up for titles and scaffolds. */
export async function buildAnalytics(filter: AnalyticsFilter, nowMs: number): Promise<AnalyticsReport> {
  const [aggs, responses, custom] = await Promise.all([
    collection<SessionAggregate>(AGGREGATE_COLLECTION).list(),
    collection<AssessmentResponse>(ASSESSMENT_COLLECTION).list(),
    customMissions().list(),
  ]);
  const customById = new Map(custom.map((d) => [d.id, d.published?.mission ?? d.mission]));
  return computeAnalytics(aggs, responses, filter, { now: nowMs, missionLookup: (id) => missionById(id) ?? customById.get(id) });
}

// ---------------------------------------------------------------------------------------------
// CSV export: the aggregated (already suppressed) table only

const CSV_HEADER = ['section', 'group', 'measure', 'unit', 'n', 'value', 'ci95_low', 'ci95_high', 'note'];

/** Quotes a cell; text cells that look like formulas are defused for spreadsheet apps. */
function cell(v: string | number | null, text = false): string {
  if (v === null) return '';
  let s = String(v);
  if (text && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportToCsv(r: AnalyticsReport): string {
  const rows: string[][] = [CSV_HEADER];
  const push = (
    section: string,
    group: string,
    measure: string,
    unit: string,
    n: number | null,
    value: number | null,
    suppressed: boolean,
    ci: [number, number] | null = null,
  ) =>
    rows.push([
      cell(section, true),
      cell(group, true),
      cell(measure, true),
      cell(unit, true),
      suppressed ? '<5' : cell(n),
      suppressed ? '' : cell(value),
      cell(ci?.[0] ?? null),
      cell(ci?.[1] ?? null),
      cell(suppressed ? SUPPRESSED_TEXT : '', true),
    ]);
  const filter = [r.filter.band ?? 'all bands', r.filter.from ?? 'start', r.filter.to ?? 'now'].join(' | ');
  rows.push([cell('filter', true), cell(filter, true), cell('generated at (hour)', true), '', '', '', '', '', cell(r.generatedAt, true)]);
  const t = r.totals;
  push('totals', 'all', 'sessions', 'sessions', t.sessions, t.sessions, t.sessions === null);
  push('totals', 'all', 'sessions completed', 'sessions', t.completeSessions, t.completeSessions, t.completeSessions === null);
  push('totals', 'all', 'seats', 'players', t.seats, t.seats, t.seats === null);
  push('totals', 'all', 'missions completed', 'missions', t.missionsCompleted, t.missionsCompleted, t.missionsCompleted === null);
  for (const k of ['pre', 'post', 'return'] as const) push('totals', 'calibration', `${k} responses`, 'people', t.responses[k], t.responses[k], t.responses[k] === null);
  push('totals', 'calibration', 'matched after+before', 'people', t.matched.prePost, t.matched.prePost, t.matched.prePost === null);
  push('totals', 'calibration', 'matched return+after', 'people', t.matched.postReturn, t.matched.postReturn, t.matched.postReturn === null);
  for (const k of r.kpis) {
    const group = `KPI ${k.number} ${k.label}`;
    for (const c of k.calibration) {
      push('calibration', group, `${c.label}: before`, 'people', c.pre.n, c.pre.mean, c.pre.suppressed);
      push('calibration', group, `${c.label}: after`, 'people', c.post.n, c.post.mean, c.post.suppressed);
      push('calibration', group, `${c.label}: return`, 'people', c.return.n, c.return.mean, c.return.suppressed);
      push('calibration', group, `${c.label}: ${c.changeLabel}`, 'people', c.change.n, c.change.mean, c.change.suppressed, c.change.ci95);
    }
    for (const s of k.signals) push('in-game', group, s.label, s.unit, s.stat.n, s.stat.value, s.stat.suppressed);
  }
  for (const h of r.holdLatency) push('hold latency', 'all', h.label, 'players', h.n, h.n, h.n === null);
  for (const m of r.missions) {
    const group = `${m.title} (${m.missionId})`;
    push('mission', group, 'squads', 'squads', m.squads.n, m.squads.value, m.squads.suppressed);
    const rows2: [string, string, Stat][] = [
      ['completion', 'squads', m.completion],
      ['hold rate', 'players', m.holdRate],
      ['first seal safest', 'players', m.firstSafe],
      ['final safest', 'players', m.finalSafe],
      ['shifted safer', 'players', m.shiftedSafer],
      ['forecast likely', 'players', m.forecast],
      ['influence traced', 'players', m.trace],
      ['peer shield success', 'squads', m.shieldSuccess],
    ];
    for (const [label, unit, s] of rows2) push('mission', group, label, unit, s.n, s.value, s.suppressed);
    if (m.mostMissed) push('mission', group, `most-missed clue: ${m.mostMissed.label}`, 'squads', m.mostMissed.found.n, m.mostMissed.found.value, m.mostMissed.found.suppressed);
    for (const d of m.decisions) push('mission', group, `Exit decided: ${d.label}`, 'squads', d.squads, d.squads, d.squads === null);
  }
  for (const s of r.sessions) {
    const group = `${s.hour} ${s.band}`;
    push('session', group, 'seats', 'players', s.seats, s.seats, s.seats === null);
    push('session', group, 'hold rate', 'players', s.holdRate.n, s.holdRate.value, s.holdRate.suppressed);
    push('session', group, 'shifted safer', 'players', s.shiftedSafer.n, s.shiftedSafer.value, s.shiftedSafer.suppressed);
    push('session', group, 'missions completed', 'missions', s.missionsCompleted, s.missionsCompleted, false);
    push('session', group, 'lanterns', 'room', s.lanterns, s.lanterns, s.lanterns === null);
  }
  return `${rows.map((row) => row.join(',')).join('\r\n')}\r\n`;
}
