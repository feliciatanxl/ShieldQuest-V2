// Status is always shape + icon + word (never colour alone). GAME_DESIGN.md §4.3.
export type Status = 'safe' | 'risk' | 'attention' | 'unknown';

const LABEL: Record<Status, string> = { safe: 'Safer', risk: 'Risky', attention: 'Check this', unknown: 'Unknown' };

export function StatusShape({ status, size = 18 }: { status: Status; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true as const };
  switch (status) {
    case 'safe':
      return (
        <svg {...common}>
          <path d="M12 2.5l8 3.2v6c0 5-3.4 8.9-8 10.3-4.6-1.4-8-5.3-8-10.3v-6z" fill="var(--safe)" />
          <path
            d="M8 12.2l2.8 2.8L16.5 9"
            fill="none"
            stroke="var(--ink)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'risk':
      return (
        <svg {...common}>
          <defs>
            <pattern id="sq-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="4" fill="var(--risk)" />
              <rect width="1.4" height="4" fill="rgba(29,36,64,.45)" />
            </pattern>
          </defs>
          <path
            d="M12 1.5l2.4 5 5.3-1.6-1.9 5.2 4.7 2.9-5.2 1.8.9 5.5-5-2.6-3.9 4-1.1-5.4L2.6 16l3-4.6L1.8 7.6l5.4-.3z"
            fill="url(#sq-hatch)"
          />
        </svg>
      );
    case 'attention':
      return (
        <svg {...common}>
          <path d="M12 2l10 10-10 10L2 12z" fill="var(--attention)" />
          <path d="M12 7.5v5.5M12 16.2h.01" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" fill="none" stroke="var(--unknown)" strokeWidth="2.4" strokeDasharray="3.5 3" />
        </svg>
      );
  }
}

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  return (
    <span className={`ui-status ui-status--${status}`}>
      <StatusShape status={status} />
      <span>{label ?? LABEL[status]}</span>
    </span>
  );
}
