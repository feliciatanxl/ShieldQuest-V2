import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isAssessmentCode, type AssessmentSubmission } from '@shieldquest/shared';
import {
  flushAssessmentQueue,
  forgetThisDevice,
  loadRecord,
  queuedCount,
  requestCode,
  submitAssessment,
  updateRecord,
} from './storage';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}

const store = new MemoryStorage();

const sub = (code = 'KAYA-7K2', kind: AssessmentSubmission['kind'] = 'pre'): AssessmentSubmission => ({
  code,
  kind,
  band: 'teen',
  answers: { 'P.cf.1': { type: 'likert', value: 4 } },
});

const respond = (status: number, body: unknown = {}) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', store);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('device record', () => {
  it('drops malformed or tampered fields instead of trusting them', () => {
    store.setItem(
      'sq.assess.v1',
      JSON.stringify({
        code: 'NOT A CODE',
        band: 'adult',
        sessionCode: 'x',
        done: { pre: { code: 'KAYA-7K2', form: 'A', at: 1, scores: { twinAccuracy: 1 } }, bogus: {}, post: { code: 'bad' } },
        draft: { kind: 'pre', code: 'KAYA-7K2', band: 'teen', index: -3, answers: [] },
      }),
    );
    const r = loadRecord();
    expect(r.code).toBeUndefined();
    expect(r.band).toBeUndefined();
    expect(r.sessionCode).toBeUndefined();
    expect(Object.keys(r.done)).toEqual(['pre']);
    expect(r.done.pre?.pending).toBe(false);
    expect(r.draft).toEqual({ kind: 'pre', code: 'KAYA-7K2', band: 'teen', index: 0, answers: {} });
  });

  it('survives unreadable JSON', () => {
    store.setItem('sq.assess.v1', '{oops');
    expect(loadRecord()).toEqual({ done: {} });
  });

  it('forgets the code, scores and draft on a shared device', () => {
    updateRecord(() => ({ code: 'KAYA-7K2', band: 'teen', done: {}, draft: { kind: 'pre', code: 'KAYA-7K2', band: 'teen', index: 2, answers: {} } }));
    forgetThisDevice();
    expect(loadRecord()).toEqual({ done: {} });
  });
});

describe('codes', () => {
  it('uses the server code when reachable, normalised', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(201, { code: 'orca 7k2' })));
    expect(await requestCode()).toBe('ORCA-7K2');
  });

  it('falls back to a code made on the device when offline', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    expect(isAssessmentCode(await requestCode())).toBe(true);
  });
});

describe('offline queue', () => {
  it('sends straight away when online', async () => {
    const fetchMock = vi.fn(() => respond(201, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await submitAssessment(sub())).toBe('sent');
    expect(queuedCount()).toBe(0);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(String(init.body))).toEqual(sub());
  });

  it('queues on network failure and server errors, once per code and kind', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    expect(await submitAssessment(sub())).toBe('queued');
    expect(await submitAssessment(sub())).toBe('queued');
    vi.stubGlobal('fetch', vi.fn(() => respond(503)));
    expect(await submitAssessment(sub('ORCA-7K2'))).toBe('queued');
    expect(queuedCount()).toBe(2);
  });

  it('does not queue answers the server refused (they would never send)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(422, { error: 'personal-data' })));
    expect(await submitAssessment(sub())).toBe('rejected');
    expect(queuedCount()).toBe(0);
  });

  it('flushes the queue when back online and clears the pending mark', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    await submitAssessment(sub());
    updateRecord((r) => ({ ...r, done: { pre: { code: 'KAYA-7K2', form: 'A', at: 0, scores: {}, pending: true } } }));

    vi.stubGlobal('fetch', vi.fn(() => respond(201, { ok: true })));
    expect(await flushAssessmentQueue()).toEqual({ sent: 1, left: 0 });
    expect(queuedCount()).toBe(0);
    expect(loadRecord().done.pre?.pending).toBe(false);
  });

  it('keeps what still fails in the queue', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    await submitAssessment(sub('KAYA-7K2'));
    await submitAssessment(sub('ORCA-7K2'));
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => (calls++ === 0 ? respond(201) : Promise.reject(new TypeError('offline')))),
    );
    expect(await flushAssessmentQueue()).toEqual({ sent: 1, left: 1 });
    expect(queuedCount()).toBe(1);
  });
});
