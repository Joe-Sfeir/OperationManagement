/**
 * Standalone entry for the raw-material hall (preview-raw.html).
 *   ?t=<minute>        simulated minute to show
 *   ?view=platform     look at the dosing platform end of the lane (to check the tipping)
 *   ?machine=1         also mount the machine floor and loading station, to check the hall joins them
 *   ?machine=2         mount the whole machine scene instead (what the app shows)
 *   ?cx=&cy=&cz=&w=&h= hall-local look-at point and span, for close-ups
 * The triangle count of the hall is written to window.__tris and to the page title.
 */
import { StrictMode, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import '../../index.css';
import { clock } from '../../app/store';
import { defaultConfig } from '../../sim/config';
import { runSimulation } from '../../sim/engine';
import { HALL_OFFSET, PLAN_ROT } from '../layout';
import { PlantProvider } from '../plant';
import { Stage, type View } from '../Stage';
import { Floor } from '../machine/Floor';
import { LoadingStation } from '../machine/Loading';
import { MachineScene } from '../MachineScene';
import { HALL_SPAN, HALL_VIEW_CENTER, RawHall } from './RawHall';
import { PLATFORM_X, PLATFORM_Z, logistics } from './layout';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
clock.t = num('t', 0);
const result = runSimulation(defaultConfig());
// For checking the choreography from the console: the forklift and bins at any minute.
(window as unknown as { __logistics: (t: number) => unknown }).__logistics = (t: number) => {
  const g = logistics(t, result.bins, result.config.raw.binKg);
  return { ...g, fill: [...g.fill] };
};

/** Hall-local point to world (the machine group is turned by PLAN_ROT). */
function toWorld(p: [number, number, number]): [number, number, number] {
  const x = p[0] + HALL_OFFSET[0];
  const z = p[2] + HALL_OFFSET[2];
  const c = Math.cos(PLAN_ROT);
  const s = Math.sin(PLAN_ROT);
  return [x * c + z * s, p[1] + HALL_OFFSET[1], -x * s + z * c];
}

const platform = q.get('view') === 'platform';
const centre: [number, number, number] = platform ? [PLATFORM_X - 3, 3.4, PLATFORM_Z] : HALL_VIEW_CENTER;
const span: [number, number] = platform ? [20, 12.5] : HALL_SPAN;
const view: View = {
  target: toWorld([num('cx', centre[0]), num('cy', centre[1]), num('cz', centre[2])]),
  span: [num('w', span[0]), num('h', span[1])],
};
const world = toWorld([num('cx', centre[0]), 0, num('cz', centre[2])]);

function Hall() {
  const ref = useRef<THREE.Group>(null);
  useEffect(() => {
    let tris = 0;
    const byPart: Record<string, number> = {};
    const hall = ref.current?.children[0];
    ref.current?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = m.geometry;
      const n = ((g.index ? g.index.count : (g.attributes.position?.count ?? 0)) / 3) * ((o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh).instanceMatrix.count : 1);
      tris += n;
      // Which top-level part of the hall this mesh belongs to, and what kind of geometry it is.
      let top: THREE.Object3D = o;
      while (top.parent && top.parent !== hall) top = top.parent;
      const key = `${hall?.children.indexOf(top)}:${g.type}`;
      byPart[key] = (byPart[key] ?? 0) + n;
    });
    (window as unknown as { __parts: Record<string, number> }).__parts = byPart;
    (window as unknown as { __tris: number }).__tris = Math.round(tris);
    document.title = `Raw hall preview: ${Math.round(tris)} triangles`;
  }, []);
  return (
    <group ref={ref} position={HALL_OFFSET}>
      <RawHall />
    </group>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div style={{ position: 'fixed', inset: 0 }}>
      <Stage view={view} label="Raw-material hall, isometric view" shadowSpan={platform || q.has('machine') ? 30 : 18} shadowCenter={world}>
        <PlantProvider result={result}>
          {q.get('machine') === '2' && <MachineScene interactive={false} />}
          <group rotation={[0, PLAN_ROT, 0]}>
            {q.get('machine') === '1' && (
              <>
                <Floor />
                <LoadingStation />
              </>
            )}
            <Hall />
          </group>
        </PlantProvider>
      </Stage>
    </div>
  </StrictMode>,
);
