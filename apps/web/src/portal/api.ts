// Portal API client and the educator session. The bearer token lives in sessionStorage only, so it
// ends with the browser tab (school computers are shared); every read is wrapped because storage can
// be blocked. Nothing here sends cookies, and the token never goes into a URL.

import { useSyncExternalStore } from 'react';
import type { LintIssue } from '@shieldquest/shared';
import type { LoginResponse, PitchProblem } from './model';

export interface EducatorSession {
  token: string;
  expiresAt: string;
  initials: string | null;
  devPasscode: boolean;
}

const KEY = 'sq.portal.session.v1';
let current: EducatorSession | null = load();
const listeners = new Set<() => void>();

function load(): EducatorSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<EducatorSession>;
    if (typeof s.token !== 'string' || typeof s.expiresAt !== 'string' || Date.parse(s.expiresAt) <= Date.now()) return null;
    return { token: s.token, expiresAt: s.expiresAt, initials: typeof s.initials === 'string' ? s.initials : null, devPasscode: !!s.devPasscode };
  } catch {
    return null;
  }
}

function setSession(next: EducatorSession | null): void {
  current = next;
  try {
    if (next) sessionStorage.setItem(KEY, JSON.stringify(next));
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the session still works for this page view.
  }
  for (const l of listeners) l();
}

export function useEducatorSession(): EducatorSession | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}

export const getSession = () => current;

/** Updates the initials remembered for sign-offs in this tab. */
export function rememberInitials(initials: string): void {
  if (current && current.initials !== initials) setSession({ ...current, initials });
}

export class PortalError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues: LintIssue[] = [],
    readonly problems: PitchProblem[] = [],
  ) {
    super(message);
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
}

const TRANSIENT = new Set([0, 502, 503, 504]);
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * JSON request helper. Throws PortalError with the server's friendly message. Reads (GET) are retried
 * once after a network blip or a gateway error, which school Wi-Fi and proxies produce now and then;
 * writes are never retried automatically, so nothing is sent twice.
 */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const method = opts.method ?? (opts.body === undefined ? 'GET' : 'POST');
  try {
    return await request<T>(path, method, opts);
  } catch (e) {
    if (method !== 'GET' || !(e instanceof PortalError) || !TRANSIENT.has(e.status)) throw e;
    await pause(600);
    return request<T>(path, method, opts);
  }
}

async function request<T>(path: string, method: 'GET' | 'POST' | 'PUT', opts: ApiOptions): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.auth) {
    if (!current) throw new PortalError(401, 'unauthorized', 'Please sign in to the Scenario Portal.');
    headers.authorization = `Bearer ${current.token}`;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15_000);
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: 'omit',
      cache: 'no-store',
      signal: ctrl.signal,
    });
  } catch {
    throw new PortalError(0, 'offline', 'Could not reach ShieldQuest. Check the connection and try again.');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; message?: string; issues?: LintIssue[]; problems?: PitchProblem[] };
    if (res.status === 401 && opts.auth) setSession(null);
    const fallback =
      res.status === 429 ? 'Too many tries in a short time. Wait a minute and try again.' : `Something went wrong (${res.status}).`;
    throw new PortalError(res.status, d.error ?? 'error', d.message ?? fallback, d.issues ?? [], d.problems ?? []);
  }
  return data as T;
}

export async function signIn(passcode: string, initials: string): Promise<EducatorSession> {
  const r = await api<LoginResponse>('/api/portal/login', { body: { passcode, ...(initials.trim() ? { initials } : {}) } });
  const session: EducatorSession = { token: r.token, expiresAt: r.expiresAt, initials: r.initials, devPasscode: r.devPasscode };
  setSession(session);
  return session;
}

export async function signOut(): Promise<void> {
  try {
    if (current) await api('/api/portal/logout', { body: {}, auth: true, timeoutMs: 5000 });
  } catch {
    // Signing out locally is what matters; the server token expires on its own.
  }
  setSession(null);
}

/** Downloads an authenticated file without putting the token in a URL. */
export async function downloadWithAuth(path: string, fallbackName: string): Promise<void> {
  if (!current) throw new PortalError(401, 'unauthorized', 'Please sign in again.');
  let res: Response;
  try {
    res = await fetch(path, { headers: { authorization: `Bearer ${current.token}` }, credentials: 'omit', cache: 'no-store' });
  } catch {
    throw new PortalError(0, 'offline', 'Could not reach ShieldQuest. Check the connection and try again.');
  }
  if (!res.ok) {
    if (res.status === 401) setSession(null);
    throw new PortalError(res.status, 'error', 'The download did not work. Try again.');
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Re-checks a stored session against the server once per page load. */
export async function verifySession(): Promise<void> {
  if (!current) return;
  try {
    await api('/api/portal/me', { auth: true, timeoutMs: 8000 });
  } catch (e) {
    if (e instanceof PortalError && e.status === 401) setSession(null);
  }
}
