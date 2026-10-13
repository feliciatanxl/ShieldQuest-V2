// Moderation log (GDD §7.4 "every action is recorded"): what changed, when, and the reviewer's
// initials. Never names, IP addresses or youth data.

import { randomUUID } from 'node:crypto';
import { collection } from '../store';
import type { AuditEntry } from './model';

export const AUDIT_COLLECTION = 'moderation-log';
const KEEP = 5_000;

const log = () => collection<AuditEntry & { seq: number }>(AUDIT_COLLECTION);
let seq = 0;

export async function audit(
  action: string,
  target: string | null,
  initials: string | null,
  detail: string | null = null,
  now: number = Date.now(),
): Promise<void> {
  const store = log();
  seq = Math.max(seq, now) + 1;
  await store.put({ id: randomUUID(), seq, at: new Date(now).toISOString(), action, target, initials, detail });
  // Bounded: the oldest entries roll off once the log is long.
  const all = await store.list();
  if (all.length > KEEP) {
    const old = all.sort((a, b) => a.seq - b.seq).slice(0, all.length - KEEP);
    for (const e of old) await store.remove(e.id);
  }
}

export async function recentAudit(limit = 100): Promise<AuditEntry[]> {
  const all = await log().list();
  return all
    .sort((a, b) => b.seq - a.seq)
    .slice(0, limit)
    .map(({ seq: _seq, ...entry }) => entry);
}
