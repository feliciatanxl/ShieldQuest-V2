// The prompt you get when you walk up to a kiosk, a mission beacon or a townie. Real buttons; Space also uses it.
import { districtById, type BandId, type Progress } from '@shieldquest/shared';
import type { Place } from '../../world/explore/exploreMap';
import { Icon } from '../../ui/Icon';
import { arcadeHref, beaconMission, kioskGame } from './places';

export interface PromptAction {
  label: string;
  /** Visually hidden extra words for screen readers. */
  srExtra?: string;
  href?: string;
  run?: () => void;
}

/** The primary action for a place (what Space does), plus any secondary ones. */
export function placeActions(place: Place, band: BandId | null, progress: Progress, onDismiss: () => void, onAllMissions: (d: string) => void): PromptAction[] {
  switch (place.kind) {
    case 'kiosk': {
      const g = kioskGame(place);
      return [{ label: 'Play', srExtra: `: ${g.name}`, href: arcadeHref(g.id) }];
    }
    case 'beacon': {
      const m = beaconMission(place.district, band, progress);
      const all: PromptAction = { label: 'All missions here', run: () => onAllMissions(place.district) };
      return m ? [{ label: 'Play mission', srExtra: `: ${m.title}`, href: `/play/m/${m.id}` }, all] : [all];
    }
    case 'townie':
      return [{ label: 'Thanks!', run: onDismiss }];
    case 'shard':
      return [];
  }
}

interface PromptCardProps {
  place: Place;
  band: BandId | null;
  progress: Progress;
  actions: PromptAction[];
  onNavigate: (href: string) => void;
  onClose: () => void;
}

export function PromptCard({ place, band, progress, actions, onNavigate, onClose }: PromptCardProps) {
  let kicker = '';
  let title = '';
  let body = '';
  let accent = 'var(--gold)';
  if (place.kind === 'kiosk') {
    const g = kioskGame(place);
    const d = districtById(place.district);
    kicker = `${d.name} arcade`;
    title = g.name;
    body = g.pitch;
    accent = d.color;
  } else if (place.kind === 'beacon') {
    const d = districtById(place.district);
    const m = beaconMission(place.district, band, progress);
    kicker = `${d.name} mission beacon`;
    title = m ? m.title : 'All missions played here';
    body = m ? 'A new mission is waiting in this district.' : 'Nice work! Replay any mission from the city map to try a different path.';
    accent = d.color;
  } else if (place.kind === 'townie') {
    kicker = 'Townie tip';
    title = place.name;
    body = `“${place.tip}”`;
  }
  return (
    <section className="ex-prompt" style={{ ['--accent' as string]: accent }} aria-labelledby="ex-prompt-title">
      <button type="button" className="ex-prompt__close ui-iconbtn" onClick={onClose} aria-label="Close">
        <Icon name="close" />
      </button>
      <p className="ex-prompt__kicker">{kicker}</p>
      <h2 id="ex-prompt-title" className="ex-prompt__title">
        {title}
      </h2>
      <p className="ex-prompt__body">{body}</p>
      <div className="ex-prompt__actions">
        {actions.map((a, i) => (
          <button
            key={a.label}
            type="button"
            className={`ui-btn ui-btn--${i === 0 ? 'primary' : 'secondary'} ui-btn--md`}
            onClick={() => (a.href ? onNavigate(a.href) : a.run?.())}
          >
            {i === 0 && <Icon name={place.kind === 'townie' ? 'check' : 'play'} />}
            <span>
              {a.label}
              {a.srExtra && <span className="sr-only">{a.srExtra}</span>}
            </span>
          </button>
        ))}
      </div>
      <p className="ex-prompt__hint" aria-hidden="true">
        Space: {actions[0]?.label ?? 'OK'}
      </p>
    </section>
  );
}
