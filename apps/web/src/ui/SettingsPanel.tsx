import { useState } from 'react';
import { BANDS } from '@shieldquest/shared';
import { HOLD_MS_OPTIONS, TEXT_SCALES, useSettings, type MotionSetting, type QualitySetting } from '../state/settings';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

/** Comfort Settings: text size, motion, graphics (incl. 2D mode), sound, plain language, hold style. */
export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useSettings();
  const idx = TEXT_SCALES.indexOf(s.textScale as (typeof TEXT_SCALES)[number]);
  return (
    <Sheet open={open} onClose={onClose} title="Comfort settings">
      <div className="ui-settings">
        <fieldset>
          <legend>Text size</legend>
          <div className="ui-row">
            <button
              className="ui-btn ui-btn--secondary ui-btn--sm"
              disabled={idx <= 0}
              onClick={() => s.set({ textScale: TEXT_SCALES[Math.max(0, idx - 1)] })}
              aria-label="Smaller text"
            >
              A−
            </button>
            <output aria-live="polite">{Math.round(s.textScale * 100)}%</output>
            <button
              className="ui-btn ui-btn--secondary ui-btn--sm"
              disabled={idx >= TEXT_SCALES.length - 1}
              onClick={() => s.set({ textScale: TEXT_SCALES[Math.min(TEXT_SCALES.length - 1, idx + 1)] })}
              aria-label="Bigger text"
            >
              A+
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend>Graphics</legend>
          <select value={s.quality} onChange={(e) => s.set({ quality: e.target.value as QualitySetting })}>
            <option value="auto">Automatic (recommended)</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low (older phones)</option>
            <option value="2d">2D mode / battery saver</option>
          </select>
        </fieldset>

        <fieldset>
          <legend>Motion</legend>
          <select value={s.motion} onChange={(e) => s.set({ motion: e.target.value as MotionSetting })}>
            <option value="system">Follow my device</option>
            <option value="reduced">Reduce motion</option>
            <option value="full">Full motion</option>
          </select>
        </fieldset>

        <fieldset>
          <legend>Age band</legend>
          <select value={s.band ?? ''} onChange={(e) => s.set({ band: (e.target.value || null) as typeof s.band })}>
            <option value="">Not chosen yet</option>
            {BANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.segment} ({b.ages})
              </option>
            ))}
          </select>
        </fieldset>

        <label className="ui-toggle">
          <input type="checkbox" checked={s.sound} onChange={(e) => s.set({ sound: e.target.checked })} />
          <span>
            <Icon name={s.sound ? 'sound' : 'mute'} /> Sound effects
          </span>
        </label>
        <label className="ui-toggle">
          <input type="checkbox" checked={s.haptics} onChange={(e) => s.set({ haptics: e.target.checked })} />
          <span>Vibration (Android)</span>
        </label>
        <label className="ui-toggle">
          <input type="checkbox" checked={s.plainLanguage} onChange={(e) => s.set({ plainLanguage: e.target.checked })} />
          <span>Plain language (no slang)</span>
        </label>
        <label className="ui-toggle">
          <input type="checkbox" checked={s.tapToHold} onChange={(e) => s.set({ tapToHold: e.target.checked })} />
          <span>Tap once to Hold (instead of press and hold)</span>
        </label>
        {!s.tapToHold && (
          <fieldset>
            <legend>How long to press HOLD</legend>
            <select value={s.holdMs} onChange={(e) => s.set({ holdMs: Number(e.target.value) })}>
              {HOLD_MS_OPTIONS.map((ms) => (
                <option key={ms} value={ms}>
                  {(ms / 1000).toFixed(1)} seconds{ms === 600 ? ' (standard)' : ''}
                </option>
              ))}
            </select>
          </fieldset>
        )}
        <label className="ui-toggle">
          <input type="checkbox" checked={s.gentle} onChange={(e) => s.set({ gentle: e.target.checked })} />
          <span>Gentle mode in solo play (no countdowns or pressure surges)</span>
        </label>
      </div>
    </Sheet>
  );
}

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="ui-iconbtn" onClick={() => setOpen(true)} aria-label="Comfort settings">
        <Icon name="settings" />
      </button>
      <SettingsPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
