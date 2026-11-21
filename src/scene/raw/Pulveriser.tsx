import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { clock } from '../../app/store';
import { usePlant } from '../plant';
import { mats } from '../materials';
import { Bar, Box, Cyl, Motor } from '../parts';
import { Boxes, MiniMotor, Pipe, Plain, type BoxItem } from './bits';
import { CYCLONE, MILL, RISER_X, SILO_Z } from './layout';
import { PELLET_OUT } from './Extruder';

const GRAINS = 40;
/** Cyclone outlet and the funnel it drops into: the short open fall where the powder shows. */
const OUT_Y = 2.22;
const FUNNEL_Y = 1.72;

/**
 * Pulveriser: a disc mill grinds the pellets, its blower lifts the powder to
 * a cyclone, and the powder drops from the cyclone into the funnel of the duct
 * that carries it to the silos. A short burst of powder shows at that outlet
 * while the simulator is grinding; nothing shows when it is idle.
 */
export function Pulveriser() {
  const plant = usePlant();
  const M = mats();
  const burst = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const [mx, mz] = MILL;
  const [cx, cz] = CYCLONE;

  useFrame(() => {
    const m = burst.current;
    if (!m) return;
    const on = plant.get().grind.active;
    m.visible = on;
    if (!on) return;
    const fall = OUT_Y - FUNNEL_Y + 0.12;
    for (let i = 0; i < GRAINS; i++) {
      // Each grain's place in its fall comes from the simulated minute: the burst freezes when the clock stops.
      const p = (clock.t * 9 + i * 0.6180339) % 1;
      const a = i * 2.399963;
      const spread = 0.025 + 0.085 * p;
      const rad = spread * (0.35 + 0.65 * ((i * 0.37) % 1));
      dummy.position.set(Math.cos(a) * rad, -fall * p * p, Math.sin(a) * rad);
      dummy.scale.setScalar(0.7 + 0.6 * ((i * 0.53) % 1));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  const frame = useMemo<BoxItem[]>(() => {
    const it: BoxItem[] = [];
    for (const x of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) it.push({ p: [x, 2.0, z], s: [0.08, 4.0, 0.08] }, { p: [x, 0.012, z], s: [0.22, 0.024, 0.22] });
    for (const y of [2.55, 3.96]) {
      for (const z of [-0.5, 0.5]) it.push({ p: [0, y, z], s: [1.08, 0.08, 0.06] });
      for (const x of [-0.5, 0.5]) it.push({ p: [x, y, 0], s: [0.06, 0.08, 1.08] });
    }
    return it;
  }, []);
  const bolts = useMemo<BoxItem[]>(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return { p: [Math.cos(a) * 0.44, 1.15 + Math.sin(a) * 0.44, 0.335], s: [0.05, 0.05, 0.04], r: [0, 0, a] };
      }),
    [],
  );

  return (
    <group>
      {/* Disc mill */}
      <group position={[mx, 0, mz]}>
        <Plain size={[1.2, 0.1, 1.3]} position={[0, 0.05, -0.05]} material={M.steelDark} />
        <Box size={[0.9, 0.56, 0.8]} position={[0, 0.38, -0.1]} material={M.creamDark} radius={0.03} />
        <Cyl r={0.5} h={0.44} position={[0, 1.15, 0.1]} rotation={[Math.PI / 2, 0, 0]} material={M.cream} segments={28} />
        <Cyl r={0.4} h={0.05} position={[0, 1.15, 0.33]} rotation={[Math.PI / 2, 0, 0]} material={M.steel} segments={28} />
        <Cyl r={0.13} h={0.12} position={[0, 1.15, 0.38]} rotation={[Math.PI / 2, 0, 0]} material={M.steelDark} segments={14} />
        <Boxes items={bolts} material={M.steelDark} shadow={false} />
        {/* Feed funnel and pipe into the centre of the fixed disc */}
        <Cyl r={0.07} rTop={0.3} h={0.32} position={[0, 2.14, 0.6]} material={M.cream} segments={16} />
        <Cyl r={0.31} h={0.03} position={[0, 2.31, 0.6]} material={M.creamDark} segments={16} />
        <Pipe
          points={[
            [0, 2.0, 0.6],
            [0, 1.45, 0.6],
            [0, 1.15, 0.42],
          ]}
          r={0.06}
          material={M.galvanised}
          segments={10}
        />
        <Bar from={[0.22, 1.6, 0.2]} to={[0.1, 2.0, 0.58]} r={0.02} material={M.steelDark} segments={6} />
        <Bar from={[-0.22, 1.6, 0.2]} to={[-0.1, 2.0, 0.58]} r={0.02} material={M.steelDark} segments={6} />
        {/* Blue drive motor above, belt guard down the back */}
        <Plain size={[0.62, 0.06, 0.86]} position={[0, 1.71, -0.42]} material={M.steelDark} />
        <Plain size={[0.07, 1.16, 0.07]} position={[-0.26, 1.13, -0.78]} material={M.steelDark} />
        <Plain size={[0.07, 1.16, 0.07]} position={[0.26, 1.13, -0.78]} material={M.steelDark} />
        <group position={[0, 2.0, -0.5]} rotation={[0, -Math.PI / 2, 0]}>
          <Motor length={0.72} r={0.25} />
        </group>
        <Box size={[0.52, 1.3, 0.1]} position={[0, 1.6, -0.17]} material={M.blueDark} radius={0.04} />
      </group>

      {/* Pellets from the pelletiser up to the mill's feed funnel */}
      <Pipe
        points={[PELLET_OUT, [PELLET_OUT[0] + 0.22, PELLET_OUT[1], mz + 0.6], [mx - 0.34, 2.62, mz + 0.6], [mx - 0.05, 2.62, mz + 0.6], [mx - 0.05, 2.36, mz + 0.6]]}
        r={0.05}
        material={M.galvanised}
        segments={10}
      />

      {/* Powder and air from the mill up to the cyclone inlet */}
      <Pipe
        points={[
          [mx + 0.3, 0.86, mz + 0.1],
          [cx - 0.62, 0.86, cz + 0.33],
          [cx - 0.62, 4.42, cz + 0.33],
          [cx + 0.05, 4.42, cz + 0.33],
        ]}
        r={0.085}
        material={M.galvanised}
      />

      {/* Cyclone on its frame */}
      <group position={[cx, 0, cz]}>
        <Boxes items={frame} material={M.steelDark} />
        <Bar from={[-0.5, 0.3, -0.5]} to={[0.5, 2.5, -0.5]} r={0.02} material={M.steelDark} segments={6} />
        <Bar from={[0.5, 0.3, -0.5]} to={[-0.5, 2.5, -0.5]} r={0.02} material={M.steelDark} segments={6} />
        <Cyl r={0.42} h={0.95} position={[0, 4.33, 0]} material={M.galvanised} segments={24} />
        <Cyl r={0.09} rTop={0.42} h={1.3} position={[0, 3.2, 0]} material={M.galvanised} segments={24} />
        <Cyl r={0.45} h={0.05} position={[0, 3.87, 0]} material={M.steelDark} segments={24} />
        <Cyl r={0.17} h={0.4} position={[0, 4.98, 0]} material={M.galvanised} segments={14} />
        {/* Filter sock on the air outlet */}
        <Cyl r={0.21} h={0.75} position={[0, 5.5, 0]} material={M.hose} segments={14} />
        <Cyl r={0.22} h={0.04} position={[0, 5.14, 0]} material={M.steelDark} segments={14} />
        {/* Rotary valve under the cone, then the open outlet */}
        <Plain size={[0.26, 0.24, 0.26]} position={[0, 2.44, 0]} material={M.galvanised} />
        <group position={[0.27, 2.44, 0]} rotation={[0, Math.PI, 0]}>
          <MiniMotor length={0.24} r={0.07} />
        </group>
        <Cyl r={0.085} h={0.12} position={[0, OUT_Y + 0.05, 0]} material={M.galvanised} segments={12} />

        {/* Burst of powder at the outlet: only while grinding */}
        <instancedMesh ref={burst} args={[undefined, undefined, GRAINS]} position={[0, OUT_Y, 0]} material={M.powder} frustumCulled={false} visible={false}>
          <icosahedronGeometry args={[0.022, 0]} />
        </instancedMesh>

        {/* Receiving funnel and the blower that sends the powder up the duct to the silos */}
        <Cyl r={0.1} rTop={0.34} h={0.4} position={[0, FUNNEL_Y - 0.2, 0]} material={M.cream} segments={20} />
        <Cyl r={0.36} h={0.03} position={[0, FUNNEL_Y - 0.015, 0]} material={M.creamDark} segments={20} />
        <Cyl r={0.31} h={0.01} position={[0, FUNNEL_Y + 0.004, 0]} material={M.section} segments={20} shadow={false} />
        <Cyl r={0.1} h={0.44} position={[0, 1.1, 0]} material={M.cream} segments={14} />
        <Box size={[0.74, 0.8, 0.74]} position={[0, 0.5, 0]} material={M.cream} radius={0.04} />
        <group position={[-0.02, 0.36, 0.62]}>
          <Motor length={0.5} r={0.17} />
        </group>
        <Plain size={[0.6, 0.12, 0.4]} position={[-0.02, 0.1, 0.62]} material={M.steelDark} />
      </group>
      {/* Duct from the blower to the riser beside silo 1 (the riser and roof duct are drawn with the silos) */}
      <Pipe
        points={[
          [cx + 0.3, 0.5, cz],
          [RISER_X, 0.5, cz],
          [RISER_X, 0.5, SILO_Z - 0.001],
        ]}
        r={0.09}
        material={M.galvanised}
      />
    </group>
  );
}
