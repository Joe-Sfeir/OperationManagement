/**
 * Simulator types. Pure TypeScript: nothing in src/sim imports React or three.
 * Time is in minutes from the start of the shift.
 */
import type { Sku, PerSku } from '../data/params';

export type MouldKind = Sku | 'OTHER';

/** Carousel positions. Which five are used depends on the cooling layout (see config). */
export type StationId = 'load' | 'wait' | 'oven' | 'air' | 'chamber' | 'demould';

export type Stage =
  | 'idle' // empty, nothing to do
  | 'loading' // close mould, first layer of powder in
  | 'waitOven' // loaded, waiting for the oven turn
  | 'moving' // indexing between positions
  | 'heating' // in the oven, tumbling
  | 'layerPause' // next layer of powder going in
  | 'blocked' // work done here, next position still occupied
  | 'airCooling'
  | 'waterCooling'
  | 'waitDemould' // cooled, waiting for the crew
  | 'demoulding'; // hoist lifts the tanks out, mould prepared

export interface ArmSetup {
  /** Moulds mounted on the arm. Empty = arm runs empty. */
  moulds: MouldKind[];
}

export interface SimTimes {
  load: number;
  ovenVisit: number;
  layerPause: number;
  air: number;
  water: number;
  demouldWait: number;
  demould: number;
  index: number;
  finishing: number;
}

export interface SimConfig {
  arms: ArmSetup[];
  shiftMin: number;
  times: SimTimes;
  /**
   * singleVisit: one oven visit covers all layers; the arm pauses in place for the next layer.
   * returnToLoad: the arm swings back to the position before the oven for each new layer.
   */
  layerMode: 'singleVisit' | 'returnToLoad';
  /** true: the between-layer pauses are part of the 28.5 min visit. false: they are added on top. */
  pausesInsideVisit: boolean;
  /**
   * airAtOpenPosition: load, oven, open air position, cooling chamber, demould.
   * bothInChamber: load, waiting position, oven, cooling chamber (air then water), demould.
   */
  cooling: 'airAtOpenPosition' | 'bothInChamber';
  /** finishWip: the oven takes no arm it cannot finish by shift end; arms already cooked run out. */
  endOfShift: 'finishWip' | 'hardStop';
  /** kg per layer per tank [outer, foam, inner]. */
  layerKg: PerSku<[number, number, number]>;
  layers: number;
  /** 0 = deterministic (default). 0.1 = each task time varies by up to +/-10 %, drawn from the seeded generator. */
  jitter: number;
  raw: RawConfig;
  oven: { setC: number; doorDipC: number; tauMin: number };
}

export interface RawConfig {
  siloCapacityKg: number;
  siloStartFill: number;
  grindRateKgH: number;
  /** Hopper capacity per layer [outer, foam, inner]. */
  hopperCapacityKg: [number, number, number];
  hopperRefillBelowKg: number;
  binKg: number;
  binTripMin: number;
  pigmentDose: number;
  foamDose: number;
}

/** One stretch of an arm's shift. Segments of an arm are contiguous and ordered. */
export interface Segment {
  arm: number;
  t0: number;
  t1: number;
  stage: Stage;
  /** Position the arm is at. For 'moving' this is the destination. */
  station: StationId;
  /** Only for 'moving'. */
  from?: StationId;
  /** 1-based layer for heating and layerPause, 0 otherwise. */
  layer: number;
  cycle: number;
  /** For waits and blocks: what the arm is waiting for. */
  waitFor?: StationId | 'crew';
  /** What the moulds hold during this stretch. */
  content: MouldContent;
}

export type MouldContent = 'empty' | 'powder' | 'cooking' | 'hot' | 'cooled';

export type SimEvent =
  | { t: number; type: 'move'; arm: number; from: StationId; to: StationId; dur: number }
  | { t: number; type: 'load'; arm: number; dur: number; kg: number }
  | { t: number; type: 'ovenIn'; arm: number; cycle: number }
  | { t: number; type: 'layer'; arm: number; layer: number; dur: number; kg: number }
  | { t: number; type: 'ovenOut'; arm: number; cycle: number }
  | { t: number; type: 'cool'; arm: number; phase: 'air' | 'water'; dur: number }
  | { t: number; type: 'demould'; arm: number; dur: number }
  | { t: number; type: 'tankOut'; arm: number; kind: MouldKind }
  | { t: number; type: 'tankFinished'; kind: MouldKind }
  | { t: number; type: 'binDispatch'; layer: number; kg: number; dur: number }
  | { t: number; type: 'grind'; layer: number; kg: number; dur: number };

export interface Dose {
  t0: number;
  t1: number;
  layer: number; // 0 outer, 1 foam, 2 inner
  kg: number;
  arm: number;
}

export interface TankRecord {
  kind: MouldKind;
  arm: number;
  cycle: number;
  /** Lifted out of the mould. */
  out: number;
  /** Finishing done: enters the finished buffer. */
  finished: number;
}

/** Piecewise-linear level over time: points (t, v), ordered by t. */
export type Series = { t: number[]; v: number[] };

export interface BinTrip {
  layer: number;
  kg: number;
  t0: number;
  t1: number;
}
export interface GrindBatch {
  layer: number;
  kg: number;
  t0: number;
  t1: number;
}

export interface OvenSpan {
  t0: number;
  t1: number;
  state: 'heating' | 'pause' | 'door' | 'idle';
  arm: number | null;
}

export interface Kpis {
  /** Tanks lifted out by the end of the shift. */
  tanksInShift: PerSku<number>;
  /** Tanks lifted out including the run-out after the shift. */
  tanksTotal: PerSku<number>;
  otherItems: number;
  /** NTG planning rule: moulds x 4 cycles a day. */
  planned: PerSku<number>;
  armCycles: number;
  ovenVisits: number;
  /** Share of the shift the oven holds an arm (heating or layer pause). */
  ovenUtilisation: number;
  /** Mean minutes between two oven entries of the same arm. */
  cycleMin: number;
  meanWaitOvenMin: number;
  meanWaitDemouldMin: number;
  meanBlockedMin: number;
  /** Minutes after shift end until the last tank is out. 0 if all done in the shift. */
  runOutMin: number;
  dosedKg: [number, number, number];
  pigmentKg: number;
  foamAgentKg: number;
  /** Position that made arms wait the longest in total. */
  bottleneck: StationId | 'crew' | 'none';
  waitByCause: Partial<Record<StationId | 'crew', number>>;
  /** Arms left loaded but not cooked (only if the oven closed on them). */
  uncookedArms: number;
}

export interface SimResult {
  config: SimConfig;
  seed: number;
  ring: StationId[];
  segments: Segment[][];
  events: SimEvent[];
  doses: Dose[];
  tanks: TankRecord[];
  oven: OvenSpan[];
  ovenTemp: Series;
  silo: [Series, Series, Series];
  hopper: [Series, Series, Series];
  bins: BinTrip[];
  grinds: GrindBatch[];
  kpis: Kpis;
  /** End of the last activity (shift end or end of run-out). */
  endMin: number;
  /** Cumulative rotating minutes at the start of each segment, per arm. */
  rotPrefix: number[][];
}

// ---- State at one instant ---------------------------------------------------

export interface ArmState {
  id: number;
  moulds: MouldKind[];
  station: StationId;
  from: StationId | null;
  /** 0..1, linear in simulated time. The scene applies the ease. */
  moveProgress: number;
  stage: Stage;
  stageProgress: number;
  stageRemainingMin: number;
  layer: number;
  lidOpen: boolean;
  waitingMin: number;
  waitFor: StationId | 'crew' | null;
  content: MouldContent;
  cycle: number;
  rotating: boolean;
  /** Minutes the moulds have been rotating so far this shift (drives the tumble angle). */
  rotMin: number;
}

export type HoistPhase = 'rest' | 'hookDown' | 'lift' | 'traverse' | 'setDown' | 'return';

export interface PlantState {
  t: number;
  arms: ArmState[];
  oven: {
    busy: boolean;
    arm: number | null;
    layer: number;
    tempC: number;
    /** 0..1 */
    doorIn: number;
    doorOut: number;
    state: OvenSpan['state'];
  };
  cooling: { chamberArm: number | null; phase: 'air' | 'water' | null; airArm: number | null; fanOn: boolean; mistOn: boolean };
  loading: { dosing: boolean; arm: number | null; layer: number; kgThisDose: number; kgDosedTotal: number; station: StationId | null };
  demould: {
    arm: number | null;
    hoist: HoistPhase;
    /** 0..1 inside the current hoist phase. */
    hoistProgress: number;
    /** Which mould on the arm is being emptied (0-based), -1 if none. */
    mouldIndex: number;
    kind: MouldKind | null;
    crewWaiting: boolean;
  };
  siloKg: [number, number, number];
  hopperKg: [number, number, number];
  bin: { active: boolean; layer: number; progress: number; kg: number };
  grind: { active: boolean; layer: number; progress: number };
  /** Lifted out, finishing not done yet. */
  finishing: MouldKind[];
  /** Finished buffer. */
  finished: PerSku<number> & { OTHER: number };
  tanksOut: PerSku<number>;
  ovenQueue: number;
  bottleneck: StationId | 'crew' | 'none';
  shiftOver: boolean;
}
