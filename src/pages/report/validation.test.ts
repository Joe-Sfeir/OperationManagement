import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { P, SKUS, inventoryRows, numbers } from '../../data/params';
import { dailyProduction, fullWeeks, week, weekly } from '../../data/history';
import { defaultConfig } from '../../sim/config';
import { runSimulation } from '../../sim/engine';
import { SCENARIOS, evaluateWeek, recommend } from '../../sim/scenarios';
import { BASELINE_ID, mouldChanges, ruleChecks, rulePick } from '../redesign/rule';
import { GROUPS, MAIN_ASSUMPTIONS, assumptions, assumptionsMarkdown } from './assumptions';
import { modelMarkdown } from './modelDoc';
import { FIELD_TIMING, PAGE_ROWS, rangeIn, signed, sumSku, threeArmQuantities, validation } from './validation';
import { validationMarkdown } from './validationDoc';

const v = validation();
const row = (id: string) => v.rows.find((r) => r.id === id)!;

describe('validation summary', () => {
  it('takes every twin figure from a simulator run, not from a typed number', () => {
    const k = runSimulation(defaultConfig()).kpis;
    expect(v.base.cycleMin).toBe(k.cycleMin);
    expect(v.base.tanksTotal).toEqual(k.tanksTotal);
    expect(v.base.tanksInShift).toEqual(k.tanksInShift);
    expect(v.base.ovenVisits).toBe(k.ovenVisits);
    expect(v.base.waitOvenMin).toBe(k.meanWaitOvenMin);
    expect(v.base.runOutMin).toBe(k.runOutMin);
    expect(row('cycle').twin).toBe(`${k.cycleMin.toFixed(1)} min`);
    expect(row('waitOven').twin).toBe(`${k.meanWaitOvenMin.toFixed(1)} min`);
  });

  it('matches NTG on cycle, shift output and cycles per mould (rows 47, 49, 57)', () => {
    expect(row('cycle').verdict).toBe('match');
    expect(Math.abs(v.base.cycleMin - P.armCycleMin.value)).toBeLessThan(0.05);
    expect(row('tanksTotal').verdict).toBe('match');
    expect(v.base.tanksTotal).toEqual(P.tanksPerShift.value);
    expect(row('cyclesPerMould').verdict).toBe('match');
    expect(v.base.cyclesPerArm).toBe(P.cyclesPerMouldPerDay.value);
  });

  it('reports the gap as a gap, with its size', () => {
    expect(row('tanksInShift').verdict).toBe('gap');
    expect(v.base.inShift).toBeLessThan(sumSku(P.tanksPerShift.value));
    expect(v.base.lateArms).toBe(2);
    expect(row('tanksInShift').words).toContain(`${v.base.runOutMin.toFixed(1)} min`);
    expect(row('tanksInShift').note).toContain(`${v.base.runOutMin.toFixed(1)} min`);
  });

  it('calls the loaded wait before the oven close to NTG, and says it is not proof', () => {
    const gap = v.base.waitOvenMin - P.waitBeforeOvenMin.value;
    expect(Math.abs(gap)).toBeLessThanOrEqual(1);
    expect(row('waitOven').verdict).toBe('match');
    expect(row('waitOven').difference).toBe(`${signed(gap, 1)} min`);
    expect(row('waitOven').words).toMatch(/not proof/);
    expect(row('waitOven').words).toMatch(/21 Nov 2026/);
    // The other reading of the layer step gives the same output and a much longer loaded wait.
    expect(v.alternative.run.total).toBe(v.base.total);
    expect(v.alternative.run.cycleMin).toBeCloseTo(v.base.cycleMin, 6);
    expect(v.alternative.run.waitOvenMin).toBeGreaterThan(v.base.waitOvenMin * 2);
  });

  it('does not present inputs or missing data as checks', () => {
    expect(row('waitDemould').verdict).toBe('input');
    expect(v.base.waitDemouldMin).toBe(P.demouldWaitMin.value);
    for (const id of ['ovenUse', 'waitLoad']) {
      expect(row(id).verdict).toBe('no-data');
      expect(row(id).ntgTag).toBeNull();
    }
    expect(v.base.waitLoadMin).toBe(runSimulation(defaultConfig()).kpis.meanWaitLoadMin);
    expect(v.base.waitLoadMin).toBeGreaterThan(0);
  });

  it('gives the page seven short rows', () => {
    expect(PAGE_ROWS.length).toBe(7);
    for (const id of PAGE_ROWS) {
      const r = row(id);
      expect(r, id).toBeDefined();
      expect(r.note.split(/\s+/).length, id).toBeLessThanOrEqual(12);
      expect(r.note).not.toMatch(/undefined|NaN/);
    }
  });

  it('cites an inventory row for every NTG figure', () => {
    for (const r of v.rows) {
      if (r.ntgTag === null) continue;
      expect(r.ntgRows.length).toBeGreaterThan(0);
      for (const n of r.ntgRows) expect(inventoryRows.some((x) => x.row === n)).toBe(true);
    }
  });

  it('adds the task times up and finds minutes nobody estimated', () => {
    const sum = v.identity.parts.reduce((s, p) => s + p.min, 0) + v.identity.indexMoves * v.identity.indexMin;
    expect(v.identity.sumMin).toBe(sum);
    expect(v.identity.unexplainedMin).toBe(P.armCycleMin.value - sum);
    expect(v.identity.unexplainedMin).toBeGreaterThan(0);
  });

  it('splits a mid-shift arm cycle so that it adds up to the cycle', () => {
    const st = v.identity.steady;
    expect(st.cycles).toBeGreaterThan(0);
    expect(st.total).toBeCloseTo(v.base.cycleMin, 6);
    expect(st.crewWait).toBeCloseTo(P.demouldWaitMin.value, 6);
    expect(st.moves).toBeCloseTo(v.identity.indexMoves * v.identity.indexMin, 6);
    // In the twin the minutes no estimate covers are the empty wait for loading and full arms held after cooling.
    expect(st.waitLoad).toBeGreaterThan(0);
    expect(st.waitLoad + st.held + (st.waitOven - P.waitBeforeOvenMin.value)).toBeCloseTo(v.identity.unexplainedMin, 6);
  });
});

describe('demould placeholder and index time', () => {
  it('reads both ranges from the data', () => {
    expect(rangeIn('Range 8–30. More text')).toEqual([8, 30]);
    expect(v.demould.range[0]).toBeLessThan(P.demouldMin.value);
    expect(v.demould.range[1]).toBeGreaterThan(P.demouldMin.value);
    expect(v.index.range[0]).toBeLessThan(v.index.range[1]);
    expect(v.demould.sweep[0]!.value).toBe(v.demould.range[0]);
    expect(v.demould.sweep[v.demould.sweep.length - 1]!.value).toBe(v.demould.range[1]);
  });

  it('shows that a longer demould shortens the oven wait while the cycle holds', () => {
    const ok = v.demould.sweep.filter((s) => s.value <= v.demould.holdsCycleUpTo);
    expect(ok.length).toBeGreaterThan(1);
    for (let i = 1; i < ok.length; i++) {
      expect(ok[i]!.run.cycleMin).toBeCloseTo(v.base.cycleMin, 6);
      expect(ok[i]!.run.waitOvenMin).toBeLessThan(ok[i - 1]!.run.waitOvenMin);
      expect(ok[i]!.run.total).toBe(v.base.total);
    }
    // Across that range the loaded wait stays within a few minutes of NTG's estimate.
    for (const s of ok) expect(Math.abs(s.run.waitOvenMin - P.waitBeforeOvenMin.value)).toBeLessThan(3);
    expect(v.demould.firstBroken).not.toBeNull();
    expect(v.demould.firstBroken!.run.cycleMin).toBeGreaterThan(v.base.cycleMin);
  });

  it('moves the cycle by under 2 % across the index range and no tank count', () => {
    for (const s of v.index.sweep) {
      expect(Math.abs(s.run.cycleMin - P.armCycleMin.value) / P.armCycleMin.value).toBeLessThan(0.02);
      expect(s.run.total).toBe(v.base.total);
    }
  });
});

describe('ERP checks', () => {
  it('gets the three-arm quantities from the simulator', () => {
    const q = threeArmQuantities();
    for (const k of SKUS) {
      expect(Math.max(...q[k])).toBeGreaterThan(v.erp[k].fourArm);
      expect(v.erp[k].fourArm).toBe(v.base.tanksTotal[k]);
    }
  });

  it('classifies every ERP production day once', () => {
    for (const k of SKUS) {
      const e = v.erp[k];
      expect(e.daysFour + e.daysThree + e.daysMultiple + e.daysNone).toBe(e.days);
      expect(e.days).toBe(dailyProduction.filter((d) => d[k] > 0).length);
      // The typical-shift quantity is the most common day in the ERP.
      expect(e.daysFour).toBe(Math.max(...e.hist.map((h) => h.days)));
      expect(e.daysNone).toBeGreaterThan(0);
    }
  });

  it('compares the week of 2 to 6 Nov with mould-days x cycles', () => {
    const w = v.weekNov2;
    for (const k of SKUS) {
      expect(w.erp[k]).toBe(week(k, '2026-11-02')!.produced);
      expect(w.erp[k]).toBe(P.productionWeek2Nov.value[k]);
      expect(w.rule[k]).toBe(w.moulds[k] * w.productionDays[k] * P.cyclesPerMouldPerDay.value);
      expect(w.twin[k]).toBe(w.rule[k]);
    }
    expect(sumSku(w.diff)).toBe(sumSku(w.twin) - sumSku(w.erp));
    expect(Math.abs(sumSku(w.diff))).toBeLessThanOrEqual(1);
  });
});

describe('rejected readings and conflicts', () => {
  it('runs each rejected reading and finds fewer tanks than NTG reports', () => {
    expect(v.rejected.map((r) => r.id)).toEqual(['tripsOnTop', 'pausesOnTop', 'bothInChamber', 'perLayer']);
    for (const r of v.rejected) {
      expect(r.run.total).toBeLessThan(sumSku(P.tanksPerShift.value));
      expect(r.run.cycleMin).toBeGreaterThan(P.armCycleMin.value * 1.05);
    }
  });

  it('keeps every known data conflict on the page, with its inventory note', () => {
    const ids = v.conflicts.map((c) => c.id);
    for (const id of ['hours', 'perLayer', 'returns', 'stockList', 'ctt4kg', 'otherHours']) expect(ids).toContain(id);
    for (const c of v.conflicts) {
      expect(c.quotes.length).toBeGreaterThan(0);
      for (const q of c.quotes) expect(q.text.length).toBeGreaterThan(3);
      expect(c.statement).toMatch(/\d/);
    }
    const h = week('HTT2', '2026-11-02')!;
    expect(h.opening + h.produced - h.sold + h.returns).toBe(h.closing);
  });

  it('says field timing is pending', () => {
    expect(FIELD_TIMING.status).toBe('PENDING');
    expect(FIELD_TIMING.rows.length).toBeGreaterThan(3);
  });
});

describe('weekly stock against the band', () => {
  it('uses every week of the ERP history and NTG\'s own minimum and cap', () => {
    for (const k of SKUS) {
      const s = v.stock[k];
      expect(s.weeks.length).toBe(weekly[k].length);
      expect([s.min, s.cap]).toEqual([P.minStock.value[k], P.warehouseCap.value[k]]);
      expect(s.below + s.above + s.weeks.filter((w) => w.state === 'in').length).toBe(s.weeks.length);
      expect(s.below + s.above).toBeGreaterThan(0);
    }
  });

  it('reproduces the inventory count of weeks above the cap (row 105)', () => {
    const row105 = numbers(inventoryRows.find((r) => r.row === 105)!.value);
    SKUS.forEach((k, i) => {
      const full = new Set(fullWeeks(k).map((w) => w.week));
      expect(v.stock[k].weeks.filter((w) => full.has(w.week) && w.state === 'above').length).toBe(row105[3 + i]);
      // Row 105 counts a week as below the minimum if stock dipped under it on any day.
      expect(fullWeeks(k).filter((w) => w.lowest < w.min).length).toBe(row105[i]);
    });
  });
});

describe('assumptions register', () => {
  const rows = assumptions();
  it('gives every entry an alternative, a reason, a use and a way to replace it', () => {
    expect(rows.length).toBeGreaterThanOrEqual(30);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    for (const r of rows) {
      expect(r.alternative.length, r.id).toBeGreaterThan(25);
      expect(r.why.length, r.id).toBeGreaterThan(60);
      expect(r.usedIn.length, r.id).toBeGreaterThan(5);
      expect(r.replace.length, r.id).toBeGreaterThan(5);
      expect(['N', 'V', 'C', 'S']).toContain(r.tag);
      expect(GROUPS).toContain(r.group);
      for (const n of r.rows) expect(inventoryRows.some((x) => x.row === n), `${r.id} row ${n}`).toBe(true);
      expect(`${r.value}${r.alternative}${r.why}`, r.id).not.toMatch(/undefined|NaN/);
    }
  });

  it('tags the two decisions the team settled on 21 Nov as visit facts', () => {
    for (const id of ['A2', 'A14']) {
      const r = rows.find((x) => x.id === id)!;
      expect(r.tag).toBe('V');
      expect(r.source).toBe('team (H), 21 Nov 2026');
    }
  });

  it('has a one-line form of the five main assumptions', () => {
    expect(MAIN_ASSUMPTIONS.length).toBe(5);
    for (const id of MAIN_ASSUMPTIONS) {
      const r = rows.find((x) => x.id === id)!;
      expect(r.brief, id).toBeTruthy();
      expect(r.brief!.length, id).toBeLessThan(130);
    }
  });

  it('keeps the IDs the code cites', () => {
    const ids = rows.map((r) => r.id);
    for (const id of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12']) expect(ids).toContain(id);
  });

  it('matches docs/ASSUMPTIONS.md', () => {
    const path = 'docs/ASSUMPTIONS.md';
    const md = assumptionsMarkdown();
    if (process.env.UPDATE_DOCS) writeFileSync(path, md);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(md);
  });

  it('matches docs/MODEL.md', () => {
    const path = 'docs/MODEL.md';
    const md = modelMarkdown();
    if (process.env.UPDATE_DOCS) writeFileSync(path, md);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(md);
    expect(md).not.toMatch(/undefined|NaN/);
  });

  it('matches docs/VALIDATION.md', () => {
    const path = 'docs/VALIDATION.md';
    const md = validationMarkdown();
    if (process.env.UPDATE_DOCS) writeFileSync(path, md);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(md);
    expect(md).not.toMatch(/undefined|NaN/);
    for (const c of v.conflicts) expect(md).toContain(c.title);
    for (const r of v.rejected) expect(md).toContain(r.setting);
    expect(md).toContain('Field timing: PENDING');
  });

  it('has an owner guide that covers moving around the plant and the Sources switch', () => {
    const guide = readFileSync('docs/OWNER_GUIDE.md', 'utf8');
    expect(guide).toMatch(/drag/i);
    expect(guide).toMatch(/Reset view/);
    expect(guide).toMatch(/Sources/);
    expect(guide).toMatch(/AI assistance/);
  });
});

describe('redesign figures the pages rely on', () => {
  const results = SCENARIOS.map((s) => evaluateWeek(s));
  it('has the same oven visits on every day of every scenario', () => {
    expect(new Set(results.flatMap((r) => r.runs.map((x) => x.kpis.ovenVisits))).size).toBe(1);
  });
  it('recommends a scenario that is in the list', () => {
    expect(SCENARIOS.map((s) => s.id)).toContain(recommend(results).id);
  });
  it('states the same rule on the page as recommend() applies', () => {
    expect(rulePick(results)).toBe(recommend(results).id);
    expect(ruleChecks(results).find((c) => c.id === BASELINE_ID)!.armDaysOk).toBe(true);
    // Drop each scenario in turn: the restated rule must still agree with the code.
    for (const r of results) {
      const rest = results.filter((x) => x !== r);
      expect(rulePick(rest)).toBe(recommend(rest).id);
    }
  });
  it('counts mould changes between days', () => {
    for (const s of SCENARIOS) expect(mouldChanges(s)).toBeGreaterThanOrEqual(0);
    expect(mouldChanges({ ...SCENARIOS[0]!, days: [SCENARIOS[0]!.days[0]!, SCENARIOS[0]!.days[0]!] })).toBe(0);
  });
});
