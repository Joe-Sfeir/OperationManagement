import { describe, expect, it } from 'vitest';
import { geoContains, geoInterpolate } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import landTopo from 'world-atlas/land-50m.json';
import {
  evaluate,
  feasibleInTier,
  landedCost,
  pathLengthNm,
  rankByTotal,
  reorderPoint,
  sailingDays,
  solveAllUnits,
  solveOption,
  tierFor,
  travelMs,
  type EoqParams,
  type OptionCosting,
  type Scenario,
} from './model';
import {
  AIR_LOT_KG,
  ALL_RECORDS,
  OPTION_IDS,
  ORDER_COST_USD,
  PLACE,
  PRICE_TIERS,
  SRC,
  optionSpec,
  routeLegs,
  type GulfRouting,
  type OptionId,
} from './sources';
import { P } from '../../data/params';

describe('EOQ with all-units discounts: textbook examples', () => {
  // Heizer & Render, Operations Management, "Wohl's Discount Store":
  // D = 5,000 cars a year, S = $49, I = 20%; $5.00 below 1,000, $4.80 from 1,000, $4.75 from 2,000.
  // Known answer: order 1,000 at a total annual cost of $24,725.
  const wohl: EoqParams = {
    demand: 5000,
    orderCost: 49,
    holdingRate: 0.2,
    tiers: [
      { minQty: 1, unitCost: 5.0 },
      { minQty: 1000, unitCost: 4.8 },
      { minQty: 2000, unitCost: 4.75 },
    ],
  };

  it("Wohl's Discount Store: Q* per tier is 700, 714, 718", () => {
    const s = solveAllUnits(wohl);
    expect(s.perTier.map((t) => Math.round(t!.qStar))).toEqual([700, 714, 718]);
  });

  it("Wohl's Discount Store: quantities adjust to 700, 1,000, 2,000 with totals 25,700 / 24,725 / 24,822.50", () => {
    const s = solveAllUnits(wohl);
    expect(s.perTier.map((t) => t!.qty)).toEqual([expect.closeTo(700, 6), 1000, 2000]);
    expect(s.perTier[0]!.total).toBeCloseTo(25700, 6);
    expect(s.perTier[1]!.total).toBeCloseTo(24725, 6);
    expect(s.perTier[2]!.total).toBeCloseTo(24822.5, 6);
    expect(s.perTier.map((t) => t!.qStarFeasible)).toEqual([true, false, false]);
  });

  it("Wohl's Discount Store: the best order is 1,000 units at $24,725 a year", () => {
    const { best } = solveAllUnits(wohl);
    expect(best.qty).toBe(1000);
    expect(best.tierIndex).toBe(1);
    expect(best.total).toBeCloseTo(24725, 6);
    expect(best.purchase).toBeCloseTo(24000, 6);
    expect(best.ordering).toBeCloseTo(245, 6);
    expect(best.holding).toBeCloseTo(480, 6);
    expect(best.ordersPerYear).toBeCloseTo(5, 9);
  });

  // Nahmias, Production and Operations Analysis, Weighty Trash Bag Company:
  // D = 600, K = $8, I = 20%; $0.30 below 500, $0.29 from 500, $0.28 from 1,000.
  // Known answer: order 500 at $198.10 a year.
  it('Weighty Trash Bag Company: the best order is 500 bags at $198.10 a year', () => {
    const s = solveAllUnits({
      demand: 600,
      orderCost: 8,
      holdingRate: 0.2,
      tiers: [
        { minQty: 1, unitCost: 0.3 },
        { minQty: 500, unitCost: 0.29 },
        { minQty: 1000, unitCost: 0.28 },
      ],
    });
    expect(s.perTier[0]!.qty).toBeCloseTo(400, 6);
    expect(s.perTier[0]!.total).toBeCloseTo(204, 6);
    expect(s.perTier[2]!.total).toBeCloseTo(200.8, 6);
    expect(s.best.qty).toBe(500);
    expect(s.best.total).toBeCloseTo(198.1, 6);
  });

  it('with one price it is the plain EOQ, where ordering cost equals holding cost', () => {
    const { best } = solveAllUnits({ demand: 1200, orderCost: 50, holdingRate: 0.25, tiers: [{ minQty: 1, unitCost: 8 }] });
    expect(best.qty).toBeCloseTo(Math.sqrt((2 * 1200 * 50) / 2), 9);
    expect(best.ordering).toBeCloseTo(best.holding, 9);
  });
});

describe('tier boundaries', () => {
  const tiers = [
    { minQty: 24000, unitCost: 1.3 },
    { minQty: 48000, unitCost: 1.28 },
    { minQty: 96000, unitCost: 1.26 },
  ];
  const p: EoqParams = { demand: 240000, orderCost: 400, holdingRate: 0.25, tiers, lot: 24000 };

  it('the price break applies from exactly the threshold quantity, to every unit', () => {
    expect(tierFor(tiers, 47999)).toBe(0);
    expect(tierFor(tiers, 48000)).toBe(1);
    expect(tierFor(tiers, 95999)).toBe(1);
    expect(tierFor(tiers, 96000)).toBe(2);
    expect(evaluate(p, 48000).purchase).toBeCloseTo(240000 * 1.28, 6);
    expect(evaluate(p, 72000).unitCost).toBe(1.28);
  });

  it('an order below the first threshold still pays the first-tier price', () => {
    expect(tierFor(tiers, 1000)).toBe(0);
  });

  it('a Q* below the tier moves up to the threshold', () => {
    expect(feasibleInTier(23449, 48000, 96000, 24000)).toEqual([48000]);
    expect(feasibleInTier(700, 1000, 2000)).toEqual([1000]);
  });

  it('a Q* inside the tier offers the whole lots on either side', () => {
    expect(feasibleInTier(60000, 48000, 96000, 24000)).toEqual([48000, 72000]);
    expect(feasibleInTier(72000, 48000, 96000, 24000)).toEqual([72000]);
  });

  it('a Q* above the tier stops at the last whole lot below the next threshold', () => {
    expect(feasibleInTier(150000, 48000, 96000, 24000)).toEqual([72000]);
    expect(feasibleInTier(150000, 24000, 48000, 24000)).toEqual([24000]);
  });

  it('without lots, a Q* above the tier drops the tier: the next price beats it at the boundary', () => {
    expect(feasibleInTier(2500, 1000, 2000)).toEqual([]);
  });

  it('a tier that holds no whole lot is skipped', () => {
    expect(feasibleInTier(30000, 30000, 40000, 24000)).toEqual([]);
    const s = solveAllUnits({ ...p, tiers: [{ minQty: 24000, unitCost: 1.3 }, { minQty: 30000, unitCost: 1.2 }, { minQty: 40000, unitCost: 1.1 }] });
    expect(s.perTier[1]).toBeNull();
    expect(s.best.qty % 24000).toBe(0);
  });

  it('every solved quantity is a whole number of lots inside its own tier', () => {
    const s = solveAllUnits(p);
    s.perTier.forEach((t, k) => {
      expect(t).not.toBeNull();
      expect(t!.qty % 24000).toBe(0);
      expect(tierFor(tiers, t!.qty)).toBe(k);
    });
  });

  it('the solved quantity is the cheapest whole-lot order (checked by brute force)', () => {
    for (const orderCost of [50, 400, 2000, 8000]) {
      const q = { ...p, orderCost };
      const s = solveAllUnits(q);
      let cheapest = Infinity;
      for (let n = 1; n <= 40; n++) cheapest = Math.min(cheapest, evaluate(q, n * 24000).total);
      expect(s.best.total).toBeCloseTo(cheapest, 6);
    }
  });

  it('a larger discount pulls the order up to the break; a small one does not', () => {
    const small = solveAllUnits({ ...p, tiers: [tiers[0]!, { minQty: 48000, unitCost: 1.299 }] });
    const large = solveAllUnits({ ...p, tiers: [tiers[0]!, { minQty: 48000, unitCost: 1.2 }] });
    expect(small.best.qty).toBe(24000);
    expect(large.best.qty).toBe(48000);
  });
});

describe('landed cost', () => {
  it('adds freight, duty on the CIF value, and charges after customs', () => {
    const l = landedCost({ unitPrice: 1.1, freightPerKg: 0.125, destinationPerKg: 0.035, dutyRate: 0.05, vatRate: 0.11, includeVat: false });
    expect(l.cif).toBeCloseTo(1.225, 12);
    expect(l.duty).toBeCloseTo(0.06125, 12);
    expect(l.vat).toBeCloseTo(0.1414875, 12);
    expect(l.landed).toBeCloseTo(1.32125, 12);
  });

  it('VAT is reported but only counted when asked for', () => {
    const base = { unitPrice: 1.1, freightPerKg: 0.125, destinationPerKg: 0.035, dutyRate: 0.05, vatRate: 0.11 };
    const without = landedCost({ ...base, includeVat: false });
    const withVat = landedCost({ ...base, includeVat: true });
    expect(withVat.vat).toBe(without.vat);
    expect(withVat.landed - without.landed).toBeCloseTo(0.1414875, 12);
  });

  it('with no duty the landed cost is price plus freight plus destination charges', () => {
    const l = landedCost({ unitPrice: 1.45, freightPerKg: 2000 / 24000, destinationPerKg: 850 / 24000, dutyRate: 0, vatRate: 0.11, includeVat: false });
    expect(l.duty).toBe(0);
    expect(l.landed).toBeCloseTo(1.45 + 2850 / 24000, 12);
  });
});

describe('pipeline stock, reorder point, ranking', () => {
  const p: EoqParams = { demand: 240000, orderCost: 400, holdingRate: 0.25, tiers: [{ minQty: 24000, unitCost: 1.3 }], lot: 24000 };

  it('pipeline cost is demand x lead time x unit cost x holding rate', () => {
    const e = evaluate({ ...p, leadDays: 73 }, 24000);
    expect(e.pipeline).toBeCloseTo(240000 * (73 / 365) * 1.3 * 0.25, 6);
    expect(e.total).toBeCloseTo(e.purchase + e.ordering + e.holding + e.pipeline, 9);
  });

  it('a longer lead time costs more and leaves the order quantity alone', () => {
    const fast = solveAllUnits({ ...p, leadDays: 15 });
    const slow = solveAllUnits({ ...p, leadDays: 45 });
    expect(slow.best.qty).toBe(fast.best.qty);
    expect(slow.best.total).toBeGreaterThan(fast.best.total);
  });

  it('reorder point is the demand during the lead time', () => {
    expect(reorderPoint(365000, 36)).toBeCloseTo(36000, 9);
    expect(reorderPoint(231972, 0)).toBe(0);
  });

  it('ranks by total annual cost, cheapest first, and marks one best', () => {
    const r = rankByTotal([
      { id: 'a', total: 30 },
      { id: 'b', total: 10 },
      { id: 'c', total: 20 },
      { id: 'd', total: 10 },
    ]);
    expect(r.map((x) => x.id)).toEqual(['b', 'd', 'c', 'a']);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3, 4]);
    expect(r.filter((x) => x.best).map((x) => x.id)).toEqual(['b']);
  });

  it('the mark crosses the map in 40 ms per lead-time day, between 0.6 s and 3 s', () => {
    expect(travelMs(5)).toBe(600);
    expect(travelMs(36)).toBe(1440);
    expect(travelMs(200)).toBe(3000);
  });
});

// ------------------------------------------------------------ the page's inputs

function costing(id: OptionId, routing: GulfRouting, dutyCeiling = false): OptionCosting {
  const spec = optionSpec(id, routing);
  const sum = (rs: { value: number }[]) => rs.reduce((s, r) => s + r.value, 0);
  return {
    id,
    perContainer: spec.mode === 'sea',
    price: spec.price.value,
    freight: sum(spec.freight),
    destination: sum(spec.destination),
    leadDays: sum(spec.lead),
    dutyRate: (dutyCeiling ? SRC.dutyCeiling.value : spec.duty.value) / 100,
  };
}

function scenario(over: Partial<Scenario> = {}): Scenario {
  return {
    demandKgYr: P.weeklyResinT.value * 1000 * 52,
    payloadKg: P.deliveryLotT.value * 1000,
    airLotKg: AIR_LOT_KG,
    orderCost: ORDER_COST_USD,
    holdingRate: P.holdingRatePerYear.value,
    vatRate: SRC.vat.value / 100,
    includeVat: false,
    priceBreaks: PRICE_TIERS.map((t) => ({ minContainers: t.minContainers, step: t.step?.value ?? 0 })),
    ...over,
  };
}

describe('the default scenario', () => {
  it('uses the NTG inputs it says it uses', () => {
    expect(P.weeklyResinT.value).toBe(4.461);
    expect(P.deliveryLotT.value).toBe(24);
    expect(P.holdingRatePerYear.value).toBe(0.25);
    expect(P.resinPriceUsdKg.value).toBe(1.37);
    expect(ORDER_COST_USD).toBe(400);
  });

  it('landed cost for Jubail by sea through Jeddah, one container: 1.10 + 3,100 / 24,000 + 850 / 24,000', () => {
    const r = solveOption(costing('jubail-sea', 'jeddah'), scenario());
    expect(r.freightPerKg).toBeCloseTo(3100 / 24000, 12);
    expect(r.destinationPerKg).toBeCloseTo(850 / 24000, 12);
    expect(r.tiers[0]!.landed.landed).toBeCloseTo(1.1 + 3950 / 24000, 12);
    expect(r.tiers[1]!.unitPrice).toBeCloseTo(1.08, 12);
    expect(r.tiers[2]!.unitPrice).toBeCloseTo(1.06, 12);
    expect(r.leadDays).toBe(10 + 4 + 7 + 8 + 9);
  });

  it('ranks the six options the same way every run, and sea beats air from every source', () => {
    const rows = rankByTotal(OPTION_IDS.map((id) => solveOption(costing(id, 'jeddah'), scenario())));
    expect(rows.map((r) => r.id)).toEqual(['jubail-sea', 'sitra-sea', 'hamburg-sea', 'jubail-air', 'sitra-air', 'hamburg-air']);
    expect(rows[0]!.best).toBe(true);
    for (const src of ['jubail', 'sitra', 'hamburg']) {
      const sea = rows.find((r) => r.id === `${src}-sea`)!;
      const air = rows.find((r) => r.id === `${src}-air`)!;
      expect(sea.total).toBeLessThan(air.total);
    }
  });

  it('sea orders are whole containers; a fixed quantity re-costs every option at that size', () => {
    const s = scenario();
    for (const id of OPTION_IDS.filter((i) => i.endsWith('-sea'))) {
      const r = solveOption(costing(id, 'jeddah'), s);
      expect(r.chosen.qty % s.payloadKg).toBe(0);
      const fixed = solveOption(costing(id, 'jeddah'), { ...s, fixedQtyKg: 4 * s.payloadKg });
      expect(fixed.chosen.qty).toBe(96000);
      expect(fixed.chosen.tierIndex).toBe(2);
      expect(fixed.eoq.best.qty).toBe(r.eoq.best.qty);
      expect(fixed.total).toBeGreaterThanOrEqual(r.total);
    }
  });

  it('the 5% duty ceiling raises landed cost by 5% of price plus freight', () => {
    const s = scenario();
    const free = solveOption(costing('hamburg-sea', 'jeddah'), s);
    const taxed = solveOption(costing('hamburg-sea', 'jeddah', true), s);
    const cif = free.tiers[0]!.landed.cif;
    expect(taxed.tiers[0]!.landed.landed - free.tiers[0]!.landed.landed).toBeCloseTo(0.05 * cif, 12);
  });
});

describe('researched records', () => {
  it('every record has a range that holds its value, a date and a source or says there is none', () => {
    for (const r of ALL_RECORDS) {
      expect(r.low, r.id).toBeLessThanOrEqual(r.value);
      expect(r.high, r.id).toBeGreaterThanOrEqual(r.value);
      expect(r.retrieved, r.id).toBe('2026-11-20');
      expect(r.note.length, r.id).toBeGreaterThan(0);
      if (r.sourceUrl === '') {
        expect(r.basis, r.id).toBe('assumption');
        expect(r.sourceTitle, r.id).toBe('No public figure found');
      } else {
        expect(r.sourceUrl, r.id).toMatch(/^https:\/\//);
      }
      if (r.basis === 'assumption') expect(r.note, r.id).toMatch(/No public|No figure/);
    }
  });

  it('record ids are unique', () => {
    expect(new Set(ALL_RECORDS.map((r) => r.id)).size).toBe(ALL_RECORDS.length);
  });
});

// ------------------------------------------------------------------ map routes

describe('routes on the map', () => {
  const topo = landTopo as unknown as Topology<{ land: GeometryCollection }>;
  const land = feature(topo, topo.objects.land);
  const routings: GulfRouting[] = ['jeddah', 'hormuz'];

  // Land polygons near the map, with bounding boxes, for a quick planar point-in-polygon test.
  // Planar is fine here: polygon edges at 1:50m are a few km long and nothing is near a pole or the date line.
  type Ring = number[][];
  const polygons: { rings: Ring[]; box: [number, number, number, number] }[] = [];
  for (const f of land.features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const rings of polys) {
      const outer = rings[0]!;
      const xs = outer.map((c) => c[0]!);
      const ys = outer.map((c) => c[1]!);
      const box: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      if (box[2] < -20 || box[0] > 70 || box[3] < 5 || box[1] > 62) continue;
      polygons.push({ rings, box });
    }
  }
  const inRing = (x: number, y: number, ring: Ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i] as [number, number];
      const [xj, yj] = ring[j] as [number, number];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const onLand = (x: number, y: number) =>
    polygons.some(
      ({ rings, box }) =>
        x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3] && inRing(x, y, rings[0]!) && !rings.slice(1).some((h) => inRing(x, y, h)),
    );

  it('the land test itself knows land from sea', () => {
    expect(onLand(46.7, 24.7)).toBe(true); // Riyadh
    expect(onLand(10.0, 50.0)).toBe(true); // Germany
    expect(onLand(38.0, 21.0)).toBe(false); // Red Sea
    expect(onLand(18.0, 35.0)).toBe(false); // Mediterranean
    expect(onLand(32.33, 30.55)).toBe(true); // Suez isthmus: why the canal leg is exempt
    expect(geoContains(land, [46.7, 24.7])).toBe(true);
    expect(geoContains(land, [38.0, 21.0])).toBe(false);
  });

  it('no sea leg crosses land (Natural Earth 1:50m), apart from the last stretch into a port', () => {
    const hits = new Set<string>();
    const seen = new Set<string>();
    let checked = 0;
    for (const routing of routings) {
      for (const id of OPTION_IDS) {
        for (const leg of routeLegs(id, routing)) {
          if (leg.kind !== 'sea') continue;
          const last = leg.points.length - 2;
          leg.points.slice(0, -1).forEach((a, i) => {
            const b = leg.points[i + 1]!;
            const key = `${a.join(',')} -> ${b.join(',')}`;
            if (seen.has(key)) return;
            seen.add(key);
            const at = geoInterpolate([a[0], a[1]], [b[0], b[1]]);
            for (let k = 0; k <= 200; k++) {
              const t = k / 200;
              // Ports sit on the coastline, so skip the approach at either end of the leg.
              if ((i === 0 && t < 0.15) || (i === last && t > 0.85)) continue;
              const [x, y] = at(t);
              checked++;
              if (onLand(x, y)) {
                hits.add(key);
                break;
              }
            }
          });
        }
      }
    }
    expect(checked).toBeGreaterThan(10000);
    expect([...hits]).toEqual([]);
  });

  it('every route starts at its source and ends at Beirut, with legs joined end to end', () => {
    for (const routing of routings) {
      for (const id of OPTION_IDS) {
        const legs = routeLegs(id, routing);
        const source = id.split('-')[0] as 'jubail' | 'sitra' | 'hamburg';
        expect(legs[0]!.points[0], id).toEqual(PLACE[source]);
        expect(legs.at(-1)!.points.at(-1), id).toEqual(PLACE.beirut);
        for (let i = 1; i < legs.length; i++) expect(legs[i]!.points[0], id).toEqual(legs[i - 1]!.points.at(-1));
      }
    }
  });

  it('sea routes have plausible lengths, and days under way are shorter than the transit times used', () => {
    const nm = (id: OptionId, routing: GulfRouting) =>
      routeLegs(id, routing)
        .filter((l) => l.kind !== 'road')
        .reduce((s, l) => s + pathLengthNm(l.points), 0);
    const jubail = nm('jubail-sea', 'hormuz');
    const hamburg = nm('hamburg-sea', 'hormuz');
    const jeddah = nm('jubail-sea', 'jeddah');
    expect(jubail).toBeGreaterThan(3300);
    expect(jubail).toBeLessThan(3700);
    expect(hamburg).toBeGreaterThan(3500);
    expect(hamburg).toBeLessThan(4000);
    expect(jeddah).toBeGreaterThan(800);
    expect(jeddah).toBeLessThan(1100);
    const knots = SRC.shipSpeed.value;
    expect(sailingDays(jubail, knots)).toBeLessThan(SRC.transitJubailOpen.value);
    expect(sailingDays(hamburg, knots)).toBeLessThan(SRC.transitHamburg.value);
    expect(sailingDays(jeddah, knots)).toBeLessThan(SRC.transitJeddahBeirut.value);
  });

  it('one degree of latitude is 60 nautical miles', () => {
    expect(pathLengthNm([[10, 0], [10, 1]])).toBeCloseTo(60.04, 1);
  });
});
