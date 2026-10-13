// DOM twin of tapping a district plate in the 3D city: every district (including the fogged
// "Coming soon" plates) is a real button, so the hub never needs the 3D view.
import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { DISTRICTS, type BandId, type DistrictId, type Progress } from '@shieldquest/shared';
import { Icon } from '../../ui/Icon';
import { StatusShape } from '../../ui/StatusBadge';
import { districtSummary, type DistrictSummary } from './hubData';
import { DistrictPlate, revealInRow, useReducedMotionSetting } from './kit';

interface DistrictPickerProps {
  focus: DistrictId | null;
  band: BandId | null;
  progress: Progress;
  onSelect: (district: DistrictId) => void;
  /** Lets the hub return focus to a district's button when its panel closes. */
  registerButton: (district: DistrictId, el: HTMLButtonElement | null) => void;
}

function StatusLine({ s }: { s: DistrictSummary }) {
  if (s.comingSoon)
    return (
      <>
        <Icon name="fog" size="1em" /> Coming soon
      </>
    );
  if (s.inMotion > 0)
    return (
      <>
        <StatusShape status="attention" size={14} /> In motion
      </>
    );
  if (s.fresh > 0)
    return (
      <>
        <Icon name="spark" size="1em" /> {s.fresh} new
      </>
    );
  if (s.missions.length === 0)
    return (
      <>
        <Icon name="clock" size="1em" /> Being reviewed
      </>
    );
  return (
    <>
      <Icon name="check" size="1em" /> All played
    </>
  );
}

export function DistrictPicker({ focus, band, progress, onSelect, registerButton }: DistrictPickerProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const reduced = useReducedMotionSetting();

  // On phones the plates scroll sideways: keep the open district fully in view (also when it was opened
  // from the map), so its selected state is never half hidden off the edge.
  useEffect(() => {
    if (!focus) return;
    revealInRow(listRef.current, listRef.current?.querySelector('[aria-pressed="true"]') ?? null, reduced);
  }, [focus, reduced]);

  // Arrow keys move between plates (Tab still works too); Home/End jump to the ends.
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? buttons.length - 1
          : (i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <nav className="hub-picker" aria-label="Districts of ShieldQuest City">
      <ul className="hub-picker__list" ref={listRef} onKeyDown={onKeyDown}>
        {DISTRICTS.map((d) => {
          const s = districtSummary(d.id, band, progress);
          const on = focus === d.id;
          return (
            <li key={d.id}>
              <button
                type="button"
                ref={(el) => registerButton(d.id, el)}
                className={`hub-pick${on ? ' is-on' : ''}${d.comingSoon ? ' is-fogged' : ''}`}
                aria-pressed={on}
                onClick={() => onSelect(d.id)}
                style={{ '--hub-accent': d.color } as CSSProperties}
              >
                <DistrictPlate district={d.id} color={d.color} fogged={d.comingSoon} size={38} />
                <span className="hub-pick__text">
                  <span className="hub-pick__name">{d.name}</span>
                  <span className="hub-pick__status">
                    <StatusLine s={s} />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
