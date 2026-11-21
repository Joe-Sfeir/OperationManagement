/**
 * Assumptions register, as typed data.
 *
 * One entry per modelling decision that is not a confirmed NTG fact. The
 * course scores every entry on two things: a real alternative and a reason
 * for the choice. Both are required fields here.
 *
 * Numbers inside the sentences are not typed: they are read from the
 * inventory (`P`), from `assumed`, from the default configuration or from a
 * simulator run, so the register cannot drift from the code.
 * docs/ASSUMPTIONS.md is generated from this file (see validation.test.ts).
 *
 * IDs A1 to A8 keep their meaning from the first register; A9 to A12 are the
 * IDs params.ts already cites.
 */
import { P, SKUS, assumed, type Tag } from '../../data/params';
import { defaultConfig } from '../../sim/config';
import { SCENARIOS } from '../../sim/scenarios';
import { mouldsLabel } from '../../ui/stage';
import { f, invRow, rangeIn, simulate, sumSku, triple, validation, withTimes } from './validation';

export type AssumptionGroup =
  | 'Machine and positions'
  | 'Oven and layers'
  | 'Times'
  | 'Crew, finishing and quality'
  | 'Raw material'
  | 'Week scenarios and stock'
  | 'Display only';

export interface Assumption {
  id: string;
  group: AssumptionGroup;
  decision: string;
  /** What the twin uses. */
  value: string;
  tag: Tag;
  /** Who or what the value rests on, when it is more specific than the tag. */
  source?: string;
  /** One line for the Report page ("decision: value"), only on the entries listed in MAIN_ASSUMPTIONS. */
  brief?: string;
  /** At least one real alternative that was considered. */
  alternative: string;
  /** Why the value used was preferred over the alternative. */
  why: string;
  /** Where it enters the code or the screen. */
  usedIn: string;
  /** What would replace it, and where to enter it. */
  replace: string;
  /** Inventory rows that bear on it. */
  rows: number[];
}

let cached: Assumption[] | null = null;

export function assumptions(): Assumption[] {
  if (cached) return cached;
  const v = validation();
  const cfg = defaultConfig();
  const T = cfg.times;
  const base = v.base;
  const rej = (id: string) => v.rejected.find((r) => r.id === id)!.run;
  const pauses = v.visit.pauses;
  const heatEach = v.visit.heatEach;
  const alt = v.alternative.run;
  const TEAM_21_NOV = 'team (H), 21 Nov 2026';
  const iLo = v.index.sweep[0]!;
  const iHi = v.index.sweep[v.index.sweep.length - 1]!;
  const dLo = v.demould.sweep[0]!;
  const kg = (k: (typeof SKUS)[number]) => P.layerKg[k].value;
  const kgSum = (k: (typeof SKUS)[number]) => kg(k).reduce((s, x) => s + x, 0);
  const visitKg = kgSum('CTT4');
  const planKg = P.planKgPerTank.value.CTT4;
  const siloKg = cfg.raw.siloCapacityKg;
  const grindRange = rangeIn(String(invRow(16).value));
  const scrapRange = rangeIn(invRow(76).notes);
  const planTanks = sumSku(P.pipeline.value);
  const finishDouble = simulate(withTimes({ finishing: T.finishing * 2 }));
  const threeArms = simulate({ arms: [{ moulds: [] }, ...cfg.arms.slice(1)] });
  const ntgPlan = SCENARIOS.find((s) => s.id === 'ntg')!;
  const placed = ntgPlan.days.reduce((s, d) => s + d.filter((a) => a.moulds.some((m) => m !== 'OTHER')).length, 0);
  const placement = ntgPlan.days.map((d, i) => `day ${i + 1}: ${d.map((a) => mouldsLabel(a.moulds).replace('Other product', 'other')).join(', ')}`).join('; ');
  const armDays = String(invRow(40).value).match(/(\d+)\s+of\s+(\d+)/)!;
  const dLast = v.demould.sweep[v.demould.sweep.length - 1]!;
  const listAvail = String(invRow(80).value).split(';')[0]!.replace(/^Available\s*/i, '');
  const turnsNote = 'src/scene/machine/Arm.tsx (turns) and Cooling.tsx (fan)';

  const rows: Assumption[] = [
    // ------------------------------------------------ Machine and positions
    {
      id: 'A5',
      group: 'Machine and positions',
      decision: 'How many arms, how they move',
      value: `${P.arms.value} arms on ${P.positions.value} positions. One arm per position. Arms travel one way round the ring and cannot pass each other.`,
      tag: 'V',
      alternative: 'Three arms, as on NTG\'s Machines 3000 and 6000 (row 5), or arms that can overtake.',
      why: `Form 1 gives ${P.arms.value} independent arms for Machine 3700 (row ${P.arms.row}) and the visit counted ${P.positions.value} positions (row ${P.positions.row}). "Independent" means each arm indexes on its own drive; they still share one hub, so an arm cannot pass the one ahead. That is what makes the oven a queue.`,
      usedIn: 'src/sim/config.ts (ringFor), src/sim/engine.ts (canEnter, tryMove); the 3D machine',
      replace: 'Arms: change the set-up in the drawer. A different number of positions needs a new ring in ringFor.',
      rows: [5, 37, 38, 39],
    },
    {
      id: 'A8',
      group: 'Machine and positions',
      decision: 'Five positions or six',
      value: `${P.positions.value} positions.`,
      tag: 'V',
      alternative: 'Six mould positions about 60 degrees apart, which is how the manual\'s plan view can be read (oven at 3 o\'clock, cooling chamber at about 11 o\'clock).',
      why: `The visit notes and the Form 1 header both say ${P.positions.value}, and NTG did not correct it (row ${P.positions.row}). The plan view is the maker's general drawing and may not be this machine size. The twin cannot run six positions, so this has not been simulated; by the oven rule a sixth, empty position would not change the oven's turn length, which is what sets the cycle.`,
      usedIn: 'src/sim/config.ts (ringFor); src/scene/layout.ts (STATION_DEG)',
      replace: 'A photo of the machine from above, or NTG naming each position. Then add the ring to ringFor.',
      rows: [39],
    },
    {
      id: 'A13',
      group: 'Machine and positions',
      decision: 'What each of the five positions does',
      value: 'Loading, oven, open air-cooling position, cooling chamber (fan and water), demould.',
      tag: 'S',
      alternative: 'Both cooling phases in the chamber, with a waiting position before the oven: loading, waiting, oven, cooling chamber, demould.',
      why:
        `Row ${P.positions.row} says the role of each position is unknown. With both phases in the chamber, one position holds every arm for ${f(T.air + T.water)} min: the twin then gives a ${f(rej('bothInChamber').cycleMin, 1)} min cycle and ${rej('bothInChamber').total} tanks a shift, against NTG's ${P.armCycleMin.value} min and ${sumSku(P.tanksPerShift.value)}. ` +
        `Air cooling at an open position splits the ${f(T.air + T.water)} min over two positions and reproduces both figures. The manual's plan view also shows a mould position between the oven and the cooling chamber, inside the red line, which is where the twin puts air cooling.`,
      usedIn: 'config.cooling = airAtOpenPosition; ringFor; the air position in the 3D machine',
      replace: 'Watch where an arm stops after it leaves the oven. Switch "Cooling layout" in the set-up drawer.',
      rows: [39, 68, 69, 70],
    },
    {
      id: 'A29',
      group: 'Machine and positions',
      decision: 'Whose turn it is at the oven',
      value: 'Arms enter the oven in ring order, first come first served. No priority by product.',
      tag: 'N',
      alternative: 'Give the oven first to the arm that carries the most tanks (two 2,000 L moulds before one 4,000 L mould).',
      why: `NTG confirmed one arm at a time, by turn (row 42). Priority would need arms to pass each other, which the hub does not allow. It would also not add output: every arm gets ${f(base.cyclesPerArm)} turns a shift in any order.`,
      usedIn: 'src/sim/engine.ts (tryMove, canEnter)',
      replace: 'Only if the machine is changed.',
      rows: [41, 42],
    },
    {
      id: 'A28',
      group: 'Machine and positions',
      decision: 'State of the machine at the start of the shift',
      value: 'All four moulds empty at minute 0. Arm 1 is at loading and the others follow in ring order.',
      tag: 'S',
      alternative: 'A rolling start: arms already loaded or cooked from the day before.',
      why: `NTG counts tanks per shift and the ERP books whole multiples of ${P.cyclesPerMouldPerDay.value} on most days, which fits a machine that is emptied every day. A rolling start would bring the last tanks inside the ${f(P.shiftHours.value, 1)} h, but it needs yesterday's set-up as an input and the weekly plan does not give it. The cost of this choice is the ${f(base.runOutMin, 1)} min run-out shown in the validation table.`,
      usedIn: 'src/sim/engine.ts (runSimulation, first ring positions)',
      replace: 'Note what is on each arm in the first minute of a shift.',
      rows: [49, 54, 113],
    },
    {
      id: 'A16',
      group: 'Machine and positions',
      decision: 'What happens at the end of the shift',
      value: `The oven takes no arm it cannot finish by the ${f(P.shiftHours.value, 1)} h mark. Arms already cooked are cooled and demoulded after it.`,
      tag: 'S',
      brief: `End of the shift: the oven takes no arm it cannot finish by the ${f(P.shiftHours.value, 1)} h mark; cooked arms are finished after it.`,
      alternative: `Hard stop: everything freezes at ${f(P.shiftHours.value, 1)} h.`,
      why:
        `A hard stop leaves cooked tanks shut in hot moulds overnight and counts ${triple(v.hardStop.tanksTotal)} (${v.hardStop.total}) against NTG's ${triple(P.tanksPerShift.value)} (${sumSku(P.tanksPerShift.value)}). Finishing the cooked arms gives NTG's count, but ${f(base.runOutMin, 1)} min late, and the team recorded no overtime (row 113). ` +
        `The gap is reported, not tuned away.`,
      usedIn: 'config.endOfShift = finishWip; src/sim/engine.ts (predictHeatStart, tryMove); kpis.runOutMin',
      replace: 'Ask NTG what the crew does with the last two arms. Switch "End of shift" in the set-up drawer.',
      rows: [49, 54, 113],
    },
    // ------------------------------------------------------ Oven and layers
    {
      id: 'A14',
      group: 'Oven and layers',
      decision: `What the ${f(T.ovenVisit, 1)} min of oven time includes`,
      value: `One arm visit, door to door, all ${cfg.layers} layers: ${cfg.layers} heats of ${f(heatEach, 1)} min, ${cfg.layers - 1} dosing pauses of ${f(T.layerPause, 1)} min and ${v.visit.tripCount} swings of ${f(T.index, 1)} min to the loading position and back.`,
      tag: 'V',
      source: TEAM_21_NOV,
      brief: `Oven time: ${f(T.ovenVisit, 1)} min per arm visit, door to door, for all ${cfg.layers} layers.`,
      alternative: `${f(T.ovenVisit, 1)} min is heating only and the swings come on top (${f(T.ovenVisit + v.visit.trips, 1)} min per tank arm); or ${f(T.ovenVisit, 1)} min per layer.`,
      why: `The team confirmed on 21 Nov 2026 that the swings out and back are inside the ${f(T.ovenVisit, 1)} min it measured. The output agrees: with the swings on top the twin gives a ${f(rej('tripsOnTop').cycleMin, 1)} min cycle and ${rej('tripsOnTop').total} tanks a shift, and per layer ${f(rej('perLayer').cycleMin, 1)} min and ${rej('perLayer').total} tanks. NTG reports ${sumSku(P.tanksPerShift.value)} tanks a shift and ${P.cyclesPerMouldPerDay.value} cycles per mould a day (rows ${P.tanksPerShift.row}, ${P.cyclesPerMouldPerDay.row}).`,
      usedIn: 'times.ovenVisit and tripsInsideVisit in src/sim/config.ts; ovenSplit and ovenPhases in engine.ts',
      replace: 'Time one arm from its first oven door closing to its last oven door opening, for a full shift. Enter it as the oven visit in the set-up drawer.',
      rows: [43, 44],
    },
    {
      id: 'A15',
      group: 'Oven and layers',
      decision: 'Dosing pauses: inside the oven visit or on top of it',
      value: `The ${cfg.layers - 1} dosing pauses of ${f(T.layerPause, 1)} min at the loading position are inside the ${f(T.ovenVisit, 1)} min.`,
      tag: 'S',
      alternative: `Pauses on top: the oven's turn would last ${f(T.ovenVisit + pauses, 1)} min per tank arm.`,
      why: `The pause happens in the middle of a swing the team says is inside the ${f(T.ovenVisit, 1)} min, so it is taken as inside too; nobody timed it separately. On top, the cycle is ${f(rej('pausesOnTop').cycleMin, 1)} min and one arm misses its fourth turn: ${rej('pausesOnTop').total} tanks, not ${base.total}. The pause itself is an NTG estimate of ${String(invRow(P.layerPauseMin.row).value).split('(')[0]!.trim()} min.`,
      usedIn: 'config.pausesInsideVisit; ovenSplit in engine.ts',
      replace: 'Timed shift. Switch "Layer pauses" in the set-up drawer.',
      rows: [43, 45],
    },
    {
      id: 'A2',
      group: 'Oven and layers',
      decision: 'How layers 2 and 3 get into the mould',
      value: 'The arm leaves the oven, swings back to the loading position, is dosed there and swings back in. Once for layer 2, once for layer 3.',
      tag: 'V',
      source: TEAM_21_NOV,
      brief: 'Layers 2 and 3: the arm leaves the oven, is dosed at the loading position and swings back in.',
      alternative: 'The arm stays in the oven for all layers and pauses there while the next layer goes in. This was the default until 21 Nov.',
      why:
        `The team saw the arm come out for layers 2 and 3. Output cannot choose between the two: both give a ${f(base.cycleMin)} min cycle and ${base.total} tanks. What differs is where arms wait. With the return, the loaded wait before the oven is ${f(base.waitOvenMin, 1)} min, close to NTG's estimate of ${P.waitBeforeOvenMin.value} (row ${P.waitBeforeOvenMin.row}), and the arm behind waits empty at demould. ` +
        `With a pause in the oven the loaded wait would be ${f(alt.waitOvenMin, 1)} min. The observation decides; the wait only fits it.`,
      usedIn: 'config.layerMode = returnToLoad; ovenPhases in engine.ts; the arm swings in the 3D machine',
      replace: 'Film one full oven visit. Switch "How the next layer goes in" in the set-up drawer.',
      rows: [26, 45, 46],
    },
    {
      id: 'A37',
      group: 'Oven and layers',
      decision: 'Where the next arm waits while an arm is in its oven visit',
      value: 'The loading position is kept free for the arm that comes back for layers 2 and 3. The arm behind waits empty at demould and is loaded when the visit ends.',
      tag: 'S',
      alternative: 'The arm behind is loaded at once and waits, loaded, at a separate waiting position before the oven.',
      why: `With ${P.positions.value} positions there is one place before the oven, and the returning arm needs it. A separate waiting position would mean both cooling phases share the chamber, which gives a ${f(rej('bothInChamber').cycleMin, 1)} min cycle (A13). The cost is an empty wait of ${f(base.waitLoadMin, 1)} min per oven visit over the shift, ${f(v.identity.steady.waitLoad, 1)} min in a mid-shift cycle. NTG gave no figure for it, so it is the twin's alone.`,
      usedIn: 'reserved positions in tryMove, engine.ts; kpis.meanWaitLoadMin',
      replace: 'Timed shift: the minute an arm is emptied and the minute it is loaded again.',
      rows: [39, 46],
    },
    {
      id: 'A20',
      group: 'Oven and layers',
      decision: 'How the heating time is shared between layers',
      value: `Equal parts: ${f(heatEach, 1)} min for each of the ${cfg.layers} layers.`,
      tag: 'S',
      alternative: `In proportion to layer weight (the outer layer is the heaviest: ${kg('CTT4')[0]} of ${visitKg} kg for CTT4), or the real timer set points per layer.`,
      why: `No per-layer time was recorded. The split only moves the minutes at which the arm swings out for the next layer. The visit stays ${f(T.ovenVisit, 1)} min under any split, so the cycle, the tank counts and the oven use do not change.`,
      usedIn: 'ovenPhases in engine.ts (heatEach); the "layer 1 of 3" label',
      replace: 'Read the three timer set points from the recipe page of the machine\'s HMI.',
      rows: [26, 43],
    },
    {
      id: 'A19',
      group: 'Oven and layers',
      decision: 'Arms that carry other products',
      value: `An "other product" arm takes one unbroken ${f(T.ovenVisit, 1)} min oven visit with no return to loading, the same cooling and demould, and gives one item per cycle. No powder is tracked for it.`,
      tag: 'S',
      alternative: 'Leave those arms empty, or give other products their own oven time and weights.',
      why:
        `Leaving the arm empty is wrong for the oven: with three working arms the cycle drops to ${f(threeArms.cycleMin, 1)} min and the tank arms make ${triple(threeArms.tanksTotal)}, which is the ERP's five-cycle day, not the typical one. The arm must take its oven turn for the tank arms to see the right queue. ` +
        `Own times and weights were not given: "other" is a group of many items (row 4). So silo and hopper levels show the three tanks' powder only.`,
      usedIn: 'MouldKind OTHER in src/sim/types.ts; ovenPhases (one layer) and kgFor in engine.ts',
      replace: 'Oven time and shot weight of the main other items, from NTG\'s weekly plan sheets.',
      rows: [4, 40, 51],
    },
    // ---------------------------------------------------------------- Times
    {
      id: 'A9',
      group: 'Times',
      decision: 'Time to move an arm between two positions (door opens, arm swings, door closes)',
      value: `${f(assumed.indexMin.value, 1)} ${assumed.indexMin.unit}, for every move and every swing.`,
      tag: assumed.indexMin.tag,
      brief: `Arm move between positions: ${f(assumed.indexMin.value, 1)} min, not timed.`,
      alternative: `${f(iLo.value)} min or ${f(iHi.value)} min, the ends of the team's range.`,
      why: `Not timed. With the ${f(T.ovenVisit, 1)} min oven visit it gives ${P.arms.value} x ${f(T.ovenVisit + T.index)} = ${f(base.cycleMin)} min, NTG's cycle. At ${f(iLo.value)} min the cycle is ${f(iLo.run.cycleMin)} and at ${f(iHi.value)} min it is ${f(iHi.run.cycleMin)}; the shift gives ${iLo.run.total === iHi.run.total ? `${iLo.run.total} tanks either way` : `${iLo.run.total} and ${iHi.run.total} tanks`}. So the choice moves the cycle by under 2 % and no tank count. It is a calibration, and the validation says so.`,
      usedIn: 'times.index in src/sim/config.ts; every move in engine.ts',
      replace: 'Stopwatch on ten arm changes. Enter "Index time" in the set-up drawer.',
      rows: [47, 48],
    },
    {
      id: 'A17',
      group: 'Times',
      decision: 'Wait for the crew before demould',
      value: `${f(T.demouldWait)} min before every demould, fixed. It is the middle of NTG's ${String(invRow(P.demouldWaitMin.row).value).split('(')[0]!.trim()} min.`,
      tag: P.demouldWaitMin.tag,
      alternative: `Model the ${P.workers.value} workers as a crew that also loads and finishes, so that the wait comes out of the model.`,
      why: `A crew model needs a time for every job and who does which; only loading (${f(T.load)} min) and finishing (${f(T.finishing)} min) were observed. As an input, the twin cannot claim to explain this wait, and the validation table marks it so. With no crew wait at all the cycle stays ${f(v.crewWaitZero.cycleMin)} min and the wait before the oven grows from ${f(base.waitOvenMin, 1)} to ${f(v.crewWaitZero.waitOvenMin, 1)} min.`,
      usedIn: 'times.demouldWait; the waitDemould stage in engine.ts',
      replace: 'Timed shift: the minute an arm arrives cooled, and the minute the hoist starts.',
      rows: [72, 74],
    },
    {
      id: 'A18',
      group: 'Times',
      decision: 'Demould and mould preparation time',
      value: `${f(T.demould)} min per arm, whatever the moulds. A placeholder.`,
      tag: P.demouldMin.tag,
      brief: `Demould and mould prep: ${f(T.demould)} min per arm, a placeholder (range ${f(v.demould.range[0])} to ${f(v.demould.range[1])}).`,
      alternative: `Any value in the inventory's ${f(v.demould.range[0])} to ${f(v.demould.range[1])} min range, or a time per mould.`,
      why:
        `Row ${P.demouldMin.row} sets ${f(T.demould)} min so that the task times add up toward ${P.armCycleMin.value}. It is the least certain time in the twin. From ${f(dLo.value)} to ${f(v.demould.holdsCycleUpTo)} min the cycle and the ${base.total} tanks do not move, and the loaded wait before the oven stays between ${f(v.demould.waitAtLimit, 1)} and ${f(dLo.run.waitOvenMin, 1)} min. ` +
        `Above ${f(v.demould.holdsCycleUpTo)} min arms are held in cooling, and at ${f(dLast.value)} min the twin makes ${dLast.run.total} tanks. A time per mould was not used because only one figure exists.`,
      usedIn: 'times.demould; the demoulding stage in engine.ts',
      replace: 'Timed shift: hoist start to mould closed, per arm, for both mould sizes.',
      rows: [72, 73],
    },
    {
      id: 'A21',
      group: 'Times',
      decision: 'Fixed times or random times',
      value: `Every task takes its fixed time. A switch varies heating, cooling and demould by up to +/-${f(v.variation.jitter * 100)} %, uniform, from a seeded generator.`,
      tag: 'S',
      alternative: 'Fit a distribution to each step (for example lognormal for demould, normal for the timer-driven steps) and run many replications.',
      why:
        `No timed observations exist, so there is nothing to fit: any distribution would be invented. NTG's times are single estimates, and the oven and cooling run on timers, so their real spread is small. ` +
        `With +/-${f(v.variation.jitter * 100)} % over ${v.variation.seeds} seeds the shift still gives ${v.variation.total[0] === v.variation.total[1] ? v.variation.total[0] : `${v.variation.total[0]} to ${v.variation.total[1]}`} tanks; the cycle runs ${f(v.variation.cycleMin[0], 1)} to ${f(v.variation.cycleMin[1], 1)} min and the run-out ${f(v.variation.runOutMin[0])} to ${f(v.variation.runOutMin[1])} min.`,
      usedIn: 'config.jitter; vary() and rng() in engine.ts',
      replace: 'A timed shift with about 20 cycles per step. Fit, then replace vary().',
      rows: [43, 68, 69, 73],
    },
    {
      id: 'A32',
      group: 'Times',
      decision: 'Unplanned stoppages',
      value: 'None in any run.',
      tag: invRow(67).tag as Tag,
      alternative: 'Random breakdowns with a failure rate and a repair time.',
      why: `NTG reports about one stoppage every other year (row 67). That is too rare to fit a rate, and it would not occur in a simulated week.`,
      usedIn: 'src/sim/engine.ts has no failure event',
      replace: 'A maintenance log with dates and durations.',
      rows: [67],
    },
    {
      id: 'A33',
      group: 'Times',
      decision: 'Mould changes',
      value: 'Moulds are changed between shifts and cost no machine time.',
      tag: 'S',
      alternative: `Charge ${P.mouldChangeMin.value} min to the arm on the day its mould changes.`,
      why: `NTG gives ${P.mouldChangeMin.value} min for a CTT4 mould, about once a week, and says the 2,000 L moulds stay on (rows ${P.mouldChangeMin.row}, 34). That is ${f((P.mouldChangeMin.value / cfg.shiftMin) * 100, 1)} % of one shift. The scenarios move moulds between days more often than NTG's plan does, so they are flattered by up to ${P.mouldChangeMin.value} min per change.`,
      usedIn: 'Each day of a scenario is a separate run (src/sim/scenarios.ts)',
      replace: 'Change times for the 2,000 L moulds, then add a set-up stage to the first load of the day.',
      rows: [33, 34, 35],
    },
    // ------------------------------------------- Crew, finishing and quality
    {
      id: 'A22',
      group: 'Crew, finishing and quality',
      decision: 'Finishing after demould',
      value: `One finisher, one tank at a time, ${f(T.finishing)} min each, in the order tanks come out. A tank counts as made when it is lifted out of the mould.`,
      tag: 'S',
      alternative: `The ${P.workers.value} workers finish in parallel, or a tank counts only when finishing ends.`,
      why: `The ${f(T.finishing)} min is from the visit (row ${P.finishingMin.row}); who does it is not recorded (row ${P.workers.row}). One at a time is the cautious reading, and finishing still never holds an arm: ${base.total} tanks x ${f(T.finishing)} min is ${f(base.total * T.finishing)} min of work in a ${f(cfg.shiftMin)} min shift. At ${f(T.finishing * 2)} min per tank the cycle is ${f(finishDouble.cycleMin)} min and the count ${finishDouble.total}, unchanged.`,
      usedIn: 'The finishing loop at the end of runSimulation; the finished-tank buffer in the 3D machine',
      replace: 'Timed shift: minutes per tank and how many people finish.',
      rows: [74, 75, 77],
    },
    {
      id: 'A23',
      group: 'Crew, finishing and quality',
      decision: 'Rejects',
      value: '0 %: every loaded mould gives a good tank.',
      tag: invRow(76).tag as Tag,
      alternative: `${f(scrapRange[0])} to ${f(scrapRange[1])} % rejects drawn at random, the sensitivity the inventory suggests.`,
      why: `NTG says rejects happen "rarely" (row 76). At ${f(scrapRange[1])} %, a ${planTanks}-tank week loses about ${f((planTanks * scrapRange[1]) / 100)} tank, less than the difference between any two scenarios. The odd daily quantities in the ERP (${v.erp.CTT4.unexplained.join(', ')} on ${v.erp.CTT4.daysNone} of ${v.erp.CTT4.days} CTT4 days) could be rejects or short days. The ERP does not say which.`,
      usedIn: 'Tanks = moulds x cycles in engine.ts',
      replace: 'A reject log by product.',
      rows: [76],
    },
    // --------------------------------------------------------- Raw material
    {
      id: 'A3',
      group: 'Raw material',
      decision: 'Order of the layers, and which silo feeds which',
      value: 'Outer (ivory) first, then foam, then inner (natural). One silo per layer in that order. The line is extruder, pulveriser, silo.',
      tag: invRow(26).tag as Tag,
      alternative: 'Foam as the innermost layer, which is what the style bible first drew (outer coloured, middle, inner foam).',
      why: `The visit notes list the layers as "${String(invRow(26).value)}" (row 26) and the team confirmed one silo per layer under the same names (rows 12, 23). A foam core between two solid skins also fits the weights: the unpigmented inner layer is the one in contact with the water. The order decides which hopper empties at which pause. It changes no tank count.`,
      usedIn: 'LAYERS in src/data/params.ts; doses by layer in engine.ts; the raw-material scene',
      replace: 'Ask NTG once, on site. Row 15 notes the wording is still to confirm.',
      rows: [12, 15, 23, 26],
    },
    {
      id: 'A24',
      group: 'Raw material',
      decision: 'Powder per layer',
      value: SKUS.map((k) => `${k} ${kg(k).join(' / ')} = ${kgSum(k)} kg`).join('; ') + ' (visit notes).',
      tag: P.layerKg.CTT4.tag,
      alternative: `NTG's weekly plan: ${planKg} kg for a CTT4 (row ${P.planKgPerTank.row}), which the inventory names as the base for cost.`,
      why: `The plan gives a total per tank and no split by layer. The twin doses layer by layer, so it needs the split. CTT2 and HTT2 agree exactly between the two sources. Scaling the CTT4 layers up to ${planKg} would invent three numbers. The effect is ${planKg - visitKg} kg a tank, ${f(((planKg - visitKg) / planKg) * 100, 1)} %, on silo and hopper levels only.`,
      usedIn: 'config.layerKg; doses, silo and hopper levels',
      replace: 'Weigh the three CTT4 charges once, or read the recipe.',
      rows: [27, 28, 29, 30],
    },
    {
      id: 'A34',
      group: 'Raw material',
      decision: 'What the pigment and foam agent doses apply to',
      value: `Pigment ${f(P.pigmentDose.value * 100)} % of the outer layer. Foam agent ${f(P.foamDose.value * 100, 1)} % of the foam layer.`,
      tag: P.pigmentDose.tag,
      alternative: `Pigment as ${f(P.pigmentDose.value * 100)} % of the whole tank.`,
      why: `NTG gave the two doses (rows ${P.pigmentDose.row}, ${P.foamDose.row}) but not what they are a share of. Only the outer layer is coloured (row 26), so the dose is applied there: ${f(kg('CTT4')[0] * P.pigmentDose.value, 2)} kg for a CTT4. On the whole tank it would be ${f(visitKg * P.pigmentDose.value, 2)} kg.`,
      usedIn: 'kpis.pigmentKg and kpis.foamAgentKg in engine.ts',
      replace: 'One question to NTG.',
      rows: [19, 21, 26],
    },
    {
      id: 'A11',
      group: 'Raw material',
      decision: 'Silo level at the start, and when powder is ground',
      value: `Each silo starts ${f(assumed.siloStartFill.value * 100)} % full (${f(siloKg * assumed.siloStartFill.value)} of ${f(siloKg)} kg). The powder each layer uses today is ground today, one layer after another, at ${f(cfg.raw.grindRateKgH)} kg/h.`,
      tag: assumed.siloStartFill.tag,
      alternative: `Grind a fixed batch when a silo falls to a reorder level (${f(assumed.siloReorderFill.value * 100)} % and ${f(assumed.grindBatchKg.value)} kg were pencilled in; the simulator does not use them), or start from a real stock count.`,
      why: `NTG grinds on demand and gave no powder count or batch rule (row 16). One silo holds more than three weeks of outer-layer use (row 25), so powder never limits the machine in any scenario; the start level only sets where the gauge sits. The rate is the middle of a researched ${f(grindRange[0])} to ${f(grindRange[1])} kg/h range, not an NTG figure.`,
      usedIn: 'raw.siloStartFill, raw.grindRateKgH; rawMaterial() in engine.ts; silo gauges',
      replace: 'A stock count per silo on a Monday, and the pulveriser rate from NTG.',
      rows: [12, 16, 23, 25],
    },
    {
      id: 'A4',
      group: 'Raw material',
      decision: 'How powder reaches the hoppers above the machine',
      value: 'A forklift carries a bin from the silo to the dosing platform.',
      tag: 'S',
      alternative: 'A pneumatic line from the silos to the hoppers, or sacks emptied by hand on the platform.',
      why: 'This is the team\'s description of the hall, taken as the default in the style bible. NTG has not confirmed it. It is drawn in the raw-material scene and decides nothing in the machine: no arm ever waits for powder in the simulator.',
      usedIn: 'rawMaterial() in engine.ts (bin trips); the raw-material scene',
      replace: 'One question to NTG, or a photo of the platform being filled.',
      rows: [15],
    },
    {
      id: 'A12',
      group: 'Raw material',
      decision: 'Hopper sizes, bin size and forklift trip',
      value: `Two hoppers of ${f(assumed.hopperCapacityKg.value)} kg: one for the outer layer, one split ${f(cfg.raw.hopperCapacityKg[1])} / ${f(cfg.raw.hopperCapacityKg[2])} kg between foam and inner. A ${f(assumed.binKg.value)} kg bin is called when a hopper falls below ${f(assumed.hopperRefillBelowKg.value)} kg. One forklift, ${f(assumed.binTripMin.value)} min a trip.`,
      tag: assumed.hopperCapacityKg.tag,
      alternative: 'One hopper per layer, or a bin sent on a fixed round whatever the level.',
      why: 'Sizes are estimated from the photo of the dosing platform, which shows two hoppers. Nobody timed the forklift. These numbers move the hopper gauges and the bin on screen only: the simulator never holds an arm for powder, and the tests check that no hopper goes below zero in any tested set-up.',
      usedIn: 'raw.hopperCapacityKg, raw.binKg, raw.binTripMin, raw.hopperRefillBelowKg; rawMaterial() in engine.ts',
      replace: 'Hopper volumes from the nameplate, and three timed forklift trips.',
      rows: [14, 23],
    },
    // --------------------------------------------- Week scenarios and stock
    {
      id: 'A26',
      group: 'Week scenarios and stock',
      decision: 'Which mould sits on which arm on which day',
      value: `NTG's plan is placed as ${placement}. That is ${placed} tank arm-days${placed === Number(armDays[1]) ? ', as on NTG\'s sheet' : ''}.`,
      tag: 'S',
      alternative: `The real mould on each arm on each day, from NTG's arm sheet, if it were known. Or the fewest arm-days that make the quantities.`,
      why: `The plan in the inventory gives quantities (${triple(P.pipeline.value)}) and arm-days per arm (${armDays[1]} of ${armDays[2]}, row 40), not the mould on each arm each day. The placement keeps NTG's arm-days per arm and fills in moulds so that the quantities come out. The oven takes every arm in turn whatever it carries, so the placement changes the day a tank is made, not how many are made in the week.`,
      usedIn: 'SCENARIOS in src/sim/scenarios.ts; the Redesign page',
      replace: 'Copy the arm rows of NTG\'s weekly plan sheet into SCENARIOS.',
      rows: [40, 56, 86, 90],
    },
    {
      id: 'A36',
      group: 'Week scenarios and stock',
      decision: 'Running days in the scenario week',
      value: `${ntgPlan.days.length} running days of one ${f(P.shiftHours.value, 1)} h shift, the same in every scenario.`,
      tag: invRow(56).tag as Tag,
      alternative: `${P.daysPerWeek.value} days, the plant's normal week.`,
      why: `Machine 3700 ran on ${ntgPlan.days.length} days in the planned week (row 56: "${String(invRow(56).value)}"). Keeping the days equal means a scenario can only differ by what is on the arms, which is the one change NTG said it would allow (row 66).`,
      usedIn: 'SCENARIOS in src/sim/scenarios.ts',
      replace: 'Add or remove a day in each scenario.',
      rows: [54, 55, 56, 66],
    },
    {
      id: 'A27',
      group: 'Week scenarios and stock',
      decision: 'How the stock band check is done',
      value: `Opening stock is NTG's count on 6 Nov (${triple(P.closingStock6Nov.value)}). Sales are the mean of 45 full weeks (${triple(P.weeklySalesMean.value, 1)}). Closing stock = opening + made - sales. The band runs from NTG's minimum (${triple(P.minStock.value)}) to the warehouse cap (${triple(P.warehouseCap.value)}).`,
      tag: 'C',
      alternative: `Open from the stock list of 6 Nov (${listAvail} available); or use one week's real sales; or mean sales plus a margin from the weekly spread (standard deviation ${triple(P.weeklySalesSd.value, 1)}).`,
      why: `Form 1 matches the ERP stock cards and the list does not (row 80). An average week is used because the comparison is about the shape of the plan, not about one week's luck: the week of 2 to 6 Nov sold CTT2 at twice its average (row 102). Variability and the one-week lag from plan to stock (row 85) are handled on the Plan page. This check ignores both, and returns.`,
      usedIn: 'evaluateWeek and OPENING_STOCK in src/sim/scenarios.ts; the Redesign table',
      replace: 'Friday\'s stock count and the latest ERP export.',
      rows: [79, 80, 82, 85, 95, 102, 103],
    },
    {
      id: 'A35',
      group: 'Week scenarios and stock',
      decision: 'Rule that picks the recommended scenario',
      value: 'Among scenarios that keep every product inside the stock band and use no more tank arm-days than the baseline, take the smallest spread in weeks of cover. A tie goes to fewer arm-days.',
      tag: 'S',
      alternative: 'Most tanks in the week, or lowest cost (the linear programme on the Plan page).',
      why: `Every scenario loads the oven the same (${base.ovenVisits} visits a day), so output per arm-day is equal and cannot rank them. NTG plans to minimum stock plus special orders (row 88), and its stock leaves its own band in many weeks (row 105). Even cover measures that directly. Cost needs prices and belongs to the Plan page.`,
      usedIn: 'recommend() in src/sim/scenarios.ts; the Redesign page',
      replace: 'Edit recommend(). docs/MODEL.md states whatever rule is in the code.',
      rows: [82, 88, 95, 105],
    },
    // -------------------------------------------------------- Display only
    {
      id: 'A10',
      group: 'Display only',
      decision: 'Oven temperature curve',
      value: `Set point ${f(cfg.oven.setC, 1)} °C; the air drops ${f(assumed.ovenDoorDipC.value)} °C while a door is open and recovers with a ${f(assumed.ovenRecoverTauMin.value, 1)} min time constant.`,
      tag: 'S',
      alternative: 'Show no temperature at all, or NTG\'s logged oven temperature.',
      why: `NTG gave no oven temperature. The set point is the middle of a researched range (row ${P.ovenTempC.row}), and the dip and recovery are picked to look like a burner-heated chamber. The curve is illustrative: it drives the glow and the console read-out and enters no count, time or KPI.`,
      usedIn: 'ovenTemperature() in engine.ts; oven glow, console and the key-figures panel',
      replace: 'A thermocouple log, or the HMI trend page, for one shift.',
      rows: [65],
    },
    {
      id: 'A25',
      group: 'Display only',
      decision: 'How fast moulds tumble and the fan spins on screen',
      value: 'A whole number of turns per stretch, chosen to stay readable at the playback speed. Not the machine\'s real rpm.',
      tag: 'S',
      alternative: 'The real rotation speeds of the two axes and of the fan.',
      why: 'No rpm is recorded for Machine 3700. At 100x playback a true speed would blur into a disc. The turns start and stop exactly with the simulated stretch, so the picture still says when a mould is rotating and when it is not.',
      usedIn: turnsNote,
      replace: 'Major and minor axis rpm from the recipe page.',
      rows: [],
    },
    {
      id: 'A1',
      group: 'Display only',
      decision: 'Tank colour',
      value: 'Grey body and black top for all three products.',
      tag: 'V',
      alternative: 'Ivory, after the name of the outer-layer powder (row 26).',
      why: `The hoist photo shows grey tanks, and NTG names the pigment as grey (row ${P.pigmentDose.row}). "Ivory" is the inventory's name for the outer-layer silo. Colour changes nothing but the picture.`,
      usedIn: 'src/scene/materials.ts (tank, tankTop)',
      replace: 'A photo of each finished product.',
      rows: [19, 26],
    },
    {
      id: 'A6',
      group: 'Display only',
      decision: 'Screen theme',
      value: 'Dark only. The printed report is black on white.',
      tag: 'S',
      alternative: 'A light theme, or a switch between the two.',
      why: 'The style bible sets a control-room look, and the oven glow, the one warm colour that means heat, reads best on a dark floor. A design choice by the team; no plant data is involved.',
      usedIn: 'src/design/tokens.ts; the print styles on the Report page',
      replace: 'Not a data question.',
      rows: [],
    },
    {
      id: 'A7',
      group: 'Display only',
      decision: 'Sound',
      value: 'Off.',
      tag: 'S',
      alternative: 'Machine sounds tied to simulator events (door, burner, hoist).',
      why: 'Sound would add nothing an owner can read a number from, and the twin is meant to be shown in a meeting room. A design choice by the team.',
      usedIn: 'Nowhere: no audio code exists',
      replace: 'Not a data question.',
      rows: [],
    },
  ];
  cached = rows;
  return rows;
}

/** The five entries the Report page lists. Each has a `brief`. */
export const MAIN_ASSUMPTIONS = ['A2', 'A14', 'A9', 'A18', 'A16'] as const;

export const GROUPS: AssumptionGroup[] = [
  'Machine and positions',
  'Oven and layers',
  'Times',
  'Crew, finishing and quality',
  'Raw material',
  'Week scenarios and stock',
  'Display only',
];

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

/** docs/ASSUMPTIONS.md, generated so the document and the page cannot disagree. */
export function assumptionsMarkdown(): string {
  const rows = assumptions();
  const head = [
    '# Assumptions register',
    '',
    'Generated from `src/pages/report/assumptions.ts`. Do not edit by hand: change the register and run',
    '`UPDATE_DOCS=1 npx vitest run src/pages/report`. The numbers in the sentences are read from the inventory,',
    'from `assumed` in `src/data/params.ts` or from a simulator run, so they follow the code.',
    '',
    `${rows.length} entries. Each one records a modelling decision that is not a confirmed NTG fact, the value the twin uses,`,
    'at least one alternative that was considered, and why the value used was preferred.',
    '',
    'Tags: N = NTG reported, V = team visit, C = calculated, S = synthetic or researched estimate.',
    'The tag is that of the value used. "Rows" are rows of `data/NTG_Data_Inventory_v1.xlsx`.',
    'Entries in the last group change the picture only: no count, time or KPI depends on them.',
    '',
    'IDs A1 to A8 keep their meaning from the first register of 20 Nov. A3 changed its layer order (foam in the middle)',
    'once the inventory was loaded. A2 and A14 were settled by the team on 21 Nov 2026: for layers 2 and 3 the arm leaves the',
    'oven and returns to the loading position, and those swings are inside the oven time the team measured.',
    '',
  ];
  const out = [...head];
  for (const g of GROUPS) {
    out.push(`## ${g}`, '');
    out.push('| ID | Decision | Value used | Tag | Alternative considered | Why this one | Where it is used | How to replace it | Rows |');
    out.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const r of rows.filter((x) => x.group === g))
      out.push(`| ${[r.id, r.decision, r.value, r.source ? `${r.tag} (${r.source})` : r.tag, r.alternative, r.why, r.usedIn, r.replace, r.rows.join(', ') || 'none'].map(cell).join(' | ')} |`);
    out.push('');
  }
  return out.join('\n');
}
