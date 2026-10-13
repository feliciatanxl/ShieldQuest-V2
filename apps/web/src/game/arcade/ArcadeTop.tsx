import { Link } from 'wouter';
import { HelpButton } from '../../ui/HelpPanel';
import { Icon } from '../../ui/Icon';
import { SettingsButton } from '../../ui/SettingsPanel';
import { useRewards } from '../../state/rewards';
import { StarGlyph } from './shared';

/** Sticky top bar shared by the Arcade and every mini-game: back link, title, Stars, settings and help. */
export function ArcadeTop({ back, backLabel, title }: { back: string; backLabel: string; title: string }) {
  const stars = useRewards((s) => s.rewards.stars);
  return (
    <header className="arc-top">
      <div className="arc-top__bar">
        <Link href={back} className="arc-back">
          <Icon name="arrowLeft" />
          <span>
            {backLabel}
            <span className="sr-only">: go back</span>
          </span>
        </Link>
        <h1 className="arc-top__title">{title}</h1>
        <span className="arc-stars">
          <StarGlyph size={18} />
          <span>{stars}</span>
          <span className="sr-only"> Stars</span>
        </span>
        <div className="arc-top__tools">
          <SettingsButton />
          <HelpButton />
        </div>
      </div>
    </header>
  );
}
