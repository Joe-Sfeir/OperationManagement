/**
 * Sourcing model: landed cost, EOQ with all-units quantity discounts, ranking.
 *
 * Pure TypeScript. No data lives here: prices, freight and lead times come
 * from ./sources.ts (researched estimates) and NTG inputs from data/params.ts.
 *
 * Units used by the page: kg, USD, days, years. The solver itself is unit-free,
 * which is what lets the tests run textbook examples unchanged.
 */

// ---------------------------------------------------------------- landed cost

export interface LandedInput {
  /** Price at origin for the tier that applies, per kg. */
  unitPrice: number;
  /** Freight from origin to the Beirut port or airport, per kg. Part of the customs value. */
  freightPerKg: number;
  /** Port dues, handling and the truck to the plant, per kg. Paid after customs. */
  destinationPerKg: number;
  /** Customs duty as a fraction of the CIF value (0.05 = 5%). */
  dutyRate: number;
  /** VAT as a fraction of CIF value plus duty. */
  vatRate: number;
  /** VAT is normally recovered by a registered manufacturer, so it is left out unless this is set. */
  includeVat: boolean;
}

export interface Landed {
  unitPrice: number;
  freight: number;
  /** Customs value: price plus freight. Insurance is left out (see NOTES.md). */
  cif: number;
  duty: number;
  destination: number;
  /** VAT that would be paid at the border, whether or not it is counted in `landed`. */
  vat: number;
  /** Cost per kg at the plant gate. */
  landed: number;
}

export function landedCost(i: LandedInput): Landed {
  const cif = i.unitPrice + i.freightPerKg;
  const duty = cif * i.dutyRate;
  const vat = (cif + duty) * i.vatRate;
  const landed = cif + duty + i.destinationPerKg + (i.includeVat ? vat : 0);
  return { unitPrice: i.unitPrice, freight: i.freightPerKg, cif, duty, destination: i.destinationPerKg, vat, landed };
}

// ------------------------------------------------------ EOQ, all-units discount

/** One price break. The unit cost applies to every unit once the order reaches `minQty`. */
export interface Tier {
  minQty: number;
  /** Cost per unit that is bought and then held (here: landed cost per kg). */
  unitCost: number;
}

export interface EoqParams {
  /** Demand per year. */
  demand: number;
  /** Fixed cost per order. */
  orderCost: number;
  /** Holding cost per year as a fraction of unit cost. */
  holdingRate: number;
  /** Price breaks in ascending `minQty`. The first `minQty` is the smallest order accepted. */
  tiers: Tier[];
  /** Orders come in whole multiples of this (a container payload). Leave out for any quantity. */
  lot?: number;
  /** Lead time in days, for the pipeline stock cost. 0 leaves it out. */
  leadDays?: number;
}

export interface Evaluation {
  qty: number;
  tierIndex: number;
  unitCost: number;
  ordersPerYear: number;
  /** demand x unit cost */
  purchase: number;
  /** orders per year x order cost */
  ordering: number;
  /** average cycle stock (qty / 2) x unit cost x holding rate */
  holding: number;
  /** stock in the pipeline: demand x lead time x unit cost x holding rate. Does not depend on qty. */
  pipeline: number;
  total: number;
}

export interface TierSolution extends Evaluation {
  /** Unconstrained square-root quantity at this tier's unit cost. */
  qStar: number;
  /** True when qStar already lies inside the tier and on a lot boundary. */
  qStarFeasible: boolean;
}

export interface EoqSolution {
  best: TierSolution;
  /** One entry per tier; null when the tier holds no whole lot. */
  perTier: (TierSolution | null)[];
}

export const DAYS_PER_YEAR = 365;

function checkParams(p: EoqParams): void {
  if (!(p.demand > 0)) throw new Error('demand must be positive');
  if (!(p.orderCost >= 0)) throw new Error('orderCost must not be negative');
  if (!(p.holdingRate > 0)) throw new Error('holdingRate must be positive');
  if (p.tiers.length === 0) throw new Error('at least one tier is needed');
  p.tiers.forEach((t, k) => {
    if (!(t.unitCost > 0)) throw new Error(`tier ${k}: unitCost must be positive`);
    if (k > 0 && !(t.minQty > p.tiers[k - 1]!.minQty)) throw new Error('tiers must be in ascending minQty');
  });
  if (p.lot !== undefined && !(p.lot > 0)) throw new Error('lot must be positive');
}

/** Index of the tier whose price applies to an order of `qty` (all-units: the last break reached). */
export function tierFor(tiers: Tier[], qty: number): number {
  let k = 0;
  for (let i = 0; i < tiers.length; i++) if (qty >= tiers[i]!.minQty) k = i;
  return k;
}

/** Annual cost of ordering `qty` every time. The tier is the one `qty` reaches. */
export function evaluate(p: EoqParams, qty: number): Evaluation {
  checkParams(p);
  if (!(qty > 0)) throw new Error('qty must be positive');
  const tierIndex = tierFor(p.tiers, qty);
  const unitCost = p.tiers[tierIndex]!.unitCost;
  const ordersPerYear = p.demand / qty;
  const purchase = p.demand * unitCost;
  const ordering = ordersPerYear * p.orderCost;
  const holding = (qty / 2) * unitCost * p.holdingRate;
  const pipeline = p.demand * ((p.leadDays ?? 0) / DAYS_PER_YEAR) * unitCost * p.holdingRate;
  return { qty, tierIndex, unitCost, ordersPerYear, purchase, ordering, holding, pipeline, total: purchase + ordering + holding + pipeline };
}

const EPS = 1e-9;

/**
 * Feasible order quantities nearest to `q` inside one tier: [min, nextMin).
 * Without a lot this is `q`, raised to `min` if it falls short (none if it
 * overshoots the tier). With a lot it is the whole multiples just below and
 * just above `q` that still lie in the tier (one or two candidates; none if
 * the tier holds no whole lot).
 */
export function feasibleInTier(q: number, min: number, nextMin: number, lot?: number): number[] {
  if (lot === undefined) {
    if (q < min) return [min];
    // The top of a tier is open. A Q* beyond it means the next tier, with a lower
    // price at the boundary, beats every quantity in this one: drop the tier.
    if (q >= nextMin) return [];
    return [q];
  }
  const first = Math.max(1, Math.ceil(min / lot - EPS));
  const last = Number.isFinite(nextMin) ? Math.ceil(nextMin / lot - EPS) - 1 : Infinity;
  if (last < first) return [];
  const below = Math.min(last, Math.max(first, Math.floor(q / lot + EPS)));
  const above = Math.min(last, Math.max(first, Math.ceil(q / lot - EPS)));
  return below === above ? [below * lot] : [below * lot, above * lot];
}

/**
 * EOQ with all-units discounts.
 *
 * For each tier: Q* = sqrt(2 D S / (i c)), moved to the nearest feasible
 * quantity in the tier, then costed. The cheapest tier wins. Within a tier
 * the cost curve is convex in Q, so when a lot size leaves two neighbours
 * the cheaper of the two is the tier's optimum.
 */
export function solveAllUnits(p: EoqParams): EoqSolution {
  checkParams(p);
  const perTier = p.tiers.map((t, k): TierSolution | null => {
    const nextMin = p.tiers[k + 1]?.minQty ?? Infinity;
    const qStar = Math.sqrt((2 * p.demand * p.orderCost) / (p.holdingRate * t.unitCost));
    const candidates = feasibleInTier(qStar, t.minQty, nextMin, p.lot);
    if (candidates.length === 0) return null;
    const evals = candidates.map((q) => evaluate(p, q));
    const e = evals.reduce((a, b) => (b.total < a.total ? b : a));
    return { ...e, qStar, qStarFeasible: Math.abs(e.qty - qStar) < 1e-6 * Math.max(1, qStar) };
  });
  const feasible = perTier.filter((s): s is TierSolution => s !== null);
  if (feasible.length === 0) throw new Error('no feasible order quantity');
  // Ties go to the smaller order: less stock for the same money.
  const best = feasible.reduce((a, b) => (b.total < a.total - EPS ? b : a));
  return { best, perTier };
}

// ------------------------------------------------------------ one option, solved

/** One source and mode, reduced to the numbers the arithmetic needs. */
export interface OptionCosting {
  id: string;
  /** Sea: freight and destination charges are per container and orders are whole containers. Air: per kg. */
  perContainer: boolean;
  /** Price at origin per kg for the smallest order. */
  price: number;
  /** Freight to the Beirut port or airport: per container (sea) or per kg (air). */
  freight: number;
  /** Charges after customs: per container (sea) or per kg (air). */
  destination: number;
  leadDays: number;
  dutyRate: number;
}

export interface Scenario {
  demandKgYr: number;
  /** Net resin in one container, kg. */
  payloadKg: number;
  /** Order multiple for air cargo, kg. */
  airLotKg: number;
  orderCost: number;
  holdingRate: number;
  vatRate: number;
  includeVat: boolean;
  /** All-units price breaks: containers per order and the price step against the first tier (0 or negative). */
  priceBreaks: { minContainers: number; step: number }[];
  /** Set to cost every option at this order size instead of its own EOQ. */
  fixedQtyKg?: number;
}

export interface TierCost {
  minQty: number;
  unitPrice: number;
  landed: Landed;
}

export interface OptionResult {
  id: string;
  freightPerKg: number;
  destinationPerKg: number;
  /** Landed cost at each price break. */
  tiers: TierCost[];
  /** The option's own optimum. */
  eoq: EoqSolution;
  /** What the table shows: the EOQ, or the fixed quantity when the scenario sets one. */
  chosen: Evaluation;
  leadDays: number;
  /** Demand during the lead time, kg. */
  reorderKg: number;
  total: number;
}

export function solveOption(o: OptionCosting, s: Scenario): OptionResult {
  const freightPerKg = o.perContainer ? o.freight / s.payloadKg : o.freight;
  const destinationPerKg = o.perContainer ? o.destination / s.payloadKg : o.destination;
  const lot = o.perContainer ? s.payloadKg : s.airLotKg;
  const tiers: TierCost[] = s.priceBreaks.map((b, k) => {
    const unitPrice = o.price + b.step;
    return {
      // The first tier starts at the smallest order the mode accepts.
      minQty: k === 0 ? lot : b.minContainers * s.payloadKg,
      unitPrice,
      landed: landedCost({
        unitPrice,
        freightPerKg,
        destinationPerKg,
        dutyRate: o.dutyRate,
        vatRate: s.vatRate,
        includeVat: s.includeVat,
      }),
    };
  });
  const params: EoqParams = {
    demand: s.demandKgYr,
    orderCost: s.orderCost,
    holdingRate: s.holdingRate,
    tiers: tiers.map((t) => ({ minQty: t.minQty, unitCost: t.landed.landed })),
    lot,
    leadDays: o.leadDays,
  };
  const eoq = solveAllUnits(params);
  const chosen = s.fixedQtyKg !== undefined ? evaluate(params, s.fixedQtyKg) : eoq.best;
  return {
    id: o.id,
    freightPerKg,
    destinationPerKg,
    tiers,
    eoq,
    chosen,
    leadDays: o.leadDays,
    reorderKg: reorderPoint(s.demandKgYr, o.leadDays),
    total: chosen.total,
  };
}

// --------------------------------------------------------------------- ranking

export type Ranked<T> = T & { rank: number; best: boolean };

/** Cheapest total annual cost first. Equal totals keep their input order. */
export function rankByTotal<T extends { total: number }>(rows: T[]): Ranked<T>[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.total - b.r.total || a.i - b.i)
    .map(({ r }, k) => ({ ...r, rank: k + 1, best: k === 0 }));
}

/** Reorder point with no safety stock: demand during the lead time. */
export function reorderPoint(demandPerYear: number, leadDays: number): number {
  return (demandPerYear * leadDays) / DAYS_PER_YEAR;
}

// ------------------------------------------------------------- map and motion

export type LonLat = readonly [number, number];

const EARTH_RADIUS_NM = 3440.065;

/** Great-circle length of a polyline of [longitude, latitude] points, in nautical miles. */
export function pathLengthNm(points: readonly LonLat[]): number {
  const rad = Math.PI / 180;
  let nm = 0;
  for (let i = 1; i < points.length; i++) {
    const [l1, p1] = points[i - 1]!;
    const [l2, p2] = points[i]!;
    const a =
      Math.sin(((p2 - p1) * rad) / 2) ** 2 +
      Math.cos(p1 * rad) * Math.cos(p2 * rad) * Math.sin(((l2 - l1) * rad) / 2) ** 2;
    nm += 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  return nm;
}

/** Days under way at a steady speed. Port time and transshipment are not in this. */
export function sailingDays(nm: number, knots: number): number {
  return nm / (knots * 24);
}

/**
 * How long the ship or plane mark takes to cross the map: 40 ms per day of
 * lead time, kept between 0.6 s and 3 s so the fastest and slowest options
 * still read as fast and slow.
 */
export function travelMs(leadDays: number): number {
  return Math.min(3000, Math.max(600, 40 * leadDays));
}
