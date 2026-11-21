/**
 * Raw-material (powder) hall, beside Machine 3700.
 *
 * Drawn in HALL-LOCAL coordinates (origin at the centre of the hall floor,
 * y up, metres); the parent places it at HALL_OFFSET inside the machine group.
 * Process line, left to right: resin sacks, feed hopper and extruder,
 * pulveriser, three silos, then a bin and the forklift down the lane to the
 * dosing platform. Everything that moves reads the simulator (see each part).
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { mats } from '../materials';
import { Boxes, type BoxItem } from './bits';
import { Extruder } from './Extruder';
import { Forklift } from './Forklift';
import { Pulveriser } from './Pulveriser';
import { Sacks } from './Sacks';
import { Silos } from './Silos';
import { BIN_Z, DECK_EDGE_X, LANE_HALF, LANE_Z, SILO_X, SLAB, TURN_R } from './layout';

/** Hall-local point the camera should look at, and the metres (wide, high) that must fit on screen. */
export const HALL_VIEW_CENTER: [number, number, number] = [0, 2.8, -2.4];
export const HALL_SPAN: [number, number] = [26, 16];

const LINE = 0.1;
/** Half width of the lane strip that carries on to the dosing platform. */
const STRIP_HALF = LANE_HALF + 0.45;
const STRIP_END = DECK_EDGE_X - 0.25;

/** Hall slab with the lane strip to the platform, as one outline in plan (x, -z). */
function outline(): THREE.Shape {
  const { x0, x1 } = SLAB;
  const y0 = -SLAB.z1;
  const y1 = -SLAB.z0;
  const r = 1.2;
  const rs = 0.5;
  const ya = Math.max(y0 + r, -(LANE_Z + STRIP_HALF));
  const yb = Math.min(y1 - r, -(LANE_Z - STRIP_HALF));
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0);
  s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x1, ya);
  s.absarc(STRIP_END - rs, ya + rs, rs, -Math.PI / 2, 0, false);
  s.absarc(STRIP_END - rs, yb - rs, rs, 0, Math.PI / 2, false);
  s.lineTo(x1, yb);
  s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Green epoxy on a dark plinth, like the machine floor, with the painted forklift lane. */
function Floor() {
  const M = mats();
  const slab = useMemo(outline, []);
  const lines = useMemo<BoxItem[]>(() => {
    const it: BoxItem[] = [];
    const y = 0.014;
    const along = (xa: number, xb: number, z: number) => it.push({ p: [(xa + xb) / 2, y, z], s: [xb - xa, 0.004, LINE] });
    const across = (x: number, za: number, zb: number) => it.push({ p: [x, y, (za + zb) / 2], s: [LINE, 0.004, zb - za] });
    const start = SILO_X[0] - TURN_R - 3.0;
    const end = STRIP_END - 0.35;
    const back = LANE_Z - LANE_HALF;
    // Lane edges: the near edge runs through, the far edge breaks at each silo bay.
    along(start, end, LANE_Z + LANE_HALF);
    let x = start;
    for (const sx of SILO_X) {
      along(x, sx - 0.85, back);
      // Bay under the screw feeder: where the bin stands and the forklift backs out.
      across(sx - 0.85, BIN_Z - 0.75, back);
      across(sx + 0.85, BIN_Z - 0.75, back);
      x = sx + 0.85;
    }
    along(x, end, back);
    // Stop line at the platform.
    across(end, back, LANE_Z + LANE_HALF);
    return it;
  }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} material={M.plinth} receiveShadow>
        <extrudeGeometry args={[slab, { depth: 0.5, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 10 }]} />
      </mesh>
      {/* A hair below the machine floor, so the two slabs do not fight where they overlap. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} material={M.epoxy} receiveShadow>
        <shapeGeometry args={[slab, 10]} />
      </mesh>
      <Boxes items={lines} material={M.yellow} shadow={false} />
    </group>
  );
}

export function RawHall({ onSelect }: { onSelect?: () => void }) {
  return (
    <group onClick={(e) => (e.stopPropagation(), onSelect?.())}>
      <Floor />
      <Sacks />
      <Extruder />
      <Pulveriser />
      <Silos />
      <Forklift />
    </group>
  );
}
