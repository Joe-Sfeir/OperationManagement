/**
 * Plan page: a weekly production plan for CTT4, CTT2 and HTT2 on Machine 3700.
 *
 * One screen: a strip of inputs, the answer for the next week to plan, the
 * plan table, the stock the plan gives, and a small what-if table. The model
 * and its checks live in model.ts; the working behind the page (formulation,
 * manual check, shadow prices) is written up in NOTES.md.
 */
import { useId, useMemo, useState } from 'react';
import { SKUS, type Sku } from '../../data/params';
import { Button, Num, Panel, Segmented } from '../../ui/kit';
import { armDaysMax, defaultSettings, hasPlan, startValues, weekOneMonday, type DemandKey, type PlanSettings, type StartKey } from './model';
import { Control, NumberField, Slider } from './parts';
import { armDaysBadge, openingBadge, penaltyBadge, pipelineBadge } from './provenance';
import { AnswerSection, ChartsSection, PlanTableSection, WhatIfSection, type View } from './sections';
import { usePlan } from './usePlan';

function Inputs({ settings, patch, reset }: { settings: PlanSettings; patch: (p: Partial<PlanSettings>) => void; reset: () => void }) {
  const uid = useId();
  const [more, setMore] = useState(false);
  const armBadge = armDaysBadge(settings);
  const penBadge = penaltyBadge(settings);
  const setSku = (field: 'openingStock' | 'pipeline', k: Sku, v: number) => patch({ [field]: { ...settings[field], [k]: v } });
  const perTank = (field: 'openingStock' | 'pipeline', name: string) =>
    SKUS.map((k) => {
      const b = field === 'openingStock' ? openingBadge(settings, k) : pipelineBadge(settings, k);
      return (
        <label key={k} className="inline-flex items-center gap-1.5 text-12 text-textMuted">
          {k}
          <Num value={<NumberField label={`${name}, ${k}`} value={settings[field][k]} max={9999} onCommit={(v) => setSku(field, k, v)} />} tag={b.tag} title={b.title} />
        </label>
      );
    });

  return (
    <Panel className="p-4" aria-label="Inputs">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
        <Control label="Weeks to plan">
          <Segmented label="Weeks to plan" value={settings.weeks} onChange={(weeks) => patch({ weeks })} options={[4, 5, 6, 7, 8].map((n) => ({ value: n, label: String(n) }))} />
        </Control>

        <Control label="Demand each week">
          <Segmented<DemandKey>
            label="Demand each week"
            value={settings.demand}
            onChange={(demand) => patch({ demand })}
            options={[
              { value: 'mean', label: 'Average' },
              { value: 'busy', label: 'Busy week' },
              { value: 'meanPlusSd', label: 'Average +1 sd' },
            ]}
          />
        </Control>

        <Control label="Demand level" htmlFor={`${uid}-pct`}>
          <Slider id={`${uid}-pct`} min={50} max={150} step={5} value={settings.demandPct} onChange={(demandPct) => patch({ demandPct })} />
          <span className="min-w-[3.5rem]">
            <Num value={settings.demandPct} unit="%" tag="S" title="Set on this page. 100 % leaves the chosen demand as it is." />
          </span>
        </Control>

        <Control label="Arm-days for the three tanks" htmlFor={`${uid}-arm`}>
          <Slider id={`${uid}-arm`} min={0} max={armDaysMax} step={1} value={settings.armDays} onChange={(armDays) => patch({ armDays })} />
          <span className="min-w-[4.5rem]">
            <Num value={settings.armDays} unit={`of ${armDaysMax}`} tag={armBadge.tag} title={armBadge.title} />
          </span>
        </Control>

        <Control label="Minimum stock">
          <Segmented
            label="Minimum stock"
            value={settings.floor}
            onChange={(floor) => patch({ floor })}
            options={[
              { value: 'soft', label: 'Flexible' },
              { value: 'strict', label: 'Strict' },
            ]}
          />
        </Control>

        <div className="ml-auto self-end">
          <Button aria-expanded={more} aria-controls={`${uid}-more`} onClick={() => setMore((m) => !m)}>
            {more ? 'Fewer settings' : 'More settings'}
          </Button>
        </div>
      </div>

      {more && (
        <div id={`${uid}-more`} className="mt-4 flex flex-wrap items-start gap-x-8 gap-y-3 border-t border-hairline pt-4">
          <Control label="Start from">
            <Segmented<StartKey>
              label="Start from"
              value={settings.start}
              onChange={(start) => patch({ start, ...startValues(start) })}
              options={[
                { value: 'form6Nov', label: '6 Nov stock' },
                { value: 'latestErp', label: 'Latest ERP stock' },
              ]}
            />
          </Control>
          <Control label="Stock at the start">{perTank('openingStock', 'Stock at the start')}</Control>
          <Control label="Already planned, in stock in week 1">{perTank('pipeline', 'Already planned for week 1')}</Control>
          <Control label="Warehouse cap">
            <Segmented
              label="Warehouse cap"
              value={settings.capOn ? 'on' : 'off'}
              onChange={(v) => patch({ capOn: v === 'on' })}
              options={[
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
              ]}
            />
          </Control>
          <Control label="Keep low">
            <Segmented
              label="Keep low"
              value={settings.objective}
              onChange={(objective) => patch({ objective })}
              options={[
                { value: 'hours', label: 'Machine time' },
                { value: 'cost', label: 'Cost' },
              ]}
            />
          </Control>
          <Control label="Penalty per tank-week below minimum" htmlFor={`${uid}-pen`}>
            <Num value={<NumberField id={`${uid}-pen`} label="Penalty per tank-week below the minimum, in arm-hours" value={settings.penaltyHours} min={0} max={1000} onCommit={(penaltyHours) => patch({ penaltyHours })} />} unit="arm-hours" tag={penBadge.tag} title={penBadge.title} />
          </Control>
          <div className="ml-auto self-end">
            <Button onClick={reset}>Reset to NTG's numbers</Button>
          </div>
        </div>
      )}
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
  const planned = view !== null && hasPlan(view.result.integer);

  return (
    <div className="mx-auto max-w-[1520px] p-4 md:p-6">
      <header className="mb-4">
        <h1 className="text-28 font-medium">Weekly plan</h1>
        <p className="mt-1 max-w-[100ch] text-14 text-textMuted">How many of each tank should Machine 3700 make each week to keep stock above the minimum using the least machine time?</p>
      </header>

      <div className="grid grid-cols-1 gap-4">
        <Inputs settings={settings} patch={patch} reset={() => setSettings(defaultSettings())} />

        <div aria-busy={busy} className={`grid grid-cols-1 gap-4 transition-opacity duration-200 ease-machine ${busy && view ? 'opacity-70' : 'opacity-100'}`}>
          <AnswerSection view={view} phase={state.phase} error={state.error} onFix={patch} />
          {view && planned && (
            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]">
              <PlanTableSection view={view} />
              <div className="grid grid-cols-1 gap-4">
                <ChartsSection view={view} />
                <WhatIfSection view={view} cells={state.cells} pending={state.cellsPending} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
