// Content safety lint for missions and youth-created submissions.
// Runs in tests (every built-in mission must pass), in the Scenario Portal before publishing,
// and on free text typed by players (personal-data guard).

import { TACTICS } from './framework';
import { RETIRED_CONTACTS } from './help';
import { SCENES, type Mission } from './mission';

export interface LintIssue {
  level: 'error' | 'warning';
  path: string;
  message: string;
}

/** Personal data patterns that must never be collected or published. */
export const PII_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'NRIC/FIN number', pattern: /\b[STFGM]\d{7}[A-Z]\b/i },
  { name: 'Singapore phone number', pattern: /(\+65[\s-]?)?\b[3689]\d{3}[\s-]?\d{4}\b/ },
  { name: 'email address', pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  { name: 'social media handle', pattern: /(^|\s)@[a-z0-9_.]{3,}/i },
  { name: 'long number', pattern: /\d{8,}/ },
];

/** Returns the names of personal-data patterns found in free text (empty = safe). */
export function findPersonalData(text: string): string[] {
  return PII_PATTERNS.filter((p) => p.pattern.test(text)).map((p) => p.name);
}

/** Words that blame or shame the target. Feedback must blame the manipulator's tactic instead. */
const VICTIM_BLAMING = [
  /\bstupid\b/i,
  /\bidiot\b/i,
  /\bgreedy\b/i,
  /\bnaive\b/i,
  /\bgullible\b/i,
  /\bdeserved?\b/i,
  /\byour (own )?fault\b/i,
  /\bshould have known\b/i,
  /\bfell for\b/i,
  /\bcareless\b/i,
  /\bdumb\b/i,
];

/** Real brands/platforms/institutions are fictionalised in-game. */
const REAL_BRANDS = [
  'carousell',
  'shopee',
  'lazada',
  'whatsapp',
  'telegram',
  'tiktok',
  'instagram',
  'facebook',
  'paynow',
  'paylah',
  'grab',
  'dbs',
  'ocbc',
  'uob',
  'posb',
  'singpost',
  'ninja van',
  'sheng siong',
  'ntuc',
  'fairprice',
  'watsons',
  'guardian pharmacy',
  'roblox',
  'steam',
  'discord',
  'nus',
  'ntu',
  'singpass app',
];

/** Visual/graphic content excluded from all scenarios (see fact-check content warnings). */
const EXCLUDED_THEMES = [/\bsextortion\b/i, /\bnude/i, /\bintimate image/i, /\bcaning\b/i, /\bself-?harm method/i];

function allText(m: Mission): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const walk = (v: unknown, path: string) => {
    if (typeof v === 'string') out.push({ path, text: v });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(m, '');
  return out;
}

const URL_RE = /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/gi;
const SAFE_DOMAIN = /\.(example|test|invalid)(\/|\b|$)/i;
const ALLOWED_REAL_DOMAINS = /^(?:https?:\/\/)?(?:www\.)?(scamshield\.gov\.sg|police\.gov\.sg|go\.gov\.sg)/i;

/** Rough reading-level estimate (Flesch-Kincaid grade). Used as a warning only. */
export function readingGrade(text: string): number {
  const sentences = Math.max(1, (text.match(/[.!?]+/g) ?? []).length);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const syllables = words.reduce((n, w) => n + Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) ?? []).length), 0);
  return 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
}

export function lintMission(m: Mission): LintIssue[] {
  const issues: LintIssue[] = [];
  const err = (path: string, message: string) => issues.push({ level: 'error', path, message });
  const warn = (path: string, message: string) => issues.push({ level: 'warning', path, message });

  // Structure and references
  const castIds = new Set(m.cast.map((c) => c.id));
  const beatIds = new Set(m.live.beats.map((b) => b.id));
  const choiceIds = new Set(m.choices.map((c) => c.id));
  const anchors = new Set<string>(SCENES[m.scene]);
  const tacticIds = new Set<string>(TACTICS.map((t) => t.id));
  if (!castIds.has(m.resident)) err('resident', `resident "${m.resident}" is not in the cast`);
  m.cast.forEach((c, i) => {
    if (c.anchor && !anchors.has(c.anchor)) err(`cast[${i}].anchor`, `"${c.anchor}" is not an anchor of scene ${m.scene}`);
    if ((c.role === 'stranger' || c.role === 'pressurer') && c.anchor && !c.faceless && c.role === 'stranger')
      warn(`cast[${i}]`, 'strangers present in the scene should be faceless silhouettes');
  });
  m.live.beats.forEach((b, i) => {
    if (b.from !== 'narrator' && !castIds.has(b.from)) err(`live.beats[${i}].from`, `unknown cast id "${b.from}"`);
    if (b.at < 0 || b.at > m.live.durationSec) err(`live.beats[${i}].at`, 'beat time is outside the live phase');
    if (b.tactic && !tacticIds.has(b.tactic)) err(`live.beats[${i}].tactic`, `unknown tactic "${b.tactic}"`);
  });
  if (new Set(m.live.beats.map((b) => b.id)).size !== m.live.beats.length) err('live.beats', 'duplicate beat ids');
  m.clues.forEach((c, i) => {
    if (c.target.kind === 'beat' && !beatIds.has(c.target.beatId)) err(`clues[${i}].target`, `unknown beat "${c.target.beatId}"`);
    if (c.target.kind === 'anchor' && !anchors.has(c.target.anchor))
      err(`clues[${i}].target`, `"${c.target.anchor}" is not an anchor of scene ${m.scene}`);
  });
  const redFlags = m.clues.filter((c) => c.redFlag).length;
  if (redFlags < 3) err('clues', 'needs at least 3 red-flag clues');
  if (m.clues.length - redFlags < 1) err('clues', 'needs at least 1 ordinary-detail clue so players learn not to distrust everything');
  if (!castIds.has(m.influence.from)) err('influence.from', `unknown cast id "${m.influence.from}"`);
  if (m.influence.options.filter((o) => o.correct).length !== 1) err('influence.options', 'exactly one option must be correct');
  if (m.forecast.options.filter((o) => o.likely).length < 1) err('forecast.options', 'at least one option must be marked likely');
  if (m.choices.length < 2 || m.choices.length > 4) err('choices', 'missions need 2–4 choices');
  if (!m.choices.some((c) => c.safety === 'safe')) err('choices', 'at least one choice must be safe');
  m.choices.forEach((c, i) => {
    if (!tacticIds.has(c.feedback.tactic)) err(`choices[${i}].feedback.tactic`, `unknown tactic "${c.feedback.tactic}"`);
    if (c.safety === 'risky' && c.aftershock?.polarity !== 'risk') err(`choices[${i}]`, 'risky choices need a delayed risk Aftershock');
    if (c.aftershock?.polarity === 'risk' && !c.aftershock.recovery?.options.some((o) => o.good))
      err(`choices[${i}].aftershock.recovery`, 'every risk Aftershock needs at least one good recovery path');
    if (c.aftershock?.polarity === 'protective' && (c.aftershock.effects.trust ?? 0) < 0)
      err(`choices[${i}].aftershock`, 'an Afterglow cannot reduce trust');
    if (!c.feedback.ifItHappened.trim()) err(`choices[${i}].feedback.ifItHappened`, 'feedback needs a recovery step');
  });
  m.perspectives.forEach((p, i) => {
    if (!choiceIds.has(p.leaning)) err(`perspectives[${i}].leaning`, `unknown choice "${p.leaning}"`);
  });
  if (m.perspectives.length < 2) err('perspectives', 'needs at least 2 perspectives for the Explain step');
  if (m.peerShield) {
    if (!castIds.has(m.peerShield.friend)) err('peerShield.friend', 'unknown cast id');
    for (const slot of ['opener', 'reason', 'offer', 'channel'] as const) {
      const tiles = m.peerShield.slots[slot];
      if (tiles.length < 2) err(`peerShield.slots.${slot}`, 'needs at least 2 tiles');
      if (!tiles.some((t) => t.quality === 'great')) err(`peerShield.slots.${slot}`, 'needs a great tile');
    }
  }
  if (m.sources.length === 0) err('sources', 'cite at least one source with an as-of date');
  if (m.help.length === 0) err('help', 'list at least one help channel');

  // Text safety
  for (const { path, text } of allText(m)) {
    if (path.startsWith('sources')) continue;
    for (const re of VICTIM_BLAMING) if (re.test(text)) err(path, `victim-blaming language: "${text.match(re)?.[0]}"`);
    for (const r of RETIRED_CONTACTS) if (r.pattern.test(text)) err(path, `retired contact detail; use ${r.replacement}`);
    for (const re of EXCLUDED_THEMES) if (re.test(text)) err(path, `excluded theme: "${text.match(re)?.[0]}"`);
    const lower = text.toLowerCase();
    for (const brand of REAL_BRANDS)
      if (new RegExp(`\\b${brand.replace(/ /g, '\\s')}\\b`, 'i').test(lower)) err(path, `real brand "${brand}" — use a fictional name`);
    if (/\b[STFGM]\d{7}[A-Z]\b/.test(text)) err(path, 'looks like an NRIC/FIN number');
    if (/(\+65[\s-]?)?\b[689]\d{3}[\s-]?\d{4}\b/.test(text) && !/1800|1799|999|1771|1767|70999/.test(text))
      err(path, 'looks like a real Singapore phone number; use a visibly fake one (e.g. 8XXX XXXX)');
    for (const url of text.match(URL_RE) ?? []) {
      if (/^\d/.test(url) || /^[a-z]\.[a-z]$/i.test(url)) continue;
      if (/^(e\.g|i\.e|a\.m|p\.m)\b/i.test(url)) continue;
      if (!SAFE_DOMAIN.test(url) && !ALLOWED_REAL_DOMAINS.test(url) && /\.(com|sg|net|org|io|co|xyz|app|link|ly)\b/i.test(url))
        err(path, `real-looking link "${url}" — use a .example or .test domain`);
    }
  }

  // Reading level guidance per band
  const band = m.bands.includes('junior') ? 6.5 : m.bands.includes('teen') ? 8.5 : 11;
  const playerText = [m.intro, ...m.live.beats.map((b) => b.text), ...m.choices.map((c) => c.label)].join(' ');
  const grade = readingGrade(playerText);
  if (grade > band + 1.5) warn('reading-level', `estimated reading grade ${grade.toFixed(1)} is high for this band (aim ≤ ${band})`);

  if (m.review.status === 'reviewed' && m.review.reviewers.length < 2) warn('review', 'reviewed missions should have two sign-offs');
  return issues;
}

/** Free-text guard for youth submissions and squad reasons: blocks personal data and blaming language. */
export function lintFreeText(text: string): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const name of findPersonalData(text)) issues.push({ level: 'error', path: 'text', message: `Please remove the ${name}.` });
  for (const re of VICTIM_BLAMING)
    if (re.test(text)) issues.push({ level: 'warning', path: 'text', message: `Try wording that blames the trick, not the person ("${text.match(re)?.[0]}").` });
  for (const re of EXCLUDED_THEMES)
    if (re.test(text)) issues.push({ level: 'error', path: 'text', message: 'This topic is not covered in ShieldQuest missions.' });
  return issues;
}
