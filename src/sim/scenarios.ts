/**
 * Week-level scenarios for the redesign comparison. A week is a list of
 * running days; each day gives the moulds on the four arms. Every scenario
 * uses the same machine, the same oven rule and the same shift: only the
 * mould-to-arm allocation and the product mix change, which is the one kind
 * of change NTG said it would allow (inventory row 66).
 */
import { P, SKUS, type PerSku } from '../data/params';
import { defaultConfig } from './config';
import { runSimulation } from './engine';
import type { ArmSetup, MouldKind, SimConfig, SimResult } from './types';

export interface WeekScenario {
  id: string;
  name: string;
  /** One sentence: what changes compared with NTG's plan. */
  change: string;
  /** Arms for each running day. */
  days: ArmSetup[][];
  /** What is assumed, in plain words. */
  notes: string[];
}

const O: MouldKind[] = ['OTHER'];
const C4: MouldKind[] = ['CTT4'];
const C2: MouldKind[] = ['CTT2', 'CTT2'];
const H2: MouldKind[] = ['HTT2', 'HTT2'];
const MIX: MouldKind[] = ['CTT2', 'HTT2'];
const day = (...arms: MouldKind[][]): ArmSetup[] => arms.map((moulds) => ({ moulds }));

/**
 * NTG's plan for 9 to 13 Nov made 8 CTT4, 4 CTT2 and 36 HTT2 on four running
 * days (inventory rows 56, 86, 90). The plan gives quantities; which arm
 * carried which mould on which day is assumed here so the quantities come out.
 */
export const SCENARIOS: WeekScenario[] = [
  {
    id: 'ntg',
    name: 'NTG plan, 9 to 13 Nov',
    change: 'Baseline: the week as NTG planned it, a long HTT2 campaign and little CTT2.',
    // Inventory row 40: studied tanks on ARM2 for 4 days, ARM3 for 2 days, ARM4 for 2 days = 8 arm-days.
    days: [day(O, H2, C4, ['CTT2']), day(O, H2, C4, ['HTT2']), day(O, H2, O, O), day(O, H2, O, O)],
    notes: [
      'Quantities are NTG\'s (8 / 4 / 36) and the arm-days per arm follow NTG\'s sheet (arm 2 four days, arms 3 and 4 two days each).',
      'Which mould sat on which arm on which day is assumed so that the quantities come out.',
    ],
  },
  {
    id: 'level',
    name: 'Level mix, same arm-days',
    change: 'Same eight tank arm-days, shared out by average weekly sales instead of one long campaign.',
    days: [day(O, C4, C2, H2), day(O, C4, C2, H2), day(O, O, C2, H2), day(O, O, O, O)],
    notes: ['Arm-days per product follow mean weekly sales (inventory row 102): CTT4 2, CTT2 3, HTT2 3.'],
  },
  {
    id: 'lean',
    name: 'Demand-sized, one arm-day fewer',
    change: 'Makes only what an average week sells; gives one arm-day back to other products.',
    days: [day(O, C4, C2, H2), day(O, O, C2, H2), day(O, O, C2, H2), day(O, O, O, O)],
    notes: ['CTT4 runs one day (4 tanks) because an average week sells about 6 and stock is near its cap.'],
  },
  {
    id: 'packed',
    name: 'Tanks on all four arms, two days',
    change: 'Packs the same tanks into two days with mixed moulds on one arm; two days stay free for other products.',
    days: [day(C4, C2, H2, MIX), day(C4, C2, H2, MIX), day(O, O, O, O), day(O, O, O, O)],
    notes: ['A CTT2 and an HTT2 mould share one arm. Inventory row 31 says arms can carry moulds of different products.'],
  },
];

export interface WeekResult {
  scenario: WeekScenario;
  runs: SimResult[];
  tanks: PerSku<number>;
  /** Arm-days that carried at least one studied tank. */
  tankArmDays: number;
  otherArmDays: number;
  ovenVisits: number;
  meanOvenUtilisation: number;
  meanWaitOvenMin: number;
  /** Longest minutes after the 8.5 h mark that a tank came out, over the week. */
  maxRunOutMin: number;
  /** Stock at the end of the week: opening + made - average sales. */
  closingStock: PerSku<number>;
  /** Weeks of average sales the closing stock covers. */
  coverWeeks: PerSku<number>;
  /** 'below' the minimum, 'above' the cap, or 'in' the band. */
  band: PerSku<'below' | 'in' | 'above'>;
  /** Spread between the best and worst covered product, in weeks. Smaller is more even. */
  coverSpread: number;
}

/** Opening stock for the comparison: NTG's count on 6 Nov, the Friday before the planned week (row 79). */
export const OPENING_STOCK = P.closingStock6Nov;

export function evaluateWeek(scenario: WeekScenario, patch: Partial<SimConfig> = {}): WeekResult {
  const base = { ...defaultConfig(), ...patch };
  const runs = scenario.days.map((arms, i) => runSimulation({ ...base, arms }, 1 + i));
  const tanks = { CTT4: 0, CTT2: 0, HTT2: 0 };
  let tankArmDays = 0;
  let otherArmDays = 0;
  for (const r of runs) {
    for (const k of SKUS) tanks[k] += r.kpis.tanksTotal[k];
    for (const a of r.config.arms) {
      if (a.moulds.some((m) => m !== 'OTHER')) tankArmDays += 1;
      else if (a.moulds.length > 0) otherArmDays += 1;
    }
  }
  const sales = P.weeklySalesMean.value;
  const closingStock = { CTT4: 0, CTT2: 0, HTT2: 0 };
  const coverWeeks = { CTT4: 0, CTT2: 0, HTT2: 0 };
  const band = { CTT4: 'in', CTT2: 'in', HTT2: 'in' } as WeekResult['band'];
  for (const k of SKUS) {
    closingStock[k] = OPENING_STOCK.value[k] + tanks[k] - sales[k];
    coverWeeks[k] = closingStock[k] / sales[k];
    band[k] = closingStock[k] < P.minStock.value[k] ? 'below' : closingStock[k] > P.warehouseCap.value[k] ? 'above' : 'in';
  }
  const covers = SKUS.map((k) => coverWeeks[k]);
  const mean = (f: (r: SimResult) => number) => runs.reduce((s, r) => s + f(r), 0) / runs.length;
  return {
    scenario,
    runs,
    tanks,
    tankArmDays,
    otherArmDays,
    ovenVisits: runs.reduce((s, r) => s + r.kpis.ovenVisits, 0),
    meanOvenUtilisation: mean((r) => r.kpis.ovenUtilisation),
    meanWaitOvenMin: mean((r) => r.kpis.meanWaitOvenMin),
    maxRunOutMin: Math.max(...runs.map((r) => r.kpis.runOutMin)),
    closingStock,
    coverWeeks,
    band,
    coverSpread: Math.max(...covers) - Math.min(...covers),
  };
}

/**
 * The recommendation rule, stated so it can be checked: among scenarios that
 * leave every product inside NTG's own stock band and use no more tank
 * arm-days than NTG's plan, take the one with the most even cover.
 */
export function recommend(results: WeekResult[]): { id: string; reason: string } {
  const base = results.find((r) => r.scenario.id === 'ntg') ?? results[0]!;
  const ok = results.filter((r) => SKUS.every((k) => r.band[k] === 'in') && r.tankArmDays <= base.tankArmDays);
  const pool = ok.length > 0 ? ok : results;
  const best = [...pool].sort((a, b) => a.coverSpread - b.coverSpread || a.tankArmDays - b.tankArmDays)[0]!;
  return {
    id: best.scenario.id,
    reason:
      `Every product ends the week inside NTG's stock band, and cover is the most even ` +
      `(spread ${best.coverSpread.toFixed(1)} weeks against ${base.coverSpread.toFixed(1)} for NTG's plan), ` +
      `using ${best.tankArmDays} tank arm-days against ${base.tankArmDays}.`,
  };
}
