/**
 * Report page, one screen: is the twin right, and what problem does it show.
 *
 * A short validation table, two charts and the five assumptions that matter
 * most. Everything is computed in ./validation.ts and ./assumptions.ts; the
 * full material is in docs/ (VALIDATION.md, ASSUMPTIONS.md, MODEL.md,
 * OWNER_GUIDE.md). The page prints black on white on one A4 landscape sheet.
 */
import { useMemo } from 'react';
import { SKUS } from '../../data/params';
import { neutral, palette } from '../../design/tokens';
import { Button, Num, Panel, fmt } from '../../ui/kit';
import { MAIN_ASSUMPTIONS, assumptions } from './assumptions';
import { DailyOutputChart, OutputLegend, StockChart } from './charts';
import { PAGE_ROWS, VERDICT_LABEL, validation, type ValidationRow, type Verdict } from './validation';

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
.rp-hover { fill: ${neutral.hairline}; }
.rp-band { fill: ${neutral.hairline}; }
.rp-limit { stroke: ${neutral.textFaint}; stroke-width: 1; stroke-dasharray: 3 3; }
.rp-line { stroke: ${neutral.text}; stroke-width: 1.5; stroke-linejoin: round; }
.rp-out { fill: ${palette.alertRed}; stroke: ${palette.panel}; stroke-width: 1; }
.rp-ring { fill: none; stroke: ${neutral.text}; stroke-width: 1.5; }
.rp-mark-ok { fill: ${neutral.steelLight}; }
.rp-mark-gap { fill: ${palette.alertRed}; }
.rp-mark-open { fill: none; stroke: ${neutral.textMuted}; stroke-width: 1; }
@media print {
  /* Landscape, and scaled so the whole page fits on one sheet. The desktop layout is forced with
     print: classes, because Chrome settles width breakpoints before it applies the landscape page. */
  @page { size: A4 landscape; margin: 9mm; }
  html, body, #root { height: auto !important; overflow: visible !important; background: #fff !important; }
  *:has(.rp-root) { position: static !important; overflow: visible !important; height: auto !important; min-height: 0 !important; max-height: none !important; inset: auto !important; background: #fff !important; }
  body *:not(:has(.rp-root)):not(.rp-root):not(.rp-root *) { display: none !important; }
  .rp-root { max-width: none !important; padding: 0 !important; zoom: 0.74; }
  .rp-root, .rp-root * { color: #000 !important; background: transparent !important; border-color: #888 !important; }
  .rp-root .rp-noprint { display: none !important; }
  .rp-root .rp-mark-gap { fill: #000 !important; }
  .rp-root .rp-mark-ok { fill: #999 !important; }
  .rp-root .rp-mark-open { stroke: #000 !important; }
  .rp-root .rp-bar-four { fill: #000 !important; }
  .rp-root .rp-bar-three { fill: #777 !important; }
  .rp-root .rp-bar-multiple { fill: #ccc !important; stroke: #000 !important; }
  .rp-root .rp-bar-none { fill: #fff !important; stroke: #000 !important; }
  .rp-root .rp-ink, .rp-root .rp-ink-muted { fill: #000 !important; }
  .rp-root .rp-axis, .rp-root .rp-limit { stroke: #000 !important; }
  .rp-root .rp-band { fill: #e6e6e6 !important; }
  .rp-root .rp-line { stroke: #000 !important; }
  .rp-root .rp-out { fill: #000 !important; stroke: #fff !important; }
}
`;

/** Verdict as a small mark plus one or two words. Red is a fill, never the text. Drawn as SVG so it also prints. */
function VerdictMark({ verdict }: { verdict: Verdict }) {
  const cls = verdict === 'gap' ? 'rp-mark-gap' : verdict === 'match' ? 'rp-mark-ok' : 'rp-mark-open';
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-14 font-medium">
      <svg width={10} height={10} aria-hidden="true" className="shrink-0">
        <rect x={0.5} y={0.5} width={9} height={9} rx={2} className={cls} />
      </svg>
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

function Twin({ r }: { r: ValidationRow }) {
  return <Num value={r.twin} tag="C" title={`${C_SIM}. ${r.twinTitle}`} />;
}
function Ntg({ r }: { r: ValidationRow }) {
  return r.ntgTag ? <Num value={r.ntg} tag={r.ntgTag} title={r.ntgTitle} /> : <span className="text-12 text-textMuted">{r.ntg}</span>;
}

function ValidationTable({ rows }: { rows: ValidationRow[] }) {
  const th = 'border-b border-hairlineStrong px-3 py-1.5 text-left text-12 font-medium text-textMuted';
  const td = 'px-3 py-1.5 align-baseline';
  return (
    <>
      <table className="hidden w-full border-collapse md:table print:table">
        <caption className="sr-only">The twin against NTG's figures for one typical shift</caption>
        <thead>
          <tr>
            {['One typical shift', 'Twin', 'NTG', 'Verdict', ''].map((h, i) => (
              <th key={i} scope="col" className={th}>
                {h || <span className="sr-only">Note</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-hairline last:border-b-0">
              <th scope="row" className={`${td} text-left text-14 font-medium`}>
                {r.metric}
              </th>
              <td className={td}>
                <Twin r={r} />
              </td>
              <td className={td}>
                <Ntg r={r} />
              </td>
              <td className={td}>
                <VerdictMark verdict={r.verdict} />
              </td>
              <td className={`${td} text-12 text-textMuted`}>{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Phone: the same rows as short blocks */}
      <ul className="md:hidden print:hidden">
        {rows.map((r) => (
          <li key={r.id} className="border-b border-hairline px-3 py-2 last:border-b-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-14 font-medium">{r.metric}</span>
              <VerdictMark verdict={r.verdict} />
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-12 text-textMuted">
              <span className="inline-flex items-baseline gap-1.5">
                Twin <Twin r={r} />
              </span>
              <span className="inline-flex items-baseline gap-1.5">
                NTG <Ntg r={r} />
              </span>
            </div>
            <p className="mt-0.5 text-12 text-textMuted">{r.note}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

const DOCS: [string, string][] = [
  ['docs/ASSUMPTIONS.md', 'all assumptions with alternatives'],
  ['docs/VALIDATION.md', 'full checks and data conflicts'],
  ['docs/MODEL.md', 'how the simulator works'],
  ['docs/OWNER_GUIDE.md', 'how to use the twin'],
];

export function ReportPage() {
  const v = useMemo(() => validation(), []);
  const all = useMemo(() => assumptions(), []);
  const rows = PAGE_ROWS.map((id) => v.rows.find((r) => r.id === id)!);
  const main = MAIN_ASSUMPTIONS.map((id) => all.find((a) => a.id === id)!);
  const weeks = v.stock.CTT4.weeks.length;

  return (
    <main className="rp-root mx-auto max-w-[1520px] p-4 md:p-6">
      <style>{PAGE_CSS}</style>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-28 font-medium">Report</h2>
          <p className="mt-1 text-14 text-textMuted">Calibrated against NTG's figures. Not yet timed on the floor.</p>
        </div>
        <Button onClick={() => window.print()} className="rp-noprint !px-3 !py-1.5">
          Print or save as PDF
        </Button>
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-12 print:grid-cols-12">
        <Panel aria-labelledby="rp-validation" className="overflow-hidden lg:col-span-8 print:col-span-8">
          <h3 id="rp-validation" className="px-3 pb-1 pt-2.5 text-14 font-semibold">
            Does the twin match NTG
          </h3>
          <ValidationTable rows={rows} />
        </Panel>

        <Panel aria-labelledby="rp-assumptions" className="p-3 lg:col-span-4 print:col-span-4">
          <h3 id="rp-assumptions" className="text-14 font-semibold">
            Main assumptions
          </h3>
          <ul className="mt-2 grid gap-1.5">
            {main.map((a) => (
              <li key={a.id} className="text-12 text-text" title={`${a.id}. Alternative considered: ${a.alternative}`}>
                {a.brief}
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-hairline pt-2 text-12 text-textMuted">
            Full detail, as files:{' '}
            {DOCS.map(([path, what], i) => (
              <span key={path}>
                {i > 0 ? '; ' : ''}
                <span className="num text-text">{path}</span> ({i === 0 ? `all ${all.length} assumptions with alternatives` : what})
              </span>
            ))}
            .
          </p>
        </Panel>

        <Panel aria-labelledby="rp-output" className="p-3 lg:col-span-6 print:col-span-6">
          <h3 id="rp-output" className="text-14 font-semibold">
            Tanks made per production day: ERP against the twin
          </h3>
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-3">
            {SKUS.map((k) => (
              <DailyOutputChart key={k} check={v.erp[k]} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="text-12 text-textMuted">Across: tanks made in a day. Up: number of days it happened.</p>
            <OutputLegend />
          </div>
        </Panel>

        <Panel aria-labelledby="rp-stock" className="p-3 lg:col-span-6 print:col-span-6">
          <h3 id="rp-stock" className="text-14 font-semibold">
            Stock at the end of each week, against NTG's minimum and cap
          </h3>
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-3">
            {SKUS.map((k) => (
              <StockChart key={k} stock={v.stock[k]} />
            ))}
          </div>
          <p className="mt-2 text-12 text-textMuted">
            Across: the {fmt(weeks)} weeks of the ERP history. Up: tanks in stock. A dot marks a week that ends outside the band. This is the problem the Plan page works on.
          </p>
        </Panel>
      </div>
    </main>
  );
}
