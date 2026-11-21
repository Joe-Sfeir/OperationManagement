# Plan page: notes

Files: `model.ts` (LP, HiGHS, re-check, no React), `model.test.ts`, `PlanPage.tsx`, `sections.tsx`, `StockChart.tsx`, `parts.tsx`, `provenance.ts`, `usePlan.ts`, `highsBrowser.ts`, `wasm.d.ts`, `preview.tsx`, `/preview-plan.html`.

## The model as built

Sets: tank k in {CTT4, CTT2, HTT2}; weeks t = 1..T (4 to 8, default 6).

| Part | Formula | Data |
| --- | --- | --- |
| Decision | n[k,t] >= 0 arm-cycles, t = 1..T-1; tanks x[k,t] = u_k n[k,t] | u = moulds per arm, row 31 (1 / 2 / 2) |
| Arrivals | arrivals[k,1] = pipeline_k; arrivals[k,t] = x[k,t-1] for t >= 2 | lag row 85, pipeline row 86 (8 / 4 / 36) |
| Balance | I[k,t] = I[k,t-1] + arrivals[k,t] + returns_k - d[k,t] | I[k,0] row 79 (36 / 113 / 106) |
| Floor | I[k,t] + s[k,t] >= S_k, s >= 0 (soft, default); I[k,t] >= S_k (strict) | S row 82 (15 / 50 / 70), row 83 "flexible target" |
| Cap | I[k,t] <= W_k (switch, default on) | W row 95 (40 / 120 / 140) |
| Stockout | I[k,t] >= 0 | |
| Machine | sum_k n[k,t] <= A_t = arm-days x 4 | row 53 (8 arm-days), row 57 (4 cycles a day) |
| Objective 1 | min 2 h x sum n + p x sum s + 0.001 x sum I | 2 h = row 47 / 60 |
| Objective 2 | min 28.24 USD x sum n + sum h_k I + p_usd x sum s | rows 61, 64, 94 |

The LP is written as CPLEX LP text (`buildLp`) and solved by HiGHS: once continuous (shadow prices), once with whole arm-cycles (the plan to use).

Default answer (6 weeks, 6 Nov stock, average week, 8 arm-days, soft floor, cap on, machine time):

| Made in | CTT4 | CTT2 | HTT2 | Arm-cycles | Arm-hours of 64 |
| --- | --- | --- | --- | --- | --- |
| Week 1, 9 to 13 Nov (already planned) | 8 | 4 | 36 | 28 | 56 |
| Week 2, 16 to 20 Nov | 0 | 0 | 0 | 0 | 0 |
| Week 3, 23 to 27 Nov | 0 | 4 | 4 | 4 | 8 |
| Week 4, 30 Nov to 4 Dec | 0 | 24 | 26 | 25 | 50 |
| Week 5, 7 to 11 Dec | 0 | 24 | 24 | 24 | 48 |
| Week 6, 14 to 18 Dec | 5 | 22 | 26 | 29 | 58 |
| Total, weeks 2 to 6 | 5 | 74 | 80 | 82 | 164 |

No tank-week below the minimum. Continuous LP: 81.3 arm-cycles, 162.6 arm-hours. Machine capacity does not bind in any week (all capacity shadow prices 0). Floor shadow prices in week 6: CTT4 2.0 h, CTT2 1.0 h, HTT2 1.0 h per tank of minimum. Diesel, electricity and holding for the plan: 3,856 USD.

## Where the build differs from the brief, and why

1. **Week labels.** The brief says n[k,t] is "run in week t" and reaches stock a week later. The maths is kept index for index. On the page plan t is shown as **week t + 1**, the week the tanks are made and reach stock, and week 1 shows the pipeline. Reason: row 77 says tanks go to stock as soon as they are finished, and row 86 says the 9 to 13 Nov plan is what arrives in week 1. That plan is what Machine 3700 runs in week 1 (28 arm-cycles, 7 of the 8 arm-days), so a second plan "run in week 1" would book the same machine time twice. Alternative considered: label rows as the brief words it. Rejected because the owner would read week 1 as still open. Numbers are the same either way because A_t is one figure for all weeks.
2. **n[k,T] is left out.** It would arrive in week T + 1 and the objective would always set it to zero. Alternative: keep it and show a row of zeros.
3. **Whole-arm-cycle model has extra rows** (see assumption P6). They do not change the answer; they make it solve in milliseconds.
4. **What-if table** shows the whole-arm-cycle plan in each cell (the plan NTG could run) with the continuous LP figure in the badge tooltip. The brief put the table under "on the continuous LP". Demand percentages in the table are of the chosen scenario and replace the slider value.
5. **Manual check** uses a hand-solved case, because `tools/lp_prototype_check.py` was never supplied.

## Assumptions added on this page

Each is tagged S or C on the page.

| ID | Assumption | Alternative considered | Why this one |
| --- | --- | --- | --- |
| P1 | Shortage penalty p = 10 arm-hours per tank-week below the minimum. Editable, S. In USD: 10 x 28.24 / 2 = 141.20 per tank-week (C). | p just above 2 h; or a very large p (1,000). | The slowest tank is CTT4, one mould per arm, 2 h per tank. p must be above 2 h so a whole tank short always costs more than making it. 10 is five times that. It is not larger because the minimum is a flexible target (row 83): with whole arm-cycles the plan will not run a 2 h arm-cycle to close a gap under 0.2 tank-weeks, and fractions of a tank only exist because average demand is not a whole number. In USD it is above an arm-cycle plus eight weeks of holding (tested). |
| P2 | Tie-break: 0.001 arm-hours per tank-week of stock, machine-time objective only. Fixed. | No tie-break; or a second solve that minimises stock with hours fixed. | Without it many plans have the same hours and the solver returns an arbitrary one. With it the plan makes tanks as late as the minimum allows, which also holds least stock. The marginal effect is at most 0.008 h per tank over 8 weeks, far below 1 h per tank. Shadow prices under 0.05 are shown as 0 for the same reason. |
| P3 | Starting from the latest ERP stock, tanks already planned for week 1 are 0 until typed in. S. | Reuse 8 / 4 / 36. | That plan belongs to 9 to 13 Nov. No plan is on file for 23 to 27 Nov. |
| P4 | Demand is the same in every week of the horizon. | A monthly profile from the ERP history (row 104 shows a season). | The brief asks for three flat scenarios and a percentage. The model takes d[k,t] per week, so a profile can be added without touching the LP. |
| P5 | Returns arrive every week at the 45-week mean (0.24 / 0.44 / 0.53), C, as the brief specifies. | Leave returns out. | Row 81: the stock balance needs a returns term. |
| P6 | Whole-arm-cycle model adds running totals N[k,t] = n[k,1] + ... + n[k,t] (whole numbers) and rounding rows on them. | Plain model with only n integer. | The plain model took up to 18 s (8 weeks) because a fraction can move from week to week. With the extra rows the worst of 432 scenarios took 15 ms. Stock next week is b + u N[k,t] (b = stock with nothing made), so each stock rule is a bound on N that can be rounded: N >= ceil((0 - b)/u), N >= ceil((S - b)/u) when strict, N <= floor((W - b)/u), and for the soft floor s[k,t+1] + g N[k,t] >= g c with c = ceil((S - b)/u), g = S - b - u(c - 1). None removes a whole plan. Tested: same status and objective as the plain model on 120 scenarios at T = 4 (576 more checked by hand during the build at T = 4 and 5). |
| P7 | Cap that cannot hold: where stock is above the cap even with nothing made, the cap for that tank and week is set to that stock. The page says which tank and weeks. | Drop the cap for the whole tank or horizon. | It is the smallest relaxation and it stops the plan adding to an overfull warehouse. |
| P8 | Stockout is a hard rule. When the model has no solution a second LP with slack on stockout, strict floor and cap (weights 10,000 / 100 / 1, not plant data) finds which rule breaks first and the page says it in words with buttons to loosen it. | Make stockout soft too. | The brief states I >= 0. |
| P9 | Arm-days are the same in every planned week; slider 0 to 20 in whole arm-days (20 = 4 arms x 5 days, C). | A figure per week. | One slider, as the brief asks. `armCycles` in the model is already per week (the manual case uses 3 and 8). |
| P10 | Demand uses the inventory values 5.9 / 23.9 / 25.7 (row 102), not the unrounded history means. | 5.911 / 23.911 / 25.667. | The brief names P.weeklySalesMean. Difference in the plan: none in whole arm-cycles. |
| P11 | Holding cost is charged on end-of-week stock in weeks 1 to T. | Average of start and end. | Simple, and the same convention as the stock rules. |
| P12 | A shortage under 0.05 tank-weeks is not drawn red. Stock is shown to one decimal. | Whole tanks. | Rounded stock of 50 marked "below 50" would confuse. |

## Manual check, step by step

Made-up numbers (S), chosen so every step is one line of arithmetic and the answer is unique.

One tank type, 2 tanks per arm-cycle, 2 arm-hours per arm-cycle. Opening stock 20. 4 tanks already planned, in stock in week 1. Demand 10 a week, no returns. Minimum 13, no cap. Three weeks. The machine has 3 arm-cycles for the tanks made in week 2 (n1) and 8 for week 3 (n2). Penalty 10 arm-hours per tank-week short. No tie-break.

1. Week 1 is fixed: I1 = 20 + 4 - 10 = 14 >= 13, so s1 = 0.
2. Week 2: I2 = 14 + 2 n1 - 10 = 4 + 2 n1. Reaching 13 needs n1 = 4.5 but n1 <= 3. One arm-cycle costs 2 h and removes 2 tank-weeks of shortage (20), so n1 = 3. I2 = 10, s2 = 3.
3. Week 3: I3 = 10 + 2 n2 - 10 = 2 n2. Reaching 13 needs n2 = 6.5 <= 8. The last half arm-cycle costs 1 h and saves 10. So n2 = 6.5, I3 = 13, s3 = 0.
4. Objective: 2 x (3 + 6.5) + 10 x 3 = 19 + 30 = 49.
5. Shadow prices. One more arm-cycle for week 2: n1 = 4, I2 = 12, s2 = 1 (20 saved); week 3 then needs 2 + 2 n2 = 13, n2 = 5.5, so arm-hours stay 2 x 9.5 = 19. Objective 19 + 10 x 1 = 29, a change of -20. Week 3 has spare arm-cycles: 0. Floor rows: week 1 has slack, 0; week 2 is short, 10 (the penalty); week 3 binds, one more tank of minimum needs half an arm-cycle, 1.
6. Whole arm-cycles: n1 = 3 still. n2 = 6 gives I3 = 12, s3 = 1: 2 x 9 + 10 x 4 = 58. n2 = 7 gives I3 = 14: 2 x 10 + 10 x 3 = 50. So n2 = 7, objective 50.

`model.test.ts` asserts HiGHS returns exactly this (n, stock, shortage, hours, objective, capacity and floor shadow prices, and the whole plan), and that trying every whole plan by brute force gives the same 50. The page shows the hand answer beside the solver's in 13 figures.

## Tests

`npx vitest run src/pages/plan`: 26 tests. They cover the data the plan starts from, the LP text, the manual case (LP, whole plan, brute force), the default scenario (solves, stock balances, capacity, floor, cap, stockout, re-check), a tampered plan failing the re-check, 180 scenarios all passing the re-check with whole plan never better than the LP, the rounding rows not changing the answer, a busy period, a strict floor reported in words, stock running out, the cap relaxation, the cost objective, capacity and floor shadow prices against re-solves, and the what-if grid.

## HiGHS in the browser

`highsBrowser.ts` imports `highs/runtime?url&inline`, so Vite puts the binary in the JavaScript as a base64 data: URL (its own 4.7 MB chunk, loaded when the page first solves) and the loader gets it through `locateFile`. Two things found on the way: `?inline` alone is refused for .wasm by this Vite, and the loader's typed `wasmBinary` option is ignored by this build of highs (it still fetched the file). Checked on a production build of the preview with every `.wasm` request blocked: the page solves and no request is made. Vite still emits an unused `highs-*.wasm` (3.5 MB) because highs.mjs mentions it; it can be deleted from a ZIP.

Solving is off the render path: a 160 ms wait after the last change, then LP and whole plan (about 10 ms together), then the what-if grid cell by cell, with control handed back to the browser between solves. A newer change abandons the run in flight. No Web Worker, because a module worker cannot start from a file:// page.

## Not verified

- **Opening the built site from a ZIP (file://).** I verified only that no .wasm is fetched. Chrome also blocks `type="module"` scripts on file://, which is a property of the whole app build, not of this page.
- **`tools/lp_prototype_check.py`** was not supplied, so there is no comparison with the prototype.
- **Capacity.** A_t counts arm-cycles only. It does not model the shared oven, mould changes (row 33) or the days Machine 3700 does not run (row 56). The 8 arm-days come from one week's plan.
- **Stock conflict, row 80** (availability list 25 / 106 / 82 against 36 / 113 / 106) is not used. The opening stock can be typed in to test it.
- **Screen readers.** Labels, table headers, live regions and keyboard reading of the charts are in place; the arrow-key path was run in Playwright, but no screen reader was used.
- **Concept image.** Bible rule 8 asks for a check against an approved concept. None exists for this page.
- The page is not wired into `App.tsx`; that file is not mine.
