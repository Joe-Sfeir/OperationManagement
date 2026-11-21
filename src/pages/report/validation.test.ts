import { describe, expect, it } from 'vitest';
import { P, SKUS } from '../../data/params';
import { FIELD_TIMING, rangeIn, sumSku, threeArmQuantities, triple, validation } from './validation';

describe('report validation figures', () => {
  const v = validation();
  it('prints', () => {
    console.log(JSON.stringify(v.rows.map((r) => [r.metric, r.twin, r.ntg, r.difference, r.verdict, r.words]), null, 1));
    console.log(JSON.stringify(v.identity));
    console.log(JSON.stringify(v.demould.sweep.map((s) => [s.value, s.run.cycleMin, s.run.waitOvenMin, s.run.total, s.run.bottleneck])), v.demould.holdsCycleUpTo, v.demould.waitAtLimit, JSON.stringify(v.demould.firstBroken));
    console.log(JSON.stringify(v.index.sweep.map((s) => [s.value, s.run.cycleMin, s.run.total])));
    console.log(JSON.stringify(v.variation), JSON.stringify(v.crewWaitZero));
    for (const k of SKUS) console.log(JSON.stringify(v.erp[k]));
    console.log(JSON.stringify(v.weekNov2), JSON.stringify(v.weekNov9));
    console.log(JSON.stringify(v.rejected.map((r) => [r.reading, r.setting, r.why]), null, 1));
    console.log(JSON.stringify(v.conflicts, null, 1));
    console.log(JSON.stringify(threeArmQuantities()), FIELD_TIMING.rows, rangeIn('Range 8–30'), sumSku(P.tanksPerShift.value), triple(P.tanksPerShift.value));
  });
});
