// ShieldQuest mark: a shield holding the Stillpoint clock (stuck at 11:59).
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 4l22 8.5v16C54 43 44.6 54.4 32 59 19.4 54.4 10 43 10 28.5v-16z" fill="#3cc8b8" />
      <path d="M32 11.5l15.5 6v11c0 10.2-6.4 18.4-15.5 22-9.1-3.6-15.5-11.8-15.5-22v-11z" fill="#142033" />
      <circle cx="32" cy="30" r="10.5" fill="none" stroke="#f2c14e" strokeWidth="3.5" />
      <path d="M32 30L31 22M32 30l-.5-5" fill="none" stroke="#f2c14e" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="ui-logo">
      <LogoMark size={size} />
      <span className="ui-logo__word">
        Shield<b>Quest</b>
      </span>
    </span>
  );
}
