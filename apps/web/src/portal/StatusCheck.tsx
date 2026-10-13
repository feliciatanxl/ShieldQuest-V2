// "Check on my idea": a ticket lookup that returns the status only (never the card's content).

import { useId, useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { StatusBadge, type Status } from '../ui/StatusBadge';
import { PortalError, api } from './api';
import type { SubmissionStatus, SubmissionStatusView } from './model';

const LOOK: Record<SubmissionStatus, { status: Status; label: string }> = {
  pending: { status: 'unknown', label: 'Waiting' },
  approved: { status: 'safe', label: 'Picked' },
  rejected: { status: 'attention', label: 'Returned' },
};

export function StatusCheck({ initialTicket = '', headingLevel = 2 }: { initialTicket?: string; headingLevel?: 2 | 3 }) {
  const [ticket, setTicket] = useState(initialTicket);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SubmissionStatusView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const H = headingLevel === 2 ? 'h2' : 'h3';

  const check = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!ticket.trim()) {
      setError('Enter the ticket code you were given, e.g. MC-7K2Q-9HXD.');
      return;
    }
    setBusy(true);
    try {
      setResult(await api<SubmissionStatusView>(`/api/submissions/${encodeURIComponent(ticket.trim())}`));
    } catch (err) {
      setError(err instanceof PortalError ? err.message : 'Could not check right now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="portal-card portal-status" onSubmit={(e) => void check(e)} noValidate>
      <H className="portal-card__title">Check on your idea</H>
      <div className="portal-inline">
        <div className="portal-input">
          <label htmlFor={id}>Ticket code</label>
          <input
            id={id}
            value={ticket}
            onChange={(e) => setTicket(e.target.value.toUpperCase().slice(0, 16))}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="portal-input--code"
            placeholder="MC-XXXX-XXXX"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={busy}>
          {busy ? 'Checking…' : 'Check'}
        </Button>
      </div>
      <div aria-live="polite" className="portal-status__result">
        {error && <p className="portal-error">{error}</p>}
        {result && (
          <div className="portal-status__row">
            <StatusBadge status={LOOK[result.status].status} label={LOOK[result.status].label} />
            <p>
              {result.statusText}
              {result.reason ? `: ${result.reason}.` : '.'}
              {result.status === 'rejected' && ' Thank you for trying. You are welcome to pitch another idea.'}
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
