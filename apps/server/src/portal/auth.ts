// Educator sign-in for the Scenario Portal. There are no personal accounts: one shared passcode
// (env PORTAL_PASSCODE) opens an 8-hour session token kept only in server memory. Reviewers identify
// themselves by initials (e.g. "FT") when they sign off, never by name.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from 'fastify';
import { DEV_PASSCODE, SESSION_HOURS } from './model';

export interface EducatorSession {
  initials: string | null;
  expiresAt: number;
}

export interface PasscodeConfig {
  /** null = sign-in disabled (production without PORTAL_PASSCODE). */
  passcode: string | null;
  dev: boolean;
}

/** Resolves the passcode once at start-up. Development falls back to DEV_PASSCODE with a warning. */
export function resolvePasscode(log: FastifyBaseLogger, override?: string): PasscodeConfig {
  const configured = override ?? process.env.PORTAL_PASSCODE;
  if (configured && configured.length >= 8) return { passcode: configured, dev: false };
  if (configured) log.warn('PORTAL_PASSCODE is shorter than 8 characters; portal sign-in is disabled');
  else if (process.env.NODE_ENV !== 'production') {
    log.warn(`PORTAL_PASSCODE is not set: the Scenario Portal accepts the development passcode "${DEV_PASSCODE}"`);
    return { passcode: DEV_PASSCODE, dev: true };
  } else log.warn('PORTAL_PASSCODE is not set: Scenario Portal sign-in is disabled in production');
  return { passcode: null, dev: false };
}

const digest = (s: string) => createHash('sha256').update(s, 'utf8').digest();

/** Constant-time comparison (both sides hashed first so lengths always match). */
export function passcodeMatches(given: string, expected: string): boolean {
  return timingSafeEqual(digest(given), digest(expected));
}

const MAX_SESSIONS = 500;

export class SessionStore {
  // Keyed by a hash of the token, so a heap dump never holds a usable bearer token.
  private readonly sessions = new Map<string, EducatorSession>();
  constructor(private readonly now: () => number) {}

  create(initials: string | null): { token: string; session: EducatorSession } {
    this.sweep();
    if (this.sessions.size >= MAX_SESSIONS) {
      const oldest = this.sessions.keys().next().value;
      if (oldest !== undefined) this.sessions.delete(oldest);
    }
    const token = randomBytes(32).toString('base64url');
    const session: EducatorSession = { initials, expiresAt: this.now() + SESSION_HOURS * 3_600_000 };
    this.sessions.set(digest(token).toString('hex'), session);
    return { token, session };
  }

  get(token: string): EducatorSession | null {
    const key = digest(token).toString('hex');
    const s = this.sessions.get(key);
    if (!s) return null;
    if (s.expiresAt <= this.now()) {
      this.sessions.delete(key);
      return null;
    }
    return s;
  }

  revoke(token: string): void {
    this.sessions.delete(digest(token).toString('hex'));
  }

  private sweep(): void {
    const t = this.now();
    for (const [k, s] of this.sessions) if (s.expiresAt <= t) this.sessions.delete(k);
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    educator?: EducatorSession;
  }
}

export function bearerToken(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (typeof h !== 'string') return null;
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(h.trim());
  return m?.[1] ?? null;
}

/** preHandler for every educator route. */
export function requireEducator(store: SessionStore) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const token = bearerToken(req);
    const session = token ? store.get(token) : null;
    if (!session) {
      void reply.header('cache-control', 'no-store');
      return reply.code(401).send({ error: 'unauthorized', message: 'Please sign in to the Scenario Portal again.' });
    }
    req.educator = session;
  };
}
