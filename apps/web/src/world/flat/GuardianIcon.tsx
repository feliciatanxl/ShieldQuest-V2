import { guardianById, type GuardianId } from '@shieldquest/shared';

// PLACEHOLDER — replaced by the 3D world build (SVG origami silhouette per Guardian).
export function GuardianIcon({ guardian, level = 1, size = 48 }: { guardian: GuardianId; level?: number; size?: number }) {
  const g = guardianById(guardian);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={`${g.name}${level === 0 ? ' (not yet earned)' : ''}`}>
      <path d="M24 4l18 10v20L24 44 6 34V14z" fill={level === 0 ? 'var(--surface-2)' : g.color} />
    </svg>
  );
}
