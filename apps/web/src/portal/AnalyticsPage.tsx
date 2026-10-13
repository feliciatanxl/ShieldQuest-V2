// /portal/analytics: aggregated pilot analytics (GDD §7.5). Educator sign-in required. Every number
// from fewer than 5 people or squads arrives suppressed from the server and shows as "<5"; there is
// no per-player view anywhere. CSV export downloads the same aggregated table.

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { BANDS, bandById, type BandId } from '@shieldquest/shared';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { api, downloadWithAuth, PortalError, useEducatorSession, verifySession } from './api';
import { CalibrationChart, CalibrationTable, HoldChart, SignalList, SignalTable, TableDetails, statText } from './charts';
import { SUPPRESSED_TEXT, type AnalyticsReport, type Stat } from './model';
import { Note, PortalShell, SignInCard, formatHour, usePageTitle } from './parts';

interface Filters {
  band: BandId | '';
  from: string;
  to: string;
}

const toIso = (local: string): string | null => {
  if (!local) return null;
  const t = Date.parse(local);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

function query(f: Filters): string {
  const p = new URLSearchParams();
  if (f.band) p.set('band', f.band);
  const from = toIso(f.from);
  const to = toIso(f.to);
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  const s = p.toString();
  return s ? `?${s}` : '';
}

function Tile({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <div className="portal-tile">
      <p className="portal-tile__label">{label}</p>
      <p className="portal-tile__value">{value === null ? <abbr title={SUPPRESSED_TEXT}>&lt;5</abbr> : value.toLocaleString()}</p>
      {hint && <p className="portal-tile__hint">{hint}</p>}
    </div>
  );
}

const pct = (s: Stat) => statText(s, 'percent');

function Dashboard() {
  const [filters, setFilters] = useState<Filters>({ band: '', from: '', to: '' });
  const [applied, setApplied] = useState<Filters>(filters);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const ids = { band: useId(), from: useId(), to: useId() };

  // Only the newest request may update the page, so a slow or failed earlier one never overwrites it.
  const latest = useRef(0);
  const load = useCallback(async (f: Filters) => {
    const ticket = ++latest.current;
    setBusy(true);
    try {
      const next = await api<AnalyticsReport>(`/api/analytics${query(f)}`, { auth: true });
      if (ticket !== latest.current) return;
      setReport(next);
      setError(null);
    } catch (e) {
      if (ticket !== latest.current) return;
      setError(e instanceof PortalError ? e.message : 'Could not load analytics.');
    } finally {
      if (ticket === latest.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(applied);
  }, [applied, load]);

  const apply = (e: FormEvent) => {
    e.preventDefault();
    setApplied({ ...filters });
  };

  const r = report;
  return (
    <div className="portal-analytics">
      <header className="portal-section-head">
        <div>
          <p className="kicker">Analytics</p>
          <h1 tabIndex={-1}>Pilot impact and engagement</h1>
          <p className="portal-muted">
            Aggregated across squad sessions and the before, after and Return checks. Times are stored to the hour only.
          </p>
        </div>
      </header>

      <form className="portal-filters" onSubmit={apply} aria-label="Analytics filters">
        <div className="portal-input">
          <label htmlFor={ids.band}>Band</label>
          <select id={ids.band} value={filters.band} onChange={(e) => setFilters({ ...filters, band: e.target.value as BandId | '' })}>
            <option value="">All bands</option>
            {BANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label} ({b.ages})
              </option>
            ))}
          </select>
        </div>
        <div className="portal-input">
          <label htmlFor={ids.from}>From (hour)</label>
          <input id={ids.from} type="datetime-local" step={3600} value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </div>
        <div className="portal-input">
          <label htmlFor={ids.to}>To (hour)</label>
          <input id={ids.to} type="datetime-local" step={3600} value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
        <div className="portal-actions">
          <Button type="submit" disabled={busy}>
            {busy ? 'Loading…' : 'Apply'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const empty: Filters = { band: '', from: '', to: '' };
              setFilters(empty);
              setApplied(empty);
            }}
          >
            Reset
          </Button>
          <Button
            variant="secondary"
            icon="arrowRight"
            onClick={() => {
              setCsvError(null);
              downloadWithAuth(`/api/analytics.csv${query(applied)}`, 'shieldquest-analytics.csv').catch((e: unknown) =>
                setCsvError(e instanceof PortalError ? e.message : 'The download did not work.'),
              );
            }}
          >
            Download CSV
          </Button>
        </div>
      </form>
      {csvError && <Note status="risk">{csvError}</Note>}

      <Note status="unknown">
        <p>
          <b>Privacy:</b> any number built from fewer than 5 people or squads is hidden and shows as “&lt;5”. There is no
          per-player data, and the CSV export contains only this aggregated table.
        </p>
      </Note>

      <div aria-live="polite" className="sr-only">
        {busy ? 'Loading analytics' : r ? `Analytics updated for ${r.filter.band ? bandById(r.filter.band).label : 'all bands'}` : ''}
      </div>
      {error && <Note status="risk">{error}</Note>}
      {!r && !error && <p className="portal-loading">Loading analytics…</p>}

      {r && (
        <>
          <p className="portal-fine">
            Showing {r.filter.band ? bandById(r.filter.band).label : 'all bands'}
            {r.filter.from ? ` from ${formatHour(r.filter.from)}` : ''}
            {r.filter.to ? ` to ${formatHour(r.filter.to)}` : ''}. Generated {formatHour(r.generatedAt)}.
          </p>
          <section className="portal-tiles" aria-label="Totals">
            <Tile label="Squad sessions" value={r.totals.sessions} hint={r.totals.completeSessions !== null ? `${r.totals.completeSessions} reached the end` : undefined} />
            <Tile label="Players (seats)" value={r.totals.seats} />
            <Tile label="Missions completed" value={r.totals.missionsCompleted} />
            <Tile label="Before checks" value={r.totals.responses.pre} />
            <Tile label="After checks" value={r.totals.responses.post} hint={r.totals.matched.prePost !== null ? `${r.totals.matched.prePost} matched with before` : undefined} />
            <Tile label="Return visits" value={r.totals.responses.return} />
          </section>

          <div className="portal-kpis">
            {r.kpis.map((k) => (
              <section key={k.id} className="portal-kpi" aria-labelledby={`kpi-${k.id}`}>
                <header className="portal-kpi__head">
                  <span className="portal-kpi__num" aria-hidden="true">
                    {k.number}
                  </span>
                  <div>
                    <h2 id={`kpi-${k.id}`}>
                      <span className="sr-only">KPI {k.number}: </span>
                      {k.label}
                    </h2>
                    <p className="portal-muted">{k.measure}</p>
                  </div>
                </header>
                {k.calibration.length > 0 && (
                  <figure className="portal-figure">
                    <figcaption>Calibration check (means)</figcaption>
                    <CalibrationChart rows={k.calibration} />
                    <CalibrationTable rows={k.calibration} caption={`KPI ${k.number} ${k.label}: calibration means`} />
                  </figure>
                )}
                {k.signals.length > 0 && (
                  <figure className="portal-figure">
                    <figcaption>In-game signals (aggregate)</figcaption>
                    <SignalList signals={k.signals} />
                    <SignalTable signals={k.signals} caption={`KPI ${k.number} ${k.label}: in-game signals`} />
                  </figure>
                )}
              </section>
            ))}
          </div>

          <section className="portal-card" aria-labelledby="portal-hold-h">
            <h2 className="portal-card__title" id="portal-hold-h">
              How fast players pressed HOLD
            </h2>
            <p className="portal-muted">Seconds after the pressure started. Auto-frozen means the moment froze before the player held.</p>
            <HoldChart buckets={r.holdLatency} />
            <TableDetails>
              <table className="portal-table">
                <caption>Hold latency (players)</caption>
                <thead>
                  <tr>
                    <th scope="col">Time to HOLD</th>
                    <th scope="col">Players</th>
                  </tr>
                </thead>
                <tbody>
                  {r.holdLatency.map((h) => (
                    <tr key={h.bucket}>
                      <th scope="row">{h.label}</th>
                      <td>{h.n === null ? '<5' : h.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableDetails>
          </section>

          <section className="portal-card" aria-labelledby="portal-missions-h">
            <h2 className="portal-card__title" id="portal-missions-h">
              Missions across sessions
            </h2>
            {r.missions.length ? (
              <div className="portal-tablewrap" tabIndex={0} role="region" aria-label="Missions across sessions">
                <table className="portal-table portal-table--dense">
                  <caption className="sr-only">Mission results across sessions. Rates show the share of players or squads.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Mission</th>
                      <th scope="col">Squads</th>
                      <th scope="col">Completed</th>
                      <th scope="col">Held</th>
                      <th scope="col">Safest, first seal</th>
                      <th scope="col">Safest, final</th>
                      <th scope="col">Moved safer</th>
                      <th scope="col">Forecast</th>
                      <th scope="col">Peer Shield</th>
                      <th scope="col">Most-missed red flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.missions.map((m) => (
                      <tr key={m.missionId}>
                        <th scope="row">
                          {m.title}
                          {m.scaffold === 'wildcard' && <span className="portal-pill">Wildcard</span>}
                        </th>
                        <td>{statText(m.squads, 'number')}</td>
                        <td>{pct(m.completion)}</td>
                        <td>{pct(m.holdRate)}</td>
                        <td>{pct(m.firstSafe)}</td>
                        <td>{pct(m.finalSafe)}</td>
                        <td>{pct(m.shiftedSafer)}</td>
                        <td>{pct(m.forecast)}</td>
                        <td>{pct(m.shieldSuccess)}</td>
                        <td>{m.mostMissed ? `${m.mostMissed.label} (${pct(m.mostMissed.found)} found)` : '<5 squads'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="portal-muted">No squad missions in this range yet.</p>
            )}
            {r.missions.some((m) => m.decisions.some((d) => d.squads)) && (
              <TableDetails>
                <table className="portal-table">
                  <caption>Squad decisions per Exit</caption>
                  <thead>
                    <tr>
                      <th scope="col">Mission</th>
                      <th scope="col">Exit</th>
                      <th scope="col">Squads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.missions.flatMap((m) =>
                      m.decisions.map((d) => (
                        <tr key={`${m.missionId}-${d.choiceId}`}>
                          <th scope="row">{m.title}</th>
                          <td>
                            <StatusBadge status={d.safety === 'safe' ? 'safe' : d.safety === 'risky' ? 'risk' : 'attention'} /> {d.label}
                          </td>
                          <td>{d.squads === null ? '<5' : d.squads}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </TableDetails>
            )}
          </section>

          <section className="portal-card" aria-labelledby="portal-sessions-h">
            <h2 className="portal-card__title" id="portal-sessions-h">
              Sessions
            </h2>
            {r.sessions.length ? (
              <div className="portal-tablewrap" tabIndex={0} role="region" aria-label="Sessions">
                <table className="portal-table portal-table--dense">
                  <caption className="sr-only">One row per squad session, newest first. No session codes are stored.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Hour</th>
                      <th scope="col">Band</th>
                      <th scope="col">Players</th>
                      <th scope="col">Squads</th>
                      <th scope="col">Missions</th>
                      <th scope="col">Held</th>
                      <th scope="col">Moved safer</th>
                      <th scope="col">Lanterns</th>
                      <th scope="col">Ended</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.sessions.map((s, i) => (
                      <tr key={`${s.hour}-${i}`}>
                        <th scope="row">{formatHour(s.hour)}</th>
                        <td>{bandById(s.band).label}</td>
                        <td>{s.seats === null ? '<5' : s.seats}</td>
                        <td>{s.squads === null ? '<5' : s.squads}</td>
                        <td>{s.missionsCompleted}</td>
                        <td>{pct(s.holdRate)}</td>
                        <td>{pct(s.shiftedSafer)}</td>
                        <td>{s.lanterns === null ? <abbr title={SUPPRESSED_TEXT}>Hidden</abbr> : s.lanterns}</td>
                        <td>{s.complete ? 'Yes' : 'Not yet'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="portal-muted">No squad sessions in this range yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  usePageTitle('Analytics');
  const session = useEducatorSession();
  useEffect(() => {
    void verifySession();
  }, []);
  return (
    <PortalShell tab="analytics" wide>
      {session ? (
        <Dashboard />
      ) : (
        <div className="portal-gate">
          <h1 tabIndex={-1}>Analytics</h1>
          <p className="portal-lead">Aggregated pilot analytics are for educators and the ShieldQuest team. Please sign in.</p>
          <SignInCard />
        </div>
      )}
    </PortalShell>
  );
}
