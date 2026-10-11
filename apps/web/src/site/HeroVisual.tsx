import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { CityScene, useRenderMode } from '../world';
import { arc } from './art/geometry';
import { SkylinePoster } from './art/Skyline';
import { useReducedMotion } from './motion';

/** If the 3D city fails (no WebGL, lost context, chunk error), the poster simply stays. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function saveDataOn(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return nav.connection?.saveData === true;
}

/**
 * The hero window onto Lumen. The poster (gradient + skyline SVG) paints instantly and holds the
 * layout; the live 3D city only downloads once the hero is on screen and the browser is idle,
 * then fades in on top. In 2D mode, on Save-Data, or without WebGL2 the poster is the hero.
 */
export function HeroVisual() {
  const mode = useRenderMode();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [want3D, setWant3D] = useState(false);
  const allow3D = mode !== '2d' && !saveDataOn();

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => setInView(entries.some((e) => e.isIntersecting)), {
      rootMargin: '0px 0px -10% 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!allow3D || want3D || !inView) return;
    const go = () => setWant3D(true);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(go, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(go, 1200);
    return () => window.clearTimeout(t);
  }, [allow3D, want3D, inView]);

  return (
    <div
      ref={ref}
      className="site-hero__visual"
      role="img"
      aria-label="The city of Lumen at blue hour. Rain hangs in the air and the Stillpoint clock tower reads 11:59."
    >
      <SkylinePoster className="site-hero__poster" />
      {want3D && mode !== '2d' && (
        <SceneBoundary>
          <Suspense fallback={null}>
            <div className="site-hero__canvas">
              {/* The orbit pauses off-screen and under reduced motion, so the canvas stops redrawing. */}
              <CityScene focus={null} districtTrust={{}} markers={[]} showcase={inView && !reduced} quality={mode} />
            </div>
          </Suspense>
        </SceneBoundary>
      )}
      <div className="site-hero__scrim" aria-hidden="true" />
      <div className="site-hero__chips" aria-hidden="true">
        <div className="site-hero__bubble">
          <span className="site-hero__avatar">K</span>
          <span>
            <b>Kel_QuickCash</b>
            Need your answer in 15 mins or I give the slot to someone else.
          </span>
        </div>
        <span className="site-hero__ring-label">URGENCY</span>
        <div className="site-hero__hold">
          <svg viewBox="0 0 100 100" className="site-hero__hold-ring">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path
                key={i}
                d={arc(50, 50, 44, i * 60 + 4, i * 60 + 56)}
                className={i < 3 ? 'is-lit' : undefined}
                fill="none"
                strokeWidth="7"
                strokeLinecap="round"
              />
            ))}
          </svg>
          <span className="site-hero__hold-btn">HOLD</span>
        </div>
        <span className="site-hero__time">
          <span className="site-hero__dot" /> Lumen · 11:59
        </span>
      </div>
    </div>
  );
}
