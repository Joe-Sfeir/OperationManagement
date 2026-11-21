/**
 * Shared interface pieces. Follow docs/STYLE_BIBLE.md: solid panels, 1 px
 * hairline, 8 px radius, three type sizes (text-12, text-14, text-28),
 * numbers in Plex Mono (.num) with a source badge beside every figure.
 */
import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { SourceBadge } from '../design/SourceBadge';
import { useTwin } from '../app/store';
import type { Datum, Tag } from '../data/params';

export function Panel({ className = '', children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={`panel ${className}`} {...rest}>
      {children}
    </section>
  );
}

/** Tooltip text for a badge: where the number comes from. */
export function sourceTitle(d: Pick<Datum<unknown>, 'row' | 'source' | 'label' | 'confidence'>): string {
  const where = d.row > 0 ? `Inventory row ${d.row}` : 'Not in the inventory';
  return `${d.label}. ${where}: ${d.source}${d.confidence ? `. Confidence: ${d.confidence}` : ''}`;
}

/** A figure with its unit and source badge. Pass a Datum, or a tag plus title for computed values. */
export function Num({
  value,
  unit,
  tag,
  title,
  datum,
  size = '14',
  className = '',
}: {
  value: ReactNode;
  unit?: string;
  tag?: Tag;
  title?: string;
  datum?: Datum<unknown>;
  size?: '12' | '14' | '28';
  className?: string;
}) {
  const show = useTwin((s) => s.showSources);
  const t = tag ?? datum?.tag;
  const sz = size === '28' ? 'text-28' : size === '12' ? 'text-12' : 'text-14';
  const tip = title ?? (datum ? sourceTitle(datum) : undefined);
  return (
    // With the letters hidden, the source is still one hover away.
    <span className={`inline-flex items-baseline gap-1.5 whitespace-nowrap ${className}`} title={show ? undefined : tip}>
      <span className={`num ${sz}`}>{value}</span>
      {unit && <span className="text-12 text-textMuted">{unit}</span>}
      {t && show && (
        <span className="self-center">
          <SourceBadge tag={t} title={tip} />
        </span>
      )}
    </span>
  );
}

export function Button({
  active,
  className = '',
  children,
  ...rest
}: { active?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={[
        'rounded-control border px-2.5 py-1 text-12 transition-colors duration-150 ease-machine',
        'disabled:cursor-not-allowed disabled:opacity-40',
        active ? 'border-text bg-text text-canvas' : 'border-hairlineStrong text-text hover:border-textMuted',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}

/** A row of mutually exclusive choices. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-control border border-hairlineStrong">
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={[
            'px-2.5 py-1 text-12 transition-colors duration-150 ease-machine',
            i > 0 ? 'border-l border-hairlineStrong' : '',
            o.value === value ? 'bg-text text-canvas' : 'text-text hover:bg-hairline',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function fmt(n: number, digits = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Minutes as h:mm (shift clock) or m:ss style when short. */
export function clock(min: number): string {
  const m = Math.max(0, Math.floor(min));
  return `${String(Math.floor(m / 60)).padStart(1, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export function minSec(min: number): string {
  const s = Math.max(0, Math.round(min * 60));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
