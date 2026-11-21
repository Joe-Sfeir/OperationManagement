/**
 * Small parts used only in the raw-material hall. `Plain` and `Boxes` are
 * square-edged boxes for members too small for an eased edge to show
 * (legs, slats, plates): they keep the triangle count down.
 */
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { mats } from '../materials';
import { Cyl } from '../parts';

export type V3 = [number, number, number];

export function Plain({ size, position, rotation, material, shadow = true }: { size: V3; position?: V3; rotation?: V3; material: THREE.Material; shadow?: boolean }) {
  return (
    <mesh position={position} rotation={rotation} material={material} castShadow={shadow} receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

export interface BoxItem {
  /** Centre, size, rotation. */
  p: V3;
  s: V3;
  r?: V3;
}

/** Many square-edged boxes in one draw call. `items` must be a stable array. */
export function Boxes({ items, material, shadow = true }: { items: BoxItem[]; material: THREE.Material; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    items.forEach((it, i) => {
      o.position.set(...it.p);
      o.rotation.set(...(it.r ?? [0, 0, 0]));
      o.scale.set(...it.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} material={material} castShadow={shadow} receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

/** A small gear motor for dosing screws and valves: body, end cap, terminal box. Axis along +x. */
export function MiniMotor({ length = 0.26, r = 0.07 }: { length?: number; r?: number }) {
  const M = mats();
  return (
    <group>
      <Cyl r={r} h={length} rotation={[0, 0, Math.PI / 2]} material={M.blue} segments={12} />
      <Cyl r={r * 1.12} h={length * 0.16} position={[-length * 0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={M.blueDark} segments={12} />
      <Plain size={[length * 0.34, r * 0.6, r * 0.9]} position={[0, r * 1.05, 0]} material={M.blueDark} />
    </group>
  );
}

/** A round pipe through points, with a ball at each bend. */
export function Pipe({ points, r, material, segments = 12 }: { points: V3[]; r: number; material: THREE.Material; segments?: number }) {
  return (
    <group>
      {points.slice(0, -1).map((a, i) => {
        const b = points[i + 1]!;
        const va = new THREE.Vector3(...a);
        const d = new THREE.Vector3(...b).sub(va);
        const len = d.length();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
        return (
          <mesh key={i} position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]} quaternion={quat} material={material} castShadow receiveShadow>
            <cylinderGeometry args={[r, r, len, segments, 1, true]} />
          </mesh>
        );
      })}
      {points.slice(1, -1).map((p, i) => (
        <mesh key={`j${i}`} position={p} material={material} castShadow>
          <sphereGeometry args={[r * 1.02, segments, 8]} />
        </mesh>
      ))}
    </group>
  );
}
