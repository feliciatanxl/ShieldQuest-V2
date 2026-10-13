import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../ui/Button';
import { applySaveCard, loadSaveCard, type LoadError, type LoadResult } from '../../state/saveCard';

/** The four words as big numbered tiles (numbers help when writing them down in order). */
export function CodeTiles({ code }: { code: string }) {
  const words = code.split('-');
  return (
    <div className="sv-code">
      <ol className="sv-tiles" aria-label={`Your Save Card words: ${words.join(', ')}`}>
        {words.map((w, i) => (
          <li key={i} className="sv-tile" style={{ animationDelay: `calc(var(--dur) * ${i * 0.4})` }}>
            <span className="sv-tile__n" aria-hidden="true">
              {i + 1}
            </span>
            <span className="sv-tile__w">{w}</span>
          </li>
        ))}
      </ol>
      <p className="sv-code__line" aria-hidden="true">
        {code}
      </p>
    </div>
  );
}

/** QR code drawn on the device (the encoder downloads only when a card is shown). */
export function SaveQr({ text, size = 184 }: { text: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import('qrcode')
      .then(({ toDataURL }) =>
        toDataURL(text, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: size * 2,
          color: { dark: '#1d2440', light: '#ffffff' },
        }),
      )
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [text, size]);
  return (
    <div className="sv-qr" style={{ width: size, height: size }}>
      {url ? (
        <img src={url} width={size} height={size} alt="QR code. Scan it on another device to load this Save Card." />
      ) : (
        <span className="sv-qr__wait" aria-hidden="true" />
      )}
    </div>
  );
}

export function loadErrorText(e: LoadError): string {
  switch (e.reason) {
    case 'empty':
      return 'Type your 4 Save Card words.';
    case 'count':
      return `A Save Card has 4 words. We found ${e.count}.`;
    case 'unknown':
      return `"${e.word}" is not a Save Card word.${e.suggestions.length ? ` Did you mean ${e.suggestions.join(' or ')}?` : ' Check the spelling.'}`;
    case 'not-found':
      return 'No Save Card has those words. Check each word and try again.';
    case 'wrong-code':
      return 'Those words did not unlock the card. Check the spelling.';
    case 'offline':
      return 'You are offline. Connect to the internet and try again.';
    case 'slow-down':
      return 'Too many tries. Wait a minute, then try again.';
    case 'unsupported':
      return 'This browser cannot open that card. Try updating it.';
    default:
      return 'Something went wrong. Try again soon.';
  }
}

type Found = Extract<LoadResult, { ok: true }>;

/** "Found it" step: shows whose card it is and asks before replacing this device's progress. */
export function ConfirmLoad({ found, onCancel }: { found: Found; onCancel: () => void }) {
  const headRef = useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => headRef.current?.focus(), []);
  const p = found.preview;
  const facts = [
    p.missions !== null ? `${p.missions} mission${p.missions === 1 ? '' : 's'}` : null,
    p.stars !== null ? `${p.stars} Stars` : null,
    p.savedAt ? `saved ${new Date(p.savedAt).toLocaleDateString()}` : null,
  ].filter(Boolean);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      await applySaveCard(found);
    } catch {
      setBusy(false);
      setError('This device could not store the progress. Free up some space or try another browser.');
    }
  };

  return (
    <div className="sv-confirm">
      <h3 ref={headRef} tabIndex={-1}>
        Found it!
      </h3>
      <p className="sv-found">
        <strong>{p.handle ?? 'Your city'}</strong>
        {facts.length > 0 && <span> · {facts.join(' · ')}</span>}
      </p>
      <p className="sv-warn" role="note">
        This replaces progress on this device.
      </p>
      {error && (
        <p className="sv-error" role="alert">
          {error}
        </p>
      )}
      <div className="sv-actions">
        <Button onClick={load} disabled={busy} aria-busy={busy}>
          {busy ? 'Loading…' : 'Load it'}
        </Button>
        <Button variant="secondary" className="sv-btn-ink" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Four-word input with clear errors. Downloads and decrypts the card, then hands over to ConfirmLoad. */
export function LoadForm({ initial = '', autoStart = false }: { initial?: string; autoStart?: boolean }) {
  const inputId = useId();
  const hintId = useId();
  const errId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const started = useRef(false);

  const find = async (text: string) => {
    setBusy(true);
    setError(null);
    const r = await loadSaveCard(text);
    setBusy(false);
    if (r.ok) {
      setFound(r);
    } else {
      setError(loadErrorText(r));
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  useEffect(() => {
    if (autoStart && initial && !started.current) {
      started.current = true;
      void find(initial);
    }
  }, [autoStart, initial]);

  if (found) {
    return (
      <ConfirmLoad
        found={found}
        onCancel={() => {
          setFound(null);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      />
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy) void find(value);
  };

  return (
    <form className="sv-form" onSubmit={submit} noValidate>
      <label htmlFor={inputId}>Your 4 Save Card words</label>
      <p id={hintId} className="sv-hint">
        Like: TIGER MANGO ROCKET CLOUD
      </p>
      <input
        ref={inputRef}
        id={inputId}
        className="sv-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        maxLength={80}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${hintId} ${errId}` : hintId}
      />
      {error && (
        <p id={errId} className="sv-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="secondary" className="sv-btn-ink" disabled={busy} aria-busy={busy}>
        {busy ? 'Unlocking…' : 'Find my card'}
      </Button>
    </form>
  );
}
