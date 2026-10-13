import { useMemo, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import {
  BANDS,
  SQUAD_LIMITS,
  defaultSessionOptions,
  districtById,
  type ApiError,
  type BandId,
  type CreateSessionRequest,
  type CreateSessionResponse,
} from '@shieldquest/shared';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { useDocumentTitle } from '../hooks';
import { missionsForSession, playlistMinutes, timingSummary } from '../logic';
import { Disclaimer } from '../parts';
import { saveHostKey } from '../socket';
import { ConductorHeader } from './ConductorHeader';
import { ProbeCheck } from './ProbeCheck';

const SCAFFOLD_LABEL = { guided: 'Guided', light: 'Light', wildcard: 'Wildcard Sprint' } as const;

/** A sensible default playlist: one Guided, one Light, one Wildcard (skipping the practice poster). */
function defaultPlaylist(band: BandId): string[] {
  const list = missionsForSession(band).filter((m) => m.id !== 'first-hold');
  const pick: string[] = [];
  for (const s of ['guided', 'light', 'wildcard'] as const) {
    const m = list.find((x) => x.scaffold === s && !pick.includes(x.id));
    if (m) pick.push(m.id);
  }
  return pick.slice(0, 3);
}

/** /host — create a squad session: band, 1-3 missions, squads, comfort options. */
export function CreateSession({ invalidCode }: { invalidCode?: string } = {}) {
  const [, navigate] = useLocation();
  const [band, setBand] = useState<BandId>('teen');
  const [missionIds, setMissionIds] = useState<string[]>(() => defaultPlaylist('teen'));
  const [squadCount, setSquadCount] = useState<number | null>(null);
  const [opts, setOpts] = useState(() => defaultSessionOptions('teen'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle('Conductor · New session');

  const missions = useMemo(() => missionsForSession(band), [band]);
  const minutes = playlistMinutes(missionIds);

  const changeBand = (b: BandId) => {
    setBand(b);
    setMissionIds(defaultPlaylist(b));
    setOpts((o) => ({ ...o, discreet: defaultSessionOptions(b).discreet }));
  };

  const toggleMission = (id: string) => {
    setMissionIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= 3 ? ids : [...ids, id]));
  };
  const move = (id: string, dir: -1 | 1) => {
    setMissionIds((ids) => {
      const i = ids.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ids.length) return ids;
      const next = [...ids];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (missionIds.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    const body: CreateSessionRequest = { band, missionIds, ...opts, ...(squadCount ? { squadCount } : {}) };
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      });
      if (res.status === 429) throw new Error('Too many new sessions from this network. Wait a minute and try again.');
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as ApiError | null;
        throw new Error(err?.error === 'busy' ? 'The server is busy right now. Try again in a moment.' : (err?.message ?? 'The session could not be created.'));
      }
      const created = (await res.json()) as CreateSessionResponse;
      saveHostKey(created.code, created.hostKey);
      navigate(created.hostPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The session could not be created.');
      setBusy(false);
    }
  };

  const toggle = (key: keyof typeof opts, label: string, hint: string) => (
    <label className="sq-toggle">
      <input type="checkbox" checked={opts[key]} onChange={(e) => setOpts((o) => ({ ...o, [key]: e.target.checked }))} />
      <span className="sq-toggle__text">
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
    </label>
  );

  return (
    <div className="sq-host">
      <ConductorHeader />
      <main id="main" className="sq-create">
        <form onSubmit={submit} className="sq-create__form" aria-labelledby="sq-create-title">
          <h1 id="sq-create-title">Run a squad session</h1>
          {invalidCode && (
            <p className="sq-error" role="alert">
              “{invalidCode.slice(0, 12)}” is not a session code. Codes have 6 letters and numbers. Create a new session below.
            </p>
          )}
          <p className="sq-create__lead">
            Players join on their phones with a QR code. Nobody signs up and no names are collected. You will get a console with
            the join code, and a Big Screen view for the projector.
          </p>

          <fieldset className="sq-fieldset">
            <legend>Who is playing?</legend>
            <div className="sq-choice-row">
              {BANDS.map((b) => (
                <label key={b.id} className="sq-choice">
                  <input type="radio" name="band" checked={band === b.id} onChange={() => changeBand(b.id)} />
                  <span>
                    <strong>{b.label}</strong> <small>{b.ages} · {b.segment}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="sq-fieldset">
            <legend>
              Missions <small>Pick 1 to 3, played in order</small>
            </legend>
            <ul className="sq-missions">
              {missions.map((m) => {
                const on = missionIds.includes(m.id);
                const order = missionIds.indexOf(m.id);
                const d = districtById(m.district);
                return (
                  <li key={m.id} className="sq-missions__item" data-on={on ? '' : undefined}>
                    <label className="sq-missions__pick">
                      <input type="checkbox" checked={on} disabled={!on && missionIds.length >= 3} onChange={() => toggleMission(m.id)} />
                      <span className="sq-missions__body">
                        <span className="sq-missions__title">
                          {on && <span className="sq-missions__order">{order + 1}</span>}
                          {m.title}
                          {m.id === 'first-hold' && <span className="sq-tag">Practice</span>}
                        </span>
                        <span className="sq-missions__meta">
                          {SCAFFOLD_LABEL[m.scaffold]} · {d.name} · Content: {m.theme}
                        </span>
                        <span className="sq-missions__timing">{timingSummary(band, m, opts.relaxed)}</span>
                      </span>
                    </label>
                    {on && missionIds.length > 1 && (
                      <span className="sq-missions__move">
                        <button type="button" className="ui-iconbtn" disabled={order === 0} onClick={() => move(m.id, -1)} aria-label={`Move ${m.title} earlier`}>
                          <Icon name="arrowLeft" style={{ transform: 'rotate(90deg)' }} />
                        </button>
                        <button
                          type="button"
                          className="ui-iconbtn"
                          disabled={order === missionIds.length - 1}
                          onClick={() => move(m.id, 1)}
                          aria-label={`Move ${m.title} later`}
                        >
                          <Icon name="arrowRight" style={{ transform: 'rotate(90deg)' }} />
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="sq-create__plan" role="status">
              {missionIds.length === 0 ? 'Pick at least one mission.' : `About ${minutes} minutes of gameplay, plus Room Freeze and debrief.`}
            </p>
          </fieldset>

          <fieldset className="sq-fieldset">
            <legend>Squads</legend>
            <div className="sq-choice-row">
              <label className="sq-choice">
                <input type="radio" name="squads" checked={squadCount === null} onChange={() => setSquadCount(null)} />
                <span>
                  <strong>Automatic</strong> <small>Fills squads of 5 as players join</small>
                </span>
              </label>
              {Array.from({ length: SQUAD_LIMITS.maxSquads - SQUAD_LIMITS.minSquads + 1 }, (_, i) => i + SQUAD_LIMITS.minSquads).map((n) => (
                <label key={n} className="sq-choice sq-choice--small">
                  <input type="radio" name="squads" checked={squadCount === n} onChange={() => setSquadCount(n)} />
                  <span>
                    <strong>{n}</strong> <small>tables</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="sq-fieldset">
            <legend>Comfort and projector</legend>
            {toggle('gentle', 'Gentle mode', 'No Pressure Surges and no countdown visuals. Surges are always off for 10-13.')}
            {toggle('discreet', 'Discreet projector', 'The Big Screen shows class-level effects only. Default for under-17s.')}
            {toggle('relaxed', 'Relaxed timing', 'Longer Think, Explain, Re-seal and Peer Shield windows (1.5×).')}
            {toggle('calm', 'Calm mode', 'Slower timers and softer pressure audio from the start.')}
            {toggle('autoAdvance', 'Move on when everyone is ready', 'A phase ends early once every connected phone is done.')}
          </fieldset>

          <section className="sq-fieldset sq-fieldset--plain" aria-labelledby="sq-probe-title">
            <h2 id="sq-probe-title" className="sq-legend">
              Network check
            </h2>
            <ProbeCheck />
          </section>

          {error && (
            <p className="sq-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" icon="play" disabled={missionIds.length === 0 || busy}>
            {busy ? 'Creating…' : 'Create session'}
          </Button>
        </form>
        <Disclaimer />
      </main>
    </div>
  );
}
