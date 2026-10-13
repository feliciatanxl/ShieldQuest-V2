import { useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { GAME } from '@shieldquest/shared';
import { LogoMark } from '../../ui/Logo';
import { SettingsPanel } from '../../ui/SettingsPanel';

/** Conductor header: brand, the disclaimer (GDD §11.27: verbatim on the Conductor header) and console tools. */
export function ConductorHeader({ children }: { children?: ReactNode }) {
  const [settings, setSettings] = useState(false);
  return (
    <header className="sq-chead">
      <div className="sq-chead__row">
        <Link href="/educators" className="sq-chead__brand" aria-label="ShieldQuest for educators">
          <LogoMark size={30} />
          <span>
            Shield<b>Quest</b> <span className="sq-chead__tag">Conductor</span>
          </span>
        </Link>
        <div className="sq-chead__tools">
          {children}
          <button type="button" className="ui-iconbtn" onClick={() => setSettings(true)} aria-label="Text size and comfort settings">
            <span aria-hidden="true">Aa</span>
          </button>
        </div>
      </div>
      <p className="sq-chead__disclaimer">{GAME.disclaimer}</p>
      <SettingsPanel open={settings} onClose={() => setSettings(false)} />
    </header>
  );
}
