import { useEffect, useState } from 'react';
import type { Effects } from '@shieldquest/shared';
import { StatusShape } from '../../../ui/StatusBadge';
import { formatMoney } from '../runLogic';
import './parts.css';

function useCountUp(target: number, animate: boolean, ms = 900): number {
  const [v, setV] = useState(animate ? 0 : target);
  useEffect(() => {
    if (!animate) {
      setV(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setV(Math.round(target * eased));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, animate, ms]);
  return v;
}

function Scale({ value }: { value: number }) {
  // -3..+3 as seven ticks; the filled run starts at the centre.
  return (
    <span className="msn-dial__scale" aria-hidden="true">
      {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="msn-dial__tick"
          data-centre={i === 0 ? '' : undefined}
          data-on={(value > 0 && i > 0 && i <= value) || (value < 0 && i < 0 && i >= value) ? '' : undefined}
        />
      ))}
    </span>
  );
}

function Coin() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="var(--gold)" stroke="var(--ink)" strokeWidth="1.5" />
      <path d="M12 7v10M9.5 9.5h4a1.6 1.6 0 0 1 0 3.2h-3a1.6 1.6 0 0 0 0 3.2h4" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export interface EffectDialsProps {
  effects: Effects;
  /** Animate values counting up (off under reduced motion). */
  animate?: boolean;
  /** Plain words for the resident, e.g. "Ren". */
  who?: string;
}

/** Wallet / Trust / Risk dials. Each is icon + word + number (+ a −3..+3 scale), never colour alone. */
export function EffectDials({ effects, animate = false, who }: EffectDialsProps) {
  const wallet = useCountUp(effects.wallet ?? 0, animate);
  const trust = effects.trust ?? 0;
  const risk = effects.risk ?? 0;
  const any = effects.wallet !== undefined || effects.trust !== undefined || effects.risk !== undefined;
  if (!any) return null;
  return (
    <dl className="msn-dials">
      {effects.wallet !== undefined && (
        <div className="msn-dial">
          <dt>
            <Coin /> Wallet
          </dt>
          <dd>
            <span className="msn-dial__num" aria-hidden="true">
              {formatMoney(wallet)}
            </span>
            <span className="sr-only">{formatMoney(effects.wallet)}</span>
            <span className="msn-dial__word">in-game money{who ? ` for ${who}` : ''}</span>
          </dd>
        </div>
      )}
      {effects.trust !== undefined && (
        <div className="msn-dial">
          <dt>
            <StatusShape status={trust >= 0 ? 'safe' : 'risk'} size={20} /> Trust
          </dt>
          <dd>
            <span className="msn-dial__num">{trust > 0 ? `+${trust}` : trust < 0 ? `−${Math.abs(trust)}` : '0'}</span>
            <span className="msn-dial__word">{trust > 0 ? 'Lanterns light up' : trust < 0 ? 'Lanterns dim' : 'No change'}</span>
            <Scale value={trust} />
          </dd>
        </div>
      )}
      {effects.risk !== undefined && (
        <div className="msn-dial">
          <dt>
            <StatusShape status={risk > 0 ? 'risk' : 'safe'} size={20} /> Risk
          </dt>
          <dd>
            <span className="msn-dial__num">{risk > 0 ? `+${risk}` : risk < 0 ? `−${Math.abs(risk)}` : '0'}</span>
            <span className="msn-dial__word">{risk > 0 ? 'Risk goes up' : risk < 0 ? 'Risk goes down' : 'No change'}</span>
            <Scale value={risk} />
          </dd>
        </div>
      )}
    </dl>
  );
}
