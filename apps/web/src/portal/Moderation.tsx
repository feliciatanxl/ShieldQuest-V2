// Moment Cards queue (GDD §7.4): educators read every youth pitch and approve it into a draft mission
// or return it with a reason code. Also: cohort maker codes and the recent activity log.

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { DISTRICTS, SQUAD_TOTEMS, TACTICS, bandById } from '@shieldquest/shared';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { StatusBadge, type Status } from '../ui/StatusBadge';
import { api, getSession, PortalError, rememberInitials } from './api';
import {
  PITCH_LIMITS,
  PITCH_PUSHERS,
  PITCH_RECOVERY_MOVES,
  PITCH_RED_FLAGS,
  PITCH_SAFER_MOVES,
  RETURN_REASONS,
  isInitials,
  normalizeInitials,
  settingById,
  youthCredit,
  type AuditEntry,
  type MakerCode,
  type ReturnReasonId,
  type SubmissionStatus,
  type SubmissionView,
} from './model';
import { Note, formatDate, formatHour } from './parts';

const STATUS_LOOK: Record<SubmissionStatus, { status: Status; label: string }> = {
  pending: { status: 'unknown', label: 'Waiting' },
  approved: { status: 'safe', label: 'Approved' },
  rejected: { status: 'attention', label: 'Returned' },
};

const FILTERS: { id: SubmissionStatus | 'all'; label: string }[] = [
  { id: 'pending', label: 'Waiting' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Returned' },
  { id: 'all', label: 'All' },
];

function CardBody({ s }: { s: SubmissionView }) {
  const p = s.pitch;
  const district = DISTRICTS.find((d) => d.id === p.district);
  const pusher = PITCH_PUSHERS.find((x) => x.id === p.pusher);
  const safer = [PITCH_SAFER_MOVES.find((m) => m.id === p.saferMove.chip)?.label, p.saferMove.text].filter(Boolean).join(' · ');
  return (
    <div className="portal-moment portal-moment--card">
      <p className="portal-moment__where">
        {district && <span className="portal-dot" style={{ background: district.color }} aria-hidden="true" />}
        {district?.name} · {settingById(p.setting)?.label ?? p.setting} · for {bandById(p.band).label} ({bandById(p.band).ages})
      </p>
      <p className="portal-moment__who">{pusher ? `${pusher.label} says:` : 'Someone says:'}</p>
      <blockquote className="portal-moment__quote">{p.whatTheySay}</blockquote>
      <ul className="portal-tags" aria-label="Pressure tricks">
        {p.pressureTactics.map((t) => (
          <li key={t}>{TACTICS.find((x) => x.id === t)?.ringLabel ?? t}</li>
        ))}
      </ul>
      <dl className="portal-moment__list">
        <dt>Warning signs</dt>
        <dd>{[...p.redFlags.chips.map((c) => PITCH_RED_FLAGS.find((f) => f.id === c)?.label ?? c), p.redFlags.text].filter(Boolean).join(' · ')}</dd>
        <dt>Safer move</dt>
        <dd>{safer || '—'}</dd>
        {p.recoveryMove && (
          <>
            <dt>If it already happened</dt>
            <dd>{PITCH_RECOVERY_MOVES.find((m) => m.id === p.recoveryMove)?.label}</dd>
          </>
        )}
      </dl>
      <p className="portal-moment__credit">
        {youthCredit(p.totem, s.cohort)} · received {formatHour(s.createdAtHour)}
      </p>
    </div>
  );
}

function Decide({ s, onDone }: { s: SubmissionView; onDone: (missionId: string | null) => void }) {
  const [mode, setMode] = useState<'idle' | 'return'>('idle');
  const [reason, setReason] = useState<ReturnReasonId | ''>('');
  const [note, setNote] = useState('');
  const [initials, setInitials] = useState(getSession()?.initials ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iniId = useId();
  const noteId = useId();

  const send = async (decision: 'approve' | 'reject') => {
    const ini = normalizeInitials(initials);
    if (!isInitials(ini)) {
      setError('Add your initials (1-4 letters) first.');
      return;
    }
    if (decision === 'reject' && !reason) {
      setError('Pick a reason so the young person knows why.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      rememberInitials(ini);
      const r = await api<{ missionId: string | null }>(`/api/submissions/${encodeURIComponent(s.id)}/decision`, {
        body: { decision, initials: ini, ...(reason && decision === 'reject' ? { reason } : {}), ...(note.trim() ? { note } : {}) },
        auth: true,
      });
      onDone(r.missionId);
    } catch (e) {
      setError(e instanceof PortalError ? e.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="portal-decide">
      <div className="portal-input">
        <label htmlFor={iniId}>Your initials</label>
        <input
          id={iniId}
          value={initials}
          onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 4))}
          maxLength={4}
          autoComplete="off"
          className="portal-input--short"
        />
      </div>
      {mode === 'return' && (
        <form
          className="portal-decide__return"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void send('reject');
          }}
        >
          <fieldset className="portal-field portal-field--plain">
            <legend className="portal-field__legend">Reason (the young person sees this)</legend>
            <div className="portal-radios">
              {RETURN_REASONS.map((r) => (
                <label key={r.id} className="portal-check">
                  <input type="radio" name={`reason-${s.id}`} checked={reason === r.id} onChange={() => setReason(r.id)} />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="portal-input">
            <label htmlFor={noteId}>
              Note for the team <span className="portal-muted">(optional, never shown to the young person)</span>
            </label>
            <textarea id={noteId} rows={2} value={note} maxLength={PITCH_LIMITS.note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="portal-actions">
            <Button type="submit" variant="danger" disabled={busy}>
              Return card
            </Button>
            <Button variant="ghost" onClick={() => setMode('idle')}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {mode === 'idle' && (
        <div className="portal-actions">
          <Button icon="check" disabled={busy} onClick={() => void send('approve')}>
            Approve as draft
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setMode('return')}>
            Return with a reason
          </Button>
        </div>
      )}
      {error && (
        <p className="portal-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Moderation() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<SubmissionStatus | 'all'>('pending');
  const [list, setList] = useState<SubmissionView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [lastDraft, setLastDraft] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ submissions: SubmissionView[] }>(`/api/submissions?status=${filter}`, { auth: true });
      setList(r.submissions);
      setError(null);
    } catch (e) {
      setError(e instanceof PortalError ? e.message : 'Could not load the queue.');
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="portal-moderation">
      <header className="portal-section-head">
        <div>
          <p className="kicker">Moderation</p>
          <h1 tabIndex={-1}>Moment Cards</h1>
          <p className="portal-muted">
            Ideas pitched by young people. Approving one makes a draft mission skeleton for the team to build out; it still
            needs two sign-offs before anyone plays it. Returned cards are deleted after 30 days.
          </p>
        </div>
      </header>

      <div className="portal-segment" role="group" aria-label="Show cards">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className="portal-segment__btn" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      {lastDraft && (
        <Note status="safe">
          <p>
            Draft <code>{lastDraft}</code> created.{' '}
            <Button size="sm" variant="secondary" icon="text" onClick={() => navigate(`/portal?tab=editor&id=${encodeURIComponent(lastDraft)}`)}>
              Open in the editor
            </Button>
          </p>
        </Note>
      )}
      {error && <Note status="risk">{error}</Note>}
      {!list && !error && <p className="portal-loading">Loading the queue…</p>}
      {list && !list.length && (
        <Note status="unknown">{filter === 'pending' ? 'No cards are waiting. Nice work.' : 'No cards here.'}</Note>
      )}

      <ul className="portal-queue">
        {list?.map((s) => (
          <li key={s.id} className="portal-queue__item">
            <div className="portal-queue__head">
              <StatusBadge status={STATUS_LOOK[s.status].status} label={STATUS_LOOK[s.status].label} />
              {s.decision && (
                <span className="portal-muted">
                  by {s.decision.initials} on {formatDate(s.decision.at)}
                  {s.decision.reason && ` · ${RETURN_REASONS.find((r) => r.id === s.decision?.reason)?.label}`}
                </span>
              )}
            </div>
            <CardBody s={s} />
            {s.warnings.length > 0 && (
              <Note status="attention">
                <p>Wording to check: {s.warnings.join(' ')}</p>
              </Note>
            )}
            {s.decision?.note && <p className="portal-fine">Team note: {s.decision.note}</p>}
            {s.status === 'pending' ? (
              <Decide
                s={s}
                onDone={(missionId) => {
                  setAnnounce(missionId ? `Approved. Draft ${missionId} created.` : 'Card returned.');
                  setLastDraft(missionId);
                  void load();
                }}
              />
            ) : (
              s.decision?.missionId && (
                <Button size="sm" variant="secondary" icon="text" onClick={() => navigate(`/portal?tab=editor&id=${encodeURIComponent(s.decision?.missionId ?? '')}`)}>
                  Open draft {s.decision.missionId}
                </Button>
              )
            )}
          </li>
        ))}
      </ul>

      <MakerCodes />
      <Activity />
    </div>
  );
}

function MakerCodes() {
  const [codes, setCodes] = useState<MakerCode[]>([]);
  const [required, setRequired] = useState(false);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const labelId = useId();

  const load = useCallback(async () => {
    try {
      const r = await api<{ codes: MakerCode[]; required: boolean }>('/api/portal/maker-codes', { auth: true });
      setCodes(r.codes);
      setRequired(r.required);
    } catch (e) {
      setError(e instanceof PortalError ? e.message : 'Could not load maker codes.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError('Give the cohort a short label, e.g. NYP Pilot 1.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api<MakerCode>('/api/portal/maker-codes', { body: { label }, auth: true });
      setLabel('');
      await load();
    } catch (err) {
      setError(err instanceof PortalError ? err.message : 'Could not create the code.');
    } finally {
      setBusy(false);
    }
  };

  const now = Date.now();
  return (
    <details className="portal-card portal-makers">
      <summary>
        <h2 className="portal-card__title">
          <Icon name="qr" /> Maker codes
        </h2>
        <span className="portal-muted">
          One per cohort, printed on the take-home card. {required ? 'Required for every Moment Card.' : 'Optional on this server.'}
        </span>
      </summary>
      <form className="portal-inline" onSubmit={(e) => void create(e)}>
        <div className="portal-input">
          <label htmlFor={labelId}>Cohort label (shown as the credit)</label>
          <input id={labelId} value={label} maxLength={PITCH_LIMITS.cohort} onChange={(e) => setLabel(e.target.value)} placeholder="NYP Pilot 1" />
        </div>
        <Button type="submit" variant="secondary" disabled={busy}>
          Create code
        </Button>
      </form>
      {error && <p className="portal-error">{error}</p>}
      {codes.length > 0 && (
        <div className="portal-tablewrap" tabIndex={0} role="region" aria-label="Maker codes">
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Cohort</th>
                <th scope="col">Expires</th>
                <th scope="col">State</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const live = !c.revoked && Date.parse(c.expiresAt) > now;
                return (
                  <tr key={c.id}>
                    <td>
                      <code className="portal-code-chip">{c.id}</code>
                    </td>
                    <td>{c.label}</td>
                    <td>{formatDate(c.expiresAt)}</td>
                    <td>
                      <StatusBadge status={live ? 'safe' : 'unknown'} label={c.revoked ? 'Revoked' : live ? 'Active' : 'Expired'} />
                    </td>
                    <td>
                      {live && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            void api(`/api/portal/maker-codes/${encodeURIComponent(c.id)}/revoke`, { body: {}, auth: true })
                              .then(load)
                              .catch(() => setError('Could not revoke the code.'))
                          }
                        >
                          Revoke<span className="sr-only"> {c.id}</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="portal-fine">
        Squad totems for credits: {SQUAD_TOTEMS.map((t) => t.name).join(', ')}. Never a name.
      </p>
    </details>
  );
}

const ACTION_LABEL: Record<string, string> = {
  'mission.create': 'Created mission',
  'mission.update': 'Edited mission',
  'mission.signoff': 'Signed off',
  'mission.publish': 'Published',
  'mission.unpublish': 'Unpublished',
  'mission.archive': 'Archived',
  'mission.restore': 'Restored',
  'submission.approve': 'Approved Moment Card',
  'submission.return': 'Returned Moment Card',
  'makercode.create': 'Created maker code',
  'makercode.revoke': 'Revoked maker code',
};

function Activity() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    api<{ entries: AuditEntry[] }>('/api/portal/audit', { auth: true })
      .then((r) => setEntries(r.entries))
      .catch(() => setEntries([]));
  }, [open]);
  return (
    <details className="portal-card" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>
        <h2 className="portal-card__title">
          <Icon name="clock" /> Recent activity
        </h2>
        <span className="portal-muted">Every portal action, with initials only.</span>
      </summary>
      {!entries ? (
        <p className="portal-loading">Loading…</p>
      ) : entries.length ? (
        <ol className="portal-activity">
          {entries.map((e) => (
            <li key={e.id}>
              <time dateTime={e.at}>{formatHour(e.at)}</time>
              <span>
                <b>{e.initials ?? '—'}</b> {ACTION_LABEL[e.action] ?? e.action}
                {e.target && (
                  <>
                    {' '}
                    <code>{e.target.length > 24 ? `${e.target.slice(0, 8)}…` : e.target}</code>
                  </>
                )}
                {e.detail && <span className="portal-muted"> · {e.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="portal-muted">No activity yet.</p>
      )}
    </details>
  );
}
