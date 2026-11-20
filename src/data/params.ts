/**
 * Typed model inputs, read from src/data/inventory.json (extracted from
 * data/NTG_Data_Inventory_v1.xlsx by tools/extract_data.py).
 *
 * Every value is PARSED from its inventory row, never typed in here, so the
 * workbook stays the single source. Each datum keeps its provenance tag:
 * N = NTG reported, V = team visit, C = calculated, S = synthetic or estimate.
 *
 * Inputs the inventory does not hold are in `assumed` below, tagged S, and
 * logged in docs/ASSUMPTIONS.md.
 */
import raw from './inventory.json';

export type Tag = 'N' | 'V' | 'C' | 'S';
export type Sku = 'CTT4' | 'CTT2' | 'HTT2';
export const SKUS: readonly Sku[] = ['CTT4', 'CTT2', 'HTT2'] as const;
export type PerSku<T> = Record<Sku, T>;

export interface InventoryRow {
  row: number;
  stage: string;
  parameter: string;
  value: string | number;
  unit: string;
  status: string;
  tag: string;
  source: string;
  confidence: string;
  usedIn: string;
  replacedBy: string;
  notes: string;
}

export interface Datum<T> {
  value: T;
  tag: Tag;
  /** Inventory row number, or 0 for an assumption that is not in the inventory. */
  row: number;
  label: string;
  unit: string;
  source: string;
  confidence: string;
  note: string;
}

export const inventoryRows = raw.inventory as InventoryRow[];
export const inventorySources = raw.sources as { id: string; reference: string; link: string }[];

const byRow = new Map(inventoryRows.map((r) => [r.row, r]));
function row(n: number): InventoryRow {
  const r = byRow.get(n);
  if (!r) throw new Error(`Inventory row ${n} not found`);
  return r;
}

/** All plain numbers in a string, in order ("40 / 22 / 25 (total 87)" -> [40, 22, 25, 87]). */
export function numbers(v: string | number): number[] {
  if (typeof v === 'number') return [v];
  return (v.replace(/,(?=\d{3})/g, '').match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

function datum<T>(n: number, pick: (r: InventoryRow) => T, tag?: Tag, unit?: string): Datum<T> {
  const r = row(n);
  return {
    value: pick(r),
    tag: tag ?? (r.tag as Tag),
    row: n,
    label: r.parameter,
    unit: unit ?? r.unit,
    source: r.source,
    confidence: r.confidence,
    note: r.notes,
  };
}

const first = (r: InventoryRow) => {
  const n = numbers(r.value)[0];
  if (n === undefined) throw new Error(`Row ${r.row}: no number in "${r.value}"`);
  return n;
};
/** "base 1.5" or "mid 8" inside the text. */
const keyed = (key: string) => (r: InventoryRow) => {
  const m = String(r.value).match(new RegExp(`${key}\\s*([\\d.]+)`));
  if (!m) throw new Error(`Row ${r.row}: "${key}" not found in "${r.value}"`);
  return Number(m[1]);
};
/** "a / b / c" in SKU order CTT4, CTT2, HTT2. Takes the last number of each part. */
const perSku =
  (opts: { firstNumber?: boolean; sep?: string } = {}) =>
  (r: InventoryRow): PerSku<number> => {
    const parts = String(r.value).split('(')[0]!.split(opts.sep ?? '/');
    if (parts.length < 3) throw new Error(`Row ${r.row}: expected 3 parts in "${r.value}"`);
    const v = parts.slice(0, 3).map((p) => {
      const ns = numbers(p);
      const n = opts.firstNumber ? ns[0] : ns[ns.length - 1];
      if (n === undefined) throw new Error(`Row ${r.row}: no number in "${p}"`);
      return n;
    });
    return { CTT4: v[0]!, CTT2: v[1]!, HTT2: v[2]! };
  };
/** "40 / 22 / 25 (total 87)" -> [outer, foam, inner]. */
const layers = (r: InventoryRow): [number, number, number] => {
  const n = numbers(String(r.value).split('(')[0]!);
  if (n.length !== 3) throw new Error(`Row ${r.row}: expected 3 layer weights in "${r.value}"`);
  return [n[0]!, n[1]!, n[2]!];
};
const rangeMid = (r: InventoryRow) => {
  const m = String(r.value).match(/([\d.]+)\s*[–-]\s*([\d.]+)/);
  if (!m) throw new Error(`Row ${r.row}: no range in "${r.value}"`);
  return (Number(m[1]) + Number(m[2])) / 2;
};

/** Model inputs straight from the inventory. */
export const P = {
  // 1-2. Raw material
  resinPriceUsdKg: datum(9, first),
  deliveryLotT: datum(10, first),
  replenishLeadMonths: datum(11, first),
  weeklyResinT: datum(13, first),
  prepLines: datum(14, first),
  grindRateKgH: datum(16, rangeMid, 'S', 'kg/h'),
  pigmentPriceUsdKg: datum(18, first),
  pigmentDose: datum(19, first),
  foamPriceUsdKg: datum(20, first),
  foamDose: datum(21, first),
  siloCount: datum(23, first, undefined, 'silos'),
  siloCapacityT: datum(25, first, undefined, 't per silo'),
  // 3. Moulds and loading
  layerKg: {
    CTT4: datum(27, layers),
    CTT2: datum(28, layers),
    HTT2: datum(29, layers),
  } satisfies PerSku<Datum<[number, number, number]>>,
  planKgPerTank: datum(30, perSku()),
  mouldsPerArm: datum(31, perSku()),
  loadMin: datum(32, first),
  mouldChangeMin: datum(33, first),
  // 4. Machine 3700
  arms: datum(37, first),
  positions: datum(39, first),
  ovenCapacityArms: datum(41, first),
  ovenVisitMin: datum(43, first),
  layerPauseMin: datum(45, keyed('base')),
  waitBeforeOvenMin: datum(46, first),
  armCycleMin: datum(47, first),
  tanksPerShift: datum(49, perSku({ firstNumber: true, sep: '+' })),
  otherProductsHWeek: datum(51, first),
  shiftHours: datum(54, (r) => numbers(r.value)[1]!, undefined, 'h/shift'),
  daysPerWeek: datum(54, (r) => numbers(r.value)[0]!, undefined, 'days/week'),
  shiftsPerDay: datum(55, first),
  cyclesPerMouldPerDay: datum(57, first),
  dieselLPerShift: datum(59, first, undefined, 'L/shift'),
  dieselCostPerArmCycle: datum(61, first),
  electricityCostPerArmCycle: datum(64, first),
  ovenTempC: datum(65, rangeMid, 'S', '°C'),
  // 5. Cooling
  airCoolMin: datum(68, first),
  waterCoolMin: datum(69, first),
  // 6-7. Demould and finishing
  demouldWaitMin: datum(72, keyed('mid')),
  demouldMin: datum(73, first),
  workers: datum(74, first),
  finishingMin: datum(75, first),
  // 8. Stock and policy
  openingStock2Nov: datum(78, perSku()),
  closingStock6Nov: datum(79, perSku()),
  minStock: datum(82, perSku()),
  planLagWeeks: datum(85, first),
  pipeline: datum(86, (r) => perSku()({ ...r, value: String(r.value).split(':')[1]! })),
  unitValueUsd: datum(92, perSku()),
  holdingRatePerYear: datum(93, first),
  holdingPerTankWeek: datum(94, perSku()),
  warehouseCap: datum(95, perSku()),
  // 9. Demand
  deliveriesWeek2Nov: datum(97, perSku()),
  ordersWeek2Nov: datum(98, perSku()),
  productionWeek2Nov: datum(100, perSku()),
  weeklySalesMean: datum(102, perSku()),
  weeklySalesSd: datum(103, perSku()),
  // 10. Energy
  dieselPriceUsdL: datum(118, first),
  electricityPriceUsdKwh: datum(119, first),
} as const;

/** An input that is not in the inventory. Always tagged S and logged in ASSUMPTIONS.md. */
function assumption<T>(id: string, label: string, value: T, unit: string, note: string): Datum<T> {
  return { value, tag: 'S', row: 0, label, unit, source: `Assumption ${id} (docs/ASSUMPTIONS.md)`, confidence: 'Low', note };
}

export const assumed = {
  indexMin: assumption('A9', 'Arm index time between positions (door, swing, door)', 1.5, 'min',
    'Not timed. Range 1 to 2. With the 28.5 min oven visit it gives 4 x 30 = 120 min, the NTG cycle.'),
  ovenDoorDipC: assumption('A10', 'Oven air temperature drop while a door is open', 60, '°C',
    'Shape of the temperature curve only. Not used in any count or KPI.'),
  ovenRecoverTauMin: assumption('A10', 'Oven temperature recovery time constant', 2.5, 'min',
    'Shape of the temperature curve only.'),
  siloStartFill: assumption('A11', 'Silo level at the start of the shift', 0.8, 'fraction full',
    'No stock count for powder. Raw material is not a constraint in the data.'),
  siloReorderFill: assumption('A11', 'Silo level that triggers a grinding batch', 0.3, 'fraction full',
    'No NTG rule recorded. Grinding is on demand.'),
  grindBatchKg: assumption('A11', 'Grinding batch size', 1000, 'kg', 'One bulk bag. No NTG figure.'),
  hopperCapacityKg: assumption('A12', 'Dosing hopper capacity, each', 600, 'kg', 'Estimated from the platform photo.'),
  binKg: assumption('A12', 'Transfer bin load', 400, 'kg', 'Forklift bin from silo to hopper. Estimate.'),
  binTripMin: assumption('A12', 'Forklift trip, silo to hopper', 6, 'min', 'Estimate.'),
  hopperRefillBelowKg: assumption('A12', 'Hopper level that calls a bin', 150, 'kg', 'Estimate.'),
} as const;

/** Layer names in the order powder goes in. Inventory row 26: outer ivory, foam, inner natural. */
export const LAYERS = ['Outer (ivory)', 'Foam', 'Inner (natural)'] as const;
export const layerCount = datum(26, first);
