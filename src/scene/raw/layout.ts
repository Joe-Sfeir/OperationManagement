/**
 * Raw-material hall: where things stand and how the forklift moves.
 *
 * Coordinates are HALL-LOCAL metres: origin at the centre of the hall floor,
 * y up, +z toward the camera (front), +x toward the moulding machine.
 * Sizes are modelled by eye from the style bible's description; they are for
 * the picture only and feed no calculation.
 *
 * `logistics(t, ...)` is a pure function of the simulated minute and the
 * simulator's bin trips: scrubbing or pausing the clock replays or freezes it.
 */
import { PLATFORM } from '../machine/Loading';
import { HALL_OFFSET } from '../layout';
import { easeInOutCubic } from '../../design/tokens';
import type { BinTrip } from '../../sim/types';

// ---- Dosing platform, seen from the hall --------------------------------------
/** Deck centre of the dosing platform in hall-local x, z. */
export const PLATFORM_X = PLATFORM[0] - HALL_OFFSET[0];
export const PLATFORM_Z = PLATFORM[2] - HALL_OFFSET[2];
/** Hall-side edge of the 3.6 m deck (machine/Loading.tsx, DECK). */
export const DECK_EDGE_X = PLATFORM_X - 1.8;
/** Rim of the hoppers: deck + 0.5 m stand + 1.66 m hopper (machine/Loading.tsx, Hopper). */
export const HOPPER_TOP = PLATFORM[1] + 0.5 + 1.66;

// ---- Hall ---------------------------------------------------------------------
/**
 * Floor slab outline. The hall slab runs under the machine slab on the +x side
 * (the machine slab starts at hall x = 4.8) and its front edge is in line with
 * the machine slab's front edge, so the two read as one floor. That edge is
 * copied from machine/Floor.tsx (slab centre z -1.2 plus half depth 13.6, less
 * HALL_OFFSET z 9): Floor.tsx does not export it.
 */
export const SLAB = { x0: -10.5, x1: 9.0, z0: -6.9, z1: 3.4 };
/** Centre line of the forklift lane: in line with the row of hoppers on the platform. */
export const LANE_Z = PLATFORM_Z - 0.3;
export const LANE_HALF = 1.7;

/** Silos, one per layer: 0 outer, 1 foam, 2 inner. */
export const SILO_X: readonly [number, number, number] = [1.1, 4.1, 7.1];
export const SILO_Z = -5.1;
export const SILO_R = 1.25;
/** Shell: bottom and height. The cone hangs below, the outlet is at CONE_Y0. */
export const SHELL_Y0 = 2.7;
export const SHELL_H = 4.5;
export const CONE_Y0 = 1.3;
/** Powder duct along the silo roofs. */
export const HEADER_Y = 8.55;
export const RISER_X = -0.42;

/** Extruder: feed throat on the floor line. */
export const EXTRUDER: [number, number] = [-6.9, -4.5];
/** Pulveriser mill and its cyclone. */
export const MILL: [number, number] = [-2.4, -4.5];
export const CYCLONE: [number, number] = [-1.1, -4.9];
/** Resin sacks: pallet centres. */
export const PALLETS: [number, number][] = [
  [-9.45, -1.3],
  [-7.95, -1.3],
  [-6.45, -1.3],
  [-4.95, -1.3],
];

// ---- Forklift and bins ----------------------------------------------------------
/** Front axle to turning centre, and the straight run into a silo bay. */
export const TURN_R = 1.0;
export const BAY_STRAIGHT = 0.9;
/** Front axle to the centre of the bin on the forks. */
export const BIN_FWD = 1.15;
export const BIN_HALF = 0.55;
/** Where a bin stands under its silo's screw feeder. */
export const BIN_Z = LANE_Z - TURN_R - BAY_STRAIGHT - BIN_FWD;
export const WHEELBASE = 1.45;
/** Fork blade height (top face): in the pockets on the floor, travelling, and tipping over the hopper rim. */
export const FORK_LOW = 0.07;
export const FORK_TRAVEL = 0.35;
export const FORK_TIP = HOPPER_TOP + 0.52;
/** Bin body height above its base frame, and the base frame height. */
export const BIN_BODY_H = 0.9;
export const BIN_BASE_H = 0.12;
/** Forks carry the bin by the top of its pockets. */
export const POCKET_TOP = 0.1;
export const TIP_MAX = (105 * Math.PI) / 180;
/** Where the front axle stands while tipping: the bin stops just short of the deck edge. */
export const TIP_X = DECK_EDGE_X - 0.08 - BIN_FWD - BIN_HALF;

const ARC = (Math.PI / 2) * TURN_R;
const BAY_LEN = ARC + BAY_STRAIGHT;
const STEER_MAX = Math.atan(WHEELBASE / TURN_R);

/** Fractions of a bin trip (t0..t1). */
const FILL_END = 0.25; // bin under the feeder, filling
const APPROACH = 0.12; // forklift starts for the bin
const CARRY_END = 0.85; // arrives at the platform
/** The empty run back takes this share of a trip length. */
const RETURN_SHARE = 0.6;

export interface Logistics {
  /** Front axle centre on the floor, and heading (rotation about y; forks point along local +x). */
  x: number;
  z: number;
  yaw: number;
  /** Fork blade height. */
  forkY: number;
  /** Metres rolled along the path: wheel angle = odo / wheel radius. */
  odo: number;
  /** Rear-wheel steering angle. */
  steer: number;
  /** Layer whose bin is on the forks, or -1. */
  carried: number;
  /** Tip angle of the carried bin, radians. */
  tip: number;
  /** Powder in each silo's bin, 0..1 of a full bin. */
  fill: [number, number, number];
  /** Layer whose screw feeder is running into its bin, or -1. */
  filling: number;
  /** Powder is leaving the tipped bin. */
  pouring: boolean;
}

const seg = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));
const ease = (v: number, a: number, b: number) => easeInOutCubic(seg(v, a, b));
const siloX = (layer: number) => SILO_X[Math.min(2, Math.max(0, layer))]!;
/** Where a silo's bay leaves the lane. */
const junction = (layer: number) => siloX(layer) - TURN_R;

function onLane(o: Logistics, x: number) {
  o.x = x;
  o.z = LANE_Z;
  o.yaw = 0;
  o.odo = x;
  o.steer = 0;
}

/** Pose `d` metres into a silo bay, measured from the lane: a quarter turn, then straight up to the bin. */
function inBay(o: Logistics, layer: number, d: number) {
  const jx = junction(layer);
  if (d < ARC) {
    const a = d / TURN_R;
    o.x = jx + TURN_R * Math.sin(a);
    o.z = LANE_Z - TURN_R + TURN_R * Math.cos(a);
    o.yaw = a;
    // The steered rear wheels come round at the start of the turn and straighten at its end.
    const u = d / ARC;
    o.steer = -STEER_MAX * easeInOutCubic(Math.min(1, u / 0.25, (1 - u) / 0.25));
  } else {
    o.x = jx + TURN_R;
    o.z = LANE_Z - TURN_R - (d - ARC);
    o.yaw = Math.PI / 2;
    o.steer = 0;
  }
  o.odo = jx + d;
}

/** After a trip: lower the empty bin, reverse down the lane, put the bin back under its feeder, park on the lane. */
function returning(o: Logistics, trip: BinTrip, next: BinTrip | undefined, t: number) {
  const layer = trip.layer;
  const jx = junction(layer);
  let end = trip.t1 + RETURN_SHARE * (trip.t1 - trip.t0);
  // If the next bin is called early, the forklift is back before it has to leave for that bin.
  if (next) end = Math.min(end, next.t0 + APPROACH * (next.t1 - next.t0));
  if (t >= end) {
    onLane(o, jx);
    o.forkY = FORK_LOW;
    return;
  }
  const q = (t - trip.t1) / (end - trip.t1);
  o.tip = TIP_MAX * (1 - ease(q, 0, 0.08));
  o.forkY = q < 0.8 ? FORK_TIP + (FORK_TRAVEL - FORK_TIP) * ease(q, 0.05, 0.26) : FORK_TRAVEL + (FORK_LOW - FORK_TRAVEL) * ease(q, 0.8, 0.84);
  if (q < 0.66) onLane(o, TIP_X + (jx - TIP_X) * ease(q, 0.26, 0.66));
  else if (q < 0.84) inBay(o, layer, BAY_LEN * ease(q, 0.66, 0.8));
  else inBay(o, layer, BAY_LEN * (1 - ease(q, 0.84, 1)));
  o.carried = q < 0.84 ? layer : -1;
}

const out: Logistics = { x: 0, z: 0, yaw: 0, forkY: FORK_LOW, odo: 0, steer: 0, carried: -1, tip: 0, fill: [0, 0, 0], filling: -1, pouring: false };

/**
 * Forklift and bins at simulated minute `t`.
 *
 * One trip (t0..t1): to 25 % the bin fills under its silo's feeder while the
 * forklift comes for it; 25 to 85 % the forklift backs out of the bay and
 * carries the bin down the lane; 85 to 100 % the forks rise and the bin tips
 * into the hopper. After t1 the forklift takes the empty bin back and parks.
 *
 * Returns a shared object: read it, do not keep it.
 */
export function logistics(t: number, trips: BinTrip[], binKg: number): Logistics {
  const o = out;
  o.carried = -1;
  o.tip = 0;
  o.fill[0] = o.fill[1] = o.fill[2] = 0;
  o.filling = -1;
  o.pouring = false;
  o.forkY = FORK_LOW;

  // Last trip that has started.
  let k = -1;
  for (let i = 0; i < trips.length; i++) if (trips[i]!.t0 <= t) k = i;
  if (k < 0) {
    // Before the first call: parked on the lane by the silo it will serve first.
    onLane(o, junction(trips[0]?.layer ?? 0));
    return o;
  }
  const trip = trips[k]!;
  if (t >= trip.t1) {
    returning(o, trip, trips[k + 1], t);
    return o;
  }

  const layer = trip.layer;
  const p = (t - trip.t0) / (trip.t1 - trip.t0);
  const full = binKg > 0 ? Math.min(1, trip.kg / binKg) : 0;
  const jx = junction(layer);
  if (p < APPROACH) {
    const prev = trips[k - 1];
    if (prev) returning(o, prev, trip, t);
    else onLane(o, jx);
  } else if (p < FILL_END) {
    // Along the lane to this silo's bay if the forklift is parked elsewhere, then into the bay, forks low.
    const from = junction(trips[k - 1]?.layer ?? layer);
    if (from !== jx && p < 0.17) onLane(o, from + (jx - from) * ease(p, APPROACH, 0.17));
    else inBay(o, layer, BAY_LEN * ease(p, from !== jx ? 0.17 : APPROACH, 0.245));
  } else {
    o.carried = layer;
    o.forkY = p < CARRY_END ? FORK_LOW + (FORK_TRAVEL - FORK_LOW) * ease(p, FILL_END, 0.28) : FORK_TRAVEL + (FORK_TIP - FORK_TRAVEL) * ease(p, CARRY_END, 0.925);
    if (p < 0.42) inBay(o, layer, BAY_LEN * (1 - ease(p, 0.28, 0.42)));
    else onLane(o, jx + (TIP_X - jx) * ease(p, 0.42, CARRY_END));
    o.tip = TIP_MAX * ease(p, 0.915, 0.955);
  }
  o.fill[layer as 0 | 1 | 2] = full * (p < FILL_END ? p / FILL_END : 1 - seg(p, 0.94, 0.995));
  if (p < FILL_END) o.filling = layer;
  o.pouring = p >= 0.94 && p < 0.995;
  return o;
}
