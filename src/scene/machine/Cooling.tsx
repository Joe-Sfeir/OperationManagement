import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { clock, useTwin } from '../../app/store';
import { usePlant } from '../plant';
import { mats } from '../materials';
import { Bar, Box, Cyl, FloorRing, Ladder, Railing } from '../parts';
import { DEG, R_ARM, STATION_DEG, polar } from '../layout';

const R = 2.62;
const H = 4.9;
// The shell covers the outer side; the side facing the hub is open so arms can swing through.
const SHELL_ARC = 196 * DEG;

/**
 * Cooling chamber: blue cylindrical shell open on one side, yellow inside,
 * with a fan and a water spray ring (cooling chamber drawing). The fan turns
 * and the mist shows only in the water phase the simulator reports.
 */
export function CoolingChamber({ onSelect }: { onSelect?: () => void }) {
  const plant = usePlant();
  const M = mats();
  const fan = useRef<THREE.Group>(null);
  const mist = useRef<THREE.Group>(null);
  const mistMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#CFE4EA', transparent: true, opacity: 0, depthWrite: false }), []);
  const drops = useMemo(() => Array.from({ length: 40 }, (_, i) => ({ a: (i * 137.5 * Math.PI) / 180, r: 0.5 + ((i * 0.618) % 1) * 1.5, ph: (i * 0.37) % 1 })), []);
  const start = Math.PI / 2 - SHELL_ARC / 2;

  useFrame(() => {
    const s = plant.get();
    const arm = s.cooling.chamberArm !== null ? s.arms[s.cooling.chamberArm] : undefined;
    if (fan.current) {
      // The fan runs through the water phase. Its on-screen rate is scaled to stay readable (see docs/MODEL.md).
      const { speed } = useTwin.getState();
      const turns = arm && s.cooling.fanOn ? Math.max(1, Math.round(((arm.stageDurMin * 60) / Math.max(1, speed)) * 1.4)) : 0;
      fan.current.rotation.x = arm && s.cooling.fanOn ? Math.PI * 2 * turns * arm.stageProgress : 0;
    }
    if (mist.current) {
      const on = s.cooling.mistOn && arm ? Math.min(1, arm.stageProgress * 12, (1 - arm.stageProgress) * 12) : 0;
      mistMat.opacity = on * 0.09;
      mist.current.visible = on > 0.001;
      mist.current.children.forEach((c, i) => {
        const d = drops[i]!;
        const p = (clock.t * 1.3 + d.ph) % 1;
        c.position.set(Math.cos(d.a) * d.r, 4.2 - p * 3.6, Math.sin(d.a) * d.r);
      });
    }
  });

  return (
    <group position={polar(R_ARM, STATION_DEG.chamber)} rotation={[0, STATION_DEG.chamber * DEG, 0]} onClick={(e) => (e.stopPropagation(), onSelect?.())}>
      {/* Base ring and yellow floor */}
      <Cyl r={R + 0.1} h={0.16} position={[0, 0.08, 0]} material={M.blueDark} segments={56} />
      <Cyl r={R - 0.08} h={0.04} position={[0, 0.17, 0]} material={M.yellowInner} segments={56} />
      {/* Shell: blue outside, yellow inside */}
      <mesh position={[0, H / 2 + 0.16, 0]} material={M.blue} castShadow receiveShadow>
        <cylinderGeometry args={[R, R, H, 56, 1, true, start, SHELL_ARC]} />
      </mesh>
      <mesh position={[0, H / 2 + 0.16, 0]} castShadow={false} receiveShadow>
        <cylinderGeometry args={[R - 0.06, R - 0.06, H, 56, 1, true, start, SHELL_ARC]} />
        <meshStandardMaterial {...{ color: M.yellowInner.color, roughness: 0.8, side: THREE.BackSide }} />
      </mesh>
      {/* Stiffening hoops and posts at the edges of the opening */}
      {[0.9, 2.5, 4.1].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2 - start - SHELL_ARC]} material={M.blueDark} castShadow>
          <torusGeometry args={[R + 0.03, 0.05, 8, 48, SHELL_ARC]} />
        </mesh>
      ))}
      {[start, start + SHELL_ARC].map((a) => (
        <Box key={a} size={[0.2, H + 0.1, 0.2]} position={[Math.sin(a) * R, H / 2 + 0.16, Math.cos(a) * R]} material={M.red} radius={0.03} />
      ))}
      {/* Roof deck with rail, stack and the angled exhaust duct */}
      <Cyl r={R + 0.12} h={0.16} position={[0, H + 0.24, 0]} material={M.blueDark} segments={56} />
      <Cyl r={R - 0.1} h={0.04} position={[0, H + 0.14, 0]} material={M.yellowInner} segments={56} />
      <group position={[0, H + 0.32, 0]}>
        <Railing
          material={M.blue}
          points={Array.from({ length: 13 }, (_, i) => {
            const a = start - 0.1 + ((SHELL_ARC + 0.2) * i) / 12;
            return [Math.sin(a) * (R - 0.05), 0, Math.cos(a) * (R - 0.05)] as [number, number, number];
          })}
          spacing={3}
        />
        <Cyl r={0.5} h={1.5} position={[0.5, 0.75, 0]} material={M.galvanised} segments={24} />
        <Cyl r={0.56} h={0.08} position={[0.5, 1.52, 0]} material={M.galvanised} segments={24} />
      </group>
      <group position={[1.9, 3.9, -1.9]} rotation={[0, 0, -0.9]}>
        <Cyl r={0.5} h={1.7} material={M.galvanised} segments={22} />
        <Cyl r={0.56} h={0.1} position={[0, 0.86, 0]} material={M.galvanised} segments={22} />
      </group>
      <group position={[R + 0.04, 0, 1.2]} rotation={[0, Math.PI / 2, 0]}>
        <Ladder height={H + 0.3} material={M.red} />
      </group>
      {/* Fan on the back wall, facing the mould */}
      <group position={[R - 0.5, 2.5, 0]}>
        <Cyl r={0.95} h={0.4} rotation={[0, 0, Math.PI / 2]} material={M.rubber} segments={32} open />
        <mesh rotation={[0, Math.PI / 2, 0]} material={M.rubber} castShadow>
          <torusGeometry args={[0.95, 0.05, 8, 32]} />
        </mesh>
        <group ref={fan}>
          <Cyl r={0.16} h={0.3} rotation={[0, 0, Math.PI / 2]} material={M.steelDark} segments={14} />
          {Array.from({ length: 6 }, (_, i) => (
            <group key={i} rotation={[(i * Math.PI) / 3, 0, 0]}>
              <Box size={[0.03, 0.72, 0.3]} position={[0, 0.5, 0]} rotation={[0, 0.5, 0]} material={M.steelDark} radius={0.01} />
            </group>
          ))}
        </group>
        <Bar from={[0.2, -0.95, 0]} to={[0.2, 0.95, 0]} r={0.025} material={M.steelDark} />
        <Bar from={[0.2, 0, -0.95]} to={[0.2, 0, 0.95]} r={0.025} material={M.steelDark} />
      </group>
      {/* Water spray ring under the roof */}
      <mesh position={[0, H - 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.galvanised}>
        <torusGeometry args={[1.9, 0.04, 6, 40]} />
      </mesh>
      <group ref={mist} visible={false}>
        {drops.map((_, i) => (
          <mesh key={i} material={mistMat}>
            <sphereGeometry args={[0.11, 6, 5]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** The open position where the arm starts to cool in still air, inside the red line. */
export function AirPosition() {
  const M = mats();
  return (
    <group position={polar(R_ARM, STATION_DEG.air)}>
      <FloorRing r={2.05} width={0.1} material={M.red} y={0.011} />
    </group>
  );
}
