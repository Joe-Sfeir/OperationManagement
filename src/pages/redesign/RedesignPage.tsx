/**
 * Redesign page: NTG's planned week beside an alternative, on the same
 * simulated machine. Both 3D views read the shared clock, so one set of
 * playback controls drives them together. Below them, one short table.
 *
 * Every figure comes from evaluateWeek (src/sim/scenarios.ts) or from the
 * inventory (`P`); nothing is typed in. The full comparison, the rule behind
 * the recommendation and what the twin cannot tell are in docs/MODEL.md,
 * "Redesign comparison".
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTwin } from '../../app/store';
import { usePrefersReducedMotion } from '../../app/useClock';
import { P, SKUS, type Sku } from '../../data/params';
import { neutral, palette } from '../../design/tokens';
import { MachineScene } from '../../scene/MachineScene';
import { PlantProvider } from '../../scene/plant';
import { Stage, type View } from '../../scene/Stage';
import { SCENARIOS, OPENING_STOCK, evaluateWeek, recommend, type WeekResult } from '../../sim/scenarios';
import type { SimResult } from '../../sim/types';
import { BottomBar } from '../../ui/Chrome';
import { Num, Panel, Segmented, fmt } from '../../ui/kit';
import { mouldsLabel } from '../../ui/stage';
import { BASELINE_ID, distinct } from './rule';

/** The machine view of the brief, lowered and tightened to sit in a short, wide frame. */
const VIEW: View = { target: [-3.2, 0.3, -1.2], span: [34, 19.5] };
/** Two WebGL canvases at once: the post effects are off here unless ?fx=1 asks for them. */
const EFFECTS = new URLSearchParams(location.search).get('fx') === '1';

const C_SIM = 'Calculated by the simulator';
const shortName = (name: string) => name.split(',')[0]!;

function Tagline({ children }: { children: ReactNode }) {
  return <span className="whitespace-nowrap rounded-control border border-hairlineStrong px-1.5 py-0.5 text-12 text-text">{children}</span>;
}

// ------------------------------------------------------------------ 3D views

function ViewPanel({ result, run, day, role, recommended, reduced }: { result: WeekResult; run: SimResult; day: number; role: string; recommended: boolean; reduced: boolean }) {
  const k = run.kpis;
  return (
    <Panel aria-label={`${role}: ${result.scenario.name}`} className="flex min-w-0 flex-col overflow-hidden">
      <header className="flex min-h-[40px] flex-wrap items-center gap-x-2 gap-y-1 border-b border-hairline px-3 py-1.5">
        <span className="text-12 text-textMuted">{role}</span>
        <h3 className="text-14 font-semibold">{result.scenario.name}</h3>
        {recommended && <Tagline>Recommended</Tagline>}
      </header>
      <div className="relative h-[240px] overflow-hidden bg-canvas md:h-[320px]">
        <Stage view={VIEW} label={`${result.scenario.name}, day ${day + 1}: Machine 3700, isometric view`} reduced={reduced} effects={EFFECTS}>
          <PlantProvider result={run}>
            <MachineScene interactive={false} />
          </PlantProvider>
        </Stage>
      </div>
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-hairline px-3 py-2 text-12">
        <span className="text-textMuted">
          Day {day + 1}: {run.config.arms.map((a) => mouldsLabel(a.moulds)).join(' · ')}
        </span>
        <span className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="text-textMuted">Tanks this day</span>
          <Num value={SKUS.map((s) => k.tanksTotal[s]).join(' / ')} tag="C" title={`${C_SIM}: CTT4 / CTT2 / HTT2 lifted out of the mould on this day, run-out included`} />
        </span>
      </p>
    </Panel>
  );
}

// ------------------------------------------------------------------ the table

const OUTSIDE: Record<'below' | 'above', string> = { below: 'below minimum', above: 'above cap' };

/** Stock at the end of the week: a strip from NTG's minimum to its cap, a tick at the stock, the number beside it. */
function StockBar({ sku, closing, band }: { sku: Sku; closing: number; band: WeekResult['band'][Sku] }) {
  const min = P.minStock.value[sku];
  const cap = P.warehouseCap.value[sku];
  const top = cap * 1.15;
  const w = 76;
  const x = (v: number) => (Math.min(Math.max(v, 0), top) / top) * w;
  const out = band !== 'in';
  const title = `${sku}: opening ${OPENING_STOCK.value[sku]} + made - average sales ${fmt(P.weeklySalesMean.value[sku], 1)} = ${fmt(closing, 1)} tanks. NTG's minimum is ${min} and the warehouse cap ${cap}`;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap" title={title}>
      <svg width={w} height={12} viewBox={`0 0 ${w} 12`} aria-hidden="true" className="shrink-0">
        <rect x={0} y={5} width={w} height={2} fill={neutral.hairline} />
        <rect x={x(min)} y={3} width={x(cap) - x(min)} height={6} rx={1} fill={neutral.hairlineStrong} stroke={neutral.textFaint} strokeWidth={1} />
        <rect x={x(closing) - 1.5} y={0} width={3} height={12} rx={1} fill={out ? palette.alertRed : neutral.text} />
      </svg>
      <Num value={<span className="inline-block w-[3ch] text-right">{fmt(closing)}</span>} tag="C" title={title} />
      {out && <span className="text-12 text-text">{OUTSIDE[band]}</span>}
      <span className="sr-only">{out ? '' : `, inside the band of ${min} to ${cap}`}</span>
    </span>
  );
}

function CompareTable({ results, recId }: { results: WeekResult[]; recId: string }) {
  const tags = (r: WeekResult) => (
    <>
      {r.scenario.id === BASELINE_ID && <Tagline>Baseline</Tagline>}
      {r.scenario.id === recId && <Tagline>Recommended</Tagline>}
    </>
  );
  const armDaysAll = (r: WeekResult) => r.runs.reduce((s, x) => s + x.config.arms.length, 0);
  const made = (r: WeekResult, k: Sku) => <Num value={r.tanks[k]} tag="C" title={`${C_SIM}: ${k} tanks made on the ${r.runs.length} running days`} />;
  const days = (r: WeekResult) => <Num value={r.tankArmDays} unit={`of ${armDaysAll(r)}`} tag="C" title="Arm-days that carry at least one of the three tanks. The rest go to other products" />;
  const even = (r: WeekResult) => <Num value={fmt(r.coverSpread, 1)} unit="weeks" tag="C" title="Weeks of cover of the most covered product minus the least covered. Smaller is more even" />;
  const th = 'px-3 py-1.5 text-12 font-medium text-textMuted';
  const edge = 'border-l border-hairline';
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse">
          <caption className="sr-only">One week on Machine 3700 under each scenario: tanks made, arm-days used for tanks, stock at the end of the week against NTG's minimum and cap, and evenness of cover</caption>
          <thead>
            <tr>
              <th scope="col" rowSpan={2} className={`${th} border-b border-hairlineStrong text-left align-bottom`}>
                Scenario
              </th>
              <th scope="colgroup" colSpan={3} className={`${th} ${edge} text-left`}>
                Tanks made in the week
              </th>
              <th scope="col" rowSpan={2} className={`${th} ${edge} border-b border-hairlineStrong text-right align-bottom`}>
                Arm-days
              </th>
              <th scope="colgroup" colSpan={3} className={`${th} ${edge} text-left`}>
                Stock at the end of the week, between NTG's minimum and cap
              </th>
              <th scope="col" rowSpan={2} className={`${th} ${edge} border-b border-hairlineStrong text-right align-bottom`}>
                Evenness
                <span className="block font-normal">smaller is more even</span>
              </th>
            </tr>
            <tr className="border-b border-hairlineStrong">
              {SKUS.map((k, i) => (
                <th key={`m${k}`} scope="col" className={`${th} text-right ${i === 0 ? edge : ''}`}>
                  {k}
                </th>
              ))}
              {SKUS.map((k, i) => (
                <th key={`s${k}`} scope="col" className={`${th} text-left ${i === 0 ? edge : ''}`}>
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.scenario.id} className="border-b border-hairline last:border-b-0">
                <th scope="row" className="px-3 py-2 text-left font-normal" title={r.scenario.change}>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-14 font-medium">{r.scenario.name}</span>
                    {tags(r)}
                  </span>
                </th>
                {SKUS.map((k, i) => (
                  <td key={`m${k}`} className={`px-3 py-2 text-right ${i === 0 ? edge : ''}`}>
                    {made(r, k)}
                  </td>
                ))}
                <td className={`px-3 py-2 text-right ${edge}`}>{days(r)}</td>
                {SKUS.map((k, i) => (
                  <td key={`s${k}`} className={`px-3 py-2 ${i === 0 ? edge : ''}`}>
                    <StockBar sku={k} closing={r.closingStock[k]} band={r.band[k]} />
                  </td>
                ))}
                <td className={`px-3 py-2 text-right ${edge}`}>{even(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Phone: one short card per scenario, same figures */}
      <ul className="grid gap-2 md:hidden">
        {results.map((r) => (
          <li key={r.scenario.id} className="rounded-control border border-hairline p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <h4 className="text-14 font-medium">{r.scenario.name}</h4>
              {tags(r)}
            </div>
            <dl className="mt-2 grid gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-12 text-textMuted">Tanks made, {SKUS.join(' / ')}</dt>
                <dd>
                  <Num value={SKUS.map((k) => r.tanks[k]).join(' / ')} tag="C" title={`${C_SIM}: tanks made on the ${r.runs.length} running days`} />
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-12 text-textMuted">Arm-days</dt>
                <dd>{days(r)}</dd>
              </div>
              {SKUS.map((k) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <dt className="text-12 text-textMuted">{k} stock at the end</dt>
                  <dd>
                    <StockBar sku={k} closing={r.closingStock[k]} band={r.band[k]} />
                  </dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-12 text-textMuted">Evenness, smaller is more even</dt>
                <dd>{even(r)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

// ------------------------------------------------------------------- the page

export function RedesignPage() {
  const results = useMemo(() => SCENARIOS.map((s) => evaluateWeek(s)), []);
  const rec = useMemo(() => recommend(results), [results]);
  const base = results.find((r) => r.scenario.id === BASELINE_ID) ?? results[0]!;
  const alternatives = results.filter((r) => r !== base);
  const [altId, setAltId] = useState(() => (alternatives.some((r) => r.scenario.id === rec.id) ? rec.id : alternatives[0]!.scenario.id));
  const [day, setDay] = useState(0);
  const alt = alternatives.find((r) => r.scenario.id === altId) ?? alternatives[0]!;
  const days = Math.min(base.runs.length, alt.runs.length);
  const d = Math.min(day, days - 1);
  const reduced = usePrefersReducedMotion();

  // A new day or scenario starts from the beginning of the shift, in both views.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (mounted) useTwin.getState().seek(0);
    else setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, altId]);

  const visits = distinct(results.flatMap((r) => r.runs.map((x) => x.kpis.ovenVisits)));
  const recResult = results.find((r) => r.scenario.id === rec.id)!;

  return (
    <main className="mx-auto max-w-[1520px] p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <h2 className="text-28 font-medium">Redesign</h2>
          <p className="mt-1 text-14 text-textMuted">Same machine, same oven, same shift. Only the moulds on the arms and the product mix change.</p>
        </div>
        <div className="flex max-w-full flex-wrap items-end gap-x-5 gap-y-2">
          <div className="grid max-w-full gap-1">
            <span className="text-12 text-textMuted">Compare NTG's plan with</span>
            <div className="max-w-full overflow-x-auto">
              <Segmented label="Alternative shown on the right" value={altId} onChange={setAltId} options={alternatives.map((r) => ({ value: r.scenario.id, label: shortName(r.scenario.name) }))} />
            </div>
          </div>
          <div className="grid gap-1">
            <span className="text-12 text-textMuted">Running day</span>
            <Segmented label="Running day of the week" value={d} onChange={setDay} options={Array.from({ length: days }, (_, i) => ({ value: i, label: `Day ${i + 1}` }))} />
          </div>
        </div>
      </header>

      <section aria-label="Side by side, one running day" className="mt-3 grid gap-3">
        <div className="grid gap-3 md:grid-cols-2">
          <ViewPanel result={base} run={base.runs[d]!} day={d} role="Baseline" recommended={base.scenario.id === rec.id} reduced={reduced} />
          <ViewPanel result={alt} run={alt.runs[d]!} day={d} role="Alternative" recommended={alt.scenario.id === rec.id} reduced={reduced} />
        </div>
        <BottomBar result={base.runs[d]!} />
      </section>

      <section aria-labelledby="rd-table" className="mt-3">
        <Panel className="p-2 md:px-2 md:py-1.5">
          <h3 id="rd-table" className="sr-only">
            The week under each scenario
          </h3>
          <CompareTable results={results} recId={rec.id} />
        </Panel>
        <p className="mt-3 text-14">
          <span className="font-medium">Recommended: {recResult.scenario.name}.</span> {rec.reason}
        </p>
        <p className="mt-1 text-12 text-textMuted">
          {visits.length === 1
            ? `Every scenario gives the oven the same ${fmt(visits[0]!)} visits a day, so only the mix changes.`
            : `Oven visits a day run from ${fmt(visits[0]!)} to ${fmt(visits[visits.length - 1]!)} across the scenarios.`}
        </p>
      </section>
    </main>
  );
}
