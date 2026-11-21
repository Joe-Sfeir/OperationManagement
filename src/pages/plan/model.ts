/**
 * Weekly production plan for the three water tanks on Machine 3700.
 *
 * Pure TypeScript, no React. This file builds the linear programme as CPLEX LP
 * text, hands it to HiGHS (WebAssembly), reads the answer back into typed
 * results, and re-checks the whole-arm-cycle plan with plain arithmetic that
 * shares nothing with the LP builder.
 *
 * The model (NOTES.md has the reasons and the assumptions):
 *
 *   sets       k in SKUs, t = 1..T weeks
 *   decisions  n[k,t] >= 0    arm-cycles of SKU k in plan t = 1..T-1
 *              tanks made     x[k,t] = u_k * n[k,t]      (u_k = moulds per arm)
 *   timing     arrivals[k,1] = pipeline_k                (already planned)
 *              arrivals[k,t] = x[k,t-1]   for t >= 2     (plan-to-stock lag 1 week)
 *   balance    I[k,t] = I[k,t-1] + arrivals[k,t] + returns_k - d[k,t]
 *   floor      I[k,t] + s[k,t] >= S_k,  s >= 0   (soft)  or  I[k,t] >= S_k (strict)
 *   cap        I[k,t] <= W_k                     (optional)
 *   stockout   I[k,t] >= 0
 *   machine    sum_k n[k,t] <= A_t
 *   objective  min  h * sum n + p * sum s                     (machine time), or
 *              min  c * sum n + sum hold_k * I + p_usd * sum s (cost)
 *
 * Plan t is the plan NTG fixes on the Friday of week t. The tanks are on the
 * machine and in stock in week t + 1, so the page labels plan t as "week t + 1".
 */
import highsLoader from 'highs';
import { P, SKUS, inventoryRows, type Datum, type PerSku, type Sku } from '../../data/params';
import { fullWeeks, latestStock, weekly } from '../../data/history';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Objective = 'hours' | 'cost';
export type FloorMode = 'soft' | 'strict';

export interface PlanSku {
  id: string;
  /** u_k: tanks made by one arm-cycle. */
  mouldsPerArm: number;
  /** I[k,0]. */
  openingStock: number;
  /** Tanks already planned that reach stock in week 1. */
  pipeline: number;
  /** d[k,t] for t = 1..T (index t - 1). */
  demand: number[];
  /** Returned tanks per week. */
  returns: number;
  /** S_k. */
  minStock: number;
  /** W_k. Used only when capOn is true. */
  cap: number;
  /** USD per tank per week in stock. Used by the cost objective. */
  holdingPerTankWeek: number;
}

export interface PlanInput {
  /** T. */
  weeks: number;
  skus: PlanSku[];
  /** A_t for plan t = 1..T-1 (index t - 1), in arm-cycles. */
  armCycles: number[];
  /** Machine hours one arm-cycle keeps one arm busy. */
  hoursPerArmCycle: number;
  /** USD of diesel and electricity per arm-cycle. */
  costPerArmCycle: number;
  objective: Objective;
  floor: FloorMode;
  capOn: boolean;
  /** Penalty per tank-week below the minimum, in arm-hours. */
  penaltyHours: number;
  /** Machine-time objective only: arm-hours charged per tank-week in stock, to pick the latest plan among equals. */
  tieBreak: number;
}

export interface Totals {
  armCycles: number;
  hours: number;
  tanks: number;
  /** Tank-weeks below the minimum. */
  shortage: number;
  /** Sum of end-of-week stock over SKUs and weeks 1..T. */
  stockWeeks: number;
  energyCost: number;
  holdingCost: number;
}

export interface Duals {
  /** Shadow price of the machine row of plan t (index t - 1). Objective units per arm-cycle. */
  capacity: number[];
  /** Shadow price of the floor row [k][t - 1]. Objective units per tank of minimum. */
  floor: number[][];
}

export type SolveStatus = 'optimal' | 'limit' | 'infeasible' | 'error';

export interface PlanSolution {
  kind: 'lp' | 'integer';
  status: SolveStatus;
  /** HiGHS' own status text. */
  solverStatus: string;
  /** n[k][t - 1], plan t = 1..T-1. */
  n: number[][];
  /** x[k][t - 1] = u_k n. */
  tanks: number[][];
  /** stock[k][t], t = 0..T. stock[k][0] is the opening stock. */
  stock: number[][];
  /** shortage[k][t - 1], t = 1..T. */
  shortage: number[][];
  /** sum_k n[k,t] per plan. */
  armCyclesByPlan: number[];
  totals: Totals;
  /** Objective value reported by HiGHS. */
  objective: number;
  duals: Duals | null;
  lpText: string;
}

export interface CapRelaxation {
  sku: string;
  week: number;
  /** Stock that week if nothing at all is made: the lowest stock the plan can reach. */
  bound: number;
  cap: number;
}

export type Solver = { solve(problem: string, options?: Record<string, unknown>): unknown };

// ---------------------------------------------------------------------------
// HiGHS loading. Node (Vitest) loads the wasm next to the package. The browser
// entry calls setHighsLoader() with a loader that passes the inlined binary.
// ---------------------------------------------------------------------------

let loader: () => Promise<Solver> = () => highsLoader();
let solverPromise: Promise<Solver> | null = null;

export function setHighsLoader(fn: () => Promise<Solver>): void {
  loader = fn;
  solverPromise = null;
}

export function getSolver(): Promise<Solver> {
  if (!solverPromise) {
    solverPromise = loader().catch((e: unknown) => {
      solverPromise = null;
      throw e;
    });
  }
  return solverPromise;
}

// ---------------------------------------------------------------------------
// LP text
// ---------------------------------------------------------------------------

const TOL = 1e-6;

/** Plain decimal, never exponent notation, so the LP reader cannot misread it. */
function num(x: number): string {
  if (!Number.isFinite(x)) throw new Error(`Not a finite number: ${x}`);
  const s = x.toFixed(9).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
}

const safe = (id: string) => id.replace(/[^A-Za-z0-9]/g, '');
const nVar = (k: PlanSku, t: number) => `n_${safe(k.id)}_${t}`;
const iVar = (k: PlanSku, t: number) => `I_${safe(k.id)}_${t}`;
const sVar = (k: PlanSku, t: number) => `sh_${safe(k.id)}_${t}`;
const cVar = (k: PlanSku, t: number) => `N_${safe(k.id)}_${t}`;

type Term = [number, string];

function expr(terms: Term[]): string {
  const parts = terms
    .filter(([c]) => c !== 0)
    .map(([c, name], i) => {
      const sign = c < 0 ? '-' : i === 0 ? '' : '+';
      return `${sign}${sign ? ' ' : ''}${num(Math.abs(c))} ${name}`;
    });
  const lines: string[] = [];
  for (let i = 0; i < parts.length; i += 4) lines.push(parts.slice(i, i + 4).join(' '));
  return lines.join('\n    ');
}

/** Penalty per tank-week short, in the units of the chosen objective. */
export function penaltyPerTankWeek(input: PlanInput): number {
  return input.objective === 'cost'
    ? (input.penaltyHours * input.costPerArmCycle) / input.hoursPerArmCycle
    : input.penaltyHours;
}

/** Stock at the end of each week if nothing at all is made. stock[k][t], t = 0..T. */
export function stockWithNoProduction(input: PlanInput): number[][] {
  return input.skus.map((k) => {
    const row = [k.openingStock];
    for (let t = 1; t <= input.weeks; t++) {
      row.push(row[t - 1]! + (t === 1 ? k.pipeline : 0) + k.returns - k.demand[t - 1]!);
    }
    return row;
  });
}

/**
 * Cells where the warehouse cap cannot hold whatever is made: stock is above the
 * cap even with zero production. The cap is relaxed to that stock for those cells.
 */
export function capRelaxations(input: PlanInput): CapRelaxation[] {
  if (!input.capOn) return [];
  const base = stockWithNoProduction(input);
  const out: CapRelaxation[] = [];
  input.skus.forEach((k, ki) => {
    for (let t = 1; t <= input.weeks; t++) {
      const b = base[ki]![t]!;
      if (b > k.cap + TOL) out.push({ sku: k.id, week: t, bound: b, cap: k.cap });
    }
  });
  return out;
}

export function validateInput(input: PlanInput): void {
  const T = input.weeks;
  if (!Number.isInteger(T) || T < 1) throw new Error('The horizon must be at least one week.');
  if (input.armCycles.length !== Math.max(0, T - 1)) throw new Error('armCycles needs one entry per plan (T - 1).');
  for (const k of input.skus) {
    if (k.demand.length !== T) throw new Error(`${k.id}: demand needs one entry per week.`);
    if (!(k.mouldsPerArm > 0)) throw new Error(`${k.id}: moulds per arm must be above zero.`);
  }
}

/**
 * The LP in CPLEX LP format. `elastic` adds the three slack families used only
 * to explain an infeasible model (see diagnose()). `tighten` adds the rounding
 * rows to the whole-arm-cycle model; model.test.ts solves with and without them
 * and checks the answer is the same.
 */
export function buildLp(input: PlanInput, integer: boolean, elastic = false, tighten = true): string {
  validateInput(input);
  const T = input.weeks;
  const soft = input.floor === 'soft';
  const pen = penaltyPerTankWeek(input);
  const base = stockWithNoProduction(input);

  const objective: Term[] = [];
  const balance: string[] = [];
  const floor: string[] = [];
  const machine: string[] = [];
  const cumulative: string[] = [];
  const bounds: string[] = [];
  const general: string[] = [];

  input.skus.forEach((k, ki) => {
    const lostVar = (t: number) => `lost_${safe(k.id)}_${t}`;
    const overVar = (t: number) => `over_${safe(k.id)}_${t}`;
    for (let t = 1; t <= T - 1; t++) {
      const perCycle = elastic ? 0.001 : input.objective === 'cost' ? input.costPerArmCycle : input.hoursPerArmCycle;
      objective.push([perCycle, nVar(k, t)]);
      if (integer) {
        // Running total of arm-cycles N[k,t] = n[k,1] + ... + n[k,t], also whole. It adds
        // no restriction (a sum of whole numbers is whole). It gives branch and bound a
        // variable that cannot dodge a rounding by moving a fraction to another week.
        general.push(nVar(k, t), cVar(k, t));
        cumulative.push(` cum_${safe(k.id)}_${t}: ${expr([[1, cVar(k, t)], ...(t > 1 ? [[-1, cVar(k, t - 1)] as Term] : []), [-1, nVar(k, t)]])} = 0`);
        if (tighten) {
          // Stock next week is fixed by the running total: I[k,t+1] = b + u N[k,t], where b
          // is the stock with nothing made. So every stock rule is a bound on N, and a
          // bound on a whole number can be rounded. None of these rows removes a
          // whole-arm-cycle plan; they only cut off plans with part arm-cycles.
          const b = base[ki]![t + 1]!;
          const u = k.mouldsPerArm;
          const need = (level: number) => Math.ceil((level - b) / u - 1e-9);
          let lo = b < 0 ? need(0) : 0;
          if (!soft) lo = Math.max(lo, need(k.minStock));
          if (lo > 0) cumulative.push(` nlo_${safe(k.id)}_${t}: ${expr([[1, cVar(k, t)]])} >= ${lo}`);
          if (input.capOn) {
            const hi = Math.floor((Math.max(k.cap, b) - b) / u + 1e-9);
            cumulative.push(` nhi_${safe(k.id)}_${t}: ${expr([[1, cVar(k, t)]])} <= ${hi}`);
          }
          if (soft && k.minStock - b > 1e-9) {
            // Rounding cut for the soft floor. c whole arm-cycles reach the minimum; one
            // fewer leaves g tanks short, and each further one fewer leaves at least g more.
            const c = need(k.minStock);
            const g = Number(num(k.minStock - b - u * (c - 1)));
            cumulative.push(` round_${safe(k.id)}_${t + 1}: ${expr([[1, sVar(k, t + 1)], [g, cVar(k, t)]])} >= ${num(g * c)}`);
          }
        }
      }
    }
    for (let t = 1; t <= T; t++) {
      if (elastic) {
        // Running out is worst, then breaking a strict floor, then going over the cap.
        // Under a soft floor a shortage is allowed, so it gets a token weight only.
        objective.push([10000, lostVar(t)], [soft ? 0.01 : 100, sVar(k, t)]);
        if (input.capOn) objective.push([1, overVar(t)]);
      } else {
        objective.push([input.objective === 'cost' ? k.holdingPerTankWeek : input.tieBreak, iVar(k, t)]);
        if (soft) objective.push([pen, sVar(k, t)]);
      }

      // Stock balance, with the constant terms moved to the right-hand side.
      const lost: Term[] = elastic ? [[-1, lostVar(t)]] : [];
      if (t === 1) {
        balance.push(` bal_${safe(k.id)}_1: ${expr([[1, iVar(k, 1)], ...lost])} = ${num(k.openingStock + k.pipeline + k.returns - k.demand[0]!)}`);
      } else {
        balance.push(
          ` bal_${safe(k.id)}_${t}: ${expr([[1, iVar(k, t)], [-1, iVar(k, t - 1)], [-k.mouldsPerArm, nVar(k, t - 1)], ...lost])} = ${num(k.returns - k.demand[t - 1]!)}`,
        );
      }

      // Stock floor.
      floor.push(` floor_${safe(k.id)}_${t}: ${expr(soft || elastic ? [[1, iVar(k, t)], [1, sVar(k, t)]] : [[1, iVar(k, t)]])} >= ${num(k.minStock)}`);

      // Warehouse cap, relaxed only where zero production is already above it.
      if (input.capOn) {
        const ub = Math.max(k.cap, base[ki]![t]!);
        if (elastic) machine.push(` cap_${safe(k.id)}_${t}: ${expr([[1, iVar(k, t)], [-1, overVar(t)]])} <= ${num(ub)}`);
        else bounds.push(` ${iVar(k, t)} <= ${num(ub > k.cap ? ub + 1e-7 : ub)}`);
      }
    }
  });

  for (let t = 1; t <= T - 1; t++) {
    machine.push(` mach_${t}: ${expr(input.skus.map((k) => [1, nVar(k, t)] as Term))} <= ${num(input.armCycles[t - 1]!)}`);
  }

  const first = input.skus[0];
  const objText = expr(objective) || (first ? `0 ${iVar(first, 1)}` : '');
  return [
    '\\ Machine 3700 weekly plan. Built by src/pages/plan/model.ts',
    'Minimize',
    ` obj: ${objText}`,
    'Subject To',
    ...balance,
    ...floor,
    ...machine,
    ...cumulative,
    ...(bounds.length ? ['Bounds', ...bounds] : []),
    ...(general.length ? ['General', ` ${general.join(' ')}`] : []),
    'End',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Solve
// ---------------------------------------------------------------------------

interface RawColumn {
  Primal?: number;
}
interface RawRow {
  Name?: string;
  Dual?: number;
}
interface RawSolution {
  Status: string;
  ObjectiveValue: number;
  Columns: Record<string, RawColumn>;
  Rows: RawRow[];
}

const SOLVER_OPTIONS = { output_flag: false, mip_rel_gap: 0, time_limit: 20 };

function emptySolution(input: PlanInput, kind: 'lp' | 'integer', status: SolveStatus, solverStatus: string, lpText: string): PlanSolution {
  const T = input.weeks;
  return {
    kind,
    status,
    solverStatus,
    n: input.skus.map(() => Array<number>(Math.max(0, T - 1)).fill(0)),
    tanks: input.skus.map(() => Array<number>(Math.max(0, T - 1)).fill(0)),
    stock: input.skus.map((k) => [k.openingStock, ...Array<number>(T).fill(Number.NaN)]),
    shortage: input.skus.map(() => Array<number>(T).fill(0)),
    armCyclesByPlan: Array<number>(Math.max(0, T - 1)).fill(0),
    totals: { armCycles: 0, hours: 0, tanks: 0, shortage: 0, stockWeeks: 0, energyCost: 0, holdingCost: 0 },
    objective: Number.NaN,
    duals: null,
    lpText,
  };
}

/** Solve the model once, as a continuous LP or with whole arm-cycles. */
export async function solveModel(input: PlanInput, integer: boolean, tighten = true): Promise<PlanSolution> {
  const kind = integer ? 'integer' : 'lp';
  const lpText = buildLp(input, integer, false, tighten);
  const solver = await getSolver();
  let raw: RawSolution;
  try {
    raw = solver.solve(lpText, SOLVER_OPTIONS) as RawSolution;
  } catch (e) {
    return emptySolution(input, kind, 'error', e instanceof Error ? e.message : String(e), lpText);
  }
  if (raw.Status === 'Infeasible' || raw.Status === 'Primal infeasible or unbounded') {
    return emptySolution(input, kind, 'infeasible', raw.Status, lpText);
  }
  const T = input.weeks;
  const col = (name: string): number | undefined => raw.Columns[name]?.Primal;
  const hasSolution = input.skus.every((k) => typeof col(iVar(k, 1)) === 'number' && Number.isFinite(col(iVar(k, 1))));
  const status: SolveStatus = raw.Status === 'Optimal' ? 'optimal' : raw.Status === 'Time limit reached' && hasSolution ? 'limit' : 'error';
  if (status === 'error') return emptySolution(input, kind, 'error', raw.Status, lpText);

  const clean = (x: number) => (Math.abs(x) < 1e-9 ? 0 : x);
  const n = input.skus.map((k) =>
    Array.from({ length: T - 1 }, (_, i) => {
      const x = col(nVar(k, i + 1)) ?? 0;
      return integer && Math.abs(x - Math.round(x)) < 1e-6 ? Math.round(x) : clean(x);
    }),
  );
  const stock = input.skus.map((k) => [k.openingStock, ...Array.from({ length: T }, (_, i) => clean(col(iVar(k, i + 1)) ?? Number.NaN))]);
  const shortage = input.skus.map((k) => Array.from({ length: T }, (_, i) => (input.floor === 'soft' ? clean(Math.max(0, col(sVar(k, i + 1)) ?? 0)) : 0)));
  const tanks = n.map((row, ki) => row.map((x) => x * input.skus[ki]!.mouldsPerArm));
  const armCyclesByPlan = Array.from({ length: T - 1 }, (_, i) => n.reduce((a, row) => a + row[i]!, 0));

  let duals: Duals | null = null;
  if (!integer && status === 'optimal') {
    const byName = new Map(raw.Rows.map((r) => [r.Name ?? '', r.Dual ?? 0]));
    duals = {
      capacity: Array.from({ length: T - 1 }, (_, i) => clean(byName.get(`mach_${i + 1}`) ?? 0)),
      floor: input.skus.map((k) => Array.from({ length: T }, (_, i) => clean(byName.get(`floor_${safe(k.id)}_${i + 1}`) ?? 0))),
    };
  }

  return {
    kind,
    status,
    solverStatus: raw.Status,
    n,
    tanks,
    stock,
    shortage,
    armCyclesByPlan,
    totals: totalsOf(input, n, stock, shortage),
    objective: raw.ObjectiveValue,
    duals,
    lpText,
  };
}

function totalsOf(input: PlanInput, n: number[][], stock: number[][], shortage: number[][]): Totals {
  let armCycles = 0;
  let tanks = 0;
  let short = 0;
  let stockWeeks = 0;
  let holdingCost = 0;
  input.skus.forEach((k, ki) => {
    for (const x of n[ki]!) {
      armCycles += x;
      tanks += x * k.mouldsPerArm;
    }
    for (const s of shortage[ki]!) short += s;
    for (let t = 1; t <= input.weeks; t++) {
      stockWeeks += stock[ki]![t]!;
      holdingCost += k.holdingPerTankWeek * stock[ki]![t]!;
    }
  });
  return {
    armCycles,
    hours: armCycles * input.hoursPerArmCycle,
    tanks,
    shortage: short,
    stockWeeks,
    energyCost: armCycles * input.costPerArmCycle,
    holdingCost,
  };
}

/** The objective value the totals imply. Used to cross-check the solver's own figure. */
export function objectiveOf(input: PlanInput, t: Totals): number {
  const pen = input.floor === 'soft' ? penaltyPerTankWeek(input) * t.shortage : 0;
  return input.objective === 'cost' ? t.energyCost + t.holdingCost + pen : t.hours + pen + input.tieBreak * t.stockWeeks;
}

// ---------------------------------------------------------------------------
// Independent re-check. Plain arithmetic from the inputs and the arm-cycles
// only. It does not read the LP text and does not call the LP builder.
// ---------------------------------------------------------------------------

export type CheckStatus = 'pass' | 'fail' | 'allowed';

export interface CheckRow {
  id: 'whole' | 'balance' | 'stockout' | 'floor' | 'cap' | 'machine' | 'objective';
  rule: string;
  /** How many rows were recomputed and how many hold. */
  rows: number;
  held: number;
  status: CheckStatus;
  detail: string;
}

export interface Recomputed {
  stock: number[][];
  shortage: number[][];
  armCyclesByPlan: number[];
  totals: Totals;
}

/** Walk the stock forward week by week from the arm-cycles. */
export function recompute(input: PlanInput, n: number[][]): Recomputed {
  const T = input.weeks;
  const stock: number[][] = [];
  const shortage: number[][] = [];
  input.skus.forEach((k, ki) => {
    const s = [k.openingStock];
    const sh: number[] = [];
    for (let t = 1; t <= T; t++) {
      const arrivals = t === 1 ? k.pipeline : k.mouldsPerArm * n[ki]![t - 2]!;
      const level = s[t - 1]! + arrivals + k.returns - k.demand[t - 1]!;
      s.push(level);
      sh.push(Math.max(0, k.minStock - level));
    }
    stock.push(s);
    shortage.push(sh);
  });
  const armCyclesByPlan = Array.from({ length: Math.max(0, T - 1) }, (_, i) => n.reduce((a, row) => a + row[i]!, 0));
  let armCycles = 0;
  let tanks = 0;
  let short = 0;
  let stockWeeks = 0;
  let holdingCost = 0;
  input.skus.forEach((k, ki) => {
    for (const x of n[ki]!) {
      armCycles += x;
      tanks += x * k.mouldsPerArm;
    }
    for (let t = 1; t <= T; t++) {
      short += shortage[ki]![t - 1]!;
      stockWeeks += stock[ki]![t]!;
      holdingCost += k.holdingPerTankWeek * stock[ki]![t]!;
    }
  });
  return {
    stock,
    shortage,
    armCyclesByPlan,
    totals: {
      armCycles,
      hours: armCycles * input.hoursPerArmCycle,
      tanks,
      shortage: short,
      stockWeeks,
      energyCost: armCycles * input.costPerArmCycle,
      holdingCost,
    },
  };
}

const weeksText = (ws: number[]) => (ws.length === 1 ? `week ${ws[0]}` : `weeks ${ws.join(', ')}`);

/** Re-check a plan against every constraint family. `wholeCycles` adds the whole-number row. */
export function recheck(input: PlanInput, sol: PlanSolution, wholeCycles = true): CheckRow[] {
  const T = input.weeks;
  const r = recompute(input, sol.n);
  const rows: CheckRow[] = [];
  const tol = 1e-6;

  // 1. Whole, non-negative arm-cycles.
  {
    let total = 0;
    let held = 0;
    for (const row of sol.n)
      for (const x of row) {
        total++;
        if (x >= -tol && (!wholeCycles || Math.abs(x - Math.round(x)) <= tol)) held++;
      }
    const what = wholeCycles ? 'whole numbers of arm-cycles, none negative' : 'at or above zero';
    rows.push({
      id: 'whole',
      rule: wholeCycles ? 'Whole arm-cycles, none negative' : 'No negative arm-cycles',
      rows: total,
      held,
      status: held === total ? 'pass' : 'fail',
      detail: held === total ? `All ${total} entries of the plan are ${what}.` : `${total - held} of ${total} entries of the plan are not ${what}.`,
    });
  }

  // 2. Stock balance: the recomputed stock must equal the stock the solver reports.
  {
    let total = 0;
    let held = 0;
    let worst = 0;
    input.skus.forEach((_, ki) => {
      for (let t = 1; t <= T; t++) {
        total++;
        const gap = Math.abs(r.stock[ki]![t]! - sol.stock[ki]![t]!);
        if (gap <= 1e-5) held++;
        if (gap > worst || Number.isNaN(gap)) worst = gap;
      }
    });
    rows.push({
      id: 'balance',
      rule: 'Stock balance',
      rows: total,
      held,
      status: held === total ? 'pass' : 'fail',
      detail: held === total ? `Stock recomputed week by week from the plan matches the solver in all ${total} tank-weeks.` : `Recomputed stock differs from the solver in ${total - held} tank-weeks (largest gap ${worst.toFixed(3)} tanks).`,
    });
  }

  // 3. No stockout.
  {
    let total = 0;
    let held = 0;
    let lowest = Infinity;
    input.skus.forEach((_, ki) => {
      for (let t = 1; t <= T; t++) {
        total++;
        const level = r.stock[ki]![t]!;
        if (level >= -tol) held++;
        lowest = Math.min(lowest, level);
      }
    });
    rows.push({
      id: 'stockout',
      rule: 'No stockout',
      rows: total,
      held,
      status: held === total ? 'pass' : 'fail',
      detail: held === total ? `Stock never falls below zero. Lowest stock: ${lowest.toFixed(1)} tanks.` : `Stock falls below zero in ${total - held} tank-weeks.`,
    });
  }

  // 4. Stock floor.
  {
    let total = 0;
    let held = 0;
    const where: string[] = [];
    input.skus.forEach((k, ki) => {
      const ws: number[] = [];
      for (let t = 1; t <= T; t++) {
        total++;
        if (r.stock[ki]![t]! >= k.minStock - tol) held++;
        else ws.push(t);
      }
      if (ws.length) where.push(`${k.id} ${weeksText(ws)}`);
    });
    const ok = held === total;
    rows.push({
      id: 'floor',
      rule: input.floor === 'soft' ? 'Minimum stock (flexible target)' : 'Minimum stock (strict floor)',
      rows: total,
      held,
      status: ok ? 'pass' : input.floor === 'soft' ? 'allowed' : 'fail',
      detail: ok
        ? `Stock is at or above the minimum in all ${total} tank-weeks.`
        : `Below the minimum in ${where.join('; ')}: ${r.totals.shortage.toFixed(1)} tank-weeks in total.${input.floor === 'soft' ? ' Allowed, because the minimum is a flexible target.' : ''}`,
    });
  }

  // 5. Warehouse cap.
  if (input.capOn) {
    let total = 0;
    let held = 0;
    let excused = 0;
    const where: string[] = [];
    input.skus.forEach((k, ki) => {
      let noProduction = k.openingStock;
      const ws: number[] = [];
      for (let t = 1; t <= T; t++) {
        total++;
        noProduction += (t === 1 ? k.pipeline : 0) + k.returns - k.demand[t - 1]!;
        const level = r.stock[ki]![t]!;
        if (level <= k.cap + tol) held++;
        else if (noProduction > k.cap + tol && level <= noProduction + 1e-5) {
          excused++;
          ws.push(t);
        }
      }
      if (ws.length) where.push(`${k.id} ${weeksText(ws)}`);
    });
    const ok = held + excused === total;
    rows.push({
      id: 'cap',
      rule: 'Warehouse cap',
      rows: total,
      held: held + excused,
      status: ok ? 'pass' : 'fail',
      detail: !ok
        ? `Stock is above the cap in ${total - held - excused} tank-weeks where the plan could have avoided it.`
        : excused
          ? `Stock is at or under the cap in ${held} of ${total} tank-weeks. In ${where.join('; ')} stock is above the cap even with nothing made, so the cap cannot apply there and the plan makes nothing extra.`
          : `Stock is at or under the cap in all ${total} tank-weeks.`,
    });
  }

  // 6. Machine capacity.
  {
    const total = Math.max(0, T - 1);
    let held = 0;
    let tightest = Infinity;
    for (let i = 0; i < total; i++) {
      const spare = input.armCycles[i]! - r.armCyclesByPlan[i]!;
      if (spare >= -tol) held++;
      tightest = Math.min(tightest, spare);
    }
    rows.push({
      id: 'machine',
      rule: 'Machine capacity',
      rows: total,
      held,
      status: held === total ? 'pass' : 'fail',
      detail: held === total ? `Arm-cycles are within the arm-cycles available in all ${total} planned weeks. Least spare: ${Number.isFinite(tightest) ? tightest.toFixed(tightest % 1 ? 1 : 0) : '0'} arm-cycles.` : `More arm-cycles than available in ${total - held} weeks.`,
    });
  }

  // 7. Objective: the solver's figure must equal the figure recomputed from the plan.
  {
    const mine = objectiveOf(input, r.totals);
    const ok = Math.abs(mine - sol.objective) <= 1e-5 * Math.max(1, Math.abs(mine));
    rows.push({
      id: 'objective',
      rule: 'Objective value',
      rows: 1,
      held: ok ? 1 : 0,
      status: ok ? 'pass' : 'fail',
      detail: ok ? `The total recomputed from the plan (${mine.toFixed(2)}) equals the solver's (${sol.objective.toFixed(2)}).` : `Recomputed total ${mine.toFixed(4)} differs from the solver's ${sol.objective.toFixed(4)}.`,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Why a model has no solution, in plain words
// ---------------------------------------------------------------------------

export interface Diagnosis {
  /** Demand that cannot be served even with the machine full: tanks, and where it first happens. */
  stockout: { tanks: number; sku: string; week: number } | null;
  /** Strict floor only: tank-weeks under the minimum that cannot be avoided. */
  floor: { tankWeeks: number; sku: string; week: number; worst: number } | null;
  /** Tank-weeks above the warehouse cap needed to keep the other rules. */
  cap: { tankWeeks: number; sku: string; week: number } | null;
  sentences: string[];
}

/**
 * Solve a relaxed copy of the model that is allowed to break the three rules that
 * can clash (running out, the strict floor, the cap), paying heavily for it in that
 * order. Whatever it still breaks is the reason the real model has no solution.
 */
export async function diagnose(input: PlanInput): Promise<Diagnosis> {
  const solver = await getSolver();
  const raw = solver.solve(buildLp(input, false, true), SOLVER_OPTIONS) as RawSolution;
  const out: Diagnosis = { stockout: null, floor: null, cap: null, sentences: [] };
  if (raw.Status !== 'Optimal') {
    out.sentences.push('The solver could not find the reason. Check that no input is negative.');
    return out;
  }
  const val = (name: string) => raw.Columns[name]?.Primal ?? 0;
  const scan = (prefix: string) => {
    let total = 0;
    let first: { sku: string; week: number } | null = null;
    let worst = 0;
    for (let t = 1; t <= input.weeks; t++)
      for (const k of input.skus) {
        const x = val(`${prefix}_${safe(k.id)}_${t}`);
        if (x > 1e-6) {
          total += x;
          worst = Math.max(worst, x);
          if (!first) first = { sku: k.id, week: t };
        }
      }
    return first ? { total, worst, ...(first as { sku: string; week: number }) } : null;
  };
  const lost = scan('lost');
  const short = input.floor === 'strict' ? scan('sh') : null;
  const over = input.capOn ? scan('over') : null;
  if (lost) {
    out.stockout = { tanks: lost.total, sku: lost.sku, week: lost.week };
    out.sentences.push(
      `Stock runs out. Even with every available arm-cycle used, about ${Math.ceil(lost.total - 1e-6)} tanks of demand cannot be served, first ${lost.sku} in week ${lost.week}.`,
    );
  }
  if (short) {
    out.floor = { tankWeeks: short.total, sku: short.sku, week: short.week, worst: short.worst };
    out.sentences.push(
      `The strict minimum cannot be held. Even with the machine full, stock is under the minimum for ${short.total.toFixed(1)} tank-weeks, first ${short.sku} in week ${short.week}.`,
    );
  }
  if (over) {
    out.cap = { tankWeeks: over.total, sku: over.sku, week: over.week };
    out.sentences.push(
      `The warehouse cap is in the way. To keep the other rules, ${over.sku} would have to go above its cap from week ${over.week} (${over.total.toFixed(1)} tank-weeks in total).`,
    );
  }
  if (!out.sentences.length) out.sentences.push('The rules clash only when arm-cycles must be whole. The plan with part arm-cycles is possible.');
  return out;
}

// ---------------------------------------------------------------------------
// Sensitivity of the continuous LP
// ---------------------------------------------------------------------------

/** Below this a shadow price is the tie-break showing through, not a real saving. */
export const DUAL_SHOWN_FROM = 0.05;

export interface CapacitySensitivity {
  /** Plan t (made in week t + 1). */
  plan: number;
  used: number;
  available: number;
  full: boolean;
  /** Shadow price of the machine row: change in the objective per extra arm-cycle (zero or negative). */
  dual: number;
  /** The LP solved again with one more arm-cycle that week, minus the LP as it is. Only for full weeks with a shadow price. */
  plusOne: { objective: number; hours: number; shortage: number; cost: number } | null;
}

export interface FloorSensitivity {
  sku: string;
  week: number;
  /** Shadow price of the floor row: change in the objective per tank of minimum (zero or positive). */
  dual: number;
  shortage: number;
}

export interface Sensitivity {
  capacity: CapacitySensitivity[];
  /** Floor rows that bind: stock on the minimum, or under it. */
  floor: FloorSensitivity[];
}

export async function sensitivity(input: PlanInput, lp: PlanSolution, pause: () => Promise<void> = async () => {}): Promise<Sensitivity | null> {
  if (lp.status !== 'optimal' || !lp.duals) return null;
  const capacity: CapacitySensitivity[] = [];
  for (let i = 0; i < input.armCycles.length; i++) {
    const used = lp.armCyclesByPlan[i]!;
    const available = input.armCycles[i]!;
    const dual = lp.duals.capacity[i]!;
    const full = available - used < 1e-6;
    let plusOne: CapacitySensitivity['plusOne'] = null;
    if (full && Math.abs(dual) >= DUAL_SHOWN_FROM) {
      const more = await solveModel({ ...input, armCycles: input.armCycles.map((a, j) => (j === i ? a + 1 : a)) }, false);
      if (more.status === 'optimal') {
        plusOne = {
          objective: more.objective - lp.objective,
          hours: more.totals.hours - lp.totals.hours,
          shortage: more.totals.shortage - lp.totals.shortage,
          cost: more.totals.energyCost + more.totals.holdingCost - lp.totals.energyCost - lp.totals.holdingCost,
        };
      }
      await pause();
    }
    capacity.push({ plan: i + 1, used, available, full, dual, plusOne });
  }
  const floor: FloorSensitivity[] = [];
  input.skus.forEach((k, ki) => {
    for (let t = 1; t <= input.weeks; t++) {
      const slack = lp.stock[ki]![t]! + lp.shortage[ki]![t - 1]! - k.minStock;
      if (slack < 1e-6) floor.push({ sku: k.id, week: t, dual: lp.duals!.floor[ki]![t - 1]!, shortage: lp.shortage[ki]![t - 1]! });
    }
  });
  return { capacity, floor };
}

// ---------------------------------------------------------------------------
// One call for the page: LP, whole-arm-cycle plan, re-check, diagnosis
// ---------------------------------------------------------------------------

export interface PlanResult {
  input: PlanInput;
  lp: PlanSolution;
  integer: PlanSolution;
  checks: CheckRow[];
  capRelaxed: CapRelaxation[];
  sensitivity: Sensitivity | null;
  diagnosis: Diagnosis | null;
}

export const hasPlan = (s: PlanSolution): boolean => s.status === 'optimal' || s.status === 'limit';

export async function solvePlan(input: PlanInput, pause: () => Promise<void> = async () => {}): Promise<PlanResult> {
  const lp = await solveModel(input, false);
  await pause();
  const integer = await solveModel(input, true);
  await pause();
  const checks = hasPlan(integer) ? recheck(input, integer) : [];
  const diagnosis = lp.status === 'infeasible' || integer.status === 'infeasible' ? await diagnose(input) : null;
  return { input, lp, integer, checks, capRelaxed: capRelaxations(input), sensitivity: await sensitivity(input, lp, pause), diagnosis };
}

// ---------------------------------------------------------------------------
// NTG data -> model input
// ---------------------------------------------------------------------------

export type StartKey = 'form6Nov' | 'latestErp';
export type DemandKey = 'mean' | 'busy' | 'meanPlusSd';

export interface PlanSettings {
  weeks: number;
  start: StartKey;
  openingStock: PerSku<number>;
  pipeline: PerSku<number>;
  demand: DemandKey;
  /** Percentage applied on top of the scenario. 100 = as is. */
  demandPct: number;
  /** Arm-days a week the three tanks can have. */
  armDays: number;
  floor: FloorMode;
  capOn: boolean;
  objective: Objective;
  penaltyHours: number;
}

function calc<T>(value: T, label: string, unit: string, source: string, row = 0, note = ''): Datum<T> {
  return { value, tag: 'C', row, label, unit, source, confidence: '', note };
}

const mapSku = <T>(f: (s: Sku) => T): PerSku<T> => ({ CTT4: f('CTT4'), CTT2: f('CTT2'), HTT2: f('HTT2') });

/** Mean weekly returns over the 45 full weeks of ERP history. */
export const meanWeeklyReturns: Datum<PerSku<number>> = calc(
  mapSku((s) => {
    const ws = fullWeeks(s);
    return ws.reduce((a, w) => a + w.returns, 0) / ws.length;
  }),
  'Mean weekly returns',
  'tanks/week',
  'Sum of returned tanks over the 45 full weeks of the ERP stock cards (5 Jan to 15 Nov 2026), divided by 45',
);

/** Inventory row 53: the 9 to 13 Nov plan used 8 of 16 arm-days. */
export const armDaysPlan: Datum<number> = (() => {
  const r = inventoryRows.find((x) => x.row === 53);
  const m = r ? String(r.value).match(/used\s+(\d+(?:\.\d+)?)\s+of\s+(\d+)/) : null;
  if (!r || !m) throw new Error('Inventory row 53: arm-days used by the 9 to 13 Nov plan not found');
  return { value: Number(m[1]), tag: 'C', row: 53, label: 'Arm-days the 9 to 13 Nov plan gave the three tanks', unit: 'arm-days/week', source: r.source, confidence: r.confidence, note: r.notes };
})();

/** All four arms on every working day. */
export const armDaysMax = P.arms.value * P.daysPerWeek.value;
export const hoursPerArmCycle = P.armCycleMin.value / 60;
export const costPerArmCycle = P.dieselCostPerArmCycle.value + P.electricityCostPerArmCycle.value;

/**
 * Assumption P1. One tank-week below the minimum counts as this many arm-hours.
 * The slowest tank to make is CTT4 at one mould per arm: one arm-cycle of
 * P.armCycleMin = 2 h per tank. 10 h is five times that, so no plan ever leaves a
 * whole tank short to save the machine time that would make it.
 */
export const DEFAULT_PENALTY_HOURS = 10;
/** Assumption P2. Machine-time objective only: picks the latest plan among plans with equal hours. */
export const TIE_BREAK_HOURS = 0.001;

/** Monday of the week whose closing stock is the "6 Nov" figure on NTG Form 1. */
export const FORM_WEEK_MONDAY = '2026-11-02';

export function latestWeekMonday(): string {
  const w = weekly.CTT4;
  return w[w.length - 1]!.week;
}

/** Monday of plan week 1 for a starting point: the week after the stock count. */
export function weekOneMonday(start: StartKey): Date {
  const iso = start === 'form6Nov' ? FORM_WEEK_MONDAY : latestWeekMonday();
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d;
}

export function startValues(start: StartKey): { openingStock: PerSku<number>; pipeline: PerSku<number> } {
  return start === 'form6Nov'
    ? { openingStock: { ...P.closingStock6Nov.value }, pipeline: { ...P.pipeline.value } }
    : { openingStock: latestStock(), pipeline: { CTT4: 0, CTT2: 0, HTT2: 0 } };
}

/** Weekly demand of a scenario before the percentage is applied. */
export function scenarioDemand(key: DemandKey): PerSku<number> {
  if (key === 'busy') return { ...P.deliveriesWeek2Nov.value };
  if (key === 'meanPlusSd') return mapSku((s) => P.weeklySalesMean.value[s] + P.weeklySalesSd.value[s]);
  return { ...P.weeklySalesMean.value };
}

export function defaultSettings(): PlanSettings {
  return {
    weeks: 6,
    start: 'form6Nov',
    ...startValues('form6Nov'),
    demand: 'mean',
    demandPct: 100,
    armDays: armDaysPlan.value,
    floor: 'soft',
    capOn: true,
    objective: 'hours',
    penaltyHours: DEFAULT_PENALTY_HOURS,
  };
}

export function buildInput(s: PlanSettings): PlanInput {
  const base = scenarioDemand(s.demand);
  const armCycles = s.armDays * P.cyclesPerMouldPerDay.value;
  return {
    weeks: s.weeks,
    skus: SKUS.map((k) => ({
      id: k,
      mouldsPerArm: P.mouldsPerArm.value[k],
      openingStock: s.openingStock[k],
      pipeline: s.pipeline[k],
      demand: Array<number>(s.weeks).fill((base[k] * s.demandPct) / 100),
      returns: meanWeeklyReturns.value[k],
      minStock: P.minStock.value[k],
      cap: P.warehouseCap.value[k],
      holdingPerTankWeek: P.holdingPerTankWeek.value[k],
    })),
    armCycles: Array<number>(Math.max(0, s.weeks - 1)).fill(armCycles),
    hoursPerArmCycle,
    costPerArmCycle,
    objective: s.objective,
    floor: s.floor,
    capOn: s.capOn,
    penaltyHours: s.penaltyHours,
    tieBreak: TIE_BREAK_HOURS,
  };
}

// ---------------------------------------------------------------------------
// What-if grid: re-solve at other capacities and demand levels
// ---------------------------------------------------------------------------

export const WHAT_IF_ARM_DAYS = [6, 8, 10, 12] as const;
export const WHAT_IF_DEMAND_PCT = [80, 100, 120] as const;

export interface WhatIfCell {
  armDays: number;
  demandPct: number;
  /** Whole-arm-cycle plan. */
  status: SolveStatus;
  hours: number;
  shortage: number;
  /** Continuous LP. */
  lpStatus: SolveStatus;
  lpHours: number;
  lpShortage: number;
}

export async function whatIf(s: PlanSettings, pause: () => Promise<void> = async () => {}, cancelled: () => boolean = () => false): Promise<WhatIfCell[]> {
  const cells: WhatIfCell[] = [];
  for (const armDays of WHAT_IF_ARM_DAYS) {
    for (const demandPct of WHAT_IF_DEMAND_PCT) {
      if (cancelled()) return cells;
      const input = buildInput({ ...s, armDays, demandPct });
      const lp = await solveModel(input, false);
      const integer = lp.status === 'infeasible' ? lp : await solveModel(input, true);
      cells.push({
        armDays,
        demandPct,
        status: integer.status,
        hours: integer.totals.hours,
        shortage: integer.totals.shortage,
        lpStatus: lp.status,
        lpHours: lp.totals.hours,
        lpShortage: lp.totals.shortage,
      });
      await pause();
    }
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Manual check: a case small enough to solve on paper (NOTES.md has the steps)
// ---------------------------------------------------------------------------

/**
 * One tank type, two moulds per arm, three weeks.
 * Opening stock 20, 4 tanks already planned for week 1, demand 10 a week, no
 * returns, minimum 13, no cap. The machine has 3 arm-cycles for the tanks made
 * in week 2 and 8 for the tanks made in week 3. 2 h per arm-cycle, 10 h penalty
 * per tank-week short. No tie-break, so the objective is exactly hours + penalty.
 */
export const manualInput: PlanInput = {
  weeks: 3,
  skus: [{ id: 'TANK', mouldsPerArm: 2, openingStock: 20, pipeline: 4, demand: [10, 10, 10], returns: 0, minStock: 13, cap: 0, holdingPerTankWeek: 0 }],
  armCycles: [3, 8],
  hoursPerArmCycle: 2,
  costPerArmCycle: 0,
  objective: 'hours',
  floor: 'soft',
  capOn: false,
  penaltyHours: 10,
  tieBreak: 0,
};

/** The answer worked out by hand. model.test.ts asserts the solver returns exactly this. */
export const manualHand = {
  lp: { n: [3, 6.5], stock: [20, 14, 10, 13], shortage: [0, 3, 0], hours: 19, penalty: 30, objective: 49, capacityDual: [-20, 0], floorDual: [0, 10, 1] },
  integer: { n: [3, 7], stock: [20, 14, 10, 14], shortage: [0, 3, 0], hours: 20, penalty: 30, objective: 50 },
} as const;
