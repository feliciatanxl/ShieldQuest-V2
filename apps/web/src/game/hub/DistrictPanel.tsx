// The district sheet: a bottom sheet on phones, a side panel on laptops. It is non-modal on purpose,
// so the city stays visible (and tappable) while you browse a district's missions.
import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { m } from 'motion/react';
import { BANDS, districtById, type BandId, type DistrictId, type Progress } from '@shieldquest/shared';
import { useSettings } from '../../state/settings';
import { Icon } from '../../ui/Icon';
import { districtSummary, plural } from './hubData';
import { DistrictPlate, TrustMeter } from './kit';
import { MissionCard, missionCardId } from './MissionCard';

interface DistrictPanelProps {
  district: DistrictId;
  band: BandId | null;
  progress: Progress;
  highlight: string | null;
  side: boolean;
  reduced: boolean;
  onClose: () => void;
}

export function DistrictPanel({ district, band, progress, highlight, side, reduced, onClose }: DistrictPanelProps) {
  const d = districtById(district);
  const summary = districtSummary(district, band, progress);
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const setSettings = useSettings((s) => s.set);

  // Opening a district moves focus to its heading; arriving from a map marker focuses that mission instead.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    if (highlight) return;
    headingRef.current?.focus({ preventScroll: true });
    // Deliberately keyed on the district only: re-focusing on every highlight change would fight the user.
  }, [district]);

  useEffect(() => {
    if (!highlight) return;
    const card = document.getElementById(missionCardId(highlight));
    card?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    card?.querySelector<HTMLElement>('.hub-mcard__title')?.focus({ preventScroll: true });
  }, [highlight, district, reduced]);

  const from = side ? { opacity: 0, x: 40 } : { opacity: 0, y: 56 };

  return (
    <m.section
      className="hub-panel"
      aria-labelledby={titleId}
      initial={from}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={from}
      transition={{ duration: reduced ? 0.12 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{ '--hub-accent': d.color } as CSSProperties}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="hub-panel__head">
        <DistrictPlate district={d.id} color={d.color} fogged={d.comingSoon} size={44} />
        <div className="hub-panel__titles">
          <p className="hub-panel__kicker">{d.chapter}</p>
          <h2 id={titleId} ref={headingRef} tabIndex={-1} className="hub-panel__title">
            {d.name}
          </h2>
        </div>
        <button type="button" className="ui-iconbtn hub-panel__close" onClick={onClose} aria-label="Close, back to the whole city">
          <Icon name="close" />
        </button>
      </header>

      <div className="hub-panel__body" ref={bodyRef}>
        <p className="hub-panel__theme">{d.theme}</p>

        {d.comingSoon ? (
          <div className="hub-panel__fog">
            <Icon name="fog" size="2rem" />
            <p>
              <strong>Fogged for now.</strong> This part of the city opens when new missions have been checked by
              educators and safeguarding reviewers.
            </p>
          </div>
        ) : (
          <>
            <div className="hub-panel__light">
              <span className="hub-panel__lightlabel">District light</span>
              <TrustMeter value={progress.districtTrust[district] ?? 0} label={`${d.name} light`} />
            </div>

            {!band && (
              <div className="hub-panel__notice">
                <p>
                  <strong>Pick your level</strong> to see the missions made for you.
                </p>
                <div className="hub-panel__bandpick" role="group" aria-label="Your school level">
                  {BANDS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className="ui-btn ui-btn--secondary ui-btn--sm"
                      onClick={() => setSettings(b.id === 'junior' ? { band: b.id, plainLanguage: true } : { band: b.id })}
                    >
                      {b.segment}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {summary.otherBands && (
              <p className="hub-panel__notice">
                <Icon name="info" size="1.1em" /> No missions for your level here yet. These were written for other
                levels, and you are welcome to try them.
              </p>
            )}

            {summary.missions.length === 0 ? (
              <p className="hub-panel__empty">
                <Icon name="clock" size="1.1em" /> Missions for {d.name} are being reviewed. Check back soon.
              </p>
            ) : (
              <>
                <p className="hub-panel__count">
                  {plural(summary.missions.length, 'mission')}
                  {summary.fresh > 0 && <span> · {summary.fresh} new</span>}
                </p>
                <ul className="hub-panel__list">
                  {summary.missions.map((mission) => (
                    <li key={mission.id}>
                      <MissionCard
                        mission={mission}
                        progress={progress}
                        highlighted={highlight === mission.id}
                        showBands={summary.otherBands || !band}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </m.section>
  );
}
