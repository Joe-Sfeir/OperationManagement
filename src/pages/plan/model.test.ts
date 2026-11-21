import { describe, expect, it } from 'vitest';
import { P, SKUS } from '../../data/params';
import { week } from '../../data/history';
import {
  FORM_WEEK_MONDAY,
  WHAT_IF_ARM_DAYS,
  WHAT_IF_DEMAND_PCT,
  armDaysPlan,
  buildInput,
  buildLp,
  capRelaxations,
  defaultSettings,
  manualHand,
  manualInput,
  meanWeeklyReturns,
  objectiveOf,
  penaltyPerTankWeek,
  recheck,
  recompute,
  solveModel,
  solvePlan,
  whatIf,
  type PlanInput,
  type PlanSettings,
  type PlanSolution,
} from './model';

const settings = (over: Partial<PlanSettings> = {}): PlanSettings => ({ ...defaultSettings(), ...over });

/** Largest stock-balance error of a solution, straight from the definition. */
function balanceError(input: PlanInput, sol: PlanSolution): number {
  let worst = 0;
  input.skus.forEach((k, ki) => {
    for (let t = 1; t <= input.weeks; t++) {
      const arrivals = t === 1 ? k.pipeline : k.mouldsPerArm * sol.n[ki]![t - 2]!;
      const expected = sol.stock[ki]![t - 1]! + arrivals + k.returns - k.demand[t - 1]!;
      worst = Math.max(worst, Math.abs(expected - sol.stock[ki]![t]!));
    }
  });
  return worst;
}

describe('data the plan starts from', () => {
  it('reads the inputs the brief names', () => {
    expect(armDaysPlan.value).toBe(8);
    expect(armDaysPlan.row).toBe(53);
    expect(P.cyclesPerMouldPerDay.value).toBe(4);
    expect(P.armCycleMin.value / 60).toBe(2);
    expect(meanWeeklyReturns.value.CTT4).toBeCloseTo(11 / 45, 12);
    expect(meanWeeklyReturns.value.CTT2).toBeCloseTo(20 / 45, 12);
    expect(meanWeeklyReturns.value.HTT2).toBeCloseTo(24 / 45, 12);
  });

  it('pairs the 6 Nov stock with the right ERP week', () => {
    for (const s of SKUS) expect(week(s, FORM_WEEK_MONDAY)?.closing).toBe(P.closingStock6Nov.value[s]);
  });

  it('builds the default input', () => {
    const input = buildInput(defaultSettings());
    expect(input.weeks).toBe(6);
    expect(input.armCycles).toEqual([32, 32, 32, 32, 32]);
    expect(input.skus.map((k) => k.openingStock)).toEqual([36, 113, 106]);
    expect(input.skus.map((k) => k.pipeline)).toEqual([8, 4, 36]);
    expect(input.skus.map((k) => k.demand[0])).toEqual([5.9, 23.9, 25.7]);
    expect(input.skus.map((k) => k.minStock)).toEqual([15, 50, 70]);
    expect(input.skus.map((k) => k.cap)).toEqual([40, 120, 140]);
    expect(input.skus.map((k) => k.mouldsPerArm)).toEqual([1, 2, 2]);
  });

  it('prices one tank-week short above the hours to make any tank', () => {
    const input = buildInput(defaultSettings());
    for (const k of input.skus) expect(input.penaltyHours).toBeGreaterThan(input.hoursPerArmCycle / k.mouldsPerArm);
    const cost = buildInput(settings({ objective: 'cost' }));
    // In USD: more than the arm-cycle plus holding the tank for the whole horizon.
    for (const k of cost.skus) expect(penaltyPerTankWeek(cost)).toBeGreaterThan(cost.costPerArmCycle / k.mouldsPerArm + 8 * k.holdingPerTankWeek);
  });
});

describe('LP text', () => {
  it('is CPLEX LP format with every constraint family', () => {
    const text = buildLp(buildInput(defaultSettings()), true);
    expect(text).toContain('Minimize');
    expect(text).toContain('Subject To');
    expect(text).toContain(' bal_CTT4_1: 1 I_CTT4_1 = 38.344444444');
    expect(text).toContain(' floor_HTT2_6: 1 I_HTT2_6 + 1 sh_HTT2_6 >= 70');
    expect(text).toContain(' mach_5: 1 n_CTT4_5 + 1 n_CTT2_5 + 1 n_HTT2_5 <= 32');
    expect(text).toContain(' I_CTT2_3 <= 120');
    expect(text).toContain('General');
    expect(text.trimEnd().endsWith('End')).toBe(true);
    expect(text).not.toMatch(/\d[eE][+-]?\d/);
  });

  it('leaves the shortage out under a strict floor and the cap out when it is off', () => {
    const text = buildLp(buildInput(settings({ floor: 'strict', capOn: false })), false);
    expect(text).not.toContain('sh_');
    expect(text).not.toContain('Bounds');
    expect(text).toContain(' floor_CTT2_4: 1 I_CTT2_4 >= 50');
  });
});

describe('manual check: the case solved by hand in NOTES.md', () => {
  it('continuous LP matches the hand solution', async () => {
    const lp = await solveModel(manualInput, false);
    expect(lp.status).toBe('optimal');
    lp.n[0]!.forEach((x, i) => expect(x).toBeCloseTo(manualHand.lp.n[i]!, 9));
    lp.stock[0]!.forEach((x, i) => expect(x).toBeCloseTo(manualHand.lp.stock[i]!, 9));
    lp.shortage[0]!.forEach((x, i) => expect(x).toBeCloseTo(manualHand.lp.shortage[i]!, 9));
    expect(lp.totals.hours).toBeCloseTo(manualHand.lp.hours, 9);
    expect(manualInput.penaltyHours * lp.totals.shortage).toBeCloseTo(manualHand.lp.penalty, 9);
    expect(lp.objective).toBeCloseTo(manualHand.lp.objective, 9);
    lp.duals!.capacity.forEach((x, i) => expect(x).toBeCloseTo(manualHand.lp.capacityDual[i]!, 9));
    lp.duals!.floor[0]!.forEach((x, i) => expect(x).toBeCloseTo(manualHand.lp.floorDual[i]!, 9));
  });

  it('whole-arm-cycle plan matches the hand solution', async () => {
    const int = await solveModel(manualInput, true);
    expect(int.status).toBe('optimal');
    expect(int.n[0]).toEqual([...manualHand.integer.n]);
    int.stock[0]!.forEach((x, i) => expect(x).toBeCloseTo(manualHand.integer.stock[i]!, 9));
    int.shortage[0]!.forEach((x, i) => expect(x).toBeCloseTo(manualHand.integer.shortage[i]!, 9));
    expect(int.totals.hours).toBe(manualHand.integer.hours);
    expect(int.objective).toBeCloseTo(manualHand.integer.objective, 9);
    expect(recheck(manualInput, int).every((c) => c.status !== 'fail')).toBe(true);
  });

  it('agrees with trying every whole plan', async () => {
    let best = Infinity;
    let arg: number[] = [];
    for (let a = 0; a <= manualInput.armCycles[0]!; a++)
      for (let b = 0; b <= manualInput.armCycles[1]!; b++) {
        const r = recompute(manualInput, [[a, b]]);
        if (r.stock[0]!.some((x) => x < 0)) continue;
        const z = objectiveOf(manualInput, r.totals);
        if (z < best) {
          best = z;
          arg = [a, b];
        }
      }
    expect(best).toBe(manualHand.integer.objective);
    expect(arg).toEqual([...manualHand.integer.n]);
  });
});

describe('default scenario', () => {
  it('solves, as an LP and with whole arm-cycles', async () => {
    const r = await solvePlan(buildInput(defaultSettings()));
    expect(r.lp.status).toBe('optimal');
    expect(r.integer.status).toBe('optimal');
    expect(r.diagnosis).toBeNull();
    expect(r.capRelaxed).toEqual([]);
    // Enough machine time: no tank-week below the minimum.
    expect(r.lp.totals.shortage).toBeCloseTo(0, 6);
    expect(r.integer.totals.shortage).toBeCloseTo(0, 6);
    // 81.3 arm-cycles as an LP, 82 whole ones.
    expect(r.lp.totals.hours).toBeCloseTo(162.6, 5);
    expect(r.integer.totals.armCycles).toBe(82);
    expect(r.integer.totals.hours).toBe(164);
    expect(r.integer.totals.tanks).toBe(159);
    expect(r.integer.objective).toBeGreaterThanOrEqual(r.lp.objective - 1e-9);
    for (const row of r.integer.n) for (const x of row) expect(Number.isInteger(x)).toBe(true);
  });

  it('keeps every stock balance', async () => {
    const input = buildInput(defaultSettings());
    const r = await solvePlan(input);
    expect(balanceError(input, r.lp)).toBeLessThan(1e-6);
    expect(balanceError(input, r.integer)).toBeLessThan(1e-6);
    // Week 1 is fixed by the pipeline: 36 + 8 + 11/45 - 5.9.
    expect(r.integer.stock[0]![1]).toBeCloseTo(36 + 8 + 11 / 45 - 5.9, 6);
  });

  it('respects machine capacity, the floor, the cap and no stockout', async () => {
    const input = buildInput(defaultSettings());
    const r = await solvePlan(input);
    for (const sol of [r.lp, r.integer]) {
      sol.armCyclesByPlan.forEach((used, i) => expect(used).toBeLessThanOrEqual(input.armCycles[i]! + 1e-6));
      input.skus.forEach((k, ki) => {
        for (let t = 1; t <= input.weeks; t++) {
          expect(sol.stock[ki]![t]!).toBeGreaterThanOrEqual(-1e-6);
          expect(sol.stock[ki]![t]! + sol.shortage[ki]![t - 1]!).toBeGreaterThanOrEqual(k.minStock - 1e-6);
          expect(sol.stock[ki]![t]!).toBeLessThanOrEqual(k.cap + 1e-6);
        }
      });
    }
  });

  it('passes the independent re-check on every constraint family', async () => {
    const r = await solvePlan(buildInput(defaultSettings()));
    expect(r.checks.map((c) => c.id)).toEqual(['whole', 'balance', 'stockout', 'floor', 'cap', 'machine', 'objective']);
    for (const c of r.checks) expect([c.rule, c.status, c.held]).toEqual([c.rule, 'pass', c.rows]);
  });

  it('makes tanks as late as the minimum allows', async () => {
    const r = await solvePlan(buildInput(defaultSettings()));
    // Nothing is needed for week 2: stock is above the minimum with nothing made.
    expect(r.integer.n.map((row) => row[0])).toEqual([0, 0, 0]);
  });
});

describe('the re-check catches a wrong plan', () => {
  it('fails machine capacity, the cap and the balance when the plan is tampered with', async () => {
    const input = buildInput(defaultSettings());
    const good = await solveModel(input, true);
    const bad: PlanSolution = { ...good, n: good.n.map((row, ki) => row.map((x, i) => (ki === 1 && i === 0 ? x + 40.5 : x))) };
    const status = Object.fromEntries(recheck(input, bad).map((c) => [c.id, c.status]));
    expect(status.whole).toBe('fail');
    expect(status.balance).toBe('fail');
    expect(status.cap).toBe('fail');
    expect(status.machine).toBe('fail');
    expect(status.objective).toBe('fail');
  });
});

describe('scenarios', () => {
  const grid: Partial<PlanSettings>[] = [];
  for (const weeks of [4, 6, 8])
    for (const demand of ['mean', 'busy', 'meanPlusSd'] as const)
      for (const armDays of [0, 5, 8, 14, 20])
        for (const objective of ['hours', 'cost'] as const)
          for (const floor of ['soft', 'strict'] as const) grid.push({ weeks, demand, armDays, objective, floor });

  it('every plan found passes the re-check, and the whole plan never beats the LP', async () => {
    let solved = 0;
    for (const g of grid) {
      const input = buildInput(settings(g));
      const r = await solvePlan(input);
      expect(r.integer.status === 'infeasible').toBe(r.lp.status === 'infeasible');
      if (r.integer.status !== 'optimal') {
        expect(r.diagnosis?.sentences.length).toBeGreaterThan(0);
        continue;
      }
      solved++;
      expect(r.checks.filter((c) => c.status === 'fail')).toEqual([]);
      expect(balanceError(input, r.lp)).toBeLessThan(1e-6);
      expect(r.integer.objective).toBeGreaterThanOrEqual(r.lp.objective - 1e-6);
      expect(objectiveOf(input, r.lp.totals)).toBeCloseTo(r.lp.objective, 5);
    }
    expect(solved).toBeGreaterThan(grid.length / 2);
  }, 120_000);

  it('the rounding rows do not change the whole-arm-cycle answer', async () => {
    for (const g of grid.filter((x) => x.weeks === 4)) {
      for (const capOn of [true, false]) {
        const input = buildInput(settings({ ...g, capOn }));
        const tight = await solveModel(input, true, true);
        const plain = await solveModel(input, true, false);
        expect(tight.status).toBe(plain.status);
        if (tight.status === 'optimal') expect(tight.objective).toBeCloseTo(plain.objective, 5);
      }
    }
  }, 120_000);

  it('a busy period fills the machine and leaves a shortage it reports', async () => {
    const input = buildInput(settings({ demand: 'busy' }));
    const r = await solvePlan(input);
    expect(r.lp.status).toBe('optimal');
    expect(r.lp.totals.shortage).toBeGreaterThan(1);
    r.lp.armCyclesByPlan.forEach((used, i) => expect(used).toBeCloseTo(input.armCycles[i]!, 6));
    const floor = r.checks.find((c) => c.id === 'floor')!;
    expect(floor.status).toBe('allowed');
  });

  it('a strict floor that cannot be held is reported in words', async () => {
    const r = await solvePlan(buildInput(settings({ demand: 'busy', floor: 'strict' })));
    expect(r.lp.status).toBe('infeasible');
    expect(r.integer.status).toBe('infeasible');
    expect(r.diagnosis?.floor?.sku).toBe('CTT2');
    expect(r.diagnosis?.sentences[0]).toMatch(/strict minimum cannot be held/);
  });

  it('no machine time and busy demand: says stock runs out', async () => {
    const r = await solvePlan(buildInput(settings({ demand: 'busy', armDays: 0 })));
    expect(r.lp.status).toBe('infeasible');
    expect(r.diagnosis?.stockout).not.toBeNull();
    expect(r.diagnosis?.sentences[0]).toMatch(/Stock runs out/);
  });

  it('relaxes the cap only where stock starts above it', async () => {
    const start = { ...defaultSettings().openingStock, CTT2: 160 };
    const input = buildInput(settings({ openingStock: start }));
    const relaxed = capRelaxations(input);
    // 160 + 4 + 20/45 - 23.9 = 140.5 in week 1, 117.1 in week 2: only week 1 is above 120.
    expect(relaxed.map((x) => [x.sku, x.week])).toEqual([['CTT2', 1]]);
    const r = await solvePlan(input);
    expect(r.integer.status).toBe('optimal');
    expect(r.integer.stock[1]![1]).toBeGreaterThan(120);
    expect(r.integer.stock[1]![2]).toBeLessThanOrEqual(120 + 1e-6);
    expect(r.checks.find((c) => c.id === 'cap')?.status).toBe('pass');
  });

  it('the cost objective holds less stock than it has to and never more hours than needed', async () => {
    const hours = await solvePlan(buildInput(settings()));
    const cost = await solvePlan(buildInput(settings({ objective: 'cost' })));
    expect(cost.integer.status).toBe('optimal');
    expect(cost.integer.totals.hours).toBeGreaterThanOrEqual(hours.integer.totals.hours - 1e-9);
    expect(cost.lp.objective).toBeCloseTo(cost.lp.totals.energyCost + cost.lp.totals.holdingCost + penaltyPerTankWeek(cost.input) * cost.lp.totals.shortage, 5);
  });
});

describe('sensitivity', () => {
  it('capacity shadow prices equal the change from one more arm-cycle', async () => {
    const base = buildInput(settings({ demand: 'busy' }));
    const lp = await solveModel(base, false);
    expect(lp.status).toBe('optimal');
    for (let i = 0; i < base.armCycles.length; i++) {
      const more = { ...base, armCycles: base.armCycles.map((a, j) => (j === i ? a + 1 : a)) };
      const again = await solveModel(more, false);
      expect(again.objective - lp.objective).toBeCloseTo(lp.duals!.capacity[i]!, 5);
      expect(lp.duals!.capacity[i]!).toBeLessThan(-1);
    }
  });

  it('spare capacity has no shadow price', async () => {
    const lp = await solveModel(buildInput(defaultSettings()), false);
    for (const d of lp.duals!.capacity) expect(Math.abs(d)).toBeLessThan(0.05);
  });

  it('floor shadow prices equal the change from a higher minimum', async () => {
    const base = buildInput(defaultSettings());
    const lp = await solveModel(base, false);
    // Raise every minimum by a hundredth of a tank (small enough to keep the same rows
    // binding): the cost per tank is the sum of the floor shadow prices.
    const step = 0.01;
    const higher = { ...base, skus: base.skus.map((k) => ({ ...k, minStock: k.minStock + step })) };
    const again = await solveModel(higher, false);
    const sum = lp.duals!.floor.flat().reduce((a, b) => a + b, 0);
    expect((again.objective - lp.objective) / step).toBeCloseTo(sum, 4);
    // CTT4 has one mould per arm: its last tank costs a 2 h arm-cycle.
    expect(lp.duals!.floor[0]![5]).toBeCloseTo(2, 1);
    expect(lp.duals!.floor[1]![5]).toBeCloseTo(1, 1);
  });

  it('what-if grid has every cell and repeats the plan at the current settings', async () => {
    const cells = await whatIf(defaultSettings());
    expect(cells.length).toBe(WHAT_IF_ARM_DAYS.length * WHAT_IF_DEMAND_PCT.length);
    const here = cells.find((c) => c.armDays === 8 && c.demandPct === 100)!;
    expect(here.status).toBe('optimal');
    expect(here.hours).toBe(164);
    expect(here.shortage).toBeCloseTo(0, 6);
    expect(here.lpHours).toBeCloseTo(162.6, 5);
    // More demand never needs fewer hours at the same capacity.
    for (const a of WHAT_IF_ARM_DAYS) {
      const row = cells.filter((c) => c.armDays === a && c.lpStatus === 'optimal');
      for (let i = 1; i < row.length; i++) expect(row[i]!.lpHours).toBeGreaterThanOrEqual(row[i - 1]!.lpHours - 1e-6);
    }
  });
});
