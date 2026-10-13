import { useEffect, useId, useRef, useState } from 'react';
import { Sheet } from '../../ui/Sheet';
import { Button } from '../../ui/Button';
import { useRewards } from '../../state/rewards';
import {
  makeSaveCard,
  removeSaveCard,
  restoreLink,
  startAutoSync,
  syncNow,
  useSaveCard,
  type SyncStatus,
} from '../../state/saveCard';
import { CodeTiles, LoadForm, SaveQr } from './parts';
import { ConflictChoice } from './ConflictChoice';
import './save.css';

function statusText(status: SyncStatus, savedAt: number | null): string {
  switch (status) {
    case 'saving':
      return 'Saving…';
    case 'saved':
      return savedAt
        ? `Saved ${new Date(savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
        : 'Saved';
    case 'offline':
      return 'Kept on this device. It will upload when you are online.';
    case 'full':
      return 'Cannot upload right now. Your progress is safe on this device.';
    case 'error':
      return 'Could not upload. We will try again.';
    case 'conflict':
      return 'Not uploading until you choose which progress to keep.';
    default:
      return '';
  }
}

/** The player's own card: the words, a QR code, copy, sync status and remove. */
function CardView({ code, justMade }: { code: string; justMade: boolean }) {
  const headRef = useRef<HTMLHeadingElement>(null);
  const status = useSaveCard((s) => s.status);
  const savedAt = useSaveCard((s) => s.savedAt);
  const conflict = useSaveCard((s) => s.conflict);
  // Hidden by default when reopened, so a classmate cannot read it over a shoulder.
  const [shown, setShown] = useState(justMade);
  const [copied, setCopied] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const copyRef = useRef<HTMLInputElement>(null);

  // Show/Hide swaps the button that had focus, so move focus to the card heading instead of losing it.
  const reveal = (show: boolean) => {
    setShown(show);
    requestAnimationFrame(() => headRef.current?.focus());
  };

  useEffect(() => {
    if (justMade) headRef.current?.focus();
  }, [justMade]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Older browsers: select the text so a long-press "Copy" works.
      copyRef.current?.select();
      document.execCommand?.('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const remove = async () => {
    setRemoving(true);
    setRemoveError(null);
    try {
      await removeSaveCard();
    } catch (err) {
      setRemoving(false);
      setRemoveError(
        err instanceof Error && err.message === 'offline'
          ? 'You need the internet to remove a Save Card. Try again when you are online.'
          : 'Could not remove it right now. Try again soon.',
      );
    }
  };

  return (
    <section className="sv-card" aria-labelledby="sv-card-title">
      <h3 id="sv-card-title" ref={headRef} tabIndex={-1}>
        Your Save Card
      </h3>
      {shown ? (
        <>
          <CodeTiles code={code} />
          <SaveQr text={restoreLink(code)} />
          <p className="sv-warn">
            <strong>Screenshot this or write it down.</strong> Anyone with this code can load your progress. We never
            ask for your name or email.
          </p>
          <input ref={copyRef} className="sr-only" readOnly value={code} tabIndex={-1} aria-hidden="true" />
          <div className="sv-actions">
            <Button variant="secondary" className="sv-btn-ink" onClick={copy}>
              {copied ? 'Copied!' : 'Copy code'}
            </Button>
            <Button variant="ghost" className="sv-btn-ink" onClick={() => reveal(false)}>
              Hide
            </Button>
          </div>
        </>
      ) : (
        <div className="sv-actions">
          <Button variant="secondary" className="sv-btn-ink" onClick={() => reveal(true)}>
            Show my code
          </Button>
        </div>
      )}

      <p className="sv-status" role="status" aria-live="polite" data-status={status}>
        {statusText(status, savedAt)}
        {status === 'error' && (
          <>
            {' '}
            <button type="button" className="sv-link" onClick={() => void syncNow()}>
              Try again
            </button>
          </>
        )}
      </p>

      {conflict && <ConflictChoice key={conflict.server.rev} conflict={conflict} />}

      {confirmRemove ? (
        <div className="sv-remove" role="group" aria-label="Remove Save Card">
          <p>Remove this card? Its code stops working. Your progress stays on this device.</p>
          {removeError && (
            <p className="sv-error" role="alert">
              {removeError}
            </p>
          )}
          <div className="sv-actions">
            <Button variant="danger" size="sm" onClick={remove} disabled={removing}>
              {removing ? 'Removing…' : 'Remove'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="sv-btn-ink"
              onClick={() => setConfirmRemove(false)}
              disabled={removing}
            >
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" className="sv-link sv-link--quiet" onClick={() => setConfirmRemove(true)}>
          Remove my Save Card
        </button>
      )}
    </section>
  );
}

function MakeCard({ onMaking, focusOnMount }: { onMaking: () => void; focusOnMount: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // After a card is removed, its section disappears: put focus on the button that replaced it.
    if (focusOnMount) sectionRef.current?.querySelector('button')?.focus();
  }, [focusOnMount]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const make = async () => {
    setBusy(true);
    setError(null);
    // Flag first: the card view mounts as soon as the code exists, before the first upload finishes.
    onMaking();
    try {
      await makeSaveCard();
    } catch {
      setBusy(false);
      setError('This device is blocking storage, so it cannot keep a Save Card. Try another browser.');
    }
  };
  return (
    <section className="sv-make" ref={sectionRef}>
      <p>
        Play on another phone or computer and keep your progress. <strong>No account. No name. No email.</strong> Just 4
        secret words.
      </p>
      {error && (
        <p className="sv-error" role="alert">
          {error}
        </p>
      )}
      <Button size="lg" block onClick={make} disabled={busy} aria-busy={busy}>
        {busy ? 'Making your card…' : 'Make my Save Card'}
      </Button>
    </section>
  );
}

/** Save Card sheet: make or show this device's card, and load a card from another device. */
export function SaveCardPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const handle = useRewards((s) => s.rewards.handle);
  const code = useSaveCard((s) => s.code);
  const [justMade, setJustMade] = useState(false);
  // True once this panel has shown a card, so a later MakeCard (after Remove) takes focus.
  const [hadCard, setHadCard] = useState(false);
  if (code && !hadCard) setHadCard(true);
  const loadId = useId();

  useEffect(() => {
    if (code) startAutoSync();
  }, [code]);

  return (
    <Sheet open={open} onClose={onClose} title="Save Card">
      <div className="sv">
        <p className="sv-handle">
          You play as <strong>{handle}</strong>
        </p>
        {code ? (
          <CardView code={code} justMade={justMade} />
        ) : (
          <MakeCard onMaking={() => setJustMade(true)} focusOnMount={hadCard} />
        )}
        <section className="sv-load" aria-labelledby={loadId}>
          <h3 id={loadId}>Load a Save Card</h3>
          <LoadForm />
        </section>
      </div>
    </Sheet>
  );
}

export default SaveCardPanel;
