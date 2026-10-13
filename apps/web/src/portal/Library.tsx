// Mission Library: built-in missions and custom missions in one list, with lint and review status,
// filters, mission details (sources and review included) and a tactic x band coverage matrix.

import { useEffect, useId, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  BANDS,
  DISTRICTS,
  HELP_CHANNELS,
  MISSIONS,
  TACTICS,
  bandById,
  districtById,
  type BandId,
  type DistrictId,
  type LintIssue,
  type Mission,
} from '@shieldquest/shared';
import { Button, LinkButton } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { StatusBadge, type Status } from '../ui/StatusBadge';
import { api, PortalError } from './api';
import type { CustomList } from './EducatorArea';
import { checkMission, missionTactics, type CustomMissionDetail, type CustomMissionSummary } from './model';
import { LintList, Note, formatDate, formatHour, lintStatus } from './parts';

type Source = 'built-in' | 'custom';

interface Item {
  key: string;
  id: string;
  source: Source;
  title: string;
  district: DistrictId;
  bands: BandId[];
  scaffold: Mission['scaffold'];
  scene: string;
  tactics: string[];
  lint: { errors: number; warnings: number; issues: LintIssue[] };
  review: { status: Status; label: string };
  youth: boolean;
  archived: boolean;
  published: boolean;
  mission?: Mission;
  summary?: CustomMissionSummary;
}

const SCAFFOLD_LABEL: Record<Mission['scaffold'], string> = { guided: 'Guided', light: 'Light support', wildcard: 'Wildcard' };

function customReview(s: CustomMissionSummary): { status: Status; label: string } {
  if (s.publishedVersion !== null) {
    const bands = s.publishedBands.map((b) => bandById(b).label).join(', ');
    return { status: 'safe', label: s.publishedVersion === s.version ? `Published: ${bands}` : `v${s.publishedVersion} live, v${s.version} draft` };
  }
  if (s.status === 'reviewed') return { status: 'safe', label: 'Reviewed, not published' };
  return { status: 'unknown', label: `Draft · ${s.signoffs.length}/2 sign-offs` };
}

export function Library({ custom }: { custom: CustomList }) {
  const [, navigate] = useLocation();
  const [q, setQ] = useState('');
  const [band, setBand] = useState<BandId | ''>('');
  const [district, setDistrict] = useState<DistrictId | ''>('');
  const [source, setSource] = useState<Source | 'youth' | ''>('');
  const [problems, setProblems] = useState<'' | 'errors' | 'clean'>('');
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState<Item | null>(null);
  const ids = { q: useId(), band: useId(), district: useId(), source: useId(), problems: useId() };

  const builtIn: Item[] = useMemo(
    () =>
      MISSIONS.map((m) => {
        const c = checkMission(m, { custom: false });
        return {
          key: `b:${m.id}`,
          id: m.id,
          source: 'built-in' as const,
          title: m.title,
          district: m.district,
          bands: m.bands,
          scaffold: m.scaffold,
          scene: m.scene,
          tactics: missionTactics(m),
          lint: { errors: c.errors, warnings: c.warnings, issues: c.issues },
          review:
            m.review.status === 'reviewed'
              ? { status: 'safe' as const, label: `Reviewed (${m.review.reviewers.join(', ')})` }
              : { status: 'attention' as const, label: 'Awaiting sign-off' },
          youth: false,
          archived: false,
          published: true,
          mission: m,
        };
      }),
    [],
  );

  const items: Item[] = useMemo(
    () => [
      ...builtIn,
      ...custom.missions.map((s) => ({
        key: `c:${s.id}`,
        id: s.id,
        source: 'custom' as const,
        title: s.title,
        district: s.district,
        bands: s.bands,
        scaffold: s.scaffold,
        scene: s.scene,
        tactics: s.tactics,
        lint: s.lint,
        review: customReview(s),
        youth: s.origin?.kind === 'youth',
        archived: s.archived,
        published: s.publishedVersion !== null,
        summary: s,
      })),
    ],
    [builtIn, custom.missions],
  );

  const needle = q.trim().toLowerCase();
  const shown = items.filter(
    (it) =>
      (!needle || `${it.title} ${it.id}`.toLowerCase().includes(needle)) &&
      (!band || it.bands.includes(band)) &&
      (!district || it.district === district) &&
      (!source || (source === 'youth' ? it.youth : it.source === source)) &&
      (!problems || (problems === 'errors' ? it.lint.errors > 0 : it.lint.errors === 0)) &&
      (showArchived || !it.archived),
  );

  return (
    <div className="portal-library">
      <header className="portal-section-head">
        <div>
          <p className="kicker">Mission Library</p>
          <h1 tabIndex={-1}>Missions</h1>
          <p className="portal-muted">
            {MISSIONS.length} built-in · {custom.missions.length} custom. Built-in missions change only through a code release;
            use one as a template to make a custom version.
          </p>
        </div>
        <div className="portal-actions">
          <Button icon="text" onClick={() => navigate('/portal?tab=editor')}>
            New custom mission
          </Button>
        </div>
      </header>

      <form className="portal-filters" role="search" aria-label="Filter missions" onSubmit={(e) => e.preventDefault()}>
        <div className="portal-input">
          <label htmlFor={ids.q}>Search</label>
          <input id={ids.q} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title or id" />
        </div>
        <div className="portal-input">
          <label htmlFor={ids.band}>Band</label>
          <select id={ids.band} value={band} onChange={(e) => setBand(e.target.value as BandId | '')}>
            <option value="">All bands</option>
            {BANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label} ({b.ages})
              </option>
            ))}
          </select>
        </div>
        <div className="portal-input">
          <label htmlFor={ids.district}>District</label>
          <select id={ids.district} value={district} onChange={(e) => setDistrict(e.target.value as DistrictId | '')}>
            <option value="">All districts</option>
            {DISTRICTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="portal-input">
          <label htmlFor={ids.source}>Source</label>
          <select id={ids.source} value={source} onChange={(e) => setSource(e.target.value as Source | 'youth' | '')}>
            <option value="">Built-in and custom</option>
            <option value="built-in">Built-in</option>
            <option value="custom">Custom</option>
            <option value="youth">Youth-made</option>
          </select>
        </div>
        <div className="portal-input">
          <label htmlFor={ids.problems}>Checks</label>
          <select id={ids.problems} value={problems} onChange={(e) => setProblems(e.target.value as '' | 'errors' | 'clean')}>
            <option value="">Any result</option>
            <option value="errors">Has errors</option>
            <option value="clean">No errors</option>
          </select>
        </div>
        <label className="portal-check portal-check--inline">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          <span>Show archived</span>
        </label>
      </form>

      {custom.error && <Note status="risk">{custom.error}</Note>}
      <p className="portal-muted" role="status" aria-live="polite">
        {custom.loading ? 'Loading custom missions…' : `${shown.length} mission${shown.length === 1 ? '' : 's'} shown`}
      </p>

      <ul className="portal-grid" aria-label="Missions">
        {shown.map((it) => {
          const d = districtById(it.district);
          const ls = lintStatus(it.lint.errors, it.lint.warnings);
          return (
            <li key={it.key} className={`portal-mcard${it.archived ? ' is-archived' : ''}`}>
              <span className="portal-mcard__stripe" style={{ background: d.color }} aria-hidden="true" />
              <p className="portal-mcard__kicker">
                {it.youth ? 'Youth-made' : it.source === 'built-in' ? 'Built-in' : 'Custom'} · {d.name}
                {it.archived ? ' · Archived' : ''}
              </p>
              <h2 className="portal-mcard__title">{it.title}</h2>
              <p className="portal-mcard__meta">
                <code>{it.id}</code>
                <span>{it.bands.map((b) => bandById(b).label).join(' / ')}</span>
                <span>{SCAFFOLD_LABEL[it.scaffold]}</span>
              </p>
              <div className="portal-mcard__badges">
                <StatusBadge status={ls.status} label={ls.label} />
                <StatusBadge status={it.review.status} label={it.review.label} />
              </div>
              <div className="portal-mcard__actions">
                <Button size="sm" variant="secondary" icon="eye" onClick={() => setOpen(it)}>
                  Details
                </Button>
                {it.source === 'built-in' ? (
                  <>
                    <LinkButton size="sm" variant="secondary" icon="play" href={`/play/m/${it.id}`}>
                      Preview
                    </LinkButton>
                    <Button size="sm" variant="ghost" icon="text" onClick={() => navigate(`/portal?tab=editor&template=${encodeURIComponent(it.id)}`)}>
                      Use as template
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" icon="text" onClick={() => navigate(`/portal?tab=editor&id=${encodeURIComponent(it.id)}`)}>
                    Edit
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {!shown.length && !custom.loading && <Note status="unknown">No missions match these filters.</Note>}

      <Coverage items={items.filter((it) => !it.archived && it.published)} />

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.title ?? 'Mission'} wide>
        {open && <MissionDetails item={open} />}
      </Sheet>
    </div>
  );
}

function Coverage({ items }: { items: Item[] }) {
  return (
    <details className="portal-card portal-coverage">
      <summary>
        <h2 className="portal-card__title">Coverage: tactics by band</h2>
        <span className="portal-muted">Built-in and published custom missions. Gaps show where new content is needed.</span>
      </summary>
      <div className="portal-tablewrap" tabIndex={0} role="region" aria-label="Coverage matrix">
        <table className="portal-table">
          <caption className="sr-only">Number of playable missions that practise each tactic, per band</caption>
          <thead>
            <tr>
              <th scope="col">Tactic</th>
              {BANDS.map((b) => (
                <th scope="col" key={b.id}>
                  {b.label} <span className="portal-muted">({b.ages})</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TACTICS.map((t) => (
              <tr key={t.id}>
                <th scope="row">
                  {t.name} <span className="portal-muted">({t.ringLabel})</span>
                </th>
                {BANDS.map((b) => {
                  const n = items.filter((it) => it.bands.includes(b.id) && it.tactics.includes(t.id)).length;
                  return (
                    <td key={b.id} className={n === 0 ? 'is-gap' : undefined}>
                      {n === 0 ? <StatusBadge status="attention" label="Gap" /> : n}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function MissionDetails({ item }: { item: Item }) {
  const [detail, setDetail] = useState<CustomMissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (item.source !== 'custom') return;
    let live = true;
    api<CustomMissionDetail>(`/api/missions/custom/${encodeURIComponent(item.id)}`, { auth: true })
      .then((d) => live && setDetail(d))
      .catch((e: unknown) => live && setError(e instanceof PortalError ? e.message : 'Could not load this mission.'));
    return () => {
      live = false;
    };
  }, [item]);

  const m = item.mission ?? detail?.mission;
  if (error) return <Note status="risk">{error}</Note>;
  if (!m) return <p className="portal-loading">Loading…</p>;
  const d = districtById(m.district);
  return (
    <div className="portal-details">
      <p className="portal-muted">
        <span className="portal-dot" style={{ background: d.color }} aria-hidden="true" /> {d.name} · scene {m.scene} ·{' '}
        {SCAFFOLD_LABEL[m.scaffold]} · v{m.version}
      </p>
      <p>{m.premise}</p>
      <dl className="portal-dl">
        <dt>Bands</dt>
        <dd>{m.bands.map((b) => `${bandById(b).label} (${bandById(b).ages})`).join(', ')}</dd>
        <dt>Theme</dt>
        <dd>{m.theme}</dd>
        <dt>Skills</dt>
        <dd>{m.skillFocus.join(' · ')}</dd>
        <dt>Cast</dt>
        <dd>
          {m.cast.map((c) => `${c.name} (${c.role}${c.faceless ? ', faceless' : ''}${c.anchor ? '' : ', remote'})`).join(', ')}
        </dd>
        <dt>Clues</dt>
        <dd>
          {m.clues.filter((c) => c.redFlag).length} red flags, {m.clues.filter((c) => !c.redFlag).length} ordinary details
        </dd>
        <dt>Help shown</dt>
        <dd>{m.help.map((h) => HELP_CHANNELS.find((x) => x.id === h)?.name ?? h).join(', ')}</dd>
      </dl>

      <h3>Exits</h3>
      <ul className="portal-exits">
        {m.choices.map((c) => (
          <li key={c.id}>
            <StatusBadge status={c.safety === 'safe' ? 'safe' : c.safety === 'risky' ? 'risk' : 'attention'} />
            <span>{c.label}</span>
            {c.aftershock && <span className="portal-muted"> · Aftershock {c.aftershock.timeLabel.toLowerCase()}</span>}
          </li>
        ))}
      </ul>

      <h3>Sources</h3>
      {m.sources.length ? (
        <ul className="portal-sources">
          {m.sources.map((s, i) => (
            <li key={i}>
              <b>{s.label}</b>
              <span>
                {s.publisher}, as of {s.asOf}
              </span>
              {s.url && <span className="portal-url">{s.url}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <Note status="risk">No sources cited yet. The content sign-off needs at least one.</Note>
      )}

      <h3>Review</h3>
      <dl className="portal-dl">
        <dt>Status</dt>
        <dd>
          <StatusBadge status={item.review.status} label={item.review.label} />
        </dd>
        <dt>Review by</dt>
        <dd>{m.review.reviewBy || 'Not set'}</dd>
        {m.review.notes && (
          <>
            <dt>Notes</dt>
            <dd>{m.review.notes}</dd>
          </>
        )}
        {detail && (
          <>
            <dt>Sign-offs</dt>
            <dd>
              {detail.signoffs.length
                ? detail.signoffs.map((s) => `${s.role === 'content' ? 'Content' : 'Safeguarding'}: ${s.initials} (${formatDate(s.at)})`).join(' · ')
                : 'None on this version'}
            </dd>
            {detail.origin && (
              <>
                <dt>Made by</dt>
                <dd>Youths in a ShieldQuest session: {detail.origin.credit}</dd>
              </>
            )}
            <dt>Versions</dt>
            <dd>
              v{detail.version} (saved {formatHour(detail.updatedAt)})
              {detail.history.length > 0 && `; ${detail.history.length} earlier version${detail.history.length === 1 ? '' : 's'} kept`}
            </dd>
          </>
        )}
      </dl>

      <h3>Content checks</h3>
      <LintList issues={item.lint.issues} />
    </div>
  );
}

