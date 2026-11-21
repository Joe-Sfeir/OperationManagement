/**
 * Validation figures for the Report page.
 *
 * Pure TypeScript. Every number here is computed from the simulator
 * (src/sim), the inventory (`P`, `assumed`, `inventoryRows`) or the ERP
 * history. Nothing is typed in: where a row of the inventory holds a range or
 * a count inside a sentence, it is parsed from that row and the parse is
 * covered by validation.test.ts.
 *
 * The twin is CALIBRATED against NTG's reported figures (cycle, shift output).
 * It is not validated against a timed shift, because no timed shift log was
 * supplied. The page says so.
 */
import { P, SKUS, assumed, inventoryRows, numbers, type InventoryRow, type PerSku, type Sku, type Tag } from '../../data/params';
import { dailyOutputHistogram, dailyProduction, week } from '../../data/history';
import { defaultConfig, typicalArms } from '../../sim/config';
import { runSimulation } from '../../sim/engine';
import { SCENARIOS } from '../../sim/scenarios';
import type { ArmSetup, MouldKind, SimConfig, SimResult } from '../../sim/types';

// ---------------------------------------------------------------- small helpers

/** Fixed decimals, no thousands separator needed at this size. */
export function f(x: number, digits = 0): string {
  return x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
/** A difference with its sign shown. */
export function signed(x: number, digits = 0): string {
  const r = Number(x.toFixed(digits));
  return `${r > 0 ? '+' : r < 0 ? '-' : ''}${f(Math.abs(r), digits)}`;
}
export const triple = (v: PerSku<number>, digits = 0) => SKUS.map((k) => f(v[k], digits)).join(' / ');
export const sumSku = (v: PerSku<number>) => SKUS.reduce((s, k) => s + v[k], 0);

export function invRow(n: number): InventoryRow {
  const r = inventoryRows.find((x) => x.row === n);
  if (!r) throw new Error(`Inventory row ${n} not found`);
  return r;
}

/** "Range 8-30" or "Range 1 to 2" inside a note. */
export function rangeIn(text: string): [number, number] {
  const m = text.match(/([\d.]+)\s*(?:–|-|to)\s*([\d.]+)/);
  if (!m) throw new Error(`No range in "${text}"`);
  return [Number(m[1]), Number(m[2])];
}

// ------------------------------------------------------------------ simulator

export interface RunSummary {
  cycleMin: number;
  tanksTotal: PerSku<number>;
  tanksInShift: PerSku<number>;
  total: number;
  inShift: number;
  otherItems: number;
  ovenVisits: number;
  /** Oven visits divided by the arms that carry a mould. */
  cyclesPerArm: number;
  ovenUtilisation: number;
  waitOvenMin: number;
  waitDemouldMin: number;
  blockedMin: number;
  runOutMin: number;
  bottleneck: string;
  /** Arms whose last tanks come out after the shift mark. */
  lateArms: number;
  waitByCause: SimResult['kpis']['waitByCause'];
}

export function summarise(r: SimResult): RunSummary {
  const k = r.kpis;
  const working = r.config.arms.filter((a) => a.moulds.length > 0).length;
  const late = new Set(r.tanks.filter((t) => t.out > r.config.shiftMin + 1e-9).map((t) => t.arm));
  return {
    cycleMin: k.cycleMin,
    tanksTotal: k.tanksTotal,
    tanksInShift: k.tanksInShift,
    total: sumSku(k.tanksTotal),
    inShift: sumSku(k.tanksInShift),
    otherItems: k.otherItems,
    ovenVisits: k.ovenVisits,
    cyclesPerArm: working > 0 ? k.ovenVisits / working : 0,
    ovenUtilisation: k.ovenUtilisation,
    waitOvenMin: k.meanWaitOvenMin,
    waitDemouldMin: k.meanWaitDemouldMin,
    blockedMin: k.meanBlockedMin,
    runOutMin: k.runOutMin,
    bottleneck: k.bottleneck,
    lateArms: late.size,
    waitByCause: k.waitByCause,
  };
}

export function simulate(patch: Partial<SimConfig> = {}, seed = 1): RunSummary {
  return summarise(runSimulation({ ...defaultConfig(), ...patch }, seed));
}
export const withTimes = (t: Partial<SimConfig['times']>): Partial<SimConfig> => ({ times: { ...defaultConfig().times, ...t } });

// ------------------------------------------------------------ the summary table

export type Verdict = 'match' | 'gap' | 'input' | 'no-data';
export const VERDICT_LABEL: Record<Verdict, string> = {
  match: 'Matches',
  gap: 'Gap',
  input: 'Input, not a result',
  'no-data': 'Nothing to check against',
};

export interface ValidationRow {
  id: string;
  metric: string;
  twin: string;
  twinTitle: string;
  ntg: string;
  /** null when NTG gave no figure. */
  ntgTag: Tag | null;
  ntgRows: number[];
  ntgTitle: string;
  difference: string;
  verdict: Verdict;
  /** Plain words: what the comparison shows and why. */
  words: string;
}

const rowTitle = (...rows: number[]) =>
  rows.map((n) => `Inventory row ${n}: ${invRow(n).parameter} = ${invRow(n).value} ${invRow(n).unit}. Source: ${invRow(n).source}. Confidence: ${invRow(n).confidence}`).join(' | ');

export interface Sweep<T> {
  value: T;
  run: RunSummary;
}

export interface Validation {
  base: RunSummary;
  rows: ValidationRow[];
  identity: { parts: { label: string; min: number; tag: Tag; row: number }[]; indexMoves: number; indexMin: number; sumMin: number; cycleMin: number; unexplainedMin: number };
  demould: { range: [number, number]; sweep: Sweep<number>[]; holdsCycleUpTo: number; waitAtLimit: number; firstBroken: Sweep<number> | null };
  index: { range: [number, number]; sweep: Sweep<number>[] };
  crewWaitZero: RunSummary;
  variation: { jitter: number; seeds: number; cycleMin: [number, number]; total: [number, number]; waitOvenMin: [number, number]; runOutMin: [number, number] };
  hardStop: RunSummary;
  erp: PerSku<ErpCheck>;
  weekNov2: WeekCheck;
  weekNov9: { monday: string; plan: PerSku<number>; erp: PerSku<number>; diff: PerSku<number>; productionDays: PerSku<number> };
  rejected: Rejected[];
  conflicts: Conflict[];
}

// ------------------------------------------------------------------- ERP checks

export interface ErpCheck {
  sku: Sku;
  hist: { qty: number; days: number; kind: 'four' | 'three' | 'multiple' | 'none' }[];
  days: number;
  /** Twin, typical shift: four arms working. */
  fourArm: number;
  /** Twin, one arm without a mould: every quantity this product reaches, over all placements. */
  threeArm: number[];
  /** Cycles per mould the twin reaches (four arms, three arms). */
  cycles: number[];
  daysFour: number;
  daysThree: number;
  daysMultiple: number;
  daysNone: number;
  unexplained: number[];
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

/** Daily output when one arm carries no mould: the three tank arms of the typical shift in every placement. */
export function threeArmQuantities(): PerSku<number[]> {
  const tankArms = typicalArms().filter((a) => !a.moulds.includes('OTHER'));
  const empty: ArmSetup = { moulds: [] };
  const seen: PerSku<Set<number>> = { CTT4: new Set(), CTT2: new Set(), HTT2: new Set() };
  for (const order of permutations<ArmSetup>([empty, ...tankArms])) {
    const r = simulate({ arms: order });
    for (const k of SKUS) seen[k].add(r.tanksTotal[k]);
  }
  const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);
  return { CTT4: sorted(seen.CTT4), CTT2: sorted(seen.CTT2), HTT2: sorted(seen.HTT2) };
}

function erpChecks(base: RunSummary): PerSku<ErpCheck> {
  const three = threeArmQuantities();
  const mouldsOn = (k: Sku) => typicalArms().reduce((s, a) => s + a.moulds.filter((m) => m === k).length, 0);
  const one = (k: Sku): ErpCheck => {
    const fourArm = base.tanksTotal[k];
    const m = mouldsOn(k);
    const cycles = [...new Set([fourArm / m, ...three[k].map((q) => q / m)])].filter((c) => Number.isInteger(c)).sort((a, b) => a - b);
    // Any whole number of moulds of this product on the four arms, times a cycle count the twin reaches.
    const maxMoulds = P.arms.value * P.mouldsPerArm.value[k];
    const multiples = new Set<number>();
    for (let n = 1; n <= maxMoulds; n++) for (const c of cycles) multiples.add(n * c);
    const hist = dailyOutputHistogram(k).map((h) => ({
      ...h,
      kind: h.qty === fourArm ? ('four' as const) : three[k].includes(h.qty) ? ('three' as const) : multiples.has(h.qty) ? ('multiple' as const) : ('none' as const),
    }));
    const count = (kind: ErpCheck['hist'][number]['kind']) => hist.filter((h) => h.kind === kind).reduce((s, h) => s + h.days, 0);
    return {
      sku: k,
      hist,
      days: hist.reduce((s, h) => s + h.days, 0),
      fourArm,
      threeArm: three[k].filter((q) => q !== fourArm),
      cycles,
      daysFour: count('four'),
      daysThree: count('three'),
      daysMultiple: count('multiple'),
      daysNone: count('none'),
      unexplained: hist.filter((h) => h.kind === 'none').map((h) => h.qty),
    };
  };
  return { CTT4: one('CTT4'), CTT2: one('CTT2'), HTT2: one('HTT2') };
}

export interface WeekCheck {
  monday: string;
  setup: ArmSetup[];
  moulds: PerSku<number>;
  days: { date: string; erp: PerSku<number> }[];
  productionDays: PerSku<number>;
  erp: PerSku<number>;
  /** Mould-days x the planning rule of row 57. */
  rule: PerSku<number>;
  /** Twin: tanks per day for this set-up x ERP production days. */
  twin: PerSku<number>;
  twinPerDay: PerSku<number>;
  diff: PerSku<number>;
}

const MONDAY_NOV2 = '2026-11-02';
const MONDAY_NOV9 = '2026-11-09';
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/**
 * Week of 2 to 6 Nov. The ERP does not record which moulds were on the arms,
 * so the set-up is read off that week's daily quantities (see below).
 */
function weekNov2(): WeekCheck {
  // Read off the ERP's daily quantities that week (4 CTT4, 4 CTT2 and 12 HTT2 a day): one CTT4 mould,
  // one CTT2 mould and three HTT2 moulds, with the fourth arm on other products. Which arm carried which is assumed.
  const setup: ArmSetup[] = [{ moulds: ['OTHER'] }, { moulds: ['HTT2', 'HTT2'] }, { moulds: ['CTT4'] }, { moulds: ['CTT2', 'HTT2'] }];
  const count = (k: MouldKind) => setup.reduce((s, a) => s + a.moulds.filter((m) => m === k).length, 0);
  const moulds = { CTT4: count('CTT4'), CTT2: count('CTT2'), HTT2: count('HTT2') };
  const perDay = simulate({ arms: setup }).tanksTotal;
  const per = <T,>(fn: (k: Sku) => T): PerSku<T> => ({ CTT4: fn('CTT4'), CTT2: fn('CTT2'), HTT2: fn('HTT2') });
  const productionDays = per((k) => week(k, MONDAY_NOV2)?.productionDays ?? 0);
  const erp = per((k) => week(k, MONDAY_NOV2)?.produced ?? 0);
  const twin = per((k) => perDay[k] * productionDays[k]);
  const end = addDays(MONDAY_NOV2, 6);
  return {
    monday: MONDAY_NOV2,
    setup,
    moulds,
    days: dailyProduction.filter((d) => d.date >= MONDAY_NOV2 && d.date <= end).map((d) => ({ date: d.date, erp: { CTT4: d.CTT4, CTT2: d.CTT2, HTT2: d.HTT2 } })),
    productionDays,
    erp,
    rule: per((k) => moulds[k] * productionDays[k] * P.cyclesPerMouldPerDay.value),
    twin,
    twinPerDay: perDay,
    diff: per((k) => twin[k] - erp[k]),
  };
}

// ---------------------------------------------------------- rejected readings

export interface Rejected {
  id: string;
  reading: string;
  setting: string;
  run: RunSummary;
  why: string;
}

function rejectedReadings(base: RunSummary): Rejected[] {
  const target = `${triple(P.tanksPerShift.value)} tanks from a shift (row ${P.tanksPerShift.row}) and ${P.cyclesPerMouldPerDay.value} cycles per mould a day (row ${P.cyclesPerMouldPerDay.row})`;
  const mk = (id: string, reading: string, setting: string, patch: Partial<SimConfig>, extra: string): Rejected => {
    const run = simulate(patch);
    return {
      id,
      reading,
      setting,
      run,
      why:
        `Gives a ${f(run.cycleMin, 1)} min arm cycle, ${f(run.cyclesPerArm, 2)} oven visits per arm and ${triple(run.tanksTotal)} tanks ` +
        `(${run.total} against ${base.total}). NTG reports ${target}. ${extra}`,
    };
  };
  const T = defaultConfig().times;
  return [
    mk(
      'pausesOnTop',
      `The ${f(T.layerPause, 1)} min layer pauses are added on top of the ${f(T.ovenVisit, 1)} min oven visit`,
      'pausesInsideVisit: false',
      { pausesInsideVisit: false },
      `The oven would hold each tank arm ${f(T.ovenVisit + (defaultConfig().layers - 1) * T.layerPause, 1)} min, and four arms no longer fit four turns each into the shift.`,
    ),
    mk(
      'bothInChamber',
      'Both cooling phases happen in the cooling chamber, with a waiting position before the oven',
      "cooling: 'bothInChamber'",
      { cooling: 'bothInChamber' },
      `One position would then hold every arm for ${f(T.air + T.water)} min, longer than the oven visit, so cooling, not the oven, would set the pace.`,
    ),
    mk(
      'returnToLoad',
      'The arm swings back to the loading side for each new layer',
      "layerMode: 'returnToLoad'",
      { layerMode: 'returnToLoad' },
      `Each tank arm would hold the oven and the position before it for ${(defaultConfig().layers - 1) * 2} extra index moves per visit.`,
    ),
    mk(
      'perLayer',
      `The ${f(T.ovenVisit, 1)} min oven time is per layer, not per visit (rows ${P.ovenVisitMin.row} and 44)`,
      `times.ovenVisit: ${f(T.ovenVisit, 1)} x ${defaultConfig().layers} layers, pauses on top`,
      { ...withTimes({ ovenVisit: T.ovenVisit * defaultConfig().layers }), pausesInsideVisit: false },
      'This is the reading the inventory calls H2.',
    ),
  ];
}

// ------------------------------------------------------------------- conflicts

export interface Conflict {
  id: string;
  title: string;
  rows: number[];
  /** The two sides, with the numbers. */
  statement: string;
  /** What the twin does about it. */
  handling: string;
  quotes: { row: number; parameter: string; text: string }[];
}

function conflicts(v: Pick<Validation, 'base' | 'weekNov2' | 'weekNov9' | 'rejected'>): Conflict[] {
  const quote = (row: number, field: 'notes' | 'value' | 'source' = 'notes') => ({ row, parameter: invRow(row).parameter, text: String(invRow(row)[field]) });
  const weekHours = P.daysPerWeek.value * P.shiftHours.value;
  const leftHours = weekHours - P.otherProductsHWeek.value;
  const armDays = String(invRow(53).value).match(/(\d+)\s+of\s+(\d+)/);
  if (!armDays) throw new Error('Row 53: arm-days not found');
  const [tankArmDays, allArmDays] = [Number(armDays[1]), Number(armDays[2])];
  const erpWeek = sumSku(v.weekNov2.erp);
  const perLayer = v.rejected.find((r) => r.id === 'perLayer')!.run;

  const h = week('HTT2', MONDAY_NOV2)!;
  const list = numbers(invRow(80).value);
  if (list.length !== 6) throw new Error('Row 80: expected available and pending for three products');
  const available: PerSku<number> = { CTT4: list[0]!, CTT2: list[1]!, HTT2: list[2]! };
  const pending: PerSku<number> = { CTT4: list[3]!, CTT2: list[4]!, HTT2: list[5]! };
  const form1 = P.closingStock6Nov.value;
  const both: PerSku<number> = { CTT4: available.CTT4 + pending.CTT4, CTT2: available.CTT2 + pending.CTT2, HTT2: available.HTT2 + pending.HTT2 };
  const gap = (a: PerSku<number>, b: PerSku<number>) => SKUS.map((k) => signed(a[k] - b[k])).join(' / ');

  const visitKg = P.layerKg.CTT4.value.reduce((s, x) => s + x, 0);
  const planKg = P.planKgPerTank.value.CTT4;
  const basePlan = SCENARIOS.find((s) => s.id === 'ntg')!;
  const placed = basePlan.days.reduce((s, d) => s + d.filter((a) => a.moulds.some((m) => m !== 'OTHER')).length, 0);

  const dieselCycles = numbers(invRow(61).source)[2];
  if (dieselCycles === undefined) throw new Error('Row 61: cycles per shift not found');
  const litres = P.dieselLPerShift.value;

  return [
    {
      id: 'hours',
      title: 'Weekly hours against weekly output',
      rows: [54, 51, 100],
      statement:
        `Machine 3700 runs ${P.daysPerWeek.value} days x ${f(P.shiftHours.value, 1)} h = ${f(weekHours, 1)} h a week (row 54). ` +
        `Take away the ${P.otherProductsHWeek.value} h NTG gives to other products (row 51) and ${f(leftHours, 1)} h are left: one shift, ` +
        `${sumSku(P.tanksPerShift.value)} tanks at NTG's own shift figure (row 49). The ERP shows ${erpWeek} tanks made in the week of 2 to 6 Nov (row 100).`,
      handling:
        `The twin treats arms, not hours, as what is shared: other products ride on other arms in the same shift (row 40). ` +
        `On that reading ${v.weekNov2.productionDays.HTT2} production days give ${sumSku(v.weekNov2.twin)} tanks against the ERP's ${erpWeek}. ` +
        `If the oven time were per layer, a shift would give ${perLayer.total} tanks and the week could not be made at all.`,
      quotes: [quote(54), quote(40)],
    },
    {
      id: 'perLayer',
      title: 'Oven time: per tank or per layer',
      rows: [43, 44],
      statement:
        `The visit notes give ${f(P.ovenVisitMin.value, 1)} min of oven time (row 43) without saying whether it covers one layer or all ${defaultConfig().layers}. ` +
        `Per layer, the twin gives a ${f(perLayer.cycleMin, 1)} min arm cycle and ${perLayer.total} tanks a shift; per visit, ${f(v.base.cycleMin, 1)} min and ${v.base.total} tanks.`,
      handling: `The twin uses one ${f(P.ovenVisitMin.value, 1)} min visit for all layers, because only that reading reproduces NTG's output. It is a deduction, not something NTG said. A timed shift would settle it.`,
      quotes: [quote(43), quote(44, 'source')],
    },
    {
      id: 'returns',
      title: 'HTT2 stock is 10 tanks higher than production less sales',
      rows: [81, 78, 79],
      statement:
        `Week of 2 to 6 Nov, HTT2: opening ${h.opening} + made ${h.produced} - sold ${h.sold} = ${h.opening + h.produced - h.sold}, but the closing count is ${h.closing}. ` +
        `The ERP shows ${h.returns} tanks returned that week, which closes the gap exactly (${h.opening + h.produced - h.sold + h.returns}).`,
      handling: `Resolved by NTG. The twin's stock check does not model returns: closing stock = opening + made - average sales. A week with returns ends higher than the twin shows.`,
      quotes: [quote(81, 'value'), quote(81)],
    },
    {
      id: 'stockList',
      title: 'Stock list of 6 Nov against Form 1',
      rows: [80, 79],
      statement:
        `Form 1 gives closing stock on 6 Nov as ${triple(form1)} (row 79). The signed stock availability list of the same day gives ${triple(available)} available and ${triple(pending)} pending. ` +
        `Available alone differs from Form 1 by ${gap(available, form1)}; available plus pending by ${gap(both, form1)}. Neither adds up.`,
      handling: `Not reconciled. The twin starts the stock check from Form 1 (${triple(form1)}), which matches the ERP stock cards. If the list is right, the CTT4 opening stock is ${form1.CTT4 - available.CTT4} tanks lower than the twin assumes.`,
      quotes: [quote(80, 'value'), quote(80)],
    },
    {
      id: 'ctt4kg',
      title: `CTT4 powder: ${planKg} kg or ${visitKg} kg per tank`,
      rows: [27, 30],
      statement:
        `The visit notes give CTT4 layers of ${P.layerKg.CTT4.value.join(' + ')} = ${visitKg} kg (row 27). NTG's weekly plan implies ${planKg} kg a tank (row 30). ` +
        `The two other products agree exactly (${P.planKgPerTank.value.CTT2} and ${P.planKgPerTank.value.HTT2} kg).`,
      handling:
        `The twin doses the visit's layer weights (${visitKg} kg), because the plan gives no split by layer. ` +
        `If NTG's ${planKg} kg is right, the twin under-counts CTT4 powder by ${planKg - visitKg} kg a tank, ${f(((planKg - visitKg) / planKg) * 100, 1)} %. Tank counts are not affected.`,
      quotes: [quote(27), quote(30)],
    },
    {
      id: 'otherHours',
      title: 'Share of the machine given to other products',
      rows: [51, 52, 53],
      statement:
        `Form 1 says other products take ${P.otherProductsHWeek.value} h of the ${f(weekHours, 1)} h week, which is ${f((P.otherProductsHWeek.value / weekHours) * 100)} % (row 51). ` +
        `The weekly plan for 9 to 13 Nov puts the studied tanks on ${tankArmDays} of ${allArmDays} arm-days, leaving ${f(((allArmDays - tankArmDays) / allArmDays) * 100)} % to other products (row 53). NTG later said the figure varies (row 52).`,
      handling: `The twin does not use the ${P.otherProductsHWeek.value} h figure. Each scenario states its own arm-days, and the comparison table shows them.`,
      quotes: [quote(52, 'value'), quote(53, 'value'), quote(40)],
    },
    {
      id: 'placement',
      title: 'Arm-days in the baseline week',
      rows: [40, 86],
      statement:
        `NTG's plan for 9 to 13 Nov lists the studied tanks on ${tankArmDays} arm-days (row 40). The plan's quantities (${triple(P.pipeline.value)}, row 86) need only ${placed} arm-days at ` +
        `${P.cyclesPerMouldPerDay.value} cycles per mould a day, and that is how the twin's baseline places them.`,
      handling: `The twin's baseline uses ${placed} tank arm-days, ${tankArmDays - placed} fewer than NTG's sheet. The eighth arm-day probably carried a studied mould beside another product, or ran short; the sheet does not say. Scenarios are compared with the ${placed} the twin can account for.`,
      quotes: [quote(40, 'value'), quote(31)],
    },
    {
      id: 'planVsErp',
      title: 'Plan for 9 to 13 Nov against what the ERP recorded',
      rows: [90, 101],
      statement:
        `NTG planned ${triple(v.weekNov9.plan)} tanks for 9 to 13 Nov (row 90). The ERP stock cards record ${triple(v.weekNov9.erp)} made that week: ${gap(v.weekNov9.erp, v.weekNov9.plan)} against the plan.`,
      handling: `The Redesign baseline is the plan, not the week as it ran, because the redesign question is about how the week is planned. The ERP figure is shown beside it.`,
      quotes: [quote(90), quote(101, 'value')],
    },
    {
      id: 'dieselCycles',
      title: 'Cycles per shift in the diesel cost',
      rows: [61, 57],
      statement:
        `The diesel cost per arm cycle (row 61) divides ${litres} L a shift by ${P.arms.value} arms x ${dieselCycles} cycles, which is the shift length over the cycle (${f(defaultConfig().shiftMin / P.armCycleMin.value, 2)}). ` +
        `NTG's planning rule (row 57) and the twin both give ${f(v.base.cyclesPerArm)} whole cycles per arm.`,
      handling: `With ${f(v.base.cyclesPerArm)} cycles the diesel per arm cycle is ${f(litres / v.base.ovenVisits, 1)} L, not ${f(litres / (P.arms.value * dieselCycles), 1)} L: ${f((dieselCycles / v.base.cyclesPerArm - 1) * 100)} % more. The twin counts tanks and does not use this cost; the Plan page does.`,
      quotes: [quote(61, 'source')],
    },
  ];
}

// ------------------------------------------------------------------- the whole

let cached: Validation | null = null;

export function validation(): Validation {
  if (cached) return cached;
  const cfg = defaultConfig();
  const T = cfg.times;
  const base = simulate();

  // Arm-cycle identity: the task times NTG and the team give, added up.
  const parts = [
    { label: 'Loading', min: T.load, tag: P.loadMin.tag, row: P.loadMin.row },
    { label: 'Wait before the oven (NTG estimate)', min: P.waitBeforeOvenMin.value, tag: P.waitBeforeOvenMin.tag, row: P.waitBeforeOvenMin.row },
    { label: 'Oven visit', min: T.ovenVisit, tag: P.ovenVisitMin.tag, row: P.ovenVisitMin.row },
    { label: 'Air cooling', min: T.air, tag: P.airCoolMin.tag, row: P.airCoolMin.row },
    { label: 'Fan and water cooling', min: T.water, tag: P.waterCoolMin.tag, row: P.waterCoolMin.row },
    { label: 'Wait for demould', min: T.demouldWait, tag: P.demouldWaitMin.tag, row: P.demouldWaitMin.row },
    { label: 'Demould and mould prep (placeholder)', min: T.demould, tag: P.demouldMin.tag, row: P.demouldMin.row },
  ];
  const indexMoves = P.positions.value;
  const sumMin = parts.reduce((s, p) => s + p.min, 0) + indexMoves * T.index;
  const identity = { parts, indexMoves, indexMin: T.index, sumMin, cycleMin: P.armCycleMin.value, unexplainedMin: P.armCycleMin.value - sumMin };

  // Demould placeholder: sweep its stated range in steps of (placeholder - low end).
  const dRange = rangeIn(invRow(P.demouldMin.row).notes);
  const step = T.demould - dRange[0];
  const dValues: number[] = [];
  for (let d = dRange[0]; d < dRange[1]; d += step) dValues.push(d);
  dValues.push(dRange[1]);
  const dSweep = dValues.map((d) => ({ value: d, run: simulate(withTimes({ demould: d })) }));
  // "Holds": the cycle is unchanged, the output is unchanged and no arm is held up after the oven.
  const keeps = (r: RunSummary) => Math.abs(r.cycleMin - base.cycleMin) < 0.05 && r.total === base.total && r.blockedMin < 1e-6;
  let holdsCycleUpTo = dRange[0];
  let waitAtLimit = simulate(withTimes({ demould: dRange[0] })).waitOvenMin;
  let firstBroken: Sweep<number> | null = null;
  for (let d = dRange[0]; d <= dRange[1]; d += 1) {
    const run = simulate(withTimes({ demould: d }));
    if (keeps(run)) {
      holdsCycleUpTo = d;
      waitAtLimit = run.waitOvenMin;
    } else {
      firstBroken = { value: d, run };
      break;
    }
  }

  const iRange = rangeIn(assumed.indexMin.note);
  const iSweep = [...new Set([iRange[0], T.index, iRange[1]])].map((x) => ({ value: x, run: simulate(withTimes({ index: x })) }));

  const crewWaitZero = simulate(withTimes({ demouldWait: 0 }));
  const hardStop = simulate({ endOfShift: 'hardStop' });

  // Optional variation: +/-10 % on task times, 20 seeds.
  const jitter = 0.1;
  const seeds = 20;
  const jr = Array.from({ length: seeds }, (_, i) => simulate({ jitter }, i + 1));
  const span = (fn: (r: RunSummary) => number): [number, number] => [Math.min(...jr.map(fn)), Math.max(...jr.map(fn))];
  const variation = { jitter, seeds, cycleMin: span((r) => r.cycleMin), total: span((r) => r.total), waitOvenMin: span((r) => r.waitOvenMin), runOutMin: span((r) => r.runOutMin) };

  const erp = erpChecks(base);
  const wk2 = weekNov2();
  const per = <X,>(fn: (k: Sku) => X): PerSku<X> => ({ CTT4: fn('CTT4'), CTT2: fn('CTT2'), HTT2: fn('HTT2') });
  const wk9erp = per((k) => week(k, MONDAY_NOV9)?.produced ?? 0);
  const weekNov9 = {
    monday: MONDAY_NOV9,
    plan: P.pipeline.value,
    erp: wk9erp,
    diff: per((k) => wk9erp[k] - P.pipeline.value[k]),
    productionDays: per((k) => week(k, MONDAY_NOV9)?.productionDays ?? 0),
  };
  const rejected = rejectedReadings(base);

  // ---- Summary rows
  const ntgShift = P.tanksPerShift.value;
  const ntgTotal = sumSku(ntgShift);
  const impliedVisits = P.arms.value * P.cyclesPerMouldPerDay.value;
  const waitGap = base.waitOvenMin - P.waitBeforeOvenMin.value;
  const mid = dSweep.find((s) => s.value > T.demould && keeps(s.run));
  const dLast = dSweep[dSweep.length - 1]!;
  const iLo = iSweep[0]!;
  const iHi = iSweep[iSweep.length - 1]!;
  const ovenWait = base.waitByCause.oven ?? 0;
  const allWait = Object.values(base.waitByCause).reduce((s, x) => s + (x ?? 0), 0);

  const rows: ValidationRow[] = [
    {
      id: 'cycle',
      metric: 'Arm cycle',
      twin: `${f(base.cycleMin, 1)} min`,
      twinTitle: 'Mean minutes between two oven entries of the same arm, from the simulator',
      ntg: `${P.armCycleMin.value} min`,
      ntgTag: P.armCycleMin.tag,
      ntgRows: [P.armCycleMin.row],
      ntgTitle: rowTitle(P.armCycleMin.row),
      difference: `${signed(base.cycleMin - P.armCycleMin.value, 1)} min`,
      verdict: 'match',
      words:
        `Same figure, but partly by construction. The oven takes one arm at a time, so the cycle is ${P.arms.value} arms x (${f(T.ovenVisit, 1)} min in the oven + ${f(T.index, 1)} min to change arms). ` +
        `The ${f(T.index, 1)} min was not timed: it was chosen inside a ${f(iRange[0])} to ${f(iRange[1])} min range. At ${f(iLo.value)} min the cycle is ${f(iLo.run.cycleMin, 1)}, at ${f(iHi.value)} min it is ${f(iHi.run.cycleMin, 1)}.`,
    },
    {
      id: 'tanksTotal',
      metric: 'Tanks from one shift of loading',
      twin: `${triple(base.tanksTotal)} (${base.total})`,
      twinTitle: 'Tanks lifted out of the mould, including the run-out after the 8.5 h mark. Order: CTT4 / CTT2 / HTT2',
      ntg: `${triple(ntgShift)} (${ntgTotal})`,
      ntgTag: P.tanksPerShift.tag,
      ntgRows: [P.tanksPerShift.row],
      ntgTitle: rowTitle(P.tanksPerShift.row, 50),
      difference: `${signed(base.total - ntgTotal)} tanks`,
      verdict: base.total === ntgTotal ? 'match' : 'gap',
      words: `Every arm is loaded ${f(base.cyclesPerArm)} times in the shift and every load becomes a tank. This is the figure the twin was calibrated to.`,
    },
    {
      id: 'tanksInShift',
      metric: `Tanks out by the ${f(P.shiftHours.value, 1)} h mark`,
      twin: `${triple(base.tanksInShift)} (${base.inShift})`,
      twinTitle: 'Tanks lifted out of the mould no later than the end of the shift',
      ntg: `${triple(ntgShift)} (${ntgTotal})`,
      ntgTag: P.tanksPerShift.tag,
      ntgRows: [P.tanksPerShift.row],
      ntgTitle: rowTitle(P.tanksPerShift.row),
      difference: `${signed(base.inShift - ntgTotal)} tanks`,
      verdict: base.inShift === ntgTotal ? 'match' : 'gap',
      words:
        `A real gap. In the twin the last ${base.lateArms} arms are still cooling at the mark, and the last tank is lifted out ${f(base.runOutMin, 1)} min after it. ` +
        `The twin starts the day with four empty moulds; NTG's figure does not say whether the crew stays to empty the machine or the first arm starts earlier. ` +
        `With a hard stop at the mark the twin makes ${triple(hardStop.tanksTotal)} (${hardStop.total}).`,
    },
    {
      id: 'cyclesPerMould',
      metric: 'Cycles per mould per day',
      twin: f(base.cyclesPerArm, 2),
      twinTitle: 'Oven visits divided by the arms that carry a mould',
      ntg: `${P.cyclesPerMouldPerDay.value}`,
      ntgTag: P.cyclesPerMouldPerDay.tag,
      ntgRows: [P.cyclesPerMouldPerDay.row],
      ntgTitle: rowTitle(P.cyclesPerMouldPerDay.row),
      difference: signed(base.cyclesPerArm - P.cyclesPerMouldPerDay.value, 2),
      verdict: base.cyclesPerArm === P.cyclesPerMouldPerDay.value ? 'match' : 'gap',
      words: `The shift is ${f(cfg.shiftMin)} min and the cycle ${f(base.cycleMin)} min: ${f(cfg.shiftMin / base.cycleMin, 2)} cycles, so ${Math.floor(cfg.shiftMin / base.cycleMin)} whole ones. NTG's weekly plan uses the same rule.`,
    },
    {
      id: 'ovenVisits',
      metric: 'Oven visits per day',
      twin: `${base.ovenVisits}`,
      twinTitle: 'Arm entries into the oven in one shift, counted by the simulator',
      ntg: `${impliedVisits} (implied)`,
      ntgTag: 'C',
      ntgRows: [P.arms.row, P.cyclesPerMouldPerDay.row],
      ntgTitle: `NTG gave no count of oven visits. Implied by ${P.arms.value} arms x ${P.cyclesPerMouldPerDay.value} cycles. ${rowTitle(P.arms.row, P.cyclesPerMouldPerDay.row)}`,
      difference: signed(base.ovenVisits - impliedVisits),
      verdict: base.ovenVisits === impliedVisits ? 'match' : 'gap',
      words: `NTG never counted oven visits. The figure on the right is ${P.arms.value} arms x ${P.cyclesPerMouldPerDay.value} cycles, so this row repeats the one above and adds no new evidence.`,
    },
    {
      id: 'ovenUse',
      metric: 'Oven in use',
      twin: `${f(base.ovenUtilisation * 100)} %`,
      twinTitle: 'Minutes the oven holds an arm, divided by the shift length',
      ntg: 'Not in the data',
      ntgTag: null,
      ntgRows: [],
      ntgTitle: 'NTG gave no oven log',
      difference: 'n/a',
      verdict: 'no-data',
      words: `Missing. No oven log or burner hours were supplied, so this figure is the twin's alone.`,
    },
    {
      id: 'waitOven',
      metric: 'Wait before the oven, mean per visit',
      twin: `${f(base.waitOvenMin, 1)} min`,
      twinTitle: 'Minutes arms stand loaded and waiting for the oven, divided by oven visits',
      ntg: `${P.waitBeforeOvenMin.value} min (estimate)`,
      ntgTag: P.waitBeforeOvenMin.tag,
      ntgRows: [P.waitBeforeOvenMin.row],
      ntgTitle: rowTitle(P.waitBeforeOvenMin.row),
      difference: `${signed(waitGap, 1)} min`,
      verdict: 'gap',
      words:
        `A real gap: the twin's wait is ${f(base.waitOvenMin / P.waitBeforeOvenMin.value, 1)} times NTG's estimate. Neither number was timed. ` +
        `The demould time is a placeholder of ${f(T.demould)} min (row ${P.demouldMin.row}, range ${f(dRange[0])} to ${f(dRange[1])}). The oven fixes the cycle, so a minute not spent at demould is a minute spent waiting before the oven` +
        (mid ? `: with a ${f(mid.value)} min demould the cycle is still ${f(mid.run.cycleMin)} min and the wait falls to ${f(mid.run.waitOvenMin, 1)} min. ` : '. ') +
        `The longest demould that holds no arm up after the oven is ${f(holdsCycleUpTo)} min; the wait is then ${f(waitAtLimit, 1)} min, still ${f(waitAtLimit - P.waitBeforeOvenMin.value, 1)} min above NTG's figure. ` +
        `Beyond that, arms are held in the cooling positions, and at ${f(dLast.value)} min the cycle is ${f(dLast.run.cycleMin, 1)} min. ` +
        `So no demould time in the range gives both the ${f(P.armCycleMin.value)} min cycle and an ${f(P.waitBeforeOvenMin.value)} min wait. The split between waiting and demould cannot be settled without a timed shift.`,
    },
    {
      id: 'waitDemould',
      metric: 'Wait for demould',
      twin: `${f(base.waitDemouldMin, 1)} min`,
      twinTitle: 'Minutes a cooled arm waits for the crew, per arm cycle',
      ntg: `${String(invRow(P.demouldWaitMin.row).value)} min`,
      ntgTag: P.demouldWaitMin.tag,
      ntgRows: [P.demouldWaitMin.row],
      ntgTitle: rowTitle(P.demouldWaitMin.row),
      difference: `${signed(base.waitDemouldMin - P.demouldWaitMin.value, 1)} min`,
      verdict: 'input',
      words: `Not a test. The twin is told to wait NTG's ${f(P.demouldWaitMin.value)} min at demould, so it plays the estimate back. The crew is not modelled as people who can be busy elsewhere.`,
    },
    {
      id: 'bottleneck',
      metric: 'Where arms queue',
      twin: `${base.bottleneck === 'oven' ? 'Oven' : base.bottleneck}: ${f(ovenWait)} of ${f(allWait)} waiting min`,
      twinTitle: 'Waiting minutes by what the arm was waiting for, summed over the shift. The rest is the crew wait, which is an input',
      ntg: 'Before the oven',
      ntgTag: invRow(66).tag as Tag,
      ntgRows: [42, P.waitBeforeOvenMin.row, 66],
      ntgTitle: rowTitle(42, P.waitBeforeOvenMin.row, 66),
      difference: 'Same place',
      verdict: 'match',
      words: `NTG says the oven takes one arm at a time, by turn, and that the wait before it can never be reduced. The twin finds the same queue without being told where to put it: the oven is in use ${f(base.ovenUtilisation * 100)} % of the shift.`,
    },
  ];

  const partial = { base, weekNov2: wk2, weekNov9, rejected };
  cached = {
    base,
    rows,
    identity,
    demould: { range: dRange, sweep: dSweep, holdsCycleUpTo, waitAtLimit, firstBroken },
    index: { range: iRange, sweep: iSweep },
    crewWaitZero,
    variation,
    hardStop,
    erp,
    weekNov2: wk2,
    weekNov9,
    rejected,
    conflicts: conflicts(partial),
  };
  return cached;
}

/** No timed shift log exists in the data folder or the inventory. */
export const FIELD_TIMING = {
  status: 'PENDING' as const,
  text:
    'No timed shift log was supplied. Every time in the twin is an NTG estimate, a visit note or a placeholder. ' +
    'When a timed shift exists it replaces those estimates, and the twin moves from calibrated to validated.',
  /** Inventory rows whose "replaced by" column names a timed shift. */
  rows: inventoryRows.filter((r) => /timed shift/i.test(r.replacedBy)).map((r) => r.row),
};
