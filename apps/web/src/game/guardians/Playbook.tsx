// Counter-Playbook (the Tactic Codex): one page per manipulation tactic. A page fills once the trick has
// appeared in a mission you played. Pages describe what the trick is built to do and the counter-move,
// so the blame always sits with the tactic, never with the person it targets.
import { useId } from 'react';
import { m } from 'motion/react';
import { TACTICS, type Progress } from '@shieldquest/shared';
import { Icon } from '../../ui/Icon';
import { seenTactics } from './bondData';

export function Playbook({ progress }: { progress: Progress }) {
  const seen = seenTactics(progress);
  const baseId = useId();

  return (
    <ul className="hub-bb-codex">
      {TACTICS.map((t, i) => {
        const found = seen.has(t.id);
        const titleId = `${baseId}-${t.id}`;
        return (
          <m.li
            key={t.id}
            className={`hub-bb-page${found ? '' : ' is-hidden'}`}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '0px 0px -8% 0px' }}
            transition={{ duration: 0.34, delay: (i % 3) * 0.06, ease: [0.22, 1, 0.36, 1] }}
          >
            {found ? (
              <article aria-labelledby={titleId}>
                <p className="hub-bb-page__ring">
                  <span className="sr-only">Pressure Ring label: </span>
                  {t.ringLabel}
                </p>
                <h3 id={titleId} className="hub-bb-page__name">
                  {t.name}
                </h3>
                <p className="hub-bb-page__line">
                  <span className="hub-bb-page__label">Designed to</span> {t.designedTo}.
                </p>
                <p className="hub-bb-page__line hub-bb-page__counter">
                  <span className="hub-bb-page__label">
                    <Icon name="shield" size="1em" /> Counter-move
                  </span>{' '}
                  {t.counter}
                </p>
              </article>
            ) : (
              <div className="hub-bb-page__blank">
                <p className="hub-bb-page__ring hub-bb-page__ring--blank" aria-hidden="true">
                  ???
                </p>
                <p className="hub-bb-page__mystery">
                  <span className="sr-only">Page {i + 1}: not found yet. </span>
                  <Icon name="fog" size="1.1em" /> A trick still in the fog. It fills in once it shows up in a mission
                  you play.
                </p>
              </div>
            )}
          </m.li>
        );
      })}
    </ul>
  );
}
