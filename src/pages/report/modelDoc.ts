/**
 * docs/MODEL.md, generated from the code so the page of prose and the
 * simulator cannot disagree. Run `UPDATE_DOCS=1 npx vitest run src/pages/report`.
 */
import { P, assumed } from '../../data/params';
import { defaultConfig, ringFor, STATION_LABEL } from '../../sim/config';
import { assumptions } from './assumptions';
import { FIELD_TIMING, f, signed, sumSku, triple, validation } from './validation';

export function modelMarkdown(): string {
  const v = validation();
  const cfg = defaultConfig();
  const T = cfg.times;
  const b = v.base;
  const ring = ringFor(cfg).map((s) => STATION_LABEL[s].toLowerCase());
  const pauses = (cfg.layers - 1) * T.layerPause;
  const heat = (T.ovenVisit - pauses) / cfg.layers;
  const rej = (id: string) => v.rejected.find((r) => r.id === id)!.run;
  const iLo = v.index.sweep[0]!;
  const iHi = v.index.sweep[v.index.sweep.length - 1]!;
  const share = (n: number, d: number) => `${f((n / d) * 100)} %`;
  const erp = (['CTT4', 'CTT2', 'HTT2'] as const).map((k) => {
    const e = v.erp[k];
    return `| ${k} | ${e.days} | ${e.fourArm} | ${share(e.daysFour, e.days)} | ${e.threeArm.join(', ')} | ${share(e.daysThree, e.days)} | ${share(e.daysMultiple, e.days)} | ${share(e.daysNone, e.days)} (${e.unexplained.join(', ')}) |`;
  });
  const w = v.weekNov2;

  return [
    '# Model: the Machine 3700 simulator',
    '',
    'Generated from `src/pages/report/modelDoc.ts`; every number below is read from the inventory or from a simulator run.',
    'Status: **calibrated, not validated**. ' + FIELD_TIMING.text,
    '',
    '## What it is',
    '',
    'A discrete-event simulator in plain TypeScript (`src/sim`). One run is one shift. The same configuration and seed always',
    'give the same event log. `stateAt(t, result)` returns the whole plant at minute `t`; the 3D machine, the panels and the',
    'timeline only read that state, so playing, pausing and scrubbing cannot change a result. A week is a list of shifts',
    '(`evaluateWeek` in `src/sim/scenarios.ts`).',
    '',
    '## The ring of positions',
    '',
    `${P.arms.value} arms travel one way round ${P.positions.value} positions: ${ring.join(', ')}, then back to ${ring[0]}. A position holds one arm.`,
    `An arm does the work of the position it is at, then moves on as soon as the next position is free. Arms cannot pass each`,
    `other. A move takes ${f(T.index, 1)} min (assumption A9).`,
    '',
    '| Position | Work | Minutes | Tag | Inventory row |',
    '| --- | --- | --- | --- | --- |',
    `| Loading | Close the mould, first layer of powder in | ${f(T.load)} | ${P.loadMin.tag} | ${P.loadMin.row} |`,
    `| Oven | ${cfg.layers} heats of ${f(heat, 1)} min with ${cfg.layers - 1} pauses of ${f(T.layerPause, 1)} min for the next layer | ${f(T.ovenVisit, 1)} | ${P.ovenVisitMin.tag} | ${P.ovenVisitMin.row}, ${P.layerPauseMin.row} |`,
    `| Air cooling | Mould turns in the open | ${f(T.air)} | ${P.airCoolMin.tag} | ${P.airCoolMin.row} |`,
    `| Cooling chamber | Fan and water | ${f(T.water)} | ${P.waterCoolMin.tag} | ${P.waterCoolMin.row} |`,
    `| Demould | Wait for the crew ${f(T.demouldWait)} min (an input), then hoist the tanks out and prepare the mould | ${f(T.demouldWait)} + ${f(T.demould)} | ${P.demouldWaitMin.tag}, ${P.demouldMin.tag} | ${P.demouldWaitMin.row}, ${P.demouldMin.row} |`,
    '',
    `Finishing (${f(T.finishing)} min a tank, row ${P.finishingMin.row}) happens off the arm and never holds it.`,
    '',
    '## The oven rule',
    '',
    `The oven takes one arm at a time, by turn (NTG, row 42). One visit of ${f(T.ovenVisit, 1)} min covers all ${cfg.layers} layers. Near the end`,
    `of the shift the oven takes no arm it cannot finish by the ${f(P.shiftHours.value, 1)} h mark; arms already cooked are cooled and demoulded`,
    'after it. Nothing else in the model says where arms should queue.',
    '',
    `Because every arm must take its turn, the arm cycle is an **output**: ${P.arms.value} arms x (${f(T.ovenVisit, 1)} + ${f(T.index, 1)}) min = ${f(b.cycleMin, 1)} min.`,
    '',
    '## Inputs and outputs',
    '',
    '**Inputs.** The moulds on each arm; the shift length; the task times in the table; the index time; powder per layer per',
    'product; four switches (layers in one visit or with a return to loading, pauses inside or on top of the visit, cooling',
    'layout, end-of-shift rule); an optional +/-${f(v.variation.jitter * 100)} % variation with a seed. Inputs come from `P` (inventory, with its N/V/C/S tag)',
    'or from `assumed` (tag S). The wait for the crew and the demould time are inputs, so the twin cannot explain them.',
    '',
    '**Outputs.** Arm cycle; oven visits; tanks per product, by the mark and in total; share of the shift the oven is in use;',
    'mean wait before the oven; minutes arms are held because the next position is occupied; run-out after the mark; the',
    'position arms wait for most (the bottleneck); powder dosed per layer, pigment and foam agent; silo and hopper levels.',
    '',
    '## Calibration',
    '',
    `With the default settings one shift gives a ${f(b.cycleMin, 1)} min cycle (NTG ${P.armCycleMin.value}, row ${P.armCycleMin.row}), ${b.ovenVisits} oven visits,`,
    `${triple(b.tanksTotal)} tanks (NTG ${triple(P.tanksPerShift.value)}, row ${P.tanksPerShift.row}) and ${f(b.cyclesPerArm)} cycles per mould (NTG ${P.cyclesPerMouldPerDay.value}, row ${P.cyclesPerMouldPerDay.row}).`,
    'These choices were made so that this comes out. Each alternative is still in the code and is run live on the Report page:',
    '',
    '| Choice | Used | Alternative | Alternative gives |',
    '| --- | --- | --- | --- |',
    `| Index time (A9) | ${f(T.index, 1)} min | ${f(iLo.value)} or ${f(iHi.value)} min | cycle ${f(iLo.run.cycleMin)} or ${f(iHi.run.cycleMin)} min, ${iLo.run.total} tanks |`,
    `| Layer pauses (A15) | inside the ${f(T.ovenVisit, 1)} min | on top | cycle ${f(rej('pausesOnTop').cycleMin, 1)} min, ${rej('pausesOnTop').total} tanks |`,
    `| Cooling layout (A13) | air cooling at an open position | both phases in the chamber | cycle ${f(rej('bothInChamber').cycleMin, 1)} min, ${rej('bothInChamber').total} tanks |`,
    `| Layers (A2) | one oven visit | return to loading per layer | cycle ${f(rej('returnToLoad').cycleMin, 1)} min, ${rej('returnToLoad').total} tanks |`,
    `| Oven time (A14) | per visit | per layer | cycle ${f(rej('perLayer').cycleMin, 1)} min, ${rej('perLayer').total} tanks |`,
    '',
    'Independent check, not used for calibration: daily output in the ERP (production days, Jan to Nov 2026).',
    '',
    '| Product | ERP days | Twin, four arms | Days equal | Twin, three arms | Days equal | Other moulds x cycles | No match (quantities) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...erp,
    '',
    `Week of 2 to 6 Nov: ERP ${triple(w.erp)}; twin ${triple(w.twin)} for ${w.productionDays.HTT2} production days with ${triple(w.moulds)} moulds on (set-up assumed).`,
    '',
    '## Gaps against NTG\'s figures',
    '',
    `1. **Tanks by the ${f(P.shiftHours.value, 1)} h mark.** The twin has ${triple(b.tanksInShift)} (${b.inShift}) out by the mark, not ${sumSku(P.tanksPerShift.value)}. The last ${b.lateArms} arms finish after it; the last tank is out ${f(b.runOutMin, 1)} min late. Not tuned away.`,
    `2. **Wait before the oven.** Twin ${f(b.waitOvenMin, 1)} min, NTG's estimate ${P.waitBeforeOvenMin.value} min (row ${P.waitBeforeOvenMin.row}): ${signed(b.waitOvenMin - P.waitBeforeOvenMin.value, 1)} min. The demould time is a placeholder (${f(T.demould)} min, range ${f(v.demould.range[0])} to ${f(v.demould.range[1])}); a longer demould gives a shorter wait at the same cycle, down to ${f(v.demould.waitAtLimit, 1)} min at ${f(v.demould.holdsCycleUpTo)} min. The split cannot be settled without a timed shift.`,
    `3. **Minutes nobody estimated.** NTG's and the team's task times plus ${v.identity.indexMoves} moves add up to ${f(v.identity.sumMin, 1)} min; the cycle is ${v.identity.cycleMin}. The missing ${f(v.identity.unexplainedMin, 1)} min appear in the twin as waiting before the oven.`,
    `4. **No timed data.** No distribution is fitted. Times are fixed; the optional +/-${f(v.variation.jitter * 100)} % variation is a stress test, not a measurement.`,
    `5. **Other products** take the same oven visit as tanks and their powder is not tracked (A19).`,
    `6. **Picture only.** Mould tumble and fan speeds are scaled to stay readable at the playback speed (A25), and the oven temperature curve is illustrative (A10, dip ${f(assumed.ovenDoorDipC.value)} °C). Neither enters a count.`,
    '',
    `The full list of ${assumptions().length} decisions, each with its alternative, is in docs/ASSUMPTIONS.md. Known conflicts in the data are listed on the Report page.`,
    '',
    '## Tests',
    '',
    '`src/sim/engine.test.ts` checks, for nine configurations, that no two arms share a position, that timelines are continuous,',
    'that tanks are whole and powder balances, and that the state at a minute does not depend on how the clock got there.',
    '`src/pages/report/validation.test.ts` checks that every figure on the Report page is taken from a run and that this file and',
    'the assumptions register match the code.',
    '',
  ].join('\n');
}
