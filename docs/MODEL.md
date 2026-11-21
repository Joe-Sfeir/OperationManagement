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
| Loading | Close the mould, first layer of powder in | 1 | V | 32 |
| Oven | 3 heats of 8.5 min with 2 pauses of 1.5 min for the next layer | 28.5 | V | 43, 45 |
| Air cooling | Mould turns in the open | 18 | V | 68 |
| Cooling chamber | Fan and water | 25 | V | 69 |
| Demould | Wait for the crew 8 min (an input), then hoist the tanks out and prepare the mould | 8 + 12 | N, S | 72, 73 |

Finishing (5 min a tank, row 75) happens off the arm and never holds it.

## The oven rule

The oven takes one arm at a time, by turn (NTG, row 42). One visit of 28.5 min covers all 3 layers. Near the end
of the shift the oven takes no arm it cannot finish by the 8.5 h mark; arms already cooked are cooled and demoulded
after it. Nothing else in the model says where arms should queue.

Because every arm must take its turn, the arm cycle is an **output**: 4 arms x (28.5 + 1.5) min = 120.0 min.

## Inputs and outputs

**Inputs.** The moulds on each arm; the shift length; the task times in the table; the index time; powder per layer per
product; four switches (layers in one visit or with a return to loading, pauses inside or on top of the visit, cooling
layout, end-of-shift rule); an optional +/-10 % variation with a seed. Inputs come from `P` (inventory, with its N/V/C/S tag)
or from `assumed` (tag S). The wait for the crew and the demould time are inputs, so the twin cannot explain them.

**Outputs.** Arm cycle; oven visits; tanks per product, by the mark and in total; share of the shift the oven is in use;
mean wait before the oven; minutes arms are held because the next position is occupied; run-out after the mark; the
position arms wait for most (the bottleneck); powder dosed per layer, pigment and foam agent; silo and hopper levels.

## Calibration

With the default settings one shift gives a 120.0 min cycle (NTG 120, row 47), 16 oven visits,
4 / 8 / 8 tanks (NTG 4 / 8 / 8, row 49) and 4 cycles per mould (NTG 4, row 57).
Four choices were made so that this comes out. Each alternative is still in the code and is run live on the Report page:

| Choice | Used | Alternative | Alternative gives |
| --- | --- | --- | --- |
| Index time (A9) | 1.5 min | 1 or 2 min | cycle 118 or 122 min, 20 tanks |
| Layer pauses (A15) | inside the 28.5 min | on top | cycle 129.0 min, 18 tanks |
| Cooling layout (A13) | air cooling at an open position | both phases in the chamber | cycle 176.2 min, 15 tanks |
| Layers (A2) | one oven visit | return to loading per layer | cycle 138.0 min, 16 tanks |
| Oven time (A14) | per visit | per layer | cycle 357.0 min, 5 tanks |

Independent check, not used for calibration: daily output in the ERP (production days, Jan to Nov 2026).

| Product | ERP days | Twin, four arms | Days equal | Twin, three arms | Days equal | Other moulds x cycles | No match (quantities) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CTT4 | 61 | 4 | 67 % | 5 | 18 % | 2 % | 13 % (1, 2, 3) |
| CTT2 | 130 | 8 | 47 % | 10 | 30 % | 18 % | 5 % (1, 2, 6, 11) |
| HTT2 | 145 | 8 | 74 % | 10 | 6 % | 17 % | 3 % (3, 6) |

Week of 2 to 6 Nov: ERP 11 / 12 / 36; twin 12 / 12 / 36 for 3 production days with 1 / 1 / 3 moulds on (set-up assumed).

## Gaps against NTG's figures

1. **Tanks by the 8.5 h mark.** The twin has 4 / 6 / 6 (16) out by the mark, not 20. The last 2 arms finish after it; the last tank is out 38.5 min late. Not tuned away.
2. **Wait before the oven.** Twin 20.2 min, NTG's estimate 8 min (row 46): +12.2 min. The demould time is a placeholder (12 min, range 8 to 30); a longer demould gives a shorter wait at the same cycle, down to 14.2 min at 20 min. The split cannot be settled without a timed shift.
3. **Minutes nobody estimated.** NTG's and the team's task times plus 5 moves add up to 108.0 min; the cycle is 120. The missing 12.0 min appear in the twin as waiting before the oven.
4. **No timed data.** No distribution is fitted. Times are fixed; the optional +/-10 % variation is a stress test, not a measurement.
5. **Other products** take the same oven visit as tanks and their powder is not tracked (A19).
6. **Picture only.** Mould tumble and fan speeds are scaled to stay readable at the playback speed (A25), and the oven temperature curve is illustrative (A10, dip 60 °C). Neither enters a count.

The full list of 34 decisions, each with its alternative, is in docs/ASSUMPTIONS.md. Known conflicts in the data are listed on the Report page.

## Tests

`src/sim/engine.test.ts` checks, for nine configurations, that no two arms share a position, that timelines are continuous,
that tanks are whole and powder balances, and that the state at a minute does not depend on how the clock got there.
`src/pages/report/validation.test.ts` checks that every figure on the Report page is taken from a run and that this file and
the assumptions register match the code.
