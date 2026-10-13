// Mission Editor (MVP form of the Scene Composer, GDD §7.4): a JSON editor with live moment-lint,
// built-in missions as templates, save draft, two-person sign-off and publish per band.

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { BANDS, DISTRICTS, MISSIONS, bandById, type BandId, type DistrictId, type LintIssue, type Mission } from '@shieldquest/shared';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { api, getSession, PortalError, rememberInitials } from './api';
import type { CustomList } from './EducatorArea';
import {
  SIGNOFF_LABEL,
  SIGNOFF_ROLES,
  checkMission,
  isInitials,
  normalizeInitials,
  skeletonMission,
  type CustomMissionDetail,
  type MissionCheck,
  type SignoffRole,
} from './model';
import { LintList, Note, formatHour, lintStatus } from './parts';

interface Parsed {
  value: unknown;
  error: { message: string; line: number | null; column: number | null } | null;
}

function parse(text: string): Parsed {
  try {
    return { value: JSON.parse(text) as unknown, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid JSON';
    const pos = /position (\d+)/.exec(msg);
    const lc = /line (\d+) column (\d+)/.exec(msg);
    let line: number | null = lc ? Number(lc[1]) : null;
    let column: number | null = lc ? Number(lc[2]) : null;
    if (!lc && pos) {
      const before = text.slice(0, Number(pos[1]));
      line = before.split('\n').length;
      column = before.length - before.lastIndexOf('\n');
    }
    return { value: null, error: { message: msg.replace(/^JSON\.parse: /, ''), line, column } };
  }
}

const pretty = (m: unknown) => JSON.stringify(m, null, 2);

function templateFrom(m: Mission, taken: Set<string>): Mission {
  let id = `custom-${m.id}`;
  for (let i = 2; taken.has(id); i++) id = `custom-${m.id}-${i}`;
  const copy = JSON.parse(JSON.stringify(m)) as Mission;
  return {
    ...copy,
    id,
    version: 1,
    review: { status: 'draft', reviewers: [], reviewBy: m.review.reviewBy, notes: `Custom copy of the built-in mission "${m.id}".` },
  };
}

export function Editor({ custom, openId, template }: { custom: CustomList; openId: string | null; template: string | null }) {
  const [, navigate] = useLocation();
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const [doc, setDoc] = useState<CustomMissionDetail | null>(null);
  const [check, setCheck] = useState<MissionCheck | null>(null);
  const [serverIssues, setServerIssues] = useState<LintIssue[] | null>(null);
  const [message, setMessage] = useState<{ status: 'safe' | 'risk' | 'attention'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [initials, setInitials] = useState(getSession()?.initials ?? '');
  const [bands, setBands] = useState<BandId[]>([]);
  const [pick, setPick] = useState({ template: MISSIONS[0]?.id ?? '', custom: '', band: 'teen' as BandId, district: 'school-street' as DistrictId });
  const editorId = useId();
  const lintId = useId();
  const initialsId = useId();
  const ids = { tpl: useId(), cus: useId(), band: useId(), dist: useId() };
  const loadedKey = useRef<string | null>(null);

  const dirty = text !== saved;
  const parsed = useMemo(() => (text.trim() ? parse(text) : null), [text]);

  // Live lint, debounced so typing stays smooth on school laptops.
  useEffect(() => {
    if (!parsed || parsed.error) {
      setCheck(null);
      return;
    }
    const t = setTimeout(() => setCheck(checkMission(parsed.value, { custom: true })), 250);
    return () => clearTimeout(t);
  }, [parsed]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const loadText = (next: string, d: CustomMissionDetail | null, asSaved: boolean) => {
    setText(next);
    setSaved(asSaved ? next : '');
    setDoc(d);
    setServerIssues(null);
    setBands(d ? (d.publishedBands.length ? d.publishedBands : d.bands) : []);
  };

  // Deep links: ?id= opens a custom mission, ?template= copies a built-in one.
  useEffect(() => {
    const key = `${openId ?? ''}|${template ?? ''}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    if (openId) {
      setBusy(true);
      api<CustomMissionDetail>(`/api/missions/custom/${encodeURIComponent(openId)}`, { auth: true })
        .then((d) => {
          loadText(pretty(d.mission), d, true);
          setMessage(null);
        })
        .catch((e: unknown) => setMessage({ status: 'risk', text: e instanceof PortalError ? e.message : 'Could not open that mission.' }))
        .finally(() => setBusy(false));
    } else if (template) {
      const m = MISSIONS.find((x) => x.id === template);
      if (m) {
        loadText(pretty(templateFrom(m, new Set(custom.missions.map((c) => c.id)))), null, false);
        setMessage({ status: 'attention', text: `Copied "${m.title}". Change the id and content, then save it as a draft.` });
      }
    }
  }, [openId, template, custom.missions]);

  const confirmDiscard = () => !dirty || window.confirm('You have unsaved changes. Discard them?');

  const replaceUrl = (id: string | null) => navigate(id ? `/portal?tab=editor&id=${encodeURIComponent(id)}` : '/portal?tab=editor', { replace: true });

  const mission = check?.mission ?? null;
  const missionId = mission?.id ?? (parsed?.value && typeof parsed.value === 'object' ? String((parsed.value as { id?: unknown }).id ?? '') : '');
  const updating = !!doc && missionId === doc.id;

  const save = async () => {
    if (!parsed || parsed.error) {
      setMessage({ status: 'risk', text: 'Fix the JSON syntax error first.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    setServerIssues(null);
    try {
      const d = updating && doc
        ? await api<CustomMissionDetail>(`/api/missions/custom/${encodeURIComponent(doc.id)}`, { method: 'PUT', body: { mission: parsed.value }, auth: true })
        : await api<CustomMissionDetail>('/api/missions/custom', { body: { mission: parsed.value }, auth: true });
      loadText(pretty(d.mission), d, true);
      loadedKey.current = `${d.id}|`;
      replaceUrl(d.id);
      setMessage({
        status: d.lint.errors ? 'attention' : 'safe',
        text: d.lint.errors
          ? `Saved as a draft (version ${d.version}). Fix the ${d.lint.errors} error${d.lint.errors === 1 ? '' : 's'} before review.`
          : `Saved (version ${d.version}). Ready for two sign-offs.`,
      });
      void custom.reload();
    } catch (e) {
      if (e instanceof PortalError) {
        setMessage({ status: 'risk', text: e.message });
        if (e.issues.length) setServerIssues(e.issues);
      } else setMessage({ status: 'risk', text: 'Saving did not work. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const act = async (path: string, body: unknown, done: (d: CustomMissionDetail) => string) => {
    if (!doc) return;
    setBusy(true);
    setMessage(null);
    try {
      const d = await api<CustomMissionDetail>(`/api/missions/custom/${encodeURIComponent(doc.id)}/${path}`, { body, auth: true });
      loadText(pretty(d.mission), d, true);
      setMessage({ status: 'safe', text: done(d) });
      void custom.reload();
    } catch (e) {
      setMessage({ status: 'risk', text: e instanceof PortalError ? e.message : 'That did not work. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const signoff = (role: SignoffRole) => {
    const ini = normalizeInitials(initials);
    if (!isInitials(ini)) {
      setMessage({ status: 'risk', text: 'Add your initials (1-4 letters, e.g. FT) to sign off. Never a full name.' });
      return;
    }
    rememberInitials(ini);
    void act('signoff', { initials: ini, role }, (d) =>
      d.status === 'reviewed' ? 'Both checks are signed. The mission can be published.' : `Signed: ${SIGNOFF_LABEL[role]}. A second person signs the other check.`,
    );
  };

  const status = check ? lintStatus(check.errors, check.warnings) : null;
  const signed = (role: SignoffRole) => doc?.signoffs.find((s) => s.role === role && s.version === doc.version);
  const bothSigned = !!doc && SIGNOFF_ROLES.every((r) => signed(r));
  const canSign = !!doc && !dirty && (check?.errors ?? 1) === 0;
  const signBlock = !doc
    ? 'Save the mission first.'
    : dirty
      ? 'Save your changes first. Sign-offs apply to a saved version.'
      : (check?.errors ?? 0) > 0
        ? 'Fix every error first.'
        : null;
  const issues = serverIssues ?? check?.issues ?? [];

  return (
    <div className="portal-editor">
      <header className="portal-section-head">
        <div>
          <p className="kicker">Editor</p>
          <h1 tabIndex={-1}>{doc ? doc.title : mission?.title ?? 'Mission editor'}</h1>
          <p className="portal-muted">
            {doc ? (
              <>
                <code>{doc.id}</code> · version {doc.version} · saved {formatHour(doc.updatedAt)}
                {doc.publishedVersion !== null && ` · v${doc.publishedVersion} live for ${doc.publishedBands.map((b) => bandById(b).label).join(', ')}`}
              </>
            ) : (
              'Write or paste a mission as JSON. Moment-lint checks it as you type; the server checks it again on save.'
            )}
          </p>
        </div>
      </header>

      <details className="portal-card portal-open" open={!text}>
        <summary>
          <h2 className="portal-card__title">Start or open a mission</h2>
        </summary>
        <div className="portal-open__grid">
          <form
            className="portal-inline"
            onSubmit={(e) => {
              e.preventDefault();
              if (!confirmDiscard()) return;
              navigate(`/portal?tab=editor&template=${encodeURIComponent(pick.template)}`);
              loadedKey.current = null;
            }}
          >
            <div className="portal-input">
              <label htmlFor={ids.tpl}>Copy a built-in mission</label>
              <select id={ids.tpl} value={pick.template} onChange={(e) => setPick({ ...pick, template: e.target.value })}>
                {MISSIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.bands.map((b) => bandById(b).label).join('/')})
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary">
              Use as template
            </Button>
          </form>
          <form
            className="portal-inline"
            onSubmit={(e) => {
              e.preventDefault();
              if (!pick.custom || !confirmDiscard()) return;
              navigate(`/portal?tab=editor&id=${encodeURIComponent(pick.custom)}`);
            }}
          >
            <div className="portal-input">
              <label htmlFor={ids.cus}>Open a custom mission</label>
              <select id={ids.cus} value={pick.custom} onChange={(e) => setPick({ ...pick, custom: e.target.value })}>
                <option value="">{custom.missions.length ? 'Choose…' : 'No custom missions yet'}</option>
                {custom.missions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.id}){m.archived ? ' · archived' : ''}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary" disabled={!pick.custom}>
              Open
            </Button>
          </form>
          <form
            className="portal-inline"
            onSubmit={(e) => {
              e.preventDefault();
              if (!confirmDiscard()) return;
              const id = `new-${pick.district.split('-')[0]}-${Date.now().toString(36).slice(-5)}`;
              loadText(pretty(skeletonMission({ id, band: pick.band, district: pick.district })), null, false);
              replaceUrl(null);
              setMessage({ status: 'attention', text: 'Blank skeleton loaded. Replace every TODO, set the id, then save.' });
            }}
          >
            <div className="portal-input">
              <label htmlFor={ids.band}>Blank skeleton: band</label>
              <select id={ids.band} value={pick.band} onChange={(e) => setPick({ ...pick, band: e.target.value as BandId })}>
                {BANDS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} ({b.ages})
                  </option>
                ))}
              </select>
            </div>
            <div className="portal-input">
              <label htmlFor={ids.dist}>District</label>
              <select id={ids.dist} value={pick.district} onChange={(e) => setPick({ ...pick, district: e.target.value as DistrictId })}>
                {DISTRICTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary">
              Start blank
            </Button>
          </form>
        </div>
      </details>

      <div className="portal-editor__grid">
        <section className="portal-editor__code" aria-label="Mission JSON">
          <div className="portal-editor__toolbar">
            <label htmlFor={editorId} className="portal-editor__label">
              Mission JSON {dirty && <span className="portal-pill">Unsaved</span>}
            </label>
            <div className="portal-actions">
              <Button
                size="sm"
                variant="ghost"
                disabled={!parsed || !!parsed.error}
                onClick={() => parsed && !parsed.error && setText(pretty(parsed.value))}
              >
                Format
              </Button>
              <Button size="sm" icon="check" onClick={() => void save()} disabled={busy || !text.trim()}>
                {updating ? 'Save changes' : doc ? 'Save as new mission' : 'Save draft'}
              </Button>
            </div>
          </div>
          <textarea
            id={editorId}
            className="portal-code"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            wrap="off"
            aria-describedby={lintId}
            placeholder='{ "id": "my-mission", "title": "…" }'
          />
          {parsed?.error && (
            <Note status="risk">
              JSON syntax error{parsed.error.line ? ` at line ${parsed.error.line}, column ${parsed.error.column}` : ''}:{' '}
              {parsed.error.message}
            </Note>
          )}
        </section>

        <aside className="portal-editor__side">
          <div aria-live="polite" className="portal-editor__message">
            {message && <Note status={message.status}>{message.text}</Note>}
          </div>

          <section className="portal-card" aria-labelledby={`${lintId}-h`} id={lintId}>
            <h2 className="portal-card__title" id={`${lintId}-h`}>
              Moment-lint {status && <StatusBadge status={status.status} label={status.label} />}
            </h2>
            {!text.trim() ? (
              <p className="portal-muted">Load a template or paste a mission to check it.</p>
            ) : parsed?.error ? (
              <p className="portal-muted">Waiting for valid JSON.</p>
            ) : (
              <>
                {serverIssues && <p className="portal-muted">Results from the server's last check:</p>}
                <LintList issues={issues} empty="No problems found. A human review is still required." />
              </>
            )}
          </section>

          <section className="portal-card" aria-labelledby="portal-review-h">
            <h2 className="portal-card__title" id="portal-review-h">
              Two sign-offs
            </h2>
            <p className="portal-muted">Two different people sign each version. Any edit clears both.</p>
            <div className="portal-input">
              <label htmlFor={initialsId}>Your initials</label>
              <input
                id={initialsId}
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 4))}
                maxLength={4}
                autoComplete="off"
                className="portal-input--short"
              />
            </div>
            <ul className="portal-signoffs">
              {SIGNOFF_ROLES.map((role) => {
                const s = signed(role);
                return (
                  <li key={role}>
                    <StatusBadge status={s ? 'safe' : 'unknown'} label={s ? `Signed by ${s.initials}` : 'Not signed'} />
                    <span className="portal-signoffs__role">{SIGNOFF_LABEL[role]}</span>
                    {!s && (
                      <Button size="sm" variant="secondary" disabled={!canSign || busy} onClick={() => signoff(role)}>
                        Sign off
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            {signBlock && <p className="portal-fine">{signBlock}</p>}
          </section>

          <section className="portal-card" aria-labelledby="portal-publish-h">
            <h2 className="portal-card__title" id="portal-publish-h">
              Publish
            </h2>
            {doc ? (
              <>
                <fieldset className="portal-field portal-field--plain">
                  <legend className="portal-field__legend">Bands to publish</legend>
                  <div className="portal-chips">
                    {doc.bands.map((b) => (
                      <label key={b} className="portal-chip">
                        <input
                          type="checkbox"
                          checked={bands.includes(b)}
                          onChange={() => setBands(bands.includes(b) ? bands.filter((x) => x !== b) : [...bands, b])}
                        />
                        <span className="portal-chip__face">
                          <span className="portal-chip__text">{bandById(b).label}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="portal-actions">
                  <Button
                    icon="spark"
                    disabled={busy || dirty || !bothSigned || !bands.length || (check?.errors ?? 1) > 0}
                    onClick={() => void act('publish', { bands }, (d) => `Published version ${d.version} for ${d.publishedBands.map((b) => bandById(b).label).join(', ')}.`)}
                  >
                    Publish
                  </Button>
                  {doc.publishedVersion !== null && (
                    <Button variant="secondary" disabled={busy} onClick={() => void act('unpublish', {}, () => 'Unpublished. Players no longer get this mission.')}>
                      Unpublish
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    disabled={busy || (!doc.archived && doc.publishedVersion !== null)}
                    onClick={() => void act('archive', { archived: !doc.archived }, (d) => (d.archived ? 'Archived.' : 'Restored from the archive.'))}
                  >
                    {doc.archived ? 'Restore' : 'Archive'}
                  </Button>
                </div>
                {!bothSigned && <p className="portal-fine">Publishing needs both sign-offs on this version.</p>}
                {doc.history.length > 0 && (
                  <p className="portal-fine">
                    {doc.history.length} earlier version{doc.history.length === 1 ? ' is' : 's are'} kept on the server.
                  </p>
                )}
              </>
            ) : (
              <p className="portal-muted">Save the mission as a draft first.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
