/**
 * Report page: validation of the twin against NTG's figures, the assumptions
 * register, the data inventory and a guide for the plant owner.
 *
 * Every figure is computed in ./validation.ts or read from the inventory.
 * Gaps are shown as gaps. The page prints black on white (see PRINT_CSS).
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { SPEEDS } from '../../app/store';
import { P, SKUS, inventoryRows, type Tag } from '../../data/params';
import { neutral } from '../../design/tokens';
import { SourceBadge } from '../../design/SourceBadge';
import { defaultConfig } from '../../sim/config';
import { Button, Num, fmt } from '../../ui/kit';
import { mouldsLabel } from '../../ui/stage';
import { GROUPS, assumptions } from './assumptions';
import { InventoryTable } from './InventoryTable';
import { ChartLegend, DailyOutputChart, JumpContext, Rich, RowRef, Section, Sub, T, TagCell, Td, VerdictMark, goTo } from './parts';
import { FIELD_TIMING, VERDICT_LABEL, invRow, sumSku, triple, validation, type RunSummary, type Verdict } from './validation';

const C_SIM = 'Calculated by the simulator';

/** Chart fills as classes so the print rules can replace them, and the print layout itself. */
const PAGE_CSS = `
.rp-bar-four { fill: ${neutral.text}; }
.rp-bar-three { fill: ${neutral.steelMid}; }
.rp-bar-multiple { fill: ${neutral.hairlineStrong}; stroke: ${neutral.steelMid}; stroke-width: 1; }
.rp-bar-none { fill: transparent; stroke: ${neutral.textFaint}; stroke-width: 1; stroke-dasharray: 3 2; }
.rp-ink { fill: ${neutral.text}; }
.rp-ink-muted { fill: ${neutral.textMuted}; }
.rp-axis { stroke: ${neutral.hairlineStrong}; stroke-width: 1; }
@media print {
  @page { size: A4; margin: 12mm; }
  html, body, #root { height: auto !important; overflow: visible !important; background: #fff !important; }
  *:has(.rp-root) { position: static !important; overflow: visible !important; height: auto !important; max-height: none !important; inset: auto !important; background: #fff !important; }
  body *:not(:has(.rp-root)):not(.rp-root):not(.rp-root *) { display: none !important; }
  .rp-root { max-width: none !important; padding: 0 !important; }
  .rp-root, .rp-root * { color: #000 !important; background: transparent !important; border-color: #888 !important; }
  .rp-root .rp-noprint, .rp-root .rp-controls { display: none !important; }
  .rp-root .rp-scroll { max-height: none !important; overflow: visible !important; }
  .rp-root thead { position: static !important; }
  .rp-root .rp-row, .rp-root .rp-figure, .rp-root .rp-conflict { break-inside: avoid; }
  .rp-root h3, .rp-root h4, .rp-root h5 { break-after: avoid; }
  .rp-root .rp-link { text-decoration: none !important; }
  .rp-root .rp-mark-gap { background: #000 !important; }
  .rp-root .rp-mark-ok { background: #999 !important; }
  .rp-root .rp-bar-four { fill: #000 !important; }
  .rp-root .rp-bar-three { fill: #777 !important; }
  .rp-root .rp-bar-multiple { fill: #ccc !important; stroke: #000 !important; }
  .rp-root .rp-bar-none { fill: #fff !important; stroke: #000 !important; }
  .rp-root .rp-ink, .rp-root .rp-ink-muted { fill: #000 !important; }
  .rp-root .rp-axis { stroke: #000 !important; }
}
`;

const TOC: { id: string; label: string; sub?: { id: string; label: string }[] }[] = [
  {
    id: 'rp-validation',
    label: 'Validation summary',
    sub: [
      { id: 'rp-erp', label: 'ERP checks' },
      { id: 'rp-rejected', label: 'Readings we rejected' },
      { id: 'rp-field', label: 'Field timing' },
      { id: 'rp-conflicts', label: 'Known data conflicts' },
    ],
  },
  { id: 'rp-assumptions', label: 'Assumptions register' },
  { id: 'rp-inventory', label: 'Data inventory' },
  { id: 'rp-plan', label: 'Plan check' },
  { id: 'rp-guide', label: 'Owner guide' },
];

function C({ value, unit, title }: { value: ReactNode; unit?: string; title?: string }) {
  return <Num value={value} unit={unit} tag="C" title={title ?? C_SIM} />;
}
function Rows({ rows }: { rows: number[] }) {
  if (rows.length === 0) return null;
  return (
    <span className="text-12 text-textMuted">
      {rows.length > 1 ? 'rows ' : 'row '}
      {rows.map((n, i) => (
        <span key={n}>
          {i > 0 ? ', ' : ''}
          <RowRef row={n} />
        </span>
      ))}
    </span>
  );
}
const PrintButton = () => (
  <Button onClick={() => window.print()} className="rp-noprint !px-3 !py-1.5">
    Print or save as PDF
  </Button>
);

// ------------------------------------------------------------- 1. validation

function SummaryTable() {
  const v = validation();
  return (
    <div className={T.wrap}>
      <table className={T.table}>
        <caption className="sr-only">Twin against NTG's figures for one typical shift: metric, twin, NTG figure with its source, difference and verdict</caption>
        <thead className={T.thead}>
          <tr>
            {['Metric', 'Twin', 'NTG figure', 'Difference', 'Verdict, in plain words'].map((h) => (
              <th key={h} scope="col" className={T.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={T.tbody}>
          {v.rows.map((r) => (
            <tr key={r.id} className={T.tr}>
              <th scope="row" className={`${T.td} text-left font-medium md:w-[15%]`}>
                {r.metric}
              </th>
              <Td label="Twin" className="md:w-[13%]">
                <C value={r.twin} title={`${C_SIM}. ${r.twinTitle}`} />
              </Td>
              <Td label="NTG figure" className="md:w-[16%]">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className={r.ntgTag ? 'num' : 'text-textMuted'}>{r.ntg}</span>
                  {r.ntgTag && <TagCell tag={r.ntgTag} title={r.ntgTitle} />}
                </span>
                <Rows rows={r.ntgRows} />
              </Td>
              <Td label="Difference" className="num md:w-[9%]">
                {r.difference}
              </Td>
              <Td label="Verdict, in plain words">
                <VerdictMark verdict={r.verdict} />
                <p className="mt-1 text-12 text-textMuted">
                  <Rich text={r.words} />
                </p>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Identity() {
  const { identity: id, base } = validation();
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      <div className={T.wrap}>
        <table className="w-full border-collapse">
          <caption className="sr-only">The task times of one arm cycle added up, against NTG's 120 minute cycle</caption>
          <thead>
            <tr>
              <th scope="col" className={T.th}>
                Step of one arm cycle
              </th>
              <th scope="col" className={`${T.th} text-right`}>
                Minutes
              </th>
              <th scope="col" className={T.th}>
                Row
              </th>
            </tr>
          </thead>
          <tbody>
            {id.parts.map((p) => (
              <tr key={p.label} className="border-b border-hairline">
                <th scope="row" className="px-3 py-1.5 text-left text-14 font-normal">
                  {p.label}
                </th>
                <td className="px-3 py-1.5 text-right">
                  <Num value={fmt(p.min, 1)} tag={p.tag} title={`Inventory row ${p.row}: ${invRow(p.row).source}`} />
                </td>
                <td className="px-3 py-1.5">
                  <RowRef row={p.row} />
                </td>
              </tr>
            ))}
            <tr className="border-b border-hairline">
              <th scope="row" className="px-3 py-1.5 text-left text-14 font-normal">
                {id.indexMoves} moves between positions x {fmt(id.indexMin, 1)} min
              </th>
              <td className="px-3 py-1.5 text-right">
                <Num value={fmt(id.indexMoves * id.indexMin, 1)} tag="S" title="Assumption A9: index time, not timed" />
              </td>
              <td className="px-3 py-1.5 text-12 text-textMuted">A9</td>
            </tr>
            <tr className="border-b border-hairline">
              <th scope="row" className="px-3 py-1.5 text-left text-14 font-medium">
                Sum of the estimates
              </th>
              <td className="px-3 py-1.5 text-right">
                <C value={fmt(id.sumMin, 1)} title="Sum of the rows above" />
              </td>
              <td />
            </tr>
            <tr className="border-b border-hairline">
              <th scope="row" className="px-3 py-1.5 text-left text-14 font-normal">
                NTG arm cycle
              </th>
              <td className="px-3 py-1.5 text-right">
                <Num value={fmt(id.cycleMin, 1)} datum={P.armCycleMin} />
              </td>
              <td className="px-3 py-1.5">
                <RowRef row={P.armCycleMin.row} />
              </td>
            </tr>
            <tr>
              <th scope="row" className="px-3 py-1.5 text-left text-14 font-medium">
                Minutes no estimate covers
              </th>
              <td className="px-3 py-1.5 text-right">
                <C value={fmt(id.unexplainedMin, 1)} title="NTG arm cycle minus the sum of the estimates" />
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="max-w-[640px] text-14 text-textMuted">
        <p>
          NTG says the {fmt(id.cycleMin)} min cycle covers one arm through every stage, waits included (<Rows rows={[48]} />
          ). Added up, the times NTG and the team gave come to <span className="num text-text">{fmt(id.sumMin, 1)}</span> min. <span className="num text-text">{fmt(id.unexplainedMin, 1)}</span> min are left over.
        </p>
        <p className="mt-2">
          In the twin the cycle is set by the oven, so those minutes cannot vanish: they turn up as waiting before the oven, <span className="num text-text">{fmt(base.waitOvenMin, 1)}</span> min against NTG's{' '}
          <span className="num text-text">{P.waitBeforeOvenMin.value}</span>. The inventory flags the same hole from the other side (<Rows rows={[P.demouldMin.row]} />: "{invRow(P.demouldMin.row).notes}").
        </p>
        <p className="mt-2">Either the wait before the oven is longer than NTG thinks, or demould takes longer than the placeholder, or both. A stopwatch on one shift would say which.</p>
      </div>
    </div>
  );
}

function runCells(r: RunSummary) {
  return (
    <>
      <Td label="Arm cycle" className="md:text-right">
        <C value={fmt(r.cycleMin, 1)} unit="min" />
      </Td>
      <Td label="Wait before the oven" className="md:text-right">
        <C value={fmt(r.waitOvenMin, 1)} unit="min" />
      </Td>
      <Td label="Held after the oven, per visit" className="md:text-right">
        <C value={fmt(r.blockedMin, 1)} unit="min" title={`${C_SIM}: minutes an arm has finished its work but the next position is still occupied, per oven visit`} />
      </Td>
      <Td label="Tanks from the shift" className="md:text-right">
        <C value={`${triple(r.tanksTotal)} (${r.total})`} />
      </Td>
      <Td label="Run-out after the mark" className="md:text-right">
        <C value={fmt(r.runOutMin, 1)} unit="min" />
      </Td>
    </>
  );
}

function DemouldSweep() {
  const { demould: d, base } = validation();
  const used = defaultConfig().times.demould;
  return (
    <>
      <p className="mb-3 max-w-[920px] text-14 text-textMuted">
        The demould time is the least certain input: a placeholder of <span className="num text-text">{fmt(used)}</span> min, with a range of <span className="num text-text">{fmt(d.range[0])}</span> to{' '}
        <span className="num text-text">{fmt(d.range[1])}</span> (<Rows rows={[P.demouldMin.row]} />
        ). Each line below is a full simulator run with only that time changed. Up to <span className="num text-text">{fmt(d.holdsCycleUpTo)}</span> min the cycle and the {base.total} tanks hold and only the wait before the oven moves. Above it, arms are held in the cooling positions and output falls.
      </p>
      <div className={T.wrap}>
        <table className={T.table}>
          <caption className="sr-only">Simulator runs with the demould time changed across its range</caption>
          <thead className={T.thead}>
            <tr>
              {['Demould time', 'Arm cycle', 'Wait before the oven', 'Held after the oven, per visit', 'Tanks from the shift', 'Run-out after the mark'].map((h, i) => (
                <th key={h} scope="col" className={`${T.th} ${i > 0 ? 'md:text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={T.tbody}>
            {d.sweep.map((s) => (
              <tr key={s.value} className={T.tr}>
                <th scope="row" className={`${T.td} text-left font-normal`}>
                  <Num value={fmt(s.value)} unit="min" tag="S" title={`Demould and mould prep time tried. Inventory row ${P.demouldMin.row} gives the range`} />
                  {s.value === used && <span className="ml-2 rounded-control border border-hairlineStrong px-1.5 py-0.5 text-12">used in the twin</span>}
                </th>
                {runCells(s.run)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ErpChecks() {
  const v = validation();
  const w = v.weekNov2;
  const dates = w.days.map((d) => new Date(`${d.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }));
  return (
    <>
      <p className="mb-3 max-w-[920px] text-14 text-textMuted">
        The ERP stock cards were not used to calibrate the twin, so they are an independent check. For each product, the bars show how often each daily quantity was booked on a production day. The twin makes{' '}
        <span className="num text-text">{triple(v.base.tanksTotal)}</span> in a typical shift with all four arms working, and <span className="num text-text">{SKUS.map((k) => v.erp[k].threeArm.join(' or ')).join(' / ')}</span> when one arm carries no mould (three arms cycle faster). Both figures come from simulator runs. The ERP does not record which moulds were on the machine, so a match on quantity is evidence, not proof.
      </p>
      <ChartLegend />
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        {SKUS.map((k) => (
          <div key={k} className="panel rp-panel min-w-0 p-3">
            <DailyOutputChart check={v.erp[k]} />
          </div>
        ))}
      </div>

      <h5 className="mt-5 text-14 font-medium">Week of 2 to 6 Nov: ERP production against mould-days x {P.cyclesPerMouldPerDay.value} cycles</h5>
      <p className="mb-2 mt-1 max-w-[920px] text-12 text-textMuted">
        The ERP books production on {dates.join(', ')}. The set-up is not recorded; the one assumed here is {w.setup.map((a) => mouldsLabel(a.moulds)).join(', ')} (the first day of NTG's plan for the following week), which gives the same daily quantities.
      </p>
      <div className={T.wrap}>
        <table className={T.table}>
          <caption className="sr-only">Week of 2 to 6 November: ERP production per product against mould-days times cycles and against the twin</caption>
          <thead className={T.thead}>
            <tr>
              {['Product', `ERP, tanks on ${dates.join(', ')}`, 'ERP week', 'Production days', 'Moulds on (assumed)', `Mould-days x ${P.cyclesPerMouldPerDay.value}`, 'Twin, same days', 'Twin less ERP'].map((h, i) => (
                <th key={h} scope="col" className={`${T.th} ${i > 0 ? 'md:text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={T.tbody}>
            {SKUS.map((k) => (
              <tr key={k} className={T.tr}>
                <th scope="row" className={`${T.td} text-left font-medium`}>
                  {k}
                </th>
                <Td label="ERP, tanks by day" className="md:text-right">
                  <Num value={w.days.map((d) => d.erp[k]).join(' / ')} tag="N" title="NTG ERP stock cards, daily production" />
                </Td>
                <Td label="ERP week" className="md:text-right">
                  <Num value={w.erp[k]} datum={P.productionWeek2Nov} />
                </Td>
                <Td label="Production days" className="md:text-right">
                  <Num value={w.productionDays[k]} tag="N" title="Days with production booked in the ERP that week" />
                </Td>
                <Td label="Moulds on (assumed)" className="md:text-right">
                  <Num value={w.moulds[k]} tag="S" title="Assumed set-up: the ERP does not record moulds" />
                </Td>
                <Td label={`Mould-days x ${P.cyclesPerMouldPerDay.value}`} className="md:text-right">
                  <C value={w.rule[k]} title={`${w.moulds[k]} moulds x ${w.productionDays[k]} days x ${P.cyclesPerMouldPerDay.value} cycles (row ${P.cyclesPerMouldPerDay.row})`} />
                </Td>
                <Td label="Twin, same days" className="md:text-right">
                  <C value={w.twin[k]} title={`${C_SIM}: ${w.twinPerDay[k]} a day for this set-up x ${w.productionDays[k]} days`} />
                </Td>
                <Td label="Twin less ERP" className="num md:text-right">
                  {w.diff[k] > 0 ? '+' : ''}
                  {w.diff[k]}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 max-w-[920px] text-12 text-textMuted">
        Total: twin <span className="num text-text">{sumSku(w.twin)}</span>, ERP <span className="num text-text">{sumSku(w.erp)}</span>. The one tank of difference is the CTT4 day that booked{' '}
        <span className="num text-text">{Math.min(...w.days.map((d) => d.erp.CTT4))}</span> instead of <span className="num text-text">{w.twinPerDay.CTT4}</span>. The ERP does not say why.
      </p>
    </>
  );
}

function Rejected() {
  const v = validation();
  return (
    <>
      <p className="mb-3 max-w-[920px] text-14 text-textMuted">
        Four other readings of the visit notes are still in the simulator as switches. Each line is run live with that switch set. All of them give fewer tanks than NTG reports, which is why they are not the default. The first three can be tried in the set-up drawer of the Machine page.
      </p>
      <div className={T.wrap}>
        <table className={T.table}>
          <caption className="sr-only">Readings of the process that were rejected, with the cycle and tanks each one gives</caption>
          <thead className={T.thead}>
            <tr>
              {['Reading', 'Arm cycle', 'Oven visits per arm', 'Tanks from the shift', 'Why it contradicts NTG'].map((h, i) => (
                <th key={h} scope="col" className={`${T.th} ${i > 0 && i < 4 ? 'md:text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={T.tbody}>
            <tr className={T.tr}>
              <th scope="row" className={`${T.td} text-left font-normal md:w-[26%]`}>
                The twin's default
                <span className="mt-1 block text-12 text-textMuted">One oven visit per arm, pauses inside it, air cooling at the open position</span>
              </th>
              <Td label="Arm cycle" className="md:text-right">
                <C value={fmt(v.base.cycleMin, 1)} unit="min" />
              </Td>
              <Td label="Oven visits per arm" className="md:text-right">
                <C value={fmt(v.base.cyclesPerArm, 2)} />
              </Td>
              <Td label="Tanks from the shift" className="md:text-right">
                <C value={`${triple(v.base.tanksTotal)} (${v.base.total})`} />
              </Td>
              <Td label="Why" className="text-12 text-textMuted">
                Reproduces NTG's cycle and shift output.
              </Td>
            </tr>
            {v.rejected.map((r) => (
              <tr key={r.id} className={T.tr}>
                <th scope="row" className={`${T.td} text-left font-normal md:w-[26%]`}>
                  {r.reading}
                  <span className="num mt-1 block text-12 text-textMuted">{r.setting}</span>
                </th>
                <Td label="Arm cycle" className="md:text-right">
                  <C value={fmt(r.run.cycleMin, 1)} unit="min" />
                </Td>
                <Td label="Oven visits per arm" className="md:text-right">
                  <C value={fmt(r.run.cyclesPerArm, 2)} />
                </Td>
                <Td label="Tanks from the shift" className="md:text-right">
                  <C value={`${triple(r.run.tanksTotal)} (${r.run.total})`} />
                </Td>
                <Td label="Why it contradicts NTG" className="text-12 text-textMuted">
                  <Rich text={r.why} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Conflicts() {
  const v = validation();
  return (
    <ol className="grid gap-3 lg:grid-cols-2">
      {v.conflicts.map((c, i) => (
        <li key={c.id} className="panel rp-panel rp-conflict p-3">
          <h5 className="text-14 font-medium">
            <span className="num mr-2 text-textMuted">{i + 1}</span>
            {c.title}
          </h5>
          <p className="mt-1.5 text-14">
            <Rich text={c.statement} />
          </p>
          <p className="mt-1.5 text-12 text-textMuted">
            <span className="font-medium text-text">What the twin does. </span>
            <Rich text={c.handling} />
          </p>
          <ul className="mt-2 grid gap-1 border-l-2 border-hairlineStrong pl-3">
            {c.quotes.map((q, j) => (
              <li key={j} className="text-12 text-textMuted">
                Inventory <Rows rows={[q.row]} />, {q.parameter}: "{q.text}"
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------ 2. assumptions

function Assumptions() {
  const rows = assumptions();
  const heads = ['ID', 'Decision', 'Value used', 'Tag', 'Alternative considered', 'Why this one', 'Where it is used', 'How to replace it'];
  return (
    <div className="grid gap-5">
      {GROUPS.map((g) => {
        const list = rows.filter((r) => r.group === g);
        return (
          <div key={g}>
            <h4 className="text-14 font-semibold">
              {g} <span className="num font-normal text-textMuted">({list.length})</span>
            </h4>
            {g === 'Display only' && <p className="mt-1 text-12 text-textMuted">These change the picture only. No count, time or KPI depends on them.</p>}
            <div className={`${T.wrap} mt-2`}>
              <table className={T.table}>
                <caption className="sr-only">Assumptions: {g}</caption>
                <thead className={T.thead}>
                  <tr>
                    {heads.map((h) => (
                      <th key={h} scope="col" className={T.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={T.tbody}>
                  {list.map((r) => (
                    <tr key={r.id} id={`as-${r.id}`} className={T.tr}>
                      <Td label="ID" className="num text-textMuted md:w-[48px]">
                        {r.id}
                      </Td>
                      <Td label="Decision" className="font-medium md:w-[11%]">
                        {r.decision}
                      </Td>
                      <Td label="Value used" className="md:w-[15%]">
                        {r.value}
                      </Td>
                      <Td label="Tag" className="md:w-[40px]">
                        <SourceBadge tag={r.tag} />
                      </Td>
                      <Td label="Alternative considered" className="md:w-[15%]">
                        <Rich text={r.alternative} />
                      </Td>
                      <Td label="Why this one">
                        <Rich text={r.why} />
                        {r.rows.length > 0 && (
                          <span className="mt-1 block">
                            <Rows rows={r.rows} />
                          </span>
                        )}
                      </Td>
                      <Td label="Where it is used" className="text-12 text-textMuted md:w-[13%]">
                        {r.usedIn}
                      </Td>
                      <Td label="How to replace it" className="text-12 text-textMuted md:w-[13%]">
                        {r.replace}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------ 5. owner guide

function OwnerGuide() {
  const v = validation();
  const speeds = `${SPEEDS[0]}x to ${SPEEDS[SPEEDS.length - 1]}x`;
  const steps: [string, ReactNode][] = [
    ['Watch a shift.', `Open Machine and press Play. The machine runs one ${fmt(P.shiftHours.value, 1)} hour shift. Choose a speed from ${speeds}. Drag the bar at the bottom to jump to any moment; its colours show when the oven is heating.`],
    ['Read the panels.', 'On the left, each arm shows what it is doing and how long is left, or how long it has waited. On the right are three figures: tanks out of the mould against the plan, how much of the shift the oven has been in use, and where arms are waiting now.'],
    ['Red ring, amber outline.', 'A red ring on the floor means that arm is waiting. An amber outline round the oven means arms are queuing for it: the oven is setting the pace.'],
    ['Change the set-up.', 'Press Set-up and choose the moulds on each arm. The shift is worked out again at once.'],
    ['Compare a redesign.', "Open Redesign to see NTG's planned week beside another mix, with tanks, oven load and stock for each."],
    ['Plan next week.', "Open Plan. NTG's numbers are filled in; change stock, demand or arm-days and read how many arm-cycles of each tank to schedule."],
    ['The letters.', 'N: NTG told us. V: we saw it on a visit. C: calculated from those. S: an estimate, to be treated with care. Point at a letter to see where the number comes from.'],
  ];
  return (
    <div className="max-w-[820px]">
      <ol className="grid gap-2.5">
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
      <div className="panel rp-panel mt-4 p-3">
        <h4 className="text-14 font-semibold">Honest limits</h4>
        <p className="mt-1 text-14 text-textMuted">
          The twin is calibrated, not validated. It reproduces the cycle and shift output NTG reported ({fmt(v.base.cycleMin)} min, {triple(v.base.tanksTotal)} tanks), but nobody has timed a shift yet, and two figures do not match: the wait before the oven and the tanks out by the end of the shift. Prices on the Sourcing page are researched estimates, not supplier quotes.
        </p>
        <h4 className="mt-3 text-14 font-semibold">How it was built</h4>
        <p className="mt-1 text-14 text-textMuted">
          This tool was built with AI assistance. The team is responsible for checking that it is correct. What was checked, and what could not be, is listed in this report.
        </p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the page

export function ReportPage() {
  const v = useMemo(() => validation(), []);
  const rows = useMemo(() => assumptions(), []);
  const [focus, setFocus] = useState<{ row: number; n: number } | null>(null);
  const jump = useCallback((row: number) => setFocus((f) => ({ row, n: (f?.n ?? 0) + 1 })), []);
  const count = (x: Verdict) => v.rows.filter((r) => r.verdict === x).length;
  const tags = (['N', 'V', 'C', 'S'] as Tag[]).map((t) => `${rows.filter((r) => r.tag === t).length} ${t}`).join(', ');

  return (
    <JumpContext.Provider value={jump}>
      <main className="rp-root mx-auto max-w-[1520px] p-4 md:p-6">
        <style>{PAGE_CSS}</style>
        <header>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-28 font-medium">Report</h2>
              <p className="mt-1 max-w-[880px] text-14">
                What the twin of Machine 3700 gets right, where it does not match NTG's figures, what was assumed and where every number comes from.
              </p>
            </div>
            <PrintButton />
          </div>
          <p className="mt-2 max-w-[880px] text-12 text-textMuted">
            Status: calibrated, not validated. The twin reproduces the figures NTG reported; it has not been checked against a timed shift, because none was supplied. Row numbers open the data inventory in section 3.
          </p>
          <nav aria-label="Report sections" className="rp-noprint panel mt-4 p-3">
            <h3 className="text-12 font-medium text-textMuted">Contents</h3>
            <ol className="mt-1.5 grid gap-x-6 gap-y-1.5 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
              {TOC.map((s, i) => (
                <li key={s.id} className="min-w-0">
                  <button type="button" onClick={() => goTo(s.id)} className="rounded-control text-left text-14 underline decoration-hairlineStrong underline-offset-2 hover:decoration-text">
                    <span className="num mr-1.5 text-textMuted">{i + 1}</span>
                    {s.label}
                  </button>
                  {s.sub && (
                    <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 pl-4">
                      {s.sub.map((x) => (
                        <li key={x.id}>
                          <button type="button" onClick={() => goTo(x.id)} className="rounded-control text-left text-12 text-textMuted underline decoration-hairlineStrong underline-offset-2 hover:text-text">
                            {x.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </header>

        <Section
          id="rp-validation"
          n={1}
          title="Validation summary"
          lead={
            <>
              One typical shift in the twin (one CTT4 mould, two CTT2, two HTT2 and one arm on other products) against the figures NTG and the visit gave. Of <span className="num text-text">{v.rows.length}</span> comparisons,{' '}
              <span className="num text-text">{count('match')}</span> match, <span className="num text-text">{count('gap')}</span> are real gaps, <span className="num text-text">{count('input')}</span> only plays an input back and{' '}
              <span className="num text-text">{count('no-data')}</span> has nothing to be checked against. The matches are what the twin was calibrated to, so they show it is consistent with NTG's figures, not that it is proven.
            </>
          }
        >
          <SummaryTable />
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-12 text-textMuted" aria-label="Verdicts">
            {(Object.keys(VERDICT_LABEL) as Verdict[]).map((k) => (
              <li key={k} className="flex items-center gap-2">
                <VerdictMark verdict={k} />
              </li>
            ))}
          </ul>

          <Sub title={`Where the ${P.armCycleMin.value} minutes go`}>
            <Identity />
          </Sub>
          <Sub title="The demould placeholder, across its range">
            <DemouldSweep />
          </Sub>
          <Sub id="rp-erp" title="ERP checks: daily output on production days">
            <ErpChecks />
          </Sub>
          <Sub id="rp-rejected" title="Readings we rejected">
            <Rejected />
          </Sub>
          <Sub id="rp-field" title="Field timing">
            <div className="panel rp-panel max-w-[920px] p-3">
              <p className="text-14 font-semibold">Field timing: {FIELD_TIMING.status}</p>
              <p className="mt-1 text-14 text-textMuted">{FIELD_TIMING.text}</p>
              <p className="mt-2 text-12 text-textMuted">
                Inventory rows that name a timed shift as their replacement (<span className="num text-text">{FIELD_TIMING.rows.length}</span>):{' '}
                {FIELD_TIMING.rows.map((n, i) => (
                  <span key={n}>
                    {i > 0 ? ', ' : ''}
                    <RowRef row={n} /> <span>{inventoryRows.find((r) => r.row === n)?.parameter.toLowerCase()}</span>
                  </span>
                ))}
                .
              </p>
            </div>
          </Sub>
          <Sub id="rp-conflicts" title="Known data conflicts">
            <p className="mb-3 max-w-[920px] text-14 text-textMuted">
              Places where two sources disagree, or where a figure does not add up. None is hidden or averaged away. Each card gives both sides with the numbers, what the twin does about it, and the inventory's own note.
            </p>
            <Conflicts />
          </Sub>
        </Section>

        <Section
          id="rp-assumptions"
          n={2}
          title="Assumptions register"
          lead={
            <>
              <span className="num text-text">{rows.length}</span> modelling decisions that are not confirmed NTG facts ({tags}). Each has the value the twin uses, an alternative that was considered and the reason for the choice. Numbers in the sentences are read from the inventory or from a simulator run when the page loads. The same register is in docs/ASSUMPTIONS.md.
            </>
          }
        >
          <Assumptions />
        </Section>

        <Section
          id="rp-inventory"
          n={3}
          title="Data inventory"
          lead={
            <>
              All <span className="num text-text">{inventoryRows.length}</span> rows of the team's data inventory (data/NTG_Data_Inventory_v1.xlsx). Every figure in the twin that carries an N, V, C or S letter points to one of these rows, or to an entry of the register above.
            </>
          }
        >
          <InventoryTable focus={focus} />
        </Section>

        <Section id="rp-plan" n={4} title="Plan check">
          <p className="max-w-[820px] text-14">
            The weekly plan is a separate model, and its check is on the Plan page under "Manual check": a case small enough to solve by hand, set beside the solver's answer. Open Plan and scroll to that section to see the two agree.
          </p>
        </Section>

        <Section id="rp-guide" n={5} title="Owner guide" lead="How to use the twin, for someone who runs the plant and has no operations training.">
          <OwnerGuide />
        </Section>

        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
          <PrintButton />
          <span className="rp-noprint text-12 text-textMuted">Prints black on white, with every table in full.</span>
        </div>
      </main>
    </JumpContext.Provider>
  );
}
