// "Which progress do you want to keep?" Shown when the Save Card on the server has progress this device has not
// seen (another device saved since). The two summaries are worked out on this device from the decrypted save and
// local storage; nothing new is sent anywhere.

import { useEffect, useRef, useState } from 'react';
import { Button } from '../../ui/Button';
import {
  keepThisDeviceSave,
  loadNewerSave,
  thisDevicePreview,
  type SaveConflict,
  type SavePreview,
} from '../../state/saveCard';

function dayLabel(ms: number | null): string | null {
  if (!ms) return null;
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'today';
  if (d.toDateString() === yesterday.toDateString()) return 'yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function Side({
  title,
  preview,
  at,
  handle,
  accent,
}: {
  title: string;
  preview: Omit<SavePreview, 'savedAt'>;
  at: number | null;
  handle: boolean;
  accent?: boolean;
}) {
  const day = dayLabel(at);
  return (
    <li className={`sv-side${accent ? ' sv-side--accent' : ''}`}>
      <h4>{title}</h4>
      {handle && preview.handle && <p className="sv-side__handle">{preview.handle}</p>}
      <ul className="sv-side__facts">
        <li>
          <strong>{preview.stars ?? '?'}</strong> Stars earned
        </li>
        <li>
          <strong>{preview.missions ?? '?'}</strong> mission{preview.missions === 1 ? '' : 's'} done
        </li>
        {day && <li>Last saved {day}</li>}
      </ul>
    </li>
  );
}

/** The two saves side by side and the two choices. `autoFocus` moves focus to the heading on mount. */
export function ConflictChoice({ conflict, autoFocus = false }: { conflict: SaveConflict; autoFocus?: boolean }) {
  const headRef = useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState<'load' | 'keep' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Read when shown (and again on each render) so it includes anything played since the check.
  const mine = thisDevicePreview();
  const card = conflict.server.preview;
  const showHandles = Boolean(mine.handle && card.handle && mine.handle !== card.handle);

  useEffect(() => {
    if (autoFocus) headRef.current?.focus();
  }, [autoFocus]);

  const load = async () => {
    setBusy('load');
    setError(null);
    try {
      await loadNewerSave(); // reloads the app
    } catch {
      setBusy(null);
      setError('This device could not store the progress. Free up some space or try another browser.');
    }
  };

  const keep = async () => {
    setBusy('keep');
    setError(null);
    await keepThisDeviceSave();
    setBusy(null);
  };

  return (
    <div className="sv-conflict">
      <h3 ref={headRef} tabIndex={-1}>
        Your Save Card has newer progress from another device.
      </h3>
      <p>Which progress do you want to keep?</p>
      <ul className="sv-sides">
        <Side title="On your Save Card" preview={card} at={card.savedAt} handle={showHandles} accent />
        <Side title="On this device" preview={mine} at={conflict.localAt} handle={showHandles} />
      </ul>
      <p className="sv-warn" role="note">
        The progress you do not pick is replaced.
      </p>
      {error && (
        <p className="sv-error" role="alert">
          {error}
        </p>
      )}
      <div className="sv-actions sv-actions--stack">
        <Button block onClick={load} disabled={busy !== null} aria-busy={busy === 'load'}>
          {busy === 'load' ? 'Loading…' : 'Load the newer progress'}
        </Button>
        <Button
          block
          variant="secondary"
          className="sv-btn-ink"
          onClick={keep}
          disabled={busy !== null}
          aria-busy={busy === 'keep'}
        >
          {busy === 'keep' ? 'Saving…' : "Keep this device's progress"}
        </Button>
      </div>
    </div>
  );
}
