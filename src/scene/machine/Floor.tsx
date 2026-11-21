import { useMemo } from 'react';
import * as THREE from 'three';
import { mats } from '../materials';
import { DEG, R_ARM, STATION_DEG, polar } from '../layout';
import { usePlant } from '../plant';
import { FloorRing } from '../parts';

/** A thin painted line on the floor through plan points. */
function FloorLine({ points, width, material }: { points: [number, number][]; width: number; material: THREE.Material }) {
  const geo = useMemo(() => {
    const shape: THREE.Vector2[] = [];
    const left: THREE.Vector2[] = [];
    const right: THREE.Vector2[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = new THREE.Vector2(...points[i]!);
      const a = new THREE.Vector2(...points[Math.max(0, i - 1)]!);
      const b = new THREE.Vector2(...points[Math.min(points.length - 1, i + 1)]!);
      const dir = b.sub(a).normalize();
      const nrm = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(width / 2);
      left.push(p.clone().add(nrm));
      right.push(p.clone().sub(nrm));
    }
    shape.push(...left, ...right.reverse());
    return new THREE.ShapeGeometry(new THREE.Shape(shape));
  }, [points, width]);
  // Shape is drawn in plan x,y; lay it on the floor (plan y = -z).
  return <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]} material={material} receiveShadow />;
}

/**
 * Floor markings round the machine: the yellow line the manual asks operators to
 * stay behind while arms move, and the red line round the hot side. The epoxy
 * floor itself belongs to the hall (src/scene/hall/Hall.tsx).
 */
export function Floor() {
  const M = mats();
  const ring = usePlant().result.ring;
  const redLine = useMemo<[number, number][]>(() => {
    // From the end of the yellow arc, round the oven and the hot air position, back to the cooling chamber.
    const pts: [number, number][] = [];
    const p = (r: number, a: number): [number, number] => [r * Math.cos(a * DEG), r * Math.sin(a * DEG)];
    pts.push(p(8.6, -32), [9.6, -3.6], [9.6, 3.6], p(9.4, 28));
    for (let a = 36; a <= 100; a += 8) pts.push(p(8.6, a));
    return pts;
  }, []);
  return (
    <group>
      {/* Yellow line: from the cooling console round the front to the cooking console (manual plan view). */}
      <group rotation={[0, 150 * DEG, 0]}>
        <FloorRing r={8.6} width={0.26} material={M.yellow} arc={178 * DEG} start={0} />
      </group>
      <FloorLine points={redLine} width={0.2} material={M.red} />
      {/* Position marks under each mould swing, as on the plan view. */}
      {ring.map((st) => (
        <group key={st} position={polar(R_ARM, STATION_DEG[st])}>
          <FloorRing r={1.95} width={0.035} material={M.creamDark} y={0.008} />
        </group>
      ))}
    </group>
  );
}

/** A plain epoxy slab for views that show the machine on its own, outside the hall (the Redesign page). */
export function MachineSlab() {
  const M = mats();
  const slab = useMemo(() => {
    const s = new THREE.Shape();
    const w = 18.6;
    const d = 13.6;
    const r = 1.2;
    s.absarc(w - r, d - r, r, 0, Math.PI / 2);
    s.absarc(-w + r, d - r, r, Math.PI / 2, Math.PI);
    s.absarc(-w + r, -d + r, r, Math.PI, Math.PI * 1.5);
    s.absarc(w - r, -d + r, r, Math.PI * 1.5, Math.PI * 2);
    return s;
  }, []);
  return (
    <group position={[-3.6, 0, -1.2]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} material={M.plinth} receiveShadow>
        <extrudeGeometry args={[slab, { depth: 0.5, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 }]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} material={M.epoxy} receiveShadow>
        <shapeGeometry args={[slab, 24]} />
      </mesh>
    </group>
  );
}
