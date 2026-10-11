import { useEffect, useState } from 'react';
import {
  DISTRICTS,
  GAME,
  GUARDIANS,
  MISSIONS,
  findAftershock,
  guardianLevel,
  missionById,
  type PendingAftershock,
} from '@shieldquest/shared';
import { useProgress } from '../../state/progress';
import { prefersReducedMotion, useSettings } from '../../state/settings';
import { LinkButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { StatusBadge, type Status } from '../../ui/StatusBadge';
import { GuardianIcon } from '../../world';
import { CaptionBand } from './parts/CaptionBand';
import { useAnnouncer, useCues } from './parts/cues';
import { PauseOverlay } from './parts/PauseOverlay';
import { StageLayout } from './parts/StageLayout';
import { TopBar } from './parts/TopBar';
import { AftershockInterlude } from './phases/AftershockInterlude';
import { PhaseHeading, focusPhaseHeading } from './phases/PhaseHeading';
import { newRunSeed } from './runLogic';
import './mission.css';

type Landing = { pending: PendingAftershock; found: NonNullable<ReturnType<typeof findAftershock>> };

function trustWord(v: number): { status: Status; word: string } {
  if (v > 0) return { status: 'safe', word: v >= 2 ? 'Glowing' : 'Lit' };
  if (v < 0) return { status: 'attention', word: v <= -2 ? 'Dim' : 'Flickering' };
  return { status: 'unknown', word: 'Quiet' };
}

/** The Stillpoint clock ticks over from 11:59 to 12:00 (static under reduced motion). */
function Stillpoint({ reduced }: { reduced: boolean }) {
  return (
    <svg className="msn-stillpoint" data-reduced={reduced ? '' : undefined} viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
      <circle cx="60" cy="60" r="52" fill="var(--bg-2)" stroke="var(--gold)" strokeWidth="5" />
      {Array.from({ length: 12 }, (_, i) => (
        <line
          key={i}
          x1="60"
          y1="14"
          x2="60"
          y2={i % 3 === 0 ? 24 : 20}
          stroke="var(--muted)"
          strokeWidth={i % 3 === 0 ? 3 : 2}
          strokeLinecap="round"
          transform={`rotate(${i * 30} 60 60)`}
        />
      ))}
      <line x1="60" y1="60" x2="60" y2="34" stroke="var(--gold)" strokeWidth="5" strokeLinecap="round" />
      <line className="msn-stillpoint__minute" x1="60" y1="60" x2="60" y2="22" stroke="var(--text)" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="60" cy="60" r="4.5" fill="var(--gold)" />
    </svg>
  );
}

/** /play/nightfall — end of a solo session: every pending Aftershock lands, then Lumen rests. */
export default function NightfallPage() {
  const band = useSettings((s) => s.band);
  const motion = useSettings((s) => s.motion);
  const reduced = prefersReducedMotion(motion);
  const progress = useProgress((s) => s.progress);
  const cues = useCues();
  const { message, announce } = useAnnouncer();
  const [paused, setPaused] = useState(false);
  const [seed] = useState(newRunSeed);
  const [landings] = useState<Landing[]>(() =>
    useProgress
      .getState()
      .due(true)
      .map((pending) => ({ pending, found: findAftershock(MISSIONS, pending) }))
      .filter((x): x is Landing => x.found !== null),
  );
  const [index, setIndex] = useState(0);
  const landing = landings[index];

  useEffect(() => {
    document.title = 'Nightfall · ShieldQuest';
  }, []);
  useEffect(() => {
    const id = window.setTimeout(() => focusPhaseHeading(document.querySelector('.msn-layout__sheet') ?? document), 30);
    if (!landing) announce('Nightfall. Lumen is resting.');
    return () => window.clearTimeout(id);
  }, [index, landing, announce]);

  // Aftershocks whose mission data is gone can never land; clear them so they don't wait forever.
  useEffect(() => {
    const store = useProgress.getState();
    for (const p of store.due(true)) if (!findAftershock(MISSIONS, p)) store.resolve(p.key, 'none');
  }, []);

  const { totals } = progress;
  const ratio = totals.liveFlags > 0 ? totals.heldFlags / totals.liveFlags : null;
  const ratioLine =
    totals.heldFlags === 0
      ? null
      : ratio === null
        ? 'Every warning sign you found, you found while holding. Pausing is where you see clearly.'
        : ratio >= 2
          ? `You found ${Math.floor(ratio)} times as many warning signs while holding as while things were rushing.`
          : ratio > 1
            ? 'You found more warning signs while holding than while things were rushing.'
            : null;
  const unfolded = GUARDIANS.filter((g) => guardianLevel(progress.guardianBond[g.id]) > 0);
  const cards = [...progress.ifThenCards].sort((a, b) => b.at - a.at);
  const districts = DISTRICTS.filter((d) => !d.comingSoon);

  return (
    <main id="main" className="msn-page msn-nightfall-page">
      <StageLayout
        top={<TopBar title="Nightfall" onPause={() => setPaused(true)} />}
        caption={<CaptionBand text={cues.caption} />}
        emphasis="sheet-only"
        sheetLabel="Nightfall"
        overlay={<PauseOverlay open={paused} onResume={() => setPaused(false)} />}
      >
        {landing ? (
          <AftershockInterlude
            key={landing.pending.key}
            pending={landing.pending}
            found={landing.found}
            band={band}
            seed={seed}
            reduced={reduced}
            position={landings.length > 1 ? `${index + 1} of ${landings.length}` : undefined}
            onArrive={(polarity) => {
              cues.cue(polarity === 'risk' ? 'aftershock' : 'afterglow');
              announce(polarity === 'risk' ? 'An Aftershock is landing.' : 'An Afterglow is landing.');
            }}
            onResolve={(optionId) => useProgress.getState().resolve(landing.pending.key, optionId)}
            onDone={() => setIndex((i) => i + 1)}
          />
        ) : (
          <div className="msn-phase msn-nightfall">
            <Stillpoint reduced={reduced} />
            <PhaseHeading kicker="Nightfall" title="Lumen is resting">
              <p className="msn-phase__sub">
                {landings.length > 0
                  ? `Every choice still in motion has landed (${landings.length}). The city is quiet now.`
                  : 'Nothing is still in motion. The city is quiet now.'}
              </p>
            </PhaseHeading>

            <section className="msn-nightfall__stats" aria-label="Today in Lumen">
              <div className="msn-stat">
                <span className="msn-stat__num">{totals.missions}</span>
                <span className="msn-stat__word">moments played</span>
              </div>
              <div className="msn-stat">
                <span className="msn-stat__num">{totals.holds}</span>
                <span className="msn-stat__word">early holds</span>
              </div>
              <div className="msn-stat">
                <span className="msn-stat__num">{totals.liveFlags}</span>
                <span className="msn-stat__word">signs seen live</span>
              </div>
              <div className="msn-stat" data-held="">
                <span className="msn-stat__num">{totals.heldFlags}</span>
                <span className="msn-stat__word">found while holding</span>
              </div>
            </section>
            {ratioLine && (
              <p className="msn-nightfall__ratio">
                <Icon name="eye" /> {ratioLine}
              </p>
            )}

            <section aria-labelledby="msn-nf-lanterns">
              <h3 id="msn-nf-lanterns" className="msn-section-title">
                Lanterns across Lumen
              </h3>
              <ul className="msn-nightfall__districts">
                {districts.map((d) => {
                  const v = progress.districtTrust[d.id] ?? 0;
                  const w = trustWord(v);
                  return (
                    <li key={d.id} style={{ ['--msn-district' as string]: d.color }}>
                      <span className="msn-nightfall__district">{d.name}</span>
                      <StatusBadge status={w.status} label={`${w.word} (${v > 0 ? `+${v}` : v})`} />
                    </li>
                  );
                })}
              </ul>
            </section>

            {unfolded.length > 0 && (
              <section aria-labelledby="msn-nf-guardians">
                <h3 id="msn-nf-guardians" className="msn-section-title">
                  Guardians with you
                </h3>
                <ul className="msn-nightfall__guardians">
                  {unfolded.map((g) => (
                    <li key={g.id}>
                      <GuardianIcon guardian={g.id} level={guardianLevel(progress.guardianBond[g.id])} size={48} />
                      <span>{g.name}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {cards.length > 0 && (
              <section aria-labelledby="msn-nf-ifthen">
                <h3 id="msn-nf-ifthen" className="msn-section-title">
                  Your If-Then cards
                </h3>
                <ul className="msn-nightfall__cards">
                  {cards.map((c) => (
                    <li key={c.missionId} className="msn-paper">
                      <p className="msn-nightfall__card-from">{missionById(c.missionId)?.title ?? 'A moment'}</p>
                      <p>{c.text}</p>
                    </li>
                  ))}
                </ul>
                <p className="msn-freeze__private">
                  <Icon name="lock" /> Kept on this device only.
                </p>
              </section>
            )}

            <blockquote className="msn-nightfall__closing">{GAME.closing}</blockquote>

            <LinkButton href="/play" size="lg" block icon="map">
              Back to Lumen
            </LinkButton>
          </div>
        )}
      </StageLayout>
      <p className="sr-only" aria-live="polite" role="status">
        {message}
      </p>
    </main>
  );
}
