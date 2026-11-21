import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { clock } from '../../app/store';
import { usePlant } from '../plant';
import { mats } from '../materials';
import { Bar, Cyl, Motor, Railing } from '../parts';
import { Boxes, Eased, MiniMotor, Plain, type BoxItem } from './bits';
import { EXTRUDER } from './layout';

/** Screw axis height. */
const AY = 1.15;
/** Turns of the drive coupling per simulated minute: slow enough to read at every playback speed. */
const TURNS_PER_MIN = 1.7;
const DECK_Y = 1.3;

/** A small loss-in-weight doser: cone, body, gear motor, screw tube down to the feed throat. */
function Doser({ z, size, material }: { z: number; size: number; material: THREE.Material }) {
  const M = mats();
  const y = 1.92;
  return (
    <group>
      <Cyl r={0.2 * size} h={0.3 * size} position={[0.98, y + 0.42 * size, z]} material={material} segments={16} />
      <Cyl r={0.21 * size} h={0.03} position={[0.98, y + 0.58 * size, z]} material={M.creamDark} segments={16} />
      <Cyl r={0.05} rTop={0.2 * size} h={0.27 * size} position={[0.98, y + 0.135 * size, z]} material={material} segments={16} />
      <Plain size={[0.2, 0.12, 0.16]} position={[0.98, y - 0.05, z]} material={M.blueDark} />
      <group position={[1.22, y - 0.05, z]} rotation={[0, Math.PI, 0]}>
        <MiniMotor length={0.24} r={0.065} />
      </group>
      <Bar from={[0.9, y - 0.06, z]} to={[0.16, AY + 0.3, z * 0.45]} r={0.035} material={M.galvanised} segments={8} />
    </group>
  );
}

/**
 * Feed hopper and extruder: sacks are emptied into the cream hopper, pigment
 * (2 %) and foam agent (1.2 %) are dosed at the throat, and a big blue motor
 * drives the screw through a gearbox. The drive coupling turns only while the
 * simulator is grinding a batch.
 */
export function Extruder() {
  const plant = usePlant();
  const M = mats();
  const coupling = useRef<THREE.Group>(null);

  useFrame(() => {
    const s = plant.get();
    if (!coupling.current) return;
    // Minutes of grinding done so far: finished batches plus the running batch's progress.
    // The angle only changes while a batch is running, and scrubbing replays it exactly.
    let minutes = 0;
    for (const g of plant.result.grinds) {
      if (g.t1 <= clock.t) minutes += g.t1 - g.t0;
      else if (g.t0 <= clock.t && s.grind.active) minutes += s.grind.progress * (g.t1 - g.t0);
    }
    coupling.current.rotation.x = minutes * TURNS_PER_MIN * Math.PI * 2;
  });

  const small = useMemo<BoxItem[]>(() => {
    const it: BoxItem[] = [];
    // Skid rails and cross members
    for (const z of [-0.42, 0.42]) it.push({ p: [0.42, 0.07, z], s: [6.9, 0.14, 0.14] });
    for (const x of [-2.9, -1.6, -0.3, 1.0, 2.3, 3.6]) it.push({ p: [x, 0.07, 0], s: [0.12, 0.12, 0.84] });
    // Hopper frame: legs and ring
    for (const x of [-0.62, 0.62]) for (const z of [-0.62, 0.62]) it.push({ p: [x, 1.1, z], s: [0.09, 2.2, 0.09] });
    for (const z of [-0.62, 0.62]) it.push({ p: [0, 2.16, z], s: [1.33, 0.1, 0.09] });
    for (const x of [-0.62, 0.62]) it.push({ p: [x, 2.16, 0], s: [0.09, 0.1, 1.33] });
    // Barrel saddles
    for (const x of [0.95, 2.55]) it.push({ p: [x, 0.93, 0], s: [0.12, 0.16, 0.34] });
    // Operator deck legs and steps
    for (const x of [-0.78, 0.78]) for (const z of [0.86, 1.84]) it.push({ p: [x, DECK_Y / 2 - 0.02, z], s: [0.08, DECK_Y - 0.04, 0.08] });
    return it;
  }, []);
  const steps = useMemo<BoxItem[]>(() => {
    const it: BoxItem[] = [];
    const n = 6;
    const run = 1.7;
    for (let i = 0; i < n - 1; i++) it.push({ p: [-0.85 - run + (i + 0.5) * (run / n), (DECK_Y / n) * (i + 1) - 0.02, 1.35], s: [(run / n) * 0.9, 0.04, 0.8] });
    const len = Math.hypot(run, DECK_Y);
    const slope = Math.atan2(DECK_Y, run);
    for (const z of [0.95, 1.75]) it.push({ p: [-0.85 - run / 2, DECK_Y / 2 - 0.06, z], s: [len, 0.16, 0.035], r: [0, 0, slope] });
    return it;
  }, []);
  const terminals = useMemo<BoxItem[]>(() => Array.from({ length: 6 }, (_, i) => ({ p: [0.62 + i * 0.42, AY + 0.2, 0], s: [0.1, 0.07, 0.12] })), []);
  const doors = useMemo<BoxItem[]>(() => [0, 1, 2].map((i) => ({ p: [0.66 + i * 0.94, 0.5, 0.405], s: [0.84, 0.54, 0.02] })), []);
  const bolts = useMemo<BoxItem[]>(
    () =>
      [0, 1, 2, 3, 4].map((i) => {
        // Five bolts and a key: no symmetry that would hide the turning.
        const a = (i / 5) * Math.PI * 2;
        return { p: [0, Math.cos(a) * 0.19, Math.sin(a) * 0.19], s: [0.3, 0.05, 0.05], r: [a, 0, 0] };
      }),
    [],
  );

  return (
    <group position={[EXTRUDER[0], 0, EXTRUDER[1]]}>
      <Boxes items={small} material={M.steelDark} />
      <Boxes items={steps} material={M.cream} />

      {/* Big blue motor on its pedestal */}
      <Eased size={[1.5, 0.6, 0.9]} position={[-2.3, 0.44, 0]} material={M.creamDark} radius={0.03} />
      <group position={[-2.3, AY, 0]}>
        <Motor length={1.2} r={0.4} />
      </group>
      {/* Drive coupling: the only part of the extruder that moves */}
      <group ref={coupling} position={[-1.45, AY, 0]}>
        <Cyl r={0.17} h={0.3} rotation={[0, 0, Math.PI / 2]} material={M.steel} segments={20} />
        <Cyl r={0.23} h={0.05} position={[-0.03, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={M.steelDark} segments={20} />
        <Cyl r={0.23} h={0.05} position={[0.03, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={M.steelDark} segments={20} />
        <Boxes items={bolts} material={M.steel} shadow={false} />
        <Plain size={[0.12, 0.07, 0.09]} position={[-0.1, 0.19, 0]} material={M.rubber} />
      </group>
      {/* Gearbox */}
      <Eased size={[1.0, 0.5, 0.82]} position={[-0.82, 0.39, 0]} material={M.creamDark} radius={0.03} />
      <Eased size={[0.95, 1.0, 0.9]} position={[-0.82, AY - 0.02, 0]} material={M.blue} radius={0.05} />
      <Eased size={[0.8, 0.07, 0.74]} position={[-0.82, AY + 0.5, 0]} material={M.blueDark} radius={0.02} />
      <Cyl r={0.05} h={0.14} position={[-0.6, AY + 0.6, 0.2]} material={M.steelDark} segments={8} />

      {/* Feed throat and the cream feed hopper on its frame */}
      <Eased size={[0.62, 0.56, 0.56]} position={[0, AY, 0]} material={M.blue} radius={0.03} />
      <Cyl r={0.2} rTop={0.92} h={0.75} position={[0, 1.8, 0]} rotation={[0, Math.PI / 4, 0]} material={M.cream} segments={4} />
      <Eased size={[1.3, 0.62, 1.3]} position={[0, 2.47, 0]} material={M.cream} radius={0.04} />
      <Eased size={[1.38, 0.07, 1.38]} position={[0, 2.79, 0]} material={M.creamDark} radius={0.02} />
      {/* Open top: dark inside, a heap of resin showing */}
      <Plain size={[1.22, 0.02, 1.22]} position={[0, 2.822, 0]} material={M.section} shadow={false} />
      <Cyl r={0.8} rTop={0.06} h={0.16} position={[0, 2.9, 0]} rotation={[0, Math.PI / 4, 0]} material={M.sack} segments={4} shadow={false} />

      {/* Operator deck in front of the hopper, with steps */}
      <Eased size={[1.7, 0.08, 1.1]} position={[0, DECK_Y - 0.04, 1.35]} material={M.cream} radius={0.02} />
      <group position={[0, DECK_Y, 1.35]}>
        <Railing
          points={[
            [0.81, 0, -0.5],
            [0.81, 0, 0.5],
            [-0.81, 0, 0.5],
          ]}
          spacing={0.9}
        />
      </group>
      <Railing
        points={[
          [-2.55, 0, 1.78],
          [-0.85, DECK_Y, 1.78],
        ]}
        height={0.95}
        spacing={1.7}
      />

      {/* Pigment (2 %) and foam agent (1.2 %) dosers at the throat */}
      <Plain size={[0.5, 0.05, 0.95]} position={[1.02, 1.8, 0]} material={M.steelDark} />
      <Plain size={[0.07, 0.94, 0.07]} position={[1.2, 1.33, 0.4]} material={M.steelDark} />
      <Plain size={[0.07, 0.94, 0.07]} position={[1.2, 1.33, -0.4]} material={M.steelDark} />
      <Doser z={-0.27} size={1} material={M.cream} />
      <Doser z={0.27} size={0.8} material={M.cream} />

      {/* Base cabinet, barrel with heater bands, die */}
      <Eased size={[2.9, 0.72, 0.8]} position={[1.6, 0.5, 0]} material={M.cream} radius={0.03} />
      <Boxes items={doors} material={M.creamDark} shadow={false} />
      <Cyl r={0.14} h={2.78} position={[1.69, AY, 0]} rotation={[0, 0, Math.PI / 2]} material={M.steel} segments={20} />
      {Array.from({ length: 6 }, (_, i) => (
        <Cyl key={i} r={0.185} h={0.3} position={[0.62 + i * 0.42, AY, 0]} rotation={[0, 0, Math.PI / 2]} material={M.steelDark} segments={20} />
      ))}
      <Boxes items={terminals} material={M.rubber} shadow={false} />
      <Plain size={[2.4, 0.03, 0.06]} position={[1.67, AY + 0.25, -0.05]} material={M.galvanised} shadow={false} />
      <Cyl r={0.21} h={0.2} position={[3.14, AY, 0]} rotation={[0, 0, Math.PI / 2]} material={M.blueDark} segments={20} />

      {/* Pelletiser on the die: hood, cutter motor, pellet outlet */}
      <Eased size={[0.5, 0.66, 0.6]} position={[3.55, 0.47, 0]} material={M.creamDark} radius={0.03} />
      <Eased size={[0.58, 0.72, 0.66]} position={[3.55, AY, 0]} material={M.cream} radius={0.05} />
      <group position={[3.55, AY + 0.5, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <MiniMotor length={0.3} r={0.09} />
      </group>
    </group>
  );
}

/** Where pellets leave the pelletiser (hall coordinates): the mill's feed pipe starts here. */
export const PELLET_OUT: [number, number, number] = [EXTRUDER[0] + 3.84, 0.95, EXTRUDER[1] + 0.12];
