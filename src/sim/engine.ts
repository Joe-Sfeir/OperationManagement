/**
 * Discrete-event simulator for Machine 3700. Pure and deterministic:
 * runSimulation(config, seed) always returns the same result for the same inputs.
 *
 * Model in one paragraph: four independent arms travel one way round a ring of
 * five positions and cannot overtake. A position holds one arm. An arm does
 * the work of the position it is at (load, oven, cool, demould), then indexes
 * to the next position as soon as that position is free. The oven therefore
 * serves one arm at a time, by turn, and the arm cycle is an OUTPUT of the
 * model, not an input.
 */
import { SKUS, type PerSku } from '../data/params';
import { plannedTanks, ringFor } from './config';
import type {
  BinTrip,
  Dose,
  GrindBatch,
  Kpis,
  MouldContent,
  MouldKind,
  OvenSpan,
  Segment,
  Series,
  SimConfig,
  SimEvent,
  SimResult,
  Stage,
  StationId,
  TankRecord,
} from './types';

const EPS = 1e-9;

/** Small seeded generator (mulberry32). Only used when config.jitter > 0. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Product = 'empty' | 'loaded' | 'cooked' | 'aircooled' | 'cooled';

interface Phase {
  stage: Stage;
  dur: number;
  layer: number;
  content: MouldContent;
  waitFor?: 'crew';
  /** A move that is part of the station's work (return to the loading position between layers). */
  moveTo?: number;
  onStart?: (t: number, t1: number) => void;
  onEnd?: (t: number) => void;
}

interface Rt {
  id: number;
  moulds: MouldKind[];
  ringIdx: number;
  moving: boolean;
  arriveAt: number;
  queue: Phase[];
  cur: Phase | null;
  curEnd: number;
  product: Product;
  cycle: number;
  open: Segment | null;
  segs: Segment[];
  ovenEntries: number[];
}

const contentOf = (p: Product): MouldContent =>
  p === 'empty' ? 'empty' : p === 'loaded' ? 'powder' : p === 'cooled' ? 'cooled' : 'hot';

export function tankMoulds(moulds: MouldKind[]): Exclude<MouldKind, 'OTHER'>[] {
  return moulds.filter((m): m is Exclude<MouldKind, 'OTHER'> => m !== 'OTHER');
}

/** Minutes the oven is held by one arm visit, for this configuration. */
export function ovenHoldMin(cfg: SimConfig, moulds: MouldKind[]): number {
  const layers = tankMoulds(moulds).length > 0 ? cfg.layers : 1;
  const pauses = (layers - 1) * cfg.times.layerPause;
  const heat = cfg.pausesInsideVisit ? cfg.times.ovenVisit - pauses : cfg.times.ovenVisit;
  const extraMoves = cfg.layerMode === 'returnToLoad' ? (layers - 1) * 2 * cfg.times.index : 0;
  return heat + pauses + extraMoves;
}

export function runSimulation(cfg: SimConfig, seed = 1): SimResult {
  const ring = ringFor(cfg);
  const n = ring.length;
  const ovenIdx = ring.indexOf('oven');
  const loadIdx = ring.indexOf('load');
  const preOvenIdx = (ovenIdx - 1 + n) % n;
  const T = cfg.times;
  const rand = rng(seed);
  const vary = (d: number) => (cfg.jitter > 0 ? d * (1 + cfg.jitter * (rand() * 2 - 1)) : d);

  const events: SimEvent[] = [];
  const doses: Dose[] = [];
  const tanks: TankRecord[] = [];
  let loadingClosed = false;
  let ovenClosed = false;
  let uncooked = 0;
  const reserved = new Map<number, number>();

  const arms: Rt[] = cfg.arms.map((a, i) => ({
    id: i,
    moulds: a.moulds,
    // Arm 0 starts at loading; the others queue behind it in ring order.
    ringIdx: (loadIdx - i + n * 4) % n,
    moving: false,
    arriveAt: Infinity,
    queue: [],
    cur: null,
    curEnd: Infinity,
    product: 'empty',
    cycle: 1,
    open: null,
    segs: [],
    ovenEntries: [],
  }));

  const at = (idx: number) => arms.find((a) => a.ringIdx === idx);
  const canEnter = (idx: number, arm: Rt) => {
    const r = reserved.get(idx);
    return at(idx) === undefined && (r === undefined || r === arm.id);
  };

  function begin(arm: Rt, t: number, s: Omit<Segment, 'arm' | 't0' | 't1' | 'cycle'>) {
    const o = arm.open;
    if (o && o.stage === s.stage && o.station === s.station && o.waitFor === s.waitFor && o.layer === s.layer && s.stage !== 'moving') return;
    if (o) {
      o.t1 = t;
      if (o.t1 - o.t0 > EPS) arm.segs.push(o);
    }
    arm.open = { arm: arm.id, t0: t, t1: t, cycle: arm.cycle, ...s };
  }

  const kgFor = (arm: Rt, layer: number) => tankMoulds(arm.moulds).reduce((s, m) => s + cfg.layerKg[m][layer]!, 0);

  function ovenPhases(arm: Rt): Phase[] {
    const hasTanks = tankMoulds(arm.moulds).length > 0;
    const layers = hasTanks ? cfg.layers : 1;
    const pauses = (layers - 1) * T.layerPause;
    const heatEach = (cfg.pausesInsideVisit ? T.ovenVisit - pauses : T.ovenVisit) / layers;
    const out: Phase[] = [];
    for (let l = 1; l <= layers; l++) {
      out.push({
        stage: 'heating',
        dur: vary(heatEach),
        layer: l,
        content: 'cooking',
        onEnd: l === layers ? () => void (arm.product = 'cooked') : undefined,
      });
      if (l < layers) {
        const dose = (t0: number, t1: number) => {
          const kg = kgFor(arm, l);
          doses.push({ t0, t1, layer: l, kg, arm: arm.id });
          events.push({ t: t0, type: 'layer', arm: arm.id, layer: l + 1, dur: t1 - t0, kg });
        };
        if (cfg.layerMode === 'returnToLoad') {
          out.push({ stage: 'moving', dur: T.index, layer: l + 1, content: 'cooking', moveTo: preOvenIdx });
          out.push({ stage: 'layerPause', dur: T.layerPause, layer: l + 1, content: 'cooking', onStart: dose });
          out.push({
            stage: 'moving',
            dur: T.index,
            layer: l + 1,
            content: 'cooking',
            moveTo: ovenIdx,
            onStart: l === layers - 1 ? () => void reserved.delete(preOvenIdx) : undefined,
          });
        } else {
          out.push({ stage: 'layerPause', dur: T.layerPause, layer: l + 1, content: 'cooking', onStart: dose });
        }
      }
    }
    return out;
  }

  /** When the arm ahead will let go of the oven, as far as can be known now. */
  function predictHeatStart(arm: Rt, now: number): number {
    let tFree = now;
    const occ = arms.find((a) => a !== arm && (a.ringIdx === ovenIdx || reserved.get(ovenIdx) === a.id));
    if (occ) {
      const start = occ.moving ? occ.arriveAt : occ.cur ? occ.curEnd : now;
      const rest = occ.queue.reduce((s, p) => s + p.dur, 0);
      const pending = occ.moving && occ.product === 'loaded' ? ovenHoldMin(cfg, occ.moulds) : 0;
      tFree = Math.max(now, start + rest + pending);
    }
    for (let i = preOvenIdx; i !== arm.ringIdx; i = (i - 1 + n) % n) {
      const a = at(i);
      if (a && a.product === 'loaded') tFree = Math.max(now, tFree) + T.index + ovenHoldMin(cfg, a.moulds);
    }
    const steps = (ovenIdx - arm.ringIdx + n) % n;
    return Math.max(now + T.load + steps * T.index, tFree + T.index);
  }

  function onArrive(arm: Rt, t: number) {
    const st = ring[arm.ringIdx]!;
    arm.queue = [];
    if (st === 'load' && arm.product === 'empty' && arm.moulds.length > 0 && !loadingClosed) {
      const ok =
        cfg.endOfShift === 'hardStop'
          ? t + T.load <= cfg.shiftMin + EPS
          : predictHeatStart(arm, t) + ovenHoldMin(cfg, arm.moulds) <= cfg.shiftMin + EPS;
      if (!ok) {
        loadingClosed = true;
        return;
      }
      arm.queue.push({
        stage: 'loading',
        dur: T.load,
        layer: 1,
        content: 'powder',
        onStart: (t0, t1) => {
          const kg = kgFor(arm, 0);
          doses.push({ t0, t1, layer: 0, kg, arm: arm.id });
          events.push({ t: t0, type: 'load', arm: arm.id, dur: t1 - t0, kg });
        },
        onEnd: () => void (arm.product = 'loaded'),
      });
    } else if (st === 'oven' && arm.product === 'loaded' && !ovenClosed) {
      arm.ovenEntries.push(t);
      events.push({ t, type: 'ovenIn', arm: arm.id, cycle: arm.cycle });
      arm.queue.push(...ovenPhases(arm));
    } else if (st === 'air' && arm.product === 'cooked') {
      const dur = vary(T.air);
      arm.queue.push({
        stage: 'airCooling',
        dur,
        layer: 0,
        content: 'hot',
        onStart: (t0) => void events.push({ t: t0, type: 'cool', arm: arm.id, phase: 'air', dur }),
        onEnd: () => void (arm.product = 'aircooled'),
      });
    } else if (st === 'chamber' && (arm.product === 'cooked' || arm.product === 'aircooled')) {
      if (arm.product === 'cooked') {
        const dur = vary(T.air);
        arm.queue.push({
          stage: 'airCooling',
          dur,
          layer: 0,
          content: 'hot',
          onStart: (t0) => void events.push({ t: t0, type: 'cool', arm: arm.id, phase: 'air', dur }),
        });
      }
      const dur = vary(T.water);
      arm.queue.push({
        stage: 'waterCooling',
        dur,
        layer: 0,
        content: 'hot',
        onStart: (t0) => void events.push({ t: t0, type: 'cool', arm: arm.id, phase: 'water', dur }),
        onEnd: () => void (arm.product = 'cooled'),
      });
    } else if (st === 'demould' && arm.product === 'cooled') {
      if (T.demouldWait > 0) arm.queue.push({ stage: 'waitDemould', dur: T.demouldWait, layer: 0, content: 'cooled', waitFor: 'crew' });
      const dur = vary(T.demould);
      arm.queue.push({
        stage: 'demoulding',
        dur,
        layer: 0,
        content: 'cooled',
        onStart: (t0, t1) => {
          events.push({ t: t0, type: 'demould', arm: arm.id, dur: t1 - t0 });
          const m = arm.moulds.length;
          arm.moulds.forEach((kind, j) => {
            const out = t0 + ((j + 1) / m) * (t1 - t0);
            tanks.push({ kind, arm: arm.id, cycle: arm.cycle, out, finished: out });
          });
        },
        onEnd: () => {
          arm.product = 'empty';
          arm.cycle += 1;
        },
      });
    }
  }

  function startPhase(arm: Rt, t: number) {
    const p = arm.queue.shift()!;
    arm.cur = p;
    arm.curEnd = t + p.dur;
    if (p.moveTo !== undefined) {
      const from = ring[arm.ringIdx]!;
      arm.ringIdx = p.moveTo;
      begin(arm, t, { stage: 'moving', station: ring[p.moveTo]!, from, layer: p.layer, content: p.content });
      events.push({ t, type: 'move', arm: arm.id, from, to: ring[p.moveTo]!, dur: p.dur });
    } else {
      begin(arm, t, { stage: p.stage, station: ring[arm.ringIdx]!, layer: p.layer, content: p.content, waitFor: p.waitFor });
    }
    p.onStart?.(t, arm.curEnd);
  }

  /** Does this arm need to move on? Empty arms only move to reach loading, or to make room. */
  function wants(arm: Rt, depth = 0): boolean {
    if (arm.moving || arm.cur || arm.queue.length > 0) return false;
    const st = ring[arm.ringIdx]!;
    if (arm.product === 'loaded' && ovenClosed) return depth < n && behindWants(arm, depth);
    if (arm.product !== 'empty') return true;
    if (st !== 'load' && !loadingClosed && arm.moulds.length > 0) return true;
    return depth < n && behindWants(arm, depth);
  }
  function behindWants(arm: Rt, depth: number): boolean {
    const b = at((arm.ringIdx - 1 + n) % n);
    return b !== undefined && wants(b, depth + 1);
  }

  function waitStage(arm: Rt): Stage {
    if (arm.product === 'loaded') return ovenClosed ? 'idle' : 'waitOven';
    if (arm.product === 'empty') return 'idle';
    return 'blocked';
  }

  function tryMove(arm: Rt, t: number): boolean {
    const here = ring[arm.ringIdx]!;
    if (!wants(arm)) {
      begin(arm, t, { stage: waitStage(arm) === 'waitOven' ? 'waitOven' : 'idle', station: here, layer: 0, content: contentOf(arm.product) });
      return false;
    }
    const to = (arm.ringIdx + 1) % n;
    const dest = ring[to]!;
    if (dest === 'oven' && arm.product === 'loaded' && !ovenClosed && cfg.endOfShift === 'finishWip') {
      if (t + T.index + ovenHoldMin(cfg, arm.moulds) > cfg.shiftMin + EPS) {
        ovenClosed = true;
        loadingClosed = true;
        uncooked += 1;
        begin(arm, t, { stage: 'idle', station: here, layer: 0, content: 'powder' });
        return false;
      }
    }
    if (!canEnter(to, arm)) {
      begin(arm, t, { stage: waitStage(arm), station: here, layer: 0, content: contentOf(arm.product), waitFor: dest });
      return false;
    }
    if (here === 'oven' && arm.product === 'cooked') {
      events.push({ t, type: 'ovenOut', arm: arm.id, cycle: arm.cycle });
      reserved.delete(ovenIdx);
    }
    if (dest === 'oven' && arm.product === 'loaded' && !ovenClosed && cfg.layerMode === 'returnToLoad' && tankMoulds(arm.moulds).length > 0 && cfg.layers > 1) {
      // The arm will swing back here for each new layer, so nobody may take its place meanwhile.
      reserved.set(preOvenIdx, arm.id);
      reserved.set(ovenIdx, arm.id);
    }
    arm.moving = true;
    arm.arriveAt = t + T.index;
    arm.ringIdx = to;
    begin(arm, t, { stage: 'moving', station: dest, from: here, layer: 0, content: contentOf(arm.product) });
    events.push({ t, type: 'move', arm: arm.id, from: here, to: dest, dur: T.index });
    return true;
  }

  // ---- Main loop --------------------------------------------------------------
  let now = 0;
  for (const a of arms) onArrive(a, 0);
  for (let guard = 0; guard < 100000; guard++) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const a of arms) {
        if (a.moving && a.arriveAt <= now + EPS) {
          a.moving = false;
          a.arriveAt = Infinity;
          onArrive(a, now);
          changed = true;
        }
        if (a.cur && a.curEnd <= now + EPS) {
          const p = a.cur;
          a.cur = null;
          a.curEnd = Infinity;
          p.onEnd?.(now);
          changed = true;
        }
        if (!a.moving && !a.cur) {
          if (a.queue.length > 0) {
            startPhase(a, now);
            changed = true;
          } else if (tryMove(a, now)) changed = true;
        }
      }
    }
    let next = Infinity;
    for (const a of arms) next = Math.min(next, a.moving ? a.arriveAt : Infinity, a.cur ? a.curEnd : Infinity);
    if (next === Infinity) break;
    if (cfg.endOfShift === 'hardStop' && next > cfg.shiftMin + EPS) {
      now = cfg.shiftMin;
      break;
    }
    now = next;
  }

  // ---- Finishing: one tank at a time, after it is lifted out --------------------
  const tanksDone = cfg.endOfShift === 'hardStop' ? tanks.filter((k) => k.out <= cfg.shiftMin + EPS) : tanks;
  tanksDone.sort((a, b) => a.out - b.out);
  let lastFinish = 0;
  for (const k of tanksDone) {
    k.finished = Math.max(k.out, lastFinish) + T.finishing;
    lastFinish = k.finished;
    events.push({ t: k.out, type: 'tankOut', arm: k.arm, kind: k.kind });
    events.push({ t: k.finished, type: 'tankFinished', kind: k.kind });
  }
  const lastOut = tanksDone.reduce((m, k) => Math.max(m, k.out), 0);
  const endMin = Math.max(cfg.shiftMin, now, cfg.endOfShift === 'hardStop' ? 0 : lastFinish);

  const segments = arms.map((a) => {
    if (a.open) {
      a.open.t1 = endMin;
      if (a.open.t1 - a.open.t0 > EPS) a.segs.push(a.open);
    }
    return cfg.endOfShift === 'hardStop' ? a.segs.filter((s) => s.t0 < endMin).map((s) => ({ ...s, t1: Math.min(s.t1, endMin) })) : a.segs;
  });

  const usedDoses = cfg.endOfShift === 'hardStop' ? doses.filter((d) => d.t0 < cfg.shiftMin) : doses;
  const oven = ovenSpans(segments, endMin);
  const raw = rawMaterial(cfg, usedDoses, endMin, events);
  events.sort((a, b) => a.t - b.t);

  const rotPrefix = segments.map((segs) => {
    const out: number[] = [];
    let acc = 0;
    for (const s of segs) {
      out.push(acc);
      if (isRotating(s.stage)) acc += s.t1 - s.t0;
    }
    return out;
  });

  return {
    config: cfg,
    seed,
    ring,
    segments,
    events,
    doses: usedDoses,
    tanks: tanksDone,
    oven,
    ovenTemp: ovenTemperature(cfg, oven, endMin),
    ...raw,
    kpis: kpis(cfg, arms, segments, tanksDone, usedDoses, oven, lastOut, uncooked),
    endMin,
    rotPrefix,
  };
}

export const isRotating = (s: Stage) => s === 'heating' || s === 'airCooling' || s === 'waterCooling';

function ovenSpans(segments: Segment[][], endMin: number): OvenSpan[] {
  const raw: OvenSpan[] = [];
  for (const segs of segments)
    for (const s of segs) {
      if (s.station === 'oven' && s.stage === 'heating') raw.push({ t0: s.t0, t1: s.t1, state: 'heating', arm: s.arm });
      else if (s.stage === 'layerPause') raw.push({ t0: s.t0, t1: s.t1, state: 'pause', arm: s.arm });
      else if (s.stage === 'moving' && (s.station === 'oven' || s.from === 'oven'))
        raw.push({ t0: s.t0, t1: s.t1, state: s.layer > 0 ? 'pause' : 'door', arm: s.arm });
      else if (s.station === 'oven' && s.stage === 'blocked') raw.push({ t0: s.t0, t1: s.t1, state: 'heating', arm: s.arm });
    }
  raw.sort((a, b) => a.t0 - b.t0 || (a.state === 'door' ? 1 : -1));
  const out: OvenSpan[] = [];
  let t = 0;
  for (const s of raw) {
    if (s.t1 <= t + EPS) continue;
    const t0 = Math.max(s.t0, t);
    if (t0 > t + EPS) out.push({ t0: t, t1: t0, state: 'idle', arm: null });
    out.push({ ...s, t0 });
    t = s.t1;
  }
  if (t < endMin - EPS) out.push({ t0: t, t1: endMin, state: 'idle', arm: null });
  return out;
}

/** Oven air temperature. A first-order curve; shape only, never used in a count. */
function ovenTemperature(cfg: SimConfig, oven: OvenSpan[], endMin: number): Series {
  const dt = 0.25;
  const t: number[] = [];
  const v: number[] = [];
  const lastHeat = oven.reduce((m, s) => (s.state === 'heating' ? Math.max(m, s.t1) : m), 0);
  let temp = cfg.oven.setC;
  let i = 0;
  for (let x = 0; x <= endMin + dt; x += dt) {
    while (i < oven.length - 1 && oven[i]!.t1 <= x) i++;
    const st = oven[i]?.state ?? 'idle';
    const off = x > lastHeat + cfg.times.index;
    const target = off ? 40 : st === 'door' || st === 'pause' ? cfg.oven.setC - cfg.oven.doorDipC : cfg.oven.setC;
    const tau = off ? 45 : cfg.oven.tauMin;
    temp += ((target - temp) * dt) / tau;
    if (Math.round(x / dt) % 2 === 0) {
      t.push(x);
      v.push(temp);
    }
  }
  return { t, v };
}

interface Change {
  t0: number;
  t1: number;
  delta: number;
}
function series(start: number, changes: Change[], endMin: number): Series {
  const pts = new Set<number>([0, endMin]);
  for (const c of changes) {
    pts.add(c.t0);
    pts.add(c.t1);
  }
  const t = [...pts].sort((a, b) => a - b);
  const v = t.map((x) =>
    changes.reduce((s, c) => s + c.delta * (c.t1 > c.t0 ? Math.min(1, Math.max(0, (x - c.t0) / (c.t1 - c.t0))) : x >= c.t0 ? 1 : 0), start),
  );
  return { t, v };
}

/** Powder logistics: hoppers feed the doses, a forklift bin tops the hoppers up from the silos, grinding refills the silos. */
function rawMaterial(cfg: SimConfig, doses: Dose[], endMin: number, events: SimEvent[]) {
  const R = cfg.raw;
  const hopperCh: Change[][] = [[], [], []];
  const siloCh: Change[][] = [[], [], []];
  const bins: BinTrip[] = [];
  const grinds: GrindBatch[] = [];
  const level = [...R.hopperCapacityKg];
  const inTransit = [0, 0, 0];
  let forkliftFree = 0;
  for (const d of [...doses].sort((a, b) => a.t0 - b.t0)) {
    if (d.kg <= 0) continue;
    hopperCh[d.layer]!.push({ t0: d.t0, t1: d.t1, delta: -d.kg });
    level[d.layer]! -= d.kg;
    if (level[d.layer]! + inTransit[d.layer]! < R.hopperRefillBelowKg) {
      const kg = Math.min(R.binKg, R.hopperCapacityKg[d.layer]! - level[d.layer]! - inTransit[d.layer]!);
      const t0 = Math.max(d.t1, forkliftFree);
      const t1 = t0 + R.binTripMin;
      forkliftFree = t1;
      bins.push({ layer: d.layer, kg, t0, t1 });
      events.push({ t: t0, type: 'binDispatch', layer: d.layer, kg, dur: R.binTripMin });
      siloCh[d.layer]!.push({ t0, t1: t0 + R.binTripMin * 0.25, delta: -kg });
      hopperCh[d.layer]!.push({ t0: t1 - R.binTripMin * 0.15, t1, delta: kg });
      level[d.layer]! += kg; // counted from dispatch, so no second bin is called for the same shortfall
    }
  }
  // Grinding on demand (assumption A11): the powder each layer will use today is ground today, one layer after another.
  const need = [0, 1, 2].map((l) => doses.filter((d) => d.layer === l).reduce((s, d) => s + d.kg, 0));
  let g = 0;
  need.forEach((kg, layer) => {
    if (kg <= 0) return;
    const dur = (kg / R.grindRateKgH) * 60;
    grinds.push({ layer, kg, t0: g, t1: g + dur });
    events.push({ t: g, type: 'grind', layer, kg, dur });
    siloCh[layer]!.push({ t0: g, t1: g + dur, delta: kg });
    g += dur;
  });
  const end = Math.max(endMin, g);
  const start = R.siloCapacityKg * R.siloStartFill;
  return {
    silo: [0, 1, 2].map((l) => series(start, siloCh[l]!, end)) as [Series, Series, Series],
    hopper: [0, 1, 2].map((l) => series(R.hopperCapacityKg[l]!, hopperCh[l]!, end)) as [Series, Series, Series],
    bins,
    grinds,
  };
}

function kpis(
  cfg: SimConfig,
  arms: Rt[],
  segments: Segment[][],
  tanks: TankRecord[],
  doses: Dose[],
  oven: OvenSpan[],
  lastOut: number,
  uncooked: number,
): Kpis {
  const zero = (): PerSku<number> => ({ CTT4: 0, CTT2: 0, HTT2: 0 });
  const tanksInShift = zero();
  const tanksTotal = zero();
  let otherItems = 0;
  for (const k of tanks) {
    if (k.kind === 'OTHER') {
      otherItems += 1;
      continue;
    }
    tanksTotal[k.kind] += 1;
    if (k.out <= cfg.shiftMin + EPS) tanksInShift[k.kind] += 1;
  }
  const hold = oven.reduce((s, o) => s + (o.state === 'heating' || o.state === 'pause' ? Math.max(0, Math.min(o.t1, cfg.shiftMin) - o.t0) : 0), 0);
  const gaps: number[] = [];
  for (const a of arms) for (let i = 1; i < a.ovenEntries.length; i++) gaps.push(a.ovenEntries[i]! - a.ovenEntries[i - 1]!);
  const waitByCause: Kpis['waitByCause'] = {};
  let waitOven = 0;
  let waitDemould = 0;
  let blocked = 0;
  for (const segs of segments)
    for (const s of segs) {
      const d = s.t1 - s.t0;
      if (s.stage === 'waitOven') waitOven += d;
      if (s.stage === 'waitDemould') waitDemould += d;
      if (s.stage === 'blocked') blocked += d;
      if ((s.stage === 'waitOven' || s.stage === 'blocked' || s.stage === 'waitDemould') && s.waitFor)
        waitByCause[s.waitFor] = (waitByCause[s.waitFor] ?? 0) + d;
      else if (s.stage === 'waitOven') waitByCause.oven = (waitByCause.oven ?? 0) + d;
    }
  const ovenVisits = arms.reduce((s, a) => s + a.ovenEntries.length, 0);
  const armCycles = new Set(tanks.map((k) => `${k.arm}:${k.cycle}`)).size;
  const dosedKg = [0, 1, 2].map((l) => doses.filter((d) => d.layer === l).reduce((s, d) => s + d.kg, 0)) as [number, number, number];
  const causes = Object.entries(waitByCause) as [StationId | 'crew', number][];
  // The crew wait is an input (NTG's estimate), so it cannot be "the bottleneck" the model finds.
  const found = causes.filter(([c]) => c !== 'crew').sort((a, b) => b[1] - a[1])[0];
  return {
    tanksInShift,
    tanksTotal,
    otherItems,
    planned: plannedTanks(cfg.arms),
    armCycles,
    ovenVisits,
    ovenUtilisation: hold / cfg.shiftMin,
    cycleMin: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0,
    meanWaitOvenMin: ovenVisits ? waitOven / ovenVisits : 0,
    meanWaitDemouldMin: armCycles ? waitDemould / armCycles : 0,
    meanBlockedMin: ovenVisits ? blocked / ovenVisits : 0,
    runOutMin: Math.max(0, lastOut - cfg.shiftMin),
    dosedKg,
    pigmentKg: dosedKg[0] * cfg.raw.pigmentDose,
    foamAgentKg: dosedKg[1] * cfg.raw.foamDose,
    bottleneck: found && found[1] > EPS ? found[0] : 'none',
    waitByCause,
    uncookedArms: uncooked,
  };
}

/** A week is a list of shifts, each with its own arm set-up. Returns totals. */
export function runWeek(days: SimConfig[], seed = 1) {
  const runs = days.map((d, i) => runSimulation(d, seed + i));
  const total = { CTT4: 0, CTT2: 0, HTT2: 0 };
  for (const r of runs) for (const k of SKUS) total[k] += r.kpis.tanksTotal[k];
  return { runs, total };
}
