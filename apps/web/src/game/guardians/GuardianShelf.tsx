// The six Guardians: a tab strip of origami tiles and one big detail view. Only the selected Guardian
// gets a 3D canvas (one WebGL context per page); every other view is the flat GuardianIcon.
import { Suspense, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { m } from 'motion/react';
import { GUARDIANS, GUARDIAN_BOND_LEVELS, guardianById, skillById, type GuardianId, type Progress } from '@shieldquest/shared';
import { GuardianFigure, GuardianIcon, useRenderMode } from '../../world';
import { Icon } from '../../ui/Icon';
import { plural } from '../hub/hubData';
import { ViewBoundary, readStored, useSfx, useSoundCaption, writeStored } from '../hub/kit';
import {
  EARN_RULE,
  EARN_TIP,
  MARK_NUMERALS,
  allBonds,
  bondWord,
  nextStepText,
  type BondState,
} from './bondData';

/** Last Bond levels this viewer has seen in the Bond Book, so new folds get a one-time celebration. */
export const BOND_SEEN_KEY = 'sq.hub.bondSeen.v1';

type SeenLevels = Partial<Record<GuardianId, number>>;

/** Three folded marks; filled = earned. Shape (filled vs dashed outline) plus a word, never colour alone. */
export function BondMarks({ level, word, size = 'sm' }: { level: number; word?: string; size?: 'sm' | 'lg' }) {
  return (
    <span className={`hub-bb-marks hub-bb-marks--${size}`}>
      <span className="hub-bb-marks__row" aria-hidden="true">
        {MARK_NUMERALS.map((n, i) => (
          <svg key={n} viewBox="0 0 20 20" className={i < level ? 'is-on' : undefined} focusable="false">
            <path d="M10 1.8l7.2 8.2-7.2 8.2-7.2-8.2z" />
            {i < level && <path d="M10 1.8v16.4M2.8 10h14.4" className="hub-bb-marks__fold" />}
          </svg>
        ))}
      </span>
      <span className="hub-bb-marks__word">{word ?? bondWord(level)}</span>
    </span>
  );
}

function shortMarkWord(level: number): string {
  return level <= 0 ? 'Folded' : `Mark ${MARK_NUMERALS[Math.min(level, 3) - 1]}`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The big figure: 3D when the device can, the flat icon otherwise (and whenever 3D fails). */
function BondFigure({
  guardian,
  level,
  fromLevel,
  celebrate,
}: {
  guardian: GuardianId;
  level: number;
  fromLevel: number;
  celebrate: boolean;
}) {
  const mode = useRenderMode();
  // A level-up since the last visit starts at the old level, then grows (the figure pops and sparkles).
  const [shown, setShown] = useState(celebrate && fromLevel >= 1 ? fromLevel : level);
  useEffect(() => {
    if (shown === level) return;
    const t = window.setTimeout(() => setShown(level), 450);
    return () => window.clearTimeout(t);
  }, [shown, level]);

  const flat = (
    <m.div
      className="hub-bb-flat"
      initial={celebrate ? { opacity: 0, scale: 0.55, rotate: -10 } : false}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.15 }}
    >
      <GuardianIcon guardian={guardian} level={shown} size={176} />
    </m.div>
  );
  if (mode === '2d') return flat;
  return (
    <ViewBoundary fallback={flat}>
      <Suspense fallback={flat}>
        <GuardianFigure guardian={guardian} level={shown} celebrate={celebrate} quality={mode} />
      </Suspense>
    </ViewBoundary>
  );
}

function ProgressToNext({ s, name }: { s: BondState; name: string }) {
  const done = s.nextAt === null;
  const span = done ? 1 : s.nextAt!;
  const into = done ? 1 : s.bond;
  const pct = Math.round((into / span) * 100);
  const target = done ? 'All three Bond marks' : s.level === 0 ? `Unfold ${name}` : `Bond mark ${MARK_NUMERALS[s.level]}`;
  return (
    <div className="hub-bb-progress">
      <div className="hub-bb-progress__labels">
        <span>
          Shown <strong>{plural(s.bond, 'time')}</strong>
        </span>
        <span>{done ? 'Complete' : `Next: ${target}`}</span>
      </div>
      <div
        className="hub-bb-progress__bar"
        role="progressbar"
        aria-label={done ? `${name} bond` : `Progress to ${target}`}
        aria-valuemin={0}
        aria-valuemax={done ? 1 : s.nextAt!}
        aria-valuenow={done ? 1 : s.bond}
        aria-valuetext={done ? 'All three Bond marks folded in' : `${s.bond} of ${s.nextAt}`}
      >
        <m.span
          className="hub-bb-progress__fill"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: pct / 100 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        />
      </div>
      <p className="hub-bb-progress__text">{nextStepText(s, name)}</p>
      <ol className="hub-bb-steps" aria-label="Bond marks">
        {GUARDIAN_BOND_LEVELS.map((at, i) => {
          const got = s.bond >= at;
          return (
            <li key={at} className={got ? 'is-on' : undefined}>
              <span className="hub-bb-steps__mark" aria-hidden="true">
                {got ? <Icon name="check" size="0.95em" /> : MARK_NUMERALS[i]}
              </span>
              <span>
                Mark {MARK_NUMERALS[i]}: {i === 0 ? 'the first time' : `${at} times`}
                <span className="sr-only">{got ? ', folded in' : ', not yet'}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function GuardianShelf({ progress }: { progress: Progress }) {
  const sfx = useSfx();
  const [caption, showCaption] = useSoundCaption();
  const bonds = useMemo(() => allBonds(progress), [progress]);
  const [seen] = useState<SeenLevels>(() => readStored<SeenLevels>('local', BOND_SEEN_KEY, {}));
  const fresh = useMemo(
    () => new Set(bonds.filter((b) => b.level > (seen[b.id] ?? 0)).map((b) => b.id)),
    [bonds, seen],
  );
  const [celebrating, setCelebrating] = useState<Set<GuardianId>>(() => new Set(fresh));
  const [selected, setSelected] = useState<GuardianId>(
    () => bonds.find((b) => fresh.has(b.id))?.id ?? bonds.find((b) => b.level > 0)?.id ?? 'cluepaw',
  );
  const tabs = useRef(new Map<GuardianId, HTMLButtonElement>());
  const baseId = useId();
  const tabId = (id: GuardianId) => `${baseId}-tab-${id}`;
  const panelId = `${baseId}-panel`;

  // Remember what has now been seen, so the celebration happens once per new fold.
  useEffect(() => {
    const levels: SeenLevels = {};
    for (const b of bonds) levels[b.id] = b.level;
    writeStored('local', BOND_SEEN_KEY, levels);
  }, [bonds]);

  // A celebrated Guardian stays celebrated only while it is on show.
  useEffect(() => {
    if (!celebrating.has(selected)) return;
    const g = guardianById(selected);
    sfx('unfold');
    showCaption(`[paper unfolding chime: ${g.name}]`);
    return () =>
      setCelebrating((prev) => {
        const next = new Set(prev);
        next.delete(selected);
        return next;
      });
    // Runs on selection only: the cleanup removes the Guardian once the player moves on.
  }, [selected]);

  const select = (id: GuardianId, focus = false) => {
    if (id !== selected) sfx('pageTurn');
    setSelected(id);
    if (focus) tabs.current.get(id)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = GUARDIANS.findIndex((g) => g.id === selected);
    const n = GUARDIANS.length;
    const to: Record<string, number> = {
      ArrowRight: (i + 1) % n,
      ArrowDown: (i + 1) % n,
      ArrowLeft: (i - 1 + n) % n,
      ArrowUp: (i - 1 + n) % n,
      Home: 0,
      End: n - 1,
    };
    const target = to[e.key];
    const next = target === undefined ? undefined : GUARDIANS[target];
    if (!next) return;
    e.preventDefault();
    select(next.id, true);
  };

  const s = bonds.find((b) => b.id === selected)!;
  const g = guardianById(selected);
  const skill = skillById(g.skill);
  const isNew = celebrating.has(selected) || fresh.has(selected);
  const accent = { '--hub-accent': g.color } as CSSProperties;

  return (
    <div className="hub-bb-shelf">
      <div className="hub-bb-tabs" role="tablist" aria-label="Guardians" onKeyDown={onKeyDown}>
        {bonds.map((b) => {
          const gd = guardianById(b.id);
          const on = b.id === selected;
          return (
            <button
              key={b.id}
              ref={(el) => {
                if (el) tabs.current.set(b.id, el);
                else tabs.current.delete(b.id);
              }}
              type="button"
              role="tab"
              id={tabId(b.id)}
              aria-selected={on}
              aria-controls={panelId}
              tabIndex={on ? 0 : -1}
              className={`hub-bb-tab${on ? ' is-on' : ''}${b.level === 0 ? ' is-folded' : ''}`}
              style={{ '--hub-accent': gd.color } as CSSProperties}
              onClick={() => select(b.id)}
            >
              <span className="hub-bb-tab__icon" aria-hidden="true">
                <GuardianIcon guardian={b.id} level={b.level} size={52} />
              </span>
              <span className="hub-bb-tab__name">{gd.name}</span>
              <span className="hub-bb-tab__skill">
                <span className="hub-bb-letter" aria-hidden="true">
                  {gd.skill}
                </span>
                {skillById(gd.skill).verb}
              </span>
              <BondMarks level={b.level} word={shortMarkWord(b.level)} />
              {fresh.has(b.id) && (
                <span className="hub-bb-tab__new">
                  <Icon name="spark" size="0.9em" /> New
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="hub-bb-detail" role="tabpanel" id={panelId} aria-labelledby={tabId(selected)} style={accent}>
        <div className={`hub-bb-stage${s.level === 0 ? ' is-folded' : ''}`} aria-hidden="true">
          <BondFigure
            key={selected}
            guardian={selected}
            level={s.level}
            fromLevel={seen[selected] ?? 0}
            celebrate={celebrating.has(selected)}
          />
          {caption && <p className="hub-caption hub-bb-stage__caption">{caption}</p>}
        </div>

        <m.div
          key={selected}
          className="hub-bb-info"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {isNew && s.level > 0 && (
            <p className="hub-bb-info__new" role="status">
              <Icon name="spark" />
              {(seen[selected] ?? 0) === 0 ? `${g.name} unfolded!` : `New fold: ${bondWord(s.level)}!`}
            </p>
          )}
          <p className="hub-bb-info__kicker">
            <span className="hub-bb-letter hub-bb-letter--lg" aria-hidden="true">
              {skill.id}
            </span>
            <span>
              <span className="sr-only">Skill {skill.id}: </span>
              {skill.name}
            </span>
          </p>
          <h3 className="hub-bb-info__name">{g.name}</h3>
          <p className="hub-bb-info__creature">
            {capitalise(g.creature)}. Helps with {g.preventionSkill.toLowerCase()}.
          </p>
          <BondMarks level={s.level} size="lg" />

          <dl className="hub-bb-facts">
            <div className="hub-bb-facts__item">
              <dt>
                <Icon name="spark" /> How to earn
              </dt>
              <dd>{EARN_RULE[selected]}</dd>
            </div>
            <div className="hub-bb-facts__item">
              <dt>
                <Icon name="shield" /> Ability: {g.abilityName}
              </dt>
              <dd>
                {g.ability}
                {s.level === 0 && <span className="hub-bb-facts__later"> Ready once {g.name} unfolds.</span>}
              </dd>
            </div>
          </dl>

          <ProgressToNext s={s} name={g.name} />
          <p className="hub-bb-tip">{EARN_TIP[selected]}</p>
        </m.div>
      </div>
    </div>
  );
}
