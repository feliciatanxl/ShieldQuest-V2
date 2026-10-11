import { districtById, type BandId, type Mission } from '@shieldquest/shared';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { residentName } from '../runLogic';
import { PhaseHeading } from './PhaseHeading';
import './phases.css';

export interface IntroRole {
  name: string;
  /** One-line job. */
  job: string;
  /** Lens names this role sees with. */
  lenses: string;
}

/** Solo players are the Holder: every lens at once (the squad client passes the seat's role instead). */
export const SOLO_ROLE: IntroRole = {
  name: 'Holder',
  job: 'You can stop time. Spot the signs, follow the strings, and help the resident choose.',
  lenses: 'Clue, Heart, Thread, Ripple and Path',
};

const SCAFFOLD_NOTE: Record<Mission['scaffold'], string> = {
  guided: 'Guided: each step shows a short prompt.',
  light: 'Light: tap a letter in the S.H.I.E.L.D. rail if you want a hint.',
  wildcard: 'Wildcard: no prompts this time. Trust what you have practised.',
};

export interface IntroPhaseProps {
  mission: Mission;
  band: BandId | null;
  onStart: () => void;
  role?: IntroRole;
  /** "Press and hold" or "Tap" (from the hold setting). */
  tapToHold?: boolean;
  /** Hide the Start button (squad: the Conductor starts the clock). */
  hideStart?: boolean;
}

/** Role Flip and set-up: district, title, the scene, your role, and how HOLD works. */
export function IntroPhase({ mission, band, onStart, role = SOLO_ROLE, tapToHold, hideStart }: IntroPhaseProps) {
  const d = districtById(mission.district);
  const who = residentName(mission);
  return (
    <div className="msn-phase msn-intro">
      <PhaseHeading kicker={`${d.name} · ${d.chapter}`} title={mission.title}>
        <p className="msn-intro__note">
          <Icon name="info" /> Content note: {mission.theme.toLowerCase()}. All people and brands are made up.
        </p>
      </PhaseHeading>

      <p className="msn-intro__lead">{mission.intro}</p>

      <div className="msn-intro__role msn-paper">
        <p className="msn-intro__role-kicker">Your role</p>
        <p className="msn-intro__role-name">
          <Icon name="shield" /> {role.name}
        </p>
        <p>{role.job}</p>
        <p className="msn-intro__lens">Lenses: {role.lenses}.</p>
      </div>

      <ul className="msn-intro__how">
        <li>
          <Icon name="chat" />
          <span>
            Messages to {who} arrive in real time.{band === 'junior' ? '' : ' A clock runs down.'} Tap anything that catches your eye.
          </span>
        </li>
        <li>
          <Icon name="pause" />
          <span>
            When you feel rushed, {tapToHold ? 'tap' : 'press and hold'} <strong>HOLD</strong> (or press Space or H). Time stops for you.
          </span>
        </li>
        <li>
          <Icon name="door" />
          <span>Need a break? The door button pauses everything. Nothing is scored on speed.</span>
        </li>
      </ul>
      <p className="msn-intro__scaffold">{SCAFFOLD_NOTE[mission.scaffold]}</p>

      {!hideStart && (
        <Button size="lg" icon="play" block onClick={onStart} className="msn-intro__start">
          Start the moment
        </Button>
      )}
    </div>
  );
}
