// TEMPORARY dev preview (removed after verification).
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GUARDIANS } from '@shieldquest/shared';
import '../../../styles/global.css';
import GuardianFigure from '../../guardians/GuardianFigure';
import { GuardianIcon } from '../../flat/GuardianIcon';
import {
  AdaptiveCanvas,
  Bean,
  bench,
  Faceless,
  facelessAnchor,
  ground,
  hdbBlock,
  Hotspot,
  KitMesh,
  Lantern,
  Lanterns,
  lampPost,
  Lighting,
  mergeKit,
  Rain,
  tableSet,
  Thread,
  tree,
  useFreeze,
  useKitGeometry,
} from '../index';
import type { QualityTier } from '../../quality';

const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'guardians';
const tier = (params.get('tier') ?? 'high') as QualityTier;
const level = Number(params.get('level') ?? '1');

function Freeze({ on }: { on: boolean }) {
  useFreeze(on ? 1 : 0);
  return null;
}

function Set() {
  const geo = useKitGeometry(
    () =>
      mergeKit([
        ground({ width: 16, depth: 12, tile: 1 }),
        hdbBlock({ floors: 4, width: 12, litWindows: 10, seed: 'p' }).translate(0, 0, -5),
        bench().translate(-3, 0, 1),
        tableSet().translate(2.5, 0, 1),
        lampPost().translate(-5, 0, 2),
        tree().translate(5.5, 0, -1),
        tree({ kind: 'cone', seed: 3 }).translate(-6, 0, -2),
      ]),
    [],
  );
  return <KitMesh geometry={geo} />;
}

function Scene() {
  const [frozen, setFrozen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const from: [number, number, number] = [-3, 1.2, 1.2];
  const to = facelessAnchor([3, 0, -4.2], 0);
  return (
    <div style={{ height: '100dvh', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
      <div style={{ padding: 8, display: 'flex', gap: 8 }}>
        <button onClick={() => setFrozen((f) => !f)}>{frozen ? 'Release' : 'Hold'}</button>
        <button onClick={() => setRevealed((r) => !r)}>Thread {revealed ? 'slack' : 'tight'}</button>
      </div>
      <AdaptiveCanvas quality={tier} ariaLabel="Kit test scene" camera={{ position: [0, 5, 12], fov: 35 }}>
        <Lighting timeOfDay="evening" mood="neutral" background />
        <Freeze on={frozen} />
        <Set />
        <Bean look={{ body: '#2bb3a3', accent: '#1d2440', hair: 'hijab' }} pose="sit" position={[-3.4, 0, 1]} expression="worried" frozen={frozen} highlighted />
        <Bean look={{ body: '#f26b5b', accent: '#2a2f6b', hair: 'cap' }} pose="phone" position={[-2.6, 0, 1]} expression="happy" frozen={frozen} />
        <Bean look={{ body: '#8a6cf0', accent: '#1d2440', hair: 'long', glasses: true }} pose="arms-crossed" position={[0, 0, 2]} expression="smug" frozen={frozen} />
        <Bean look={{ body: '#f2c14e', accent: '#3a3f5c', hair: 'bun' }} pose="open-arms" position={[1.2, 0, 2]} expression="relieved" frozen={frozen} />
        <Bean look={{ body: '#38bdf8', accent: '#1d2440', hair: 'spiky', outfit: 'school' }} pose="walk" position={[4, 0, 2.5]} expression="determined" frozen={frozen} facing={-0.8} />
        <Faceless position={[3, 0, -4.2]} window pose="phone" frozen={frozen} highlighted={revealed} />
        <Thread from={from} to={to} beads={['coin', 'clock', 'crowd']} revealed={revealed} />
        <Hotspot position={[-5, 2.2, 2]} state="available" label="Lamp" onSelect={() => console.log('lamp')} />
        <Hotspot position={[2.5, 1.6, 1]} state="found-flag" label="Table" onSelect={() => {}} />
        <Hotspot position={[5.5, 3, -1]} state="found-ok" label="Tree" onSelect={() => {}} />
        <Lantern position={[0, 3, 0]} rise />
        <Lanterns items={[{ position: [-1, 4, -2] }, { position: [1, 4.5, -2], color: '#2dd4bf' }, { position: [2, 4, -1] }]} rise />
        <Rain />
      </AdaptiveCanvas>
    </div>
  );
}

function Guardians() {
  const [lv, setLv] = useState(level);
  const [celebrate, setCelebrate] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <div>
      <div style={{ padding: 8, display: 'flex', gap: 8 }}>
        {[0, 1, 2, 3].map((l) => (
          <button key={l} onClick={() => setLv(l)}>
            L{l}
          </button>
        ))}
        <button
          onClick={() => {
            setCelebrate(true);
            setKey((k) => k + 1);
          }}
        >
          Celebrate
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 260px)', gap: 8, padding: 8 }} key={key}>
        {GUARDIANS.map((g) => (
          <div key={g.id} style={{ width: 260, height: 260, background: '#1f2856', borderRadius: 12 }}>
            <GuardianFigure guardian={g.id} level={lv} celebrate={celebrate} quality={tier} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Icons() {
  return (
    <div style={{ padding: 16, display: 'grid', gap: 16 }}>
      {[0, 1, 2, 3].map((l) => (
        <div key={l} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {GUARDIANS.map((g) => (
            <GuardianIcon key={g.id} guardian={g.id} level={l} size={96} />
          ))}
          {GUARDIANS.map((g) => (
            <GuardianIcon key={`s${g.id}`} guardian={g.id} level={l} size={28} />
          ))}
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{view === 'scene' ? <Scene /> : view === 'icons' ? <Icons /> : <Guardians />}</StrictMode>,
);
