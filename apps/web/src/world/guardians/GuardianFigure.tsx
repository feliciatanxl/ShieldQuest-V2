// <GuardianFigure>: one origami Guardian in its own AdaptiveCanvas, filling its parent (Bond screen, Bond Book).
// Level 0 is a folded paper square; `celebrate` plays the Unfold once (sheet -> animal, ~2.6 s) followed by a
// sparkle burst; under reduced motion the sheet fades out and the animal fades in instead. Bond marks II and
// III add a second-colour fold and an orbiting trail. All readable text stays in the DOM: the canvas only has
// a role="img" description, and the 2D GuardianIcon stands in when WebGL is unavailable.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import { guardianById } from '@shieldquest/shared';
import type { GuardianFigureProps } from '../contracts';
import { GuardianIcon } from '../flat/GuardianIcon';
import { AdaptiveCanvas } from '../kit/AdaptiveCanvas';
import { useKit } from '../kit/context';
import { BlobShadow } from '../kit/KitMesh';
import { Lighting } from '../kit/Lighting';
import { clamp, easeInOutCubic } from '../kit/math';
import { sparkleCount, useGuardianMesh } from './GuardianModel';
import { GUARDIAN_ACCENT } from './palette';
import { GuardianSparkles } from './Sparkles';
import '../kit/kit.css';

export { GuardianModel, type GuardianModelProps } from './GuardianModel';

/** Pause before the paper starts to move, the Unfold itself, the reduced-motion crossfade and the landing pop. */
const UNFOLD_DELAY_S = 0.35;
const UNFOLD_S = 2.3;
const FADE_S = 0.8;
const POP_S = 0.55;

type Mode = 'idle' | 'unfold' | 'fade' | 'pop';

function describe(guardian: GuardianFigureProps['guardian'], level: number): string {
  const g = guardianById(guardian);
  if (level < 1) return `A folded paper square. ${g.name} has not been earned yet.`;
  const article = /^[aeiou]/i.test(g.creature) ? 'an' : 'a';
  return `${g.name}, ${article} ${g.creature}, bond level ${level}.`;
}

interface RigProps {
  guardian: GuardianFigureProps['guardian'];
  level: number;
  celebrate: boolean;
}

function FigureRig({ guardian, level, celebrate }: RigProps) {
  const { reducedMotion, requestFrame } = useKit();
  const camera = useThree((s) => s.camera);
  const { geometry, material } = useGuardianMesh(guardian, level, { transparent: true });
  const group = useRef<Group>(null);
  const earned = level >= 1;
  const [burst, setBurst] = useState(0);
  const anim = useRef<{ mode: Mode; time: number; played: boolean; lastLevel: number }>({
    mode: celebrate && earned ? (reducedMotion ? 'fade' : 'unfold') : 'idle',
    time: 0,
    played: celebrate && earned,
    lastLevel: level,
  });

  useLayoutEffect(() => {
    camera.lookAt(0, 0.5, 0);
    camera.updateMatrixWorld();
    requestFrame();
  }, [camera, requestFrame]);

  // Celebrate once when the Guardian is (or becomes) earned; a later level-up gets a pop and a burst.
  useEffect(() => {
    const a = anim.current;
    const prev = a.lastLevel;
    a.lastLevel = level;
    if (celebrate && earned && !a.played) {
      a.played = true;
      a.mode = reducedMotion ? 'fade' : 'unfold';
      a.time = 0;
    } else if (celebrate && prev >= 1 && level > prev && !reducedMotion) {
      a.mode = 'pop';
      a.time = 0;
      setBurst((b) => b + 1);
    }
    requestFrame();
  }, [celebrate, earned, level, reducedMotion, requestFrame]);

  useFrame((state, delta) => {
    const a = anim.current;
    const dt = Math.min(delta, 0.1);
    const gu = material.userData.guardian;
    let unfold = earned ? 1 : 0;
    let opacity = 1;
    let pop = 1;
    let busy = false;
    if (a.mode === 'unfold') {
      a.time += dt;
      unfold = clamp((a.time - UNFOLD_DELAY_S) / UNFOLD_S);
      busy = true;
      if (unfold >= 1) {
        a.mode = 'pop';
        a.time = 0;
        setBurst((b) => b + 1);
      }
    } else if (a.mode === 'fade') {
      a.time += dt;
      const p = clamp(a.time / FADE_S);
      unfold = p < 0.5 ? 0 : 1;
      opacity = p < 0.5 ? 1 - easeInOutCubic(p * 2) : easeInOutCubic((p - 0.5) * 2);
      busy = true;
      if (p >= 1) a.mode = 'idle';
    } else if (a.mode === 'pop') {
      a.time += dt;
      const p = clamp(a.time / POP_S);
      pop = 1 + 0.09 * Math.sin(p * Math.PI) * (1 - p * 0.4);
      busy = true;
      if (p >= 1) a.mode = 'idle';
    }
    if (gu) gu.uUnfold.value = unfold;
    material.opacity = opacity;
    const g = group.current;
    const hoverOn = !reducedMotion;
    if (g) {
      const time = state.clock.elapsedTime;
      g.position.y = hoverOn ? 0.03 * Math.sin(time * 1.6) : 0;
      // The sheet barely sways; the animal turns a little more to show off its folds.
      g.rotation.y = hoverOn ? (earned && unfold > 0.5 ? 0.34 : 0.16) * Math.sin(time * 0.45) : 0;
      g.scale.setScalar(pop);
    }
    if (busy || hoverOn) requestFrame();
  });

  const trail = earned && anim.current.mode !== 'unfold' ? sparkleCount(level) : 0;
  return (
    <>
      <BlobShadow radius={[0.5, 0.36]} opacity={0.3} />
      <group ref={group}>
        <mesh geometry={geometry} material={material} />
        <GuardianSparkles trail={trail} color={GUARDIAN_ACCENT[guardian]} burstKey={burst} />
      </group>
    </>
  );
}

/** A Guardian in its own canvas, filling the parent element. */
export default function GuardianFigure({ guardian, level, celebrate = false, quality }: GuardianFigureProps) {
  const lv = Math.max(0, Math.min(3, Math.round(level)));
  const flat = (
    <div className="w-guardian__flat">
      <GuardianIcon guardian={guardian} level={lv} size={128} />
    </div>
  );
  return (
    <div className="w-guardian">
      <AdaptiveCanvas
        quality={quality}
        ariaLabel={describe(guardian, lv)}
        camera={{ position: [0, 0.95, 3.1], fov: 30, near: 0.1, far: 30 }}
        fallback={flat}
      >
        <Lighting grade="blue-hour" timeOfDay="afternoon" fog={false} target={[0, 0.5, 0]} shadowExtent={2} />
        <FigureRig guardian={guardian} level={lv} celebrate={celebrate} />
      </AdaptiveCanvas>
    </div>
  );
}
