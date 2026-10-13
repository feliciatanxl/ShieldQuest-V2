// Entry points for the Save Card. Kept tiny: the panel, its styles, the crypto and the QR encoder load only
// when a player opens it.

import { lazy, Suspense, useState } from 'react';

const LazyPanel = lazy(() => import('./SaveCardPanel'));

/** The Save Card sheet, downloaded on first open and kept mounted after that (so closing returns focus). */
export function SaveCardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <LazyPanel open={open} onClose={onClose} />
    </Suspense>
  );
}

function CardIcon() {
  return (
    <svg width="1.25em" height="1.25em" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM7.5 9.5h4M7.5 12.5h6M7.5 15.5h3M16.5 9.5h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Round header button (matches SettingsButton) that opens the Save Card sheet. */
export function SaveCardButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`ui-iconbtn${className ? ` ${className}` : ''}`}
        onClick={() => setOpen(true)}
        aria-label="Save Card"
        title="Save Card"
      >
        <CardIcon />
      </button>
      <SaveCardSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
