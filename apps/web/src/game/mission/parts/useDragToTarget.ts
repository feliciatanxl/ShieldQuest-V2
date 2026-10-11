import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

export interface DragState<T extends string> {
  id: T;
  dx: number;
  dy: number;
  /** The pointer is over the drop target. */
  over: boolean;
}

const MOVE_THRESHOLD = 8;

function inside(el: HTMLElement | null, x: number, y: number): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/**
 * Pointer drag of small handles onto a target element. Every drag in the game also has a tap alternative
 * (GAME_DESIGN.md 10.1), so callers keep an onClick; `wasDrag()` tells that click to ignore a finished drag.
 */
export function useDragToTarget<T extends string>(target: RefObject<HTMLElement | null>, onDrop: (id: T) => void) {
  const [drag, setDrag] = useState<DragState<T> | null>(null);
  const start = useRef<{ x: number; y: number; id: T; moved: boolean; pointerId: number } | null>(null);
  const dragged = useRef(false);

  const handlers = useCallback(
    (id: T) => ({
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        start.current = { x: e.clientX, y: e.clientY, id, moved: false, pointerId: e.pointerId };
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
        const s = start.current;
        if (!s || s.pointerId !== e.pointerId) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (!s.moved && Math.hypot(dx, dy) < MOVE_THRESHOLD) return;
        s.moved = true;
        setDrag({ id: s.id, dx, dy, over: inside(target.current, e.clientX, e.clientY) });
      },
      onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
        const s = start.current;
        start.current = null;
        if (!s || !s.moved) return;
        dragged.current = true;
        setDrag(null);
        if (inside(target.current, e.clientX, e.clientY)) onDrop(s.id);
      },
      onPointerCancel: () => {
        start.current = null;
        setDrag(null);
      },
    }),
    [target, onDrop],
  );

  /** True once after a drag finished, so the click that follows can be ignored. */
  const wasDrag = useCallback(() => {
    const v = dragged.current;
    dragged.current = false;
    return v;
  }, []);

  return { drag, handlers, wasDrag };
}
