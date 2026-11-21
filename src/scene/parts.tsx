/**
 * Small building blocks used all over the plant: boxes with eased edges,
 * railings, stairs, ladders, motors, panelled walls. Everything is primitives
 * and simple extrusions, modelled for this scene.
 */
import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { mats } from './materials';

type V3 = [number, number, number];

export function Box({
  size,
  position,
  rotation,
  material,
  radius = 0.03,
  shadow = true,
  children,
}: {
  size: V3;
  position?: V3;
  rotation?: V3;
  material: THREE.Material;
  radius?: number;
  shadow?: boolean;
  children?: ReactNode;
}) {
  const r = Math.min(radius, Math.min(...size) / 2 - 0.001);
  return (
    <RoundedBox args={size} radius={Math.max(0.002, r)} smoothness={2} position={position} rotation={rotation} material={material} castShadow={shadow} receiveShadow>
      {children}
    </RoundedBox>
  );
}

export function Cyl({
  r,
  h,
  position,
  rotation,
  material,
  segments = 28,
  rTop,
  open = false,
  shadow = true,
}: {
  r: number;
  h: number;
  position?: V3;
  rotation?: V3;
  material: THREE.Material;
  segments?: number;
  rTop?: number;
  open?: boolean;
  shadow?: boolean;
}) {
  return (
    <mesh position={position} rotation={rotation} material={material} castShadow={shadow} receiveShadow>
      <cylinderGeometry args={[rTop ?? r, r, h, segments, 1, open]} />
    </mesh>
  );
}

/** A straight round bar between two points. */
export function Bar({ from, to, r = 0.03, material, segments = 8 }: { from: V3; to: V3; r?: number; material: THREE.Material; segments?: number }) {
  const { pos, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const d = b.clone().sub(a);
    const len = d.length();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return { pos: a.add(b).multiplyScalar(0.5), quat, len };
  }, [from, to]);
  return (
    <mesh position={pos} quaternion={quat} material={material} castShadow receiveShadow>
      <cylinderGeometry args={[r, r, len, segments]} />
    </mesh>
  );
}

/** Handrail along a polyline on a deck: posts, top rail, mid rail, kick plate. */
export function Railing({ points, height = 1.05, material, spacing = 1.1 }: { points: V3[]; height?: number; material?: THREE.Material; spacing?: number }) {
  const m = material ?? mats().cream;
  const parts: ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const n = Math.max(1, Math.round(len / spacing));
    for (let k = 0; k <= n; k++) {
      if (k === 0 && i > 0) continue;
      const f = k / n;
      const x = a[0] + (b[0] - a[0]) * f;
      const y = a[1] + (b[1] - a[1]) * f;
      const z = a[2] + (b[2] - a[2]) * f;
      parts.push(<Bar key={`p${i}-${k}`} from={[x, y, z]} to={[x, y + height, z]} r={0.028} material={m} />);
    }
    parts.push(<Bar key={`t${i}`} from={[a[0], a[1] + height, a[2]]} to={[b[0], b[1] + height, b[2]]} r={0.032} material={m} />);
    parts.push(<Bar key={`m${i}`} from={[a[0], a[1] + height * 0.52, a[2]]} to={[b[0], b[1] + height * 0.52, b[2]]} r={0.022} material={m} />);
  }
  return <group>{parts}</group>;
}

/** Straight stair rising along +x from the origin. */
export function Stairs({ width = 0.9, rise, run, material, rails = true }: { width?: number; rise: number; run: number; material?: THREE.Material; rails?: boolean }) {
  const m = material ?? mats().cream;
  const steps = Math.max(2, Math.round(rise / 0.2));
  const dx = run / steps;
  const dy = rise / steps;
  const slope = Math.atan2(rise, run);
  const len = Math.hypot(rise, run);
  return (
    <group>
      {Array.from({ length: steps }, (_, i) => (
        <Box key={i} size={[dx * 0.92, 0.04, width]} position={[dx * (i + 0.5), dy * (i + 1) - 0.02, 0]} material={m} radius={0.01} />
      ))}
      {[-1, 1].map((s) => (
        <Box key={s} size={[len, 0.2, 0.04]} position={[run / 2, rise / 2, (s * width) / 2]} rotation={[0, 0, slope]} material={m} radius={0.01} />
      ))}
      {rails &&
        [-1, 1].map((s) => (
          <Railing key={s} points={[[0, 0, (s * width) / 2], [run, rise, (s * width) / 2]]} height={0.95} material={m} spacing={1.3} />
        ))}
    </group>
  );
}

/** Vertical ladder with a safety cage, as on the chamber drawings. */
export function Ladder({ height, cage = true, material }: { height: number; cage?: boolean; material?: THREE.Material }) {
  const m = material ?? mats().blue;
  const rungs = Math.round(height / 0.3);
  return (
    <group>
      <Bar from={[-0.22, 0, 0]} to={[-0.22, height + 1, 0]} r={0.025} material={m} />
      <Bar from={[0.22, 0, 0]} to={[0.22, height + 1, 0]} r={0.025} material={m} />
      {Array.from({ length: rungs }, (_, i) => (
        <Bar key={i} from={[-0.22, 0.3 * (i + 1), 0]} to={[0.22, 0.3 * (i + 1), 0]} r={0.015} material={m} segments={6} />
      ))}
      {cage &&
        Array.from({ length: Math.max(1, Math.floor((height - 2) / 0.9)) }, (_, i) => (
          <mesh key={`c${i}`} position={[0, 2.2 + i * 0.9, 0.34]} rotation={[Math.PI / 2, 0, 0]} material={m} castShadow>
            <torusGeometry args={[0.36, 0.015, 6, 20, Math.PI * 1.25]} />
          </mesh>
        ))}
    </group>
  );
}

/** Electric motor: finned body, end bell, terminal box, shaft stub. Axis along +x. */
export function Motor({ length = 0.55, r = 0.16, material }: { length?: number; r?: number; material?: THREE.Material }) {
  const M = mats();
  const m = material ?? M.blue;
  return (
    <group>
      <Cyl r={r} h={length} rotation={[0, 0, Math.PI / 2]} material={m} segments={20} />
      {Array.from({ length: 7 }, (_, i) => (
        <Cyl key={i} r={r * 1.1} h={length * 0.05} position={[-length * 0.36 + (i * length * 0.72) / 6, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m} segments={20} />
      ))}
      <Cyl r={r * 1.12} h={length * 0.14} position={[-length * 0.52, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={M.blueDark} segments={20} />
      <Box size={[length * 0.3, r * 0.6, r * 0.9]} position={[0, r * 1.05, 0]} material={M.blueDark} radius={0.015} />
      <Cyl r={r * 0.28} h={length * 0.3} position={[length * 0.62, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={M.steel} segments={12} />
    </group>
  );
}

/**
 * A wall of raised panels on a backing sheet, in the x-y plane, facing +z,
 * centred on the origin. This is what makes the oven read as "panelled".
 */
export function PanelWall({ w, h, cols, rows, material, depth = 0.08, gap = 0.07, ribs = true }: { w: number; h: number; cols: number; rows: number; material: THREE.Material; depth?: number; gap?: number; ribs?: boolean }) {
  const M = mats();
  const pw = (w - gap * (cols + 1)) / cols;
  const ph = (h - gap * (rows + 1)) / rows;
  return (
    <group>
      <Box size={[w, h, depth]} material={M.creamDark} radius={0.01} />
      {Array.from({ length: cols * rows }, (_, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        return (
          <Box key={i} size={[pw, ph, depth * 0.7]} position={[-w / 2 + gap + pw / 2 + c * (pw + gap), -h / 2 + gap + ph / 2 + r * (ph + gap), depth * 0.5]} material={material} radius={0.025} />
        );
      })}
      {ribs &&
        Array.from({ length: cols + 1 }, (_, c) => (
          <Box key={`r${c}`} size={[0.09, h, depth * 0.5]} position={[-w / 2 + gap / 2 + c * (pw + gap), 0, depth * 0.95]} material={material} radius={0.012} />
        ))}
    </group>
  );
}

/** Flat ring on the floor (markings, bottleneck cue). */
export function FloorRing({ r, width, material, y = 0.012, arc = Math.PI * 2, start = 0 }: { r: number; width: number; material: THREE.Material; y?: number; arc?: number; start?: number }) {
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material} receiveShadow>
      <ringGeometry args={[r - width / 2, r + width / 2, 96, 1, start, arc]} />
    </mesh>
  );
}
