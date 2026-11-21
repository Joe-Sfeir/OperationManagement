/**
 * stateAt(t, result): the whole plant at one instant, as a pure function of the
 * event log. Playback speed, pausing and scrubbing only choose `t`; they cannot
 * change what is returned.
 */
import type { ArmState, HoistPhase, PlantState, Segment, Series, SimResult, StationId } from './types';
import { isRotating } from './engine';

/** Index of the last element with key <= x (or 0). */
function locate<T>(arr: T[], x: number, key: (e: T) => number): number {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (key(arr[mid]!) <= x) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function sample(s: Series, x: number): number {
  const n = s.t.length;
  if (n === 0) return 0;
  if (x <= s.t[0]!) return s.v[0]!;
  if (x >= s.t[n - 1]!) return s.v[n - 1]!;
  const i = locate(s.t, x, (e) => e);
  const t0 = s.t[i]!;
  const t1 = s.t[i + 1]!;
  return s.v[i]! + ((s.v[i + 1]! - s.v[i]!) * (x - t0)) / (t1 - t0 || 1);
}

/** Fixed fractions of the simulated demould time for one mould: hook down, lift, traverse, set down, return. */
const HOIST: [HoistPhase, number][] = [
  ['hookDown', 0.14],
  ['lift', 0.5],
  ['traverse', 0.74],
  ['setDown', 0.9],
  ['return', 1],
];

export function segmentAt(segs: Segment[], t: number): { seg: Segment; index: number } {
  const index = locate(segs, t, (s) => s.t0);
  return { seg: segs[index]!, index };
}

export function stateAt(t: number, r: SimResult): PlantState {
  const x = Math.min(Math.max(t, 0), r.endMin);
  const arms: ArmState[] = r.segments.map((segs, id) => {
    const { seg: s, index } = segmentAt(segs, x);
    const dur = s.t1 - s.t0;
    const p = dur > 0 ? Math.min(1, Math.max(0, (x - s.t0) / dur)) : 1;
    const waiting = s.stage === 'waitOven' || s.stage === 'blocked' || s.stage === 'waitDemould';
    const rot = isRotating(s.stage);
    return {
      id,
      moulds: r.config.arms[id]!.moulds,
      station: s.station,
      from: s.stage === 'moving' ? (s.from ?? null) : null,
      moveProgress: s.stage === 'moving' ? p : 0,
      stage: s.stage,
      stageProgress: p,
      stageRemainingMin: Math.max(0, s.t1 - x),
      stageDurMin: dur,
      layer: s.layer,
      lidOpen: s.stage === 'loading' || s.stage === 'demoulding' || s.stage === 'layerPause',
      waitingMin: waiting ? x - s.t0 : 0,
      waitFor: waiting ? (s.waitFor ?? (s.stage === 'waitOven' ? 'oven' : null)) : null,
      content: s.stage === 'demoulding' ? 'cooled' : s.content,
      cycle: s.cycle,
      rotating: rot,
      rotMin: r.rotPrefix[id]![index]! + (rot ? x - s.t0 : 0),
    };
  });

  // Oven
  const o = r.oven[locate(r.oven, x, (e) => e.t0)]!;
  const inOven = arms.find((a) => a.station === 'oven' && a.stage !== 'moving');
  const ring = r.ring;
  const preOven = ring[(ring.indexOf('oven') - 1 + ring.length) % ring.length]!;
  const entering = arms.find((a) => a.stage === 'moving' && a.station === 'oven');
  // Out through the entry door, back to loading for the next layer.
  const backOut = arms.find((a) => a.stage === 'moving' && a.from === 'oven' && a.station === preOven);
  const leaving = arms.find((a) => a.stage === 'moving' && a.from === 'oven' && a.station !== preOven);
  const doorAmount = (p: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, p)));
  const ramp = (p: number) => Math.min(1, Math.max(0, p) / 0.3);
  const pauseArm = arms.find((a) => a.stage === 'layerPause');
  // Entry door: opens as the arm swings out for a new layer, stays open while it is dosed, closes behind it.
  const doorIn = backOut ? ramp(backOut.moveProgress) : entering && entering.layer > 0 ? ramp(1 - entering.moveProgress) : entering ? doorAmount(entering.moveProgress) : pauseArm ? 1 : 0;

  // Cooling
  const chamberArm = arms.find((a) => a.station === 'chamber' && a.stage !== 'moving');
  const airArm = arms.find((a) => a.station === 'air' && a.stage !== 'moving');
  const phase = chamberArm?.stage === 'airCooling' ? 'air' : chamberArm?.stage === 'waterCooling' ? 'water' : null;

  // Loading and layer dosing
  const dose = r.doses.find((d) => d.t0 <= x && x < d.t1);
  let kgDosedTotal = 0;
  let kgThisDose = 0;
  for (const d of r.doses) {
    if (d.t1 <= x) kgDosedTotal += d.kg;
    else if (d.t0 <= x) {
      kgThisDose = (d.kg * (x - d.t0)) / (d.t1 - d.t0);
      kgDosedTotal += kgThisDose;
    }
  }
  const doseArm = dose ? arms[dose.arm]! : null;

  // Demould and hoist
  const dArm = arms.find((a) => a.stage === 'demoulding');
  let hoist: HoistPhase = 'rest';
  let hoistProgress = 0;
  let mouldIndex = -1;
  if (dArm && dArm.moulds.length > 0) {
    const m = dArm.moulds.length;
    const q = Math.min(0.999999, dArm.stageProgress) * m;
    mouldIndex = Math.floor(q);
    const f = q - mouldIndex;
    let prev = 0;
    for (const [name, end] of HOIST) {
      if (f < end) {
        hoist = name;
        hoistProgress = (f - prev) / (end - prev);
        break;
      }
      prev = end;
    }
  }

  // Tanks
  const finished = { CTT4: 0, CTT2: 0, HTT2: 0, OTHER: 0 };
  const tanksOut = { CTT4: 0, CTT2: 0, HTT2: 0 };
  const finishing: PlantState['finishing'] = [];
  for (const k of r.tanks) {
    if (k.out > x) continue;
    if (k.kind !== 'OTHER') tanksOut[k.kind] += 1;
    if (k.finished <= x) finished[k.kind] += 1;
    else finishing.push(k.kind);
  }

  const bin = r.bins.find((b) => b.t0 <= x && x < b.t1);
  const grind = r.grinds.find((g) => g.t0 <= x && x < g.t1);

  // What is making arms wait right now (falls back to the shift-level finding).
  const waiters = arms.filter((a) => a.waitFor && a.waitFor !== 'crew');
  const now: Partial<Record<StationId, number>> = {};
  for (const a of waiters) now[a.waitFor as StationId] = (now[a.waitFor as StationId] ?? 0) + a.waitingMin + 1e-6;
  const top = (Object.entries(now) as [StationId, number][]).sort((a, b) => b[1] - a[1])[0];

  return {
    t: x,
    arms,
    oven: {
      busy: !!inOven || !!pauseArm,
      arm: inOven?.id ?? pauseArm?.id ?? null,
      layer: inOven?.layer ?? pauseArm?.layer ?? 0,
      tempC: sample(r.ovenTemp, x),
      doorIn,
      doorOut: leaving ? doorAmount(leaving.moveProgress) : 0,
      state: o.state,
    },
    cooling: {
      chamberArm: chamberArm?.id ?? null,
      phase,
      airArm: airArm?.id ?? null,
      fanOn: phase === 'water',
      mistOn: phase === 'water',
    },
    loading: {
      dosing: !!dose && dose.kg > 0,
      arm: dose ? dose.arm : null,
      layer: dose ? dose.layer + 1 : 0,
      kgThisDose,
      kgDosedTotal,
      station: doseArm ? doseArm.station : null,
    },
    demould: {
      arm: dArm?.id ?? arms.find((a) => a.stage === 'waitDemould')?.id ?? null,
      hoist,
      hoistProgress,
      mouldIndex,
      kind: dArm && mouldIndex >= 0 ? dArm.moulds[mouldIndex]! : null,
      crewWaiting: arms.some((a) => a.stage === 'waitDemould'),
    },
    siloKg: [sample(r.silo[0], x), sample(r.silo[1], x), sample(r.silo[2], x)],
    hopperKg: [sample(r.hopper[0], x), sample(r.hopper[1], x), sample(r.hopper[2], x)],
    bin: bin ? { active: true, layer: bin.layer, progress: (x - bin.t0) / (bin.t1 - bin.t0), kg: bin.kg } : { active: false, layer: 0, progress: 0, kg: 0 },
    grind: grind ? { active: true, layer: grind.layer, progress: (x - grind.t0) / (grind.t1 - grind.t0) } : { active: false, layer: 0, progress: 0 },
    finishing,
    finished,
    tanksOut,
    ovenQueue: arms.filter((a) => a.stage === 'waitOven' || (a.stage === 'blocked' && a.waitFor === 'oven')).length,
    bottleneck: top ? top[0] : r.kpis.bottleneck,
    shiftOver: x >= r.config.shiftMin,
  };
}
