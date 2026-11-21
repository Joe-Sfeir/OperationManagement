/** Result sections of the Plan page: the plan, stock charts, re-check, sensitivity, manual check, how-to, model. */
import type { ReactNode } from 'react';
import { P, SKUS, type Sku } from '../../data/params';
import { color } from '../../design/tokens';
import { Button, Num, Panel, fmt, sourceTitle } from '../../ui/kit';
import {
  DUAL_SHOWN_FROM,
  TIE_BREAK_HOURS,
  WHAT_IF_ARM_DAYS,
  WHAT_IF_DEMAND_PCT,
  hasPlan,
  manualHand,
  manualInput,
  penaltyPerTankWeek,
  type CapacitySensitivity,
  type CheckRow,
  type PlanResult,
  type PlanSettings,
  type PlanSolution,
  type WhatIfCell,
} from './model';
import { Calc, SectionHeader, StatusMark, listWeeks, td, th, weekDates, fridayBefore, type Mark } from './parts';
import { StockChart } from './StockChart';
import { demandBadge, openingBadge, pipelineBadge } from './provenance';
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
// The plan
// ---------------------------------------------------------------------------

export function SolveStatus({ phase }: { phase: PlanState['phase'] }) {
  const label = phase === 'loading' ? 'Starting the solver' : phase === 'solving' ? 'Solving' : phase === 'error' ? 'Solver stopped' : 'Up to date';
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-2 text-12 text-textMuted">
      <StatusMark kind={phase === 'ready' ? 'pass' : phase === 'error' ? 'fail' : 'idle'} />
      {label}
    </p>
  );
}

function Kpi({ label, value, note }: { label: string; value: ReactNode; note: ReactNode }) {
  return (
    <div className="min-w-0 border-t border-hairline pt-3">
      <dt className="text-12 text-textMuted">{label}</dt>
      <dd className="mt-1">{value}</dd>
      <dd className="mt-1 text-12 text-textMuted">{note}</dd>
    </div>
  );
}

function shortWeeksBySku(sol: PlanSolution, result: PlanResult): string[] {
  const out: string[] = [];
  result.input.skus.forEach((k, ki) => {
    const ws = sol.shortage[ki]!.map((s, i) => (s >= SHOWN_FROM ? i + 1 : 0)).filter(Boolean);
    if (ws.length) out.push(`${k.id} in ${listWeeks(ws)}`);
  });
  return out;
}

function NoPlan({ view, onFix }: { view: View; onFix: (patch: Partial<PlanSettings>) => void }) {
  const { result, settings } = view;
  const d = result.diagnosis;
  return (
    <div role="alert" className="rounded-control border border-hairlineStrong p-4">
      <p className="flex items-center gap-2 text-14 font-semibold">
        <StatusMark kind="fail" />
        No plan fits every rule with these inputs
      </p>
      <ul className="mt-2 grid max-w-[80ch] gap-1 text-14">
        {(d?.sentences ?? ['The solver found no plan that keeps every rule.']).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <p className="mt-3 text-12 text-textMuted">What to try:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {settings.floor === 'strict' && <Button onClick={() => onFix({ floor: 'soft' })}>Treat the minimum as a flexible target</Button>}
        {settings.capOn && d?.cap && <Button onClick={() => onFix({ capOn: false })}>Switch the warehouse cap off</Button>}
        {settings.armDays < 20 && <Button onClick={() => onFix({ armDays: Math.min(20, settings.armDays + 2) })}>Give the tanks 2 more arm-days</Button>}
        {settings.demandPct > 50 && <Button onClick={() => onFix({ demandPct: 100, demand: 'mean' })}>Use the average week</Button>}
      </div>
    </div>
  );
}

function CapacityBar({ used, available }: { used: number; available: number }) {
  const share = available > 0 ? Math.min(1, used / available) : used > 0 ? 1 : 0;
  return (
    <span className="mt-1 block h-1.5 w-full min-w-[2.5rem] overflow-hidden rounded-full bg-hairline" aria-hidden="true">
      <span className="block h-full transition-[width] duration-200 ease-machine" style={{ width: `${share * 100}%`, background: color.steelLight }} />
    </span>
  );
}

const cell = `${td} px-1.5 text-right sm:px-2`;
const head = `${th} px-1.5 text-right sm:px-2`;

function IntegerTable({ view }: { view: View }) {
  const { result, settings, weekOne } = view;
  const { input, integer: sol } = result;
  const T = input.weeks;
  const h = input.hoursPerArmCycle;
  const pipelineCycles = input.skus.reduce((a, k) => a + k.pipeline / k.mouldsPerArm, 0);
  const whole = (x: number) => fmt(x, Number.isInteger(x) ? 0 : 1);
  return (
    <div className="min-w-0">
      <h3 className="text-14 font-semibold">Plan to use: whole arm-cycles</h3>
      <p className="mt-1 text-12 text-textMuted">Tanks to make each week, with the arm-cycles under each figure. Week 1 is already planned, so the plan starts in week 2.</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-14">
          <caption className="sr-only">Tanks to make per week and tank, arm-cycles and arm-hours against the arm-hours available</caption>
          <thead>
            <tr>
              <th scope="col" className={`${th} px-1.5 text-left sm:px-2`}>
                Week
              </th>
              {input.skus.map((k) => (
                <th key={k.id} scope="col" className={head}>
                  {k.id}
                </th>
              ))}
              <th scope="col" className={`${head} hidden sm:table-cell`}>
                Arm-cycles
              </th>
              <th scope="col" className={head}>
                Arm-hours
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className={`${td} px-1.5 text-left font-normal sm:px-2`}>
                Week 1<span className="block text-12 text-textMuted">{weekDates(weekOne, 1)}</span>
                <span className="block text-12 text-textMuted">already planned</span>
              </th>
              {input.skus.map((k, ki) => {
                const b = pipelineBadge(settings, skuAt(ki));
                return (
                  <td key={k.id} className={cell}>
                    <Num value={whole(k.pipeline)} tag={b.tag} title={b.title} />
                    <span className="block text-12 text-textMuted">{whole(k.pipeline / k.mouldsPerArm)} cycles</span>
                  </td>
                );
              })}
              <td className={`${cell} hidden sm:table-cell`}>
                <Calc value={whole(pipelineCycles)} title="Tanks already planned divided by moulds per arm" />
              </td>
              <td className={cell}>
                <Calc value={whole(pipelineCycles * h)} title="Arm-cycles x 2 h per arm-cycle. Already planned, not part of the total below" />
              </td>
            </tr>
            {Array.from({ length: T - 1 }, (_, i) => {
              const used = sol.armCyclesByPlan[i]!;
              const available = input.armCycles[i]!;
              return (
                <tr key={i}>
                  <th scope="row" className={`${td} px-1.5 text-left font-normal sm:px-2`}>
                    Week {i + 2}
                    <span className="block text-12 text-textMuted">{weekDates(weekOne, i + 2)}</span>
                  </th>
                  {input.skus.map((k, ki) => (
                    <td key={k.id} className={cell}>
                      <Calc value={fmt(sol.tanks[ki]![i]!)} title={`Whole-arm-cycle plan: ${fmt(sol.n[ki]![i]!)} arm-cycles x ${k.mouldsPerArm} moulds per arm`} />
                      <span className="block text-12 text-textMuted">{fmt(sol.n[ki]![i]!)} cycles</span>
                    </td>
                  ))}
                  <td className={`${cell} hidden sm:table-cell`}>
                    <Calc value={fmt(used)} title="Arm-cycles of the three tanks this week" />
                    <span className="block text-12 text-textMuted">of {fmt(available)}</span>
                  </td>
                  <td className={cell}>
                    <Calc value={fmt(used * h)} title={`Arm-cycles x 2 h. ${fmt(available * h)} arm-hours are available this week`} />
                    <CapacityBar used={used} available={available} />
                    {available - used < 1e-6 && <span className="block text-12 text-textMuted">full</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className={`${td} border-b-0 px-1.5 text-left font-medium sm:px-2`}>
                Total{T > 2 ? `, weeks 2 to ${T}` : ''}
              </th>
              {input.skus.map((k, ki) => (
                <td key={k.id} className={`${cell} border-b-0`}>
                  <Calc value={fmt(sol.tanks[ki]!.reduce((a, b) => a + b, 0))} title="Sum of the plan" />
                </td>
              ))}
              <td className={`${cell} hidden border-b-0 sm:table-cell`}>
                <Calc value={fmt(sol.totals.armCycles)} title="Sum of the plan" />
              </td>
              <td className={`${cell} border-b-0`}>
                <Calc value={fmt(sol.totals.hours)} title="Sum of the plan" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ContinuousTable({ view }: { view: View }) {
  const { result, weekOne } = view;
  const { input, lp, integer } = result;
  const T = input.weeks;
  const h = input.hoursPerArmCycle;
  const extra = integer.totals.hours - lp.totals.hours;
  return (
    <div className="min-w-0">
      <h3 className="text-14 font-semibold">For comparison: part arm-cycles allowed</h3>
      <p className="mt-1 text-12 text-textMuted">The same model solved as a continuous LP. It cannot be run as it is, but it shows what whole arm-cycles cost and it gives the shadow prices below.</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-14">
          <caption className="sr-only">Continuous LP: tanks per week and tank, and arm-hours</caption>
          <thead>
            <tr>
              <th scope="col" className={`${th} px-1.5 text-left sm:px-2`}>
                Week
              </th>
              {input.skus.map((k) => (
                <th key={k.id} scope="col" className={head}>
                  {k.id}
                </th>
              ))}
              <th scope="col" className={head}>
                Arm-hours
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: T - 1 }, (_, i) => (
              <tr key={i}>
                <th scope="row" className={`${td} px-1.5 text-left font-normal sm:px-2`}>
                  Week {i + 2}
                  <span className="block text-12 text-textMuted">{weekDates(weekOne, i + 2)}</span>
                </th>
                {input.skus.map((k, ki) => (
                  <td key={k.id} className={cell}>
                    <Calc value={fmt(lp.tanks[ki]![i]!, 1)} title={`Continuous LP: ${fmt(lp.n[ki]![i]!, 2)} arm-cycles x ${k.mouldsPerArm} moulds per arm`} />
                  </td>
                ))}
                <td className={cell}>
                  <Calc value={fmt(lp.armCyclesByPlan[i]! * h, 1)} title="Arm-cycles x 2 h" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className={`${td} border-b-0 px-1.5 text-left font-medium sm:px-2`}>
                Total
              </th>
              {input.skus.map((k, ki) => (
                <td key={k.id} className={`${cell} border-b-0`}>
                  <Calc value={fmt(lp.tanks[ki]!.reduce((a, b) => a + b, 0), 1)} title="Sum of the continuous plan" />
                </td>
              ))}
              <td className={`${cell} border-b-0`}>
                <Calc value={fmt(lp.totals.hours, 1)} title="Sum of the continuous plan" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5 text-12 text-textMuted">
        Whole arm-cycles take
        <Calc size="12" value={fmt(Math.max(0, extra), 1)} unit="arm-hours more" title="Arm-hours of the whole-arm-cycle plan minus arm-hours of the continuous LP" />
        than this, and leave
        <Calc size="12" value={fmt(Math.max(0, integer.totals.shortage - lp.totals.shortage), 1)} unit="more tank-weeks below the minimum" title="Shortage of the whole-arm-cycle plan minus shortage of the continuous LP" />.
      </p>
    </div>
  );
}

export function PlanSection({ view, phase, error, onFix }: { view: View | null; phase: PlanState['phase']; error: string | null; onFix: (patch: Partial<PlanSettings>) => void }) {
  let body: ReactNode;
  if (phase === 'error') {
    body = (
      <p role="alert" className="flex items-start gap-2 text-14">
        <span className="mt-1.5">
          <StatusMark kind="fail" />
        </span>
        <span>The solver could not run in this browser, so there is no plan to show. Detail: {error}</span>
      </p>
    );
  } else if (!view) {
    body = <p className="text-14 text-textMuted">Starting the solver. The plan appears here in a moment.</p>;
  } else if (!hasPlan(view.result.integer)) {
    body = <NoPlan view={view} onFix={onFix} />;
  } else {
    const { result, settings } = view;
    const { input, integer: sol, lp } = result;
    const T = input.weeks;
    const where = shortWeeksBySku(sol, result);
    const capHours = (input.armCycles[0] ?? 0) * input.hoursPerArmCycle;
    const relaxed = new Map<string, number[]>();
    for (const r of result.capRelaxed) relaxed.set(r.sku, [...(relaxed.get(r.sku) ?? []), r.week]);
    body = (
      <>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
          <Kpi
            label={`Machine time on the three tanks${T > 2 ? `, weeks 2 to ${T}` : ''}`}
            value={<Calc size="28" value={fmt(sol.totals.hours)} unit="arm-hours" title="Whole-arm-cycle plan: arm-cycles x 2 h per arm-cycle" />}
            note={
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <Calc size="12" value={fmt(sol.totals.armCycles)} unit="arm-cycles," title="Sum of arm-cycles in the plan" />
                <Calc size="12" value={fmt(sol.totals.tanks)} unit="tanks." title="Sum of tanks in the plan" />
                <span>Each week has</span>
                <Calc size="12" value={fmt(capHours)} unit="arm-hours for the tanks." title="Arm-days x 4 cycles a day x 2 h per arm-cycle" />
              </span>
            }
          />
          <Kpi
            label="Stock below the minimum"
            value={
              <span className="inline-flex items-center gap-3">
                {sol.totals.shortage >= SHOWN_FROM && <StatusMark kind={settings.floor === 'soft' ? 'allowed' : 'fail'} />}
                <Calc size="28" value={fmt(sol.totals.shortage, 1)} unit="tank-weeks" title="Sum over tanks and weeks of minimum stock minus stock, where stock is under the minimum" />
              </span>
            }
            note={where.length ? `${where.join('; ')}. One tank below the minimum for one week is one tank-week.` : 'Stock stays at or above the minimum in every week.'}
          />
          <Kpi
            label="Diesel, electricity and holding cost"
            value={<Calc size="28" value={fmt(sol.totals.energyCost + sol.totals.holdingCost)} unit="USD" title="Arm-cycles x (diesel + electricity per arm-cycle) plus holding cost per tank-week x stock" />}
            note={
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <Calc size="12" value={fmt(sol.totals.energyCost)} unit="USD energy," title={`Arm-cycles x (${P.dieselCostPerArmCycle.value} + ${P.electricityCostPerArmCycle.value}) USD, inventory rows 61 and 64`} />
                <Calc size="12" value={fmt(sol.totals.holdingCost)} unit="USD holding." title="Stock at the end of each week x holding cost per tank-week, inventory row 94" />
                <span>{settings.objective === 'cost' ? 'This is what the plan keeps low.' : 'For information: this plan keeps machine time low.'}</span>
              </span>
            }
          />
        </dl>

        {(relaxed.size > 0 || sol.status === 'limit') && (
          <ul className="mt-4 grid gap-1 text-12 text-textMuted">
            {[...relaxed.entries()].map(([sku, ws]) => (
              <li key={sku} className="flex items-start gap-2">
                <span className="mt-1">
                  <StatusMark kind="allowed" />
                </span>
                <span>
                  {sku} is above its warehouse cap in {listWeeks(ws)} even if nothing is made, so the cap is not applied to {sku} in {ws.length > 1 ? 'those weeks' : 'that week'} and the plan makes none until stock is back under it.
                </span>
              </li>
            ))}
            {sol.status === 'limit' && <li>The solver reached its time limit. This is the best whole-arm-cycle plan it found, not proven best.</li>}
          </ul>
        )}

        <div className="mt-6 grid gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <IntegerTable view={view} />
          {lp.status === 'optimal' && <ContinuousTable view={view} />}
        </div>
      </>
    );
  }
  return (
    <Panel className="p-4" aria-labelledby="plan-result">
      <SectionHeader
        id="plan-result"
        title="The plan"
        note={view ? `One arm-cycle keeps one arm busy for 2 hours and makes 1 CTT4, or 2 CTT2, or 2 HTT2. NTG fixes each week's plan on the Friday before: week 2 on Friday ${fridayBefore(view.weekOne, 2)}.` : undefined}
        action={<SolveStatus phase={phase} />}
      />
      {body}
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
  const { result, settings, weekOne } = view;
  const { input, integer: sol } = result;
  const T = input.weeks;
  const dates = (t: number) => weekDates(weekOne, t);
  return (
    <Panel className="p-4" aria-labelledby="plan-stock">
      <SectionHeader
        id="plan-stock"
        title="Stock the plan gives"
        note="Stock at the end of each week if the plan above is run. The line should stay in the pale band, between the minimum and the cap. Point at a week for the exact figures, or tab to a chart and use the arrow keys."
      />
      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-3">
        {input.skus.map((k, ki) => {
          const sku = skuAt(ki);
          return (
            <StockChart
              key={k.id}
              sku={k.id}
              stock={sol.stock[ki]!}
              shortage={sol.shortage[ki]!}
              arrivals={[k.pipeline, ...sol.tanks[ki]!]}
              demand={k.demand}
              returns={k.returns}
              minStock={k.minStock}
              cap={input.capOn ? k.cap : null}
              minBadge={<Num size="12" value={k.minStock} tag={P.minStock.tag} title={sourceTitle(P.minStock)} />}
              capBadge={<Num size="12" value={k.cap} tag={P.warehouseCap.tag} title={sourceTitle(P.warehouseCap)} />}
              badges={{ start: openingBadge(settings, sku), pipeline: pipelineBadge(settings, sku), demand: demandBadge(settings) }}
              dates={dates}
            />
          );
        })}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-12 text-textMuted">
        <LegendItem
          sample={
            <>
              <line x1="0" y1="5" x2="22" y2="5" stroke={color.text} strokeWidth="2" />
              <circle cx="11" cy="5" r="3.5" fill={color.text} />
            </>
          }
        >
          Stock at the end of the week
        </LegendItem>
        <LegendItem sample={<line x1="0" y1="5" x2="22" y2="5" stroke={color.steelLight} strokeWidth="1" />}>Minimum stock</LegendItem>
        {input.capOn && <LegendItem sample={<line x1="0" y1="5" x2="22" y2="5" stroke={color.steelMid} strokeWidth="1" strokeDasharray="5 4" />}>Warehouse cap</LegendItem>}
        {input.capOn && <LegendItem sample={<rect x="0" y="0" width="22" height="10" fill={color.hairline} opacity="0.7" />}>Where stock should be</LegendItem>}
        <LegendItem sample={<rect x="7" y="0" width="8" height="10" fill={color.alertRed} />}>Week below the minimum</LegendItem>
      </ul>

      <details className="mt-4">
        <summary className="cursor-pointer text-12 text-textMuted hover:text-text">Show the stock figures as a table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full max-w-[44rem] border-collapse text-14">
            <caption className="sr-only">Stock at the end of each week for each tank</caption>
            <thead>
              <tr>
                <th scope="col" className={`${th} text-left`}>
                  End of
                </th>
                {input.skus.map((k) => (
                  <th key={k.id} scope="col" className={`${th} text-right`}>
                    {k.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: T + 1 }, (_, t) => (
                <tr key={t}>
                  <th scope="row" className={`${td} text-left font-normal`}>
                    {t === 0 ? 'Start' : `Week ${t}`}
                    {t > 0 && <span className="block text-12 text-textMuted">{dates(t)}</span>}
                  </th>
                  {input.skus.map((k, ki) => {
                    const short = t > 0 && sol.shortage[ki]![t - 1]! >= SHOWN_FROM;
                    const b = openingBadge(settings, skuAt(ki));
                    return (
                      <td key={k.id} className={`${td} text-right`}>
                        <span className="inline-flex items-center gap-2">
                          {short && <StatusMark kind="fail" />}
                          {t === 0 ? <Num value={fmt(sol.stock[ki]![0]!, 1)} tag={b.tag} title={b.title} /> : <Calc value={fmt(sol.stock[ki]![t]!, 1)} title="Stock before, plus arrivals, plus returns, minus demand" />}
                        </span>
                        {short && <span className="block text-12 text-textMuted">{fmt(sol.shortage[ki]![t - 1]!, 1)} below minimum</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Independent re-check
// ---------------------------------------------------------------------------

const resultWord: Record<CheckRow['status'], string> = { pass: 'Pass', fail: 'Fail', allowed: 'Below minimum, allowed' };

export function CheckSection({ view }: { view: View }) {
  const { checks } = view.result;
  const failed = checks.filter((c) => c.status === 'fail').length;
  return (
    <Panel className="p-4" aria-labelledby="plan-check">
      <SectionHeader
        id="plan-check"
        title="Check of the plan"
        note="The whole-arm-cycle plan is worked through again in plain arithmetic, apart from the solver: stock is rebuilt week by week from the arm-cycles and every rule is tested."
      />
      <p className="mb-3 flex items-center gap-2 text-14">
        <StatusMark kind={failed ? 'fail' : 'pass'} />
        {failed ? `${failed} of ${checks.length} checks fail. Do not use this plan.` : `No check fails: the plan keeps all ${checks.length} rules.`}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-14">
          <caption className="sr-only">Result of the independent re-check, one row per rule</caption>
          <thead>
            <tr>
              <th scope="col" className={`${th} text-left`}>
                Rule
              </th>
              <th scope="col" className={`${th} text-right`}>
                Rows that hold
              </th>
              <th scope="col" className={`${th} text-left`}>
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.id}>
                <th scope="row" className={`${td} text-left font-normal`}>
                  {c.rule}
                  <span className="block text-12 text-textMuted">{c.detail}</span>
                </th>
                <td className={`${td} text-right`}>
                  <Calc value={`${c.held} of ${c.rows}`} title="Rows recomputed on this page from the plan and the inputs" />
                </td>
                <td className={td}>
                  <span className="flex items-center gap-2 whitespace-nowrap sm:whitespace-normal">
                    <StatusMark kind={c.status} />
                    {resultWord[c.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Sensitivity
// ---------------------------------------------------------------------------

function capacityWords(c: CapacitySensitivity, objective: PlanSettings['objective']): string {
  if (!c.full) return `Spare time: ${fmt(c.used, 1)} of ${fmt(c.available)} arm-cycles used. One more arm-cycle would change nothing.`;
  if (Math.abs(c.dual) < DUAL_SHOWN_FROM || !c.plusOne) return 'Full, but one more arm-cycle would save nothing: the same tanks can be made in another week.';
  const p = c.plusOne;
  const parts: string[] = [];
  if (p.shortage < -SHOWN_FROM) parts.push(`take ${fmt(-p.shortage, 1)} tank-weeks off the time below the minimum`);
  if (p.shortage > SHOWN_FROM) parts.push(`add ${fmt(p.shortage, 1)} tank-weeks below the minimum`);
  if (objective === 'cost') {
    if (Math.abs(p.cost) >= 0.5) parts.push(`${p.cost < 0 ? 'cut' : 'add'} ${fmt(Math.abs(p.cost))} USD of energy and holding cost`);
  } else if (Math.abs(p.hours) >= SHOWN_FROM) {
    parts.push(`${p.hours < 0 ? 'save' : 'use'} ${fmt(Math.abs(p.hours), 1)} ${p.hours < 0 ? '' : 'more '}arm-hours`);
  } else parts.push('use no extra machine time, because another week then makes less');
  return `Full. One more arm-cycle for the tanks this week would ${parts.join(' and ')}.`;
}

function WhatIfTable({ view, cells, pending }: { view: View; cells: WhatIfCell[] | null; pending: boolean }) {
  const { settings } = view;
  const at = (a: number, d: number) => cells?.find((c) => c.armDays === a && c.demandPct === d);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-14">
        <caption className="mb-2 text-left text-12 text-textMuted">
          Each cell is the whole-arm-cycle plan solved again: arm-hours over the horizon, then tank-weeks below the minimum. Demand is a share of the chosen demand.
          {pending && ' Solving.'}
        </caption>
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
          {WHAT_IF_ARM_DAYS.map((a) => (
            <tr key={a}>
              <th scope="row" className={`${td} text-left font-normal`}>
                <span className="num">{a}</span>
                {settings.armDays === a ? ' (now)' : ''}
              </th>
              {WHAT_IF_DEMAND_PCT.map((d) => {
                const c = at(a, d);
                const here = settings.armDays === a && settings.demandPct === d;
                return (
                  <td key={d} className={`${td} text-right ${here ? 'bg-canvas' : ''}`}>
                    {!c ? (
                      <span className="text-12 text-textFaint">Solving</span>
                    ) : c.status === 'infeasible' ? (
                      <span className="inline-flex items-center gap-2 text-12 text-textMuted">
                        <StatusMark kind="fail" /> No plan: stock runs out
                      </span>
                    ) : c.status === 'error' ? (
                      <span className="text-12 text-textMuted">Not solved</span>
                    ) : (
                      <>
                        <Calc value={fmt(c.hours)} unit="h" title={`Whole-arm-cycle plan at ${a} arm-days and ${d} % demand. Continuous LP: ${fmt(c.lpHours, 1)} h`} />
                        <span className="mt-0.5 flex items-center justify-end gap-2 text-12 text-textMuted">
                          {c.shortage >= SHOWN_FROM && <StatusMark kind="allowed" />}
                          <Calc size="12" value={fmt(c.shortage, 1)} unit="short" title={`Tank-weeks below the minimum. Continuous LP: ${fmt(c.lpShortage, 1)}`} />
                        </span>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SensitivitySection({ view, cells, cellsPending }: { view: View; cells: WhatIfCell[] | null; cellsPending: boolean }) {
  const { result, settings, weekOne } = view;
  const { input, lp } = result;
  const s = result.sensitivity;
  const unit = settings.objective === 'cost' ? 'USD' : 'arm-hours';
  const pen = penaltyPerTankWeek(input);
  const valued = s?.floor.filter((f) => f.shortage < SHOWN_FROM && f.dual >= DUAL_SHOWN_FROM) ?? [];
  const short = s?.floor.filter((f) => f.shortage >= SHOWN_FROM) ?? [];
  const free = new Map<string, number[]>();
  for (const f of s?.floor ?? []) if (f.shortage < SHOWN_FROM && f.dual < DUAL_SHOWN_FROM) free.set(f.sku, [...(free.get(f.sku) ?? []), f.week]);
  const anyValue = s?.capacity.some((c) => c.full && Math.abs(c.dual) >= DUAL_SHOWN_FROM);
  return (
    <Panel className="p-4" aria-labelledby="plan-sens">
      <SectionHeader
        id="plan-sens"
        title="What would change the plan"
        note={`Shadow prices come from the continuous LP. A shadow price is what the total being kept low (${settings.objective === 'cost' ? 'cost in USD, including the penalty for stock below the minimum' : 'arm-hours, plus the penalty for stock below the minimum'}) would change by if one limit moved by one unit.`}
      />

      {!s || lp.status !== 'optimal' ? (
        <p className="text-14 text-textMuted">There is no continuous plan to take shadow prices from.</p>
      ) : (
        <>
          <h3 className="text-14 font-semibold">One more arm-cycle for the tanks</h3>
          <p className="mt-1 text-12 text-textMuted">
            {anyValue ? 'The machine is the limit in the weeks marked full.' : 'The machine is not the limit in any week: more arm-days for the tanks would not change this plan.'}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-14">
              <caption className="sr-only">Shadow price of machine capacity, one row per planned week</caption>
              <thead>
                <tr>
                  <th scope="col" className={`${th} text-left`}>
                    Week
                  </th>
                  <th scope="col" className={`${th} whitespace-nowrap text-right`}>
                    Shadow price
                  </th>
                  <th scope="col" className={`${th} text-left`}>
                    In words
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.capacity.map((c) => (
                  <tr key={c.plan}>
                    <th scope="row" className={`${td} whitespace-nowrap text-left font-normal`}>
                      Week {c.plan + 1}
                      <span className="block text-12 text-textMuted">{weekDates(weekOne, c.plan + 1)}</span>
                    </th>
                    <td className={`${td} text-right`}>
                      <Calc value={fmt(Math.abs(c.dual) < DUAL_SHOWN_FROM ? 0 : c.dual, 1)} unit={unit} title="Dual value of this week's machine row in the continuous LP, per extra arm-cycle" />
                    </td>
                    <td className={`${td} min-w-[14rem] text-12 text-textMuted`}>{capacityWords(c, settings.objective)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-6 text-14 font-semibold">The minimum stock</h3>
          {s.floor.length === 0 ? (
            <p className="mt-1 text-12 text-textMuted">Stock is above the minimum in every week, so the minimum does not shape this plan.</p>
          ) : (
            <ul className="mt-2 grid gap-2 text-12 text-textMuted">
              {short.map((f) => (
                <li key={`${f.sku}${f.week}`} className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-text">
                    {f.sku}, week {f.week}:
                  </span>
                  under the minimum. Shadow price
                  <Calc size="12" value={fmt(f.dual, 1)} unit={unit} title="Dual value of this floor row in the continuous LP, per tank of minimum stock" />
                  per tank: that is the penalty ({fmt(pen, unit === 'USD' ? 0 : 1)} {unit} per tank-week), not machine time.
                </li>
              ))}
              {valued.map((f) => (
                <li key={`${f.sku}${f.week}`} className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-text">
                    {f.sku}, week {f.week}:
                  </span>
                  stock sits on the minimum. A minimum one tank lower would save
                  <Calc size="12" value={fmt(f.dual, 1)} unit={unit} title="Dual value of this floor row in the continuous LP, per tank of minimum stock" />
                  (one tank higher would cost the same).
                </li>
              ))}
              {free.size > 0 && (
                <li>
                  <span className="text-text">Also on the minimum, at no extra {settings.objective === 'cost' ? 'cost worth showing' : 'machine time'}:</span> {[...free.entries()].map(([sku, ws]) => `${sku} ${listWeeks(ws)}`).join('; ')}. A lower minimum there would only let the same tanks be made a week later.
                </li>
              )}
            </ul>
          )}
        </>
      )}

      <h3 className="mt-6 text-14 font-semibold">What if capacity or demand were different</h3>
      <div className="mt-1">
        <WhatIfTable view={view} cells={cells} pending={cellsPending} />
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Manual check
// ---------------------------------------------------------------------------

const MADE_UP = 'Made-up number for this check, not plant data';
const BY_HAND = 'Worked out by hand, steps on the left and in NOTES.md';

function close(a: number, b: number) {
  return Math.abs(a - b) < 1e-6;
}

export function ManualSection({ manual }: { manual: PlanResult | null }) {
  const k = manualInput.skus[0]!;
  const rows: { label: string; hand: number; tool: number | null; digits: number }[] = manual
    ? [
        { label: 'Part arm-cycles: arm-cycles in week 2', hand: manualHand.lp.n[0], tool: manual.lp.n[0]![0]!, digits: 1 },
        { label: 'Part arm-cycles: arm-cycles in week 3', hand: manualHand.lp.n[1], tool: manual.lp.n[0]![1]!, digits: 1 },
        { label: 'Stock at the end of week 1', hand: manualHand.lp.stock[1], tool: manual.lp.stock[0]![1]!, digits: 1 },
        { label: 'Stock at the end of week 2', hand: manualHand.lp.stock[2], tool: manual.lp.stock[0]![2]!, digits: 1 },
        { label: 'Stock at the end of week 3', hand: manualHand.lp.stock[3], tool: manual.lp.stock[0]![3]!, digits: 1 },
        { label: 'Tank-weeks below the minimum', hand: 3, tool: manual.lp.totals.shortage, digits: 1 },
        { label: 'Arm-hours', hand: manualHand.lp.hours, tool: manual.lp.totals.hours, digits: 1 },
        { label: 'Total: arm-hours plus penalty', hand: manualHand.lp.objective, tool: manual.lp.objective, digits: 1 },
        { label: 'Shadow price, arm-cycles in week 2', hand: manualHand.lp.capacityDual[0], tool: manual.lp.duals?.capacity[0] ?? null, digits: 1 },
        { label: 'Shadow price, arm-cycles in week 3', hand: manualHand.lp.capacityDual[1], tool: manual.lp.duals?.capacity[1] ?? null, digits: 1 },
        { label: 'Whole arm-cycles: arm-cycles in week 2', hand: manualHand.integer.n[0], tool: manual.integer.n[0]![0]!, digits: 0 },
        { label: 'Whole arm-cycles: arm-cycles in week 3', hand: manualHand.integer.n[1], tool: manual.integer.n[0]![1]!, digits: 0 },
        { label: 'Whole arm-cycles: total', hand: manualHand.integer.objective, tool: manual.integer.objective, digits: 1 },
      ]
    : [];
  const matches = rows.filter((r) => r.tool !== null && close(r.hand, r.tool)).length;
  const given: [string, ReactNode][] = [
    ['Tanks per arm-cycle', k.mouldsPerArm],
    ['Arm-hours per arm-cycle', manualInput.hoursPerArmCycle],
    ['Stock at the start', k.openingStock],
    ['Already planned, in stock in week 1', k.pipeline],
    ['Sold each week', k.demand[0]!],
    ['Minimum stock', k.minStock],
    ['Arm-cycles free in week 2', manualInput.armCycles[0]!],
    ['Arm-cycles free in week 3', manualInput.armCycles[1]!],
    ['Penalty per tank-week below the minimum, arm-hours', manualInput.penaltyHours],
  ];
  return (
    <Panel className="p-4" aria-labelledby="plan-manual">
      <SectionHeader
        id="plan-manual"
        title="Manual check"
        note="A case small enough to solve on paper: one tank, three weeks. The same code that makes the plan above solves it, and the two answers are set side by side."
      />
      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className="text-14 font-semibold">The case</h3>
          <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-12">
            {given.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-textMuted">{label}</dt>
                <dd className="text-right">
                  <Num size="12" value={value} tag="S" title={MADE_UP} />
                </dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-4 text-14 font-semibold">By hand</h3>
          <ol className="mt-2 grid list-decimal gap-2 pl-5 text-12 text-textMuted">
            <li>Week 1 is fixed: 20 + 4 - 10 = 14 tanks. That is above 13, so nothing is short.</li>
            <li>
              Week 2: stock is 14 - 10 + 2 x arm-cycles. Reaching 13 needs 4.5 arm-cycles and only 3 are free. An arm-cycle costs 2 arm-hours and takes 2 tank-weeks off the shortage, worth 20, so all 3 are used. Stock is 10, which is 3 below the minimum.
            </li>
            <li>Week 3: stock is 10 - 10 + 2 x arm-cycles. Reaching 13 needs 6.5 arm-cycles and 8 are free. Stock is 13, nothing short.</li>
            <li>Total: 2 x (3 + 6.5) = 19 arm-hours, plus 10 x 3 = 30 for the shortage. 19 + 30 = 49.</li>
            <li>
              Shadow prices: a fourth arm-cycle in week 2 would lift stock there to 12 (2 tank-weeks less short, 20 saved) and week 3 would need one arm-cycle less, so arm-hours stay at 19. The total falls by 20. Week 3 has spare arm-cycles, so its shadow price is 0.
            </li>
            <li>Whole arm-cycles: week 3 is 6 or 7. With 6, stock ends at 12, one more tank-week short: 2 x 9 + 10 x 4 = 58. With 7, stock ends at 14: 2 x 10 + 10 x 3 = 50. So 7 arm-cycles, total 50.</li>
          </ol>
        </div>
        <div className="min-w-0">
          <h3 className="text-14 font-semibold">Solver against the hand answer</h3>
          {!manual ? (
            <p className="mt-2 text-12 text-textMuted">Solving the small case.</p>
          ) : (
            <>
              <p className="mt-2 flex items-center gap-2 text-14">
                <StatusMark kind={matches === rows.length ? 'pass' : 'fail'} />
                {matches === rows.length ? `The solver gives the hand answer in all ${rows.length} figures.` : `${rows.length - matches} of ${rows.length} figures differ from the hand answer.`}
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse text-14">
                  <caption className="sr-only">Hand solution and solver answer for the small case</caption>
                  <thead>
                    <tr>
                      <th scope="col" className={`${th} text-left`}>
                        Figure
                      </th>
                      <th scope="col" className={`${th} text-right`}>
                        By hand
                      </th>
                      <th scope="col" className={`${th} text-right`}>
                        Solver
                      </th>
                      <th scope="col" className={`${th} text-left`}>
                        Same
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const ok = r.tool !== null && close(r.hand, r.tool);
                      return (
                        <tr key={r.label}>
                          <th scope="row" className={`${td} text-left text-12 font-normal`}>
                            {r.label}
                          </th>
                          <td className={`${td} text-right`}>
                            <Calc value={fmt(r.hand, r.digits)} title={BY_HAND} />
                          </td>
                          <td className={`${td} text-right`}>{r.tool === null ? <span className="text-12 text-textMuted">none</span> : <Calc value={fmt(r.tool, r.digits)} title="HiGHS answer for the small case" />}</td>
                          <td className={td}>
                            <span className="flex items-center gap-2 text-12">
                              <StatusMark kind={(ok ? 'pass' : 'fail') as Mark} />
                              {ok ? 'Yes' : 'No'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// How to use, and the model in full
// ---------------------------------------------------------------------------

export function HowToSection() {
  const steps: [string, string][] = [
    ['On Friday, set the start.', 'Choose "Latest ERP stock", or type the stock of each tank as counted today.'],
    ['Type what is already planned for next week.', 'Those tanks reach stock in week 1 and cannot be changed, so the plan starts in week 2.'],
    ['Set the arm-days the three tanks can have.', 'Other products take the rest of the machine. Move the slider if they need more or less that week.'],
    ['Read the plan.', 'The week 2 row is the plan to fix this Friday: how many of each tank, and how many arm-cycles that is. Later rows show what is coming.'],
    ['Look for red.', 'A red bar on a chart, or a failed check, means stock goes below the minimum or a rule is broken. Try more arm-days, or the busy-week demand to see how much room there is. Come back next Friday with the new stock.'],
  ];
  return (
    <Panel className="p-4" aria-labelledby="plan-howto">
      <SectionHeader id="plan-howto" title="How to use this page" />
      <ol className="grid gap-3">
        {steps.map(([lead, rest], i) => (
          <li key={lead} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
            <span className="num text-14 text-textMuted" aria-hidden="true">
              {i + 1}
            </span>
            <p className="text-14">
              <span className="font-medium">{lead}</span> <span className="text-textMuted">{rest}</span>
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-hairline pt-3 text-12 text-textMuted">
        The plan is as good as its inputs. Demand here is an average, the same every week, and real weeks differ. Use the week 2 row and solve again each Friday rather than fixing all the weeks at once.
      </p>
    </Panel>
  );
}

export function ModelSection({ view }: { view: View }) {
  const { input, integer } = view.result;
  const cost = input.objective === 'cost';
  const pen = penaltyPerTankWeek(input);
  const lines: [string, string][] = [
    ['Decide', 'n[k,t] = arm-cycles of tank k in the plan fixed on the Friday of week t (t = 1 to T - 1). Tanks made x[k,t] = moulds per arm x n[k,t]. They are made and reach stock in week t + 1.'],
    ['Stock', 'I[k,t] = I[k,t-1] + arrivals[k,t] + returns[k] - demand[k,t], with arrivals[k,1] = tanks already planned and arrivals[k,t] = x[k,t-1] after that.'],
    ['Minimum', input.floor === 'soft' ? 'I[k,t] + s[k,t] >= minimum[k], where s[k,t] >= 0 is the number of tanks below the minimum that week.' : 'I[k,t] >= minimum[k] in every week (strict floor).'],
    ['Cap', input.capOn ? 'I[k,t] <= cap[k]. Where stock is above the cap even with nothing made, the cap is set to that stock for that week.' : 'Switched off.'],
    ['No stockout', 'I[k,t] >= 0.'],
    ['Machine', 'n[CTT4,t] + n[CTT2,t] + n[HTT2,t] <= arm-days x 4 cycles a day.'],
    [
      'Keep low',
      cost
        ? `(diesel + electricity per arm-cycle) x all arm-cycles + holding cost per tank-week x all end-of-week stock${input.floor === 'soft' ? ` + ${fmt(pen, 2)} USD x all tank-weeks below the minimum` : ''}.`
        : `2 h x all arm-cycles${input.floor === 'soft' ? ` + ${fmt(pen, 1)} h x all tank-weeks below the minimum` : ''} + ${TIE_BREAK_HOURS} h x all end-of-week stock (a tie-break: among plans with the same arm-hours, make tanks as late as possible).`,
    ],
    ['Whole arm-cycles', 'The plan to use has every n[k,t] a whole number. The same model without that rule is the continuous LP.'],
  ];
  return (
    <Panel className="p-4" aria-labelledby="plan-model">
      <details>
        <summary className="cursor-pointer text-14 font-semibold" id="plan-model">
          The model behind the plan, and the file sent to the solver
        </summary>
        <dl className="mt-4 grid max-w-[110ch] gap-x-4 gap-y-2 text-12 sm:grid-cols-[8rem_minmax(0,1fr)]">
          {lines.map(([name, text]) => (
            <div key={name} className="contents">
              <dt className="font-medium text-text">{name}</dt>
              <dd className="text-textMuted">{text}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 max-w-[110ch] text-12 text-textMuted">
          Assumptions made on this page, listed with their reasons in src/pages/plan/NOTES.md: the shortage penalty, the tie-break, zero tanks already planned when starting from the ERP stock, the same demand and the same arm-days in every week, and returns at their yearly average. Solved in the browser with HiGHS.
        </p>
        <h3 className="mt-4 text-12 font-medium">Whole-arm-cycle model as sent to HiGHS (CPLEX LP format)</h3>
        <pre tabIndex={0} className="num mt-2 max-h-80 overflow-auto rounded-control border border-hairline bg-canvas p-3 text-12 text-textMuted">
          {integer.lpText}
        </pre>
      </details>
    </Panel>
  );
}
