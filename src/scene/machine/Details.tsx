/**
 * Small parts that make the machine read as real equipment rather than
 * blocks: bolts, a nameplate, hazard stripes, cable runs, pipes. All static.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mats } from '../materials';
import { signTexture, type SignSpec } from '../hall/signs';
import { Bar, Box, Cyl } from '../parts';
import { DEG, H_ARM, R_ARM, STATION_DEG, polar } from '../layout';

type V3 = [number, number, number];

/** A flat printed plate: nameplates, numbers, stickers. Faces +z. */
export function Plate({ spec, position, rotation }: { spec: SignSpec; position?: V3; rotation?: V3 }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: signTexture(spec), roughness: 0.55, metalness: 0.1 }), [spec]);
  return (
    <mesh position={position} rotation={rotation} material={mat}>
      <planeGeometry args={spec.size} />
    </mesh>
  );
}

/** A ring of hex-head bolts, drawn as one instanced mesh. Axis is vertical. */
export function BoltCircle({ r, count, y, size = 0.045, material }: { r: number; count: number; y: number; size?: number; material?: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const M = mats();
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      m.makeRotationY(-a).setPosition(Math.cos(a) * r, y, Math.sin(a) * r);
      ref.current!.setMatrixAt(i, m);
    }
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [r, count, y]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} material={material ?? M.steel} castShadow>
      <cylinderGeometry args={[size, size, size * 0.9, 6]} />
    </instancedMesh>
  );
}

const NAMEPLATE: SignSpec = { lines: ['Machine 3700', 'Polivinil Rotomachinery'], size: [1.15, 0.5], bg: '#C9CDD0', fg: '#1B1D1F', border: '#1B1D1F' };

/** Hub: bolted bearing ring, maker's plate (inventory row 36), hazard stripes at the base, cable run to the console. */
export function HubDetails() {
  const M = mats();
  const stripes = 20;
  return (
    <group>
      <BoltCircle r={1.55} count={28} y={H_ARM - 0.02} />
      <BoltCircle r={1.9} count={20} y={0.235} size={0.05} />
      {/* Maker's plate on the side of the drum that faces the open front of the hall */}
      <group rotation={[0, 16 * DEG, 0]}>
        <Plate spec={NAMEPLATE} position={[0, 1.55, 1.462]} />
        <Box size={[1.23, 0.58, 0.02]} position={[0, 1.55, 1.452]} material={M.steelDark} radius={0.005} shadow={false} />
      </group>
      {/* Yellow and black stripes round the turret base: the arms sweep here */}
      <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]} material={M.yellow}>
        <ringGeometry args={[2.05, 2.38, 64]} />
      </mesh>
      {Array.from({ length: stripes }, (_, i) => (
        <mesh key={i} position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} material={M.rubber}>
          <ringGeometry args={[2.05, 2.38, 4, 1, (i / stripes) * Math.PI * 2, (Math.PI / stripes) * 0.9]} />
        </mesh>
      ))}
      {/* Cable trunking across the floor from the turret to the console, with a junction box */}
      <Box size={[0.3, 0.05, 7.6]} position={[2.6, 0.026, 5.6]} rotation={[0, 0.5, 0]} material={M.rubber} radius={0.012} shadow={false} />
      <Box size={[0.5, 0.36, 0.4]} position={[1.0, 0.2, 2.3]} material={M.console} radius={0.03} />
    </group>
  );
}

const STICKER: SignSpec = { lines: ['Hot surface'], size: [1.5, 0.5], mark: 'warning', bg: '#E4B62B', fg: '#17191B', border: '#17191B' };

/** Oven: a diesel line to the burner (inventory row 58: the oven burns diesel) and a warning sticker on the end wall. */
export function OvenDetails({ cx, hx }: { cx: number; hx: number }) {
  const M = mats();
  return (
    <group position={[cx, 0, 0]}>
      <Plate spec={STICKER} position={[hx + 0.02, 2.75, 0.55]} rotation={[0, Math.PI / 2, 0]} />
      {/* Fuel line: up from the floor, along the wall, into the burner */}
      <Bar from={[hx + 0.14, 0.05, -2.1]} to={[hx + 0.14, 1.5, -2.1]} r={0.03} material={M.galvanised} />
      <Bar from={[hx + 0.14, 1.5, -2.1]} to={[hx + 0.14, 1.5, -1.3]} r={0.03} material={M.galvanised} />
      <Cyl r={0.07} h={0.12} position={[hx + 0.14, 0.9, -2.1]} material={M.red} segments={10} />
      <Bar from={[hx + 0.14, 0.05, -2.1]} to={[hx + 3.4, 0.05, -2.1]} r={0.03} material={M.galvanised} />
      {/* Local control box with a conduit up the wall */}
      <Box size={[0.12, 0.7, 0.55]} position={[hx + 0.08, 1.5, 2.0]} material={M.console} radius={0.02} />
      <Bar from={[hx + 0.08, 1.85, 2.0]} to={[hx + 0.08, 4.6, 2.0]} r={0.022} material={M.steelDark} />
    </group>
  );
}

/** Cooling chamber: the water line up the shell to the spray ring, and a floor drain. */
export function CoolingDetails() {
  const M = mats();
  const c = polar(R_ARM, STATION_DEG.chamber);
  return (
    <group position={c} rotation={[0, STATION_DEG.chamber * DEG, 0]}>
      <Bar from={[2.74, 0.1, -0.9]} to={[2.74, 4.7, -0.9]} r={0.04} material={M.blue} />
      <Bar from={[2.74, 4.7, -0.9]} to={[2.2, 4.75, -0.7]} r={0.04} material={M.blue} />
      <Cyl r={0.09} h={0.16} position={[2.74, 1.1, -0.9]} material={M.red} segments={10} />
      <Bar from={[2.74, 0.1, -0.9]} to={[5.6, 0.1, -0.9]} r={0.04} material={M.blue} />
      {/* Drain grate at the open side */}
      <Box size={[0.5, 0.03, 2.2]} position={[-2.9, 0.016, 0]} material={M.steelDark} radius={0.005} shadow={false} />
      {Array.from({ length: 9 }, (_, i) => (
        <Box key={i} size={[0.42, 0.01, 0.05]} position={[-2.9, 0.034, -0.96 + i * 0.24]} material={M.rubber} radius={0.002} shadow={false} />
      ))}
    </group>
  );
}
