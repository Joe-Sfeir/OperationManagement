import { describe, expect, it } from 'vitest';
import { P } from '../data/params';
import { SCENARIOS, evaluateWeek, recommend } from './scenarios';

describe('week scenarios', () => {
  const results = SCENARIOS.map((s) => evaluateWeek(s));
  const by = (id: string) => results.find((r) => r.scenario.id === id)!;

  it('reproduces the quantities of the NTG plan for 9 to 13 Nov (rows 86, 90)', () => {
    expect(by('ntg').tanks).toEqual(P.pipeline.value);
    expect(by('ntg').scenario.days.length).toBe(4);
  });

  it('keeps the oven load the same: 16 visits on every four-arm day', () => {
    for (const r of results) for (const run of r.runs) expect(run.kpis.ovenVisits).toBe(16);
  });

  it('prints the comparison', () => {
    for (const r of results)
      console.log(r.scenario.id.padEnd(8), JSON.stringify(r.tanks), 'armDays', r.tankArmDays, 'close', JSON.stringify(r.closingStock), 'band', JSON.stringify(r.band), 'spread', r.coverSpread.toFixed(2), 'runOut', r.maxRunOutMin.toFixed(1));
    console.log(recommend(results));
  });

  it('recommends a scenario that stays inside the stock band', () => {
    const rec = by(recommend(results).id);
    expect(Object.values(rec.band).every((b) => b === 'in')).toBe(true);
  });
});
