// A mission as a paper card: what it is about (premise and topic), which skills it trains,
// how much support it gives, and how it went last time. Status is always shape + word.
import { bandById, skillById, type Mission, type Progress } from '@shieldquest/shared';
import { LinkButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { StatusBadge } from '../../ui/StatusBadge';
import { SAFETY_STATUS, SCAFFOLD_HINT, SCAFFOLD_LABEL, TIME_LABEL, TUTORIAL_ID, missionState, plural } from './hubData';

export const missionCardId = (missionId: string) => `hub-m-${missionId}`;

interface MissionCardProps {
  mission: Mission;
  progress: Progress;
  highlighted?: boolean;
  /** Show which school levels the mission was written for (when listing other bands' missions). */
  showBands?: boolean;
}

export function MissionCard({ mission, progress, highlighted, showBands }: MissionCardProps) {
  const run = progress.runs[mission.id];
  const state = missionState(progress, mission.id);
  const titleId = `${missionCardId(mission.id)}-title`;
  const best = run ? SAFETY_STATUS[run.bestSafety] : null;

  return (
    <article
      id={missionCardId(mission.id)}
      className={`hub-mcard${highlighted ? ' is-highlighted' : ''}`}
      aria-labelledby={titleId}
    >
      <header className="hub-mcard__head">
        <p className="hub-mcard__kicker">
          {mission.id === TUTORIAL_ID ? 'Tutorial' : SCAFFOLD_LABEL[mission.scaffold]} · {TIME_LABEL[mission.timeOfDay]}
        </p>
        <h3 id={titleId} className="hub-mcard__title" tabIndex={-1}>
          {mission.title}
        </h3>
        <div className="hub-mcard__status">
          {best ? <StatusBadge status={best.status} label={best.label} /> : <StatusBadge status="unknown" label="New" />}
          {state === 'aftershock' && <StatusBadge status="attention" label="Something is still in motion" />}
        </div>
      </header>

      <p className="hub-mcard__premise">{mission.premise}</p>

      <p className="hub-mcard__note">
        <Icon name="info" size="1em" />
        <span>
          <span className="hub-mcard__notelabel">Topic:</span> {mission.theme}
        </span>
      </p>

      <div className="hub-mcard__meta">
        <div className="hub-mcard__skills">
          <span className="hub-mcard__metalabel">Skills</span>
          <ul className="hub-letters" aria-label="Skills in focus">
            {mission.skillFocus.map((id) => {
              const skill = skillById(id);
              return (
                <li key={id} title={skill.name}>
                  <span aria-hidden="true">{id}</span>
                  <span className="sr-only">{skill.name}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="hub-mcard__scaffold" title={SCAFFOLD_HINT[mission.scaffold]}>
          <span className="hub-mcard__metalabel">Support</span> {SCAFFOLD_HINT[mission.scaffold]}
        </p>
        {showBands && (
          <p className="hub-mcard__bands">
            <span className="hub-mcard__metalabel">Written for</span>{' '}
            {mission.bands.map((b) => bandById(b).segment).join(', ')}
          </p>
        )}
      </div>

      <footer className="hub-mcard__foot">
        {run && <span className="hub-mcard__plays">Played {plural(run.plays, 'time')}</span>}
        <LinkButton href={`/play/m/${mission.id}`} icon="play">
          {run ? 'Play again' : 'Play'}
          <span className="sr-only">: {mission.title}</span>
        </LinkButton>
      </footer>
    </article>
  );
}
