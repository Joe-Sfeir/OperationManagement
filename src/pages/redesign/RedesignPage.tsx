/**
 * Redesign page: NTG's planned week beside an alternative, on the same
 * simulated machine. Both 3D views read the shared clock, so one set of
 * playback controls drives them together.
 *
 * Every figure comes from evaluateWeek (src/sim/scenarios.ts) or from the
 * inventory (`P`); nothing is typed in. The recommendation is recommend();
 * the page states the rule and what the twin cannot tell.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTwin } from '../../app/store';
import { usePrefersReducedMotion } from '../../app/useClock';
import { P, SKUS, inventoryRows, type Datum, type PerSku, type Sku } from '../../data/params';
import { week } from '../../data/history';
import { neutral, palette } from '../../design/tokens';
import { SourceBadge } from '../../design/SourceBadge';
import { MachineScene } from '../../scene/MachineScene';
import { PlantProvider } from '../../scene/plant';
import { Stage, type View } from '../../scene/Stage';
import { SCENARIOS, OPENING_STOCK, evaluateWeek, recommend, type WeekResult } from '../../sim/scenarios';
import { stateAt } from '../../sim/state';
import type { SimResult } from '../../sim/types';
import { BottomBar } from '../../ui/Chrome';
import { Num, Panel, Segmented, fmt, sourceTitle } from '../../ui/kit';
import { mouldsLabel } from '../../ui/stage';
import { BASELINE_ID, EXTRA_ARM_DAYS_ALLOWED, distinct, mouldChanges, ruleChecks } from './rule';

const VIEW: View = { target: [-3.2, 1.5, -1.2], span: [40, 25] };
/** Two WebGL canvases at once: the post effects are off here unless ?fx=1 asks for them. */
const EFFECTS = new URLSearchParams(location.search).get('fx') === '1';

const C_SIM = 'Calculated by the simulator';
const invRow = (n: number) => inventoryRows.find((r) => r.row === n);
const shortName = (name: string) => name.split(',')[0]!;
const list = (xs: number[], digits = 0) => xs.map((x) => fmt(x, digits)).join(' to ');

function Tagline({ children }: { children: ReactNode }) {
  return <span className="rounded-control border border-hairlineStrong px-1.5 py-0.5 text-12 text-text">{children}</span>;
}

// ------------------------------------------------------------------ 3D views

function ViewPanel({ result, run, day, role, recommended, tUi, reduced }: { result: WeekResult; run: SimResult; day: number; role: string; recommended: boolean; tUi: number; reduced: boolean }) {
  const k = run.kpis;
  const live = useMemo(() => stateAt(tUi, run).tanksOut, [tUi, run]);
  const label = `${result.scenario.name}, day ${day + 1}: Machine 3700, isometric view`;
  return (
    <Panel aria-label={`${role}: ${result.scenario.name}`} className="flex min-w-0 flex-col overflow-hidden">
      <header className="flex min-h-[44px] flex-wrap items-center gap-x-2 gap-y-1 border-b border-hairline px-3 py-2">
        <span className="text-12 text-textMuted">{role}</span>
        <h3 className="text-14 font-semibold">{result.scenario.name}</h3>
        {recommended && <Tagline>Recommended</Tagline>}
        <span className="ml-auto text-12 text-textMuted">Day {day + 1}</span>
      </header>
      <div className="relative h-[260px] overflow-hidden bg-canvas md:h-[400px]">
        <Stage view={VIEW} label={label} reduced={reduced} effects={EFFECTS}>
          <PlantProvider result={run}>
            <MachineScene interactive={false} />
          </PlantProvider>
        </Stage>
      </div>
      <div className="grid gap-2 border-t border-hairline p-3">
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-12 xl:grid-cols-4" aria-label="Moulds on each arm this day">
          {run.config.arms.map((a, i) => (
            <li key={i} className="min-w-0">
              <span className="text-textMuted">Arm {i + 1}</span> <span className="text-text">{mouldsLabel(a.moulds)}</span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-12">
          <div className="flex items-baseline gap-2">
            <dt className="text-textMuted">Tanks made this day</dt>
            <dd className="flex flex-wrap items-baseline gap-x-3">
              {SKUS.map((s) => (
                <span key={s} className="whitespace-nowrap">
                  {s} <Num size="14" value={k.tanksTotal[s]} tag="C" title={`${C_SIM}: ${s} tanks lifted out of the mould, run-out included`} />
                </span>
              ))}
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-textMuted">Other items</dt>
            <dd>
              <Num size="14" value={k.otherItems} tag="C" title={`${C_SIM}: items from arms that carry other products`} />
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-textMuted">Out so far</dt>
            <dd className="num text-14" aria-live="off">
              {SKUS.map((s) => live[s]).join(' / ')}
            </dd>
          </div>
        </dl>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------- band and table

const BAND_WORD: Record<WeekResult['band'][Sku], string> = { below: 'below minimum', in: 'inside', above: 'above cap' };

/** Minimum to cap as a strip, with a tick at the closing stock. The word beside it carries the meaning. */
function BandMark({ sku, closing, band }: { sku: Sku; closing: number; band: WeekResult['band'][Sku] }) {
  const min = P.minStock.value[sku];
  const cap = P.warehouseCap.value[sku];
  const top = cap * 1.2;
  const w = 44;
  const x = (v: number) => (Math.min(Math.max(v, 0), top) / top) * w;
  const out = band !== 'in';
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-12 text-textMuted" title={`Minimum ${min}, cap ${cap}, closing stock ${fmt(closing, 1)}`}>
      <svg width={w} height={10} viewBox={`0 0 ${w} 10`} aria-hidden="true" className="shrink-0">
        <rect x={0} y={4} width={w} height={2} fill={neutral.hairline} />
        <rect x={x(min)} y={2} width={x(cap) - x(min)} height={6} fill={neutral.textFaint} />
        <rect x={x(closing) - 1.5} y={0} width={3} height={10} fill={out ? palette.alertRed : neutral.text} />
      </svg>
      <span className={out ? 'text-text' : undefined}>{BAND_WORD[band]}</span>
    </span>
  );
}

interface Metric {
  group: string;
  label: string;
  /** Short header inside its group. */
  head: string;
  cell: (r: WeekResult) => ReactNode;
}

function metrics(armDaysTotal: (r: WeekResult) => number): Metric[] {
  const sales = P.weeklySalesMean.value;
  const open = OPENING_STOCK.value;
  const C = (value: ReactNode, title: string, unit?: string) => <Num value={value} unit={unit} tag="C" title={title} />;
  const perDay = (r: WeekResult, f: (x: SimResult) => number) => distinct(r.runs.map(f));
  return [
    ...SKUS.map<Metric>((k) => ({
      group: 'Tanks made in the week',
      label: `${k} tanks made in the week`,
      head: k,
      cell: (r) => C(r.tanks[k], `${C_SIM}: sum over the ${r.runs.length} running days, run-out included`),
    })),
    {
      group: 'Arm-days',
      label: 'Tank arm-days',
      head: 'On tanks',
      cell: (r) => C(r.tankArmDays, `Arm-days that carried at least one of the three tanks, of ${armDaysTotal(r)}. Other products: ${r.otherArmDays}`, `of ${armDaysTotal(r)}`),
    },
    {
      group: 'Oven, each day',
      label: 'Oven visits per day',
      head: 'Visits',
      cell: (r) => C(list(perDay(r, (x) => x.kpis.ovenVisits)), `${C_SIM}: arm entries into the oven on each running day`),
    },
    {
      group: 'Oven, each day',
      label: 'Oven in use',
      head: 'In use',
      cell: (r) => C(fmt(r.meanOvenUtilisation * 100), `${C_SIM}: minutes the oven holds an arm divided by the shift, mean of the days`, '%'),
    },
    {
      group: 'Oven, each day',
      label: 'Mean wait before the oven',
      head: 'Wait before',
      cell: (r) => C(fmt(r.meanWaitOvenMin, 1), `${C_SIM}: minutes loaded arms wait for the oven, per visit, mean of the days`, 'min'),
    },
    {
      group: 'Oven, each day',
      label: `Run-out after the ${fmt(P.shiftHours.value, 1)} h mark`,
      head: 'Run-out',
      cell: (r) => C(fmt(r.maxRunOutMin, 1), `${C_SIM}: minutes after the end of the shift until the last tank is lifted out, longest day`, 'min'),
    },
    ...SKUS.map<Metric>((k) => ({
      group: 'Stock at the end of the week',
      label: `${k} closing stock`,
      head: k,
      cell: (r) => (
        <span className="inline-flex flex-col items-end gap-0.5">
          {C(fmt(r.closingStock[k]), `Opening ${open[k]} + made ${r.tanks[k]} - average sales ${fmt(sales[k], 1)} = ${fmt(r.closingStock[k], 1)}`)}
          <BandMark sku={k} closing={r.closingStock[k]} band={r.band[k]} />
        </span>
      ),
    })),
    ...SKUS.map<Metric>((k) => ({
      group: 'Weeks of cover',
      label: `${k} weeks of cover`,
      head: k,
      cell: (r) => C(fmt(r.coverWeeks[k], 1), `Closing stock ${fmt(r.closingStock[k], 1)} divided by average weekly sales ${fmt(sales[k], 1)}`),
    })),
    {
      group: 'Weeks of cover',
      label: 'Cover spread',
      head: 'Spread',
      cell: (r) => C(fmt(r.coverSpread, 1), 'Most covered product minus least covered product, in weeks. Smaller is more even'),
    },
  ];
}

function CompareTable({ results, recId }: { results: WeekResult[]; recId: string }) {
  const ms = useMemo(() => metrics((r) => r.runs.reduce((s, x) => s + x.config.arms.length, 0)), []);
  const groups = useMemo(() => {
    const out: { name: string; span: number }[] = [];
    for (const m of ms) {
      const last = out[out.length - 1];
      if (last && last.name === m.group) last.span += 1;
      else out.push({ name: m.group, span: 1 });
    }
    return out;
  }, [ms]);
  const tags = (r: WeekResult) => (
    <>
      {r.scenario.id === BASELINE_ID && <Tagline>Baseline</Tagline>}
      {r.scenario.id === recId && <Tagline>Recommended</Tagline>}
    </>
  );
  const th = 'px-2 py-1.5 text-12 font-medium text-textMuted';
  return (
    <>
      {/* Desktop: one row per scenario */}
      <div className="hidden overflow-x-auto md:block" role="region" aria-label="Scenario comparison, scroll sideways if needed" tabIndex={0}>
        <table className="w-full min-w-[1320px] border-collapse">
          <caption className="sr-only">One week on Machine 3700 under each scenario: tanks made, arm-days, oven load, closing stock and cover</caption>
          <thead>
            <tr className="border-b border-hairline">
              <th scope="col" rowSpan={2} className={`${th} w-[250px] text-left align-bottom`}>
                Scenario
              </th>
              {groups.map((g) => (
                <th key={g.name} scope="colgroup" colSpan={g.span} className={`${th} border-l border-hairline text-left`}>
                  {g.name}
                </th>
              ))}
            </tr>
            <tr className="border-b border-hairlineStrong">
              {ms.map((m, i) => (
                <th key={m.label} scope="col" className={`${th} text-right ${i === 0 || ms[i - 1]!.group !== m.group ? 'border-l border-hairline' : ''}`}>
                  {m.head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.scenario.id} className="border-b border-hairline align-top">
                <th scope="row" className="px-2 py-2.5 text-left font-normal">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-14 font-medium">{r.scenario.name}</span>
                    {tags(r)}
                  </span>
                  <span className="mt-1 block text-12 text-textMuted">{r.scenario.change}</span>
                </th>
                {ms.map((m, i) => (
                  <td key={m.label} className={`px-2 py-2.5 text-right ${i === 0 || ms[i - 1]!.group !== m.group ? 'border-l border-hairline' : ''}`}>
                    {m.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Phone: one card per scenario, same figures */}
      <ul className="grid gap-3 md:hidden">
        {results.map((r) => (
          <li key={r.scenario.id} className="rounded-control border border-hairline p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <h4 className="text-14 font-medium">{r.scenario.name}</h4>
              {tags(r)}
            </div>
            <p className="mt-1 text-12 text-textMuted">{r.scenario.change}</p>
            {groups.map((g) => (
              <div key={g.name} className="mt-3 border-t border-hairline pt-2">
                <div className="text-12 font-medium text-textMuted">{g.name}</div>
                <dl className="mt-1 grid gap-1.5">
                  {ms
                    .filter((m) => m.group === g.name)
                    .map((m) => (
                      <div key={m.label} className="flex items-start justify-between gap-3">
                        <dt className="text-12 text-textMuted">{m.head}</dt>
                        <dd className="text-right">{m.cell(r)}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </>
  );
}

function BandInputs() {
  const rows: { label: string; d: Datum<PerSku<number>>; digits: number }[] = [
    { label: 'Opening stock, count of 6 Nov', d: OPENING_STOCK, digits: 0 },
    { label: 'Average weekly sales, 45 full weeks', d: P.weeklySalesMean, digits: 1 },
    { label: 'Minimum stock', d: P.minStock, digits: 0 },
    { label: 'Warehouse cap', d: P.warehouseCap, digits: 0 },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse">
        <caption className="pb-1 text-left text-12 text-textMuted">Inputs of the stock check, tanks. Closing stock = opening + made - average sales.</caption>
        <thead>
          <tr className="border-b border-hairlineStrong">
            <th scope="col" className="px-2 py-1.5 text-left text-12 font-medium text-textMuted">
              Input
            </th>
            {SKUS.map((k) => (
              <th key={k} scope="col" className="px-2 py-1.5 text-right text-12 font-medium text-textMuted">
                {k}
              </th>
            ))}
            <th scope="col" className="px-2 py-1.5 text-right text-12 font-medium text-textMuted">
              Row
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-hairline">
              <th scope="row" className="px-2 py-1.5 text-left text-12 font-normal">
                {r.label}
              </th>
              {SKUS.map((k) => (
                <td key={k} className="px-2 py-1.5 text-right">
                  <Num value={fmt(r.d.value[k], r.digits)} datum={r.d} />
                </td>
              ))}
              <td className="num px-2 py-1.5 text-right text-12 text-textMuted">{r.d.row}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------- the page

export function RedesignPage() {
  const results = useMemo(() => SCENARIOS.map((s) => evaluateWeek(s)), []);
  const rec = useMemo(() => recommend(results), [results]);
  const checks = useMemo(() => ruleChecks(results), [results]);
  const base = results.find((r) => r.scenario.id === BASELINE_ID) ?? results[0]!;
  const alternatives = results.filter((r) => r !== base);
  const [altId, setAltId] = useState(() => (alternatives.some((r) => r.scenario.id === rec.id) ? rec.id : alternatives[0]!.scenario.id));
  const [day, setDay] = useState(0);
  const alt = alternatives.find((r) => r.scenario.id === altId) ?? alternatives[0]!;
  const days = Math.min(base.runs.length, alt.runs.length);
  const d = Math.min(day, days - 1);
  const tUi = useTwin((s) => s.tUi);
  const reduced = usePrefersReducedMotion();

  // A new day or scenario starts from the beginning of the shift, in both views.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (mounted) useTwin.getState().seek(0);
    else setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, altId]);

  const row66 = invRow(66);
  const row109 = invRow(109);
  const allRuns = results.flatMap((r) => r.runs);
  const visits = distinct(allRuns.map((r) => r.kpis.ovenVisits));
  const use = distinct(allRuns.map((r) => Math.round(r.kpis.ovenUtilisation * 100)));
  const waits = distinct(allRuns.map((r) => Number(r.kpis.meanWaitOvenMin.toFixed(1))));
  const cycles = distinct(allRuns.map((r) => Number(r.kpis.cycleMin.toFixed(1))));
  const armsPerDay = distinct(allRuns.map((r) => r.config.arms.filter((a) => a.moulds.length > 0).length));
  const turns = distinct(allRuns.map((r) => r.kpis.ovenVisits / r.config.arms.filter((a) => a.moulds.length > 0).length));
  const recResult = results.find((r) => r.scenario.id === rec.id)!;
  const passed = results.filter((r) => checks.find((c) => c.id === r.scenario.id)!.passes);
  const erp9 = SKUS.map((k) => week(k, '2026-11-09')?.produced ?? 0);
  const armDaysNtg = String(invRow(40)?.value ?? '').match(/(\d+)\s+of\s+(\d+)/);
  const sd = P.weeklySalesSd.value;

  return (
    <main className="mx-auto max-w-[1520px] p-4 md:p-6">
      <header className="mb-4">
        <h2 className="text-28 font-medium">Redesign</h2>
        <p className="mt-1 max-w-[880px] text-14">Same machine, same oven, same shift. Only the moulds on the arms and the product mix change.</p>
        {row66 && (
          <p className="mt-2 max-w-[880px] text-12 text-textMuted">
            NTG told the team it can change quantities and the production order, depending on the moulds installed, and that it can never reduce the wait before the oven{' '}
            <span className="inline-block align-middle">
              <SourceBadge tag="N" title={`Inventory row 66: ${row66.parameter}. "${row66.value}". Source: ${row66.source}`} />
            </span>{' '}
            (inventory row 66). So no scenario here touches the oven, the times or the shift.
          </p>
        )}
      </header>

      <section aria-labelledby="rd-compare" className="grid gap-3">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <h3 id="rd-compare" className="w-full text-14 font-semibold lg:w-auto">
            Side by side, one running day
          </h3>
          <div className="grid max-w-full gap-1">
            <span className="text-12 text-textMuted" id="rd-alt-label">
              Alternative shown on the right
            </span>
            <div className="max-w-full overflow-x-auto">
              <Segmented label="Alternative shown on the right" value={altId} onChange={setAltId} options={alternatives.map((r) => ({ value: r.scenario.id, label: shortName(r.scenario.name) }))} />
            </div>
          </div>
          <div className="grid gap-1">
            <span className="text-12 text-textMuted">Running day of the week</span>
            <Segmented label="Running day of the week" value={d} onChange={setDay} options={Array.from({ length: days }, (_, i) => ({ value: i, label: `Day ${i + 1}` }))} />
          </div>
        </div>
        <p className="text-12 text-textMuted">{alt.scenario.change} Both views run on one clock: play, pause and scrub below move them together.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <ViewPanel result={base} run={base.runs[d]!} day={d} role="Baseline" recommended={base.scenario.id === rec.id} tUi={tUi} reduced={reduced} />
          <ViewPanel result={alt} run={alt.runs[d]!} day={d} role="Alternative" recommended={alt.scenario.id === rec.id} tUi={tUi} reduced={reduced} />
        </div>
        <BottomBar result={base.runs[d]!} />
        <p className="text-12 text-textMuted">
          The timeline shows the oven on the baseline day. A red ring on the floor marks an arm that is waiting; the amber outline marks the oven while arms queue for it.
          {EFFECTS ? '' : ' Two 3D views run at once here, so the soft-shadow and glow effects of the Machine page are switched off.'}
        </p>
      </section>

      <section aria-labelledby="rd-table" className="mt-6">
        <Panel className="p-3 md:p-4">
          <h3 id="rd-table" className="text-14 font-semibold">
            The week under each scenario
          </h3>
          <p className="mb-3 mt-1 max-w-[980px] text-12 text-textMuted">
            {base.runs.length} running days of one {fmt(P.shiftHours.value, 1)} h shift. Figures marked C are computed by the simulator. Stock figures start from NTG's count of 6 Nov and take away an average week of sales.
          </p>
          <CompareTable results={results} recId={rec.id} />
          {armDaysNtg && Number(armDaysNtg[1]) !== base.tankArmDays && (
            <p className="mt-3 max-w-[980px] text-12 text-textMuted">
              The scenario names count arm-days from NTG's sheet, which lists <span className="num text-text">{armDaysNtg[1]}</span> for the planned week (row 40). The twin can place NTG's quantities on{' '}
              <span className="num text-text">{base.tankArmDays}</span>, and the table counts what is placed. So "one arm-day fewer" is level with the baseline here, and "same arm-days" is one more.
            </p>
          )}
          <div className="mt-4 max-w-[760px]">
            <BandInputs />
          </div>
        </Panel>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="rd-rec">
          <Panel className="h-full p-3 md:p-4">
            <h3 id="rd-rec" className="flex flex-wrap items-center gap-2 text-14 font-semibold">
              <span>{recResult.scenario.name}</span>
              <Tagline>Recommended</Tagline>
            </h3>
            <p className="mt-2 text-14">
              {rec.reason}{' '}
              <span className="inline-block align-middle">
                <SourceBadge tag="C" title="Sentence built by recommend() in src/sim/scenarios.ts from the figures in the table" />
              </span>
            </p>
            <p className="mt-1 text-12 text-textMuted">{recResult.scenario.change}</p>
            <ul className="mt-1 list-disc pl-5 text-12 text-textMuted">
              {recResult.scenario.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <h4 className="mt-4 text-12 font-medium">The rule that picked it</h4>
            <p className="mt-1 text-12 text-textMuted">
              Among the scenarios that leave every product between NTG's minimum stock and the warehouse cap, and that use at most{' '}
              <span className="num text-text">{EXTRA_ARM_DAYS_ALLOWED}</span> tank arm-day more than the baseline (<span className="num text-text">{base.tankArmDays}</span>), take the one with the smallest cover spread. A tie goes to fewer arm-days.{' '}
              <span className="num text-text">{passed.length}</span> of <span className="num text-text">{results.length}</span> scenarios pass the two conditions
              {passed.length === results.length ? ', the baseline included, so the cover spread alone decides.' : `: ${passed.map((r) => shortName(r.scenario.name)).join('; ')}.`}
            </p>
            <h4 className="mt-4 text-12 font-medium">What the twin cannot tell</h4>
            <ul className="mt-1 grid list-disc gap-1.5 pl-5 text-12 text-textMuted">
              <li>
                It does not know order due dates. {row109 ? `NTG gave sales invoices only (inventory row 109: "${row109.value}").` : ''} A scenario that makes a product later in the week may miss an order the baseline would meet.
              </li>
              <li>
                Which mould sat on which arm on which day of NTG's plan is assumed. The placement used needs <span className="num text-text">{base.tankArmDays}</span> tank arm-days
                {armDaysNtg ? (
                  <>
                    ; NTG's sheet lists <span className="num text-text">{armDaysNtg[1]}</span> of <span className="num text-text">{armDaysNtg[2]}</span> (row 40)
                  </>
                ) : null}
                .
              </li>
              <li>
                The ERP records <span className="num text-text">{erp9.join(' / ')}</span> tanks made in that week, against the plan's <span className="num text-text">{SKUS.map((k) => P.pipeline.value[k]).join(' / ')}</span>. The baseline is the plan, not the week as it ran.
              </li>
              <li>
                The stock check uses an average week. Weekly sales vary by about <span className="num text-text">{SKUS.map((k) => fmt(sd[k], 1)).join(' / ')}</span> tanks (standard deviation, row {P.weeklySalesSd.row}), and returns are not counted.
              </li>
              <li>
                Moving moulds between days takes time the twin does not charge: {results.map((r) => `${shortName(r.scenario.name)} ${mouldChanges(r.scenario)}`).join(', ')} arm changes in the week. NTG gives {P.mouldChangeMin.value} min for a CTT4 mould (row {P.mouldChangeMin.row}).
              </li>
              <li>
                What the other products need is not in the data. Each scenario leaves them {results.map((r) => `${r.otherArmDays}`).join(', ')} arm-days (in table order), and NTG says that share varies (row 52).
              </li>
            </ul>
          </Panel>
        </section>

        <section aria-labelledby="rd-oven">
          <Panel className="h-full p-3 md:p-4">
            <h3 id="rd-oven" className="text-14 font-semibold">
              What the oven does to every scenario
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <div>
                <dt className="text-12 text-textMuted">Oven visits per day</dt>
                <dd>
                  <Num size="28" value={list(visits)} tag="C" title={`${C_SIM}: the same count on all ${allRuns.length} simulated days`} />
                </dd>
              </div>
              <div>
                <dt className="text-12 text-textMuted">Oven in use</dt>
                <dd>
                  <Num size="28" value={list(use)} unit="%" tag="C" title={`${C_SIM}: share of the shift the oven holds an arm`} />
                </dd>
              </div>
              <div>
                <dt className="text-12 text-textMuted">Wait before the oven</dt>
                <dd>
                  <Num size="28" value={list(waits, 1)} unit="min" tag="C" title={`${C_SIM}: mean per visit`} />
                </dd>
              </div>
              <div>
                <dt className="text-12 text-textMuted">Arm cycle</dt>
                <dd>
                  <Num size="28" value={list(cycles, 1)} unit="min" tag="C" title={`${C_SIM}: minutes between two oven entries of the same arm`} />
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-14">
              {visits.length === 1 && armsPerDay.length === 1
                ? `On all ${allRuns.length} simulated days, in every scenario, ${fmt(armsPerDay[0]!)} arms work and the oven is visited ${fmt(visits[0]!)} times: ${list(turns)} turns for each arm, whatever it carries. The queue before the oven is the same in every column of the table. The mix decides the output, not the queue.`
                : `Oven visits per day range from ${list([visits[0]!, visits[visits.length - 1]!])} across the scenarios, so the queue is not the same in every scenario.`}
            </p>
            <p className="mt-2 text-12 text-textMuted">
              One turn of an arm gives one tank per mould on it: {SKUS.map((k) => `${P.mouldsPerArm.value[k]} for ${k}`).join(', ')}{' '}
              <span className="inline-block align-middle">
                <SourceBadge tag={P.mouldsPerArm.tag} title={sourceTitle(P.mouldsPerArm)} />
              </span>
              . So an arm-day is worth {SKUS.map((k) => `${fmt(P.mouldsPerArm.value[k] * turns[0]!)} ${k}`).join(', ')}, and a scenario can only move tanks between products and days. It cannot make the oven go faster, which is the one thing NTG ruled out.
            </p>
            <p className="mt-2 text-12 text-textMuted">
              An arm on other products takes the same oven visit as a tank arm in the twin (assumption A19). If those products need a longer or shorter visit, every figure in this panel moves with it.
            </p>
          </Panel>
        </section>
      </div>
    </main>
  );
}
