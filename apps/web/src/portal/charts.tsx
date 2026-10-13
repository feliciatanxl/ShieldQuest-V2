// Small accessible charts for the analytics dashboard. Bars are inline SVG; every word and number
// stays in HTML so the text-size setting applies, and every chart has a table view. Suppressed cells
// (fewer than 5) never draw a bar: they show "<5" on a dashed track.

import type { ReactNode } from 'react';
import { StatusBadge } from '../ui/StatusBadge';
import type { AnalyticsReport, CalibrationRow, SignalRow, Stat } from './model';
import { SUPPRESSED_TEXT } from './model';

export const SERIES = [
  { key: 'pre', label: 'Before', className: 'portal-viz--1' },
  { key: 'post', label: 'After', className: 'portal-viz--2' },
  { key: 'return', label: 'Return', className: 'portal-viz--3' },
] as const;

export function fmtValue(v: number | null, format: 'percent' | 'number' | 'scale'): string {
  if (v === null) return '<5';
  if (format === 'percent') return `${Math.round(v * 100)}%`;
  return v.toFixed(2);
}

export function fmtDelta(v: number | null, format: 'percent' | 'number' | 'scale'): string {
  if (v === null) return '<5';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '±';
  const abs = Math.abs(v);
  return format === 'percent' ? `${sign}${Math.round(abs * 100)} pts` : `${sign}${abs.toFixed(2)}`;
}

/** One bar on a 0-100% track (SVG, decorative: the value is printed beside it). */
function Bar({ share, className }: { share: number | null; className?: string }) {
  if (share === null) {
    return (
      <svg className="portal-meter portal-meter--empty" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="3" width="100" height="4" rx="2" />
      </svg>
    );
  }
  const w = Math.max(0, Math.min(100, share * 100));
  return (
    <svg className={`portal-meter ${className ?? ''}`} viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
      <rect className="portal-meter__track" x="0" y="0" width="100" height="10" rx="2" />
      {w > 0 && <rect className="portal-meter__fill" x="0" y="0" width={w} height="10" rx="2" />}
    </svg>
  );
}

export function Legend() {
  return (
    <ul className="portal-legend" aria-label="Legend">
      {SERIES.map((s) => (
        <li key={s.key}>
          <span className={`portal-legend__key ${s.className}`} aria-hidden="true" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function changeBadge(row: CalibrationRow) {
  const c = row.change;
  if (c.suppressed || c.mean === null || !c.ci95) return <StatusBadge status="unknown" label="Not enough pairs yet" />;
  const [lo, hi] = c.ci95;
  if (row.higherIsBetter === null) return <StatusBadge status="unknown" label="Shift (no better direction)" />;
  const better = row.higherIsBetter ? lo > 0 : hi < 0;
  const worse = row.higherIsBetter ? hi < 0 : lo > 0;
  if (better) return <StatusBadge status="safe" label="Clear improvement" />;
  if (worse) return <StatusBadge status="risk" label="Clear drop" />;
  return <StatusBadge status="attention" label="No clear change" />;
}

/** Before / After / Return for each metric of a KPI, each on its own scale. */
export function CalibrationChart({ rows }: { rows: CalibrationRow[] }) {
  return (
    <div className="portal-calib">
      <Legend />
      {rows.map((r) => {
        const span = r.max - r.min || 1;
        const share = (v: number | null) => (v === null ? null : (v - r.min) / span);
        const c = r.change;
        return (
          <div key={r.metricId} className="portal-calib__metric">
            <p className="portal-calib__label">{r.label}</p>
            {SERIES.map((s) => {
              const cell = r[s.key];
              return (
                <div key={s.key} className="portal-barrow">
                  <span className="portal-barrow__name">{s.label}</span>
                  <Bar share={share(cell.mean)} className={s.className} />
                  <span className="portal-barrow__value">
                    {cell.suppressed ? <abbr title={SUPPRESSED_TEXT}>&lt;5</abbr> : fmtValue(cell.mean, r.format)}
                    {!cell.suppressed && cell.n !== null && <span className="portal-muted"> n={cell.n}</span>}
                  </span>
                </div>
              );
            })}
            <p className="portal-calib__change">
              {changeBadge(r)}
              <span>
                {r.changeLabel}:{' '}
                {c.suppressed || c.mean === null ? (
                  SUPPRESSED_TEXT
                ) : (
                  <>
                    <b>{fmtDelta(c.mean, r.format)}</b>
                    {c.ci95 && ` (95% CI ${fmtDelta(c.ci95[0], r.format)} to ${fmtDelta(c.ci95[1], r.format)}, n=${c.n})`}
                  </>
                )}
              </span>
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function CalibrationTable({ rows, caption }: { rows: CalibrationRow[]; caption: string }) {
  const cellText = (v: number | null, suppressed: boolean, f: CalibrationRow['format']) => (suppressed ? '<5' : fmtValue(v, f));
  return (
    <TableDetails>
      <table className="portal-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">Before (n)</th>
            <th scope="col">After (n)</th>
            <th scope="col">Return (n)</th>
            <th scope="col">Change (95% CI, n)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.metricId}>
              <th scope="row">{r.label}</th>
              {SERIES.map((s) => (
                <td key={s.key}>
                  {cellText(r[s.key].mean, r[s.key].suppressed, r.format)}
                  {r[s.key].n !== null && ` (${r[s.key].n})`}
                </td>
              ))}
              <td>
                {r.change.suppressed || r.change.mean === null
                  ? '<5'
                  : `${fmtDelta(r.change.mean, r.format)}${r.change.ci95 ? ` (${fmtDelta(r.change.ci95[0], r.format)} to ${fmtDelta(r.change.ci95[1], r.format)})` : ''}, n=${r.change.n}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableDetails>
  );
}

function statText(s: Stat, format: 'percent' | 'number'): string {
  if (s.suppressed) return '<5';
  if (s.value === null) return 'No data yet';
  return format === 'percent' ? `${Math.round(s.value * 100)}%` : Number.isInteger(s.value) ? String(s.value) : s.value.toFixed(2);
}

/** In-game signals: rates get a bar, counts and averages are printed. */
export function SignalList({ signals }: { signals: SignalRow[] }) {
  return (
    <ul className="portal-signals">
      {signals.map((s) => (
        <li key={s.id} className="portal-signal">
          <span className="portal-signal__label">{s.label}</span>
          {s.format === 'percent' && <Bar share={s.stat.suppressed ? null : s.stat.value} className="portal-viz--1" />}
          <span className="portal-signal__value">
            {s.stat.suppressed ? <abbr title={SUPPRESSED_TEXT}>&lt;5</abbr> : statText(s.stat, s.format)}
            {!s.stat.suppressed && s.stat.n !== null && s.stat.n > 0 && s.format === 'percent' && (
              <span className="portal-muted">
                {' '}
                n={s.stat.n} {s.unit}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SignalTable({ signals, caption }: { signals: SignalRow[]; caption: string }) {
  return (
    <TableDetails>
      <table className="portal-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Signal</th>
            <th scope="col">Value</th>
            <th scope="col">n</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((s) => (
            <tr key={s.id}>
              <th scope="row">{s.label}</th>
              <td>{statText(s.stat, s.format)}</td>
              <td>
                {s.stat.suppressed ? '<5' : s.stat.n ?? 0} {s.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableDetails>
  );
}

/** Hold latency: how fast players pressed HOLD (single series, bar length relative to the largest bucket). */
export function HoldChart({ buckets }: { buckets: AnalyticsReport['holdLatency'] }) {
  const max = Math.max(1, ...buckets.map((b) => b.n ?? 0));
  return (
    <div className="portal-hold">
      {buckets.map((b) => (
        <div key={b.bucket} className="portal-barrow portal-barrow--wide">
          <span className="portal-barrow__name">{b.label}</span>
          <Bar share={b.n === null ? null : b.n / max} className={b.bucket === 'late' ? 'portal-viz--muted' : 'portal-viz--1'} />
          <span className="portal-barrow__value">{b.n === null ? <abbr title={SUPPRESSED_TEXT}>&lt;5</abbr> : b.n}</span>
        </div>
      ))}
    </div>
  );
}

export function TableDetails({ children }: { children: ReactNode }) {
  return (
    <details className="portal-tabledetails">
      <summary>Show as a table</summary>
      <div className="portal-tablewrap" tabIndex={0} role="region" aria-label="Data table">
        {children}
      </div>
    </details>
  );
}

export { statText };
