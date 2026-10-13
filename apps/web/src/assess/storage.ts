// On-device memory for Calibration: the random code (pre-filled for the after check and the Return
// visit), an in-progress draft so a locked phone or a refresh never loses answers, the private
// before/after scores for the Growth Card, and an offline queue that retries until the server has it.
// Nothing here is ever uploaded except the submission itself.

import {
  isAssessmentCode,
  isAssessmentKind,
  isRoomCode,
  makeAssessmentCode,
  normalizeAssessmentCode,
  type AssessmentAnswers,
  type AssessmentForm,
  type AssessmentKind,
  type AssessmentScores,
  type AssessmentSubmission,
  type BandId,
} from '@shieldquest/shared';

const RECORD_KEY = 'sq.assess.v1';
const QUEUE_KEY = 'sq.assess.queue.v1';
const API = '/api/assessments';

export interface DoneEntry {
  code: string;
  form: AssessmentForm;
  /** Local hour the check was finished (for "done" badges only). */
  at: number;
  scores: AssessmentScores;
  /** True while the submission is still waiting in the offline queue. */
  pending: boolean;
}

export interface AssessDraft {
  kind: AssessmentKind;
  code: string;
  band: BandId;
  index: number;
  answers: AssessmentAnswers;
  sessionCode?: string;
}

export interface AssessRecord {
  code?: string;
  band?: BandId;
  sessionCode?: string;
  done: Partial<Record<AssessmentKind, DoneEntry>>;
  draft?: AssessDraft;
}

// localStorage can throw (private mode, managed school devices); fall back to memory for this visit.
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
}

function readJson<T>(key: string, fallback: T): T {
  const raw = read(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const isBand = (v: unknown): v is BandId => v === 'junior' || v === 'teen' || v === 'young-adult';
const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// Everything read back from localStorage is untrusted (old versions, other tabs, hand edits), so it is re-checked.
function cleanDraft(raw: unknown): AssessDraft | undefined {
  if (!isPlainObject(raw)) return undefined;
  const { kind, code, band, index, answers, sessionCode } = raw;
  if (!isAssessmentKind(kind) || typeof code !== 'string' || !isAssessmentCode(code) || !isBand(band)) return undefined;
  const draft: AssessDraft = {
    kind,
    code,
    band,
    index: typeof index === 'number' && Number.isInteger(index) && index >= 0 ? index : 0,
    // Individual answers are narrowed against the form with cleanAnswers() when the draft is resumed.
    answers: isPlainObject(answers) ? (answers as AssessmentAnswers) : {},
  };
  if (typeof sessionCode === 'string' && isRoomCode(sessionCode)) draft.sessionCode = sessionCode;
  return draft;
}

function cleanDone(raw: unknown): AssessRecord['done'] {
  const done: AssessRecord['done'] = {};
  if (!isPlainObject(raw)) return done;
  for (const [k, v] of Object.entries(raw)) {
    if (!isAssessmentKind(k) || !isPlainObject(v)) continue;
    const { code, form, at, scores, pending } = v;
    if (typeof code !== 'string' || !isAssessmentCode(code) || (form !== 'A' && form !== 'B' && form !== 'C')) continue;
    done[k] = {
      code,
      form,
      at: typeof at === 'number' ? at : 0,
      scores: isPlainObject(scores) ? (scores as AssessmentScores) : {},
      pending: pending === true,
    };
  }
  return done;
}

export function loadRecord(): AssessRecord {
  const r = readJson<unknown>(RECORD_KEY, {});
  const raw = isPlainObject(r) ? r : {};
  const record: AssessRecord = { done: cleanDone(raw.done) };
  if (typeof raw.code === 'string' && isAssessmentCode(raw.code)) record.code = raw.code;
  if (isBand(raw.band)) record.band = raw.band;
  if (typeof raw.sessionCode === 'string' && isRoomCode(raw.sessionCode)) record.sessionCode = raw.sessionCode;
  const draft = cleanDraft(raw.draft);
  if (draft) record.draft = draft;
  return record;
}

export function updateRecord(patch: (r: AssessRecord) => AssessRecord): AssessRecord {
  const next = patch(loadRecord());
  write(RECORD_KEY, JSON.stringify(next));
  return next;
}

/**
 * For shared school devices: forgets the code, the private before/after scores and any unfinished draft.
 * Finished answers still waiting in the offline queue are kept so they are not lost.
 */
export function forgetThisDevice(): AssessRecord {
  const next: AssessRecord = { done: {} };
  write(RECORD_KEY, JSON.stringify(next));
  return next;
}

// ---------------------------------------------------------------------------------------------
// Network

async function post(url: string, body: unknown, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      credentials: 'omit',
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timer);
  }
}

/** A fresh code from the server's cryptographic RNG (guaranteed unused); a local one when offline. */
export async function requestCode(): Promise<string> {
  try {
    const res = await post(`${API}/codes`, {}, 6000);
    if (res.ok) {
      const { code } = (await res.json()) as { code?: unknown };
      if (typeof code === 'string' && isAssessmentCode(normalizeAssessmentCode(code))) return normalizeAssessmentCode(code);
    }
  } catch {
    // Offline or blocked: fall through to a code made on this device.
  }
  return makeAssessmentCode();
}

export type SendResult = 'sent' | 'queued' | 'rejected';

/** Retrying cannot fix a 4xx (other than timeouts and rate limits), so those are not queued. */
const retryable = (status: number) => status >= 500 || status === 408 || status === 429;

async function sendOnce(sub: AssessmentSubmission): Promise<SendResult> {
  try {
    const res = await post(API, sub, 12000);
    if (res.ok) return 'sent';
    return retryable(res.status) ? 'queued' : 'rejected';
  } catch {
    return 'queued';
  }
}

const queueKey = (s: AssessmentSubmission) => `${s.code}:${s.kind}`;

function loadQueue(): AssessmentSubmission[] {
  const q = readJson<unknown>(QUEUE_KEY, []);
  return Array.isArray(q) ? (q as AssessmentSubmission[]).filter((s) => s && typeof s.code === 'string') : [];
}

function saveQueue(q: AssessmentSubmission[]): void {
  write(QUEUE_KEY, JSON.stringify(q));
}

/** Sends a finished check; when offline it is kept on the device and retried later. */
export async function submitAssessment(sub: AssessmentSubmission): Promise<SendResult> {
  const result = await sendOnce(sub);
  if (result === 'queued') saveQueue([...loadQueue().filter((s) => queueKey(s) !== queueKey(sub)), sub]);
  return result;
}

let flushing: Promise<{ sent: number; left: number }> | null = null;

/**
 * Retries every queued submission. Safe to call often (e.g. on app start and on the 'online' event);
 * concurrent calls share one run.
 */
export function flushAssessmentQueue(): Promise<{ sent: number; left: number }> {
  flushing ??= (async () => {
    const queue = loadQueue();
    const left: AssessmentSubmission[] = [];
    let sent = 0;
    for (const sub of queue) {
      const r = await sendOnce(sub);
      if (r === 'sent') sent++;
      if (r === 'queued') left.push(sub);
    }
    // Re-read so anything queued while we were sending is kept.
    const sentKeys = new Set(queue.filter((s) => !left.includes(s)).map(queueKey));
    saveQueue(loadQueue().filter((s) => !sentKeys.has(queueKey(s))));
    if (sent) {
      updateRecord((r) => {
        const done = { ...r.done };
        for (const k of Object.keys(done) as AssessmentKind[]) {
          const entry = done[k];
          if (entry?.pending && sentKeys.has(`${entry.code}:${k}`)) done[k] = { ...entry, pending: false };
        }
        return { ...r, done };
      });
    }
    return { sent, left: left.length };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export const queuedCount = (): number => loadQueue().length;

/** True while a finished check for this code and visit is still waiting in the offline queue. */
export const isQueued = (code: string, kind: AssessmentKind): boolean =>
  loadQueue().some((s) => s.code === code && s.kind === kind);
