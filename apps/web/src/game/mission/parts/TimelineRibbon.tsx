import './parts.css';

export interface TimelineRibbonProps {
  /** Big label at the far end, e.g. "3 WEEKS LATER". */
  label: string;
  /** risk: a frost seed; protective: a gold Afterglow; seed: something still in motion (polarity hidden). */
  tone: 'risk' | 'protective' | 'seed';
  caption?: string;
  /** Plays the fast-forward (ticks race past). Leave off under reduced motion. */
  play?: boolean;
}

/** The Timeline Ribbon used for Aftershock fast-forwards and for dropping a Seed at Release. */
export function TimelineRibbon({ label, tone, caption, play }: TimelineRibbonProps) {
  return (
    <div className="msn-ribbon" data-tone={tone} data-play={play ? '' : undefined}>
      <div className="msn-ribbon__track" aria-hidden="true">
        <span className="msn-ribbon__now">NOW</span>
        <span className="msn-ribbon__line">
          <span className="msn-ribbon__ticks" />
        </span>
        <span className="msn-ribbon__seed" />
      </div>
      <p className="msn-ribbon__label">{label}</p>
      {caption && <p className="msn-ribbon__caption">{caption}</p>}
    </div>
  );
}
