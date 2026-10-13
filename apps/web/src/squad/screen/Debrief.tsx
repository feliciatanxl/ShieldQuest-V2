// Debrief on the Big Screen (GDD §7.2): the Long Fast-Forward, the Rewind, Flip the Board, three Stop Frames,
// the Shield Lines Wall and Carry It Out, then the closing card. Room-level and positive only.

import {
  ALWAYS_SHOW_HELP,
  GAME,
  helpById,
  missionById,
  type DebriefView,
  type Mission,
  type ScreenSnapshot,
} from '@shieldquest/shared';
import { useEffect, useState } from 'react';
import { Icon } from '../../ui/Icon';
import { LogoMark } from '../../ui/Logo';
import { StatusBadge, type Status } from '../../ui/StatusBadge';
import { flipBoard, scriptLine, type TacticMoment } from '../logic';
import { QrCode, joinUrl } from '../parts';
import { CityPulse } from './views';
import { DEBRIEF_FRAME_CAPTION, DEBRIEF_FRAME_TITLE, debriefFrames, mostMissedClue, shieldLineText, type DebriefFrame } from './screenLogic';

export interface DebriefStep {
  frame: DebriefFrame;
  page: number;
  pages: number;
  /** Per-mission frames (clues, forecasts, Shield Lines). */
  missionId?: string;
  /** Flip the Board: the tactic cards on this page. */
  tactics?: TacticMoment[];
}

const TACTICS_PER_PAGE = 3;

/** Every step the clicker walks through, in run-sheet order. */
export function debriefSteps(d: DebriefView | null, missionIds: readonly string[]): DebriefStep[] {
  const out: DebriefStep[] = [];
  for (const frame of debriefFrames(d)) {
    if (frame === 'flip') {
      const all = flipBoard(missionIds);
      const pages = Math.max(1, Math.ceil(all.length / TACTICS_PER_PAGE));
      for (let p = 0; p < pages; p++) {
        out.push({ frame, page: p, pages, tactics: all.slice(p * TACTICS_PER_PAGE, (p + 1) * TACTICS_PER_PAGE) });
      }
    } else if (frame === 'clues' || frame === 'forecasts' || frame === 'shield-lines') {
      const list = (d?.missions ?? []).filter((m) => frame !== 'shield-lines' || m.shieldLines.length > 0);
      list.forEach((m, i) => out.push({ frame, page: i, pages: list.length, missionId: m.missionId }));
    } else {
      out.push({ frame, page: 0, pages: 1 });
    }
  }
  return out;
}

export function stepTitle(step: DebriefStep): string {
  const m = step.missionId ? missionById(step.missionId) : undefined;
  return m && step.frame !== 'flip' ? `${DEBRIEF_FRAME_TITLE[step.frame]} · ${m.title}` : DEBRIEF_FRAME_TITLE[step.frame];
}

export function stepCaption(step: DebriefStep, missionIds: readonly string[]): string {
  if (step.frame === 'flip') return scriptLine(missionIds);
  return DEBRIEF_FRAME_CAPTION[step.frame];
}

const OUTCOME: Record<'success' | 'partial' | 'fail', { status: Status; word: string }> = {
  success: { status: 'safe', word: 'Opened up' },
  partial: { status: 'attention', word: 'Thinking about it' },
  fail: { status: 'risk', word: 'Shut down' },
};

const shorten = (text: string, max = 110): string => (text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`);

export function DebriefStage({ step, snap, reduced }: { step: DebriefStep; snap: ScreenSnapshot; reduced: boolean }) {
  const d = snap.debrief;
  const missionStats = step.missionId ? d?.missions.find((m) => m.missionId === step.missionId) : undefined;
  const mission: Mission | undefined = step.missionId ? missionById(step.missionId) : undefined;

  switch (step.frame) {
    case 'fast-forward':
      return (
        <section className="sq-scr-ff" data-reduced={reduced ? '' : undefined} aria-label="The Long Fast-Forward">
          <div className="sq-scr-ff__sky" aria-hidden="true">
            <span className="sq-scr-ff__arc" />
            <span className="sq-scr-ff__sun" />
          </div>
          <p className="sq-scr-ff__label">+2 weeks</p>
          <p className="sq-scr-sub">Every Seed still in motion lands on your phones now. A Late Hold can still turn things around.</p>
        </section>
      );
    case 'rewind':
      return (
        <section className="sq-scr-centre" aria-label="The Rewind">
          <p className="sq-scr-big">The second before</p>
          <p className="sq-scr-sub">Back to Mission 1, at the exact second before the choice. What did the pressure want you to skip?</p>
        </section>
      );
    case 'flip':
      return (
        <section className="sq-scr-flip" aria-label="The manipulator’s playbook">
          <ul className="sq-scr-flip__cards">
            {(step.tactics ?? []).map((t, i) => (
              <li key={t.tactic.id} className="sq-scr-flip__card" style={{ ['--sq-i' as string]: i }}>
                <span className="sq-scr-flip__pin" aria-hidden="true" />
                <p className="sq-scr-flip__ring">{t.tactic.ringLabel}</p>
                <h2 className="sq-scr-flip__name">{t.tactic.name}</h2>
                <p className="sq-scr-flip__why">Designed to {t.tactic.designedTo}.</p>
                {t.moments[0] && (
                  <p className="sq-scr-flip__moment">
                    <Icon name="thread" /> {t.moments[0].missionTitle}: <q>{shorten(t.moments[0].text, 70)}</q>
                  </p>
                )}
              </li>
            ))}
          </ul>
          {(step.tactics ?? []).length === 0 && <p className="sq-scr-sub">Every mission today ran on a script. Spot the script, not the person.</p>}
        </section>
      );
    case 'minds':
      return (
        <section className="sq-scr-centre" aria-label="Minds changed towards safer">
          <CityPulse room={snap.room} />
          {d && d.missions.length > 1 && (
            <ul className="sq-scr-bymission">
              {d.missions.map((m) => (
                <li key={m.missionId}>
                  {missionById(m.missionId)?.title ?? 'Mission'}: <strong>{m.mindsChangedSafer}</strong> towards safer
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    case 'clues': {
      if (!missionStats || !mission) return null;
      const missed = mostMissedClue(mission, missionStats.clueFinds);
      return (
        <section className="sq-scr-centre" aria-label="What the room noticed">
          <dl className="sq-scr-pulse">
            <div>
              <dt>
                <Icon name="eye" /> Seen live
              </dt>
              <dd>{missionStats.liveFlags}</dd>
            </div>
            <div>
              <dt>
                <Icon name="pause" /> Found while holding
              </dt>
              <dd>{missionStats.heldFlags}</dd>
            </div>
          </dl>
          {missed && (
            <p className="sq-scr-missed">
              <Icon name="pin" /> The sign most squads walked past: <q>{missed.label}</q>
            </p>
          )}
          <p className="sq-scr-sub">Holding gave the room time to see more. That is the whole trick.</p>
        </section>
      );
    }
    case 'forecasts':
      if (!missionStats) return null;
      return (
        <section className="sq-scr-centre" aria-label="Forecasts">
          <p className="sq-scr-big">
            {missionStats.forecastTotal === 0
              ? 'No forecasts this time'
              : `${missionStats.forecastLikely} of ${missionStats.forecastTotal}`}
          </p>
          {missionStats.forecastTotal > 0 && <p className="sq-scr-sub">sealed forecasts saw it coming. Seeing the next step is how you stay ahead of a script.</p>}
        </section>
      );
    case 'shield-lines': {
      if (!missionStats || !mission) return null;
      const friend = mission.peerShield ? mission.cast.find((c) => c.id === mission.peerShield?.friend)?.name : undefined;
      return (
        <section className="sq-scr-wall" aria-label="Shield Lines Wall">
          {friend && <p className="sq-scr-sub">What the room said to {friend}:</p>}
          <ul className="sq-scr-wall__lines">
            {missionStats.shieldLines.slice(0, 3).map((line, i) => (
              <li key={i} className="sq-scr-wall__line">
                <q>{shorten(shieldLineText(mission, line), 150)}</q>
                <span className="sq-scr-wall__meta">
                  <StatusBadge status={OUTCOME[line.outcome].status} label={OUTCOME[line.outcome].word} />
                  <span>
                    {line.squads} {line.squads === 1 ? 'squad' : 'squads'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      );
    }
    case 'carry':
      return (
        <section className="sq-scr-carry" aria-label="Carry it out">
          <ol className="sq-scr-carry__steps">
            <li>
              <span className="sq-scr-carry__word">Hold</span> Pause before you act. Hurry is the scam’s best tool.
            </li>
            <li>
              <span className="sq-scr-carry__word">Check</span> Look it up yourself. Never use the number or link they sent.
            </li>
            <li>
              <span className="sq-scr-carry__word">Tell</span> Talk to someone you trust, even after a mistake.
            </li>
          </ol>
          <ul className="sq-scr-help" aria-label="Help Card">
            {ALWAYS_SHOW_HELP.map(helpById)
              .filter((h) => snap.session.band !== 'junior' || h.junior)
              .map((h) => (
              <li key={h.id}>
                <strong>{h.name}</strong>
                <span>{h.contact}</span>
              </li>
            ))}
          </ul>
          <p className="sq-scr-sub">Your If-Then card and the Help Card stay on your phone.</p>
        </section>
      );
  }
}

/** Closing: the Stillpoint ticks from 11:59 to 12:00, the city lights up, then the closing line. */
export function ClosingView({ snap, reduced }: { snap: ScreenSnapshot; reduced: boolean }) {
  const [ticked, setTicked] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => setTicked(true), 1800);
    return () => window.clearTimeout(t);
  }, [reduced]);
  const solo = joinUrl('/play');
  const qr = typeof window !== 'undefined' && window.innerHeight < 800 ? 96 : 150;
  return (
    <section className="sq-scr-closing" aria-label="Closing">
      <p className="sq-scr-closing__clock" data-ticked={ticked ? '' : undefined} aria-label={ticked ? '12:00' : '11:59'}>
        <span aria-hidden="true">{ticked ? '12:00' : '11:59'}</span>
      </p>
      <p className="sq-scr-closing__line">{GAME.closing}</p>
      <div className="sq-scr-closing__row">
        <CityPulse room={snap.room} compact />
        <div className="sq-scr-closing__solo">
          <QrCode text={solo.full} size={qr} label="QR code to keep playing ShieldQuest on your own" />
          <p>
            <LogoMark size={28} /> Keep exploring Lumen on your own: {solo.short}
          </p>
        </div>
      </div>
    </section>
  );
}
