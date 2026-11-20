/**
 * ERP history, read from src/data/history.json (extracted from
 * data/NTG_History_2026_Clean.xlsx). Everything here is NTG ERP data (tag N),
 * or simple counts of it (tag C).
 */
import raw from './history.json';
import type { PerSku, Sku } from './params';

export interface WeekRow {
  week: string;
  opening: number;
  produced: number;
  sold: number;
  returns: number;
  closing: number;
  lowest: number;
  productionDays: number;
  salesDocs: number;
  min: number;
  cap: number;
}
export interface DayProduction extends PerSku<number> {
  date: string;
}

export const weekly = raw.weekly as Record<Sku, WeekRow[]>;
export const monthly = raw.monthly as { month: string; sold: PerSku<number>; produced: PerSku<number> }[];
export const dailyProduction = raw.dailyProduction as DayProduction[];

/** The 45 full weeks the workbook's own statistics use (5 Jan to 15 Nov 2026). */
export function fullWeeks(sku: Sku): WeekRow[] {
  return weekly[sku].filter((w) => w.week >= '2026-01-05' && w.week <= '2026-11-09');
}

/** How often each daily output quantity occurred, on days the SKU was produced. */
export function dailyOutputHistogram(sku: Sku): { qty: number; days: number }[] {
  const h = new Map<number, number>();
  for (const d of dailyProduction) if (d[sku] > 0) h.set(d[sku], (h.get(d[sku]) ?? 0) + 1);
  return [...h.entries()].map(([qty, days]) => ({ qty, days })).sort((a, b) => a.qty - b.qty);
}

export function week(sku: Sku, monday: string): WeekRow | undefined {
  return weekly[sku].find((w) => w.week === monday);
}

/** Latest stock in the history (closing of the last, partial, week). */
export function latestStock(): PerSku<number> {
  const last = (s: Sku) => weekly[s][weekly[s].length - 1]!.closing;
  return { CTT4: last('CTT4'), CTT2: last('CTT2'), HTT2: last('HTT2') };
}
