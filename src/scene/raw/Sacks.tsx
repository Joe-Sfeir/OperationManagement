import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { clock } from '../../app/store';
import { usePlant } from '../plant';
import { mats } from '../materials';
import { Boxes, type BoxItem } from './bits';
import { PALLETS } from './layout';

/** One sack of resin. Assumption (NOTES.md): 25 kg bags. */
export const SACK_KG = 25;
const LAYERS = 4;
const PER_LAYER = 5;
// Sack lying flat: length, thickness, width.
const SL = 0.6;
const SH = 0.15;
const SW = 0.4;
const PALLET_H = 0.144;

/** A 1.2 x 1.0 m block pallet: skids, blocks, stringers, deck boards. */
function palletBoards(cx: number, cz: number): BoxItem[] {
  const items: BoxItem[] = [];
  for (const z of [-0.45, 0, 0.45]) {
    items.push({ p: [cx, 0.011, cz + z], s: [1.2, 0.022, 0.1] });
    for (const x of [-0.5275, 0, 0.5275]) items.push({ p: [cx + x, 0.061, cz + z], s: [0.145, 0.078, 0.1] });
  }
  for (const x of [-0.5275, 0, 0.5275]) items.push({ p: [cx + x, 0.111, cz], s: [0.145, 0.022, 1.0] });
  for (let i = 0; i < 7; i++) items.push({ p: [cx, 0.133, cz - 0.45 + i * 0.15], s: [1.2, 0.022, 0.1] });
  return items;
}

/**
 * Resin sacks on pallets: white bags with a red printed band. The stock on the
 * floor falls as the simulator grinds: kg ground so far / 25 kg sacks are gone,
 * taken from the top of the pallet nearest the steps to the feed hopper first.
 */
export function Sacks() {
  const plant = usePlant();
  const M = mats();
  const bags = useRef<THREE.InstancedMesh>(null);
  const bands = useRef<THREE.InstancedMesh>(null);
  const shown = useRef(-1);

  const { sackGeo, bandGeo } = useMemo(() => {
    const sackGeo = new RoundedBoxGeometry(SL, SH, SW, 1, 0.06);
    // The print wraps the middle of the bag: same section, a hair proud of the cloth.
    const bandGeo = sackGeo.clone().scale(0.3, 1.035, 1.02);
    return { sackGeo, bandGeo };
  }, []);

  /** Sack placements, last to be used first, so drawing the first `n` shows the stock that is left. */
  const places = useMemo(() => {
    // Deterministic small scatter: hand-stacked bags are never dead square.
    let s = 20261120;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) - 0.5;
    const list: THREE.Matrix4[] = [];
    const o = new THREE.Object3D();
    // Pallets are emptied from the hopper steps (lowest x) toward the lane, top layer first.
    for (const [cx, cz] of [...PALLETS].reverse()) {
      for (let layer = 0; layer < LAYERS; layer++) {
        const flip = layer % 2 === 0 ? 1 : -1;
        const y = PALLET_H + SH * (layer + 0.5) - layer * 0.006;
        // Five to a layer: three across, two along; the next layer is turned end for end.
        const spots: [number, number, boolean][] = [
          [-0.4, -0.2 * flip, true],
          [0, -0.2 * flip, true],
          [0.4, -0.2 * flip, true],
          [-0.3, 0.3 * flip, false],
          [0.3, 0.3 * flip, false],
        ];
        for (const [x, z, across] of spots) {
          o.position.set(cx + x + rnd() * 0.02, y, cz + z + rnd() * 0.02);
          o.rotation.set(0, (across ? Math.PI / 2 : 0) + rnd() * 0.07, 0);
          o.updateMatrix();
          list.push(o.matrix.clone());
        }
      }
    }
    return list;
  }, []);

  const boards = useMemo(() => PALLETS.flatMap(([x, z]) => palletBoards(x, z)), []);

  useLayoutEffect(() => {
    for (const m of [bags.current, bands.current]) {
      if (!m) continue;
      places.forEach((mat, i) => m.setMatrixAt(i, mat));
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [places]);

  useFrame(() => {
    // Resin used = what the simulator has ground by now.
    let kg = 0;
    for (const g of plant.result.grinds) kg += g.kg * Math.min(1, Math.max(0, (clock.t - g.t0) / (g.t1 - g.t0)));
    const left = Math.max(0, places.length - Math.floor(kg / SACK_KG + 1e-9));
    if (left !== shown.current) {
      shown.current = left;
      if (bags.current) bags.current.count = left;
      if (bands.current) bands.current.count = left;
    }
  });

  return (
    <group>
      <Boxes items={boards} material={M.wood} />
      <instancedMesh ref={bags} args={[sackGeo, M.sack, places.length]} castShadow receiveShadow />
      <instancedMesh ref={bands} args={[bandGeo, M.sackPrint, places.length]} receiveShadow />
    </group>
  );
}

/** Kilograms of resin standing on the pallets at the start. */
export const SACK_STOCK_KG = PALLETS.length * LAYERS * PER_LAYER * SACK_KG;
