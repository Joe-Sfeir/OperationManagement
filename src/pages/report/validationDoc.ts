/**
 * docs/VALIDATION.md, generated from validation.ts. It holds everything the
 * Report page no longer shows: the full table with its explanations, the ERP
 * checks, the rejected readings, field timing and the known data conflicts.
 * Run `UPDATE_DOCS=1 npx vitest run src/pages/report`.
 */
import { P, SKUS } from '../../data/params';
import { defaultConfig } from '../../sim/config';
import { mouldsLabel } from '../../ui/stage';
import { FIELD_TIMING, VERDICT_LABEL, f, invRow, sumSku, triple, validation, type RunSummary } from './validation';

const cell = (s: string | number) => String(s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
const tr = (...cells: (string | number)[]) => `| ${cells.map(cell).join(' | ')} |`;

export function validationMarkdown(): string {
  const v = validation();
  const T = defaultConfig().times;
  const b = v.base;
  const st = v.identity.steady;
  const share = (n: number, d: number) => `${f((n / d) * 100)} %`;
  const runRow = (label: string, r: RunSummary, why: string) =>
    tr(label, `${f(r.cycleMin, 1)} min`, f(r.cyclesPerArm, 2), `${triple(r.tanksTotal)} (${r.total})`, `${f(r.waitOvenMin, 1)} min`, why);
  const w = v.weekNov2;
  const count = (x: string) => v.rows.filter((r) => r.verdict === x).length;

  return [
    '# Validation of the Machine 3700 twin',
    '',
    'Generated from `src/pages/report/validation.ts`. Every figure is computed from a simulator run, the inventory or the ERP',
    'history when the tests run; none is typed. The Report page shows the short version of the first table and two charts.',
    '',
    '**Status: calibrated against NTG\'s figures, not yet timed on the floor.** ' + FIELD_TIMING.text,
    '',
    '## Twin against NTG, one typical shift',
    '',
    'One CTT4 mould, two CTT2, two HTT2 and one arm on other products (inventory rows 49 and 50).',
    `Of ${v.rows.length} comparisons, ${count('match')} match, ${count('gap')} ${count('gap') === 1 ? 'is a gap' : 'are gaps'}, ${count('input')} only plays an input back and ${count('no-data')} have no NTG figure to be checked against.`,
    'The matches on cycle and output are what the twin was calibrated to: they show it is consistent with NTG\'s figures, not that it is proven.',
    '',
    '| Metric | Twin | NTG figure | Tag | Inventory rows | Difference | Verdict | What it shows |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...v.rows.map((r) => tr(r.metric, r.twin, r.ntg, r.ntgTag ?? 'none', r.ntgRows.join(', ') || 'none', r.difference, VERDICT_LABEL[r.verdict], r.words)),
    '',
    `## Where the ${P.armCycleMin.value} minutes go`,
    '',
    `NTG says the ${P.armCycleMin.value} min cycle covers one arm through every stage, waits included (row 48). The times NTG and the team gave, added up:`,
    '',
    '| Step of one arm cycle | Minutes | Tag | Inventory row |',
    '| --- | --- | --- | --- |',
    ...v.identity.parts.map((p) => tr(p.label, f(p.min, 1), p.tag, p.row)),
    tr(`${v.identity.indexMoves} moves between positions x ${f(v.identity.indexMin, 1)} min`, f(v.identity.indexMoves * v.identity.indexMin, 1), 'S', 'A9'),
    tr('**Sum of the estimates**', f(v.identity.sumMin, 1), 'C', ''),
    tr('NTG arm cycle', f(v.identity.cycleMin, 1), P.armCycleMin.tag, P.armCycleMin.row),
    tr('**Minutes no estimate covers**', f(v.identity.unexplainedMin, 1), 'C', ''),
    '',
    `The inventory flags the same hole (row ${P.demouldMin.row}: "${invRow(P.demouldMin.row).notes}").`,
    `In the twin the cycle is set by the oven, so those minutes cannot vanish. One mid-shift arm cycle of the twin (mean of ${st.cycles} cycles that are neither the first nor the last of the day):`,
    '',
    '| What the arm is doing | Minutes |',
    '| --- | --- |',
    tr('Working: loading, oven visit with its swings, cooling, demould', f(st.work, 1)),
    tr('Moving between positions', f(st.moves, 1)),
    tr('Waiting for the crew at demould (an input)', f(st.crewWait, 1)),
    tr('Loaded, waiting for the oven', f(st.waitOven, 1)),
    tr('Empty, waiting for the loading position', f(st.waitLoad, 1)),
    tr('Full, held because the next position is occupied', f(st.held, 1)),
    tr('**One cycle**', f(st.total, 1)),
    '',
    `So the minutes no estimate covers are, in the twin, an empty arm waiting at demould for the loading position (${f(st.waitLoad, 1)} min) and full arms held after cooling (${f(st.held, 1)} min). The working time averages three tank arms and one arm on other products, whose oven visit has no swings.`,
    `Over the whole shift, start and end of the day included, the empty wait is ${f(b.waitLoadMin, 1)} min per oven visit and the loaded wait ${f(b.waitOvenMin, 1)} min. Nobody has timed either; a stopwatch on one shift would.`,
    '',
    '## The demould placeholder, across its range',
    '',
    `The demould time is the least certain input: a placeholder of ${f(T.demould)} min with a range of ${f(v.demould.range[0])} to ${f(v.demould.range[1])} (row ${P.demouldMin.row}). Each line is a full run with only that time changed.`,
    `Up to ${f(v.demould.holdsCycleUpTo)} min the cycle and the ${b.total} tanks hold, and the loaded wait before the oven stays between ${f(v.demould.waitAtLimit, 1)} and ${f(v.demould.sweep[0]!.run.waitOvenMin, 1)} min.${v.demould.firstBroken ? ` From ${f(v.demould.firstBroken.value)} min arms are held in the cooling positions and the cycle stretches (${f(v.demould.firstBroken.run.cycleMin, 1)} min).` : ''}`,
    '',
    '| Demould time | Arm cycle | Loaded wait before the oven | Empty wait for loading | Full arm held, per visit | Tanks from the shift | Run-out after the mark |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...v.demould.sweep.map((s) =>
      tr(`${f(s.value)} min${s.value === T.demould ? ' (used)' : ''}`, `${f(s.run.cycleMin, 1)} min`, `${f(s.run.waitOvenMin, 1)} min`, `${f(s.run.waitLoadMin, 1)} min`, `${f(s.run.blockedMin, 1)} min`, `${triple(s.run.tanksTotal)} (${s.run.total})`, `${f(s.run.runOutMin, 1)} min`),
    ),
    '',
    `Index time, the other untimed input: ${v.index.sweep.map((s) => `${f(s.value, 1)} min gives a ${f(s.run.cycleMin, 1)} min cycle and ${s.run.total} tanks`).join('; ')}.`,
    `With +/-${f(v.variation.jitter * 100)} % variation on task times over ${v.variation.seeds} seeds: ${v.variation.total[0] === v.variation.total[1] ? v.variation.total[0] : `${v.variation.total[0]} to ${v.variation.total[1]}`} tanks, cycle ${f(v.variation.cycleMin[0], 1)} to ${f(v.variation.cycleMin[1], 1)} min, run-out ${f(v.variation.runOutMin[0])} to ${f(v.variation.runOutMin[1])} min.`,
    '',
    '## ERP checks',
    '',
    'The ERP stock cards were not used to calibrate the twin, so they are an independent check. The ERP does not record which moulds were on the machine, so a match on quantity is evidence, not proof.',
    '',
    '### Daily output on production days',
    '',
    `The twin makes ${triple(b.tanksTotal)} in a typical shift with all four arms working, and ${SKUS.map((k) => v.erp[k].threeArm.join(' or ')).join(' / ')} when one arm carries no mould (three arms cycle faster). Both come from simulator runs.`,
    '',
    '| Product | Production days | Equal to the twin, four arms | Equal to the twin, three arms | Another whole number of moulds x cycles | No match | Days at a quantity the twin can make |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...SKUS.map((k) => {
      const e = v.erp[k];
      return tr(k, e.days, `${e.daysFour} (${share(e.daysFour, e.days)}) at ${e.fourArm}`, `${e.daysThree} (${share(e.daysThree, e.days)}) at ${e.threeArm.join(' or ')}`, `${e.daysMultiple} (${share(e.daysMultiple, e.days)})`, `${e.daysNone} (${share(e.daysNone, e.days)}): ${e.unexplained.join(', ')} tanks`, share(e.daysFour + e.daysThree + e.daysMultiple, e.days));
    }),
    '',
    'Days at each daily quantity (the bars of the chart on the Report page):',
    '',
    ...SKUS.map((k) => `- ${k}: ${v.erp[k].hist.map((h) => `${h.qty} tanks on ${h.days} days`).join('; ')}.`),
    '',
    `### Week of 2 to 6 Nov: ERP production against mould-days x ${P.cyclesPerMouldPerDay.value} cycles`,
    '',
    `The ERP books production on ${w.days.map((d) => d.date).join(', ')}. The set-up is not recorded; the one assumed is ${w.setup.map((a) => mouldsLabel(a.moulds)).join(', ')}.`,
    '',
    `| Product | ERP by day | ERP week (row ${P.productionWeek2Nov.row}) | Production days | Moulds on (assumed) | Mould-days x ${P.cyclesPerMouldPerDay.value} | Twin, same days | Twin less ERP |`,
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...SKUS.map((k) => tr(k, w.days.map((d) => d.erp[k]).join(' / '), w.erp[k], w.productionDays[k], w.moulds[k], w.rule[k], w.twin[k], w.diff[k] > 0 ? `+${w.diff[k]}` : w.diff[k])),
    '',
    `Total: twin ${sumSku(w.twin)}, ERP ${sumSku(w.erp)}.`,
    '',
    '### Stock at the end of each week',
    '',
    'The second chart on the Report page. Closing stock of every week in the ERP history against NTG\'s minimum (row 82) and warehouse cap (row 95).',
    '',
    '| Product | Weeks | Minimum | Cap | Weeks ending below the minimum | Weeks ending above the cap | Lowest | Highest |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...SKUS.map((k) => {
      const s = v.stock[k];
      return tr(k, s.weeks.length, s.min, s.cap, s.below, s.above, Math.min(...s.weeks.map((x) => x.closing)), Math.max(...s.weeks.map((x) => x.closing)));
    }),
    '',
    `The inventory counts this differently (row 105: "${String(invRow(105).value)}", of 45 full weeks): it counts a week as below the minimum if stock dipped under it on any day, not only at the week's end.`,
    '',
    '## Readings that were rejected',
    '',
    'Each is still in the simulator as a switch and is run when this file is generated. All give fewer tanks than NTG reports.',
    '',
    '| Reading | Arm cycle | Oven visits per arm | Tanks from the shift | Loaded wait before the oven | Why it is not used |',
    '| --- | --- | --- | --- | --- | --- |',
    runRow('**The twin\'s default**: the arm returns to loading for layers 2 and 3, inside one oven visit', b, 'Reproduces NTG\'s cycle and shift output, and is what the team saw.'),
    ...v.rejected.map((r) => runRow(`${r.reading} (\`${r.setting}\`)`, r.run, r.why)),
    '',
    '### The other reading of the layer step',
    '',
    'Not rejected by its output. It gives the same cycle and the same tanks; it is contradicted by what the team saw.',
    '',
    '| Reading | Arm cycle | Oven visits per arm | Tanks from the shift | Loaded wait before the oven | Why it is not used |',
    '| --- | --- | --- | --- | --- | --- |',
    runRow(`${v.alternative.reading} (\`${v.alternative.setting}\`)`, v.alternative.run, v.alternative.why),
    '',
    '## Field timing: PENDING',
    '',
    FIELD_TIMING.text,
    '',
    `Inventory rows that name a timed shift as their replacement (${FIELD_TIMING.rows.length}): ${FIELD_TIMING.rows.map((n) => `${n} ${invRow(n).parameter.toLowerCase()}`).join('; ')}.`,
    '',
    '## Known data conflicts',
    '',
    'Places where two sources disagree, or where a figure does not add up. None is hidden or averaged away.',
    '',
    ...v.conflicts.flatMap((c, i) => [
      `### ${i + 1}. ${c.title}`,
      '',
      c.statement,
      '',
      `**What the twin does.** ${c.handling}`,
      '',
      ...c.quotes.map((q) => `> Inventory row ${q.row}, ${q.parameter}: "${q.text}"`),
      '',
    ]),
  ].join('\n');
}
