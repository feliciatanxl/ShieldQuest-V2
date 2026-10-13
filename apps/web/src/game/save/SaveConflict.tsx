// Pops up on game pages when this device's Save Card has newer progress from another device (state/saveCard.ts
// pauses uploads until the player chooses). Closing it keeps uploads paused; the choice is also offered in the
// Save Card sheet, and again the next time the app starts.

import { useState } from 'react';
import { Sheet } from '../../ui/Sheet';
import { useSaveCard, type SaveConflict as Conflict } from '../../state/saveCard';
import { ConflictChoice } from './ConflictChoice';
import './save.css';

export default function SaveConflict() {
  const conflict = useSaveCard((s) => s.conflict);
  const [dismissed, setDismissed] = useState<Conflict | null>(null);
  const open = conflict !== null && conflict !== dismissed;
  // Keep the last conflict rendered while the sheet closes.
  const [shown, setShown] = useState<Conflict | null>(conflict);
  if (conflict && conflict !== shown) setShown(conflict);

  if (!shown) return null;
  return (
    <Sheet open={open} onClose={() => setDismissed(conflict)} title="Save Card">
      <div className="sv">
        <ConflictChoice key={shown.server.rev} conflict={shown} autoFocus={open} />
      </div>
    </Sheet>
  );
}
