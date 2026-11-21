/**
 * Plan page: a weekly production plan for CTT4, CTT2 and HTT2 on Machine 3700.
 *
 * The page keeps the inputs, hands them to model.ts through usePlan (which
 * solves off the render path), and lays the answer out top to bottom: inputs,
 * the plan, stock charts, the re-check, sensitivity, the manual check, how to
 * use it. Every figure wears its source badge; a figure the user has changed
 * shows S, "Entered on this page".
 */
import { useId, useMemo, useState } from 'react';
import { P, SKUS, type Sku } from '../../data/params';
import { Button, Num, Panel, Segmented, fmt, sourceTitle } from '../../ui/kit';
import {
  armDaysMax,
  costPerArmCycle,
  defaultSettings,
  hoursPerArmCycle,
  meanWeeklyReturns,
  scenarioDemand,
  startValues,
  weekOneMonday,
  type DemandKey,
  type PlanSettings,
  type StartKey,
} from './model';
import { Calc, Field, NumberField, SectionHeader, Slider, td, th, weekDates } from './parts';
import { armDaysBadge, demandBadge, openingBadge, penaltyBadge, pipelineBadge, scenarioBadge } from './provenance';
import { ChartsSection, CheckSection, HowToSection, ManualSection, ModelSection, PlanSection, SensitivitySection, type View } from './sections';
import { usePlan } from './usePlan';

const DEMAND_OPTIONS: { key: DemandKey; label: string }[] = [
  { key: 'mean', label: 'Average week' },
  { key: 'busy', label: 'Busy week as 2 to 6 Nov' },
  { key: 'meanPlusSd', label: 'Average +1 standard deviation' },
];

function Inputs({ settings, patch, reset }: { settings: PlanSettings; patch: (p: Partial<PlanSettings>) => void; reset: () => void }) {
  const uid = useId();
  const weekOne = weekOneMonday(settings.start);
  const cycles = settings.armDays * P.cyclesPerMouldPerDay.value;
  const armBadge = armDaysBadge(settings);
  const penBadge = penaltyBadge(settings);
  const dBadge = demandBadge(settings);
  const base = scenarioDemand(settings.demand);
  const setSku = (field: 'openingStock' | 'pipeline', k: Sku, v: number) => patch({ [field]: { ...settings[field], [k]: v } });

  return (
    <Panel className="p-4" aria-labelledby={`${uid}-title`}>
      <SectionHeader
        id={`${uid}-title`}
        title="Inputs"
        note="NTG's own numbers are filled in. Change any of them to try a different week. The plan below follows at once."
        action={<Button onClick={reset}>Reset to NTG's numbers</Button>}
      />
      <div className="grid gap-x-10 gap-y-6 xl:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]">
        <div className="grid content-start gap-4">
          <Field label="Weeks to plan" hint={`Week 1 is ${weekDates(weekOne, 1)}. The last week is ${weekDates(weekOne, settings.weeks)}.`}>
            <Segmented label="Weeks to plan" value={settings.weeks} onChange={(weeks) => patch({ weeks })} options={[4, 5, 6, 7, 8].map((n) => ({ value: n, label: String(n) }))} />
          </Field>

          <Field
            label="Start from"
            hint={
              settings.start === 'form6Nov'
                ? "Stock NTG reported for Friday 6 Nov, with NTG's own plan for 9 to 13 Nov as the tanks already planned."
                : 'Closing stock of the last week in the ERP stock cards. Nothing is on file as already planned for the week after, so type it in the table.'
            }
          >
            <Segmented<StartKey>
              label="Start from"
              value={settings.start}
              onChange={(start) => patch({ start, ...startValues(start) })}
              options={[
                { value: 'form6Nov', label: 'Stock on 6 Nov' },
                { value: 'latestErp', label: 'Latest ERP stock' },
              ]}
            />
          </Field>

          <Field label="Demand each week">
            <fieldset>
              <legend className="sr-only">Demand each week</legend>
              {DEMAND_OPTIONS.map((o) => {
                const v = scenarioDemand(o.key);
                const b = scenarioBadge(o.key);
                return (
                  <label key={o.key} className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-0.5 py-1">
                    <span className="inline-flex items-center gap-2">
                      <input type="radio" name={`${uid}-demand`} checked={settings.demand === o.key} onChange={() => patch({ demand: o.key })} className="h-4 w-4 accent-text" />
                      <span className="text-14">{o.label}</span>
                    </span>
                    <span className="text-textMuted">
                      <Num size="12" value={SKUS.map((k) => fmt(v[k], 1)).join(' / ')} tag={b.tag} title={b.title} />
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <label htmlFor={`${uid}-pct`} className="text-12 text-textMuted">
                Demand level
              </label>
              <Slider id={`${uid}-pct`} min={50} max={150} step={5} value={settings.demandPct} onChange={(demandPct) => patch({ demandPct })} />
              <Num value={settings.demandPct} unit="%" tag="S" title="Set on this page. 100 % leaves the chosen demand as it is." />
            </div>
          </Field>

          <Field
            label="Arm-days for the three tanks"
            htmlFor={`${uid}-arm`}
            hint={
              <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                That is
                <Calc size="12" value={fmt(cycles)} unit="arm-cycles" title="Arm-days x cycles per mould per day" />
                or
                <Calc size="12" value={fmt(cycles * hoursPerArmCycle)} unit="arm-hours a week," title="Arm-cycles x 2 h per arm-cycle" />
                at
                <Num size="12" value={P.cyclesPerMouldPerDay.value} unit="cycles a day" datum={P.cyclesPerMouldPerDay} />
                and
                <Num size="12" value={hoursPerArmCycle} unit="h per arm-cycle." title={sourceTitle(P.armCycleMin)} tag={P.armCycleMin.tag} />
                Other products take the rest of the machine.
              </span>
            }
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Slider id={`${uid}-arm`} min={0} max={armDaysMax} step={1} value={settings.armDays} onChange={(armDays) => patch({ armDays })} />
              <Num value={settings.armDays} unit={`of ${armDaysMax} arm-days a week`} tag={armBadge.tag} title={armBadge.title} />
            </div>
          </Field>

          <Field
            label="Minimum stock"
            hint={
              settings.floor === 'soft' ? (
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <label htmlFor={`${uid}-pen`}>NTG calls the minimum a flexible target. Each tank below it for a week counts as</label>
                  <Num size="12" value={<NumberField id={`${uid}-pen`} label="Penalty per tank-week below the minimum, in arm-hours" value={settings.penaltyHours} min={0} max={1000} step={1} onCommit={(penaltyHours) => patch({ penaltyHours })} />} unit="arm-hours." tag={penBadge.tag} title={penBadge.title} />
                </span>
              ) : (
                'Stock may never go below the minimum. If that cannot be done the page says why.'
              )
            }
          >
            <Segmented
              label="Minimum stock"
              value={settings.floor}
              onChange={(floor) => patch({ floor })}
              options={[
                { value: 'soft', label: 'Flexible target' },
                { value: 'strict', label: 'Strict floor' },
              ]}
            />
          </Field>

          <Field label="Warehouse cap" hint={settings.capOn ? 'Stock of each tank may not go above its cap.' : 'The plan may stock any number of tanks.'}>
            <Segmented
              label="Warehouse cap"
              value={settings.capOn ? 'on' : 'off'}
              onChange={(v) => patch({ capOn: v === 'on' })}
              options={[
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
              ]}
            />
          </Field>

          <Field
            label="Keep low"
            hint={
              settings.objective === 'cost' ? (
                <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  Per arm-cycle:
                  <Num size="12" value={fmt(P.dieselCostPerArmCycle.value, 2)} unit="USD diesel" datum={P.dieselCostPerArmCycle} />
                  and
                  <Num size="12" value={fmt(P.electricityCostPerArmCycle.value, 2)} unit="USD electricity." datum={P.electricityCostPerArmCycle} />
                  Holding cost is in the table.
                  {settings.floor === 'soft' && (
                    <>
                      The penalty in money is
                      <Calc size="12" value={fmt((settings.penaltyHours * costPerArmCycle) / hoursPerArmCycle, 2)} unit="USD per tank-week." title="Penalty in arm-hours x (diesel + electricity per arm-cycle) / 2 h per arm-cycle" />
                    </>
                  )}
                </span>
              ) : (
                'Arm-hours of Machine 3700 spent on the three tanks.'
              )
            }
          >
            <Segmented
              label="Keep low"
              value={settings.objective}
              onChange={(objective) => patch({ objective })}
              options={[
                { value: 'hours', label: 'Machine time' },
                { value: 'cost', label: 'Cost' },
              ]}
            />
          </Field>
        </div>

        <div className="min-w-0">
          <h3 className="text-14 font-semibold">Numbers the plan uses</h3>
          <p className="mt-1 text-12 text-textMuted">The letter beside a number says where it comes from: N from NTG, V seen on the visit, C calculated, S an estimate or entered here. Rest the pointer on it for the source.</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-14">
              <caption className="sr-only">Inputs for each tank</caption>
              <thead>
                <tr>
                  <th scope="col" className={`${th} px-1.5 text-left sm:px-2`}>
                    Tanks
                  </th>
                  {SKUS.map((k) => (
                    <th key={k} scope="col" className={`${th} px-1.5 text-right sm:px-2`}>
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" className={`${td} px-1.5 text-left font-normal sm:px-2`}>
                    Stock at the start
                  </th>
                  {SKUS.map((k) => {
                    const b = openingBadge(settings, k);
                    return (
                      <td key={k} className={`${td} px-1.5 text-right sm:px-2`}>
                        <Num value={<NumberField label={`Stock at the start, ${k}`} value={settings.openingStock[k]} max={9999} onCommit={(v) => setSku('openingStock', k, v)} />} tag={b.tag} title={b.title} />
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <th scope="row" className={`${td} px-1.5 text-left font-normal sm:px-2`}>
                    Already planned, in stock in week 1
                  </th>
                  {SKUS.map((k) => {
                    const b = pipelineBadge(settings, k);
                    return (
                      <td key={k} className={`${td} px-1.5 text-right sm:px-2`}>
                        <Num value={<NumberField label={`Already planned for week 1, ${k}`} value={settings.pipeline[k]} max={9999} onCommit={(v) => setSku('pipeline', k, v)} />} tag={b.tag} title={b.title} />
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <th scope="row" className={`${td} px-1.5 text-left font-normal sm:px-2`}>
                    Sold each week
                  </th>
                  {SKUS.map((k) => (
                    <td key={k} className={`${td} px-1.5 text-right sm:px-2`}>
                      <Num value={fmt((base[k] * settings.demandPct) / 100, 1)} tag={dBadge.tag} title={dBadge.title} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={`${td} px-1.5 text-left font-normal sm:px-2`}>
                    Returned each week
                  </th>
                  {SKUS.map((k) => (
                    <td key={k} className={`${td} px-1.5 text-right sm:px-2`}>
                      <Num value={fmt(meanWeeklyReturns.value[k], 2)} tag="C" title={`${meanWeeklyReturns.label}. ${meanWeeklyReturns.source}`} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={`${td} px-1.5 text-left font-normal sm:px-2`}>
                    Minimum stock
                  </th>
                  {SKUS.map((k) => (
                    <td key={k} className={`${td} px-1.5 text-right sm:px-2`}>
                      <Num value={P.minStock.value[k]} datum={P.minStock} />
                    </td>
                  ))}
                </tr>
                <tr className={settings.capOn ? '' : 'opacity-50'}>
                  <th scope="row" className={`${td} px-1.5 text-left font-normal sm:px-2`}>
                    Warehouse cap{settings.capOn ? '' : ' (off)'}
                  </th>
                  {SKUS.map((k) => (
                    <td key={k} className={`${td} px-1.5 text-right sm:px-2`}>
                      <Num value={P.warehouseCap.value[k]} datum={P.warehouseCap} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={`${td} px-1.5 text-left font-normal sm:px-2`}>
                    Tanks per arm-cycle
                  </th>
                  {SKUS.map((k) => (
                    <td key={k} className={`${td} px-1.5 text-right sm:px-2`}>
                      <Num value={P.mouldsPerArm.value[k]} datum={P.mouldsPerArm} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={`${td} px-1.5 text-left font-normal sm:px-2 ${settings.objective === 'cost' ? '' : 'border-b-0'}`}>
                    Arm-hours per tank
                  </th>
                  {SKUS.map((k) => (
                    <td key={k} className={`${td} px-1.5 text-right sm:px-2 ${settings.objective === 'cost' ? '' : 'border-b-0'}`}>
                      <Calc value={fmt(hoursPerArmCycle / P.mouldsPerArm.value[k], 1)} title="2 h per arm-cycle divided by moulds per arm" />
                    </td>
                  ))}
                </tr>
                {settings.objective === 'cost' && (
                  <tr>
                    <th scope="row" className={`${td} border-b-0 px-1.5 text-left font-normal sm:px-2`}>
                      Holding cost, USD per tank a week
                    </th>
                    {SKUS.map((k) => (
                      <td key={k} className={`${td} border-b-0 px-1.5 text-right sm:px-2`}>
                        <Num value={fmt(P.holdingPerTankWeek.value[k], 2)} datum={P.holdingPerTankWeek} />
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function PlanPage() {
  const [settings, setSettings] = useState<PlanSettings>(defaultSettings);
  const state = usePlan(settings);
  const patch = (p: Partial<PlanSettings>) => setSettings((s) => ({ ...s, ...p }));

  const view = useMemo<View | null>(
    () => (state.result && state.settings ? { result: state.result, settings: state.settings, weekOne: weekOneMonday(state.settings.start) } : null),
    [state.result, state.settings],
  );
  const busy = state.phase === 'solving' || state.phase === 'loading';
  const planned = view !== null && (view.result.integer.status === 'optimal' || view.result.integer.status === 'limit');

  return (
    <div className="mx-auto max-w-[1520px] p-4 md:p-6">
      <header className="mb-4">
        <h1 className="text-28 font-medium">Weekly plan for the three tanks</h1>
        <p className="mt-2 max-w-[84ch] text-14 text-textMuted">
          This page works out a production plan for CTT4, CTT2 and HTT2 from the stock, the demand and the machine time you give it. It answers one question:{' '}
          <span className="text-text">how many of each tank should Machine 3700 make each week to keep stock above the minimum using the least machine time?</span>
        </p>
      </header>

      <div className="grid gap-4">
        <Inputs settings={settings} patch={patch} reset={() => setSettings(defaultSettings())} />

        <div aria-busy={busy} className={`grid gap-4 transition-opacity duration-200 ease-machine ${busy && view ? 'opacity-70' : 'opacity-100'}`}>
          <PlanSection view={view} phase={state.phase} error={state.error} onFix={patch} />
          {view && planned && (
            <>
              <ChartsSection view={view} />
              <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <CheckSection view={view} />
                <SensitivitySection view={view} cells={state.cells} cellsPending={state.cellsPending} />
              </div>
            </>
          )}
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <ManualSection manual={state.manual} />
          <HowToSection />
        </div>
        {view && planned && <ModelSection view={view} />}
      </div>
    </div>
  );
}
