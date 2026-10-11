import type { KeyboardEvent } from 'react';
import type { Mission } from '@shieldquest/shared';
import { Icon } from '../../../ui/Icon';
import { StatusBadge } from '../../../ui/StatusBadge';
import { BOARD_COLUMNS, boardColumn, castName, scanNote, type Call, type Inspectable } from '../runLogic';
import { PawPrint } from './ChatThread';
import './parts.css';

export interface InspectCardProps {
  mission: Mission;
  item: Inspectable;
  /** The call made so far on this item's clue. */
  call?: Call;
  /** Tapped while the moment was still live. */
  firstLook?: boolean;
  /** Arrived after the Hold: read early, while it hung in mid-air. */
  readEarly?: boolean;
  /** Cluepaw led you here. */
  sniffed?: boolean;
  /** ByteBuddy's scan is active. */
  scanned?: boolean;
  /** VeriFox Check the Source, when unfolded and the item carries a claim. */
  crossCheck?: { used: boolean; result: string | null; onUse: () => void } | null;
  onCall?: (call: Call) => void;
}

const KIND_LABEL: Record<Inspectable['kind'], string> = { message: 'Message', place: 'Look around', person: 'Person' };

/** Inspect card (DOM, scalable text): PIN AS RED FLAG or Seems fine. P pins from the keyboard. */
export function InspectCard({ mission, item, call, firstLook, readEarly, sniffed, scanned, crossCheck, onCall }: InspectCardProps) {
  const { clue, beat } = item;
  const scan = scanned ? scanNote(beat) : null;
  const column = clue ? BOARD_COLUMNS.find((c) => c.id === boardColumn(mission, clue)) : undefined;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!clue || !onCall || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      onCall('flag');
    }
  };

  return (
    <div className="msn-inspect" onKeyDown={onKeyDown}>
      <div className="msn-inspect__tags">
        <span className="msn-inspect__kind">{KIND_LABEL[item.kind]}</span>
        {firstLook && (
          <span className="msn-inspect__tag">
            <Icon name="pin" /> First look
          </span>
        )}
        {readEarly && <span className="msn-inspect__tag">Read early, in mid-air</span>}
      </div>

      {beat ? (
        <figure className="msn-inspect__quote">
          <figcaption>{beat.from === mission.resident ? `${castName(mission, beat.from)} wrote` : castName(mission, beat.from)}</figcaption>
          <blockquote>{beat.text}</blockquote>
          {beat.attachment && (
            <p className="msn-inspect__attach">
              <Icon name="info" /> <strong>{beat.attachment.label}</strong>
              {beat.attachment.detail ? ` · ${beat.attachment.detail}` : ''}
            </p>
          )}
        </figure>
      ) : (
        <div className="msn-inspect__place">
          <p className="msn-inspect__title">{item.title}</p>
          {clue ? (
            <p>
              <span className="msn-inspect__notice">You notice:</span> {clue.label}
            </p>
          ) : (
            <p>{item.detail}</p>
          )}
        </div>
      )}

      {sniffed && (
        <p className="msn-inspect__guardian" data-guardian="cluepaw">
          <PawPrint /> Cluepaw sniffed this out. Take a close look.
        </p>
      )}
      {scan && (
        <p className="msn-inspect__guardian" data-guardian="bytebuddy">
          <Icon name="eye" /> ByteBuddy: {scan}
        </p>
      )}
      {crossCheck && (
        <div className="msn-inspect__verify">
          {crossCheck.result ? (
            <p className="msn-inspect__guardian" data-guardian="verifox" role="status">
              <StatusBadge status="unknown" label="Can't verify" /> VeriFox: {crossCheck.result}
            </p>
          ) : (
            <button
              type="button"
              className="ui-btn ui-btn--secondary ui-btn--sm msn-inspect__verify-btn"
              disabled={crossCheck.used}
              onClick={crossCheck.onUse}
            >
              <Icon name="eye" />
              <span>{crossCheck.used ? 'VeriFox already checked a claim' : 'VeriFox: Check the Source'}</span>
            </button>
          )}
        </div>
      )}

      {clue && onCall ? (
        <>
          <div className="msn-inspect__actions" role="group" aria-label="Your call">
            <button
              type="button"
              className="ui-btn ui-btn--danger msn-inspect__pin"
              aria-pressed={call === 'flag'}
              onClick={() => onCall('flag')}
              aria-keyshortcuts="P"
            >
              <Icon name="pin" />
              <span>Pin as red flag</span>
            </button>
            <button type="button" className="ui-btn ui-btn--paper msn-inspect__fine" aria-pressed={call === 'fine'} onClick={() => onCall('fine')}>
              <Icon name="check" />
              <span>Seems fine</span>
            </button>
          </div>
          <div className="msn-inspect__result" role="status">
            {call === 'flag' && (
              <p>
                <Icon name="pin" /> Pinned to your board under <strong>{column ? `${column.id} · ${column.title}` : 'Spot'}</strong>:{' '}
                {clue.label}
              </p>
            )}
            {call === 'fine' && !clue.redFlag && (
              <p>
                <StatusBadge status="safe" label="Good call" /> This is an ordinary detail. {clue.explain}
              </p>
            )}
            {call === 'fine' && clue.redFlag && <p>Marked as seems fine. You can change your call until you tap Done.</p>}
          </div>
        </>
      ) : (
        !clue && <p className="msn-inspect__none">Nothing here needs a call. Keep looking around.</p>
      )}
    </div>
  );
}
