// Virtual joystick (touch, bottom-left). Pointer-only by design: keyboard players use WASD / arrows and
// everyone can use the Nearby list, so it is hidden from assistive tech. Writes straight to the controller
// (no React state per move) and moves the knob with a transform.
import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';

interface JoystickProps {
  onChange: (x: number, y: number) => void;
}

export function Joystick({ onChange }: JoystickProps) {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);

  const update = useCallback(
    (clientX: number, clientY: number) => {
      const el = base.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const radius = r.width / 2;
      let dx = clientX - (r.left + radius);
      let dy = clientY - (r.top + radius);
      const max = radius * 0.62;
      const len = Math.hypot(dx, dy);
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
      // Small dead zone so a resting thumb doesn't drift.
      const nx = dx / max;
      const ny = -dy / max;
      onChange(Math.abs(nx) < 0.12 ? 0 : nx, Math.abs(ny) < 0.12 ? 0 : ny);
    },
    [onChange],
  );

  const release = useCallback(() => {
    pointer.current = null;
    if (knob.current) knob.current.style.transform = '';
    base.current?.removeAttribute('data-active');
    onChange(0, 0);
  }, [onChange]);

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer.current !== null) return;
    e.preventDefault();
    e.stopPropagation();
    pointer.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer already gone: the knob simply follows while it stays over the stick.
    }
    base.current?.setAttribute('data-active', 'true');
    update(e.clientX, e.clientY);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    update(e.clientX, e.clientY);
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    release();
  };

  return (
    <div
      ref={base}
      className="ex-stick"
      aria-hidden="true"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
    >
      <div ref={knob} className="ex-stick__knob" />
    </div>
  );
}
