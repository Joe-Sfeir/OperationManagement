# Raw-material hall: notes

Files: `RawHall.tsx` (root, floor, lane), `layout.ts` (positions and the forklift choreography), `Sacks.tsx`, `Extruder.tsx`, `Pulveriser.tsx`, `Silos.tsx`, `Forklift.tsx` (forklift and bins), `bits.tsx` (small parts), `preview.tsx` + `/preview-raw.html`.

Exports of `RawHall.tsx`: `RawHall({ onSelect })`, `HALL_VIEW_CENTER = [0, 2.6, -2.4]`, `HALL_SPAN = [26, 16]`.

Measured in the preview: 48,594 triangles (sum over the hall's meshes, instanced meshes counted at their full instance count). `npx tsc -b` passes.

## What drives what

| Thing that moves | Read from |
| --- | --- |
| Sacks left on the pallets | `result.grinds`: kg x progress at `clock.t`, one sack per 25 kg, floor |
| Extruder drive coupling angle | minutes of grinding done: finished batches + `grind.progress` x batch length (only changes while `grind.active`) |
| Powder burst at the cyclone outlet | shown only while `grind.active`; each grain's place in its fall is a function of `clock.t` |
| Gauge columns | `siloKg[i] / config.raw.siloCapacityKg` |
| Duct diverter lever and sight band | `grind.active` and `grind.layer` |
| Feeder stream, powder level in a bin, forklift, forks, bin tip, pour | `logistics(clock.t, result.bins, config.raw.binKg)` in `layout.ts` |
| Forklift wheels | distance along the path (`odo`), so they stand still when the forklift does |

No `Date.now`, no `state.clock`, no timers.

## Bin trip, as built

Fractions of one trip (t0..t1):

- 0 to 25 %: the bin fills under its silo's feeder (stream on, level in the bin rises). From 12 % the forklift drives to that bay and puts its forks in the pockets.
- 25 to 28 %: forks lift the bin clear. 28 to 42 %: straight back out of the bay, then a quarter turn in reverse onto the lane. 42 to 85 %: down the lane to the platform, ease-in-out.
- 85 to 92.5 %: forks rise to 6.18 m (three-stage mast). 91.5 to 95.5 %: the bin body tips 105 degrees about its front edge. 94 to 99.5 %: powder pours and the bin empties.
- After t1, over 60 % of a trip length: bin back upright, forks down, reverse up the lane, the empty bin goes back under its feeder, the forklift backs out and parks on the lane in front of that silo.

Checked numerically over the whole shift at 0.12 s steps of simulated time: no jump in position, heading, fork height or tip angle; the bin changes hands only with the forks low at the bin's own spot.

## Assumptions (each with the alternative considered)

1. **Sacks are 25 kg; 4 pallets x 4 layers x 5 sacks = 80 sacks (2,000 kg) at the start.** Alternative: real 1 t pallets (40 sacks, 8 layers). The brief asked for 3 to 4 layers; the default shift grinds 1,356 kg (54 sacks), so 26 are left at the end. If a configuration grinds more than 2,000 kg the pallets simply stand empty: no new delivery is animated.
2. **Sacks counted against powder kg.** `grinds[].kg` is powder (resin plus 2 % pigment or 1.2 % foam agent where dosed). Alternative: subtract the additive share first. Difference is under 2 % and the brief says kg / 25.
3. **Pallets empty from the one nearest the hopper steps toward the lane, top layer first.** Alternative: from the lane side. Chosen so the operator's walk is the shortest.
4. **One transfer bin per silo (three bins), not one shared bin.** The brief says "the bin". Alternative: one bin that the forklift carries to whichever silo is next. Rejected because the simulator can call the next bin at the instant the last trip ends (`forkliftFree = t1`), and one bin cannot be on the forks and filling under another feeder at once; with three bins nothing ever teleports. The two idle bins stand empty under their feeders.
5. **The run back is shortened if the next bin is called early.** The return ends at the earlier of t1 + 60 % of a trip and 12 % into the next trip. In the default shift there is always room (4 min between trips), so it is the full 60 %.
6. **The forklift carries the empty bin back** ("drives back empty" read as empty of powder). Alternative: leave the bin at the platform; then the silo would have no bin for its next trip.
7. **Bins are grey polyethylene on a steel base with fork pockets, tipping about the front edge of the base** (a self-dumping bin). Alternative: a rigid bin on a rotating fork carriage. `mats().tank` is used for the body; galvanised read as near black in the silo shadow.
8. **The forklift always tips over the hall-side hopper**, whatever the layer. The foam and inner layers belong to the second hopper, 1.7 m further in, which no forklift can reach from this side of the platform. Alternative: approach the platform from behind for layers 2 and 3; that hides the forklift behind the platform. The hopper windows (machine scene) still show the right levels.
9. **Fork height at the tip is 6.18 m**, so the lip of the tipped bin clears the hopper rim (5.66 m: deck 3.5 + stand 0.5 + hopper 1.66, copied from `machine/Loading.tsx`). Hence a three-stage mast. Alternative: a lower lift that tips against the hopper's side; it would look wrong.
10. **Lane centre line is in line with the row of hoppers** (platform centre z - 0.3), not the platform centre, so the pour lands in the hopper and the forklift clears the platform stairs.
11. **Layout.** One line along the back, left to right: motor, gearbox, feed hopper, barrel, pelletiser, mill, cyclone, silos 1 to 3; sacks in front of the extruder; lane in front of the silos. Alternative: extruder in the front row with the duct crossing the lane overhead; rejected because it puts machinery between the camera and the gauges.
12. **Slab.** x -10.5 to 9.0, z -6.9 to 3.4, plus a lane strip to the platform. It runs under the machine slab (which starts at hall x = 4.8) and sits 2 mm lower, so the machine floor wins where they overlap. Its front edge is in line with the machine slab's front edge so the two read as one floor. That number (3.4) is copied from `machine/Floor.tsx`, which does not export it: if the machine slab changes, change `SLAB.z1` in `layout.ts`. The brief's "z within about -6.5 to 6.5" is exceeded by 0.4 m at the back, to give the forklift a straight run into each bay.
13. **Silo.** 2.5 m diameter, 4.5 m shell (22 m3), 1.4 m cone, outlet 1.3 m above the floor, shell top at 7.2 m, rail to 8.2 m, duct at 8.55 m. Capacity is not derived from this geometry.
14. **Gauge.** A 0.6 m slot down the shell on the camera side (azimuth 15 degrees, facing the fixed camera) with a white column; a black line across the slot at 30 % is the reorder mark (assumption A11 in the data). The column uses its own material (matte white, emissive 0.5) so it reads in the shade of the shell; `mats().powder` went blue-grey there. Alternative: flat panel proud of the shell; a slot reads more like a cut-away.
15. **The gauge does not turn amber below the reorder level.** The style bible says it should; the brief for this component forbids orange or amber in the hall. The mark is there; the colour change is left to the app's HTML gauge, or to a later decision.
16. **Diverter.** While grinding, the lever on the active silo's drop points down and its sight band shows white; the others are tilted and dark. Kept small on purpose. Alternative: a brighter chute; it competed with the gauges.
17. **Pulveriser train.** Disc mill, blower pipe to a cyclone, the powder drops from the cyclone through a short open fall into a funnel, and a second blower sends it up the duct to the silos. The burst is drawn in that open fall. Alternative: burst at the mill housing itself; hidden behind the feed funnel from this camera.
18. **Extruder.** Die-face pelletiser on the end of the barrel, no water bath or strand line. Heater bands are dark steel, not coloured (warm colours are reserved for the oven).
19. **Coupling speed.** 1.7 turns per simulated minute, chosen to be readable at 1x and at 100x; not the real motor speed.
20. **Silo ladders and the hopper steps are drawn in this folder** (`CagedLadder`, instanced steps), not with `Ladder` and `Stairs` from `parts.tsx`: the shared ladder's cage hoops read as loose hooks at this angle and the shared stairs cost about 2,800 triangles.
21. **Eased boxes.** `Eased` in `bits.tsx` (three's `RoundedBoxGeometry`, one smooth chamfer, 108 triangles) replaces the shared `Box` (about 600 triangles each) inside the hall. First pass with `Box` measured 71,805 triangles.
22. **No operator on foot in the hall.** Only the seated forklift driver. Alternative: a figure emptying sacks at the hopper; it would have to move with the sack count to be honest, and the brief did not ask for it.

## Not verified

- **No photo was available.** `reference/photos/` holds only a README, so "following the extruder and silo photo" could not be checked. Colours and proportions follow the style bible's text and the machine scene.
- **No approved concept image** for the raw-material hall to compare against (anti-slop rule 8).
- **Only the default configuration was looked at.** Other configurations (different trip time, bin size, grinding rate) run through the same pure functions but were not screenshotted.
- **A second bin called at the instant a trip ends** (assumption 5) does not occur in the default shift, so the shortened run back was checked by reasoning and by the continuity scan, not on screen.
- **Playback while moving** was checked as stills and numerically, not as video. Frame rate was not measured (the screenshots use software GL).
- **Reduced-motion stepping** is the app's job (it steps the clock); not tested here.
- The dosing platform is about 7 m beyond the right edge of the hall view (`HALL_SPAN` 26 m wide, centre x = 0), so the tip is seen in the plant overview, not in the hall view. To keep it in frame the view would need roughly centre x = 4.4 and a 33.5 m span.
