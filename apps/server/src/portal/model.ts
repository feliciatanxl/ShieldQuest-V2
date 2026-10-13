// Scenario Portal model, shared by the server routes and the portal UI (apps/web/src/portal imports this
// file directly, so it must stay free of Node APIs and server-only packages).
//
// It holds:
// - the "Pitch a Frame" vocabulary for youth-made Moment Cards (GDD §7.4) and the free-text guard,
// - checkMission(): a structural check that makes lintMission safe on untrusted JSON, plus the extra
//   portal lint rules from GDD §7.4 / §9.6 that the shared lint does not cover yet,
// - the draft-mission skeleton an approved pitch turns into,
// - the API types of the portal, moderation and analytics routes.

import {
  BANDS,
  CAST_HAIRS,
  DISTRICTS,
  HELP_CHANNELS,
  SCENES,
  SCENE_IDS,
  SQUAD_TOTEMS,
  TACTICS,
  lintFreeText,
  lintMission,
  missionById,
  type AssessmentCell,
  type AssessmentDelta,
  type AssessmentKpiId,
  type AssessmentMetricInfo,
  type BandId,
  type CastRole,
  type DistrictId,
  type HoldBucket,
  type LintIssue,
  type Mission,
  type SceneId,
  type SquadTotemId,
  type TacticId,
} from '@shieldquest/shared';

/** Smallest group any portal view may show (GDD §7.5, §11.11). */
export const PORTAL_MIN_GROUP = 5;
export const SUPPRESSED_TEXT = 'Not enough responses to show (fewer than 5)';

// ---------------------------------------------------------------------------------------------
// Educator sign-in

export const DEV_PASSCODE = 'shieldquest-dev';
export const SESSION_HOURS = 8;
export const SIGNOFF_ROLES = ['content', 'safeguarding'] as const;
export type SignoffRole = (typeof SIGNOFF_ROLES)[number];
export const SIGNOFF_LABEL: Record<SignoffRole, string> = {
  content: 'Content accuracy (sources and review-by date)',
  safeguarding: 'Safeguarding and tone',
};

/** Reviewer identity is initials only (e.g. "FT"), never a name. */
export function normalizeInitials(raw: string): string {
  return raw.replace(/[\s.]/g, '').toUpperCase();
}
export const isInitials = (s: string): boolean => /^[A-Z]{1,4}$/.test(s);

export interface LoginResponse {
  token: string;
  expiresAt: string;
  initials: string | null;
  /** True when the server accepted the development passcode (never in production). */
  devPasscode: boolean;
}

// ---------------------------------------------------------------------------------------------
// Youth-made Moment Cards ("Pitch a Frame")

export const PITCH_LIMITS = { whatTheySay: 280, short: 140, tactics: 3, redFlags: 3, note: 280, cohort: 40 } as const;

export interface PitchSetting {
  id: string;
  label: string;
  scene: SceneId;
  districts: readonly DistrictId[];
  online?: boolean;
}

const EVERY_DISTRICT = DISTRICTS.map((d) => d.id);

export const PITCH_SETTINGS: readonly PitchSetting[] = [
  { id: 'school-gate', label: 'School gate or bus stop', scene: 'school-gate', districts: ['school-street', 'interchange'] },
  { id: 'canteen', label: 'Canteen or lockers', scene: 'canteen', districts: ['school-street'] },
  { id: 'class-chat', label: 'Class group chat', scene: 'digi-sky', districts: ['school-street', 'digi-district'], online: true },
  { id: 'online-game', label: 'Online game', scene: 'digi-sky', districts: ['school-street', 'digi-district'], online: true },
  { id: 'convenience-shop', label: 'Convenience shop', scene: 'minimart', districts: ['retail-district'] },
  { id: 'mall', label: 'Mall or phone shop', scene: 'minimart', districts: ['retail-district'] },
  { id: 'food-court', label: 'Food court', scene: 'food-court', districts: ['retail-district', 'interchange'] },
  { id: 'marketplace', label: 'Online marketplace', scene: 'digi-sky', districts: ['digi-district'], online: true },
  { id: 'job-app', label: 'Job or gig app', scene: 'digi-sky', districts: ['digi-district'], online: true },
  { id: 'social-feed', label: 'Social media feed', scene: 'digi-sky', districts: ['digi-district', 'school-street'], online: true },
  { id: 'void-deck', label: 'Void deck or lift lobby', scene: 'void-deck', districts: ['void-deck-commons'] },
  { id: 'letterbox', label: 'Letterbox or parcel', scene: 'void-deck', districts: ['void-deck-commons', 'digi-district'] },
  { id: 'interchange', label: 'Bus or train interchange', scene: 'school-gate', districts: ['interchange'] },
  { id: 'home-night', label: 'At home, late at night', scene: 'bedroom', districts: EVERY_DISTRICT, online: true },
];

export const PITCH_PUSHERS = [
  { id: 'stranger', label: 'A stranger', castRole: 'stranger' },
  { id: 'friend', label: 'A friend or classmate', castRole: 'friend' },
  { id: 'online-seller', label: 'An online seller', castRole: 'pressurer' },
  { id: 'company', label: 'A "company" or "official"', castRole: 'pressurer' },
] as const satisfies readonly { id: string; label: string; castRole: CastRole }[];
export type PitchPusherId = (typeof PITCH_PUSHERS)[number]['id'];

/** Warning signs, worded like the Counter-Playbook. Each maps to the tactic it exposes. */
export const PITCH_RED_FLAGS = [
  { id: 'rush', label: 'They rush you', tactic: 'urgency' },
  { id: 'too-much-money', label: 'Too much money for too little', tactic: 'too-good' },
  { id: 'keep-secret', label: 'They say to keep it secret', tactic: 'secrecy' },
  { id: 'asks-account', label: 'They ask for a login, code or bank account', tactic: 'small-ask' },
  { id: 'pay-first', label: 'You must pay or send something first', tactic: 'small-ask' },
  { id: 'cant-check', label: "Proof you can't check yourself", tactic: 'fake-proof' },
  { id: 'strange-link', label: 'A strange link', tactic: 'fake-proof' },
  { id: 'everyone', label: '"Everyone does it"', tactic: 'everyone-does-it' },
  { id: 'guilt', label: 'Guilt: "if you were my friend…"', tactic: 'loyalty' },
  { id: 'official', label: 'They claim to be official', tactic: 'authority' },
  { id: 'threat', label: 'Threats or scary warnings', tactic: 'fear' },
] as const satisfies readonly { id: string; label: string; tactic: TacticId }[];
export type PitchRedFlagId = (typeof PITCH_RED_FLAGS)[number]['id'];

export const PITCH_SAFER_MOVES = [
  { id: 'pause-check', label: 'Pause and check it yourself' },
  { id: 'tell-adult', label: 'Tell a trusted adult' },
  { id: 'say-no', label: 'Say no and walk away' },
  { id: 'official-channel', label: 'Contact the real company yourself' },
  { id: 'block-report', label: 'Block and report' },
  { id: 'warn-friend', label: 'Warn a friend' },
] as const;
export type PitchSaferMoveId = (typeof PITCH_SAFER_MOVES)[number]['id'];

export const PITCH_RECOVERY_MOVES = [
  { id: 'tell-fast', label: 'Tell a trusted adult straight away' },
  { id: 'call-bank', label: 'Call the bank on the number on the card' },
  { id: 'change-password', label: 'Change passwords and log out other devices' },
  { id: 'report', label: 'Report it to ScamShield or the police' },
  { id: 'stop-replying', label: 'Stop replying and keep the evidence' },
] as const;
export type PitchRecoveryId = (typeof PITCH_RECOVERY_MOVES)[number]['id'];

/** What the pitch form sends to POST /api/submissions. */
export interface PitchInput {
  band: BandId;
  district: DistrictId;
  setting: string;
  pusher?: PitchPusherId;
  pressureTactics: TacticId[];
  whatTheySay: string;
  redFlags: { chips: PitchRedFlagId[]; text?: string };
  saferMove: { chip?: PitchSaferMoveId; text?: string };
  recoveryMove?: PitchRecoveryId;
  /** Credit only: "Squad Hornbill". */
  totem?: SquadTotemId;
  /** Cohort maker code from the take-home card (required only when the server says so). */
  makerCode?: string;
  consent: true;
}

export type PitchField = 'whatTheySay' | 'redFlags.text' | 'saferMove.text' | 'makerCode' | 'form';

export interface PitchProblem {
  field: PitchField;
  level: 'error' | 'warning';
  message: string;
}

/** Named schools and Singapore institution abbreviations: Moment Cards are fictional only. */
const SCHOOL_NAME =
  /\b[A-Z][a-zA-Z']+(?:\s[A-Z][a-zA-Z']+)?\s(?:Primary|Secondary|High|Junior College|Polytechnic|Poly|Institute|Academy|International School)\b/;
const INSTITUTIONS = /\b(?:NYP|NP|SP|TP|RP|ITE|NUS|NTU|SMU|SUTD|SIT|SUSS|RI|HCI|ACS|ACJC|VJC|NJC|TJC|SAJC|RJC)\b/;
const PROFANITY =
  /\b(?:f+u+c+k+\w*|sh[i1]t+\w*|b[i1]tch\w*|cunt\w*|assholes?|bastards?|dickheads?|wankers?|knn|cb|chee\s?bye?|chee\s?bai|lan\s?jiao|pukimak)\b/i;

// Real apps, banks and shops, after the brand list inside lintMission (not exported yet). Everyday words
// such as "grab" and "steam" are left out here so a youth writing "grab it now" is not warned.
// (TODO(contract): export REAL_BRANDS from packages/shared/src/lint.ts and use it here).
const REAL_BRAND =
  /\b(?:carousell|shopee|lazada|whats\s?app|telegram|tik\s?tok|instagram|insta|facebook|snapchat|paynow|paylah|gojek|dbs|ocbc|uob|posb|singpost|ninja van|sheng siong|ntuc|fairprice|watsons|guardian pharmacy|roblox|discord|youtube)\b/i;

/** Problems in one free-text pitch field (runs the same way on the device and on the server). */
export function pitchTextProblems(text: string, field: PitchField): PitchProblem[] {
  const out: PitchProblem[] = [];
  for (const issue of lintFreeText(text)) out.push({ field, level: issue.level, message: issue.message });
  if (SCHOOL_NAME.test(text) || INSTITUTIONS.test(text))
    out.push({ field, level: 'error', message: 'Please use a made-up school name. Fictional only, no real people or places.' });
  if (PROFANITY.test(text)) out.push({ field, level: 'error', message: 'Please keep it free of swear words.' });
  // A warning, not a block: the team swaps real names for in-game ones (ChatLah, Barang Market…) anyway.
  const brand = REAL_BRAND.exec(text)?.[0];
  if (brand)
    out.push({
      field,
      level: 'warning',
      message: `"${brand}" is a real app or company. Try a made-up name like ChatLah or Barang Market (the team will swap it if you don't).`,
    });
  return out;
}

const PITCH_SETTING_IDS = new Set(PITCH_SETTINGS.map((s) => s.id));
const TACTIC_IDS = new Set<string>(TACTICS.map((t) => t.id));
const RED_FLAG_IDS = new Set<string>(PITCH_RED_FLAGS.map((f) => f.id));
const SAFER_IDS = new Set<string>(PITCH_SAFER_MOVES.map((f) => f.id));
const RECOVERY_IDS = new Set<string>(PITCH_RECOVERY_MOVES.map((f) => f.id));
const PUSHER_IDS = new Set<string>(PITCH_PUSHERS.map((f) => f.id));
const BAND_IDS = new Set<string>(BANDS.map((b) => b.id));
const DISTRICT_IDS = new Set<string>(DISTRICTS.map((d) => d.id));
const TOTEM_IDS = new Set<string>(SQUAD_TOTEMS.map((t) => t.id));

export const settingById = (id: string): PitchSetting | undefined => PITCH_SETTINGS.find((s) => s.id === id);
export const settingsForDistrict = (district: DistrictId): PitchSetting[] =>
  PITCH_SETTINGS.filter((s) => s.districts.includes(district));

/** Full check of a pitch. Errors block sending; warnings are shown to the youth and to the moderator. */
export function checkPitch(p: PitchInput): PitchProblem[] {
  const out: PitchProblem[] = [];
  const form = (message: string) => out.push({ field: 'form', level: 'error', message });
  if (!BAND_IDS.has(p.band)) form('Pick who the mission is for.');
  if (!DISTRICT_IDS.has(p.district)) form('Pick a district.');
  const setting = settingById(p.setting);
  if (!setting || !PITCH_SETTING_IDS.has(p.setting)) form('Pick where it happens.');
  if (p.pusher !== undefined && !PUSHER_IDS.has(p.pusher)) form('Pick who is pushing.');
  const tactics = new Set(p.pressureTactics);
  if (tactics.size < 1 || tactics.size > PITCH_LIMITS.tactics || [...tactics].some((t) => !TACTIC_IDS.has(t)))
    form(`Pick 1 to ${PITCH_LIMITS.tactics} pressure tricks.`);
  const say = p.whatTheySay.trim();
  if (say.length < 8) out.push({ field: 'whatTheySay', level: 'error', message: 'Tell us a little more about what they say.' });
  if (say.length > PITCH_LIMITS.whatTheySay)
    out.push({ field: 'whatTheySay', level: 'error', message: `Keep it under ${PITCH_LIMITS.whatTheySay} characters.` });
  out.push(...pitchTextProblems(say, 'whatTheySay'));
  const flags = new Set(p.redFlags.chips);
  if (flags.size < 1 || flags.size > PITCH_LIMITS.redFlags || [...flags].some((f) => !RED_FLAG_IDS.has(f)))
    form(`Pick 1 to ${PITCH_LIMITS.redFlags} warning signs.`);
  const flagText = p.redFlags.text?.trim() ?? '';
  if (flagText.length > PITCH_LIMITS.short)
    out.push({ field: 'redFlags.text', level: 'error', message: `Keep it under ${PITCH_LIMITS.short} characters.` });
  if (flagText) out.push(...pitchTextProblems(flagText, 'redFlags.text'));
  const saferText = p.saferMove.text?.trim() ?? '';
  if (p.saferMove.chip !== undefined && !SAFER_IDS.has(p.saferMove.chip)) form('Pick a safer move.');
  if (p.saferMove.chip === undefined && !saferText) form('Pick a safer move or write your own.');
  if (saferText.length > PITCH_LIMITS.short)
    out.push({ field: 'saferMove.text', level: 'error', message: `Keep it under ${PITCH_LIMITS.short} characters.` });
  if (saferText) out.push(...pitchTextProblems(saferText, 'saferMove.text'));
  if (p.recoveryMove !== undefined && !RECOVERY_IDS.has(p.recoveryMove)) form('Pick a recovery move.');
  if (p.totem !== undefined && !TOTEM_IDS.has(p.totem)) form('Pick your squad totem, or leave it blank.');
  if (p.consent !== true) form('Tick the box to say the moment is made up.');
  return out;
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export const RETURN_REASONS = [
  { id: 'personal-details', label: 'It had personal details in it' },
  { id: 'real-people-places', label: 'It named real people, schools or places' },
  { id: 'unsafe-topic', label: 'The topic is not one ShieldQuest covers' },
  { id: 'how-to', label: 'It explained how to do something harmful' },
  { id: 'too-similar', label: 'It is very close to a mission we already have' },
  { id: 'needs-more', label: 'We need a bit more detail to build it' },
  { id: 'off-topic', label: 'It is not about a scam or pressure moment' },
] as const;
export type ReturnReasonId = (typeof RETURN_REASONS)[number]['id'];
export const isReturnReason = (id: string): id is ReturnReasonId => RETURN_REASONS.some((r) => r.id === id);

export const SUBMISSION_STATUS_TEXT: Record<SubmissionStatus, string> = {
  pending: 'Waiting for an educator to read it',
  approved: 'Picked! The team will build it into a mission',
  rejected: 'Returned with a reason',
};

/** Stored Moment Card (collection 'submissions'). Never holds IP addresses, names or exact times. */
export interface SubmissionRecord {
  id: string;
  /** Random ticket the youth keeps to check the status; only ever used by GET /api/submissions/:ticket. */
  ticket: string;
  createdAtHour: string;
  pitch: Omit<PitchInput, 'consent' | 'makerCode'>;
  /** Cohort credit from the maker code, e.g. "NYP Pilot 1". */
  cohort?: string;
  /** Warnings (e.g. blaming words) kept for the moderator. */
  warnings: string[];
  status: SubmissionStatus;
  decision?: {
    at: string;
    initials: string;
    reason?: ReturnReasonId;
    note?: string;
    missionId?: string;
  };
}

export type SubmissionView = Omit<SubmissionRecord, 'ticket'>;

export interface SubmissionCreated {
  ok: true;
  ticket: string;
  status: SubmissionStatus;
  warnings: string[];
}

export interface SubmissionStatusView {
  ticket: string;
  status: SubmissionStatus;
  statusText: string;
  reason: string | null;
}

export interface SubmissionConfig {
  makerCodeRequired: boolean;
}

export interface MakerCode {
  /** The code itself, e.g. "MK-7K2Q". */
  id: string;
  label: string;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
}

/** Credit line on a published youth mission. Never a name. */
export function youthCredit(totem: SquadTotemId | undefined, cohort: string | undefined): string {
  const squad = totem ? `Squad ${SQUAD_TOTEMS.find((t) => t.id === totem)?.name ?? ''}`.trim() : 'A youth squad';
  return cohort ? `${squad}, ${cohort}` : squad;
}

// ---------------------------------------------------------------------------------------------
// Custom missions

export type CustomStatus = 'draft' | 'reviewed' | 'published';

export interface Signoff {
  role: SignoffRole;
  initials: string;
  /** ISO date-time of the sign-off (staff action). */
  at: string;
  /** Mission version that was signed. A later edit clears every sign-off. */
  version: number;
}

export interface CustomMissionDoc {
  id: string;
  mission: Mission;
  status: CustomStatus;
  signoffs: Signoff[];
  /** The live copy the game may load; edits never change it until the next publish. */
  published?: { mission: Mission; version: number; bands: BandId[]; at: string };
  origin?: { kind: 'youth'; submissionId: string; credit: string };
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  /** Initials of whoever saved the current version (null when signed in without initials). */
  savedBy: string | null;
  /** Earlier versions (every version is kept, newest last, capped). */
  history: { version: number; savedAt: string; by: string | null; mission: Mission }[];
}

export interface CustomMissionSummary {
  id: string;
  title: string;
  district: DistrictId;
  bands: BandId[];
  scene: SceneId;
  scaffold: Mission['scaffold'];
  /** Tactics the mission practises (beats, clues and feedback cards), for the coverage matrix. */
  tactics: TacticId[];
  version: number;
  status: CustomStatus;
  signoffs: Signoff[];
  publishedBands: BandId[];
  publishedVersion: number | null;
  origin: CustomMissionDoc['origin'] | null;
  archived: boolean;
  updatedAt: string;
  lint: { errors: number; warnings: number; issues: LintIssue[] };
}

export interface CustomMissionDetail extends CustomMissionSummary {
  mission: Mission;
  history: { version: number; savedAt: string; by: string | null }[];
}

/** GET /api/missions/published entry. */
export interface PublishedMission {
  mission: Mission;
  version: number;
  bands: BandId[];
  publishedAt: string;
  /** "Made by youths in a ShieldQuest session" credit, when the mission began as a Moment Card. */
  credit: string | null;
}

export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  target: string | null;
  initials: string | null;
  detail: string | null;
}

// ---------------------------------------------------------------------------------------------
// Mission structure check: untrusted JSON -> a Mission lintMission can read without throwing

type Check = (v: unknown, path: string, out: LintIssue[]) => void;

const err = (out: LintIssue[], path: string, message: string) => out.push({ level: 'error', path: path || '(root)', message });
const join = (path: string, key: string | number) => (typeof key === 'number' ? `${path}[${key}]` : path ? `${path}.${key}` : key);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const str =
  (opts: { min?: number; max?: number } = {}): Check =>
  (v, path, out) => {
    if (typeof v !== 'string') return err(out, path, 'must be text');
    const max = opts.max ?? 1200;
    if (v.length > max) err(out, path, `is too long (${v.length} characters, at most ${max})`);
    if (v.trim().length < (opts.min ?? 0)) err(out, path, opts.min === 1 ? 'must not be empty' : `needs at least ${opts.min} characters`);
  };

const num =
  (min: number, max: number, integer = false): Check =>
  (v, path, out) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return err(out, path, 'must be a number');
    if (integer && !Number.isInteger(v)) err(out, path, 'must be a whole number');
    if (v < min || v > max) err(out, path, `must be between ${min} and ${max}`);
  };

const bool: Check = (v, path, out) => {
  if (typeof v !== 'boolean') err(out, path, 'must be true or false');
};

const oneOf =
  (values: readonly string[]): Check =>
  (v, path, out) => {
    if (typeof v !== 'string' || !values.includes(v))
      err(out, path, `must be one of: ${values.slice(0, 12).join(', ')}${values.length > 12 ? ', …' : ''}`);
  };

const arr =
  (item: Check, opts: { min?: number; max?: number } = {}): Check =>
  (v, path, out) => {
    if (!Array.isArray(v)) return err(out, path, 'must be a list');
    if (v.length > (opts.max ?? 60)) return err(out, path, `has too many items (at most ${opts.max ?? 60})`);
    if (v.length < (opts.min ?? 0)) err(out, path, `needs at least ${opts.min} item${opts.min === 1 ? '' : 's'}`);
    v.forEach((x, i) => item(x, join(path, i), out));
  };

const opt =
  (check: Check): Check =>
  (v, path, out) => {
    if (v !== undefined) check(v, path, out);
  };

const obj =
  (shape: Record<string, Check>): Check =>
  (v, path, out) => {
    if (!isObj(v)) return err(out, path, 'must be an object');
    for (const [key, check] of Object.entries(shape)) check(v[key], join(path, key), out);
    for (const key of Object.keys(v))
      if (!(key in shape)) out.push({ level: 'warning', path: join(path, key), message: 'unknown field; the game ignores it' });
  };

const record =
  (keys: readonly string[], value: Check): Check =>
  (v, path, out) => {
    if (!isObj(v)) return err(out, path, 'must be an object');
    for (const key of keys) value(v[key], join(path, key), out);
  };

/** Anchors are checked against the scene by lintMission; here they only need to be short text. */
const anchor = str({ min: 1, max: 40 });
const id = str({ min: 1, max: 64 });
const effects = obj({ wallet: opt(num(-100_000, 100_000)), trust: opt(num(-3, 3)), risk: opt(num(-3, 3)) });
const tactic = oneOf(TACTICS.map((t) => t.id));
const helpIds = HELP_CHANNELS.map((h) => h.id);

const recovery = obj({
  prompt: str({ min: 1 }),
  options: arr(
    obj({
      id,
      text: str({ min: 1 }),
      good: bool,
      response: str({ min: 1 }),
      help: opt(arr(oneOf(helpIds), { max: 6 })),
    }),
    { min: 1, max: 6 },
  ),
});

const shieldTile = obj({
  id,
  text: str({ min: 1, max: 300 }),
  quality: oneOf(['great', 'ok', 'harmful']),
  why: str({ min: 1 }),
  guard: num(-100, 100),
  doubt: num(-100, 100),
});

const MISSION_SHAPE = obj({
  id: str({ min: 3, max: 64 }),
  version: num(1, 100_000, true),
  title: str({ min: 1, max: 80 }),
  district: oneOf(DISTRICTS.map((d) => d.id)),
  scene: oneOf(SCENE_IDS),
  bands: arr(oneOf(BANDS.map((b) => b.id)), { min: 1, max: 3 }),
  theme: str({ min: 1, max: 200 }),
  premise: str({ min: 1, max: 600 }),
  skillFocus: arr(oneOf(['S', 'H', 'I', 'E', 'L', 'D']), { min: 1, max: 6 }),
  timeOfDay: oneOf(['morning', 'afternoon', 'evening', 'night']),
  scaffold: oneOf(['guided', 'light', 'wildcard']),
  resident: id,
  cast: arr(
    obj({
      id,
      name: str({ min: 1, max: 40 }),
      role: oneOf(['resident', 'friend', 'pressurer', 'stranger', 'trusted', 'bystander']),
      anchor: opt(anchor),
      pose: opt(oneOf(['stand', 'sit', 'phone', 'lean', 'walk'])),
      look: obj({
        body: str({ min: 1, max: 40 }),
        accent: str({ min: 1, max: 40 }),
        hair: opt(oneOf(CAST_HAIRS)),
        skin: opt(str({ min: 1, max: 40 })),
        hairColor: opt(str({ min: 1, max: 40 })),
        glasses: opt(bool),
        outfit: opt(oneOf(['casual', 'school', 'work'])),
      }),
      faceless: opt(bool),
    }),
    { min: 1, max: 12 },
  ),
  intro: str({ min: 1 }),
  live: obj({
    durationSec: num(10, 300),
    beats: arr(
      obj({
        id,
        at: num(0, 300),
        from: id,
        channel: oneOf(['chat', 'speech', 'notification', 'scene']),
        text: str({ min: 1, max: 600 }),
        tactic: opt(tactic),
        attachment: opt(
          obj({
            kind: oneOf(['link', 'image', 'payment', 'screenshot', 'listing', 'job', 'code']),
            label: str({ min: 1, max: 200 }),
            detail: opt(str({ max: 600 })),
          }),
        ),
      }),
      { min: 1, max: 40 },
    ),
    decisionPrompt: str({ min: 1, max: 300 }),
  }),
  clues: arr(
    obj({
      id,
      label: str({ min: 1, max: 200 }),
      target: (v, path, out) => {
        if (!isObj(v)) return err(out, path, 'must be an object');
        if (v.kind === 'beat') obj({ kind: oneOf(['beat']), beatId: id })(v, path, out);
        else if (v.kind === 'anchor') obj({ kind: oneOf(['anchor']), anchor })(v, path, out);
        else err(out, join(path, 'kind'), 'must be "beat" or "anchor"');
      },
      redFlag: bool,
      explain: str({ min: 1 }),
      tactic: opt(tactic),
    }),
    { min: 1, max: 24 },
  ),
  influence: obj({
    from: id,
    hidden: obj({ label: str({ min: 1, max: 120 }), description: str({ min: 1 }) }),
    question: str({ min: 1, max: 300 }),
    options: arr(obj({ id, text: str({ min: 1, max: 300 }), correct: bool, explain: str({ min: 1 }) }), { min: 2, max: 5 }),
  }),
  forecast: obj({
    question: str({ min: 1, max: 300 }),
    horizon: oneOf(['tonight', 'next-week', 'next-month']),
    options: arr(obj({ id, text: str({ min: 1, max: 300 }), likely: bool }), { min: 2, max: 5 }),
    explain: str({ min: 1 }),
  }),
  choices: arr(
    obj({
      id,
      label: str({ min: 1, max: 160 }),
      detail: opt(str({ max: 400 })),
      safety: oneOf(['risky', 'unsure', 'safe']),
      outcome: obj({
        title: str({ min: 1, max: 120 }),
        text: str({ min: 1 }),
        mood: oneOf(['shiny', 'sober', 'warm', 'mixed']),
        effects,
      }),
      feedback: obj({
        tactic,
        designedTo: opt(str({ max: 300 })),
        saferMove: str({ min: 1, max: 400 }),
        ifItHappened: str({ max: 400 }),
      }),
      aftershock: opt(
        obj({
          id,
          polarity: oneOf(['risk', 'protective']),
          afterMissions: num(0, 5, true),
          timeLabel: str({ min: 1, max: 40 }),
          title: str({ min: 1, max: 120 }),
          text: str({ min: 1 }),
          effects,
          recovery: opt(recovery),
          fact: opt(obj({ text: str({ min: 1 }), source: str({ min: 1, max: 300 }), asOf: str({ min: 1, max: 40 }) })),
        }),
      ),
    }),
    { min: 1, max: 6 },
  ),
  perspectives: arr(
    obj({ id, role: oneOf(['Safety Lead', 'Evidence Checker', 'Peer Supporter']), leaning: id, text: str({ min: 1, max: 600 }) }),
    { max: 6 },
  ),
  peerShield: opt(
    obj({
      friend: id,
      timeLabel: str({ min: 1, max: 40 }),
      setup: str({ min: 1 }),
      messages: arr(obj({ from: id, text: str({ min: 1, max: 600 }) }), { min: 1, max: 12 }),
      slots: record(['opener', 'reason', 'offer', 'channel'], arr(shieldTile, { max: 6 })),
      start: obj({ guard: num(0, 100), doubt: num(0, 100) }),
      outcomes: obj({ success: str({ min: 1 }), partial: str({ min: 1 }), fail: str({ min: 1 }) }),
    }),
  ),
  ifThen: obj({ if: str({ min: 1, max: 300 }), then: str({ min: 1, max: 300 }) }),
  help: arr(oneOf(helpIds), { max: 8 }),
  sources: arr(
    obj({
      label: str({ min: 1, max: 300 }),
      publisher: str({ min: 1, max: 200 }),
      asOf: str({ min: 1, max: 40 }),
      url: opt(str({ max: 400 })),
    }),
    { max: 12 },
  ),
  review: obj({
    status: oneOf(['draft', 'reviewed']),
    reviewers: arr(str({ max: 8 }), { max: 4 }),
    reviewBy: str({ max: 40 }),
    notes: opt(str({ max: 1200 })),
  }),
});

const MISSION_ID_RE = /^[a-z0-9][a-z0-9-]{2,63}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: string): boolean {
  if (!ISO_DATE_RE.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().startsWith(s);
}

const TODO_RE = /\bTODO\b/;

/** Penalties and age thresholds are never shown to the 10-13 band (GDD §9.6 rule 3). */
const PENALTY_RE = /\b(?:jail\w*|prison\w*|imprison\w*|penalt\w*|fined|fines|caning|arrest\w*|criminal record|charged (?:in|with))\b/i;
const AGE_RE =
  /\b(?:(?:under|below|above|over|aged?)\s+\d{1,2}(?!\s*(?:seconds?|secs?|minutes?|mins?|hours?|days?|weeks?|months?|dollars?|cents?|%|percent|people|times|messages?))\b|\d{1,2}\s*(?:years?\s*old|yo)\b|age of \d{1,2}|minimum age)/i;

function missionStrings(m: Mission): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const walk = (v: unknown, path: string) => {
    if (typeof v === 'string') out.push({ path, text: v });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (isObj(v)) for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(m, '');
  return out;
}

/** Portal rules that sit on top of the shared lintMission. */
export function portalLint(m: Mission, opts: { custom: boolean; today?: string }): LintIssue[] {
  const issues: LintIssue[] = [];
  const e = (path: string, message: string) => issues.push({ level: 'error', path, message });
  const w = (path: string, message: string) => issues.push({ level: 'warning', path, message });
  if (opts.custom) {
    if (!MISSION_ID_RE.test(m.id)) e('id', 'use 3-64 lowercase letters, digits and dashes, e.g. "parcel-scam-teen"');
    if (missionById(m.id)) e('id', `"${m.id}" is a built-in mission; give the custom copy a new id`);
  }
  if (new Set(m.bands).size !== m.bands.length) e('bands', 'a band is listed twice');
  if (DISTRICTS.find((d) => d.id === m.district)?.comingSoon)
    w('district', 'this district is still fogged on the city map; the mission is listed but not reachable there yet');
  if (!(m.resident && m.cast.some((c) => c.id === m.resident && c.role === 'resident')))
    w('resident', 'the resident cast member should have role "resident"');
  m.cast.forEach((c, i) => {
    // Peers who pressure (role 'pressurer') may appear; strangers and remote manipulators never get a face.
    if (c.role === 'stranger' && c.anchor && !c.faceless)
      e(`cast[${i}].faceless`, 'manipulators are never embodied: a stranger in the scene must be a faceless silhouette');
    if (c.role === 'pressurer' && !c.anchor && c.faceless === false)
      w(`cast[${i}].faceless`, 'remote pressurers appear only as a chat handle; leave "faceless" on');
  });
  // Skeletons (blank or from a youth pitch) are full of TODO markers; none may reach a sign-off.
  for (const { path, text } of missionStrings(m)) {
    if (!path.startsWith('review') && TODO_RE.test(text)) e(path, 'still a draft placeholder (TODO): write the real content');
  }
  const at = m.live.beats.map((b) => b.at);
  if (at.some((t, i) => i > 0 && t < (at[i - 1] ?? 0))) w('live.beats', 'beats are not in time order');
  if (m.choices.some((c) => !c.feedback.ifItHappened.trim()))
    e('choices', 'every Exit needs a feedback card with an "if it already happened" step');
  if (m.bands.includes('junior')) {
    for (const { path, text } of missionStrings(m)) {
      if (path.startsWith('sources') || path.startsWith('review')) continue;
      const pen = text.match(PENALTY_RE)?.[0];
      if (pen) e(path, `no legal penalties in the 10-13 band ("${pen}")`);
      const age = text.match(AGE_RE)?.[0];
      if (age) w(path, `avoid age thresholds in the 10-13 band ("${age}")`);
    }
    if (m.choices.length > 3) w('choices', 'the 10-13 band works best with 2-3 clear choices');
  }
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  if (!isIsoDate(m.review.reviewBy)) w('review.reviewBy', 'add a review-by date (YYYY-MM-DD); the content sign-off needs it');
  else if (m.review.reviewBy < today) w('review.reviewBy', 'the review-by date has passed; re-check the facts and set a new date');
  m.sources.forEach((s, i) => {
    if (!isIsoDate(s.asOf)) w(`sources[${i}].asOf`, 'give the as-of date as YYYY-MM-DD');
  });
  return issues;
}

export interface MissionCheck {
  mission: Mission | null;
  issues: LintIssue[];
  errors: number;
  warnings: number;
}

const sortIssues = (issues: LintIssue[]): LintIssue[] =>
  [...issues].sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));

/**
 * Structural check, then lintMission, then the portal rules. A mission with structural errors is
 * never handed to lintMission (which assumes a well-formed Mission), so this never throws.
 */
export function checkMission(input: unknown, opts: { custom?: boolean; today?: string } = {}): MissionCheck {
  const structural: LintIssue[] = [];
  MISSION_SHAPE(input, '', structural);
  const shapeErrors = structural.filter((i) => i.level === 'error');
  if (shapeErrors.length) return tally(null, structural);
  const mission = input as Mission;
  let lint: LintIssue[];
  try {
    lint = [...lintMission(mission), ...portalLint(mission, { custom: opts.custom ?? true, today: opts.today })];
  } catch {
    // Defensive: a shape the structure check missed must never take the portal down.
    return tally(null, [...structural, { level: 'error', path: '(root)', message: 'the content check could not read this mission' }]);
  }
  return tally(mission, [...structural, ...lint]);
}

function tally(mission: Mission | null, issues: LintIssue[]): MissionCheck {
  const sorted = sortIssues(issues);
  const errors = sorted.filter((i) => i.level === 'error').length;
  return { mission, issues: sorted, errors, warnings: sorted.length - errors };
}

/** Tactics a mission practises: live beats, clues and the feedback cards of its Exits. */
export function missionTactics(m: Mission): TacticId[] {
  const set = new Set<TacticId>();
  for (const b of m.live.beats) if (b.tactic) set.add(b.tactic);
  for (const c of m.clues) if (c.tactic) set.add(c.tactic);
  for (const c of m.choices) set.add(c.feedback.tactic);
  return TACTICS.map((t) => t.id).filter((id) => set.has(id));
}

/** Everything a reviewer signs (all content plus the review-by date and notes), for "did it change?" checks. */
export function contentKey(m: Mission): string {
  return JSON.stringify({ ...m, version: 0, review: { reviewBy: m.review.reviewBy, notes: m.review.notes ?? '' } });
}

// ---------------------------------------------------------------------------------------------
// Draft skeletons (blank or from an approved pitch). Clearly marked TODO; lint keeps them unpublishable
// until the team finishes them.

const TODO = 'TODO:';

export interface SkeletonInput {
  id: string;
  title?: string;
  band: BandId;
  district: DistrictId;
  setting?: PitchSetting;
  pusher?: PitchPusherId;
  tactics?: TacticId[];
  whatTheySay?: string;
  redFlags?: string[];
  saferMove?: string;
  recoveryMove?: string;
  notes?: string;
}

export function skeletonMission(s: SkeletonInput): Mission {
  const scene: SceneId = s.setting?.scene ?? (s.district === 'retail-district' ? 'minimart' : s.district === 'digi-district' ? 'digi-sky' : 'school-gate');
  const anchors = SCENES[scene];
  const pusher = PITCH_PUSHERS.find((p) => p.id === (s.pusher ?? 'stranger')) ?? PITCH_PUSHERS[0];
  const remote = s.setting?.online ?? false;
  const tactics: TacticId[] = s.tactics?.length ? s.tactics : ['urgency'];
  const main = tactics[0] ?? 'urgency';
  const flags = s.redFlags?.length ? s.redFlags : [`${TODO} a warning sign`];
  const isFriend = pusher.castRole === 'friend';
  const pusherId = isFriend ? 'friend' : 'pusher';
  return {
    id: s.id,
    version: 1,
    title: s.title ?? `${TODO} title`,
    district: s.district,
    scene,
    bands: [s.band],
    theme: tactics.map((t) => TACTICS.find((x) => x.id === t)?.name ?? t).join(', '),
    premise: s.whatTheySay ? `Youth pitch: "${s.whatTheySay}"` : `${TODO} one-line premise`,
    skillFocus: ['S', 'H'],
    timeOfDay: scene === 'bedroom' ? 'night' : 'afternoon',
    scaffold: 'guided',
    resident: 'resident',
    cast: [
      {
        id: 'resident',
        name: `${TODO} resident name`,
        role: 'resident',
        anchor: anchors[0],
        pose: 'phone',
        look: { body: '#5cc4f2', accent: '#f2c14e', hair: 'short' },
      },
      isFriend
        ? { id: pusherId, name: `${TODO} friend name`, role: 'friend', anchor: anchors[1] ?? anchors[0], pose: 'stand', look: { body: '#a48cf5', accent: '#f4efe6', hair: 'cap' } }
        : remote || pusher.id !== 'stranger'
          ? { id: pusherId, name: `${TODO} handle (e.g. Deals_Ken)`, role: pusher.castRole, look: { body: '#48506e', accent: '#9fb3c8' }, faceless: true }
          : { id: pusherId, name: 'Stranger', role: 'stranger', anchor: anchors[1] ?? anchors[0], pose: 'stand', look: { body: '#48506e', accent: '#9fb3c8' }, faceless: true },
    ],
    intro: `${TODO} two sentences that set the scene${s.setting ? ` (${s.setting.label.toLowerCase()})` : ''}.`,
    live: {
      durationSec: 45,
      beats: [
        { id: 'b1', at: 3, from: pusherId, channel: remote ? 'chat' : 'speech', text: s.whatTheySay ?? `${TODO} what they say`, tactic: main },
        { id: 'b2', at: 15, from: pusherId, channel: remote ? 'chat' : 'speech', text: `${TODO} the pressure grows`, tactic: tactics[1] ?? main },
      ],
      decisionPrompt: `${TODO} what should the resident do?`,
    },
    clues: [
      ...flags.map((label, i) => ({ id: `c${i + 1}`, label, target: { kind: 'beat' as const, beatId: 'b1' }, redFlag: true, explain: `${TODO} why this is a warning sign` })),
      { id: 'c-ordinary', label: `${TODO} an ordinary detail`, target: { kind: 'anchor' as const, anchor: anchors[0] }, redFlag: false, explain: `${TODO} why this detail is normal` },
    ],
    influence: {
      from: pusherId,
      hidden: { label: `${TODO} who really gains`, description: `${TODO} describe the hidden gain` },
      question: 'Who really gains if the resident says yes?',
      options: [
        { id: 'i1', text: `${TODO} the real winner`, correct: true, explain: `${TODO} explain` },
        { id: 'i2', text: 'The resident', correct: false, explain: `${TODO} explain` },
      ],
    },
    forecast: {
      question: 'If the resident goes along with it, what is likely to happen?',
      horizon: 'next-week',
      options: [
        { id: 'f1', text: `${TODO} a likely result`, likely: true },
        { id: 'f2', text: `${TODO} an unlikely result`, likely: false },
      ],
      explain: `${TODO} explain the likely result`,
    },
    choices: [
      {
        id: 'go-along',
        label: 'Go along with it',
        safety: 'risky',
        outcome: { title: `${TODO} outcome title`, text: `${TODO} what happens now`, mood: 'shiny', effects: { trust: -1, risk: 1 } },
        feedback: {
          tactic: main,
          saferMove: s.saferMove ?? `${TODO} the safer move`,
          ifItHappened: s.recoveryMove ?? `${TODO} the recovery step`,
        },
        aftershock: {
          id: 'as-risk',
          polarity: 'risk',
          afterMissions: 1,
          timeLabel: '1 WEEK LATER',
          title: `${TODO} Aftershock title`,
          text: `${TODO} the delayed cost, told plainly`,
          effects: { trust: -1, risk: 1 },
          recovery: {
            prompt: 'What can the resident do now?',
            options: [
              { id: 'r1', text: s.recoveryMove ?? `${TODO} the good recovery`, good: true, response: `${TODO} response`, help: ['trusted-adult'] },
              { id: 'r2', text: 'Keep quiet and hope it goes away', good: false, response: `${TODO} response` },
            ],
          },
        },
      },
      {
        id: 'safer',
        label: s.saferMove ?? `${TODO} the safer move`,
        safety: 'safe',
        outcome: { title: `${TODO} outcome title`, text: `${TODO} what happens now`, mood: 'warm', effects: { trust: 1 } },
        feedback: { tactic: main, saferMove: s.saferMove ?? `${TODO} the safer move`, ifItHappened: s.recoveryMove ?? `${TODO} the recovery step` },
      },
    ],
    perspectives: [
      { id: 'p1', role: 'Safety Lead', leaning: 'safer', text: `${TODO} a reason to take the safer move` },
      { id: 'p2', role: 'Evidence Checker', leaning: 'go-along', text: `${TODO} why it might look fine at first` },
    ],
    ifThen: { if: `${TODO} if someone…`, then: `${TODO} then I will…` },
    help: ['trusted-adult'],
    sources: [],
    review: { status: 'draft', reviewers: [], reviewBy: '', notes: s.notes ?? 'Draft skeleton: every TODO must be written before review.' },
  };
}

/** Draft mission skeleton from an approved Moment Card. */
export function missionFromPitch(sub: SubmissionRecord, id: string): Mission {
  const p = sub.pitch;
  const setting = settingById(p.setting);
  const flagLabels: string[] = p.redFlags.chips.map((c) => PITCH_RED_FLAGS.find((f) => f.id === c)?.label ?? c);
  if (p.redFlags.text) flagLabels.push(p.redFlags.text);
  const safer = p.saferMove.text?.trim() || PITCH_SAFER_MOVES.find((m) => m.id === p.saferMove.chip)?.label;
  const recovery = PITCH_RECOVERY_MOVES.find((m) => m.id === p.recoveryMove)?.label;
  const credit = youthCredit(p.totem, sub.cohort);
  return skeletonMission({
    id,
    title: `Youth pitch: ${setting?.label ?? 'new moment'}`,
    band: p.band,
    district: p.district,
    setting,
    pusher: p.pusher,
    tactics: p.pressureTactics,
    whatTheySay: p.whatTheySay,
    redFlags: flagLabels,
    saferMove: safer,
    recoveryMove: recovery,
    notes: `Made by youths in a ShieldQuest session (${credit}). Built from Moment Card ${sub.id}. Draft skeleton: every TODO must be written, then two sign-offs.`,
  });
}

// ---------------------------------------------------------------------------------------------
// Analytics (GET /api/analytics). Every count below PORTAL_MIN_GROUP is null (suppressed); 0 stays 0.

export interface Stat {
  /** Denominator (people or squads). null = suppressed (1-4). */
  n: number | null;
  /** Rate (0-1) or number. null when suppressed or nothing to show. */
  value: number | null;
  suppressed: boolean;
}

export interface CalibrationRow {
  metricId: string;
  label: string;
  format: AssessmentMetricInfo['format'];
  higherIsBetter: boolean | null;
  min: number;
  max: number;
  pre: AssessmentCell;
  post: AssessmentCell;
  return: AssessmentCell;
  /** The headline change: post vs pre (return vs post for retention). */
  change: AssessmentDelta;
  changeLabel: string;
}

export interface SignalRow {
  id: string;
  label: string;
  format: 'percent' | 'number';
  /** What n counts, e.g. "players", "squads", "sessions". */
  unit: string;
  stat: Stat;
}

export interface KpiCard {
  id: AssessmentKpiId;
  number: number;
  label: string;
  measure: string;
  calibration: CalibrationRow[];
  signals: SignalRow[];
}

export interface MissionRow {
  missionId: string;
  title: string;
  scaffold: string | null;
  squads: Stat;
  completion: Stat;
  holdRate: Stat;
  firstSafe: Stat;
  finalSafe: Stat;
  shiftedSafer: Stat;
  forecast: Stat;
  trace: Stat;
  shieldSuccess: Stat;
  /** Least-found red-flag clue (only when at least 5 squads played). */
  mostMissed: { clueId: string; label: string; found: Stat } | null;
  decisions: { choiceId: string; label: string; safety: string; squads: number | null }[];
}

export interface SessionRow {
  hour: string;
  band: BandId;
  seats: number | null;
  squads: number | null;
  missionsCompleted: number;
  complete: boolean;
  holdRate: Stat;
  shiftedSafer: Stat;
  /** Room-level lanterns; null when the session had fewer than 5 players. */
  lanterns: number | null;
}

export interface AnalyticsFilter {
  band: BandId | null;
  from: string | null;
  to: string | null;
}

export interface AnalyticsReport {
  generatedAt: string;
  filter: AnalyticsFilter;
  minGroup: number;
  totals: {
    sessions: number | null;
    completeSessions: number | null;
    seats: number | null;
    missionsCompleted: number | null;
    responses: { pre: number | null; post: number | null; return: number | null };
    matched: { prePost: number | null; postReturn: number | null };
  };
  kpis: KpiCard[];
  holdLatency: { bucket: HoldBucket; label: string; n: number | null }[];
  missions: MissionRow[];
  sessions: SessionRow[];
}

export const HOLD_BUCKET_LABEL: Record<HoldBucket, string> = {
  '0-5': '0-5 s',
  '5-15': '5-15 s',
  '15-30': '15-30 s',
  '30+': '30 s or more',
  late: 'Auto-frozen (no Hold)',
};
