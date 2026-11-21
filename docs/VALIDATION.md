# Validation of the Machine 3700 twin

Generated from `src/pages/report/validation.ts`. Every figure is computed from a simulator run, the inventory or the ERP
history when the tests run; none is typed. The Report page shows the short version of the first table and two charts.

**Status: calibrated against NTG's figures, not yet timed on the floor.** No timed shift log was supplied. Every time in the twin is an NTG estimate, a visit note or a placeholder. When a timed shift exists it replaces those estimates, and the twin moves from calibrated to validated.

## Twin against NTG, one typical shift

One CTT4 mould, two CTT2, two HTT2 and one arm on other products (inventory rows 49 and 50).
Of 10 comparisons, 6 match, 1 is a gap, 1 only plays an input back and 2 have no NTG figure to be checked against.
The matches on cycle and output are what the twin was calibrated to: they show it is consistent with NTG's figures, not that it is proven.

| Metric | Twin | NTG figure | Tag | Inventory rows | Difference | Verdict | What it shows |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Arm cycle | 120.0 min | 120 min | V | 47 | 0.0 min | Matches | Same figure, but partly by construction. The oven takes one arm at a time, so the cycle is 4 arms x (28.5 min of oven visit + 1.5 min to change arms). The 1.5 min was not timed: it was chosen inside a 1 to 2 min range. At 1 min the cycle is 118.0, at 2 min it is 122.0. |
| Tanks from one shift | 4 / 8 / 8 (20) | 4 / 8 / 8 (20) | N | 49 | 0 tanks | Matches | Every arm is loaded 4 times in the shift and every load becomes a tank. This is the figure the twin was calibrated to. |
| Tanks out by the 8.5 h mark | 4 / 6 / 6 (16) | 4 / 8 / 8 (20) | N | 49 | -4 tanks | Gap | A real gap. In the twin the last 2 arms are still cooling at the mark, and the last tank is lifted out 38.5 min after it. The twin starts the day with four empty moulds; NTG's figure does not say whether the crew stays to empty the machine or the first arm starts earlier. With a hard stop at the mark the twin makes 4 / 6 / 6 (16). |
| Cycles per mould per day | 4.00 | 4 | N | 57 | 0.00 | Matches | The shift is 510 min and the cycle 120 min: 4.25 cycles, so 4 whole ones. NTG's weekly plan uses the same rule. |
| Wait before the oven, loaded arm | 8.1 min | 8 min | N | 46 | +0.1 min | Matches | Close: 8.1 min in the twin against NTG's estimate of 8 min. This is a result, not a setting: it follows from the layer handling the team confirmed on 21 Nov 2026 (the arm leaves the oven for layers 2 and 3, and the loading position is kept for it). It is not proof. NTG's 8 min is an estimate, the twin's times are estimates too, and two untimed numbers agreeing is weaker than one stopwatch. The figure moves with the demould placeholder (row 73): from 8 to 21 min of demould the wait runs from 8.9 down to 4.1 min while the cycle does not move, so part of the agreement rests on that placeholder. If the arm instead stayed in the oven for all layers, the same wait would be 20.2 min. |
| Wait for loading, empty arm | 14.3 min | No figure | none | none | n/a | Twin only | Not in NTG's figures. While an arm is in its oven visit the loading position is kept for it, so the arm behind waits empty at demould. Over the whole shift that is 14.3 min per oven visit, start and end of the day included; in a mid-shift cycle it is 7.3 min. This is where the minutes that no estimate covers go: NTG's and the team's times add up to 108.0 min of the 120 min cycle, and the other 12.0 min are, in the twin, the empty arm waiting for the loading position (7.3 min) and full arms held after cooling (5.1 min). Nobody has timed either. |
| Oven in use | 89 % | No figure | none | none | n/a | Twin only | Missing. No oven log or burner hours were supplied, so this figure is the twin's alone. |
| Oven visits per day | 16 | 16 (implied) | C | 37, 57 | 0 | Matches | NTG never counted oven visits. The figure on the right is 4 arms x 4 cycles, so this row repeats the cycles row and adds no new evidence. |
| Wait for demould | 8.0 min | 6–10 (mid 8) min | N | 72 | 0.0 min | Input | Not a test. The twin is told to wait NTG's 8 min at demould, so it plays the estimate back. The crew is not modelled as people who can be busy elsewhere. |
| Where arms queue | Oven: 270 of 562 waiting min | Before the oven | N | 42, 46, 66 | Same place | Matches | NTG says the oven takes one arm at a time, by turn, and that the wait before it can never be reduced. The twin finds the same: every other wait in the ring traces back to the oven's turn, and the oven is in use 89 % of the shift. |

## Where the 120 minutes go

NTG says the 120 min cycle covers one arm through every stage, waits included (row 48). The times NTG and the team gave, added up:

| Step of one arm cycle | Minutes | Tag | Inventory row |
| --- | --- | --- | --- |
| Loading | 1.0 | V | 32 |
| Wait before the oven (NTG estimate) | 8.0 | N | 46 |
| Oven visit, swings to loading included | 28.5 | V | 43 |
| Air cooling | 18.0 | V | 68 |
| Fan and water cooling | 25.0 | V | 69 |
| Wait for demould | 8.0 | N | 72 |
| Demould and mould prep (placeholder) | 12.0 | S | 73 |
| 5 moves between positions x 1.5 min | 7.5 | S | A9 |
| **Sum of the estimates** | 108.0 | C |  |
| NTG arm cycle | 120.0 | V | 47 |
| **Minutes no estimate covers** | 12.0 | C |  |

The inventory flags the same hole (row 73: "Range 8–30. ~17 min of the 120 min cycle is unexplained").
In the twin the cycle is set by the oven, so those minutes cannot vanish. One mid-shift arm cycle of the twin (mean of 8 cycles that are neither the first nor the last of the day):

| What the arm is doing | Minutes |
| --- | --- |
| Working: loading, oven visit with its swings, cooling, demould | 84.5 |
| Moving between positions | 7.5 |
| Waiting for the crew at demould (an input) | 8.0 |
| Loaded, waiting for the oven | 7.6 |
| Empty, waiting for the loading position | 7.3 |
| Full, held because the next position is occupied | 5.1 |
| **One cycle** | 120.0 |

So the minutes no estimate covers are, in the twin, an empty arm waiting at demould for the loading position (7.3 min) and full arms held after cooling (5.1 min). The working time averages three tank arms and one arm on other products, whose oven visit has no swings.
Over the whole shift, start and end of the day included, the empty wait is 14.3 min per oven visit and the loaded wait 8.1 min. Nobody has timed either; a stopwatch on one shift would.

## The demould placeholder, across its range

The demould time is the least certain input: a placeholder of 12 min with a range of 8 to 30 (row 73). Each line is a full run with only that time changed.
Up to 21 min the cycle and the 20 tanks hold, and the loaded wait before the oven stays between 4.1 and 8.9 min. From 22 min arms are held in the cooling positions and the cycle stretches (123.4 min).

| Demould time | Arm cycle | Loaded wait before the oven | Empty wait for loading | Full arm held, per visit | Tanks from the shift | Run-out after the mark |
| --- | --- | --- | --- | --- | --- | --- |
| 8 min | 120.0 min | 8.9 min | 16.8 min | 4.8 min | 4 / 8 / 8 (20) | 34.5 min |
| 12 min (used) | 120.0 min | 8.1 min | 14.3 min | 4.8 min | 4 / 8 / 8 (20) | 38.5 min |
| 16 min | 120.0 min | 7.4 min | 11.8 min | 4.8 min | 4 / 8 / 8 (20) | 42.5 min |
| 20 min | 120.0 min | 6.6 min | 8.7 min | 5.8 min | 4 / 8 / 8 (20) | 51.5 min |
| 24 min | 130.1 min | 2.7 min | 8.8 min | 19.0 min | 4 / 8 / 6 (18) | 75.5 min |
| 28 min | 143.3 min | 2.8 min | 9.5 min | 29.2 min | 4 / 6 / 6 (16) | 98.0 min |
| 30 min | 149.2 min | 3.0 min | 10.2 min | 33.9 min | 3 / 6 / 6 (15) | 86.5 min |

Index time, the other untimed input: 1.0 min gives a 118.0 min cycle and 20 tanks; 1.5 min gives a 120.0 min cycle and 20 tanks; 2.0 min gives a 122.0 min cycle and 20 tanks.
With +/-10 % variation on task times over 20 seeds: 20 tanks, cycle 117.3 to 121.4 min, run-out 36 to 70 min.

## ERP checks

The ERP stock cards were not used to calibrate the twin, so they are an independent check. The ERP does not record which moulds were on the machine, so a match on quantity is evidence, not proof.

### Daily output on production days

The twin makes 4 / 8 / 8 in a typical shift with all four arms working, and 5 / 10 / 10 when one arm carries no mould (three arms cycle faster). Both come from simulator runs.

| Product | Production days | Equal to the twin, four arms | Equal to the twin, three arms | Another whole number of moulds x cycles | No match | Days at a quantity the twin can make |
| --- | --- | --- | --- | --- | --- | --- |
| CTT4 | 61 | 41 (67 %) at 4 | 11 (18 %) at 5 | 1 (2 %) | 8 (13 %): 1, 2, 3 tanks | 87 % |
| CTT2 | 130 | 61 (47 %) at 8 | 39 (30 %) at 10 | 24 (18 %) | 6 (5 %): 1, 2, 6, 11 tanks | 95 % |
| HTT2 | 145 | 107 (74 %) at 8 | 9 (6 %) at 10 | 25 (17 %) | 4 (3 %): 3, 6 tanks | 97 % |

Days at each daily quantity (the bars of the chart on the Report page):

- CTT4: 1 tanks on 1 days; 2 tanks on 2 days; 3 tanks on 5 days; 4 tanks on 41 days; 5 tanks on 11 days; 10 tanks on 1 days.
- CTT2: 1 tanks on 1 days; 2 tanks on 1 days; 4 tanks on 11 days; 6 tanks on 3 days; 8 tanks on 61 days; 10 tanks on 39 days; 11 tanks on 1 days; 12 tanks on 12 days; 16 tanks on 1 days.
- HTT2: 3 tanks on 1 days; 4 tanks on 12 days; 6 tanks on 3 days; 8 tanks on 107 days; 10 tanks on 9 days; 12 tanks on 11 days; 16 tanks on 1 days; 24 tanks on 1 days.

### Week of 2 to 6 Nov: ERP production against mould-days x 4 cycles

The ERP books production on 2026-11-04, 2026-11-05, 2026-11-06. The set-up is not recorded; the one assumed is Other product, HTT2 x 2, CTT4, CTT2 + HTT2.

| Product | ERP by day | ERP week (row 100) | Production days | Moulds on (assumed) | Mould-days x 4 | Twin, same days | Twin less ERP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CTT4 | 3 / 4 / 4 | 11 | 3 | 1 | 12 | 12 | +1 |
| CTT2 | 4 / 4 / 4 | 12 | 3 | 1 | 12 | 12 | 0 |
| HTT2 | 12 / 12 / 12 | 36 | 3 | 3 | 36 | 36 | 0 |

Total: twin 60, ERP 59.

### Stock at the end of each week

The second chart on the Report page. Closing stock of every week in the ERP history against NTG's minimum (row 82) and warehouse cap (row 95).

| Product | Weeks | Minimum | Cap | Weeks ending below the minimum | Weeks ending above the cap | Lowest | Highest |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CTT4 | 47 | 15 | 40 | 7 | 2 | 3 | 44 |
| CTT2 | 47 | 50 | 120 | 5 | 8 | 20 | 151 |
| HTT2 | 47 | 70 | 140 | 7 | 4 | 38 | 163 |

The inventory counts this differently (row 105: "Below min: 10 / 10 / 10; above cap: 1 / 8 / 4", of 45 full weeks): it counts a week as below the minimum if stock dipped under it on any day, not only at the week's end.

## Readings that were rejected

Each is still in the simulator as a switch and is run when this file is generated. All give fewer tanks than NTG reports.

| Reading | Arm cycle | Oven visits per arm | Tanks from the shift | Loaded wait before the oven | Why it is not used |
| --- | --- | --- | --- | --- | --- |
| **The twin's default**: the arm returns to loading for layers 2 and 3, inside one oven visit | 120.0 min | 4.00 | 4 / 8 / 8 (20) | 8.1 min | Reproduces NTG's cycle and shift output, and is what the team saw. |
| The 28.5 min is heating only, and the swings out to loading and back come on top (`tripsInsideVisit: false`) | 138.0 min | 3.50 | 4 / 6 / 6 (16) | 10.2 min | Gives a 138.0 min arm cycle, 3.50 oven visits per arm and 4 / 6 / 6 tanks (16 against 20). NTG reports 4 / 8 / 8 tanks from a shift (row 49) and 4 cycles per mould a day (row 57). The oven's turn would last 34.5 min per tank arm, and four arms no longer fit four turns each into the shift. The team says the swings are inside the time it measured. |
| The 1.5 min dosing pauses are added on top of the 28.5 min oven visit (`pausesInsideVisit: false`) | 129.0 min | 3.75 | 4 / 8 / 6 (18) | 9.2 min | Gives a 129.0 min arm cycle, 3.75 oven visits per arm and 4 / 8 / 6 tanks (18 against 20). NTG reports 4 / 8 / 8 tanks from a shift (row 49) and 4 cycles per mould a day (row 57). The oven's turn would last 31.5 min per tank arm. |
| Both cooling phases happen in the cooling chamber, with a waiting position before the oven (`cooling: 'bothInChamber'`) | 176.2 min | 3.00 | 3 / 6 / 6 (15) | 55.4 min | Gives a 176.2 min arm cycle, 3.00 oven visits per arm and 3 / 6 / 6 tanks (15 against 20). NTG reports 4 / 8 / 8 tanks from a shift (row 49) and 4 cycles per mould a day (row 57). One position would then hold every arm for 43 min, longer than the oven visit, so cooling, not the oven, would set the pace. |
| The 28.5 min oven time is per layer, not per visit (rows 43 and 44) (`times.ovenVisit: 28.5 x 3 layers of heating, pauses and swings on top`) | 375.0 min | 1.25 | 1 / 2 / 2 (5) | 33.4 min | Gives a 375.0 min arm cycle, 1.25 oven visits per arm and 1 / 2 / 2 tanks (5 against 20). NTG reports 4 / 8 / 8 tanks from a shift (row 49) and 4 cycles per mould a day (row 57). This is the reading the inventory calls H2. |

### The other reading of the layer step

Not rejected by its output. It gives the same cycle and the same tanks; it is contradicted by what the team saw.

| Reading | Arm cycle | Oven visits per arm | Tanks from the shift | Loaded wait before the oven | Why it is not used |
| --- | --- | --- | --- | --- | --- |
| The arm stays in the oven for all layers and pauses there while the next layer goes in (`layerMode: 'singleVisit'`) | 120.0 min | 4.00 | 4 / 8 / 8 (20) | 20.2 min | Gives the same 120.0 min cycle and 4 / 8 / 8 tanks (20), so output cannot tell the two readings apart. It is not used because the team saw the arm leave the oven for layers 2 and 3 (H, 21 Nov 2026). Where arms wait is different: with a pause in the oven the loaded wait before the oven would be 20.2 min, against 8.1 min with the return to loading and NTG's estimate of 8 min (row 46). |

## Field timing: PENDING

No timed shift log was supplied. Every time in the twin is an NTG estimate, a visit note or a placeholder. When a timed shift exists it replaces those estimates, and the twin moves from calibrated to validated.

Inventory rows that name a timed shift as their replacement (10): 32 mould loading time (close mould + fill material); 43 oven time per arm visit; 44 oven time basis: per tank or per layer?; 46 wait before oven; 68 initial (air) cooling; 69 fan / water cooling; 72 wait for demoulding; 73 demould + reload task time; 74 workers at the machine; 75 finishing time.

## Known data conflicts

Places where two sources disagree, or where a figure does not add up. None is hidden or averaged away.

### 1. Weekly hours against weekly output

Machine 3700 runs 5 days x 8.5 h = 42.5 h a week (row 54). Take away the 34 h NTG gives to other products (row 51) and 8.5 h are left: one shift, 20 tanks at NTG's own shift figure (row 49). The ERP shows 59 tanks made in the week of 2 to 6 Nov (row 100).

**What the twin does.** The twin treats arms, not hours, as what is shared: other products ride on other arms in the same shift (row 40). On that reading 3 production days give 60 tanks against the ERP's 59. If the oven time were per layer, a shift would give 5 tanks and the week could not be made at all.

> Inventory row 54, Operating hours of Machine 3700: "Biggest open question: one 8.5 h shift/day can't make 59 tanks unless H1 holds"
> Inventory row 40, Arms on studied tanks vs other products: "Arms are shared, not dedicated; ARM1 ran other products only"

### 2. Oven time: per tank or per layer

The visit notes give 28.5 min of oven time (row 43) without saying whether it covers one layer or all 3. Per layer, the twin gives a 375.0 min arm cycle and 5 tanks a shift; per visit, 120.0 min and 20 tanks.

**What the twin does.** The twin uses one 28.5 min visit for all layers, swings to the loading position included. Only that reading reproduces NTG's output, and the team confirmed on 21 Nov 2026 that the swings are inside the time it measured. A timed shift would still be the proof.

> Inventory row 43, Oven time per arm visit: "Per tank (H1) vs per layer (H2): H2 contradicts NTG output, so H1 used"
> Inventory row 44, Oven time basis: per tank or per layer?: "Consistent with Form 2 Q7–Q8 and 4 cycles/day in weekly plan; per-layer reading cannot produce this output"

### 3. HTT2 stock is 10 tanks higher than production less sales

Week of 2 to 6 Nov, HTT2: opening 92 + made 36 - sold 32 = 96, but the closing count is 106. The ERP shows 10 tanks returned that week, which closes the gap exactly (106).

**What the twin does.** Resolved by NTG. The twin's stock check does not model returns: closing stock = opening + made - average sales. A week with returns ends higher than the twin shows.

> Inventory row 81, HTD2 stock discrepancy: "+10 = returned tanks"
> Inventory row 81, HTD2 stock discrepancy: "Resolved: stock balance needs a 'returns' term"

### 4. Stock list of 6 Nov against Form 1

Form 1 gives closing stock on 6 Nov as 36 / 113 / 106 (row 79). The signed stock availability list of the same day gives 25 / 106 / 82 available and 0 / 13 / 18 pending. Available alone differs from Form 1 by -11 / -7 / -24; available plus pending by -11 / +6 / -6. Neither adds up.

**What the twin does.** Not reconciled. The twin starts the stock check from Form 1 (36 / 113 / 106), which matches the ERP stock cards. If the list is right, the CTT4 opening stock is 11 tanks lower than the twin assumes.

> Inventory row 80, Stock availability list 6 Nov: available / pending order: "Available 25 / 106 / 82; pending 0 / 13 / 18"
> Inventory row 80, Stock availability list 6 Nov: available / pending order: "CONFLICT with Form 1 (36 / 113 / 106). Possibly 'available' excludes tanks not yet released or reserved; do not reconcile silently"

### 5. CTT4 powder: 90 kg or 87 kg per tank

The visit notes give CTT4 layers of 40 + 22 + 25 = 87 kg (row 27). NTG's weekly plan implies 90 kg a tank (row 30). The two other products agree exactly (60 and 66 kg).

**What the twin does.** The twin doses the visit's layer weights (87 kg), because the plan gives no split by layer. If NTG's 90 kg is right, the twin under-counts CTT4 powder by 3 kg a tank, 3.3 %. Tank counts are not affected.

> Inventory row 27, CTD4 layer weights: "NTG weekly plan implies 90 kg/tank (720 kg / 8); visit notes say 87. Use 90 (NTG) as base, 87 as check"
> Inventory row 30, Raw material per tank (NTG plan): "CTD2 and HTD2 match visit notes exactly; CTD4 90 vs 87"

### 6. Share of the machine given to other products

Form 1 says other products take 34 h of the 42.5 h week, which is 80 % (row 51). The weekly plan for 9 to 13 Nov puts the studied tanks on 8 of 16 arm-days, leaving 50 % to other products (row 53). NTG later said the figure varies (row 52).

**What the twin does.** The twin does not use the 34 h figure. Each scenario states its own arm-days, and the comparison table shows them.

> Inventory row 52, Is the 34 h/week typical or variable?: "Variable"
> Inventory row 53, Hours/week available for the 3 studied tanks: "Variable; 9–13 Nov plan used 8 of 16 arm-days (50%)"
> Inventory row 40, Arms on studied tanks vs other products: "Arms are shared, not dedicated; ARM1 ran other products only"

### 7. Plan for 9 to 13 Nov against what the ERP recorded

NTG planned 8 / 4 / 36 tanks for 9 to 13 Nov (row 90). The ERP stock cards record 4 / 4 / 36 made that week: -4 / 0 / 0 against the plan.

**What the twin does.** The Redesign baseline is the plan, not the week as it ran, because the redesign question is about how the week is planned. The ERP figure is shown beside it.

> Inventory row 90, NTG plan for 9–13 Nov (studied tanks): "CTD2 again low while its stock is falling (same pattern as 2–6 Nov)"
> Inventory row 101, Weekly history (26–52 weeks): "46 weeks of daily transactions (sales, returns, production, balance) per SKU"

### 8. Cycles per shift in the diesel cost

The diesel cost per arm cycle (row 61) divides 265 L a shift by 4 arms x 4.25 cycles, which is the shift length over the cycle (4.25). NTG's planning rule (row 57) and the twin both give 4 whole cycles per arm.

**What the twin does.** With 4 cycles the diesel per arm cycle is 16.6 L, not 15.6 L: 6 % more. The twin counts tanks and does not use this cost; the Plan page does.

> Inventory row 61, Machine diesel cost per arm-cycle: "265 L ÷ (4 arms × 4.25 cycles) = 15.6 L × 1.397 USD/L"
