// The private record: If-Then plans and personal stats. Computed and kept on this device only.
// No comparisons with anyone else, no streaks, nothing that ranks the player.
import type { CSSProperties } from 'react';
import { m } from 'motion/react';
import { GUARDIANS, SKILLS, TACTICS, isGuardianUnfolded, missionById, type Progress } from '@shieldquest/shared';
import { LinkButton } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { holdInsight, seenTactics, shortDate } from './bondData';

export function IfThenList({ progress }: { progress: Progress }) {
  const cards = [...progress.ifThenCards].sort((a, b) => b.at - a.at);
  if (cards.length === 0) {
    return (
      <div className="hub-bb-empty">
        <Icon name="envelope" size="1.6rem" />
        <p>
          At the end of a mission you can make a private If-Then plan, like{' '}
          <q>If someone rushes me with money or a secret, I will stop and tell my older cousin.</q> Your plans are
          kept here, on this phone only.
        </p>
      </div>
    );
  }
  return (
    <ul className="hub-bb-notes">
      {cards.map((c, i) => {
        const mission = missionById(c.missionId);
        const date = shortDate(c.at);
        return (
          <m.li
            key={c.missionId}
            className="hub-bb-note"
            style={{ '--hub-tilt': `${i % 2 === 0 ? -0.6 : 0.5}deg` } as CSSProperties}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: Math.min(i, 4) * 0.05 }}
          >
            <p className="hub-bb-note__text">{c.text}</p>
            <p className="hub-bb-note__meta">
              {mission ? <>From &ldquo;{mission.title}&rdquo;</> : 'From a mission'}
              {date && <> · {date}</>}
            </p>
          </m.li>
        );
      })}
    </ul>
  );
}

function StatTile({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <li className="hub-bb-stat">
      <Icon name={icon} size="1.25rem" />
      <span className="hub-bb-stat__value">{value}</span>
      <span className="hub-bb-stat__label">{label}</span>
    </li>
  );
}

export function RecordStats({ progress }: { progress: Progress }) {
  const { totals } = progress;
  const insight = holdInsight(totals);
  const top = Math.max(insight.live, insight.held, 1);
  const unfolded = GUARDIANS.filter((g) => isGuardianUnfolded(progress, g.id)).length;
  const pages = seenTactics(progress).size;
  const distinct = Object.keys(progress.runs).length;
  const evidenceTop = Math.max(6, ...SKILLS.map((s) => progress.skillEvidence[s.id] ?? 0));

  if (totals.missions === 0) {
    return (
      <div className="hub-bb-empty">
        <Icon name="clock" size="1.6rem" />
        <p>Your record starts after your first mission. Only you can see it, and it never leaves this phone.</p>
        <LinkButton href="/play" variant="secondary" icon="map">
          Back to the city
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="hub-bb-record">
      <ul className="hub-bb-stats">
        <StatTile icon="play" value={String(totals.missions)} label={totals.missions === 1 ? 'mission played' : 'missions played'} />
        <StatTile icon="map" value={String(distinct)} label={distinct === 1 ? 'different moment' : 'different moments'} />
        <StatTile icon="pause" value={String(totals.holds)} label={totals.holds === 1 ? 'early Hold' : 'early Holds'} />
        <StatTile icon="spark" value={`${unfolded}/${GUARDIANS.length}`} label="Guardians unfolded" />
        <StatTile icon="book" value={`${pages}/${TACTICS.length}`} label="Playbook pages" />
      </ul>

      <section className="hub-bb-livehold" aria-labelledby="hub-bb-livehold-title">
        <h3 id="hub-bb-livehold-title">LIVE vs HELD</h3>
        <p className="hub-bb-livehold__line">
          {insight.line}
        </p>
        <dl className="hub-bb-bars">
          <div className="hub-bb-bars__row">
            <dt>
              <Icon name="eye" /> Seen live
            </dt>
            <dd>
              <span className="hub-bb-bars__track" aria-hidden="true">
                <m.span
                  className="hub-bb-bars__fill hub-bb-bars__fill--live"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: insight.live / top }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
              <span className="hub-bb-bars__num">{insight.live}</span>
              <span className="sr-only">red flags</span>
            </dd>
          </div>
          <div className="hub-bb-bars__row">
            <dt>
              <Icon name="pause" /> Found while holding
            </dt>
            <dd>
              <span className="hub-bb-bars__track" aria-hidden="true">
                <m.span
                  className="hub-bb-bars__fill hub-bb-bars__fill--held"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: insight.held / top }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
              <span className="hub-bb-bars__num">{insight.held}</span>
              <span className="sr-only">red flags</span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="hub-bb-skills" aria-labelledby="hub-bb-skills-title">
        <h3 id="hub-bb-skills-title">S.H.I.E.L.D. skills shown</h3>
        <ul>
          {SKILLS.map((s) => {
            const n = progress.skillEvidence[s.id] ?? 0;
            return (
              <li key={s.id} style={{ '--hub-accent': GUARDIANS.find((g) => g.skill === s.id)?.color } as CSSProperties}>
                <span className="hub-bb-letter hub-bb-letter--lg" aria-hidden="true">
                  {s.id}
                </span>
                <span className="hub-bb-skills__name">{s.name}</span>
                <span className="hub-bb-skills__track" aria-hidden="true">
                  <span style={{ transform: `scaleX(${Math.min(1, n / evidenceTop)})` }} />
                </span>
                <span className="hub-bb-skills__num">
                  {n} <span className="sr-only">{n === 1 ? 'time' : 'times'}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="hub-bb-private">
        <Icon name="lock" /> Just for you. There is no leaderboard, and none of this is uploaded.
      </p>
    </div>
  );
}
