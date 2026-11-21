/** Small pieces shared by the Plan page sections. Layout only; colours and type come from the tokens. */
import { useState, type ReactNode } from 'react';
import { Num } from '../../ui/kit';
import { color } from '../../design/tokens';

export function SectionHeader({ id, title, note, action }: { id: string; title: string; note?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <h2 id={id} className="text-14 font-semibold">
          {title}
        </h2>
        {note && <p className="mt-1 max-w-[90ch] text-12 text-textMuted">{note}</p>}
      </div>
      {action}
    </header>
  );
}

/** A labelled row of the inputs panel. `htmlFor` ties the label to a single control; groups name themselves. */
export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:gap-4">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-14 sm:pt-0.5">
          {label}
        </label>
      ) : (
        <span className="text-14 sm:pt-0.5">{label}</span>
      )}
      <div className="min-w-0">
        {children}
        {hint && <div className="mt-1.5 text-12 text-textMuted">{hint}</div>}
      </div>
    </div>
  );
}

/**
 * A number box that never fights the keyboard: the text is free while typing,
 * and a value is passed on only when it is a valid number in range.
 */
export function NumberField({
  value,
  onCommit,
  label,
  min = 0,
  max,
  step = 1,
  id,
  wide,
}: {
  value: number;
  onCommit: (v: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  wide?: boolean;
}) {
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (Number(text) !== value) setText(String(value));
  }
  const parsed = Number(text);
  const valid = text.trim() !== '' && Number.isFinite(parsed) && parsed >= min && (max === undefined || parsed <= max);
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      aria-label={label}
      aria-invalid={!valid}
      min={min}
      max={max}
      step={step}
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const v = Number(t);
        if (t.trim() !== '' && Number.isFinite(v) && v >= min && (max === undefined || v <= max)) onCommit(v);
      }}
      onBlur={() => setText(String(value))}
      className={[
        'num rounded-control border bg-canvas px-1.5 py-0.5 text-right text-14 text-text transition-colors duration-150 ease-machine',
        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        wide ? 'w-16' : 'w-10 sm:w-12',
        valid ? 'border-hairlineStrong hover:border-textMuted' : 'border-alertRed',
      ].join(' ')}
    />
  );
}

export function Slider({ id, value, min, max, step, onChange }: { id: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-5 w-full min-w-0 max-w-[22rem] cursor-pointer accent-text"
    />
  );
}

/** A computed figure: tag C with a short note on how it was worked out. */
export function Calc({ value, unit, title, size }: { value: ReactNode; unit?: string; title: string; size?: '12' | '14' | '28' }) {
  return <Num value={value} unit={unit} tag="C" title={title} size={size} />;
}

export type Mark = 'pass' | 'fail' | 'allowed' | 'idle';

/** Status mark. Shape and the word beside it carry the meaning; red is a fill, never text. */
export function StatusMark({ kind }: { kind: Mark }) {
  const common = 'inline-block h-2.5 w-2.5 shrink-0';
  if (kind === 'fail') return <span aria-hidden="true" className={common} style={{ background: color.alertRed }} />;
  if (kind === 'allowed') return <span aria-hidden="true" className={`${common} border-2`} style={{ borderColor: color.alertRed }} />;
  if (kind === 'idle') return <span aria-hidden="true" className={`${common} rounded-full border`} style={{ borderColor: color.textFaint }} />;
  return <span aria-hidden="true" className={`${common} rounded-full`} style={{ background: color.steelLight }} />;
}

export const th = 'border-b border-hairline px-2 py-1.5 text-12 font-medium text-textMuted';
export const td = 'border-b border-hairline px-2 py-1.5 align-top';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Monday to Friday of plan week t, as "9 to 13 Nov". */
export function weekDates(weekOne: Date, t: number): string {
  const a = new Date(weekOne);
  a.setUTCDate(a.getUTCDate() + 7 * (t - 1));
  const b = new Date(a);
  b.setUTCDate(b.getUTCDate() + 4);
  const end = `${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
  return a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()} to ${end}` : `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} to ${end}`;
}

/** The Friday before plan week t: the day NTG fixes that week's plan. */
export function fridayBefore(weekOne: Date, t: number): string {
  const a = new Date(weekOne);
  a.setUTCDate(a.getUTCDate() + 7 * (t - 1) - 3);
  return `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]}`;
}

/** "weeks 3, 4 and 6" */
export function listWeeks(ws: number[]): string {
  if (ws.length === 0) return '';
  if (ws.length === 1) return `week ${ws[0]}`;
  return `weeks ${ws.slice(0, -1).join(', ')} and ${ws[ws.length - 1]}`;
}
