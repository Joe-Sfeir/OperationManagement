/**
 * Where things stand, in metres. "Plan" coordinates follow the manual's plan
 * view: hub at the origin, x to the right, y up the page, angles counter-
 * clockwise from the oven. The machine group is turned by PLAN_ROT so the oven
 * sits on the right of the isometric view and the cooling chamber upper left.
 *
 * Sizes are modelled from the photos and drawings by eye; they are for the
 * picture only and feed no calculation.
 */
import type { StationId } from '../sim/types';

export const DEG = Math.PI / 180;

/** Rotation of the plan about the vertical axis, in radians. */
export const PLAN_ROT = 30 * DEG;

/** Mould centre radius and arm axis height. */
export const R_ARM = 5.6;
export const H_ARM = 2.55;
/** Radius of the ring frame at the end of an arm. */
export const R_RING = 1.78;

/** Plan angle of each position, degrees. */
export const STATION_DEG: Record<StationId, number> = {
  oven: 0,
  // Close to the chamber, so the arm cooling in air is not hidden behind the oven.
  air: 78,
  chamber: 120,
  demould: 180,
  load: 250,
  wait: 305,
};

/** Plan polar to local xyz (y up). */
export function polar(r: number, deg: number, y = 0): [number, number, number] {
  return [r * Math.cos(deg * DEG), y, -r * Math.sin(deg * DEG)];
}

/** Angle to travel from one position to the next, taking the direction the arms index (counter-clockwise). */
export function sweep(fromDeg: number, toDeg: number, forward: boolean): number {
  let d = toDeg - fromDeg;
  if (forward) while (d <= 0) d += 360;
  else while (d >= 0) d -= 360;
  return d;
}

/** Local position of the powder hall relative to the machine hub (world metres, before PLAN_ROT). */
export const HALL_OFFSET: [number, number, number] = [-27, 0, 9];

/**
 * The building, in machine coordinates (metres): x from the powder-hall end to
 * past the oven, z from the back wall to the open front. The two walls nearest
 * the camera (front, and the oven end) are cut away.
 */
export const HALL = { x0: -41, x1: 19, z0: -18, z1: 20, wallH: 9.6 } as const;

/** High-bay lamps: where the pools of light fall (x, z). Fixtures are drawn only for those near the back wall. */
export const LAMPS: readonly [number, number][] = [
  [-30, -9],
  [-30, 6],
  [-14, -9],
  [-12, 7],
  [2, -9],
  [3, 6],
];
