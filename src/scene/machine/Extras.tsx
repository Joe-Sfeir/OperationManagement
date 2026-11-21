import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { easeInOutCubic } from '../../design/tokens';
import { usePlant } from '../plant';
import { mats } from '../materials';
import { Box, Cyl } from '../parts';
import { R_ARM, STATION_DEG, polar } from '../layout';
import type { PlantState } from '../../sim/types';

export const CONSOLE_POS: [number, number, number] = polar(9.7, 316);

/**
 * Operator console: grey cabinet with a small screen and a status light
 * (hoist photo). The screen brightness follows oven temperature; the light is
 * green while arms flow and amber while one waits for the oven.
 */
export function Console() {
  const plant = usePlant();
  const M = mats();
  const screen = useMemo(() => M.screen.clone(), [M]);
  const green = useMemo(() => M.lampGreen.clone(), [M]);
  const amber = useMemo(() => M.lampAmber.clone(), [M]);
  useFrame(() => {
    const s = plant.get();
    const heat = Math.min(1, s.oven.tempC / plant.result.config.oven.setC);
    screen.emissiveIntensity = 0.25 + heat * 0.9;
    const waiting = s.ovenQueue > 0;
    green.emissiveIntensity = waiting ? 0 : 2.2;
    amber.emissiveIntensity = waiting ? 2.4 : 0;
  });
  return (
    <group position={CONSOLE_POS} rotation={[0, -0.5, 0]}>
      <Box size={[0.9, 1.9, 0.5]} position={[0, 0.95, 0]} material={M.console} radius={0.03} />
      <Box size={[0.94, 0.08, 0.54]} position={[0, 0.04, 0]} material={M.steelDark} radius={0.01} />
      <Box size={[0.5, 0.36, 0.03]} position={[0, 1.45, 0.26]} material={screen} radius={0.01} shadow={false} />
      <Box size={[0.6, 0.46, 0.02]} position={[0, 1.45, 0.255]} material={M.rubber} radius={0.01} shadow={false} />
      {/* Sloped button desk */}
      <Box size={[0.9, 0.08, 0.5]} position={[0, 0.98, 0.42]} rotation={[0.5, 0, 0]} material={M.console} radius={0.02} />
      {[-0.25, -0.08, 0.09, 0.26].map((x) => (
        <Cyl key={x} r={0.035} h={0.04} position={[x, 1.03, 0.44]} rotation={[0.5, 0, 0]} material={M.rubber} segments={10} shadow={false} />
      ))}
      {/* Status light stack */}
      <Cyl r={0.03} h={0.3} position={[0.3, 2.05, 0]} material={M.steelDark} segments={8} />
      <Cyl r={0.07} h={0.12} position={[0.3, 2.26, 0]} material={green} segments={12} shadow={false} />
      <Cyl r={0.07} h={0.12} position={[0.3, 2.39, 0]} material={amber} segments={12} shadow={false} />
    </group>
  );
}

function Figure({ cloth }: { cloth: THREE.Material }) {
  const M = mats();
  return (
    <group>
      {[-0.11, 0.11].map((x) => (
        <Cyl key={x} r={0.085} h={0.85} position={[x, 0.425, 0]} material={M.rubber} segments={10} />
      ))}
      <mesh position={[0, 1.18, 0]} material={cloth} castShadow>
        <capsuleGeometry args={[0.2, 0.42, 4, 12]} />
      </mesh>
      {[-0.27, 0.27].map((x) => (
        <Cyl key={x} r={0.06} h={0.62} position={[x, 1.12, 0]} material={cloth} segments={8} />
      ))}
      {/* Faceless head: scale only */}
      <mesh position={[0, 1.68, 0]} material={M.skin} castShadow>
        <sphereGeometry args={[0.14, 14, 12]} />
      </mesh>
    </group>
  );
}

type P2 = [number, number];
const lerp2 = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/**
 * Where each operator stands, from the plant state. Positions are (x, z) in
 * machine coordinates. The demould crew walks over during the wait the
 * simulator reports, works the hoist, then one of them reloads the mould.
 */
function operatorSpots(s: PlantState): P2[] {
  const d = polar(R_ARM, STATION_DEG.demould);
  const l = polar(R_ARM, STATION_DEG.load);
  const rest: P2[] = [
    [CONSOLE_POS[0] - 0.4, CONSOLE_POS[2] + 1.0],
    [-9.2, 3.2],
    [-4.6, 8.6],
  ];
  const atDemould: P2[] = [
    [d[0] - 2.6, d[2] + 1.5],
    [d[0] - 1.4, d[2] - 2.7],
  ];
  const atLoad: P2 = [l[0] - 1.2, l[2] + 2.6];
  const out = rest.map((r) => [...r] as P2);
  const coming = s.arms.find((a) => a.stage === 'waitDemould');
  const working = s.arms.find((a) => a.stage === 'demoulding');
  const toLoad = s.arms.find((a) => a.stage === 'moving' && a.from === 'demould' && a.station === 'load');
  const loading = s.arms.find((a) => a.stage === 'loading' || (a.stage === 'layerPause' && a.station === 'load'));
  if (coming) {
    const e = easeInOutCubic(Math.min(1, coming.stageProgress * 1.25));
    out[0] = lerp2(rest[0]!, atDemould[0]!, e);
    out[1] = lerp2(rest[1]!, atDemould[1]!, e);
  } else if (working) {
    out[0] = atDemould[0]!;
    out[1] = atDemould[1]!;
    // Near the end, one operator leaves for the loading position.
    const e = easeInOutCubic(Math.max(0, (working.stageProgress - 0.85) / 0.15));
    out[2] = lerp2(rest[2]!, atLoad, e);
  } else if (toLoad || loading) {
    out[2] = atLoad;
    const e = easeInOutCubic(toLoad ? toLoad.moveProgress : 1);
    out[0] = lerp2(atDemould[0]!, rest[0]!, e);
    out[1] = lerp2(atDemould[1]!, rest[1]!, e);
  }
  return out;
}

/** Three operators (inventory row 74), simple faceless figures for scale. They only move when the simulator gives them work. */
export function Operators() {
  const plant = usePlant();
  const M = mats();
  const refs = useRef<(THREE.Group | null)[]>([]);
  const last = useRef<P2[]>([]);
  useFrame(() => {
    const spots = operatorSpots(plant.get());
    spots.forEach((p, i) => {
      const g = refs.current[i];
      if (!g) return;
      const prev = last.current[i];
      if (prev && (Math.abs(prev[0] - p[0]) > 1e-4 || Math.abs(prev[1] - p[1]) > 1e-4)) g.rotation.y = Math.atan2(p[0] - prev[0], p[1] - prev[1]);
      g.position.set(p[0], 0, p[1]);
      last.current[i] = p;
    });
  });
  return (
    <group>
      {[M.cloth, M.clothAlt, M.cloth].map((c, i) => (
        <group key={i} ref={(el) => void (refs.current[i] = el)}>
          <Figure cloth={c} />
        </group>
      ))}
    </group>
  );
}
