# Model: the Machine 3700 simulator

Generated from `src/pages/report/modelDoc.ts`; every number below is read from the inventory or from a simulator run.
Status: **calibrated, not validated**. No timed shift log was supplied. Every time in the twin is an NTG estimate, a visit note or a placeholder. When a timed shift exists it replaces those estimates, and the twin moves from calibrated to validated.

## What it is

A discrete-event simulator in plain TypeScript (`src/sim`). One run is one shift. The same configuration and seed always
give the same event log. `stateAt(t, result)` returns the whole plant at minute `t`; the 3D machine, the panels and the
timeline only read that state, so playing, pausing and scrubbing cannot change a result. A week is a list of shifts
(`evaluateWeek` in `src/sim/scenarios.ts`).

## The ring of positions

4 arms travel one way round 5 positions: loading, oven, air cooling, cooling chamber, demould, then back to loading. A position holds one arm.
An arm does the work of the position it is at, then moves on as soon as the next position is free. Arms cannot pass each
other. A move takes 1.5 min (assumption A9).

| Position | Work | Minutes | Tag | Inventory row |
| --- | --- | --- | --- | --- |
| Loading | Close the mould, first layer of powder in. Later in the visit: layers 2 and 3 are dosed here | 1 | V | 32 |
| Oven | One visit, door to door: 3 heats of 6.5 min, and between them 2 returns to loading (4 swings of 1.5 min, 2 dosing pauses of 1.5 min) | 28.5 | V | 43, 45 |
| Air cooling | Mould turns in the open | 18 | V | 68 |
| Cooling chamber | Fan and water | 25 | V | 69 |
| Demould | Wait for the crew 8 min (an input), then hoist the tanks out and prepare the mould | 8 + 12 | N, S | 72, 73 |

Finishing (5 min a tank, row 75) happens off the arm and never holds it.

## The oven rule

The oven takes one arm at a time, by turn (NTG, row 42). One visit of 28.5 min covers all 3 layers. For layers 2 and 3 the arm leaves
the oven, swings back to the loading position, is dosed and swings back in; the team confirmed on 21 Nov 2026 that these swings are
inside the 28.5 min it measured (A2, A14). While an arm is in its oven visit the loading position is kept for it, so the arm
behind waits empty at demould and is loaded when the visit ends (A37). An arm on other products takes one unbroken visit (A19).
Near the end of the shift the oven takes no arm it cannot finish by the 8.5 h mark; arms already cooked are cooled and
demoulded after it (A16). Nothing else in the model says where arms should queue.

Because every arm must take its turn, the arm cycle is an **output**: 4 arms x (28.5 + 1.5) min = 120.0 min.

## Inputs and outputs

**Inputs.** The moulds on each arm; the shift length; the task times in the table; the index time; powder per layer per
product; five switches (how the next layer goes in, swings inside or on top of the visit, pauses inside or on top, cooling
layout, end-of-shift rule); an optional +/-10 % variation with a seed. Inputs come from `P` (inventory, with its N/V/C/S tag)
or from `assumed` (tag S). The wait for the crew and the demould time are inputs, so the twin cannot explain them.

**Outputs.** Arm cycle; oven visits; tanks per product, by the mark and in total; share of the shift the oven is in use;
mean wait of a loaded arm before the oven; mean wait of an empty arm for the loading position; minutes full arms are held
because the next position is occupied; run-out after the mark; the position arms wait for most (the bottleneck); powder
dosed per layer, pigment and foam agent; silo and hopper levels.

## Calibration

With the default settings one shift gives a 120.0 min cycle (NTG 120, row 47), 16 oven visits,
4 / 8 / 8 tanks (NTG 4 / 8 / 8, row 49) and 4 cycles per mould (NTG 4, row 57).
These choices sit behind that result. Each alternative is still in the code as a switch:

| Choice | Used | Alternative | Alternative gives |
| --- | --- | --- | --- |
| Index time (A9) | 1.5 min | 1 or 2 min | cycle 118 or 122 min, 20 tanks |
| Layers 2 and 3 (A2) | arm returns to loading (seen by the team) | arm stays and pauses in the oven | cycle 120.0 min, 20 tanks: same output, loaded wait 20.2 min |
| Swings to loading (A14) | inside the 28.5 min (confirmed) | on top | cycle 138.0 min, 16 tanks |
| Dosing pauses (A15) | inside the 28.5 min | on top | cycle 129.0 min, 18 tanks |
| Cooling layout (A13) | air cooling at an open position | both phases in the chamber | cycle 176.2 min, 15 tanks |
| Oven time (A14) | per visit | per layer | cycle 375.0 min, 5 tanks |

Independent check, not used for calibration: daily output in the ERP (production days, Jan to Nov 2026).

| Product | ERP days | Twin, four arms | Days equal | Twin, three arms | Days equal | Other moulds x cycles | No match (quantities) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CTT4 | 61 | 4 | 67 % | 5 | 18 % | 2 % | 13 % (1, 2, 3) |
| CTT2 | 130 | 8 | 47 % | 10 | 30 % | 18 % | 5 % (1, 2, 6, 11) |
| HTT2 | 145 | 8 | 74 % | 10 | 6 % | 17 % | 3 % (3, 6) |

Week of 2 to 6 Nov: ERP 11 / 12 / 36; twin 12 / 12 / 36 for 3 production days with 1 / 1 / 3 moulds on (set-up assumed).

## Gaps and limits

1. **Tanks by the 8.5 h mark.** The twin has 4 / 6 / 6 (16) out by the mark, not 20. The last 2 arms finish after it; the last tank is out 38.5 min late. Not tuned away.
2. **Wait before the oven.** Twin 8.1 min for a loaded arm, NTG's estimate 8 min (row 46): +0.1 min. Close, and a result of the confirmed layer handling, but both numbers are untimed, so it is agreement, not proof.
3. **Minutes nobody estimated.** NTG's and the team's task times plus 5 moves add up to 108.0 min; the cycle is 120. In a mid-shift cycle of the twin the other minutes are an empty arm waiting for the loading position (7.3 min) and full arms held after cooling (5.1 min). Over the whole shift the empty wait is 14.3 min per oven visit. NTG gave no figure for either.
4. **No timed data.** No distribution is fitted. Times are fixed; the optional +/-10 % variation is a stress test, not a measurement.
5. **Other products** take one unbroken oven visit of the same length as a tank arm's, and their powder is not tracked (A19).
6. **Picture only.** Mould tumble and fan speeds are scaled to stay readable at the playback speed (A25), and the oven temperature curve is illustrative (A10, dip 60 °C). Neither enters a count.

The full list of 35 decisions, each with its alternative, is in docs/ASSUMPTIONS.md. The full validation, the rejected readings and the known conflicts in the data are in docs/VALIDATION.md.

## Redesign comparison

The Redesign page shows a short table. This is the full comparison behind it.

Same machine, same oven, same shift: only the moulds on the arms and the product mix change. NTG told the team it "Can change quantities and production order depending on installed moulds; can NEVER reduce pre-oven waiting" (inventory row 66), so no scenario touches the oven, the times or the shift.
Each scenario is 4 running days of one 8.5 h shift, each day a full simulator run (`evaluateWeek` in `src/sim/scenarios.ts`).

| Scenario | Tanks made (CTT4 / CTT2 / HTT2) | Tank arm-days | Other arm-days | Oven visits a day | Oven in use | Loaded wait before the oven | Longest run-out | Stock at the end of the week | Weeks of cover | Cover spread | Arm changes of mould |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NTG plan, 9 to 13 Nov (baseline) | 8 / 4 / 36 | 8 of 16 | 8 | 16 | 89 % | 11.3 min | 38.5 min | 38 (inside) / 93 (inside) / 116 (inside) | 6.5 / 3.9 / 4.5 | 2.6 | 3 |
| Level mix, same arm-days | 8 / 24 / 24 | 8 of 16 | 8 | 16 | 89 % | 12.0 min | 38.5 min | 38 (inside) / 113 (inside) / 104 (inside) | 6.5 / 4.7 / 4.1 | 2.4 | 3 |
| Demand-sized, one arm-day fewer (recommended) | 4 / 24 / 24 | 7 of 16 | 9 | 16 | 89 % | 12.9 min | 38.5 min | 34 (inside) / 113 (inside) / 104 (inside) | 5.8 / 4.7 / 4.1 | 1.7 | 3 |
| Tanks on all four arms, two days | 8 / 24 / 24 | 8 of 16 | 8 | 16 | 89 % | 12.7 min | 38.5 min | 38 (inside) / 113 (inside) / 104 (inside) | 6.5 / 4.7 / 4.1 | 2.4 | 4 |

- **NTG plan, 9 to 13 Nov.** Baseline: the week as NTG planned it, a long HTT2 campaign and little CTT2. Quantities are NTG's (8 / 4 / 36) and the arm-days per arm follow NTG's sheet (arm 2 four days, arms 3 and 4 two days each). Which mould sat on which arm on which day is assumed so that the quantities come out.
- **Level mix, same arm-days.** Same eight tank arm-days, shared out by average weekly sales instead of one long campaign. Arm-days per product follow mean weekly sales (inventory row 102): CTT4 2, CTT2 3, HTT2 3.
- **Demand-sized, one arm-day fewer.** Makes only what an average week sells; gives one arm-day back to other products. CTT4 runs one day (4 tanks) because an average week sells about 6 and stock is near its cap.
- **Tanks on all four arms, two days.** Packs the same tanks into two days with mixed moulds on one arm; two days stay free for other products. A CTT2 and an HTT2 mould share one arm. Inventory row 31 says arms can carry moulds of different products.

**Stock check.** Closing stock = opening stock + tanks made - average weekly sales. Weeks of cover = closing stock / average weekly sales. Cover spread = most covered product minus least covered product.

| Input | CTT4 | CTT2 | HTT2 | Tag | Inventory row |
| --- | --- | --- | --- | --- | --- |
| Opening stock, count of 6 Nov | 36 | 113 | 106 | N | 79 |
| Average weekly sales, 45 full weeks | 5.9 | 23.9 | 25.7 | C | 102 |
| Minimum stock | 15 | 50 | 70 | N | 82 |
| Warehouse cap | 40 | 120 | 140 | N | 95 |

**Recommendation: Demand-sized, one arm-day fewer.** Every product ends the week inside NTG's stock band, and cover is the most even (spread 1.7 weeks against 2.6 for NTG's plan), using 7 tank arm-days against 8.

**The rule** (`recommend()`). Among the scenarios that leave every product between NTG's minimum stock and the warehouse cap, and that use no more tank arm-days than the baseline (8), take the one with the smallest cover spread. A tie goes to fewer arm-days. 4 of 4 scenarios pass both conditions: NTG plan, 9 to 13 Nov; Level mix, same arm-days; Demand-sized, one arm-day fewer; Tanks on all four arms, two days.

**What the oven does to every scenario.** On all 16 simulated days the oven is visited 16 times: every arm gets its turn whatever it carries. An arm-day is therefore worth 4 CTT4, 8 CTT2, 8 HTT2, and a scenario can only move tanks between products and days. The mix decides the output, not the queue. The loaded wait before the oven differs a little between scenarios (11.3 to 12.9 min) because an arm on other products takes one unbroken visit and a tank arm returns to loading twice (A19).

**What the twin cannot tell.**

1. Order due dates. NTG gave sales invoices only (row 109: "Not provided (sales invoices only)"). A scenario that makes a product later in the week may miss an order the baseline would meet.
2. The real placement of moulds. NTG's sheet gives 8 of 16 arm-days (row 40) but not the mould on each arm each day; the baseline's placement is assumed (A26).
3. The week as it ran. The ERP records 4 / 4 / 36 tanks made in 9 to 13 Nov against the plan's 8 / 4 / 36. The baseline is the plan.
4. A real week's sales. The check uses an average week; weekly sales vary by about 3.9 / 11.2 / 14.0 tanks (standard deviation, row 103), and returns are not counted (A27).
5. Mould change time. Moving moulds between days is not charged; NTG gives 10 min for a CTT4 mould (row 33, A33).
6. What the other products need. The scenarios leave them 8, 8, 9, 8 arm-days (in table order), and NTG says that share varies (row 52).

On screen the two 3D views of the Redesign page run on one clock. Their contact-shading, glow and edge-smoothing effects are switched off because two views are drawn at once.

## Tests

`src/sim/engine.test.ts` checks, for each tested configuration, that no two arms share a position, that timelines are continuous,
that tanks are whole and powder balances, and that the state at a minute does not depend on how the clock got there.
`src/pages/report/validation.test.ts` checks that every figure on the Report page is taken from a run and that this file,
docs/VALIDATION.md and the assumptions register match the code.
