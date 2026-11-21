/**
 * Which source badge an input wears. A prefilled number keeps the tag of its
 * inventory row. Once the user changes it, it is no longer NTG's number and
 * shows S, "Entered on this page".
 */
import { P, type Datum, type Sku, type Tag } from '../../data/params';
import { sourceTitle } from '../../ui/kit';
import { DEFAULT_PENALTY_HOURS, armDaysPlan, latestWeekMonday, startValues, type DemandKey, type PlanSettings } from './model';

export interface Badge {
  tag: Tag;
  title: string;
}

export const ENTERED: Badge = { tag: 'S', title: 'Entered on this page' };

const from = (d: Datum<unknown>): Badge => ({ tag: d.tag, title: sourceTitle(d) });

export function openingBadge(s: PlanSettings, k: Sku): Badge {
  if (s.openingStock[k] !== startValues(s.start).openingStock[k]) return ENTERED;
  return s.start === 'form6Nov'
    ? from(P.closingStock6Nov)
    : { tag: 'N', title: `Closing stock of the ERP week starting ${latestWeekMonday()}, the latest in NTG's ERP stock cards (history workbook)` };
}

export function pipelineBadge(s: PlanSettings, k: Sku): Badge {
  if (s.pipeline[k] !== startValues(s.start).pipeline[k]) return ENTERED;
  return s.start === 'form6Nov'
    ? from(P.pipeline)
    : { tag: 'S', title: 'No plan on file for this week, so zero is assumed until you type what is already planned (NOTES.md, assumption P3)' };
}

export function scenarioBadge(key: DemandKey): Badge {
  if (key === 'busy') return from(P.deliveriesWeek2Nov);
  if (key === 'meanPlusSd') return { tag: 'C', title: `Mean plus one standard deviation of weekly sales. ${sourceTitle(P.weeklySalesMean)}. ${sourceTitle(P.weeklySalesSd)}` };
  return from(P.weeklySalesMean);
}

export function demandBadge(s: PlanSettings): Badge {
  return s.demandPct === 100 ? scenarioBadge(s.demand) : { tag: 'S', title: `Entered on this page: ${s.demandPct} % of the chosen demand` };
}

export function armDaysBadge(s: PlanSettings): Badge {
  return s.armDays === armDaysPlan.value ? from(armDaysPlan) : ENTERED;
}

export function penaltyBadge(s: PlanSettings): Badge {
  return s.penaltyHours === DEFAULT_PENALTY_HOURS
    ? { tag: 'S', title: 'Assumption P1 (NOTES.md): one tank-week below the minimum counts as 10 arm-hours, five times the 2 h it takes to make the slowest tank (CTT4, one mould per arm)' }
    : ENTERED;
}
