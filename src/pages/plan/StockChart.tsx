/**
 * Stock of one tank, week by week. Hand-written SVG drawn at the size of its
 * box (no scaling), so the 12 px labels stay 12 px on every screen.
 *
 * The pale band is where NTG wants the stock (minimum to cap); the line is the
 * stock the plan gives; a red bar hangs from the minimum line in any week the
 * stock is under it. Point at a week, or focus the chart and use the arrow
 * keys, to read the exact figure.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { color } from '../../design/tokens';
import { fmt } from '../../ui/kit';
import { Calc, StatusMark } from './parts';

export interface StockChartProps {
  sku: string;
  /** Stock at the start (index 0) and at the end of weeks 1..T. */
  stock: number[];
  /** Tanks under the minimum at the end of weeks 1..T (index t - 1). */
  shortage: number[];
  minStock: number;
  /** null when the warehouse cap is switched off. */
  cap: number | null;
  /** The minimum and the cap as figures with their source. */
  limits: ReactNode;
}

const H = 176;
const M = { top: 28, right: 12, bottom: 34, left: 34 };
/** Shortages smaller than this are rounding, not tanks. */
const SHOWN_FROM = 0.05;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.floor(el.clientWidth));
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.floor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function axisStep(max: number): number {
  const raw = max / 3;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

export function StockChart({ sku, stock, shortage, minStock, cap, limits }: StockChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const T = stock.length - 1;

  const top = Math.max(...stock, minStock, cap ?? 0, 1);
  const step = axisStep(top * 1.04);
  const yMax = Math.ceil((top * 1.04) / step) * step;
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);

  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = H - M.top - M.bottom;
  const inset = 10;
  const x = (i: number) => M.left + inset + (T > 0 ? (i * (plotW - 2 * inset)) / T : 0);
  const y = (v: number) => M.top + plotH - (Math.max(0, Math.min(v, yMax)) / yMax) * plotH;

  let lowest = 1;
  for (let t = 1; t <= T; t++) if (stock[t]! < stock[lowest]!) lowest = t;
  const shortWeeks = shortage.map((s, i) => (s >= SHOWN_FROM ? i + 1 : 0)).filter(Boolean);

  const nearest = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const span = plotW - 2 * inset;
    const i = span > 0 ? Math.round(((e.clientX - box.left - M.left - inset) / span) * T) : 0;
    setActive(Math.max(0, Math.min(T, i)));
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = active ?? T;
    if (e.key === 'ArrowRight') setActive(Math.min(T, at + 1));
    else if (e.key === 'ArrowLeft') setActive(Math.max(0, at - 1));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(T);
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  };

  const summary = `${sku}: stock goes from ${fmt(stock[0]!, 1)} tanks at the start to ${fmt(stock[T]!, 1)} at the end of week ${T}. Lowest ${fmt(stock[lowest]!, 1)} in week ${lowest}. Minimum ${minStock}${cap === null ? '' : `, cap ${cap}`}.${shortWeeks.length ? ` Below the minimum in week ${shortWeeks.join(', ')}.` : ''}`;
  const halo = { stroke: color.panel, strokeWidth: 4, paintOrder: 'stroke' as const };
  const at = active ?? lowest;
  const short = at > 0 && shortage[at - 1]! >= SHOWN_FROM;

  return (
    <div
      ref={ref}
      role="group"
      tabIndex={0}
      aria-label={`${sku} stock by week. Use the left and right arrow keys to read each week.`}
      onKeyDown={onKey}
      onFocus={() => setActive((a) => a ?? T)}
      onBlur={() => setActive(null)}
      className="min-w-0 rounded-control"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-14 font-semibold">{sku}</h3>
        <p className="flex flex-wrap items-baseline gap-x-3 text-12 text-textMuted">{limits}</p>
      </div>
      <p aria-live="polite" className="flex min-h-[1.25rem] flex-wrap items-center gap-x-1.5 text-12 text-textMuted">
        {short && <StatusMark kind="fail" />}
        <span>{active === null ? `Lowest, week ${at}:` : at === 0 ? 'Start:' : `Week ${at}:`}</span>
        <Calc size="12" value={fmt(stock[at]!, 1)} unit={short ? `tanks, ${fmt(shortage[at - 1]!, 1)} short` : 'tanks'} title="Stock at the end of the week: stock before, plus tanks arriving, plus returns, minus demand" />
      </p>

      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={summary} className="block touch-pan-y select-none" onPointerMove={nearest} onPointerDown={nearest} onPointerLeave={() => setActive(null)}>
          <text x={0} y={11} fontSize={12} fill={color.textMuted}>
            Tanks in stock
          </text>

          {/* Where NTG wants the stock: from the minimum up to the cap. */}
          {cap !== null && cap > minStock && <rect x={M.left} y={y(cap)} width={plotW} height={y(minStock) - y(cap)} fill={color.hairline} opacity={0.5} />}

          {ticks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={M.left + plotW} y1={y(v)} y2={y(v)} stroke={color.hairline} strokeWidth={1} />
              <text x={M.left - 6} y={y(v) + 4} fontSize={12} textAnchor="end" fill={color.textMuted} className="num">
                {v}
              </text>
            </g>
          ))}

          {cap !== null && (
            <>
              <line x1={M.left} x2={M.left + plotW} y1={y(cap)} y2={y(cap)} stroke={color.steelMid} strokeWidth={1} strokeDasharray="5 4" />
              <text x={M.left + plotW - 4} y={y(cap) - 4} fontSize={12} textAnchor="end" fill={color.textMuted} {...halo}>
                Cap
              </text>
            </>
          )}
          <line x1={M.left} x2={M.left + plotW} y1={y(minStock)} y2={y(minStock)} stroke={color.steelLight} strokeWidth={1} />
          <text x={M.left + 4} y={y(minStock) + 14} fontSize={12} fill={color.textMuted} {...halo}>
            Minimum
          </text>

          {stock.map((_, i) => (
            <text key={i} x={x(i)} y={M.top + plotH + 15} fontSize={12} textAnchor="middle" fill={i === active ? color.text : color.textMuted} className={i === 0 ? undefined : 'num'}>
              {i === 0 ? 'Start' : i}
            </text>
          ))}
          <text x={M.left + plotW / 2} y={H - 3} fontSize={12} textAnchor="middle" fill={color.textMuted}>
            Week
          </text>

          {/* Weeks under the minimum: a red bar from the minimum line down to the stock. */}
          {shortage.map((s, i) =>
            s >= SHOWN_FROM ? <rect key={i} x={x(i + 1) - 4} y={y(minStock)} width={8} height={Math.max(3, y(stock[i + 1]!) - y(minStock))} fill={color.alertRed} /> : null,
          )}

          {active !== null && <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + plotH} stroke={color.hairlineStrong} strokeWidth={1} />}

          <polyline points={stock.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} fill="none" stroke={color.text} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {stock.map((v, i) => {
            const under = i > 0 && shortage[i - 1]! >= SHOWN_FROM;
            return <circle key={i} cx={x(i)} cy={y(v)} r={i === active ? 5.5 : 3.5} fill={under ? color.alertRed : color.text} stroke={color.panel} strokeWidth={2} />;
          })}
        </svg>
      )}
    </div>
  );
}
