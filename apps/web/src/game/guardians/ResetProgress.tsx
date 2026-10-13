// "Reset my progress on this device": a confirm sheet, because there is no copy anywhere else to restore.
// Optionally also forgets the school level, so a shared school tablet can be handed to the next player.
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useProgress } from '../../state/progress';
import { useSettings } from '../../state/settings';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { writeStored } from '../hub/kit';
import { BOND_SEEN_KEY } from './GuardianShelf';

/** Session convenience keys owned by the hub module (see CityHub). */
const HUB_SESSION_KEYS = ['sq.hub.focus.v1'];

export function ResetProgress({ onDone }: { onDone: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [alsoWelcome, setAlsoWelcome] = useState(false);
  const [, navigate] = useLocation();

  const confirm = () => {
    useProgress.getState().reset();
    writeStored('local', BOND_SEEN_KEY, null);
    for (const key of HUB_SESSION_KEYS) writeStored('session', key, null);
    setOpen(false);
    if (alsoWelcome) {
      useSettings.getState().set({ band: null, onboarded: false });
      navigate('/play');
      return;
    }
    onDone('Your progress on this device has been reset. Lumen is ready for a fresh start.');
  };

  return (
    <>
      <p className="hub-bb-device__text">
        Everything here lives only on this device. Resetting clears your Guardians, Playbook pages, If-Then plans,
        record, lanterns and story wallet. Your comfort settings stay as they are.
      </p>
      <Button variant="danger" icon="rewind" onClick={() => setOpen(true)}>
        Reset my progress on this device
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Reset progress on this device?">
        <div className="hub-bb-confirm">
          <p>
            This clears Guardians and Bond marks, Counter-Playbook pages, If-Then plans, your record, lanterns, the
            story wallet and anything still in motion.
          </p>
          <p>
            <strong>It cannot be undone.</strong> Nothing is saved anywhere else, so there is no copy to bring back.
          </p>
          <label className="ui-toggle hub-bb-confirm__also">
            <input type="checkbox" checked={alsoWelcome} onChange={(e) => setAlsoWelcome(e.target.checked)} />
            <span>Also forget my school level and show the welcome again (useful on a shared device)</span>
          </label>
          <div className="hub-sheet-actions">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep my progress
            </Button>
            <Button variant="danger" icon="rewind" onClick={confirm}>
              Reset progress
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
