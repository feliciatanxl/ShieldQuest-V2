import { useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { districtById, type DistrictId, type HelpChannelId } from '@shieldquest/shared';
import { Icon } from '../../../ui/Icon';
import { HelpButton } from '../../../ui/HelpPanel';
import { SettingsPanel } from '../../../ui/SettingsPanel';
import './parts.css';

export interface TopBarProps {
  /** District chip. Omit on screens that are not about one district (e.g. Nightfall) and pass `title`. */
  district?: DistrictId;
  /** Plain title shown instead of the district chip. */
  title?: string;
  /** The S.H.I.E.L.D. rail (usually <ShieldRail>). */
  rail?: ReactNode;
  /** Mission help channels, added to the always-shown ones in the Need-to-talk panel. */
  help?: HelpChannelId[];
  /** Opens the "Take a break" screen. Omit to hide Pause. */
  onPause?: () => void;
  /** Back arrow target (default /play). Pass onBack instead to handle leaving yourself (e.g. squad). */
  backHref?: string;
  onBack?: () => void;
  backLabel?: string;
}

/** Always-on-screen bar: back to the city, district chip, S.H.I.E.L.D. rail, Aa, Need to talk, Pause. */
export function TopBar({ district, title, rail, help, onPause, backHref = '/play', onBack, backLabel = 'Back to Lumen' }: TopBarProps) {
  const d = district ? districtById(district) : null;
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <header className="msn-top">
      <div className="msn-top__inner">
        {onBack ? (
          <button type="button" className="ui-iconbtn msn-top__back" onClick={onBack} aria-label={backLabel}>
            <Icon name="arrowLeft" />
          </button>
        ) : (
          <Link href={backHref} className="ui-iconbtn msn-top__back" aria-label={backLabel}>
            <Icon name="arrowLeft" />
          </Link>
        )}
        {d ? (
          <span className="msn-top__district" style={{ ['--msn-district' as string]: d.color }}>
            <span className="msn-top__district-dot" aria-hidden="true" />
            <span className="msn-top__district-name">{d.name}</span>
          </span>
        ) : (
          <span className="msn-top__district msn-top__district--title">
            <span className="msn-top__district-name">{title ?? 'Lumen'}</span>
          </span>
        )}
        {rail && <div className="msn-top__rail">{rail}</div>}
        <div className="msn-top__actions">
          <button
            type="button"
            className="ui-iconbtn msn-top__aa"
            onClick={() => setSettingsOpen(true)}
            aria-label="Text size and comfort settings"
          >
            <span aria-hidden="true">Aa</span>
          </button>
          <HelpButton extra={help} />
          {onPause && (
            <button type="button" className="ui-iconbtn" onClick={onPause} aria-label="Pause: take a break">
              <Icon name="door" />
            </button>
          )}
        </div>
      </div>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
