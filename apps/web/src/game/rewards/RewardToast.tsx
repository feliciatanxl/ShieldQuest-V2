// Short, polite reward toast. Watches useRewards().lastEvent, shows what changed ("+20 Stars",
// "Tile claimed!", "Badge: 3-Day Streak"), dismisses itself, and consumes the event so it shows once.
// Mount one per page (the hub, the City Board, the Locker, the Arcade...). It never takes focus or blocks taps.
import { useEffect, useRef, useState } from 'react';
import { BADGES, districtById, type RewardEvent } from '@shieldquest/shared';
import { useRewards } from '../../state/rewards';
import { useReducedMotionSetting } from '../hub/kit';
import { StarGlyph } from './glyphs';
import './rewards.css';

export interface ToastMessage {
  title: string;
  lines: string[];
}

const badgeName = (id: string) => BADGES.find((b) => b.id === id)?.name ?? id;

/** Words for a reward event, or null when nothing worth a toast happened. */
export function describeEvent(e: RewardEvent, streak: number): ToastMessage | null {
  const lines: string[] = [];
  if (e.passedHq) lines.push('Passed HQ: +10');
  if (e.secured) lines.push(`${districtById(e.secured).name} secured! +50`);
  else if (e.claimed) lines.push('Tile claimed!');
  for (const b of e.badges) lines.push(`Badge: ${badgeName(b)}`);
  if (e.streakBonus > 0) lines.push(streak > 1 ? `${streak}-day streak: +${e.streakBonus}` : `Streak started: +${e.streakBonus}`);
  if (e.rolls > 0) lines.push(e.rolls === 1 ? '+1 roll' : `+${e.rolls} rolls`);
  if (e.stars > 0) return { title: `+${e.stars} ${e.stars === 1 ? 'Star' : 'Stars'}`, lines };
  if (lines.length === 0) return null;
  const [title, ...rest] = lines;
  return { title: title!, lines: rest };
}

const SHOW_MS = 3800;

export interface RewardToastProps {
  /** Wait before showing (e.g. while the board token is still moving). */
  hold?: boolean;
  /** A page-local message, e.g. "+3 daily rolls". Give it a new id to show it again. */
  note?: { id: number; text: string; detail?: string } | null;
}

export function RewardToast({ hold = false, note = null }: RewardToastProps) {
  const lastEvent = useRewards((s) => s.lastEvent);
  const reduced = useReducedMotionSetting();
  const [queue, setQueue] = useState<(ToastMessage & { key: number })[]>([]);
  const seq = useRef(0);
  const shown = queue[0] ?? null;

  const show = (msg: ToastMessage) => {
    seq.current += 1;
    const key = seq.current;
    // At most two waiting, so a burst of rewards never keeps toasts coming for long.
    setQueue((q) => [...q, { ...msg, key }].slice(0, 3));
  };

  // Each toast stays for SHOW_MS, then the next one (if any) takes its place.
  const shownKey = shown?.key;
  useEffect(() => {
    if (shownKey === undefined) return;
    const t = window.setTimeout(() => setQueue((q) => q.filter((m) => m.key !== shownKey)), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [shownKey]);

  useEffect(() => {
    if (!lastEvent || hold) return;
    const { rewards, clearEvent } = useRewards.getState();
    const msg = describeEvent(lastEvent, rewards.streak);
    clearEvent();
    if (msg) show(msg);
  }, [lastEvent, hold]);

  const noteId = note?.id;
  const shownNote = useRef<number | null>(null);
  useEffect(() => {
    if (!note || hold || shownNote.current === note.id) return;
    shownNote.current = note.id;
    show({ title: note.text, lines: note.detail ? [note.detail] : [] });
    // Only a new note id shows it (once).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, hold]);

  return (
    <div className="rw-toast-region" role="status" aria-live="polite" aria-atomic="true">
      {shown && (
        <div key={shown.key} className="rw-toast" data-anim={reduced ? 'off' : 'on'}>
          <StarGlyph size={26} />
          <div className="rw-toast__text">
            <p className="rw-toast__title">{shown.title}</p>
            {shown.lines.map((l) => (
              <p key={l} className="rw-toast__line">
                {l}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
