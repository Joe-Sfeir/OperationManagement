import { stageColor } from '../design/tokens';
import { STATION_LABEL } from '../sim/config';
import type { ArmState, MouldKind } from '../sim/types';

/** How a stage is named and coloured in the panels. Colour is never the only cue: the name is always shown. */
export function stageView(a: ArmState, layers: number): { label: string; color: string; waiting: boolean } {
  switch (a.stage) {
    case 'loading':
      return { label: 'Loading powder', color: stageColor.loading, waiting: false };
    case 'waitOven':
      return { label: 'Waiting for oven', color: stageColor.waiting, waiting: true };
    case 'moving':
      return { label: `Indexing to ${STATION_LABEL[a.station].toLowerCase()}`, color: stageColor.indexing, waiting: false };
    case 'heating':
      return { label: a.moulds.includes('OTHER') ? 'In oven' : `In oven, layer ${a.layer} of ${layers}`, color: stageColor.oven, waiting: false };
    case 'layerPause':
      return { label: `Layer ${a.layer} powder going in`, color: stageColor.oven, waiting: false };
    case 'blocked':
      return { label: `Held: ${a.waitFor && a.waitFor !== 'crew' ? STATION_LABEL[a.waitFor].toLowerCase() : 'next position'} is occupied`, color: stageColor.waiting, waiting: true };
    case 'airCooling':
      return { label: 'Cooling in air', color: stageColor.cooling, waiting: false };
    case 'waterCooling':
      return { label: 'Cooling, fan and water', color: stageColor.cooling, waiting: false };
    case 'waitDemould':
      return { label: 'Waiting for the crew', color: stageColor.waiting, waiting: true };
    case 'demoulding':
      return { label: 'Demould and mould prep', color: stageColor.demould, waiting: false };
    default:
      return { label: a.content === 'powder' ? 'Loaded, oven closed' : 'Idle', color: stageColor.indexing, waiting: false };
  }
}

export function mouldsLabel(moulds: MouldKind[]): string {
  if (moulds.length === 0) return 'No mould';
  const counts = new Map<string, number>();
  for (const m of moulds) counts.set(m, (counts.get(m) ?? 0) + 1);
  return [...counts.entries()].map(([k, n]) => `${k === 'OTHER' ? 'Other product' : k}${n > 1 ? ` x ${n}` : ''}`).join(' + ');
}
