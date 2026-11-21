/** Left panel for the raw-material scene: silo and hopper levels, grinding and the forklift bin, from the simulator. */
import { useTwin } from '../app/store';
import { LAYERS, P, assumed } from '../data/params';
import type { PlantState, SimResult } from '../sim/types';
import { Button, Num, Panel, fmt, sourceTitle } from './kit';

export function RawPanel({ state, result }: { state: PlantState; result: SimResult }) {
  const setScene = useTwin((s) => s.setScene);
  const cap = result.config.raw.siloCapacityKg;
  const reorder = assumed.siloReorderFill.value;
  const low = state.siloKg.some((kg) => kg / cap < reorder);
  return (
    <Panel aria-label="Raw material" className="pointer-events-auto w-full p-3 md:w-72">
      <header className="mb-2 flex items-baseline justify-between">
        <h2 className="text-14 font-semibold">Powder</h2>
        <span className="text-12 text-textMuted">one silo per layer</span>
      </header>
      <ul className="grid gap-2.5">
        {LAYERS.map((name, i) => {
          const fill = state.siloKg[i]! / cap;
          const isLow = fill < reorder;
          return (
            <li key={name} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-14 font-medium">Silo {i + 1}</span>
                <span className="truncate text-12 text-textMuted">{isLow ? `${name}, below reorder level` : name}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-12">
                <Num size="12" value={fmt(state.siloKg[i]!)} unit="kg" tag="C" title="Simulated stock: start level, less bins taken, plus powder ground" />
                <span className="text-textMuted">
                  of <Num size="12" value={fmt(cap)} unit="kg" datum={P.siloCapacityT} />
                </span>
              </div>
              <div className="relative h-1.5 rounded-full bg-hairline" role="progressbar" aria-label={`Silo ${i + 1} level`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fill * 100)}>
                {/* Neutral on purpose: amber means heat only (style bible rule 3). Below the mark, the text and the link say so. */}
                <div className="h-full rounded-full bg-steelLight" style={{ width: `${Math.min(1, fill) * 100}%` }} />
                <span className="absolute -top-0.5 h-2.5 w-px bg-textMuted" style={{ left: `${reorder * 100}%` }} title={sourceTitle(assumed.siloReorderFill)} aria-hidden="true" />
              </div>
              <div className="flex items-center justify-between text-12 text-textMuted">
                <span>Hopper at the machine</span>
                <Num size="12" value={fmt(state.hopperKg[i]!)} unit="kg" tag="C" title="Simulated hopper level" />
              </div>
            </li>
          );
        })}
      </ul>
      <dl className="mt-3 grid gap-1 border-t border-hairline pt-2 text-12">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-textMuted">Grinding</dt>
          <dd>{state.grind.active ? `${LAYERS[state.grind.layer]} batch, ${Math.round(state.grind.progress * 100)} %` : 'Idle'}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-textMuted">Forklift bin</dt>
          <dd>{state.bin.active ? `${fmt(state.bin.kg)} kg of ${LAYERS[state.bin.layer]!.toLowerCase()}` : 'Parked'}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-textMuted">Dosed into moulds so far</dt>
          <dd>
            <Num size="12" value={fmt(state.loading.kgDosedTotal)} unit="kg" tag="C" title="Sum of the layer weights of every tank loaded so far" />
          </dd>
        </div>
      </dl>
      <p className="mt-2 border-t border-hairline pt-2 text-12 text-textMuted">
        Raw material is not a bottleneck in NTG's data. The three tanks use about{' '}
        <Num size="12" value={P.weeklyResinT.value} unit="t a week" datum={P.weeklyResinT} /> against roughly <Num size="12" value={P.siloCapacityT.value * 3} unit="t" datum={P.siloCapacityT} /> of silo
        space. Start levels, the bin and the grinding rule are assumptions.
      </p>
      {low && (
        <div className="mt-2 flex items-center justify-between gap-2 text-12">
          <span>A silo is below its reorder level.</span>
          <Button onClick={() => setScene('sourcing')}>Open sourcing</Button>
        </div>
      )}
    </Panel>
  );
}
