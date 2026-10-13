// The city hub: ShieldQuest City as a full-bleed diorama (3D, or its 2D twin) with all readable UI in the DOM on top.
import { Suspense, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Link } from 'wouter';
import { DISTRICTS, districtById, missionById, type DistrictId, type Mission } from '@shieldquest/shared';
import { CityMap2D, CityScene, useRenderMode, type CitySceneProps } from '../../world';
import { useSettings } from '../../state/settings';
import { useProgress } from '../../state/progress';
import { useRewards } from '../../state/rewards';
import { startAmbient, stopAmbient } from '../../audio/sfx';
import { LinkButton } from '../../ui/Button';
import { HelpButton } from '../../ui/HelpPanel';
import { Icon } from '../../ui/Icon';
import { LogoMark } from '../../ui/Logo';
import { SettingsButton } from '../../ui/SettingsPanel';
import { StatusBadge } from '../../ui/StatusBadge';
import { BoardNavGlyph, CompassGlyph, DieGlyph, FlameGlyph, GamepadGlyph, StarGlyph } from '../rewards/glyphs';
import { liveStreak, rollsReady } from '../rewards/live';
import { RewardToast } from '../rewards/RewardToast';
import { DistrictPanel } from './DistrictPanel';
import { DistrictPicker } from './DistrictPicker';
import {
  SCAFFOLD_LABEL,
  TUTORIAL_ID,
  bandMissions,
  buildMarkers,
  districtSummary,
  formatWallet,
  lanternSummary,
  nextMission,
  plural,
} from './hubData';
import {
  CoinGlyph,
  DistrictPlate,
  LanternGlyph,
  SIDE_LAYOUT_QUERY,
  Stillpoint,
  ViewBoundary,
  readStored,
  useFirstGesture,
  useMediaQuery,
  useReducedMotionSetting,
  useSfx,
  writeStored,
} from './kit';
import './hub.css';

const FOCUS_KEY = 'sq.hub.focus.v1';

const isDistrict = (v: unknown): v is DistrictId => DISTRICTS.some((d) => d.id === v);

function StageLoading() {
  return (
    <div className="hub-stage__loading" role="status">
      <Stillpoint size={84} />
      <p>Drawing the city…</p>
    </div>
  );
}

/** 3D city when the device can, the SVG twin otherwise (or if the 3D chunk fails). Memoised: the canvas
 *  should only re-render when what it draws changes, not when the DOM overlay does. */
const CityStage = memo(function CityStage(props: Omit<CitySceneProps, 'quality'>) {
  const mode = useRenderMode();
  const flat = <CityMap2D {...props} />;
  if (mode === '2d') return flat;
  return (
    <ViewBoundary fallback={flat}>
      <Suspense fallback={<StageLoading />}>
        <CityScene {...props} quality={mode} />
      </Suspense>
    </ViewBoundary>
  );
});

function ContinueCard({ next, anyPlayed, onDetails }: { next: Mission | null; anyPlayed: boolean; onDetails: (id: string) => void }) {
  if (!next) {
    return (
      <section className="hub-continue hub-continue--done" aria-label="Suggestion">
        <p className="hub-continue__kicker">
          <Icon name="check" size="1em" /> {anyPlayed ? 'All caught up' : 'Nothing here yet'}
        </p>
        <p className="hub-continue__text">
          {anyPlayed
            ? 'You have played every mission for your level. Replay one to try a different path.'
            : 'New missions are being reviewed. Check back soon.'}
        </p>
        <div className="hub-continue__actions hub-continue__actions--done">
          <LinkButton href="/play/board" size="sm" icon="arrowRight">
            Roll the City Board
          </LinkButton>
        </div>
      </section>
    );
  }
  const d = districtById(next.district);
  const tutorial = next.id === TUTORIAL_ID;
  return (
    <section className="hub-continue" aria-labelledby="hub-continue-title">
      <div className="hub-continue__info">
        <p className="hub-continue__kicker">
          <Icon name="spark" size="1em" /> {tutorial ? 'Start here' : anyPlayed ? 'Up next' : 'Your first mission'}
        </p>
        <h2 id="hub-continue-title" className="hub-continue__title">
          {next.title}
        </h2>
        <p className="hub-continue__meta">
          <DistrictPlate district={d.id} color={d.color} size={20} />
          <span>
            {d.name} · {tutorial ? 'Tutorial' : SCAFFOLD_LABEL[next.scaffold]}
          </span>
        </p>
      </div>
      <div className="hub-continue__actions">
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => onDetails(next.id)}>
          <Icon name="info" />
          <span>
            Details<span className="sr-only">: {next.title}</span>
          </span>
        </button>
        <LinkButton href={`/play/m/${next.id}`} icon="play">
          Play<span className="sr-only">: {next.title}</span>
        </LinkButton>
      </div>
    </section>
  );
}

export function CityHub() {
  const band = useSettings((s) => s.band);
  const sound = useSettings((s) => s.sound);
  const progress = useProgress((s) => s.progress);
  const rewards = useRewards((s) => s.rewards);
  const reduced = useReducedMotionSetting();
  const side = useMediaQuery(SIDE_LAYOUT_QUERY);
  const sfx = useSfx();

  const [focus, setFocus] = useState<DistrictId | null>(() => {
    const saved = readStored<unknown>('session', FOCUS_KEY, null);
    return isDistrict(saved) ? saved : null;
  });
  const [highlight, setHighlight] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const pickerButtons = useRef(new Map<DistrictId, HTMLButtonElement>());

  const missions = useMemo(() => bandMissions(band), [band]);
  const markers = useMemo(() => buildMarkers(missions, progress), [missions, progress]);
  const next = useMemo(() => nextMission(band, progress), [band, progress]);
  const lanterns = lanternSummary(progress.districtTrust);
  const pending = progress.pending.length;
  const anyPlayed = Object.keys(progress.runs).length > 0;
  const streak = liveStreak(rewards);
  const rolls = rollsReady(rewards);

  // Remember the open district for this tab, so coming back from a mission lands where you left.
  useEffect(() => writeStored('session', FOCUS_KEY, focus), [focus]);

  // Ambient pad while the hub is open. The audio module expects startAmbient to be safe to call again.
  useEffect(() => {
    if (!sound) {
      stopAmbient();
      return;
    }
    startAmbient('city');
    return () => stopAmbient();
  }, [sound]);
  useFirstGesture(() => {
    if (useSettings.getState().sound) startAmbient('city');
  });

  const selectDistrict = useCallback(
    (id: DistrictId) => {
      sfx('tap');
      setHighlight(null);
      setFocus(id);
      const d = districtById(id);
      const s = districtSummary(id, useSettings.getState().band, useProgress.getState().progress);
      setAnnounce(
        d.comingSoon
          ? `${d.name}: coming soon.`
          : `${d.name} opened. ${plural(s.missions.length, 'mission')}${s.fresh ? `, ${s.fresh} new` : ''}.`,
      );
    },
    [sfx],
  );

  const selectMission = useCallback(
    (id: string) => {
      const mission = missionById(id);
      if (!mission) return;
      sfx('tap');
      setFocus(mission.district);
      setHighlight(id);
      setAnnounce(`${mission.title}, in ${districtById(mission.district).name}.`);
    },
    [sfx],
  );

  const close = useCallback(() => {
    if (!focus) return;
    const was = focus;
    setFocus(null);
    setHighlight(null);
    setAnnounce('Showing all of ShieldQuest City.');
    requestAnimationFrame(() => pickerButtons.current.get(was)?.focus());
  }, [focus]);

  const registerButton = useCallback((id: DistrictId, el: HTMLButtonElement | null) => {
    if (el) pickerButtons.current.set(id, el);
    else pickerButtons.current.delete(id);
  }, []);

  // Esc returns to the whole city from anywhere on the hub (unless a dialog such as Settings is open).
  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('dialog[open]')) return;
      close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, close]);

  const showContinue = !focus || side;

  return (
    <div className="hub" data-panel={focus ? 'open' : 'closed'} data-anim={reduced ? 'off' : 'on'}>
      <section className="hub-stage" aria-label="Map of ShieldQuest City">
        <CityStage
          focus={focus}
          districtTrust={progress.districtTrust}
          markers={markers}
          onSelectDistrict={selectDistrict}
          onSelectMission={selectMission}
        />
      </section>

      <div className="hub-hud">
        <header className="hub-top">
          <Link href="/" className="hub-top__home" aria-label="ShieldQuest home page">
            <LogoMark size={36} />
          </Link>
          <div className="hub-top__title">
            <h1>
              ShieldQuest City<span className="sr-only"> hub</span>
            </h1>
            <p aria-hidden="true">
              <Icon name="clock" size="0.95em" /> 11:59
            </p>
          </div>
          {/* Phones: Stars and streak sit in the top bar (the status strip below has no room for them). */}
          <Link
            href="/play/locker"
            className="hub-top__purse"
            aria-label={`${rewards.stars} Stars${streak > 0 ? `, ${streak} day streak` : ''}. Open your Locker.`}
          >
            <StarGlyph size={18} />
            <span>{rewards.stars}</span>
            {streak > 0 && (
              <>
                <FlameGlyph size={18} />
                <span>{streak}</span>
              </>
            )}
          </Link>
          <nav className="hub-top__nav" aria-label="Game">
            <Link
              href="/play/board"
              className="hub-top__link"
              aria-label={`City Board: ${rolls} ${rolls === 1 ? 'roll' : 'rolls'} ready`}
              title="City Board"
            >
              <BoardNavGlyph />
              {rolls > 0 && (
                <span className="hub-top__count" aria-hidden="true">
                  {rolls}
                </span>
              )}
              <span className="hub-top__linktext" aria-hidden="true">
                Board
              </span>
            </Link>
            <Link href="/play/arcade" className="hub-top__link" aria-label="Arcade: mini-games" title="Arcade">
              <GamepadGlyph />
              <span className="hub-top__linktext" aria-hidden="true">
                Arcade
              </span>
            </Link>
            <Link href="/play/explore" className="hub-top__link" aria-label="Explore the city" title="Explore">
              <CompassGlyph />
              <span className="hub-top__linktext" aria-hidden="true">
                Explore
              </span>
            </Link>
            <Link href="/join" className="hub-top__link" aria-label="Join a squad session">
              <Icon name="users" />
              <span className="hub-top__linktext" aria-hidden="true">
                Join a squad
              </span>
            </Link>
            <Link href="/play/guardians" className="hub-top__link" aria-label="Bond Book: your Guardians">
              <Icon name="book" />
              <span className="hub-top__linktext" aria-hidden="true">
                Bond Book
              </span>
            </Link>
            <Link href="/play/locker" className="hub-top__link" aria-label="Locker: your look and badges" title="Locker">
              <Icon name="user" />
              <span className="hub-top__linktext" aria-hidden="true">
                Locker
              </span>
            </Link>
          </nav>
          <div className="hub-top__tools">
            <SettingsButton />
            <HelpButton />
          </div>
        </header>

        <main id="main" className="hub-main">
          <div className="hub-strip">
            <p
              className="hub-chip"
              title="Story wallet: fictional money from choices in missions. There is nothing to buy."
            >
              <CoinGlyph size={18} />
              <span className="sr-only">Story wallet, fictional money:</span>
              <span>{formatWallet(progress.wallet)}</span>
            </p>
            <p className="hub-chip" title="Lanterns light up when choices protect people in a district.">
              <LanternGlyph size={18} lit={lanterns.lit > 0} />
              <span>
                {lanterns.lit}/{lanterns.max}
              </span>
              <span className="hub-chip__word">
                lanterns lit{lanterns.dimmed > 0 && ` · ${lanterns.dimmed} dimmed`}
              </span>
            </p>
            <p className="hub-chip hub-chip--wide" title="Stars are earned by playing. You can't buy them.">
              <StarGlyph size={18} />
              <span>{rewards.stars}</span>
              <span className="hub-chip__word">
                Stars<span className="sr-only">, earned by playing</span>
              </span>
            </p>
            {streak > 0 && (
              <p className="hub-chip hub-chip--wide" title="Days in a row you finished a challenge.">
                <FlameGlyph size={18} />
                <span>{streak}</span>
                <span className="hub-chip__word">day streak</span>
              </p>
            )}
            <Link
              href="/play/board"
              className="hub-chip hub-chip--link hub-chip--wide"
              title="City Board"
              aria-label={`City Board: ${rolls} ${rolls === 1 ? 'roll' : 'rolls'} ready`}
            >
              <DieGlyph size={18} face={rolls > 0 ? Math.min(6, rolls) : 1} filled={rolls > 0} />
              <span>{rolls}</span>
              <span className="hub-chip__word">{rolls === 1 ? 'roll' : 'rolls'}</span>
            </Link>
            {pending > 0 && (
              <div className="hub-motion" role="group" aria-label="Consequences on the way">
                <span className="hub-chip hub-chip--motion">
                  <StatusBadge status="attention" label="Something is still in motion" />
                  <span className="hub-chip__word">({pending})</span>
                </span>
                <LinkButton
                  href="/play/nightfall"
                  variant="secondary"
                  size="sm"
                  icon="clock"
                  className="hub-motion__nightfall"
                  title="End your day in the city. Anything still in motion lands now."
                >
                  Nightfall<span className="sr-only">: end your day in the city, and anything still in motion lands now</span>
                </LinkButton>
              </div>
            )}
          </div>

          <AnimatePresence>
            {focus && (
              <DistrictPanel
                key="panel"
                district={focus}
                band={band}
                progress={progress}
                highlight={highlight}
                side={side}
                reduced={reduced}
                onClose={close}
              />
            )}
          </AnimatePresence>

          <div className="hub-dock">
            <AnimatePresence initial={false}>
              {showContinue && (
                <m.div
                  key="continue"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: reduced ? 0.1 : 0.24 }}
                >
                  <ContinueCard next={next} anyPlayed={anyPlayed} onDetails={selectMission} />
                </m.div>
              )}
            </AnimatePresence>
            <DistrictPicker
              focus={focus}
              band={band}
              progress={progress}
              onSelect={(id) => (id === focus ? close() : selectDistrict(id))}
              registerButton={registerButton}
            />
          </div>
        </main>
      </div>

      <RewardToast />
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
