import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { easeInOutCubic } from '../../design/tokens';
import { useTwin } from '../../app/store';
import { usePlant } from '../plant';
import { mats } from '../materials';
import { Bar, Box, Cyl, Railing, Stairs } from '../parts';
import { H_ARM, R_ARM, STATION_DEG, polar } from '../layout';
import { Tank, TANK_DIM, mouldSlots } from './Moulds';
import { mouldSeatY } from './Arm';
import type { MouldKind } from '../../sim/types';

const KINDS: MouldKind[] = ['CTT4', 'CTT2', 'HTT2', 'OTHER'];
const BEAM_Y = 7.3;
/** Where the hoist sets a tank down (plan), and where the buffer rows start. */
export const SET_DOWN: [number, number, number] = [-10.6, 0, -3.0];
const FINISH_SPOTS: [number, number, number][] = [SET_DOWN, [-9.2, 0, -5.2], [-12.4, 0, -2.6]];
/** Buffer grid: row origin and spacing for each kind (machine coordinates). */
const BUFFER: Record<MouldKind, { origin: [number, number]; dx: number; dz: number; perRow: number }> = {
  CTT4: { origin: [-9.0, -6.4], dx: -2.1, dz: -2.1, perRow: 2 },
  CTT2: { origin: [-13.0, -6.2], dx: -1.5, dz: -1.5, perRow: 2 },
  HTT2: { origin: [-16.3, -6.4], dx: -1.5, dz: -2.2, perRow: 2 },
  OTHER: { origin: [-19.4, -6.2], dx: -1.4, dz: -1.5, perRow: 1 },
};
export const BUFFER_CENTER: [number, number, number] = [-13.5, 0, -8.5];

/**
 * Demould station: chain hoist on a cream beam with an orange hoist block
 * (hoist photo). The hoist follows the simulator's demould phases: hook down,
 * lift the tank out of the open mould, travel, set down. Tanks wait on the
 * floor while they are finished, then join the buffer rows.
 */
export function DemouldStation({ onSelect }: { onSelect?: () => void }) {
  const plant = usePlant();
  const M = mats();
  const trolley = useRef<THREE.Group>(null);
  const chain = useRef<THREE.Mesh>(null);
  const hook = useRef<THREE.Group>(null);
  const carried = useRef<(THREE.Group | null)[]>([]);
  const finishing = useRef<(THREE.Group | null)[][]>(KINDS.map(() => []));
  const buffer = useRef<(THREE.Group | null)[][]>(KINDS.map(() => []));
  const demouldPos = useMemo(() => new THREE.Vector3(...polar(R_ARM, STATION_DEG.demould)), []);
  const setDown = useMemo(() => new THREE.Vector3(...SET_DOWN), []);
  const dir = useMemo(() => setDown.clone().sub(demouldPos).setY(0), [setDown, demouldPos]);
  const beamLen = dir.length() + 3.2;
  const beamYaw = Math.atan2(-dir.z, dir.x);
  const maxBuffer = { CTT4: 8, CTT2: 12, HTT2: 12, OTHER: 6 };

  useFrame(() => {
    const s = plant.get();
    const d = s.demould;
    const arm = d.arm !== null ? s.arms[d.arm] : undefined;
    // Hook position in machine coordinates.
    let pos = demouldPos.clone().setY(BEAM_Y - 1.4);
    let tankBaseY: number | null = null;
    let swing = 0;
    if (arm && d.kind && d.mouldIndex >= 0 && arm.stage === 'demoulding') {
      const slots = mouldSlots(arm.moulds);
      const slot = slots[d.mouldIndex]!;
      // The demould arm points along -x, so a slot offset along the arm is along -x here.
      const over = demouldPos.clone().add(new THREE.Vector3(-slot[0], 0, 0));
      const seat = H_ARM + mouldSeatY(d.kind) - (d.kind === 'HTT2' ? 0.7 : d.kind === 'OTHER' ? 0.75 : d.kind === 'CTT4' ? 1.175 : 0.86);
      const tankH = TANK_DIM[d.kind].h + (d.kind === 'HTT2' ? 0.3 : 0.15);
      const high = BEAM_Y - 1.15 - tankH;
      const e = useTwin.getState().reduced ? (d.hoistProgress < 0.5 ? 0 : 1) : easeInOutCubic(d.hoistProgress);
      switch (d.hoist) {
        case 'hookDown':
          pos = over.clone().setY(BEAM_Y - 1.4 + (seat + tankH - (BEAM_Y - 1.4)) * e);
          break;
        case 'lift':
          tankBaseY = seat + (high - seat) * e;
          pos = over.clone().setY(tankBaseY + tankH);
          swing = Math.sin(d.hoistProgress * Math.PI * 3) * 0.025 * (1 - d.hoistProgress);
          break;
        case 'traverse': {
          const p = over.clone().lerp(setDown, e);
          tankBaseY = high;
          pos = p.setY(high + tankH);
          swing = Math.sin(d.hoistProgress * Math.PI * 2) * 0.05 * Math.sin(Math.PI * d.hoistProgress);
          break;
        }
        case 'setDown':
          tankBaseY = high * (1 - e);
          pos = setDown.clone().setY(tankBaseY + tankH);
          swing = Math.sin(d.hoistProgress * Math.PI * 3) * 0.02 * (1 - d.hoistProgress);
          break;
        case 'return':
          pos = setDown.clone().lerp(demouldPos, e).setY(tankH + (BEAM_Y - 1.4 - tankH) * e);
          break;
        default:
      }
    }
    if (trolley.current) trolley.current.position.set(pos.x, BEAM_Y, pos.z);
    if (hook.current) hook.current.position.set(pos.x, pos.y, pos.z);
    if (chain.current) {
      const len = Math.max(0.05, BEAM_Y - 0.35 - pos.y);
      chain.current.position.set(pos.x, pos.y + len / 2, pos.z);
      chain.current.scale.y = len;
    }
    KINDS.forEach((k, i) => {
      const g = carried.current[i];
      if (!g) return;
      g.visible = tankBaseY !== null && d.kind === k;
      if (g.visible) {
        g.position.set(pos.x, tankBaseY!, pos.z);
        g.rotation.z = useTwin.getState().reduced ? 0 : swing;
      }
    });
    // Tanks on the floor being finished, then the buffer rows.
    const waiting: Record<MouldKind, number> = { CTT4: 0, CTT2: 0, HTT2: 0, OTHER: 0 };
    const spotOf: number[][] = KINDS.map(() => []);
    s.finishing.forEach((k, idx) => {
      // The tank still on the hook is drawn by the hoist, not on the floor.
      if (idx === s.finishing.length - 1 && tankBaseY !== null && k === d.kind) return;
      spotOf[KINDS.indexOf(k)]!.push(idx);
      waiting[k] += 1;
    });
    KINDS.forEach((k, i) => {
      finishing.current[i]!.forEach((g, j) => {
        if (!g) return;
        const spot = spotOf[i]![j];
        g.visible = spot !== undefined;
        if (spot !== undefined) g.position.set(...FINISH_SPOTS[Math.min(spot, FINISH_SPOTS.length - 1)]!);
      });
      buffer.current[i]!.forEach((g, j) => g && (g.visible = j < s.finished[k]));
    });
  });

  return (
    <group onClick={(e) => e.delta < 6 && (e.stopPropagation(), onSelect?.())}>
      {/* Beam on two portal frames */}
      <group position={[demouldPos.x, 0, demouldPos.z]} rotation={[0, beamYaw, 0]}>
        <Box size={[beamLen, 0.36, 0.22]} position={[beamLen / 2 - 1.4, BEAM_Y + 0.4, 0]} material={M.cream} radius={0.02} />
        <Box size={[beamLen, 0.05, 0.34]} position={[beamLen / 2 - 1.4, BEAM_Y + 0.2, 0]} material={M.cream} radius={0.01} />
        {/* Both frames stand outside the circle the arms sweep; the beam reaches in over the mould. */}
        {[3.3, beamLen - 1.7].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            {[-1, 1].map((sgn) => (
              <Bar key={sgn} from={[0, 0, sgn * 2.3]} to={[0, BEAM_Y + 0.5, sgn * 0.45]} r={0.09} material={M.cream} />
            ))}
            <Box size={[0.2, 0.2, 1.2]} position={[0, BEAM_Y + 0.52, 0]} material={M.cream} radius={0.03} />
            <Bar from={[0, 3.6, -1.37]} to={[0, 3.6, 1.37]} r={0.05} material={M.cream} />
            {[-1, 1].map((sgn) => (
              <Box key={sgn} size={[0.5, 0.06, 0.5]} position={[0, 0.03, sgn * 2.3]} material={M.creamDark} radius={0.01} />
            ))}
          </group>
        ))}
        <Bar from={[3.3, BEAM_Y + 0.5, 0]} to={[-1.2, BEAM_Y + 1.5, 0]} r={0.035} material={M.steelDark} />
        <Bar from={[3.3, BEAM_Y + 0.5, 0]} to={[3.3, BEAM_Y + 1.6, 0]} r={0.06} material={M.cream} />
        <Bar from={[3.3, BEAM_Y + 1.6, 0]} to={[-1.2, BEAM_Y + 0.6, 0]} r={0.03} material={M.steelDark} />
      </group>
      {/* Hoist block (orange), chain and hook */}
      <group ref={trolley}>
        <Box size={[0.5, 0.22, 0.4]} position={[0, 0.02, 0]} material={M.steelDark} radius={0.03} />
        <Box size={[0.62, 0.46, 0.42]} position={[0, -0.34, 0]} material={M.hoist} radius={0.06} />
        <Cyl r={0.15} h={0.5} position={[0.1, -0.34, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.steelDark} segments={14} />
        {/* Pendant control on its cable, within reach of the platform */}
        <Bar from={[0.3, -0.5, 0.3]} to={[0.3, -4.6, 0.3]} r={0.012} material={M.rubber} segments={5} />
        <Box size={[0.1, 0.3, 0.08]} position={[0.3, -4.75, 0.3]} material={M.yellow} radius={0.015} />
      </group>
      <mesh ref={chain} material={M.chain} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 1, 6]} />
      </mesh>
      <group ref={hook}>
        <Cyl r={0.08} h={0.2} position={[0, 0.02, 0]} material={M.hoist} segments={10} />
        {/* Four-leg sling down to the tank shoulders */}
        {[0, 1, 2, 3].map((i) => (
          <Bar key={i} from={[0, -0.05, 0]} to={[Math.cos((i * Math.PI) / 2 + 0.78) * 0.5, -0.5, Math.sin((i * Math.PI) / 2 + 0.78) * 0.5]} r={0.014} material={M.chain} segments={5} />
        ))}
      </group>
      {KINDS.map((k, i) => (
        <Tank key={k} kind={k} ref={(el) => void (carried.current[i] = el)} visible={false} />
      ))}
      {/* Working platform beside the mould, with stairs (hoist photo) */}
      <group position={[demouldPos.x - 0.6, 0, demouldPos.z + 3.1]}>
        <Box size={[3.4, 0.12, 1.5]} position={[0, 1.2, 0]} material={M.cream} radius={0.02} />
        {[-1.6, 1.6].flatMap((x) => [-0.65, 0.65].map((z) => <Box key={`${x}${z}`} size={[0.1, 1.2, 0.1]} position={[x, 0.6, z]} material={M.cream} radius={0.015} />))}
        <group position={[0, 1.26, 0]}>
          <Railing points={[[-1.65, 0, -0.7], [-1.65, 0, 0.7], [1.65, 0, 0.7], [1.65, 0, -0.7]]} />
        </group>
        <group position={[-1.75, 0, -0.2]} rotation={[0, Math.PI, 0]}>
          <group position={[-0.0, 0, 0]}>
            <group position={[0, 0, 0]} scale={[1, 1, 1]}>
              <group position={[1.8, 0, 0]} rotation={[0, Math.PI, 0]}>
                <Stairs rise={1.2} run={1.8} width={0.8} />
              </group>
            </group>
          </group>
        </group>
      </group>
      {/* Finishing spots and buffer rows */}
      {KINDS.map((k, i) => (
        <group key={k}>
          {[0, 1, 2].map((j) => (
            <Tank key={`f${j}`} kind={k} ref={(el) => void (finishing.current[i]![j] = el)} visible={false} />
          ))}
          {Array.from({ length: maxBuffer[k] }, (_, j) => {
            const b = BUFFER[k];
            return (
              <Tank
                key={`b${j}`}
                kind={k}
                ref={(el) => void (buffer.current[i]![j] = el)}
                visible={false}
                position={[b.origin[0] + (j % b.perRow) * b.dx, 0, b.origin[1] + Math.floor(j / b.perRow) * b.dz]}
              />
            );
          })}
        </group>
      ))}
    </group>
  );
}
