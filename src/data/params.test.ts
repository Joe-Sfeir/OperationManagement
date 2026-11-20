import { describe, expect, it } from 'vitest';
import { P, inventoryRows, numbers } from './params';
import { dailyOutputHistogram, fullWeeks, week } from './history';

describe('inventory loader', () => {
  it('reads every row of the Inventory sheet', () => {
    expect(inventoryRows.length).toBe(119);
    expect(new Set(inventoryRows.map((r) => r.tag))).toEqual(new Set(['N', 'V', 'C', 'S']));
  });

  it('parses composite cells', () => {
    expect(numbers('40 / 22 / 25 (total 87)')).toEqual([40, 22, 25, 87]);
    expect(P.layerKg.CTT4.value).toEqual([40, 22, 25]);
    expect(P.layerKg.CTT2.value).toEqual([30, 15, 15]);
    expect(P.layerKg.HTT2.value).toEqual([36, 15, 15]);
    expect(P.mouldsPerArm.value).toEqual({ CTT4: 1, CTT2: 2, HTT2: 2 });
    expect(P.tanksPerShift.value).toEqual({ CTT4: 4, CTT2: 8, HTT2: 8 });
    expect(P.planKgPerTank.value).toEqual({ CTT4: 90, CTT2: 60, HTT2: 66 });
    expect(P.minStock.value).toEqual({ CTT4: 15, CTT2: 50, HTT2: 70 });
    expect(P.warehouseCap.value).toEqual({ CTT4: 40, CTT2: 120, HTT2: 140 });
    expect(P.pipeline.value).toEqual({ CTT4: 8, CTT2: 4, HTT2: 36 });
    expect(P.unitValueUsd.value).toEqual({ CTT4: 513, CTT2: 281.2, HTT2: 285 });
  });

  it('keeps timings and their provenance', () => {
    expect([P.ovenVisitMin.value, P.ovenVisitMin.tag]).toEqual([28.5, 'V']);
    expect([P.layerPauseMin.value, P.layerPauseMin.tag]).toEqual([1.5, 'N']);
    expect([P.airCoolMin.value, P.waterCoolMin.value]).toEqual([18, 25]);
    expect([P.demouldWaitMin.value, P.demouldMin.value, P.demouldMin.tag]).toEqual([8, 12, 'S']);
    expect([P.loadMin.value, P.armCycleMin.value]).toEqual([1, 120]);
    expect(P.shiftHours.value * 60).toBe(510);
    expect([P.arms.value, P.positions.value, P.cyclesPerMouldPerDay.value]).toEqual([4, 5, 4]);
    expect(P.ovenTempC.tag).toBe('S');
  });
});

describe('ERP history', () => {
  it('reproduces the Form 1 week of 2 to 6 Nov', () => {
    expect(week('CTT4', '2026-11-02')?.produced).toBe(P.productionWeek2Nov.value.CTT4);
    expect(week('CTT2', '2026-11-02')?.produced).toBe(P.productionWeek2Nov.value.CTT2);
    expect(week('HTT2', '2026-11-02')?.produced).toBe(P.productionWeek2Nov.value.HTT2);
    expect(fullWeeks('CTT4').length).toBe(45);
  });

  it('shows the usual daily output is moulds x 4 cycles', () => {
    const mode = (s: 'CTT4' | 'CTT2' | 'HTT2') => dailyOutputHistogram(s).sort((a, b) => b.days - a.days)[0]!.qty;
    expect([mode('CTT4'), mode('CTT2'), mode('HTT2')]).toEqual([4, 8, 8]);
  });
});
