import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { easeInOutCubic, palette } from '../../design/tokens';
import { useTwin } from '../../app/store';
import { usePlant } from '../plant';
import { mats } from '../materials';
import { Bar, Box, Cyl } from '../parts';
import { DEG, H_ARM, R_ARM, R_RING, STATION_DEG, sweep } from '../layout';
import { Mould, mouldSlots } from './Moulds';
import type { ArmState, StationId } from '../../sim/types';

/** Plan angle of an arm, in degrees, from its state. Indexing is eased: heavy steel, no overshoot. */
export function armAngleDeg(a: ArmState, ring: StationId[], reduced = false): number {
  const to = STATION_DEG[a.station];
  if (a.stage !== 'moving' || !a.from) return to;
  const from = STATION_DEG[a.from];
  const n = ring.length;
  const forward = ring.indexOf(a.station) === (ring.indexOf(a.from) + 1) % n;
  const p = reduced ? (a.moveProgress < 0.5 ? 0 : 1) : easeInOutCubic(a.moveProgress);
  return from + sweep(from, to, forward) * p;
}

/**
 * Turns shown while the moulds rotate. No rpm is recorded for Machine 3700, so
 * the rate is chosen to stay readable at the playback speed (see docs/MODEL.md):
 * a whole number of turns per stretch, so the moulds always stop upright.
 */
function turns(durMin: number, speed: number, perRealSecond: number): number {
  const realSeconds = (durMin * 60) / Math.max(1, speed);
  return Math.max(1, Math.round(Math.min(realSeconds * perRealSecond, durMin * 6)));
}

/** How hot the mould looks, 0..1, from its stage. */
function heatOf(a: ArmState): number {
  switch (a.stage) {
    case 'heating':
      return Math.min(1, ((a.layer - 1 + a.stageProgress) / 3) * 0.75 + 0.3);
    case 'layerPause':
      return Math.min(1, ((a.layer - 1) / 3) * 0.75 + 0.3);
    case 'airCooling':
      return 1 - 0.5 * a.stageProgress;
    case 'waterCooling':
      return 0.5 * (1 - a.stageProgress);
    case 'blocked':
    case 'moving':
      return a.content === 'hot' ? 1 : a.content === 'cooking' ? 0.6 : 0;
    default:
      return 0;
  }
}

export function Arm({ id }: { id: number }) {
  const plant = usePlant();
  const M = mats();
  const moulds = plant.result.config.arms[id]!.moulds;
  const slots = useMemo(() => mouldSlots(moulds), [moulds]);
  const root = useRef<THREE.Group>(null);
  const major = useRef<THREE.Group>(null);
  const minor = useRef<THREE.Group>(null);
  const lids = useRef<(THREE.Group | null)[]>([]);
  // Each arm owns its mould material so its own heat can show.
  const mouldMat = useMemo(() => {
    const m = M.mould.clone();
    m.emissive = new THREE.Color(palette.heatAmber);
    m.emissiveIntensity = 0;
    return m;
  }, [M]);

  useFrame(() => {
    const s = plant.get();
    const a = s.arms[id]!;
    const { speed } = useTwin.getState();
    if (root.current) root.current.rotation.y = armAngleDeg(a, plant.result.ring) * DEG;
    let maj = 0;
    let min = 0;
    if (a.rotating) {
      // Ease in and out of the tumble over the first and last 4 % so the mould never snaps.
      const p = a.stageProgress;
      const e = p < 0.04 ? (p * p) / 0.08 : p > 0.96 ? 1 - ((1 - p) * (1 - p)) / 0.08 : p - 0.02 + 0.02 * 0;
      const k = Math.min(1, Math.max(0, e / 0.96 - 0.0));
      maj = Math.PI * 2 * turns(a.stageDurMin, speed, 0.5) * k;
      min = Math.PI * 2 * turns(a.stageDurMin, speed, 0.19) * k;
    }
    if (major.current) major.current.rotation.x = maj;
    if (minor.current) minor.current.rotation.y = min;
    mouldMat.emissiveIntensity = heatOf(a) * 0.2;
    // Lids open for loading, for a new layer, and for demoulding (the hoist then takes the tank).
    const open = a.lidOpen ? Math.sin(Math.PI * Math.min(1, a.stageProgress * 6, (1 - a.stageProgress) * 6 + 0.0001) * 0.5) : 0;
    lids.current.forEach((lid, j) => {
      if (!lid) return;
      const active = a.stage !== 'demoulding' || s.demould.mouldIndex === j || a.stageProgress > (j + 1) / moulds.length;
      const o = a.stage === 'demoulding' ? (s.demould.mouldIndex === j ? 1 : a.stageProgress > (j + 1) / moulds.length ? 0 : 0) : open;
      lid.userData.base ??= lid.position.y;
      lid.position.y = lid.userData.base + (active ? o * 0.5 : 0);
      lid.rotation.z = active ? o * 0.5 : 0;
    });
  });

  const beamEnd = R_ARM - R_RING - 0.28;
  return (
    <group ref={root}>
      {/* Beam from the hub to the drive head */}
      <Box size={[beamEnd - 1.3, 0.34, 0.3]} position={[(beamEnd + 1.3) / 2, H_ARM, 0]} material={M.steel} radius={0.04} />
      <Box size={[beamEnd - 1.9, 0.08, 0.38]} position={[(beamEnd + 1.5) / 2, H_ARM + 0.19, 0]} material={M.steelDark} radius={0.02} />
      <Box size={[0.5, 0.6, 0.56]} position={[1.55, H_ARM, 0]} material={M.steelDark} radius={0.05} />
      {/* Drive head and its motor */}
      <Box size={[0.5, 0.62, 0.6]} position={[beamEnd - 0.1, H_ARM, 0]} material={M.steelDark} radius={0.06} />
      <group position={[beamEnd - 0.55, H_ARM + 0.42, 0]}>
        <Cyl r={0.13} h={0.42} rotation={[0, 0, Math.PI / 2]} material={M.blue} segments={16} />
      </group>
      <Cyl r={0.12} h={0.3} position={[beamEnd + 0.26, H_ARM, 0]} rotation={[0, 0, Math.PI / 2]} material={M.steel} segments={16} />
      {/* Major axis: the ring frame turns about the arm */}
      <group ref={major} position={[R_ARM, H_ARM, 0]}>
        <mesh material={M.steel} castShadow receiveShadow>
          <torusGeometry args={[R_RING, 0.075, 10, 56]} />
        </mesh>
        {[-1, 1].map((s) => (
          <Box key={s} size={[0.3, 0.2, 0.3]} position={[0, s * R_RING, 0]} material={M.steelDark} radius={0.04} />
        ))}
        {/* Minor axis: the cradle turns about the ring's upright diameter */}
        <group ref={minor}>
          <Bar from={[0, -R_RING, 0]} to={[0, -1.32, 0]} r={0.07} material={M.steelDark} />
          <Bar from={[0, R_RING, 0]} to={[0, 1.4, 0]} r={0.07} material={M.steelDark} />
          {/* Cradle: a plate under the moulds and a yoke over them */}
          <Box size={[moulds.length > 1 ? 3.05 : 2.1, 0.1, 1.5]} position={[0, -1.27, 0]} material={M.steelDark} radius={0.03} />
          <Box size={[moulds.length > 1 ? 3.05 : 2.1, 0.08, 0.16]} position={[0, 1.36, 0]} material={M.steelDark} radius={0.03} />
          {[-1, 1].map((s) => (
            <Bar key={s} from={[s * (moulds.length > 1 ? 1.5 : 1.02), -1.25, 0]} to={[s * (moulds.length > 1 ? 1.5 : 1.02), 1.36, 0]} r={0.045} material={M.steelDark} />
          ))}
          {moulds.map((kind, j) => (
            <group key={j} position={[slots[j]![0], mouldSeatY(kind), slots[j]![2]]}>
              <Mould kind={kind} material={mouldMat} lidRef={(el) => void (lids.current[j] = el)} />
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

/** Height of a mould's centre above the ring centre so it stands on the cradle plate. */
export function mouldSeatY(kind: import('../../sim/types').MouldKind): number {
  const plateTop = -1.22;
  const half = kind === 'HTT2' ? 0.62 + 0.08 : kind === 'OTHER' ? 0.75 : kind === 'CTT4' ? 2.35 / 2 : 1.72 / 2;
  return plateTop + half;
}
