import { useState } from 'react';
import { ALWAYS_SHOW_HELP, GAME, HELP_CHANNELS, helpById, type HelpChannelId } from '@shieldquest/shared';
import { useSettings } from '../state/settings';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

/** "Need to talk?" list. Plain text contacts only (no links into official sites without consent). */
export function HelpList({ extra = [] }: { extra?: HelpChannelId[] }) {
  const band = useSettings((s) => s.band);
  const ids = [...new Set<HelpChannelId>([...extra, ...ALWAYS_SHOW_HELP])];
  const channels = ids.map(helpById).filter((h) => band !== 'junior' || h.junior);
  return (
    <ul className="ui-helplist">
      {channels.map((h) => (
        <li key={h.id}>
          <strong>{h.name}</strong>
          <span className="ui-helplist__contact">{h.contact}</span>
          <span className="ui-helplist__when">
            {h.when}
            {h.hours ? ` (${h.hours})` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Floating "Need help?" button + sheet, available on every game screen. */
export function HelpButton({ extra }: { extra?: HelpChannelId[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="ui-iconbtn ui-helpbtn" onClick={() => setOpen(true)} aria-label="Need help? Help and support contacts">
        <Icon name="heart" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Need to talk?">
        <p>
          You never have to share anything personal in ShieldQuest. If something in a mission, or in real life, is
          worrying you, these people can help.
        </p>
        <HelpList extra={extra} />
        <details className="ui-details">
          <summary>All help and reporting channels</summary>
          <ul className="ui-helplist">
            {HELP_CHANNELS.map((h) => (
              <li key={h.id}>
                <strong>{h.name}</strong>
                <span className="ui-helplist__contact">{h.contact}</span>
                <span className="ui-helplist__when">{h.when}</span>
              </li>
            ))}
          </ul>
        </details>
        <p className="ui-fineprint">{GAME.disclaimer}</p>
      </Sheet>
    </>
  );
}
