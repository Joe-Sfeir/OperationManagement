/**
 * The two charts of the Report page, as small multiples (one per product).
 *
 * Both are drawn at a fixed pixel size so the labels stay at 12 px. Each has a
 * one-line title, a line under it that reads out the mark under the pointer or
 * the keyboard (left and right arrows), and the same data as hidden text for
 * screen readers. Fills are classes (see PAGE_CSS in ReportPage) so the print
 * rules can replace them. Neutral fills only: amber is kept for heat, and red
 * is used as a mark for weeks outside NTG's band.
 */
import { useId, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { P } from '../../data/params';
import { fmt } from '../../ui/kit';
import type { ErpCheck, StockHistory } from './validation';

const W = 216;

/** Pointer and keyboard selection of one mark out of `n`, laid out left to right between x0 and x1. */
function useActive(n: number, x0: number, x1: number) {
  const [active, setActive] = useState<number | null>(null);
  const clamp = (i: number) => Math.min(n - 1, Math.max(0, i));
  return {
    active,
    bind: {
      tabIndex: 0,
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - r.left;
        setActive(clamp(Math.floor(((x - x0) / (x1 - x0)) * n)));
      },
      onPointerLeave: () => setActive(null),
      onBlur: () => setActive(null),
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (e.key === 'ArrowRight') setActive((a) => clamp((a ?? -1) + 1));
        else if (e.key === 'ArrowLeft') setActive((a) => clamp((a ?? n) - 1));
        else if (e.key === 'Home') setActive(0);
        else if (e.key === 'End') setActive(n - 1);
        else if (e.key === 'Escape') setActive(null);
        else return;
        e.preventDefault();
      },
    },
  };
}

function Frame({ title, label, readout, equivalent, bind, children }: { title: ReactNode; label: string; readout: string; equivalent: string; bind: ReturnType<typeof useActive>['bind']; children: ReactNode }) {
  const id = useId();
  return (
    <figure className="rp-figure min-w-0" style={{ width: W }}>
      <figcaption id={id} className="text-12 font-medium text-text">
        {title}
      </figcaption>
      <div {...bind} role="group" aria-labelledby={id} aria-description={`${label} Use the left and right arrow keys to read the values.`} className="mt-1 cursor-crosshair touch-pan-y rounded-control">
        {children}
      </div>
      <p className="mt-0.5 min-h-[32px] text-12 text-textMuted" aria-live="polite">
        {readout}
      </p>
      <p className="sr-only">{equivalent}</p>
    </figure>
  );
}

// ---------------------------------------------------------------- daily output

const KIND_LABEL: Record<ErpCheck['hist'][number]['kind'], string> = {
  four: `twin, ${P.arms.value} arms`,
  three: `twin, ${P.arms.value - 1} arms`,
  multiple: 'other moulds x cycles',
  none: 'no match in the twin',
};
export const KIND_ORDER: ErpCheck['hist'][number]['kind'][] = ['four', 'three', 'multiple', 'none'];

export function OutputLegend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-12 text-textMuted" aria-label="Bar fills">
      {KIND_ORDER.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <svg width={10} height={10} aria-hidden="true">
            <rect x={0.5} y={0.5} width={9} height={9} rx={2} className={`rp-bar-${k}`} />
          </svg>
          {KIND_LABEL[k]}
        </li>
      ))}
    </ul>
  );
}

/** How often each daily quantity was booked in the ERP on a production day; the fill says whether the twin can make it. */
export function DailyOutputChart({ check }: { check: ErpCheck }) {
  const H = 138;
  const top = 16;
  const base = 116;
  const left = 2;
  const n = check.hist.length;
  const band = (W - left * 2) / n;
  const barW = Math.min(16, band - 6);
  const max = Math.max(...check.hist.map((h) => h.days));
  const y = (d: number) => base - (d / max) * (base - top);
  const share = (d: number) => `${fmt((d / check.days) * 100)} %`;
  const { active, bind } = useActive(n, left, W - left);
  const a = active === null ? null : check.hist[active]!;
  return (
    <Frame
      title={`${check.sku}: ${check.daysFour} of ${check.days} days at the twin's ${check.fourArm}`}
      label={`${check.sku}: number of production days at each daily quantity.`}
      readout={a ? `${a.qty} a day: ${a.days} days (${share(a.days)}), ${KIND_LABEL[a.kind]}` : `${share(check.daysFour + check.daysThree + check.daysMultiple)} of days match a quantity the twin can make`}
      equivalent={`${check.sku}, ${check.days} production days in the ERP. ${check.hist.map((h) => `${h.qty} tanks on ${h.days} days, ${KIND_LABEL[h.kind]}`).join('; ')}.`}
      bind={bind}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="block">
        <line x1={left} x2={W - left} y1={base + 0.5} y2={base + 0.5} className="rp-axis" />
        {check.hist.map((h, i) => {
          const cx = left + band * (i + 0.5);
          const t = Math.min(y(h.days), base - 2);
          return (
            <g key={h.qty}>
              {active === i && <rect x={left + band * i} y={top - 14} width={band} height={base - top + 14} className="rp-hover" />}
              <path d={`M${cx - barW / 2},${base} V${t + 2} q0,-2 2,-2 H${cx + barW / 2 - 2} q2,0 2,2 V${base} Z`} className={`rp-bar-${h.kind}`} />
              <text x={cx} y={t - 4} textAnchor="middle" fontSize={12} className="rp-ink num">
                {h.days}
              </text>
              <text x={cx} y={base + 15} textAnchor="middle" fontSize={12} className="rp-ink-muted num">
                {h.qty}
              </text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

// --------------------------------------------------------------- weekly stock

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayMonth = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const STATE_WORD: Record<StockHistory['weeks'][number]['state'], string> = { below: 'below the minimum', in: 'inside the band', above: 'above the cap' };

/** Stock at the end of each week against NTG's minimum and cap. Weeks that end outside the band carry a dot. */
export function StockChart({ stock }: { stock: StockHistory }) {
  const H = 138;
  const left = 2;
  const right = 54;
  const top = 6;
  const base = 116;
  const n = stock.weeks.length;
  const hi = Math.max(stock.cap, ...stock.weeks.map((w) => w.closing)) * 1.06;
  const x = (i: number) => left + ((i + 0.5) / n) * (W - left - right);
  const y = (v: number) => base - (v / hi) * (base - top);
  const path = stock.weeks.map((w, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(w.closing).toFixed(1)}`).join(' ');
  // A month label at the first week that starts in January, April, July and October.
  const ticks = stock.weeks
    .map((w, i) => ({ i, m: Number(w.week.slice(5, 7)), first: i === 0 || stock.weeks[i - 1]!.week.slice(5, 7) !== w.week.slice(5, 7) }))
    .filter((t) => t.first && t.m % 3 === 1 && t.i > 0);
  const { active, bind } = useActive(n, left, W - right);
  const a = active === null ? null : stock.weeks[active]!;
  const outside = stock.below + stock.above;
  return (
    <Frame
      title={`${stock.sku}: ${outside} of ${n} weeks end outside`}
      label={`${stock.sku}: tanks in stock at the end of each week, with NTG's minimum of ${stock.min} and cap of ${stock.cap}.`}
      readout={a ? `Week of ${dayMonth(a.week)}: ${a.closing} tanks, ${STATE_WORD[a.state]}` : `${stock.below} weeks below the minimum, ${stock.above} above the cap`}
      equivalent={`${stock.sku}: minimum ${stock.min}, cap ${stock.cap}. ${stock.weeks.map((w) => `week of ${dayMonth(w.week)} ${w.closing}${w.state === 'in' ? '' : ` (${STATE_WORD[w.state]})`}`).join('; ')}.`}
      bind={bind}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="block">
        <rect x={left} y={y(stock.cap)} width={W - left - right} height={y(stock.min) - y(stock.cap)} className="rp-band" />
        <line x1={left} x2={W - right} y1={y(stock.cap)} y2={y(stock.cap)} className="rp-limit" />
        <line x1={left} x2={W - right} y1={y(stock.min)} y2={y(stock.min)} className="rp-limit" />
        <line x1={left} x2={W - right} y1={base + 0.5} y2={base + 0.5} className="rp-axis" />
        <text x={W - right + 4} y={y(stock.cap) + 4} fontSize={12} className="rp-ink-muted">
          cap <tspan className="num">{stock.cap}</tspan>
        </text>
        <text x={W - right + 4} y={y(stock.min) + 4} fontSize={12} className="rp-ink-muted">
          min <tspan className="num">{stock.min}</tspan>
        </text>
        {ticks.map((t) => (
          <g key={t.i}>
            <line x1={x(t.i)} x2={x(t.i)} y1={base} y2={base + 3} className="rp-axis" />
            <text x={Math.max(x(t.i), 12)} y={base + 15} textAnchor="middle" fontSize={12} className="rp-ink-muted">
              {MONTHS[t.m - 1]}
            </text>
          </g>
        ))}
        <path d={path} fill="none" className="rp-line" />
        {stock.weeks.map((w, i) => (w.state === 'in' ? null : <circle key={w.week} cx={x(i)} cy={y(w.closing)} r={2.5} className="rp-out" />))}
        {a && active !== null && (
          <>
            <line x1={x(active)} x2={x(active)} y1={top} y2={base} className="rp-axis" />
            <circle cx={x(active)} cy={y(a.closing)} r={4} className="rp-ring" />
          </>
        )}
      </svg>
    </Frame>
  );
}
