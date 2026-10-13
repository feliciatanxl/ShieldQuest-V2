import { describe, expect, it } from 'vitest';
import {
  ASSESSMENT_CODE_ALPHABET,
  ASSESSMENT_CODE_WORDS,
  ASSESSMENT_ITEMS,
  ASSESSMENT_KINDS,
  ASSESSMENT_METRICS,
  BANDS,
  SQUAD_TOTEMS,
  TACTICS,
  assessmentCodeProblem,
  assessmentFormFor,
  assessmentItems,
  buildAssessmentResponse,
  cleanAnswers,
  estimateMinutes,
  isAssessmentCode,
  lintFreeText,
  makeAssessmentCode,
  normalizeAssessmentCode,
  probit,
  scoreAssessment,
  signalDetection,
  summarise,
  type AssessmentAnswers,
  type AssessmentForm,
  type AssessmentItem,
  type AssessmentKind,
  type AssessmentResponse,
  type AssessmentScores,
  type BandId,
} from '../src';

const BAND_IDS = BANDS.map((b) => b.id);
const FORMS: Record<AssessmentKind, AssessmentForm[]> = { pre: ['A', 'B'], post: ['A', 'B'], return: ['C'] };

/** The best possible answer to every item (proves every item is answerable and scorable). */
function perfectAnswers(items: readonly AssessmentItem[]): AssessmentAnswers {
  const out: AssessmentAnswers = {};
  for (const item of items) {
    switch (item.type) {
      case 'twin':
        out[item.id] = { type: 'twin', pick: item.scam, confidence: 3 };
        break;
      case 'flags':
        out[item.id] = { type: 'flags', picked: item.segments.filter((s) => s.flag).map((s) => s.id) };
        break;
      case 'choice':
        out[item.id] = { type: 'choice', option: item.options.find((o) => o.best)!.id };
        break;
      case 'likert':
        out[item.id] = { type: 'likert', value: 5 };
        break;
      case 'poll':
        out[item.id] = { type: 'poll', option: item.options[0]!.id };
        break;
      case 'chips':
        out[item.id] = { type: 'chips', chips: [item.chips[0]!.id] };
        break;
      case 'jammed':
        out[item.id] = {
          type: 'jammed',
          option: item.options.find((o) => o.best)!.id,
          tell: item.tell.filter((t) => t.trusted).map((t) => t.id),
        };
        break;
    }
  }
  return out;
}

const signature = (items: readonly AssessmentItem[]) =>
  items.filter((i) => i.form !== '*').map((i) => `${i.order}:${i.type}:${i.kpi}`);

/** Every player-facing string in an item (ids are skipped). */
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'id') strings(x, out);
  return out;
}

describe('signal detection', () => {
  it('inverts the normal CDF accurately', () => {
    expect(probit(0.5)).toBeCloseTo(0, 9);
    expect(probit(0.975)).toBeCloseTo(1.959964, 5);
    expect(probit(0.025)).toBeCloseTo(-1.959964, 5);
    expect(probit(0.001)).toBeCloseTo(-3.090232, 5);
    expect(probit(0)).toBe(-Infinity);
    expect(probit(1)).toBe(Infinity);
  });

  it('gives d′ = 0 and c = 0 at chance', () => {
    const r = signalDetection(3, 6, 3, 6);
    expect(r.dPrime).toBeCloseTo(0, 9);
    expect(r.c).toBeCloseTo(0, 9);
  });

  it('keeps d′ finite for perfect scores with the log-linear correction', () => {
    const r = signalDetection(6, 6, 0, 6);
    expect(r.hitRate).toBe(1);
    expect(r.falseAlarmRate).toBe(0);
    // H = 6.5/7, F = 0.5/7  ->  d′ = 2 z(0.92857)
    expect(r.dPrime).toBeCloseTo(2 * probit(6.5 / 7), 9);
    expect(r.dPrime).toBeCloseTo(2.930, 2);
    expect(r.c).toBeCloseTo(0, 9);
  });

  it('applies the 1/(2N) correction only at the extremes', () => {
    const perfect = signalDetection(6, 6, 0, 6, 'half-n');
    expect(perfect.dPrime).toBeCloseTo(2 * probit(5.5 / 6), 9);
    const mid = signalDetection(4, 6, 1, 6, 'half-n');
    expect(mid.dPrime).toBeCloseTo(probit(4 / 6) - probit(1 / 6), 9);
  });

  it('reads a negative criterion as calling everything a scam', () => {
    const jumpy = signalDetection(6, 6, 6, 6);
    expect(jumpy.dPrime).toBeCloseTo(0, 9);
    expect(jumpy.c).toBeLessThan(-1);
    const trusting = signalDetection(0, 6, 0, 6);
    expect(trusting.c).toBeGreaterThan(1);
  });

  it('refuses empty trial counts', () => {
    expect(() => signalDetection(0, 0, 0, 6)).toThrow();
  });
});

describe('assessment codes', () => {
  it('generates readable word codes from the unambiguous alphabet', () => {
    expect(ASSESSMENT_CODE_ALPHABET).toHaveLength(31);
    expect(ASSESSMENT_CODE_ALPHABET).not.toMatch(/[0O1IL]/);
    for (let i = 0; i < 500; i++) {
      const code = makeAssessmentCode();
      expect(isAssessmentCode(code), code).toBe(true);
      const [word, suffix] = code.split('-');
      expect(ASSESSMENT_CODE_WORDS).toContain(word);
      expect(suffix).toMatch(/[2-9]/);
      expect(suffix).not.toMatch(/[0O1IL]/);
    }
  });

  it('is deterministic with injected randomness and retries suffixes without a digit', () => {
    let call = 0;
    // First draw: all letters (rejected); second draw: index 23 = '2'.
    const ints = () => (call++ === 0 ? [0, 0, 1, 2] : [0, 23, 9, 30]);
    expect(makeAssessmentCode(ints)).toBe(`${ASSESSMENT_CODE_WORDS[0]}-2K9`);
  });

  it('has a clean, unique word list', () => {
    expect(new Set(ASSESSMENT_CODE_WORDS).size).toBe(ASSESSMENT_CODE_WORDS.length);
    expect(ASSESSMENT_CODE_WORDS.length).toBeGreaterThanOrEqual(100);
    for (const w of ASSESSMENT_CODE_WORDS) expect(w).toMatch(/^[A-Z]{3,7}$/);
    const totems = SQUAD_TOTEMS.map((t) => t.name.toUpperCase());
    for (const t of totems) expect(ASSESSMENT_CODE_WORDS).not.toContain(t);
  });

  it('normalises hand-typed codes', () => {
    expect(normalizeAssessmentCode(' kaya 7k2 ')).toBe('KAYA-7K2');
    expect(normalizeAssessmentCode('KAYA7K2')).toBe('KAYA-7K2');
    expect(normalizeAssessmentCode('kaya_7k2')).toBe('KAYA-7K2');
    expect(assessmentCodeProblem('kaya-7k2')).toBeNull();
    expect(assessmentCodeProblem('KAYA-0O1')).toMatch(/never use/);
    expect(assessmentCodeProblem('')).toMatch(/Type the code/);
    expect(assessmentCodeProblem('hello')).toMatch(/does not look/);
  });

  it('counterbalances forms A and B by the code, and uses C for the Return visit', () => {
    let aFirst = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const code = makeAssessmentCode();
      const pre = assessmentFormFor(code, 'pre');
      const post = assessmentFormFor(code, 'post');
      expect(pre).not.toBe(post);
      expect(['A', 'B']).toContain(pre);
      expect(assessmentFormFor(code, 'return')).toBe('C');
      expect(assessmentFormFor(code.toLowerCase(), 'pre')).toBe(pre);
      if (pre === 'A') aFirst++;
    }
    expect(aFirst / n).toBeGreaterThan(0.42);
    expect(aFirst / n).toBeLessThan(0.58);
  });
});

describe('item bank', () => {
  it('has unique item ids', () => {
    const ids = ASSESSMENT_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('builds parallel forms A, B and C for every band', () => {
    for (const band of BAND_IDS) {
      const a = assessmentItems('pre', band, 'A');
      const b = assessmentItems('pre', band, 'B');
      const c = assessmentItems('pre', band, 'C');
      expect(signature(a), band).toEqual(signature(b));
      expect(signature(a), band).toEqual(signature(c));
      const ids = [...a, ...b, ...c].filter((i) => i.form !== '*').map((i) => i.id);
      expect(new Set(ids).size, `${band}: no item is shared between forms`).toBe(ids.length);
      const count = (items: AssessmentItem[], pred: (i: AssessmentItem) => boolean) => items.filter(pred).length;
      for (const form of [a, b, c]) {
        expect(count(form, (i) => i.type === 'twin')).toBe(6);
        expect(count(form, (i) => i.type === 'flags')).toBe(1);
        expect(count(form, (i) => i.kpi === 'decision')).toBe(3);
        expect(count(form, (i) => i.kpi === 'consequence')).toBe(3);
        expect(count(form, (i) => i.kpi === 'peer' && i.type === 'choice')).toBe(1);
        expect(count(form, (i) => i.kpi === 'peer' && i.type === 'likert')).toBe(3);
        // Scams sit on the left and right equally often, so position bias cannot inflate scores.
        expect(count(form, (i) => i.type === 'twin' && i.scam === 'a')).toBe(3);
      }
    }
  });

  it('adds feedback only after play and the jammed Freeze only on the Return visit', () => {
    for (const band of BAND_IDS) {
      const pre = assessmentItems('pre', band, 'A');
      const post = assessmentItems('post', band, 'B');
      const ret = assessmentItems('return', band, 'C');
      expect(pre.some((i) => i.kpi === 'engagement' || i.type === 'jammed')).toBe(false);
      expect(post.filter((i) => i.kpi === 'engagement' && i.type === 'likert')).toHaveLength(5);
      expect(post.some((i) => i.type === 'poll')).toBe(true);
      expect(post.some((i) => i.type === 'chips')).toBe(true);
      expect(ret.filter((i) => i.type === 'jammed')).toHaveLength(1);
      expect(ret[0]?.type).toBe('jammed');
    }
  });

  it('keeps each visit short (about 5 minutes before, about 6 after)', () => {
    for (const band of BAND_IDS) {
      expect(estimateMinutes(assessmentItems('pre', band, 'A'))).toBeLessThanOrEqual(6);
      expect(estimateMinutes(assessmentItems('pre', band, 'A'))).toBeGreaterThanOrEqual(4);
      expect(estimateMinutes(assessmentItems('post', band, 'B'))).toBeLessThanOrEqual(7);
      expect(estimateMinutes(assessmentItems('return', band, 'C'))).toBeLessThanOrEqual(7);
    }
  });

  it('makes every item well-formed and answerable', () => {
    const tactics = new Set<string>(TACTICS.map((t) => t.id));
    for (const item of ASSESSMENT_ITEMS) {
      expect(item.bands.length, item.id).toBeGreaterThan(0);
      switch (item.type) {
        case 'twin':
          expect(tactics.has(item.tactic), item.id).toBe(true);
          expect(item.a.text).not.toBe(item.b.text);
          expect(item.cue.length).toBeGreaterThan(20);
          break;
        case 'flags': {
          const flagged = item.segments.filter((s) => s.flag);
          expect(flagged.length, item.id).toBeGreaterThanOrEqual(3);
          expect(item.segments.length - flagged.length, item.id).toBeGreaterThanOrEqual(2);
          for (const s of flagged) expect(tactics.has(s.flag!) || s.flag === 'link' || s.flag === 'data').toBe(true);
          break;
        }
        case 'choice':
        case 'jammed': {
          expect(item.options.filter((o) => o.best), item.id).toHaveLength(1);
          expect(new Set(item.options.map((o) => o.id)).size).toBe(item.options.length);
          const max = item.bands.includes('junior') && item.bands.length === 1 ? 3 : 4;
          expect(item.options.length, item.id).toBeLessThanOrEqual(max);
          expect(item.options.length, item.id).toBeGreaterThanOrEqual(3);
          if (item.type === 'jammed') {
            expect(item.tell.some((t) => t.trusted)).toBe(true);
            expect(item.tell.some((t) => !t.trusted)).toBe(true);
          }
          break;
        }
        default:
          break;
      }
    }
  });

  it('passes the content safety lint: no personal data, no blame, fictional .test links only', () => {
    for (const item of ASSESSMENT_ITEMS) {
      for (const text of strings(item)) {
        expect(lintFreeText(text), `${item.id}: ${text}`).toEqual([]);
        for (const url of text.match(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?/gi) ?? []) {
          if (/^\d/.test(url)) continue;
          expect(url, `${item.id}: ${url}`).toMatch(/\.(test|example)(\/|$)/);
        }
        expect(text).not.toMatch(/\b(carousell|shopee|whatsapp|telegram|paynow|paylah|dbs|ocbc|uob|posb|singpass)\b/i);
      }
    }
  });
});

describe('scoring', () => {
  const cases: [AssessmentKind, AssessmentForm, BandId][] = ASSESSMENT_KINDS.flatMap((kind) =>
    FORMS[kind].flatMap((form) => BAND_IDS.map((band) => [kind, form, band] as [AssessmentKind, AssessmentForm, BandId])),
  );

  it.each(cases)('scores perfect %s answers on form %s (%s) at the ceiling', (kind, form, band) => {
    const items = assessmentItems(kind, band, form);
    const raw = perfectAnswers(items);
    const { answers, dropped } = cleanAnswers(items, raw);
    expect(dropped).toBe(0);
    expect(Object.keys(answers)).toHaveLength(items.length);
    const s = scoreAssessment(items, answers);
    expect(s.answered).toBe(1);
    expect(s.twinAccuracy).toBe(1);
    expect(s.hitRate).toBe(1);
    expect(s.falseAlarmRate).toBe(0);
    expect(s.dPrime).toBeGreaterThan(2.5);
    expect(s.criterion).toBeCloseTo(0, 6);
    expect(s.flagHitRate).toBe(1);
    expect(s.flagFalseAlarmRate).toBe(0);
    expect(s.decisionAccuracy).toBe(1);
    expect(s.consequenceAccuracy).toBe(1);
    expect(s.peerJudgement).toBe(1);
    expect(s.peerConfidence).toBe(5);
    expect(s.knowledge).toBe(1);
    expect(s.confidentMiss).toBe(0);
    if (kind === 'post') {
      expect(s.engagement).toBe(5);
      expect(s.playAgain).toBe(1);
    } else expect(s.engagement).toBeUndefined();
    if (kind === 'return') {
      expect(s.jammedAction).toBe(1);
      expect(s.jammedTell).toBe(1);
    } else expect(s.jammedAction).toBeUndefined();
  });

  it('turns "both are scams" into false alarms and a negative criterion', () => {
    const items = assessmentItems('pre', 'teen', 'A');
    const answers: AssessmentAnswers = {};
    for (const i of items) if (i.type === 'twin') answers[i.id] = { type: 'twin', pick: 'both', confidence: 3 };
    const s = scoreAssessment(items, answers);
    expect(s.hitRate).toBe(1);
    expect(s.falseAlarmRate).toBe(1);
    expect(s.twinAccuracy).toBe(0);
    expect(s.dPrime).toBeCloseTo(0, 6);
    expect(s.criterion).toBeLessThan(0);
    expect(s.confidentMiss).toBe(1);
    expect(s.decisionAccuracy).toBeUndefined();
  });

  it('treats skipped items as absent, and an empty flag answer as zero hits', () => {
    const items = assessmentItems('pre', 'junior', 'B');
    const flagsItem = items.find((i) => i.type === 'flags')!;
    const s = scoreAssessment(items, { [flagsItem.id]: { type: 'flags', picked: [] } });
    expect(s.flagHitRate).toBe(0);
    expect(s.flagFalseAlarmRate).toBe(0);
    expect(s.dPrime).toBeUndefined();
    expect(s.answered).toBeCloseTo(1 / items.length, 3);
    expect(scoreAssessment(items, {})).toEqual({ answered: 0 });
  });

  it('drops unknown items, wrong types and invalid options', () => {
    const items = assessmentItems('pre', 'young-adult', 'A');
    const choiceItem = items.find((i) => i.type === 'choice')!;
    const twinItem = items.find((i) => i.type === 'twin')!;
    const { answers, dropped } = cleanAnswers(items, {
      'Z.unknown': { type: 'choice', option: 'a' },
      [choiceItem.id]: { type: 'choice', option: 'zz' },
      [twinItem.id]: { type: 'likert', value: 3 },
      'P.cf.1': { type: 'likert', value: 9 },
      'P.cf.2': { type: 'likert', value: 4 },
    });
    expect(dropped).toBe(4);
    expect(answers).toEqual({ 'P.cf.2': { type: 'likert', value: 4 } });
  });

  it('builds a stored response with a derived form, server scores and an hour-rounded time', () => {
    const code = 'KAYA-7K2';
    const form = assessmentFormFor(code, 'pre');
    const items = assessmentItems('pre', 'teen', form);
    const { response, dropped } = buildAssessmentResponse(
      { code: 'kaya 7k2', kind: 'pre', band: 'teen', sessionCode: 'H7KQ2M', answers: perfectAnswers(items) },
      Date.UTC(2026, 9, 12, 9, 47, 31, 123),
    );
    expect(dropped).toBe(0);
    expect(response.id).toBe('KAYA-7K2:pre');
    expect(response.form).toBe(form);
    expect(response.createdAtHour).toBe('2026-10-12T09:00:00.000Z');
    expect(response.sessionCode).toBe('H7KQ2M');
    expect(response.scores.twinAccuracy).toBe(1);
  });
});

describe('summary', () => {
  let seq = 0;
  function resp(kind: AssessmentKind, code: string, scores: AssessmentScores, band: BandId = 'teen'): AssessmentResponse {
    seq++;
    return {
      id: `${code}:${kind}`,
      code,
      kind,
      form: assessmentFormFor(code, kind),
      band,
      createdAtHour: '2026-10-12T09:00:00.000Z',
      answers: kind === 'post' ? { 'E.reflect': { type: 'chips', chips: seq % 2 ? ['pause', 'ask'] : ['pause'] } } : {},
      scores,
      version: 1,
    };
  }
  const codes = ['KAYA-2A3', 'ROTI-3B4', 'TAHU-4C5', 'BAO-5D6', 'KOPI-6E7', 'MANGO-7F8'];
  const metric = (s: ReturnType<typeof summarise>, id: string) =>
    s.kpis.flatMap((k) => k.metrics).find((m) => m.id === id)!;

  it('suppresses every cell with fewer than 5 people', () => {
    const s = summarise(codes.slice(0, 4).map((c, i) => resp('pre', c, { twinAccuracy: i / 6, dPrime: i })));
    expect(s.responses.pre).toBeNull();
    const m = metric(s, 'dPrime');
    expect(m.pre).toEqual({ n: null, mean: null, sd: null, suppressed: true });
    expect(s.bands.teen).toBeNull();
    expect(s.reflections).toBeNull();
  });

  it('reports means at n >= 5 and refuses a lower threshold', () => {
    const list = codes.slice(0, 5).map((c, i) => resp('pre', c, { dPrime: i }));
    const s = summarise(list, { minGroup: 2 });
    expect(s.minGroup).toBe(5);
    expect(s.responses.pre).toBe(5);
    const m = metric(s, 'dPrime');
    expect(m.pre.n).toBe(5);
    expect(m.pre.mean).toBe(2);
    expect(m.pre.sd).toBeCloseTo(Math.sqrt(2.5), 3);
    expect(m.post.suppressed).toBe(true);
  });

  it('computes within-person deltas with 95% confidence intervals, matched by code', () => {
    const pre = codes.map((c, i) => resp('pre', c, { twinAccuracy: 0.5, knowledge: 0.4 + i * 0.01 }));
    const post = codes.map((c, i) => resp('post', c, { twinAccuracy: 0.5 + (i % 2 ? 0.2 : 0.4), knowledge: 0.7 }));
    const s = summarise([...pre, ...post]);
    expect(s.matched.prePost).toBe(6);
    const d = metric(s, 'twinAccuracy').postVsPre;
    expect(d.suppressed).toBe(false);
    expect(d.n).toBe(6);
    expect(d.mean).toBeCloseTo(0.3, 6);
    expect(d.ci95![0]).toBeLessThan(0.3);
    expect(d.ci95![1]).toBeGreaterThan(0.3);
    // Half-width = t(5) * sd / sqrt(n) = 2.571 * 0.10954 / 2.4495
    expect(d.ci95![1] - 0.3).toBeCloseTo((2.571 * 0.109545) / Math.sqrt(6), 3);
    expect(metric(s, 'twinAccuracy').returnVsPost.suppressed).toBe(true);
  });

  it('suppresses deltas when fewer than 5 people completed both visits', () => {
    const pre = codes.map((c) => resp('pre', c, { knowledge: 0.5 }));
    const post = [...codes.slice(0, 4), 'LIME-8G9', 'PEAR-9H2'].map((c) => resp('post', c, { knowledge: 0.8 }));
    const s = summarise([...pre, ...post]);
    expect(s.responses.pre).toBe(6);
    expect(s.responses.post).toBe(6);
    expect(s.matched.prePost).toBeNull();
    expect(metric(s, 'knowledge').postVsPre.suppressed).toBe(true);
    expect(metric(s, 'knowledge').post.mean).toBe(0.8);
  });

  it('counts the latest response per code once, and suppresses rare reflection chips', () => {
    const post = codes.map((c) => resp('post', c, { engagement: 4 }));
    const s = summarise([...post, resp('post', codes[0]!, { engagement: 2 })]);
    expect(s.responses.post).toBe(6);
    expect(metric(s, 'engagement').post.mean).toBeCloseTo((4 * 5 + 2) / 6, 3);
    const pause = s.reflections!.find((r) => r.id === 'pause')!;
    expect(pause.count).toBe(6);
    expect(pause.share).toBe(1);
    const ask = s.reflections!.find((r) => r.id === 'ask')!;
    expect(ask.count).toBeNull();
  });

  it('describes every metric it reports', () => {
    const s = summarise([]);
    const reported = s.kpis.flatMap((k) => k.metrics.map((m) => m.id));
    expect(reported.sort()).toEqual(ASSESSMENT_METRICS.map((m) => m.id).sort());
    expect(s.kpis.map((k) => k.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
