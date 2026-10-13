// "Pitch a mission idea": the youth Moment Card template (GDD §7.4). Chip-first, fictional only,
// never about the young person's own experience. The personal-data guard runs live on the device
// (the same rules the server applies) and the card cannot be sent until flagged text is removed.

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { BANDS, DISTRICTS, SQUAD_TOTEMS, TACTICS, type BandId, type DistrictId, type SquadTotemId, type TacticId } from '@shieldquest/shared';
import { useSettings } from '../state/settings';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { StatusBadge } from '../ui/StatusBadge';
import { PortalError, api } from './api';
import {
  PITCH_LIMITS,
  PITCH_PUSHERS,
  PITCH_RECOVERY_MOVES,
  PITCH_RED_FLAGS,
  PITCH_SAFER_MOVES,
  checkPitch,
  pitchTextProblems,
  settingById,
  settingsForDistrict,
  type PitchField,
  type PitchInput,
  type PitchProblem,
  type PitchPusherId,
  type PitchRecoveryId,
  type PitchRedFlagId,
  type PitchSaferMoveId,
  type SubmissionConfig,
  type SubmissionCreated,
} from './model';
import { ChipGroup, Note } from './parts';
import { StatusCheck } from './StatusCheck';

interface Draft {
  band: BandId[];
  district: DistrictId[];
  setting: string[];
  pusher: PitchPusherId[];
  tactics: TacticId[];
  say: string;
  flags: PitchRedFlagId[];
  flagText: string;
  safer: PitchSaferMoveId[];
  saferText: string;
  recovery: PitchRecoveryId[];
  totem: SquadTotemId[];
  makerCode: string;
  fictional: boolean;
  shareOk: boolean;
}

const EMPTY: Draft = {
  band: [],
  district: [],
  setting: [],
  pusher: [],
  tactics: [],
  say: '',
  flags: [],
  flagText: '',
  safer: [],
  saferText: '',
  recovery: [],
  totem: [],
  makerCode: '',
  fictional: false,
  shareOk: false,
};

const DRAFT_KEY = 'sq.portal.pitch.v1';

function loadDraft(band: BandId | null): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>), fictional: false, shareOk: false };
  } catch {
    // Storage blocked: start fresh.
  }
  return { ...EMPTY, band: band ? [band] : [] };
}

function toInput(d: Draft): PitchInput | null {
  const band = d.band[0];
  const district = d.district[0];
  const setting = d.setting[0];
  if (!band || !district || !setting) return null;
  const input: PitchInput = {
    band,
    district,
    setting,
    pressureTactics: d.tactics,
    whatTheySay: d.say,
    redFlags: { chips: d.flags, ...(d.flagText.trim() ? { text: d.flagText } : {}) },
    saferMove: { ...(d.safer[0] ? { chip: d.safer[0] } : {}), ...(d.saferText.trim() ? { text: d.saferText } : {}) },
    consent: true,
  };
  if (d.pusher[0]) input.pusher = d.pusher[0];
  if (d.recovery[0]) input.recoveryMove = d.recovery[0];
  if (d.totem[0]) input.totem = d.totem[0];
  if (d.makerCode.trim()) input.makerCode = d.makerCode.trim();
  return input;
}

function FieldProblems({ problems, id }: { problems: PitchProblem[]; id: string }) {
  return (
    <div id={id} className="portal-guard" aria-live="polite">
      {problems.map((p, i) => (
        <p key={i} className={`portal-guard__item portal-guard__item--${p.level}`}>
          <StatusBadge status={p.level === 'error' ? 'risk' : 'attention'} label={p.level === 'error' ? 'Remove' : 'Tip'} />
          <span>{p.message}</span>
        </p>
      ))}
    </div>
  );
}

function TextField({
  label,
  hint,
  value,
  onChange,
  max,
  field,
  multiline,
  invalid,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  field: PitchField;
  multiline?: boolean;
  invalid?: boolean;
}) {
  const id = useId();
  const hintId = useId();
  const guardId = useId();
  const problems = useMemo(() => (value.trim() ? pitchTextProblems(value, field) : []), [value, field]);
  const blocked = problems.some((p) => p.level === 'error');
  const over = value.length > max;
  const common = {
    id,
    value,
    maxLength: max + 40,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    'aria-describedby': `${hint ? hintId : ''} ${guardId}`.trim(),
    'aria-invalid': blocked || over || invalid ? true : undefined,
    spellCheck: true,
    autoComplete: 'off',
  } as const;
  return (
    <div className={`portal-input${blocked || over || invalid ? ' is-invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p id={hintId} className="portal-field__hint">
          {hint}
        </p>
      )}
      {multiline ? <textarea rows={3} {...common} /> : <input {...common} />}
      <p className={`portal-counter${over ? ' is-over' : ''}`} aria-hidden={!over}>
        {value.length} / {max}
      </p>
      <FieldProblems problems={problems} id={guardId} />
      {!problems.some((p) => p.level === 'error') && value.trim().length > 0 && (
        <p className="portal-guard__ok">
          <StatusBadge status="safe" label="No personal details spotted" />
        </p>
      )}
    </div>
  );
}

/** A live preview of the card, in the same paper style the moderators see. */
function CardPreview({ d }: { d: Draft }) {
  const setting = d.setting[0] ? settingById(d.setting[0]) : undefined;
  const district = DISTRICTS.find((x) => x.id === d.district[0]);
  const pusher = PITCH_PUSHERS.find((p) => p.id === d.pusher[0]);
  return (
    <aside className="portal-moment" aria-label="Preview of your Moment Card">
      <p className="portal-moment__kicker">
        <Icon name="spark" /> Moment Card preview
      </p>
      <p className="portal-moment__where">
        {district && <span className="portal-dot" style={{ background: district.color }} aria-hidden="true" />}
        {district?.name ?? 'Pick a district'}
        {setting ? ` · ${setting.label}` : ''}
      </p>
      <p className="portal-moment__who">{pusher ? `${pusher.label} says:` : 'Someone says:'}</p>
      <blockquote className="portal-moment__quote">{d.say.trim() || 'What do they say or send?'}</blockquote>
      {d.tactics.length > 0 && (
        <ul className="portal-tags" aria-label="Pressure tricks">
          {d.tactics.map((t) => (
            <li key={t}>{TACTICS.find((x) => x.id === t)?.ringLabel}</li>
          ))}
        </ul>
      )}
      <dl className="portal-moment__list">
        <dt>Warning signs</dt>
        <dd>
          {d.flags.length || d.flagText.trim()
            ? [...d.flags.map((f) => PITCH_RED_FLAGS.find((x) => x.id === f)?.label), d.flagText.trim() || null].filter(Boolean).join(' · ')
            : '…'}
        </dd>
        <dt>Safer move</dt>
        <dd>{d.saferText.trim() || PITCH_SAFER_MOVES.find((x) => x.id === d.safer[0])?.label || '…'}</dd>
        {d.recovery[0] && (
          <>
            <dt>If it already happened</dt>
            <dd>{PITCH_RECOVERY_MOVES.find((x) => x.id === d.recovery[0])?.label}</dd>
          </>
        )}
      </dl>
      <p className="portal-moment__credit">
        {d.totem[0] ? `Squad ${SQUAD_TOTEMS.find((t) => t.id === d.totem[0])?.name}` : 'A youth squad'} · fictional moment
      </p>
    </aside>
  );
}

export function PitchForm({ onBack }: { onBack: () => void }) {
  const settingsBand = useSettings((s) => s.band);
  const [d, setD] = useState<Draft>(() => loadDraft(settingsBand));
  const [config, setConfig] = useState<SubmissionConfig>({ makerCodeRequired: false });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<SubmissionCreated | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const makerId = useId();

  useEffect(() => {
    api<SubmissionConfig>('/api/submissions/config', { timeoutMs: 6000 })
      .then(setConfig)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    try {
      const { fictional: _f, shareOk: _s, makerCode: _m, ...keep } = d;
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(keep));
    } catch {
      // Storage blocked: the draft only lives on this page.
    }
  }, [d]);

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));

  const settingOptions = d.district[0] ? settingsForDistrict(d.district[0]) : [];
  // Changing district clears a setting that no longer fits it.
  useEffect(() => {
    if (d.setting[0] && d.district[0] && !settingsForDistrict(d.district[0]).some((s) => s.id === d.setting[0])) set('setting', []);
  }, [d.district, d.setting]);

  const input = toInput(d);
  const problems = input ? checkPitch(input) : [];
  const missing: string[] = [];
  if (!d.band[0]) missing.push('who the mission is for');
  if (!d.district[0]) missing.push('a district');
  if (!d.setting[0]) missing.push('where it happens');
  if (!d.tactics.length) missing.push('at least one pressure trick');
  if (d.say.trim().length < 8) missing.push('what they say');
  if (!d.flags.length) missing.push('at least one warning sign');
  if (!d.safer[0] && !d.saferText.trim()) missing.push('a safer move');
  if (!d.fictional || !d.shareOk) missing.push('the two ticks at the end');
  if (config.makerCodeRequired && !d.makerCode.trim()) missing.push('the maker code');
  const blocking = problems.filter((p) => p.level === 'error' && p.field !== 'form');
  const ready = missing.length === 0 && blocking.length === 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setServerError(null);
    if (!ready || !input) {
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setBusy(true);
    try {
      const res = await api<SubmissionCreated>('/api/submissions', { body: input });
      setDone(res);
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
    } catch (err) {
      setServerError(err instanceof PortalError ? err.message : 'Sending did not work. Try again.');
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <section className="portal-thanks" aria-labelledby="portal-thanks-title">
        <div className="portal-thanks__burst" aria-hidden="true">
          <Icon name="spark" size="3rem" />
        </div>
        <h1 id="portal-thanks-title" ref={doneRef} tabIndex={-1}>
          Your idea is in the queue
        </h1>
        <p className="portal-lead">
          An educator reads every Moment Card. If it is picked, the ShieldQuest team builds it into a mission and checks it
          twice before anyone plays it. Mission ideas are released in batches between pilots.
        </p>
        <div className="portal-ticket">
          <p className="portal-ticket__label">Your ticket code</p>
          <p className="portal-ticket__code" aria-label={`Ticket code ${done.ticket.split('').join(' ')}`}>
            {done.ticket}
          </p>
          <CopyButton text={done.ticket} />
          <p className="portal-fine">Write it down or keep it somewhere safe. It is the only way to check on your idea.</p>
        </div>
        {done.warnings.length > 0 && (
          <Note status="attention">
            <p>A tip for next time: {done.warnings[0]}</p>
          </Note>
        )}
        <StatusCheck initialTicket={done.ticket} headingLevel={2} />
        <div className="portal-actions">
          <Button
            icon="spark"
            onClick={() => {
              setD({ ...EMPTY, band: d.band });
              setDone(null);
              setTried(false);
            }}
          >
            Pitch another idea
          </Button>
          <Button variant="secondary" onClick={onBack}>
            Back to the portal
          </Button>
        </div>
      </section>
    );
  }

  const tacticOptions = TACTICS.map((t) => ({ id: t.id, label: t.ringLabel, hint: t.name }));

  return (
    <form className="portal-pitch" onSubmit={(e) => void submit(e)} noValidate>
      <div className="portal-pitch__intro">
        <p className="kicker">Moment Cards</p>
        <h1 tabIndex={-1}>Pitch a mission idea</h1>
        <p className="portal-lead">
          Imagine a moment where someone pushes a character in ShieldQuest City towards a scam or a risky dare. Build it from the chips
          below. The best ideas become real ShieldQuest missions.
        </p>
        <Note status="unknown">
          <p>
            <b>Fictional only, no real people or places.</b> Make everything up: names, apps, shops and schools. Please
            don't write about anything that happened to you or someone you know.
          </p>
        </Note>
      </div>

      <div className="portal-pitch__grid">
        <div className="portal-pitch__steps">
          <ChipGroup
            step={1}
            legend="Which players is it for?"
            options={BANDS.map((b) => ({ id: b.id, label: b.label, hint: `ages ${b.ages}` }))}
            value={d.band}
            onChange={(v) => set('band', v)}
            invalid={tried && !d.band[0]}
          />
          <ChipGroup
            step={2}
            legend="Where in the city?"
            options={DISTRICTS.map((x) => ({ id: x.id, label: x.name, swatch: x.color, hint: x.comingSoon ? 'new district' : undefined }))}
            value={d.district}
            onChange={(v) => set('district', v)}
            invalid={tried && !d.district[0]}
          />
          {settingOptions.length > 0 && (
            <ChipGroup
              legend="And the setting?"
              options={settingOptions.map((s) => ({ id: s.id, label: s.label }))}
              value={d.setting}
              onChange={(v) => set('setting', v)}
              invalid={tried && !d.setting[0]}
            />
          )}
          <ChipGroup
            step={3}
            legend="Who is pushing?"
            hint="A role only, never a real person."
            options={PITCH_PUSHERS.map((p) => ({ id: p.id, label: p.label }))}
            value={d.pusher}
            onChange={(v) => set('pusher', v)}
            clearable
          />
          <ChipGroup
            step={4}
            legend="Which pressure tricks do they use?"
            hint="Pick up to 3."
            options={tacticOptions}
            value={d.tactics}
            onChange={(v) => set('tactics', v)}
            multiple
            max={PITCH_LIMITS.tactics}
            invalid={tried && !d.tactics.length}
          />
          <fieldset className="portal-field">
            <legend className="portal-field__legend">
              <span className="portal-step">5</span>
              <span>What do they say or send?</span>
            </legend>
            <TextField
              label="Their message, offer or dare"
              hint="Make up any names, apps or prices. Use 8XXX XXXX for phone numbers and .example for links."
              value={d.say}
              onChange={(v) => set('say', v)}
              max={PITCH_LIMITS.whatTheySay}
              field="whatTheySay"
              multiline
              invalid={tried && d.say.trim().length < 8}
            />
          </fieldset>
          <ChipGroup
            step={6}
            legend="Which warning signs should players spot?"
            hint="Pick up to 3."
            options={PITCH_RED_FLAGS.map((f) => ({ id: f.id, label: f.label }))}
            value={d.flags}
            onChange={(v) => set('flags', v)}
            multiple
            max={PITCH_LIMITS.redFlags}
            invalid={tried && !d.flags.length}
          />
          <TextField
            label="Another warning sign (optional)"
            value={d.flagText}
            onChange={(v) => set('flagText', v)}
            max={PITCH_LIMITS.short}
            field="redFlags.text"
          />
          <ChipGroup
            step={7}
            legend="What is the safer move?"
            hint="Pick one, or write your own below."
            options={PITCH_SAFER_MOVES.map((m) => ({ id: m.id, label: m.label }))}
            value={d.safer}
            onChange={(v) => set('safer', v)}
            clearable
            invalid={tried && !d.safer[0] && !d.saferText.trim()}
          />
          <TextField
            label="Or in your own words (optional)"
            value={d.saferText}
            onChange={(v) => set('saferText', v)}
            max={PITCH_LIMITS.short}
            field="saferMove.text"
          />
          <ChipGroup
            step={8}
            legend="If it already happened, what helps? (optional)"
            options={PITCH_RECOVERY_MOVES.map((m) => ({ id: m.id, label: m.label }))}
            value={d.recovery}
            onChange={(v) => set('recovery', v)}
            clearable
          />
          <ChipGroup
            step={9}
            legend="Credit your squad (optional)"
            hint="Published missions say “Made by youths in a ShieldQuest session” with your squad totem. Never a name."
            options={SQUAD_TOTEMS.map((t) => ({ id: t.id, label: `Squad ${t.name}`, swatch: t.color }))}
            value={d.totem}
            onChange={(v) => set('totem', v)}
            clearable
          />
          <div className={`portal-input${tried && config.makerCodeRequired && !d.makerCode.trim() ? ' is-invalid' : ''}`}>
            <label htmlFor={makerId}>
              Maker code {config.makerCodeRequired ? '' : <span className="portal-muted">(optional)</span>}
            </label>
            <p className="portal-field__hint">It is printed on the take-home card from your session, e.g. MK-7K2Q9H.</p>
            <input
              id={makerId}
              value={d.makerCode}
              onChange={(e) => set('makerCode', e.target.value.toUpperCase().slice(0, 12))}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="portal-input--code"
            />
          </div>

          <fieldset className="portal-field">
            <legend className="portal-field__legend">
              <span className="portal-step">10</span>
              <span>Before you send</span>
            </legend>
            <label className={`portal-check${tried && !d.fictional ? ' is-invalid' : ''}`}>
              <input type="checkbox" checked={d.fictional} onChange={(e) => set('fictional', e.target.checked)} />
              <span>This moment is made up. It has no real names, numbers, schools or places.</span>
            </label>
            <label className={`portal-check${tried && !d.shareOk ? ' is-invalid' : ''}`}>
              <input type="checkbox" checked={d.shareOk} onChange={(e) => set('shareOk', e.target.checked)} />
              <span>I'm happy for educators to read it and for the ShieldQuest team to turn it into a mission.</span>
            </label>
          </fieldset>
        </div>

        <div className="portal-pitch__side">
          <CardPreview d={d} />
        </div>
      </div>

      <div ref={errorRef} tabIndex={-1} className="portal-pitch__summary" aria-live="polite">
        {serverError && <Note status="risk">{serverError}</Note>}
        {tried && !ready && (
          <Note status="attention">
            {blocking.length > 0 && <p>Please remove the flagged personal details first.</p>}
            {missing.length > 0 && <p>Still needed: {missing.join(', ')}.</p>}
          </Note>
        )}
      </div>
      <div className="portal-actions portal-actions--sticky">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" icon="spark" disabled={busy} aria-disabled={!ready || undefined}>
          {busy ? 'Sending…' : 'Send my idea'}
        </Button>
      </div>
    </form>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        icon={copied ? 'check' : 'text'}
        onClick={() => {
          void navigator.clipboard
            ?.writeText(text)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
      <span className="sr-only" role="status">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </>
  );
}
