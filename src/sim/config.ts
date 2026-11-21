/**
 * Default simulator configuration, built from the inventory (src/data/params.ts).
 * No number is typed here except through `P` (inventory) or `assumed` (logged, tag S).
 */
import { P, assumed, SKUS, type Sku } from '../data/params';
import type { ArmSetup, MouldKind, SimConfig, StationId } from './types';

/** NTG's typical shift (inventory rows 49 to 50): 1 CTT4 + 2 CTT2 + 2 HTT2 moulds; the fourth arm on other products. */
export function typicalArms(): ArmSetup[] {
  const m = P.mouldsPerArm.value;
  const fill = (k: Sku): MouldKind[] => Array.from({ length: m[k] }, () => k);
  return [{ moulds: ['OTHER'] }, { moulds: fill('CTT4') }, { moulds: fill('CTT2') }, { moulds: fill('HTT2') }];
}

export function defaultConfig(): SimConfig {
  const cap = assumed.hopperCapacityKg.value;
  return {
    arms: typicalArms(),
    shiftMin: P.shiftHours.value * 60,
    times: {
      load: P.loadMin.value,
      ovenVisit: P.ovenVisitMin.value,
      layerPause: P.layerPauseMin.value,
      air: P.airCoolMin.value,
      water: P.waterCoolMin.value,
      demouldWait: P.demouldWaitMin.value,
      demould: P.demouldMin.value,
      index: assumed.indexMin.value,
      finishing: P.finishingMin.value,
    },
    // H, 21 Nov: for layers 2 and 3 the arm leaves the oven and goes back to where layer 1 was fed.
    layerMode: 'returnToLoad',
    pausesInsideVisit: true,
    // H, 21 Nov: those trips are inside the 28.5 min the team timed.
    tripsInsideVisit: true,
    cooling: 'airAtOpenPosition',
    endOfShift: 'finishWip',
    layerKg: { CTT4: P.layerKg.CTT4.value, CTT2: P.layerKg.CTT2.value, HTT2: P.layerKg.HTT2.value },
    layers: 3,
    jitter: 0,
    raw: {
      siloCapacityKg: P.siloCapacityT.value * 1000,
      siloStartFill: assumed.siloStartFill.value,
      grindRateKgH: P.grindRateKgH.value,
      // Two hoppers on the platform: one for the outer layer, one split between foam and inner (assumption A12).
      hopperCapacityKg: [cap, cap / 2, cap / 2],
      hopperRefillBelowKg: assumed.hopperRefillBelowKg.value,
      binKg: assumed.binKg.value,
      binTripMin: assumed.binTripMin.value,
      pigmentDose: P.pigmentDose.value,
      foamDose: P.foamDose.value,
    },
    oven: { setC: P.ovenTempC.value, doorDipC: assumed.ovenDoorDipC.value, tauMin: assumed.ovenRecoverTauMin.value },
  };
}

export function ringFor(cfg: Pick<SimConfig, 'cooling'>): StationId[] {
  return cfg.cooling === 'airAtOpenPosition'
    ? ['load', 'oven', 'air', 'chamber', 'demould']
    : ['load', 'wait', 'oven', 'chamber', 'demould'];
}

/** How many moulds of each kind an arm may carry (inventory row 31). An arm takes one 4,000 L mould or two 2,000 L moulds. */
export function armLoadOk(moulds: MouldKind[]): boolean {
  if (moulds.length === 0) return true;
  if (moulds.includes('OTHER')) return moulds.length === 1;
  if (moulds.includes('CTT4')) return moulds.length === P.mouldsPerArm.value.CTT4;
  return moulds.length <= P.mouldsPerArm.value.CTT2;
}

/** NTG planning rule (inventory row 57): each mould makes 4 tanks a day. */
export function plannedTanks(arms: ArmSetup[]): Record<Sku, number> {
  const out = { CTT4: 0, CTT2: 0, HTT2: 0 };
  for (const a of arms) for (const m of a.moulds) if (m !== 'OTHER') out[m] += P.cyclesPerMouldPerDay.value;
  return out;
}

export const STATION_LABEL: Record<StationId, string> = {
  load: 'Loading',
  wait: 'Waiting position',
  oven: 'Oven',
  air: 'Air cooling',
  chamber: 'Cooling chamber',
  demould: 'Demould',
};

export const ARM_OPTIONS: { id: string; label: string; moulds: MouldKind[] }[] = [
  { id: 'CTT4', label: 'CTT4 x 1', moulds: ['CTT4'] },
  { id: 'CTT2x2', label: 'CTT2 x 2', moulds: ['CTT2', 'CTT2'] },
  { id: 'HTT2x2', label: 'HTT2 x 2', moulds: ['HTT2', 'HTT2'] },
  { id: 'CTT2+HTT2', label: 'CTT2 + HTT2', moulds: ['CTT2', 'HTT2'] },
  { id: 'CTT2', label: 'CTT2 x 1', moulds: ['CTT2'] },
  { id: 'HTT2', label: 'HTT2 x 1', moulds: ['HTT2'] },
  { id: 'OTHER', label: 'Other product', moulds: ['OTHER'] },
  { id: 'EMPTY', label: 'No mould', moulds: [] },
];

export function armOptionId(moulds: MouldKind[]): string {
  const key = [...moulds].sort().join('+');
  return ARM_OPTIONS.find((o) => [...o.moulds].sort().join('+') === key)?.id ?? 'EMPTY';
}

export { SKUS };
