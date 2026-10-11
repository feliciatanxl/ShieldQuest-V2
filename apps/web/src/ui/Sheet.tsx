import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Bottom sheet on phones; a centred dialog on wider screens (CSS handles the switch). */
  wide?: boolean;
}

/** Accessible modal sheet built on <dialog> (focus trap, Esc to close, inert background). */
export function Sheet({ open, onClose, title, children, wide }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`ui-sheet${wide ? ' ui-sheet--wide' : ''}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="ui-sheet__inner">
        <header className="ui-sheet__head">
          <h2 id={titleId}>{title}</h2>
          <button className="ui-iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="ui-sheet__body">{children}</div>
      </div>
    </dialog>
  );
}
