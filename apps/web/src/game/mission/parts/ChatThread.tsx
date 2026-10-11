import { useEffect, useRef } from 'react';
import type { BeatAttachment, Clue, LiveBeat, Mission } from '@shieldquest/shared';
import { Icon, type IconName } from '../../../ui/Icon';
import { castById, castName, clueForBeat, initials, scanNote, type BeatView, type Call } from '../runLogic';
import './parts.css';

export type ChatMark = 'look' | Call;

export interface ChatThreadProps {
  mission: Mission;
  /** From beatViews(mission, t, frozen): landed, typing, frozen (read early) or pending (not shown). */
  views: readonly BeatView[];
  /** Per clue id: a live "first look" pin, or the call made while holding. */
  marks?: Readonly<Record<string, ChatMark>>;
  /** Clue-bearing messages shimmer gently during Live. */
  shimmer?: boolean;
  /** ByteBuddy's Data Scan outlines links, codes, payments and job offers. */
  scanned?: boolean;
  /** Paw prints on the clue Cluepaw sniffed out. */
  sniffed?: string | null;
  /** Tap on a clue-bearing message: a first look while live, Inspect while holding. */
  onClueTap?: (clue: Clue, beat: LiveBeat) => void;
  /** Wording for the tap affordance (e.g. "Mark a first look" or "Inspect"). */
  tapHint?: string;
  /** Announce new messages politely (true during Live; off while frozen so the mid-air cards are not read out at once). */
  announce?: boolean;
  label?: string;
  reduced?: boolean;
}

const ATTACHMENT_ICON: Record<BeatAttachment['kind'], IconName> = {
  link: 'external',
  image: 'eye',
  payment: 'lock',
  screenshot: 'eye',
  listing: 'book',
  job: 'user',
  code: 'lock',
};

function Attachment({ a }: { a: BeatAttachment }) {
  return (
    <span className="msn-bubble__attach">
      <Icon name={ATTACHMENT_ICON[a.kind]} />
      <span>
        <strong>{a.label}</strong>
        {a.detail && <span className="msn-bubble__attach-detail">{a.detail}</span>}
      </span>
    </span>
  );
}

const withStop = (text: string) => (/[.!?…)"'”]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

function scrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

/** Cluepaw's ink paw print (decorative). */
export function PawPrint() {
  return (
    <svg viewBox="0 0 24 24" width="1.1em" height="1.1em" aria-hidden="true" className="msn-paw">
      <ellipse cx="12" cy="15.5" rx="4.6" ry="3.8" fill="currentColor" />
      <circle cx="6" cy="10" r="2" fill="currentColor" />
      <circle cx="9.6" cy="6.6" r="2" fill="currentColor" />
      <circle cx="14.4" cy="6.6" r="2" fill="currentColor" />
      <circle cx="18" cy="10" r="2" fill="currentColor" />
    </svg>
  );
}

function MarkTag({ mark }: { mark: ChatMark }) {
  if (mark === 'look')
    return (
      <span className="msn-bubble__mark" data-mark="look">
        <Icon name="pin" /> First look
      </span>
    );
  if (mark === 'flag')
    return (
      <span className="msn-bubble__mark" data-mark="flag">
        <Icon name="pin" /> Pinned
      </span>
    );
  return (
    <span className="msn-bubble__mark" data-mark="fine">
      <Icon name="check" /> Seems fine
    </span>
  );
}

/** ChatLah conversation: chat bubbles, in-person speech, notification banners and narrator lines (all DOM text). */
export function ChatThread({
  mission,
  views,
  marks = {},
  shimmer,
  scanned,
  sniffed,
  onClueTap,
  tapHint = 'Inspect',
  announce = true,
  label,
  reduced,
}: ChatThreadProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const shown = views.filter((v) => v.state !== 'pending');
  const landed = shown.filter((v) => v.state === 'landed').length;
  const typing = shown.some((v) => v.state === 'typing');

  // Keep the newest message in view (the sheet scrolls, not the list), unless the reader scrolled up to re-read.
  const lastHeight = useRef(0);
  useEffect(() => {
    const list = listRef.current;
    const scroller = list ? scrollParent(list) : null;
    if (!list || !scroller) return;
    const grown = scroller.scrollHeight - lastHeight.current;
    const wasNearBottom = scroller.scrollHeight - grown - scroller.scrollTop - scroller.clientHeight < 200;
    lastHeight.current = scroller.scrollHeight;
    if (wasNearBottom) scroller.scrollTo({ top: scroller.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
  }, [landed, typing, reduced]);

  return (
    <ol
      ref={listRef}
      className="msn-chat"
      role="log"
      aria-live={announce ? 'polite' : 'off'}
      aria-relevant="additions"
      aria-label={label ?? `${castName(mission, mission.resident)}'s messages`}
    >
      {shown.map(({ beat, state }) => {
        if (state === 'typing') {
          const who = castName(mission, beat.from);
          return (
            <li key={`${beat.id}-typing`} className="msn-chat__row" data-side="in" aria-hidden="true">
              <span className="msn-avatar" data-faceless="">
                {initials(who)}
              </span>
              <span className="msn-typing">
                <span />
                <span />
                <span />
              </span>
            </li>
          );
        }
        const clue = clueForBeat(mission, beat.id);
        const frozen = state === 'frozen';
        const mark = clue ? marks[clue.id] : undefined;
        const scan = scanned ? scanNote(beat) : null;
        const tappable = Boolean(clue && onClueTap);
        const who = castName(mission, beat.from);
        const isResident = beat.from === mission.resident;
        const cast = castById(mission, beat.from);

        if (beat.channel === 'scene' || beat.from === 'narrator') {
          // Scene lines can carry a clue too (e.g. a polished logo), so they are tappable like messages.
          const inner = (
            <>
              {frozen && <span className="msn-chat__frozen-tag">Frozen in mid-air · read early</span>}
              <p>{beat.text}</p>
              {mark && <MarkTag mark={mark} />}
            </>
          );
          return (
            <li key={beat.id} className="msn-chat__scene" data-frozen={frozen ? '' : undefined}>
              {tappable && clue ? (
                <button
                  type="button"
                  className={`msn-chat__scene-btn${shimmer && !mark ? ' msn-bubble--shimmer' : ''}`}
                  onClick={() => onClueTap?.(clue, beat)}
                  aria-label={`Scene: ${withStop(beat.text)} ${
                    mark === 'flag' ? 'Pinned as a red flag. ' : mark === 'fine' ? 'Marked seems fine. ' : mark === 'look' ? 'First look pinned. ' : ''
                  }${tapHint}.`}
                >
                  {inner}
                </button>
              ) : (
                inner
              )}
            </li>
          );
        }

        const body = (
          <>
            {beat.channel === 'notification' && (
              <span className="msn-bubble__app">
                <Icon name="phone" /> ChatLah · {who}
              </span>
            )}
            {beat.channel === 'speech' && (
              <span className="msn-bubble__who">
                <Icon name="users" /> {who} says
              </span>
            )}
            {beat.channel === 'chat' && !isResident && <span className="msn-bubble__who">{who}</span>}
            <span className="msn-bubble__text">{beat.text}</span>
            {beat.attachment && <Attachment a={beat.attachment} />}
            {scan && (
              <span className="msn-bubble__scan">
                <Icon name="eye" /> ByteBuddy: {scan}
              </span>
            )}
            {clue && sniffed === clue.id && (
              <span className="msn-bubble__sniff">
                <PawPrint /> Cluepaw sniffed something here
              </span>
            )}
            {mark && <MarkTag mark={mark} />}
            {frozen && <span className="msn-chat__frozen-tag">Frozen in mid-air · read early</span>}
          </>
        );

        const cls = [
          'msn-bubble',
          `msn-bubble--${beat.channel}`,
          isResident ? 'msn-bubble--out' : 'msn-bubble--in',
          frozen ? 'msn-bubble--frozen' : '',
          shimmer && clue && !mark ? 'msn-bubble--shimmer' : '',
          scan ? 'msn-bubble--scanned' : '',
          clue && sniffed === clue.id ? 'msn-bubble--sniffed' : '',
          tappable ? 'msn-bubble--tap' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <li key={beat.id} className="msn-chat__row" data-side={isResident ? 'out' : 'in'} data-channel={beat.channel}>
            {!isResident && beat.channel !== 'notification' && (
              <span className="msn-avatar" data-faceless={cast?.faceless || !cast?.anchor ? '' : undefined} aria-hidden="true">
                {initials(who)}
              </span>
            )}
            {tappable && clue ? (
              <button
                type="button"
                className={cls}
                onClick={() => onClueTap?.(clue, beat)}
                aria-label={`${who}: ${withStop(beat.text)}${beat.attachment ? ` Attachment: ${withStop(beat.attachment.label)}` : ''} ${
                  mark === 'flag' ? 'Pinned as a red flag. ' : mark === 'fine' ? 'Marked seems fine. ' : mark === 'look' ? 'First look pinned. ' : ''
                }${tapHint}.`}
              >
                {body}
              </button>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
