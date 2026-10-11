import './parts.css';

export interface CaptionBandProps {
  /** Caption for the latest meaningful sound, e.g. "[message arrives]". Null hides the band. */
  text: string | null;
}

/**
 * Sound captions (on for everyone). Hidden from screen readers because the same events are already announced
 * through the chat log and the phase announcer; captions are the visual twin of the audio.
 */
export function CaptionBand({ text }: CaptionBandProps) {
  return (
    <div className="msn-caption" aria-hidden="true" data-empty={text ? undefined : ''}>
      {text && (
        <span key={text} className="msn-caption__text">
          {text}
        </span>
      )}
    </div>
  );
}
