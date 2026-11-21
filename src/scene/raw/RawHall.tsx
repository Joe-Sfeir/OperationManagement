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
import { mats } from '../materials';
import { Boxes, type BoxItem } from './bits';
import { Extruder } from './Extruder';
import { Forklift } from './Forklift';
import { Pulveriser } from './Pulveriser';
import { Sacks } from './Sacks';
import { Silos } from './Silos';
import { BIN_Z, DECK_EDGE_X, LANE_HALF, LANE_Z, SILO_X, TURN_R } from './layout';

/** Hall-local point the camera should look at, and the metres (wide, high) that must fit on screen. */
export const HALL_VIEW_CENTER: [number, number, number] = [0, 2.6, -2.4];
export const HALL_SPAN: [number, number] = [26, 16];

const LINE = 0.1;
const STRIP_END = DECK_EDGE_X - 0.25;

/** The painted forklift lane and silo bays. The epoxy floor itself belongs to the hall (src/scene/hall/Hall.tsx). */
function Floor() {
  const M = mats();
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
      <Boxes items={lines} material={M.yellow} shadow={false} />
    </group>
  );
}

export function RawHall({ onSelect }: { onSelect?: () => void }) {
  return (
    <group onClick={(e) => e.delta < 6 && (e.stopPropagation(), onSelect?.())}>
      <Floor />
      <Sacks />
      <Extruder />
      <Pulveriser />
      <Silos />
      <Forklift />
    </group>
  );
}
