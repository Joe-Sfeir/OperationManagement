/** Small pieces shared by the Plan page. Layout only; colours and type come from the tokens. */
import { useState, type ReactNode } from 'react';
import { Num } from '../../ui/kit';
import { color } from '../../design/tokens';

/** One control of the inputs strip: a short label above the control. */
export function Control({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="mb-1.5 block text-12 text-textMuted">
          {label}
        </label>
      ) : (
        <span className="mb-1.5 block text-12 text-textMuted">{label}</span>
      )}
      <div className="flex min-h-[1.75rem] flex-wrap items-center gap-x-3 gap-y-1">{children}</div>
    </div>
  );
}

/**
 * A number box that never fights the keyboard: the text is free while typing,
 * and a value is passed on only when it is a valid number in range.
 */
export function NumberField({ value, onCommit, label, min = 0, max, step = 1, id }: { value: number; onCommit: (v: number) => void; label: string; min?: number; max?: number; step?: number; id?: string }) {
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
        'num w-12 rounded-control border bg-canvas px-1.5 py-0.5 text-right text-14 text-text transition-colors duration-150 ease-machine',
        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        valid ? 'border-hairlineStrong hover:border-textMuted' : 'border-alertRed',
      ].join(' ')}
    />
  );
}

export function Slider({ id, value, min, max, step, onChange }: { id: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-5 w-40 min-w-0 cursor-pointer accent-text" />;
}

/** A computed figure: tag C with a short note on how it was worked out. */
export function Calc({ value, unit, title, size }: { value: ReactNode; unit?: string; title: string; size?: '12' | '14' | '28' }) {
  return <Num value={value} unit={unit} tag="C" title={title} size={size} />;
}

export type Mark = 'pass' | 'fail' | 'allowed' | 'idle';

/** Status mark. Shape and the words beside it carry the meaning; red is a fill, never text. */
export function StatusMark({ kind }: { kind: Mark }) {
  const common = 'inline-block h-2.5 w-2.5 shrink-0';
  if (kind === 'fail') return <span aria-hidden="true" className={common} style={{ background: color.alertRed }} />;
  if (kind === 'allowed') return <span aria-hidden="true" className={`${common} border-2`} style={{ borderColor: color.alertRed }} />;
  if (kind === 'idle') return <span aria-hidden="true" className={`${common} rounded-full border`} style={{ borderColor: color.textFaint }} />;
  return <span aria-hidden="true" className={`${common} rounded-full`} style={{ background: color.steelLight }} />;
}

export const th = 'border-b border-hairline px-1.5 py-1.5 text-12 font-medium text-textMuted sm:px-2';
export const td = 'border-b border-hairline px-1.5 py-1.5 sm:px-2';

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

/** "weeks 3, 4 and 6" */
export function listWeeks(ws: number[]): string {
  if (ws.length === 0) return '';
  if (ws.length === 1) return `week ${ws[0]}`;
  return `weeks ${ws.slice(0, -1).join(', ')} and ${ws[ws.length - 1]}`;
}
