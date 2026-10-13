// /play/locker: your made-up player name, your board token, colour and title, and your badges.
// Looks are unlocked with Stars at fixed prices or by earning badges. No money, no mystery packs.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'wouter';
import { BADGES, COSMETICS, GAME, cosmeticById, type Cosmetic, type CosmeticSlot } from '@shieldquest/shared';
import { useRewards } from '../../state/rewards';
import { Button, LinkButton } from '../../ui/Button';
import { HelpButton } from '../../ui/HelpPanel';
import { Icon } from '../../ui/Icon';
import { SettingsButton } from '../../ui/SettingsPanel';
import { Sheet } from '../../ui/Sheet';
import { MotionRoot, useReducedMotionSetting, useSfx } from '../hub/kit';
import { BadgeMedal, FlameGlyph, StarGlyph } from '../rewards/glyphs';
import { RewardToast } from '../rewards/RewardToast';
import { liveStreak } from '../rewards/live';
import { TokenArt } from '../rewards/tokens';
import { SaveCardButton, SaveCardSheet } from '../save/SaveCardButton';
import '../hub/kit.css';
import './board.css';

const TABS: { slot: CosmeticSlot; label: string }[] = [
  { slot: 'token', label: 'Tokens' },
  { slot: 'color', label: 'Colours' },
  { slot: 'title', label: 'Titles' },
];

const badgeOf = (c: Cosmetic) => (c.badge ? BADGES.find((b) => b.id === c.badge) : undefined);

function Locker() {
  const rewards = useRewards((s) => s.rewards);
  const reduced = useReducedMotionSetting();
  const sfx = useSfx();
  const [tab, setTab] = useState<CosmeticSlot>('token');
  const [buying, setBuying] = useState<{ id: string; done: boolean } | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [announce, setAnnounce] = useState('');
  const tabRefs = useRef(new Map<CosmeticSlot, HTMLButtonElement>());
  const baseId = useId();

  const equipped = rewards.equipped;
  const streak = liveStreak(rewards);
  const titleName = cosmeticById(equipped.title)?.name ?? 'Rookie Shield';
  const earnedBadges = BADGES.filter((b) => rewards.badges.includes(b.id)).length;

  useEffect(() => {
    const before = document.title;
    document.title = 'Locker · ShieldQuest';
    return () => {
      document.title = before;
    };
  }, []);

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.findIndex((t) => t.slot === tab);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const slot = TABS[next]!.slot;
    setTab(slot);
    tabRefs.current.get(slot)?.focus();
  };

  const equip = (c: Cosmetic) => {
    if (useRewards.getState().equip(c.id)) {
      sfx('tap');
      setAnnounce(`${c.name} equipped.`);
    }
  };

  const confirmBuy = () => {
    if (!buying) return;
    const c = cosmeticById(buying.id);
    if (!c) return;
    if (useRewards.getState().buy(c.id)) {
      sfx('success');
      setBuying({ id: c.id, done: true });
      setAnnounce(`${c.name} unlocked.`);
    }
  };

  const items = COSMETICS.filter((c) => c.slot === tab);
  const buyItem = buying ? cosmeticById(buying.id) : undefined;

  return (
    <div className="lck" data-anim={reduced ? 'off' : 'on'}>
      <header className="brd-top">
        <div className="brd-top__bar">
          <Link href="/play" className="brd-back">
            <Icon name="arrowLeft" />
            <span className="brd-back__text">
              City<span className="sr-only">: back to ShieldQuest City</span>
            </span>
          </Link>
          <h1 className="brd-top__title">Locker</h1>
          <div className="brd-top__tools">
            <SaveCardButton />
            <SettingsButton />
            <HelpButton />
          </div>
        </div>
      </header>

      <main id="main" className="lck-main">
        <section className="lck-profile" aria-labelledby={`${baseId}-handle`}>
          <div className="lck-profile__token">
            <TokenArt id={equipped.token} color={equipped.color} size={72} />
          </div>
          <div className="lck-profile__text">
            <p className="lck-profile__kicker">Your player name</p>
            <h2 id={`${baseId}-handle`} className="lck-profile__handle">
              {rewards.handle}
            </h2>
            <p className="lck-profile__title">
              <Icon name="shield" size="1em" />
              <span className="sr-only">Title: </span>
              {titleName}
            </p>
            <p className="lck-profile__why">
              <Icon name="lock" size="1em" />
              <span>A made-up name so you stay anonymous. It never uses your real name, and it can't be changed.</span>
            </p>
          </div>
          <ul className="lck-profile__stats" aria-label="Your Stars and streak">
            <li>
              <StarGlyph size={18} /> <strong>{rewards.stars}</strong> Stars to spend
            </li>
            <li>
              <FlameGlyph size={18} lit={streak > 0} /> <strong>{streak}</strong> day streak (best {rewards.bestStreak})
            </li>
            <li>
              <Icon name="check" size="1em" /> <strong>{rewards.claimed.length}</strong> board tiles claimed
            </li>
          </ul>
        </section>

        <section className="lck-section" aria-labelledby={`${baseId}-look`}>
          <h2 id={`${baseId}-look`}>Your look</h2>
          <p className="lck-section__sub">
            Stars are earned by playing. You can't buy them. Every look has a fixed price, or is unlocked by a badge.
          </p>
          <div className="lck-tabs" role="tablist" aria-label="Look type">
            {TABS.map((t) => (
              <button
                key={t.slot}
                ref={(el) => {
                  if (el) tabRefs.current.set(t.slot, el);
                  else tabRefs.current.delete(t.slot);
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${t.slot}`}
                aria-controls={`${baseId}-panel`}
                aria-selected={tab === t.slot}
                tabIndex={tab === t.slot ? 0 : -1}
                className="lck-tab"
                onClick={() => setTab(t.slot)}
                onKeyDown={onTabKey}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${tab}`}>
            <ul className="lck-grid">
              {items.map((c) => {
                const owned = rewards.owned.includes(c.id);
                const isOn = equipped[c.slot] === c.id;
                const badge = badgeOf(c);
                const short = Math.max(0, c.price - rewards.stars);
                return (
                  <li key={c.id} className={`lck-item${isOn ? ' is-equipped' : ''}${!owned ? ' is-locked' : ''}`}>
                    <span className="lck-item__art" aria-hidden="true">
                      {c.slot === 'token' && <TokenArt id={c.id} color={equipped.color} size={56} />}
                      {c.slot === 'color' && <TokenArt id={equipped.token} color={c.id} size={56} />}
                      {c.slot === 'title' && <span className="lck-titlechip">“{c.name}”</span>}
                    </span>
                    <p className="lck-item__name">{c.name}</p>
                    {isOn ? (
                      <p className="lck-item__state lck-item__state--equipped">
                        <Icon name="check" size="1em" /> Equipped
                      </p>
                    ) : owned ? (
                      <Button variant="secondary" size="sm" onClick={() => equip(c)}>
                        Equip<span className="sr-only"> {c.name}</span>
                      </Button>
                    ) : badge ? (
                      <>
                        <p className="lck-item__state">
                          <Icon name="lock" size="1em" /> Badge: {badge.name}
                        </p>
                        <p className="lck-item__how">{badge.how}</p>
                      </>
                    ) : (
                      <>
                        <p className="lck-item__state">
                          <StarGlyph size={16} /> {c.price} Stars
                        </p>
                        <Button size="sm" disabled={short > 0} onClick={() => setBuying({ id: c.id, done: false })}>
                          Unlock<span className="sr-only"> {c.name} for {c.price} Stars</span>
                        </Button>
                        {short > 0 && <p className="lck-item__how">{short} more Stars needed</p>}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="lck-section" aria-labelledby={`${baseId}-badges`}>
          <h2 id={`${baseId}-badges`}>Badges</h2>
          <p className="lck-section__sub">
            {earnedBadges} of {BADGES.length} earned. Badges come from playing, never from luck.
          </p>
          <ul className="lck-badges">
            {BADGES.map((b) => {
              const earned = rewards.badges.includes(b.id);
              return (
                <li key={b.id} className={`lck-badge${earned ? ' is-earned' : ''}`}>
                  <BadgeMedal earned={earned} size={44} />
                  <span className="lck-badge__text">
                    <span className="lck-badge__name">
                      {b.name}
                      <span className="sr-only">{earned ? ': earned' : ': not earned yet'}</span>
                    </span>
                    <span className="lck-badge__how">{earned ? 'Earned' : b.how}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="lck-section" aria-labelledby={`${baseId}-save`}>
          <h2 id={`${baseId}-save`}>Keep your progress</h2>
          <div className="lck-save">
            <p>Your Stars and looks live on this device. A Save Card lets you carry them to another phone, with no account.</p>
            <Button variant="secondary" onClick={() => setSaveOpen(true)}>
              Save Card
            </Button>
          </div>
          <SaveCardSheet open={saveOpen} onClose={() => setSaveOpen(false)} />
        </section>

        <section className="lck-section">
          <div className="hub-sheet-actions">
            <LinkButton href="/play/board" icon="map">
              City Board
            </LinkButton>
            <LinkButton href="/play/arcade" variant="secondary" icon="play">
              Arcade
            </LinkButton>
          </div>
        </section>

        <p className="ui-disclaimer">{GAME.disclaimer}</p>
      </main>

      <Sheet open={Boolean(buyItem)} onClose={() => setBuying(null)} title={buying?.done ? 'Unlocked!' : 'Unlock this look?'}>
        {buyItem && (
          <div className="lck-confirm">
            <div className="lck-confirm__preview">
              {buyItem.slot === 'token' && <TokenArt id={buyItem.id} color={equipped.color} size={56} />}
              {buyItem.slot === 'color' && <TokenArt id={equipped.token} color={buyItem.id} size={56} />}
              {buyItem.slot === 'title' && <Icon name="shield" size={40} />}
              <strong>{buyItem.name}</strong>
            </div>
            {buying?.done ? (
              <>
                <p>
                  {buyItem.name} is yours. You have {rewards.stars} Stars left.
                </p>
                <div className="hub-sheet-actions">
                  <Button
                    icon="check"
                    onClick={() => {
                      equip(buyItem);
                      setBuying(null);
                    }}
                  >
                    Equip now
                  </Button>
                  <Button variant="secondary" onClick={() => setBuying(null)}>
                    Done
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p>
                  Use {buyItem.price} Stars to unlock {buyItem.name}? You will have {rewards.stars - buyItem.price} Stars left. Stars are
                  earned by playing, and nothing here costs money.
                </p>
                <div className="hub-sheet-actions">
                  <Button icon="check" onClick={confirmBuy}>
                    Unlock for {buyItem.price} Stars
                  </Button>
                  <Button variant="secondary" onClick={() => setBuying(null)}>
                    Not now
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Sheet>

      <RewardToast />
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

export default function LockerPage() {
  return (
    <MotionRoot>
      <Locker />
    </MotionRoot>
  );
}
