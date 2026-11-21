/**
 * Debug page (open with ?debug): the simulator's raw output for the current
 * set-up. KPIs first, then the event log. Useful for checking the model by
 * hand: every row is one event with its simulated minute.
 */
import { useMemo, useState } from 'react';
import { useTwin } from '../app/store';
import { Panel, fmt } from '../ui/kit';
import type { SimEvent } from '../sim/types';

function describe(e: SimEvent): string {
  switch (e.type) {
    case 'move':
      return `Arm ${e.arm + 1} indexes ${e.from} to ${e.to} (${e.dur} min)`;
    case 'load':
      return `Arm ${e.arm + 1} loads, first layer ${fmt(e.kg)} kg (${e.dur} min)`;
    case 'ovenIn':
      return `Arm ${e.arm + 1} enters the oven, cycle ${e.cycle}`;
    case 'layer':
      return `Arm ${e.arm + 1} takes layer ${e.layer}, ${fmt(e.kg)} kg (${e.dur} min)`;
    case 'ovenOut':
      return `Arm ${e.arm + 1} leaves the oven, cycle ${e.cycle}`;
    case 'cool':
      return `Arm ${e.arm + 1} cools in ${e.phase} (${e.dur.toFixed(1)} min)`;
    case 'demould':
      return `Arm ${e.arm + 1} demould starts (${e.dur.toFixed(1)} min)`;
    case 'tankOut':
      return `${e.kind} lifted out of arm ${e.arm + 1}`;
    case 'tankFinished':
      return `${e.kind} finished, into the buffer`;
    case 'binDispatch':
      return `Forklift bin, layer ${e.layer + 1}, ${fmt(e.kg)} kg (${e.dur} min)`;
    case 'grind':
      return `Grinding batch, layer ${e.layer + 1}, ${fmt(e.kg)} kg (${e.dur.toFixed(0)} min)`;
  }
}

export function DebugPage() {
  const result = useTwin((s) => s.result);
  const [filter, setFilter] = useState('');
  const rows = useMemo(() => result.events.map((e) => ({ t: e.t, type: e.type, text: describe(e) })), [result]);
  const shown = rows.filter((r) => !filter || r.text.toLowerCase().includes(filter.toLowerCase()) || r.type.includes(filter));
  return (
    <div className="mx-auto grid max-w-[1520px] gap-4 p-4 md:p-6">
      <header>
        <h1 className="text-28 font-medium">Simulator output</h1>
        <p className="text-14 text-textMuted">Raw results for the current set-up. All figures are calculated by the simulator (C).</p>
      </header>
      <Panel className="p-4">
        <h2 className="mb-2 text-14 font-semibold">KPIs</h2>
        <pre className="num overflow-x-auto whitespace-pre-wrap text-12">{JSON.stringify(result.kpis, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v), 2)}</pre>
      </Panel>
      <Panel className="p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-14 font-semibold">
            Event log <span className="num text-12 text-textMuted">{shown.length} of {rows.length}</span>
          </h2>
          <label className="flex items-center gap-2 text-12 text-textMuted">
            Filter
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="arm 2, oven, tank" className="rounded-control border border-hairlineStrong bg-canvas px-2 py-1 text-12 text-text" />
          </label>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-12">
            <thead className="sticky top-0 bg-panel text-left text-textMuted">
              <tr>
                <th scope="col" className="w-24 py-1 pr-3 font-normal">Minute</th>
                <th scope="col" className="w-32 py-1 pr-3 font-normal">Event</th>
                <th scope="col" className="py-1 font-normal">What happened</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i} className="border-t border-hairline">
                  <td className="num py-1 pr-3">{r.t.toFixed(2)}</td>
                  <td className="num py-1 pr-3 text-textMuted">{r.type}</td>
                  <td className="py-1">{r.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
