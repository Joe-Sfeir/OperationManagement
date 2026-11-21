/**
 * Small pure helpers for the Redesign page: the recommendation rule restated
 * so the page can show which scenarios passed it, and counts read off the
 * scenarios. validation.test.ts checks the restated rule against recommend().
 */
import { SKUS } from '../../data/params';
import type { WeekResult, WeekScenario } from '../../sim/scenarios';

export const BASELINE_ID = 'ntg';
/** recommend() lets a scenario use this many tank arm-days more than the baseline: none. */
export const EXTRA_ARM_DAYS_ALLOWED = 0;

export interface RuleCheck {
  id: string;
  inBand: boolean;
  armDaysOk: boolean;
  passes: boolean;
}

export function ruleChecks(results: WeekResult[]): RuleCheck[] {
  const base = results.find((r) => r.scenario.id === BASELINE_ID) ?? results[0]!;
  return results.map((r) => {
    const inBand = SKUS.every((k) => r.band[k] === 'in');
    const armDaysOk = r.tankArmDays <= base.tankArmDays + EXTRA_ARM_DAYS_ALLOWED;
    return { id: r.scenario.id, inBand, armDaysOk, passes: inBand && armDaysOk };
  });
}

/** The scenario the restated rule picks: smallest cover spread among those that pass, then fewest arm-days. */
export function rulePick(results: WeekResult[]): string {
  const checks = ruleChecks(results);
  const ok = results.filter((r) => checks.find((c) => c.id === r.scenario.id)!.passes);
  const pool = ok.length > 0 ? ok : results;
  return [...pool].sort((a, b) => a.coverSpread - b.coverSpread || a.tankArmDays - b.tankArmDays)[0]!.scenario.id;
}

/** Arms whose moulds differ from the day before, summed over the week. The first day's set-up is not counted. */
export function mouldChanges(s: WeekScenario): number {
  const key = (m: string[]) => [...m].sort().join('+');
  let n = 0;
  for (let d = 1; d < s.days.length; d++)
    s.days[d]!.forEach((arm, i) => {
      if (key(arm.moulds) !== key(s.days[d - 1]![i]?.moulds ?? [])) n += 1;
    });
  return n;
}

/** Distinct values, sorted. */
export function distinct(xs: number[]): number[] {
  return [...new Set(xs.map((x) => Number(x.toFixed(6))))].sort((a, b) => a - b);
}
