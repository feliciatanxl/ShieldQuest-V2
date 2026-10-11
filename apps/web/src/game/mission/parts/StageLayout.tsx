import type { ReactNode } from 'react';
import './parts.css';

export type StageEmphasis = 'stage' | 'balanced' | 'panel' | 'sheet-only';

export interface StageLayoutProps {
  /** Always-on-screen top bar (usually <TopBar>). */
  top: ReactNode;
  /** The 3D/2D scene (usually <MissionStage>). Omit for a panel-only screen. */
  stage?: ReactNode;
  /** Caption band, drawn directly above the sheet. */
  caption?: ReactNode;
  /** HOLD button: floats on the seam (portrait) or bottom-right of the stage (landscape). */
  hold?: ReactNode;
  /** Guided-scaffold prompt for the current letter, shown at the top of the sheet. */
  prompt?: string | null;
  /**
   * balanced: stage 58% / sheet 42% on phone portrait, 62/38 side by side elsewhere.
   * panel: more room for reading and choosing. stage: more room for the scene. sheet-only: no stage.
   */
  emphasis?: StageEmphasis;
  /** Time is held: the frame takes the still-blue tint. */
  frozen?: boolean;
  /** Accessible name of the sheet region. */
  sheetLabel?: string;
  /** Overlays (pause screen, surge) rendered above everything. */
  overlay?: ReactNode;
  children: ReactNode;
}

/** Responsive mission frame: 3D stage + bottom sheet on phones, side-by-side on landscape, tablet and desktop. */
export function StageLayout({
  top,
  stage,
  caption,
  hold,
  prompt,
  emphasis = 'balanced',
  frozen,
  sheetLabel = 'Mission panel',
  overlay,
  children,
}: StageLayoutProps) {
  const hasStage = Boolean(stage) && emphasis !== 'sheet-only';
  return (
    <div
      className="msn-layout"
      data-emphasis={hasStage ? emphasis : 'sheet-only'}
      data-frozen={frozen ? '' : undefined}
      data-hold={hold ? '' : undefined}
    >
      <div className="msn-layout__top">{top}</div>
      {hasStage && (
        <div className="msn-layout__stage">
          {stage}
          {caption && <div className="msn-layout__caption">{caption}</div>}
        </div>
      )}
      <section className="msn-layout__sheet" aria-label={sheetLabel}>
        {!hasStage && caption && <div className="msn-layout__caption msn-layout__caption--inline">{caption}</div>}
        {prompt && (
          <p className="msn-layout__prompt">
            <span aria-hidden="true">▸</span> {prompt}
          </p>
        )}
        <div className="msn-layout__sheet-body">{children}</div>
      </section>
      {hold && <div className="msn-layout__hold">{hold}</div>}
      {overlay}
    </div>
  );
}
