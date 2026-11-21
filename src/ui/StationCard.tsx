/** Small detail card for the position the user clicked: what is there now, and the inputs that drive it. */
import { useTwin } from '../app/store';
import { P, assumed, LAYERS, type Datum } from '../data/params';
import { STATION_LABEL } from '../sim/config';
import type { PlantState, SimResult, StationId } from '../sim/types';
import { Button, Num, Panel, fmt, minSec } from './kit';
import { CloseIcon } from './icons';
import { mouldsLabel, stageView } from './stage';

const INPUTS: Record<StationId, { label: string; d: Datum<number>; unit: string }[]> = {
  load: [
    { label: 'Close mould and fill', d: P.loadMin, unit: 'min' },
    { label: 'Wait before the oven, NTG estimate', d: P.waitBeforeOvenMin, unit: 'min' },
  ],
  wait: [{ label: 'Wait before the oven, NTG estimate', d: P.waitBeforeOvenMin, unit: 'min' }],
  oven: [
    { label: 'Oven time per arm visit', d: P.ovenVisitMin, unit: 'min' },
    { label: 'Pause between layers', d: P.layerPauseMin, unit: 'min' },
    { label: 'Arms in the oven at once', d: P.ovenCapacityArms, unit: '' },
    { label: 'Oven set point', d: P.ovenTempC, unit: '°C' },
  ],
  air: [{ label: 'Cooling in air', d: P.airCoolMin, unit: 'min' }],
  chamber: [{ label: 'Fan and water cooling', d: P.waterCoolMin, unit: 'min' }],
  demould: [
    { label: 'Wait for the crew, NTG estimate', d: P.demouldWaitMin, unit: 'min' },
    { label: 'Demould and mould prep', d: P.demouldMin, unit: 'min' },
    { label: 'Finishing, per tank', d: P.finishingMin, unit: 'min' },
    { label: 'Workers at the machine', d: P.workers, unit: '' },
  ],
};

export function StationCard({ state, result }: { state: PlantState; result: SimResult }) {
  const { selected, select } = useTwin();
  if (!selected) return null;
  const here = state.arms.find((a) => a.station === selected && a.stage !== 'moving');
  const v = here ? stageView(here, result.config.layers) : null;
  return (
    <Panel aria-label={`${STATION_LABEL[selected]} details`} className="pointer-events-auto w-full p-3 md:w-72">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-14 font-semibold">{STATION_LABEL[selected]}</h2>
        <Button aria-label="Close details" onClick={() => select(null)} className="!px-1.5">
          <CloseIcon />
        </Button>
      </header>
      <p className="text-12">
        {here && v ? (
          <>
            <span className="font-medium">Arm {here.id + 1}</span> <span className="text-textMuted">({mouldsLabel(here.moulds)})</span>: {v.label.toLowerCase()},{' '}
            <span className="num">{minSec(v.waiting && here.stage !== 'waitDemould' ? here.waitingMin : here.stageRemainingMin)}</span>{' '}
            {v.waiting && here.stage !== 'waitDemould' ? 'waiting' : 'left'}.
          </>
        ) : (
          <span className="text-textMuted">No arm here at this minute.</span>
        )}
      </p>
      {selected === 'oven' && (
        <p className="mt-1 text-12 text-textMuted">
          Oven air <span className="num text-text">{Math.round(state.oven.tempC)}</span> °C. Curve shape is illustrative.
        </p>
      )}
      {selected === 'load' && (
        <p className="mt-1 text-12 text-textMuted">
          Hoppers:{' '}
          {LAYERS.map((l, i) => (
            <span key={l}>
              {i > 0 && ', '}
              {l.toLowerCase()} <span className="num text-text">{fmt(state.hopperKg[i]!)}</span> kg
            </span>
          ))}
          . Dosed so far <span className="num text-text">{fmt(state.loading.kgDosedTotal)}</span> kg.
        </p>
      )}
      <dl className="mt-2 grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 border-t border-hairline pt-2 text-12">
        {INPUTS[selected].map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-textMuted">{r.label}</dt>
            <dd className="text-right">
              <Num size="12" value={r.d.value} unit={r.unit} datum={r.d} />
            </dd>
          </div>
        ))}
        <dt className="text-textMuted">Arm move between positions</dt>
        <dd className="text-right">
          <Num size="12" value={assumed.indexMin.value} unit="min" datum={assumed.indexMin} />
        </dd>
      </dl>
    </Panel>
  );
}
