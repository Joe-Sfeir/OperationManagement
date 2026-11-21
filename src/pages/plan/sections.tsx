/** Result panels of the Plan page: the answer, the plan table, the stock charts and the what-if table. */
import type { ReactNode } from 'react';
import { P, SKUS, type Sku } from '../../data/params';
import { color } from '../../design/tokens';
import { Button, Num, Panel, fmt, sourceTitle } from '../../ui/kit';
import { WHAT_IF_ARM_DAYS, WHAT_IF_DEMAND_PCT, hasPlan, type PlanResult, type PlanSettings, type WhatIfCell } from './model';
import { Calc, StatusMark, listWeeks, td, th, weekDates } from './parts';
import { StockChart } from './StockChart';
import { pipelineBadge } from './provenance';
import type { PlanState } from './usePlan';

/** A solved plan together with the settings it was solved for. */
export interface View {
  result: PlanResult;
  settings: PlanSettings;
  weekOne: Date;
}

const SHOWN_FROM = 0.05;
const skuAt = (i: number): Sku => SKUS[i]!;

// ---------------------------------------------------------------------------
// The answer
// ---------------------------------------------------------------------------

function SolveStatus({ phase }: { phase: PlanState['phase'] }) {
  const label = phase === 'loading' ? 'Starting the solver' : phase === 'solving' ? 'Solving' : phase === 'error' ? 'Solver stopped' : 'Up to date';
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-2 text-12 text-textMuted">
      <StatusMark kind={phase === 'ready' ? 'pass' : phase === 'error' ? 'fail' : 'idle'} />
      {label}
    </p>
  );
}

function NoPlan({ view, onFix }: { view: View; onFix: (patch: Partial<PlanSettings>) => void }) {
  const { result, settings } = view;
  const d = result.diagnosis;
  return (
    <div role="alert">
      <h2 id="plan-answer" className="flex items-center gap-2 text-28 font-medium">
        <StatusMark kind="fail" />
        No plan fits every rule
      </h2>
      <ul className="mt-2 grid max-w-[80ch] grid-cols-1 gap-1 text-14">
        {(d?.sentences ?? ['The solver found no plan that keeps every rule.']).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {settings.floor === 'strict' && <Button onClick={() => onFix({ floor: 'soft' })}>Make the minimum flexible</Button>}
        {settings.capOn && d?.cap && <Button onClick={() => onFix({ capOn: false })}>Switch the warehouse cap off</Button>}
        {settings.armDays < 20 && <Button onClick={() => onFix({ armDays: Math.min(20, settings.armDays + 2) })}>Give the tanks 2 more arm-days</Button>}
        {(settings.demand !== 'mean' || settings.demandPct !== 100) && <Button onClick={() => onFix({ demandPct: 100, demand: 'mean' })}>Use the average week</Button>}
      </div>
    </div>
  );
}

function Answer({ view }: { view: View }) {
  const { result, settings, weekOne } = view;
  const { input, integer: sol } = result;
  const T = input.weeks;
  const h = input.hoursPerArmCycle;
  const firstBusy = sol.armCyclesByPlan.findIndex((c) => c > 0);
  const nothingYet = (sol.armCyclesByPlan[0] ?? 0) === 0;
  const short: string[] = [];
  input.skus.forEach((k, ki) => {
    const ws = sol.shortage[ki]!.map((s, i) => (s >= SHOWN_FROM ? i + 1 : 0)).filter(Boolean);
    if (ws.length) short.push(`${k.id} in ${listWeeks(ws)}`);
  });
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-4">
        <div className="min-w-0">
          <p className="text-12 text-textMuted">
            Next week to plan: week 2, {weekDates(weekOne, 2)}
          </p>
          <h2 id="plan-answer" className="mt-1 flex flex-wrap items-baseline gap-x-2.5 text-28 font-medium">
            Make
            {input.skus.map((k, ki) => (
              <span key={k.id} className="inline-flex items-baseline gap-x-2">
                <Calc size="28" value={fmt(sol.tanks[ki]![0] ?? 0)} title={`Whole-arm-cycle plan for week 2: ${fmt(sol.n[ki]![0] ?? 0)} arm-cycles x ${k.mouldsPerArm} moulds per arm`} />
                {k.id}
                {ki < input.skus.length - 1 ? ',' : ''}
              </span>
            ))}
          </h2>
          <p className="mt-1 text-12 text-textMuted">
            {nothingYet
              ? firstBusy > 0
                ? `Stock covers week 2. The first tanks are made in week ${firstBusy + 2}.`
                : 'Stock covers the whole plan. Nothing needs making.'
              : `${fmt(sol.armCyclesByPlan[0]!)} arm-cycles, ${fmt(sol.armCyclesByPlan[0]! * h)} of the ${fmt(input.armCycles[0]! * h)} arm-hours that week.`}
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-12 gap-y-3">
          <div>
            <dt className="text-12 text-textMuted">Arm-hours over the plan{T > 2 ? `, weeks 2 to ${T}` : ''}</dt>
            <dd className="mt-1">
              <Calc size="28" value={fmt(sol.totals.hours)} title="Whole-arm-cycle plan: arm-cycles x 2 h per arm-cycle" />
            </dd>
          </div>
          <div>
            <dt className="text-12 text-textMuted">Shortage</dt>
            <dd className="mt-1 flex items-baseline gap-2.5">
              {sol.totals.shortage < SHOWN_FROM ? (
                <span className="text-28">none</span>
              ) : (
                <>
                  <span className="self-center">
                    <StatusMark kind={settings.floor === 'soft' ? 'allowed' : 'fail'} />
                  </span>
                  <Calc size="28" value={fmt(sol.totals.shortage, 1)} unit="tank-weeks below the minimum" title="Sum over tanks and weeks of minimum stock minus stock, where stock is under the minimum" />
                </>
              )}
            </dd>
            {short.length > 0 && <dd className="mt-1 text-12 text-textMuted">{short.join('; ')}</dd>}
          </div>
        </dl>
      </div>
    </>
  );
}

/** One line under the answer: the result of the independent re-check, and any note the reader needs. */
function CheckLine({ view }: { view: View }) {
  const { integer: sol, checks, capRelaxed } = view.result;
  const failed = checks.filter((c) => c.status === 'fail');
  const relaxed = new Map<string, number[]>();
  for (const r of capRelaxed) relaxed.set(r.sku, [...(relaxed.get(r.sku) ?? []), r.week]);
  return (
    <ul className="flex flex-wrap gap-x-8 gap-y-1 text-12 text-textMuted">
      <li className="flex items-center gap-2">
        <StatusMark kind={failed.length ? 'fail' : 'pass'} />
        {failed.length ? `Plan check failed: ${failed.map((c) => c.rule.toLowerCase()).join(', ')}` : 'Plan checked: all rules hold'}
      </li>
      {[...relaxed.entries()].map(([sku, ws]) => (
        <li key={sku} className="flex items-center gap-2">
          <StatusMark kind="allowed" />
          {sku} starts above its cap: cap not applied in {listWeeks(ws)}
        </li>
      ))}
      {sol.status === 'limit' && <li>Solver hit its time limit: best plan found, not proven best</li>}
    </ul>
  );
}

export function AnswerSection({ view, phase, error, onFix }: { view: View | null; phase: PlanState['phase']; error: string | null; onFix: (patch: Partial<PlanSettings>) => void }) {
  let body: ReactNode;
  let status: ReactNode = null;
  if (phase === 'error') {
    body = (
      <p role="alert" id="plan-answer" className="flex items-center gap-2 text-14">
        <StatusMark kind="fail" />
        The solver could not run in this browser: {error}
      </p>
    );
  } else if (!view) {
    body = (
      <p id="plan-answer" className="text-14 text-textMuted">
        Starting the solver.
      </p>
    );
  } else if (!hasPlan(view.result.integer)) {
    body = <NoPlan view={view} onFix={onFix} />;
  } else {
    body = <Answer view={view} />;
    status = <CheckLine view={view} />;
  }
  return (
    <Panel className="p-4" aria-labelledby="plan-answer">
      {body}
      <div className={`flex flex-wrap items-center justify-between gap-x-8 gap-y-1 ${status ? 'mt-4 border-t border-hairline pt-3' : 'mt-3'}`}>
        {status ?? <span />}
        <SolveStatus phase={phase} />
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// The plan table
// ---------------------------------------------------------------------------

function CapacityBar({ used, available }: { used: number; available: number }) {
  const share = available > 0 ? Math.min(1, used / available) : used > 0 ? 1 : 0;
  return (
    <span className="block h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-hairline sm:w-20" aria-hidden="true">
      <span className="block h-full transition-[width] duration-200 ease-machine" style={{ width: `${share * 100}%`, background: color.steelLight }} />
    </span>
  );
}

export function PlanTableSection({ view }: { view: View }) {
  const { result, settings, weekOne } = view;
  const { input, integer: sol } = result;
  const T = input.weeks;
  const h = input.hoursPerArmCycle;
  const capHours = (input.armCycles[0] ?? 0) * h;
  const pipelineCycles = input.skus.reduce((a, k) => a + k.pipeline / k.mouldsPerArm, 0);
  const whole = (x: number) => fmt(x, Number.isInteger(x) ? 0 : 1);
  const week = (t: number, note?: string) => (
    <th scope="row" className={`${td} text-left font-normal`}>
      Week {t} <span className="whitespace-nowrap text-12 text-textMuted">{weekDates(weekOne, t)}</span>
      {note && <span className="block text-12 text-textMuted">{note}</span>}
    </th>
  );
  return (
    <Panel className="p-4" aria-labelledby="plan-table">
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="plan-table" className="text-14 font-semibold">
          Tanks to make each week
        </h2>
        <p className="text-12 text-textMuted">
          <Calc size="12" value={fmt(capHours)} unit="arm-hours a week for the tanks" title="Arm-days x 4 cycles a day x 2 h per arm-cycle" />
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-14">
          <caption className="sr-only">Tanks to make per week and tank, and arm-hours used against the arm-hours available</caption>
          <thead>
            <tr>
              <th scope="col" className={`${th} text-left`}>
                Week
              </th>
              {input.skus.map((k) => (
                <th key={k.id} scope="col" className={`${th} text-right`}>
                  {k.id}
                </th>
              ))}
              <th scope="col" className={`${th} text-right`}>
                Arm-hours
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {week(1, 'already planned')}
              {input.skus.map((k, ki) => {
                const b = pipelineBadge(settings, skuAt(ki));
                return (
                  <td key={k.id} className={`${td} text-right align-top`}>
                    <Num value={whole(k.pipeline)} tag={b.tag} title={b.title} />
                  </td>
                );
              })}
              <td className={`${td} text-right align-top`}>
                <Calc value={whole(pipelineCycles * h)} title="Tanks already planned / moulds per arm x 2 h. Not part of the total below" />
              </td>
            </tr>
            {Array.from({ length: T - 1 }, (_, i) => {
              const used = sol.armCyclesByPlan[i]!;
              const available = input.armCycles[i]!;
              return (
                <tr key={i}>
                  {week(i + 2)}
                  {input.skus.map((k, ki) => (
                    <td key={k.id} className={`${td} text-right`}>
                      <Calc value={fmt(sol.tanks[ki]![i]!)} title={`${fmt(sol.n[ki]![i]!)} arm-cycles x ${k.mouldsPerArm} moulds per arm`} />
                    </td>
                  ))}
                  <td className={td}>
                    <span className="flex items-center justify-end gap-2.5">
                      <CapacityBar used={used} available={available} />
                      <span className="min-w-[2ch] text-right">
                        <Calc value={fmt(used * h)} title={`${fmt(used)} arm-cycles x 2 h, of ${fmt(available * h)} arm-hours available`} />
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className={`${td} border-b-0 text-left font-medium`}>
                Total{T > 2 ? `, weeks 2 to ${T}` : ''}
              </th>
              {input.skus.map((k, ki) => (
                <td key={k.id} className={`${td} border-b-0 text-right`}>
                  <Calc value={fmt(sol.tanks[ki]!.reduce((a, b) => a + b, 0))} title="Sum of the plan" />
                </td>
              ))}
              <td className={`${td} border-b-0 text-right`}>
                <Calc value={fmt(sol.totals.hours)} title="Sum of the plan" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Stock charts
// ---------------------------------------------------------------------------

function LegendItem({ children, sample }: { children: ReactNode; sample: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <svg width="22" height="10" aria-hidden="true" className="shrink-0">
        {sample}
      </svg>
      {children}
    </li>
  );
}

export function ChartsSection({ view }: { view: View }) {
  const { input, integer: sol } = view.result;
  return (
    <Panel className="p-4" aria-labelledby="plan-stock">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="plan-stock" className="text-14 font-semibold">
          Stock at the end of each week
        </h2>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-12 text-textMuted">
          <LegendItem
            sample={
              <>
                <line x1="0" y1="5" x2="22" y2="5" stroke={color.text} strokeWidth="2" />
                <circle cx="11" cy="5" r="3.5" fill={color.text} />
              </>
            }
          >
            Stock
          </LegendItem>
          {input.capOn && <LegendItem sample={<rect x="0" y="0" width="22" height="10" fill={color.hairline} opacity="0.7" />}>Minimum to cap</LegendItem>}
          <LegendItem sample={<rect x="7" y="0" width="8" height="10" fill={color.alertRed} />}>Below the minimum</LegendItem>
        </ul>
      </header>
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-3">
        {input.skus.map((k, ki) => (
          <StockChart
            key={k.id}
            sku={k.id}
            stock={sol.stock[ki]!}
            shortage={sol.shortage[ki]!}
            minStock={k.minStock}
            cap={input.capOn ? k.cap : null}
            limits={
              <>
                <Num size="12" value={k.minStock} unit="minimum" tag={P.minStock.tag} title={sourceTitle(P.minStock)} />
                {input.capOn && <Num size="12" value={k.cap} unit="cap" tag={P.warehouseCap.tag} title={sourceTitle(P.warehouseCap)} />}
              </>
            }
          />
        ))}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// What-if
// ---------------------------------------------------------------------------

export function WhatIfSection({ view, cells, pending }: { view: View; cells: WhatIfCell[] | null; pending: boolean }) {
  const { settings } = view;
  const at = (a: number, d: number) => cells?.find((c) => c.armDays === a && c.demandPct === d);
  return (
    <Panel className="p-4" aria-labelledby="plan-whatif">
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="plan-whatif" className="text-14 font-semibold">
          If capacity or demand were different
        </h2>
        <p className="text-12 text-textMuted">Arm-hours over the plan, then tank-weeks short{pending ? '. Solving' : ''}</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-14">
          <caption className="sr-only">Arm-hours and tank-weeks below the minimum at other arm-days and demand levels</caption>
          <thead>
            <tr>
              <th scope="col" className={`${th} text-left`}>
                Arm-days a week
              </th>
              {WHAT_IF_DEMAND_PCT.map((d) => (
                <th key={d} scope="col" className={`${th} text-right`}>
                  Demand {d} %{settings.demandPct === d ? ' (now)' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WHAT_IF_ARM_DAYS.map((a, row) => (
              <tr key={a}>
                <th scope="row" className={`${td} text-left font-normal ${row === WHAT_IF_ARM_DAYS.length - 1 ? 'border-b-0' : ''}`}>
                  <span className="num">{a}</span>
                  {settings.armDays === a ? ' (now)' : ''}
                </th>
                {WHAT_IF_DEMAND_PCT.map((d) => {
                  const c = at(a, d);
                  const here = settings.armDays === a && settings.demandPct === d;
                  return (
                    <td key={d} className={`${td} text-right ${here ? 'bg-canvas' : ''} ${row === WHAT_IF_ARM_DAYS.length - 1 ? 'border-b-0' : ''}`}>
                      {!c ? (
                        <span className="text-12 text-textFaint">Solving</span>
                      ) : c.status === 'infeasible' ? (
                        <span className="inline-flex items-center gap-2 text-12 text-textMuted">
                          <StatusMark kind="fail" /> No plan: stock runs out
                        </span>
                      ) : c.status === 'error' ? (
                        <span className="text-12 text-textMuted">Not solved</span>
                      ) : (
                        <span className="inline-flex flex-wrap items-center justify-end gap-x-3">
                          <Calc value={fmt(c.hours)} unit="h" title={`Whole-arm-cycle plan at ${a} arm-days and ${d} % demand. Continuous LP: ${fmt(c.lpHours, 1)} h`} />
                          <span className="inline-flex items-center justify-end gap-1.5 sm:min-w-[5.5rem]">
                            {c.shortage >= SHOWN_FROM && <StatusMark kind="allowed" />}
                            <Calc size="12" value={fmt(c.shortage, 1)} title={`Tank-weeks below the minimum. Continuous LP: ${fmt(c.lpShortage, 1)}`} />
                            <span className="hidden text-12 text-textMuted sm:inline">short</span>
                          </span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
