/**
 * Small pieces shared by the Report sections: section headings that the table
 * of contents can focus, inventory row references that jump to the data
 * inventory, tables that stack on a phone, and the daily-output bar chart.
 */
import { createContext, useContext, useId, type ReactNode } from 'react';
import { SourceBadge } from '../../design/SourceBadge';
import { P, type Sku, type Tag } from '../../data/params';
import { fmt } from '../../ui/kit';
import { VERDICT_LABEL, invRow, type ErpCheck, type Verdict } from './validation';

// ---------------------------------------------------------------- navigation

/** Scroll to an element and move focus to it. Not a hash link, so the app's own navigation is left alone. */
export function goTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: 'start' });
  el.focus({ preventScroll: true });
}

export const JumpContext = createContext<(row: number) => void>(() => undefined);

/** "row 47" as a button that opens that row in the data inventory. */
export function RowRef({ row, children }: { row: number; children?: ReactNode }) {
  const jump = useContext(JumpContext);
  let title = `Inventory row ${row}`;
  try {
    const r = invRow(row);
    title = `Inventory row ${row}: ${r.parameter} = ${r.value} ${r.unit}. Opens the row in the data inventory`;
  } catch {
    /* unknown row: keep the short title */
  }
  return (
    <button type="button" onClick={() => jump(row)} title={title} className="rp-link num rounded-control underline decoration-hairlineStrong underline-offset-2 hover:decoration-text">
      {children ?? row}
    </button>
  );
}

/** Text with every "row 47" or "rows 43 and 44" turned into row references. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\brows?\s+\d+(?:(?:,\s*|\s+and\s+|\s+to\s+)\d+)*)/gi);
  return (
    <>
      {parts.map((p, i) => {
        if (!/^rows?\s+\d/i.test(p)) return <span key={i}>{p}</span>;
        const bits = p.split(/(\d+)/);
        return (
          <span key={i}>
            {bits.map((b, j) => (/^\d+$/.test(b) ? <RowRef key={j} row={Number(b)} /> : <span key={j}>{b}</span>))}
          </span>
        );
      })}
    </>
  );
}

export function Section({ id, n, title, lead, children }: { id: string; n: number; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rp-section mt-8">
      <h3 id={id} tabIndex={-1} className="scroll-mt-4 border-b border-hairlineStrong pb-2 text-28 font-medium">
        <span className="num mr-3 text-textMuted">{n}</span>
        {title}
      </h3>
      {lead && <div className="mt-3 max-w-[920px] text-14 text-textMuted">{lead}</div>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Sub({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <div className="rp-sub mt-6">
      <h4 id={id} tabIndex={id ? -1 : undefined} className="scroll-mt-4 text-14 font-semibold">
        {title}
      </h4>
      <div className="mt-2">{children}</div>
    </div>
  );
}

// -------------------------------------------------------- tables that stack

/** Class names for a table that is a real table from 768 px and a list of labelled blocks below it. */
export const T = {
  wrap: 'panel rp-panel overflow-hidden',
  table: 'block w-full border-collapse md:table',
  thead: 'sr-only md:not-sr-only md:table-header-group',
  tbody: 'block md:table-row-group',
  tr: 'rp-row block border-b border-hairline px-3 py-2 last:border-b-0 md:table-row md:px-0 md:py-0',
  th: 'border-b border-hairlineStrong px-3 py-2 text-left align-bottom text-12 font-medium text-textMuted',
  td: 'block py-1 align-top text-14 md:table-cell md:px-3 md:py-2.5',
} as const;

export function Td({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <td className={`${T.td} ${className}`}>
      <span className="block text-12 text-textMuted md:hidden">{label}</span>
      {children}
    </td>
  );
}

export function TagCell({ tag, title }: { tag: Tag | null; title?: string }) {
  return tag ? <SourceBadge tag={tag} title={title} /> : <span className="text-12 text-textMuted">none</span>;
}

/** Verdict as a small mark plus words. Red is a fill, never the text. */
export function VerdictMark({ verdict }: { verdict: Verdict }) {
  const mark =
    verdict === 'gap' ? 'rp-mark-gap bg-alertRed' : verdict === 'match' ? 'rp-mark-ok bg-steelLight' : 'rp-mark-open border border-textMuted';
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-14 font-medium">
      <span className={`inline-block h-2.5 w-2.5 shrink-0 ${mark}`} style={{ borderRadius: 2 }} aria-hidden="true" />
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

// ------------------------------------------------------------------ the chart

const KIND_LABEL: Record<ErpCheck['hist'][number]['kind'], string> = {
  four: 'Twin, four arms working',
  three: 'Twin, one arm without a mould',
  multiple: 'Other whole number of moulds x cycles',
  none: 'No match in the twin',
};
export const KIND_ORDER: ErpCheck['hist'][number]['kind'][] = ['four', 'three', 'multiple', 'none'];

export function ChartLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-12 text-textMuted" aria-label="Bar fills">
      {KIND_ORDER.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <svg width={12} height={12} aria-hidden="true">
            <rect x={1} y={1} width={10} height={10} rx={2} className={`rp-bar-${k}`} />
          </svg>
          {KIND_LABEL[k]}
        </li>
      ))}
    </ul>
  );
}

/**
 * Daily output on production days, one bar per quantity that occurred in the
 * ERP. Fill says whether the twin can produce that quantity. Fixed pixel size
 * so the labels stay at 12 px; the sentence and the table below carry the same
 * information as text.
 */
export function DailyOutputChart({ check }: { check: ErpCheck }) {
  const id = useId();
  const sku: Sku = check.sku;
  const W = 320;
  const H = 168;
  const top = 18;
  const base = 124;
  const left = 4;
  const band = (W - left * 2) / check.hist.length;
  const barW = Math.min(22, band - 8);
  const max = Math.max(...check.hist.map((h) => h.days));
  const y = (d: number) => base - (d / max) * (base - top);
  const share = (n: number) => `${fmt((n / check.days) * 100)} %`;
  const explained = check.daysFour + check.daysThree + check.daysMultiple;
  return (
    <figure className="rp-figure min-w-0">
      <figcaption className="text-14 font-medium">
        {sku}: tanks made per production day <span className="font-normal text-textMuted">({check.days} days in the ERP)</span>
      </figcaption>
      <div className="mt-2 max-w-full overflow-x-auto">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`} className="block">
          <title id={`${id}-t`}>{`${sku}: number of ERP production days at each daily quantity`}</title>
          <desc id={`${id}-d`}>
            {check.hist.map((h) => `${h.qty} tanks on ${h.days} days (${KIND_LABEL[h.kind].toLowerCase()})`).join('; ')}
          </desc>
          <line x1={left} x2={W - left} y1={base + 0.5} y2={base + 0.5} className="rp-axis" />
          {check.hist.map((h, i) => {
            const cx = left + band * (i + 0.5);
            const top0 = Math.min(y(h.days), base - 2);
            return (
              <g key={h.qty}>
                <title>{`${h.qty} tanks a day: ${h.days} days, ${share(h.days)} of production days. ${KIND_LABEL[h.kind]}`}</title>
                <rect x={left + band * i} y={0} width={band} height={H} fill="transparent" />
                <path
                  d={`M${cx - barW / 2},${base} V${top0 + 3} q0,-3 3,-3 H${cx + barW / 2 - 3} q3,0 3,3 V${base} Z`}
                  className={`rp-bar-${h.kind}`}
                />
                <text x={cx} y={top0 - 5} textAnchor="middle" fontSize={12} className="rp-ink num">
                  {h.days}
                </text>
                <text x={cx} y={base + 16} textAnchor="middle" fontSize={12} className="rp-ink-muted num">
                  {h.qty}
                </text>
                {(h.kind === 'four' || h.kind === 'three') && (
                  <text x={cx} y={base + 32} textAnchor="middle" fontSize={12} className="rp-ink">
                    {h.kind === 'four' ? `${P.arms.value} arms` : `${P.arms.value - 1} arms`}
                  </text>
                )}
              </g>
            );
          })}
          <text x={W - left} y={H - 2} textAnchor="end" fontSize={12} className="rp-ink-muted">
            tanks a day; number above each bar = days
          </text>
        </svg>
      </div>
      <p className="mt-2 text-12 text-textMuted">
        <span className="num text-text">{check.daysFour}</span> of <span className="num text-text">{check.days}</span> days ({share(check.daysFour)}) equal the twin's typical shift (
        <span className="num text-text">{check.fourArm}</span>). <span className="num text-text">{check.daysThree}</span> ({share(check.daysThree)}) equal the twin with one arm empty (
        <span className="num text-text">{check.threeArm.join(' or ')}</span>). <span className="num text-text">{check.daysMultiple}</span> ({share(check.daysMultiple)}) equal another whole number of moulds x{' '}
        {check.cycles.join(' or ')} cycles. <span className="num text-text">{check.daysNone}</span> ({share(check.daysNone)}) match nothing the twin can make: {check.unexplained.join(', ')} tanks. In all,{' '}
        <span className="num text-text">{share(explained)}</span> of days equal a quantity the twin can produce.{' '}
        <span className="inline-block align-middle">
          <SourceBadge tag="C" title="Counted from the ERP daily production (tag N) against simulator runs" />
        </span>
      </p>
      <details className="mt-1 text-12 text-textMuted">
        <summary className="cursor-pointer rounded-control">Same data as a table</summary>
        <table className="mt-1 border-collapse">
          <caption className="sr-only">{sku}: ERP production days by daily quantity</caption>
          <thead>
            <tr>
              <th scope="col" className="pr-4 text-left font-medium">
                Tanks a day
              </th>
              <th scope="col" className="pr-4 text-right font-medium">
                Days
              </th>
              <th scope="col" className="text-left font-medium">
                Can the twin make it
              </th>
            </tr>
          </thead>
          <tbody>
            {check.hist.map((h) => (
              <tr key={h.qty}>
                <td className="num pr-4">{h.qty}</td>
                <td className="num pr-4 text-right">{h.days}</td>
                <td>{KIND_LABEL[h.kind]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
