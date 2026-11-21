/**
 * docs/MODEL.md, generated from the code so the page of prose and the
 * simulator cannot disagree. Run `UPDATE_DOCS=1 npx vitest run src/pages/report`.
 *
 * It also holds what the Redesign page no longer shows: the full comparison,
 * the rule behind the recommendation and what the twin cannot tell.
 */
import { P, SKUS, assumed } from '../../data/params';
import { defaultConfig, ringFor, STATION_LABEL } from '../../sim/config';
import { OPENING_STOCK, SCENARIOS, evaluateWeek, recommend, type WeekResult } from '../../sim/scenarios';
import { BASELINE_ID, EXTRA_ARM_DAYS_ALLOWED, distinct, mouldChanges, ruleChecks } from '../redesign/rule';
import { assumptions } from './assumptions';
import { FIELD_TIMING, f, invRow, signed, sumSku, triple, validation } from './validation';

const BAND_WORD: Record<WeekResult['band']['CTT4'], string> = { below: 'below minimum', in: 'inside', above: 'above cap' };

function redesignSection(): string[] {
  const results = SCENARIOS.map((s) => evaluateWeek(s));
  const rec = recommend(results);
  const checks = ruleChecks(results);
  const base = results.find((r) => r.scenario.id === BASELINE_ID) ?? results[0]!;
  const recResult = results.find((r) => r.scenario.id === rec.id)!;
  const passed = results.filter((r) => checks.find((c) => c.id === r.scenario.id)!.passes);
  const allRuns = results.flatMap((r) => r.runs);
  const visits = distinct(allRuns.map((r) => r.kpis.ovenVisits));
  const armDays = (r: WeekResult) => r.runs.reduce((s, x) => s + x.config.arms.length, 0);
  const list = (xs: number[], d = 0) => (xs.length === 1 ? f(xs[0]!, d) : `${f(xs[0]!, d)} to ${f(xs[xs.length - 1]!, d)}`);
  const erp9 = validation().weekNov9;
  const sheet = String(invRow(40).value).match(/(\d+)\s+of\s+(\d+)/);
  const row = (r: WeekResult) =>
    `| ${[
      `${r.scenario.name}${r.scenario.id === BASELINE_ID ? ' (baseline)' : ''}${r.scenario.id === rec.id ? ' (recommended)' : ''}`,
      triple(r.tanks),
      `${r.tankArmDays} of ${armDays(r)}`,
      r.otherArmDays,
      list(distinct(r.runs.map((x) => x.kpis.ovenVisits))),
      `${f(r.meanOvenUtilisation * 100)} %`,
      `${f(r.meanWaitOvenMin, 1)} min`,
      `${f(r.maxRunOutMin, 1)} min`,
      SKUS.map((k) => `${f(r.closingStock[k])} (${BAND_WORD[r.band[k]]})`).join(' / '),
      triple(r.coverWeeks, 1),
      f(r.coverSpread, 1),
      mouldChanges(r.scenario),
    ].join(' | ')} |`;
  return [
    '## Redesign comparison',
    '',
    'The Redesign page shows a short table. This is the full comparison behind it.',
    '',
    `Same machine, same oven, same shift: only the moulds on the arms and the product mix change. NTG told the team it "${String(invRow(66).value)}" (inventory row 66), so no scenario touches the oven, the times or the shift.`,
    `Each scenario is ${base.runs.length} running days of one ${f(P.shiftHours.value, 1)} h shift, each day a full simulator run (\`evaluateWeek\` in \`src/sim/scenarios.ts\`).`,
    '',
    '| Scenario | Tanks made (CTT4 / CTT2 / HTT2) | Tank arm-days | Other arm-days | Oven visits a day | Oven in use | Loaded wait before the oven | Longest run-out | Stock at the end of the week | Weeks of cover | Cover spread | Arm changes of mould |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...results.map(row),
    '',
    ...results.map((r) => `- **${r.scenario.name}.** ${r.scenario.change} ${r.scenario.notes.join(' ')}`),
    '',
    '**Stock check.** Closing stock = opening stock + tanks made - average weekly sales. Weeks of cover = closing stock / average weekly sales. Cover spread = most covered product minus least covered product.',
    '',
    '| Input | CTT4 | CTT2 | HTT2 | Tag | Inventory row |',
    '| --- | --- | --- | --- | --- | --- |',
    `| Opening stock, count of 6 Nov | ${SKUS.map((k) => OPENING_STOCK.value[k]).join(' | ')} | ${OPENING_STOCK.tag} | ${OPENING_STOCK.row} |`,
    `| Average weekly sales, 45 full weeks | ${SKUS.map((k) => f(P.weeklySalesMean.value[k], 1)).join(' | ')} | ${P.weeklySalesMean.tag} | ${P.weeklySalesMean.row} |`,
    `| Minimum stock | ${SKUS.map((k) => P.minStock.value[k]).join(' | ')} | ${P.minStock.tag} | ${P.minStock.row} |`,
    `| Warehouse cap | ${SKUS.map((k) => P.warehouseCap.value[k]).join(' | ')} | ${P.warehouseCap.tag} | ${P.warehouseCap.row} |`,
    '',
    `**Recommendation: ${recResult.scenario.name}.** ${rec.reason}`,
    '',
    `**The rule** (\`recommend()\`). Among the scenarios that leave every product between NTG's minimum stock and the warehouse cap, and that use ${EXTRA_ARM_DAYS_ALLOWED === 0 ? 'no more tank arm-days than' : `at most ${EXTRA_ARM_DAYS_ALLOWED} tank arm-day more than`} the baseline (${base.tankArmDays}), take the one with the smallest cover spread. A tie goes to fewer arm-days. ${passed.length} of ${results.length} scenarios pass both conditions: ${passed.map((r) => r.scenario.name).join('; ')}.`,
    '',
    `**What the oven does to every scenario.** ${
      visits.length === 1
        ? `On all ${allRuns.length} simulated days the oven is visited ${f(visits[0]!)} times: every arm gets its turn whatever it carries. An arm-day is therefore worth ${SKUS.map((k) => `${f((P.mouldsPerArm.value[k] * visits[0]!) / P.arms.value)} ${k}`).join(', ')}, and a scenario can only move tanks between products and days. The mix decides the output, not the queue.`
        : `Oven visits per day run from ${list(visits)} across the scenarios.`
    } The loaded wait before the oven differs a little between scenarios (${list(distinct(results.map((r) => Number(r.meanWaitOvenMin.toFixed(1)))), 1)} min) because an arm on other products takes one unbroken visit and a tank arm returns to loading twice (A19).`,
    '',
    '**What the twin cannot tell.**',
    '',
    `1. Order due dates. NTG gave sales invoices only (row 109: "${String(invRow(109).value)}"). A scenario that makes a product later in the week may miss an order the baseline would meet.`,
    `2. The real placement of moulds. NTG's sheet gives ${sheet ? `${sheet[1]} of ${sheet[2]}` : 'the'} arm-days (row 40) but not the mould on each arm each day; the baseline's placement is assumed (A26).`,
    `3. The week as it ran. The ERP records ${triple(erp9.erp)} tanks made in 9 to 13 Nov against the plan's ${triple(erp9.plan)}. The baseline is the plan.`,
    `4. A real week's sales. The check uses an average week; weekly sales vary by about ${triple(P.weeklySalesSd.value, 1)} tanks (standard deviation, row ${P.weeklySalesSd.row}), and returns are not counted (A27).`,
    `5. Mould change time. Moving moulds between days is not charged; NTG gives ${P.mouldChangeMin.value} min for a CTT4 mould (row ${P.mouldChangeMin.row}, A33).`,
    `6. What the other products need. The scenarios leave them ${results.map((r) => r.otherArmDays).join(', ')} arm-days (in table order), and NTG says that share varies (row 52).`,
    '',
    'On screen the two 3D views of the Redesign page run on one clock. Their contact-shading, glow and edge-smoothing effects are switched off because two views are drawn at once.',
    '',
  ];
}

export function modelMarkdown(): string {
  const v = validation();
  const cfg = defaultConfig();
  const T = cfg.times;
  const b = v.base;
  const st = v.identity.steady;
  const ring = ringFor(cfg).map((s) => STATION_LABEL[s].toLowerCase());
  const rej = (id: string) => v.rejected.find((r) => r.id === id)!.run;
  const iLo = v.index.sweep[0]!;
  const iHi = v.index.sweep[v.index.sweep.length - 1]!;
  const share = (n: number, d: number) => `${f((n / d) * 100)} %`;
  const erp = SKUS.map((k) => {
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
    `| Loading | Close the mould, first layer of powder in. Later in the visit: layers 2 and 3 are dosed here | ${f(T.load)} | ${P.loadMin.tag} | ${P.loadMin.row} |`,
    `| Oven | One visit, door to door: ${v.visit.layers} heats of ${f(v.visit.heatEach, 1)} min, and between them ${v.visit.layers - 1} returns to loading (${v.visit.tripCount} swings of ${f(T.index, 1)} min, ${v.visit.layers - 1} dosing pauses of ${f(T.layerPause, 1)} min) | ${f(T.ovenVisit, 1)} | ${P.ovenVisitMin.tag} | ${P.ovenVisitMin.row}, ${P.layerPauseMin.row} |`,
    `| Air cooling | Mould turns in the open | ${f(T.air)} | ${P.airCoolMin.tag} | ${P.airCoolMin.row} |`,
    `| Cooling chamber | Fan and water | ${f(T.water)} | ${P.waterCoolMin.tag} | ${P.waterCoolMin.row} |`,
    `| Demould | Wait for the crew ${f(T.demouldWait)} min (an input), then hoist the tanks out and prepare the mould | ${f(T.demouldWait)} + ${f(T.demould)} | ${P.demouldWaitMin.tag}, ${P.demouldMin.tag} | ${P.demouldWaitMin.row}, ${P.demouldMin.row} |`,
    '',
    `Finishing (${f(T.finishing)} min a tank, row ${P.finishingMin.row}) happens off the arm and never holds it.`,
    '',
    '## The oven rule',
    '',
    `The oven takes one arm at a time, by turn (NTG, row 42). One visit of ${f(T.ovenVisit, 1)} min covers all ${cfg.layers} layers. For layers 2 and 3 the arm leaves`,
    'the oven, swings back to the loading position, is dosed and swings back in; the team confirmed on 21 Nov 2026 that these swings are',
    `inside the ${f(T.ovenVisit, 1)} min it measured (A2, A14). While an arm is in its oven visit the loading position is kept for it, so the arm`,
    'behind waits empty at demould and is loaded when the visit ends (A37). An arm on other products takes one unbroken visit (A19).',
    `Near the end of the shift the oven takes no arm it cannot finish by the ${f(P.shiftHours.value, 1)} h mark; arms already cooked are cooled and`,
    'demoulded after it (A16). Nothing else in the model says where arms should queue.',
    '',
    `Because every arm must take its turn, the arm cycle is an **output**: ${P.arms.value} arms x (${f(T.ovenVisit, 1)} + ${f(T.index, 1)}) min = ${f(b.cycleMin, 1)} min.`,
    '',
    '## Inputs and outputs',
    '',
    '**Inputs.** The moulds on each arm; the shift length; the task times in the table; the index time; powder per layer per',
    'product; five switches (how the next layer goes in, swings inside or on top of the visit, pauses inside or on top, cooling',
    `layout, end-of-shift rule); an optional +/-${f(v.variation.jitter * 100)} % variation with a seed. Inputs come from \`P\` (inventory, with its N/V/C/S tag)`,
    'or from `assumed` (tag S). The wait for the crew and the demould time are inputs, so the twin cannot explain them.',
    '',
    '**Outputs.** Arm cycle; oven visits; tanks per product, by the mark and in total; share of the shift the oven is in use;',
    'mean wait of a loaded arm before the oven; mean wait of an empty arm for the loading position; minutes full arms are held',
    'because the next position is occupied; run-out after the mark; the position arms wait for most (the bottleneck); powder',
    'dosed per layer, pigment and foam agent; silo and hopper levels.',
    '',
    '## Calibration',
    '',
    `With the default settings one shift gives a ${f(b.cycleMin, 1)} min cycle (NTG ${P.armCycleMin.value}, row ${P.armCycleMin.row}), ${b.ovenVisits} oven visits,`,
    `${triple(b.tanksTotal)} tanks (NTG ${triple(P.tanksPerShift.value)}, row ${P.tanksPerShift.row}) and ${f(b.cyclesPerArm)} cycles per mould (NTG ${P.cyclesPerMouldPerDay.value}, row ${P.cyclesPerMouldPerDay.row}).`,
    'These choices sit behind that result. Each alternative is still in the code as a switch:',
    '',
    '| Choice | Used | Alternative | Alternative gives |',
    '| --- | --- | --- | --- |',
    `| Index time (A9) | ${f(T.index, 1)} min | ${f(iLo.value)} or ${f(iHi.value)} min | cycle ${f(iLo.run.cycleMin)} or ${f(iHi.run.cycleMin)} min, ${iLo.run.total} tanks |`,
    `| Layers 2 and 3 (A2) | arm returns to loading (seen by the team) | arm stays and pauses in the oven | cycle ${f(v.alternative.run.cycleMin, 1)} min, ${v.alternative.run.total} tanks: same output, loaded wait ${f(v.alternative.run.waitOvenMin, 1)} min |`,
    `| Swings to loading (A14) | inside the ${f(T.ovenVisit, 1)} min (confirmed) | on top | cycle ${f(rej('tripsOnTop').cycleMin, 1)} min, ${rej('tripsOnTop').total} tanks |`,
    `| Dosing pauses (A15) | inside the ${f(T.ovenVisit, 1)} min | on top | cycle ${f(rej('pausesOnTop').cycleMin, 1)} min, ${rej('pausesOnTop').total} tanks |`,
    `| Cooling layout (A13) | air cooling at an open position | both phases in the chamber | cycle ${f(rej('bothInChamber').cycleMin, 1)} min, ${rej('bothInChamber').total} tanks |`,
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
    '## Gaps and limits',
    '',
    `1. **Tanks by the ${f(P.shiftHours.value, 1)} h mark.** The twin has ${triple(b.tanksInShift)} (${b.inShift}) out by the mark, not ${sumSku(P.tanksPerShift.value)}. The last ${b.lateArms} arms finish after it; the last tank is out ${f(b.runOutMin, 1)} min late. Not tuned away.`,
    `2. **Wait before the oven.** Twin ${f(b.waitOvenMin, 1)} min for a loaded arm, NTG's estimate ${P.waitBeforeOvenMin.value} min (row ${P.waitBeforeOvenMin.row}): ${signed(b.waitOvenMin - P.waitBeforeOvenMin.value, 1)} min. Close, and a result of the confirmed layer handling, but both numbers are untimed, so it is agreement, not proof.`,
    `3. **Minutes nobody estimated.** NTG's and the team's task times plus ${v.identity.indexMoves} moves add up to ${f(v.identity.sumMin, 1)} min; the cycle is ${v.identity.cycleMin}. In a mid-shift cycle of the twin the other minutes are an empty arm waiting for the loading position (${f(st.waitLoad, 1)} min) and full arms held after cooling (${f(st.held, 1)} min). Over the whole shift the empty wait is ${f(b.waitLoadMin, 1)} min per oven visit. NTG gave no figure for either.`,
    `4. **No timed data.** No distribution is fitted. Times are fixed; the optional +/-${f(v.variation.jitter * 100)} % variation is a stress test, not a measurement.`,
    `5. **Other products** take one unbroken oven visit of the same length as a tank arm's, and their powder is not tracked (A19).`,
    `6. **Picture only.** Mould tumble and fan speeds are scaled to stay readable at the playback speed (A25), and the oven temperature curve is illustrative (A10, dip ${f(assumed.ovenDoorDipC.value)} °C). Neither enters a count.`,
    '',
    `The full list of ${assumptions().length} decisions, each with its alternative, is in docs/ASSUMPTIONS.md. The full validation, the rejected readings and the known conflicts in the data are in docs/VALIDATION.md.`,
    '',
    ...redesignSection(),
    '## Tests',
    '',
    '`src/sim/engine.test.ts` checks, for each tested configuration, that no two arms share a position, that timelines are continuous,',
    'that tanks are whole and powder balances, and that the state at a minute does not depend on how the clock got there.',
    '`src/pages/report/validation.test.ts` checks that every figure on the Report page is taken from a run and that this file,',
    'docs/VALIDATION.md and the assumptions register match the code.',
    '',
  ].join('\n');
}
