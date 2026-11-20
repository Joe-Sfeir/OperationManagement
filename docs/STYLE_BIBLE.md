# NTG Digital Twin: Style Bible

20 Nov 2026 · H. Exported from the live doc: https://claude.ai/artifact/D3cAtzksjEiLYtXL6Epjmd (the doc wins if they differ).

## Creative direction

The twin should feel like a **precise scale model of Machine 3700 on a control-room screen**: calm, exact, and alive only where the plant is alive. Picture an architect's maquette lit like a product shot, wrapped in a dashboard an NTG shift supervisor would trust.

**References** (`reference/photos/`): the two console photos and the hoist photo set the real colours and clutter, the manual's plan view sets the layout, the cooking and cooling chamber drawings set the shapes, and the HMI page shows what operators already look at. The extruder and silo photo sets the raw-material hall.

**Anti-slop rules.** Every one is a hard rule:

1. Nothing moves unless the simulator says so. No idle loops, floating particles or pulsing glows for decoration.
2. No purple or blue gradients, glassmorphism stacks, glowing neon borders, emoji icons or generic hero copy.
3. One warm accent only, and it always means heat (the oven). Other colours carry meaning (stage, warning) or stay neutral.
4. Use NTG's own words: arm, oven, cooling, demould, layer, mould, silo. No marketing language.
5. Every number shown traces to the data inventory and carries its source badge (N = NTG, V = visit, C = calculated, S = synthetic).
6. Machinery has mass. Use ease-in-out with no overshoot or springy bounce. Arms index like heavy steel, not like UI cards.
7. No stock 3D assets or icon packs pasted in. Every object is modelled for this scene from the photos.
8. Each screen is checked against an approved concept image before it counts as done.

## Visual system

One fixed isometric camera, one lighting rig and one palette run through every scene. Semi-realism later means better models and materials, not a new style.

**Camera.** Orthographic, true isometric (45° around, about 35° down), locked. There's no free orbit. The camera has three zoom presets: Plant overview, Machine, and Station close-up (click a station). Moves between presets take 1.2 s with ease-in-out.

**Light.** A warm key light from the top left with soft shadows, a cool fill light, and ambient occlusion so objects sit on the floor. The oven interior is the only warm practical light, and its glow on the floor gets brighter with oven temperature.

**Palette** (taken from the photos):

| Token | Hex | Used for |
| --- | --- | --- |
| Canvas | #0F1214 | Page and scene background |
| Panel | #161A1D | Dashboard panels, 1 px hairline border |
| Machine cream | #D9CFB8 | Oven cabinet, platforms, hub (as photographed) |
| NTG blue | #2F6FC9 | Sliding doors, motors, cooling shell |
| Mould black | #1E1F21 | Moulds, slightly glossy |
| Floor epoxy | #2C4638 | Machine floor area |
| Safety yellow | #F2C230 | Yellow line from the manual |
| Heat amber | #F2A33A | Oven, heat, the bottleneck. The only warm accent |
| Cool teal | #4FB3A6 | Cooling stage |
| Alert red | #D0534A | Waiting or blocked |

**Materials.** Matte painted steel for the cabinets, brushed steel for the arms and frames, and blackened steel with a faint sheen for the moulds. Tanks are polyethylene with a soft satin finish. Powder is a white matte particle with no sparkle.

**Type.** IBM Plex Sans for the interface and IBM Plex Mono for numbers and timers, with tabular figures. Use three sizes only: 12, 14 and 28 px.

**Motion.** Every animation's duration comes from simulation time multiplied by the playback speed. Arms index with mass (ease-in-out, no overshoot), fans spin at a speed tied to the cooling state, and powder flows while dosing is active. Interface transitions take 150 to 250 ms. With reduced motion turned on, scenes still update but move in steps.

## Rotomoulder hero

The carousel sits at the centre of the screen, laid out as in the manual's plan view: hub in the middle, cooking chamber on the right, round cooling chamber at the upper left, loading and demould positions along the yellow line. Each element below is its own component and takes its state from the simulator.

| Element | Look (from the photos) | What moves | Simulation state that drives it |
| --- | --- | --- | --- |
| Hub (turret) | Cream drum with a ring of small blue gear motors | Indexes when an arm changes station | Arm move events |
| Arms (4) | Brushed steel beam ending in a ring frame | Swings between positions; the end of the arm spins on two axes in the oven and in cooling | Arm stage and position; rotation speed |
| Moulds | Black dome-topped cylinders in cradle frames. 1 per arm for CTT4, 2 for CTT2 and HTT2 | Lid opens at load and demould; tumbles while rotating | Product per arm (SKU), mould count, open or closed |
| Cooking chamber (oven) | Cream panelled box, blue sliding doors, exhaust stack on top; front wall cut away to show the inside | Doors slide; the interior glows in proportion to temperature; heat shimmer on the stack | Oven busy or free, current layer (1 to 3), temperature |
| Cooling chamber | Blue cylindrical shell open on one side, yellow inside, side fan and exhaust | Fan spins; faint water mist in the water phase | Cooling phase (air 18 min, then water 25 min, per the visit) |
| Loading station | Overhead dosing platform with two cream hoppers and a white hose down to the mould | Powder stream while dosing; hopper level drops | Layer being loaded, kg dosed |
| Demould station | Chain hoist on a beam with an orange hoist block | Hoist lifts the finished tank out; the tank swings slightly and is set down on the buffer | Demould event, SKU |
| Finished tank buffer | Row of finished tanks beside the machine | A new tank appears at each demould; the count rises | Good units per SKU this shift |
| Operator console | Grey cabinet with a small screen and a green status light | Screen mirrors oven temperature; the light turns amber when an arm is waiting | Oven temperature, queue state |
| Operators (2 or 3) | Simple faceless figures in work clothes, for scale only | Walk between the loading and demould stations | Who is busy (only if the model includes labour) |

**Layers.** Oven time is per layer, so a three-layer HTT2 needs three oven passes or a longer stay. How the arm handles layers 2 and 3 is an open question below, and the animation follows whatever NTG confirms.

**Bottleneck cues.** An arm waiting for the oven shows a red ring on the floor at its station and a growing timer. The oven gets an amber outline while it is the limiting station. These cues come from the simulator's queue data, not from fixed rules.

## Raw-material scene

Clicking **Raw material** (or a silo gauge) moves the camera from the machine to the powder hall, using the same isometric angle and light. The machine stays visible at the edge of the screen, so the two scenes read as one plant.

**Transition.** The camera pulls back to the Plant overview, then glides along the powder route to the hall in about 1.4 s. A breadcrumb (Machine 3700 / Raw material) and a Back key return the same way.

**Process line**, left to right and following the extruder and silo photo:

1. **Resin sacks** on pallets (white bags with red print, as in the photos), brought in by a yellow forklift.
2. **Feed hopper and extruder** (big blue motor). The operator empties sacks into the hopper. Pigment (2%) and foam agent (1.2%) are dosed here for the layers that need them.
3. **Pulveriser** grinds pellets into powder, shown as a short burst of particles at the outlet when it runs.
4. **Three silos** (cream, about 7 t each), one per layer: outer coloured layer, middle layer and inner foam layer. Each has a cut-away level gauge, and the level is the real simulated stock in kg.
5. **Transfer container.** A bin fills from a silo's blue screw feeder, then a forklift carries it to the dosing hoppers above the machine. The silo level drops and the hopper level rises.

**What drives it.** Silo levels fall by the kg per layer of each loaded tank (from the data inventory) and rise when a grinding batch completes. A silo below its reorder level turns its gauge amber, and that is the link to the sourcing page.

Raw material isn't a constraint in the data, so this scene mostly shows the flow and stock levels. It isn't a second bottleneck, and the text says so.

## Sourcing map and dashboard chrome

**Sourcing map.** The map is a dark, flat map of the Gulf, the Red Sea, the Mediterranean and northern Europe, with land in a slightly lighter grey and no satellite imagery or glow. Beirut is marked with a small ring.

- **Routes.** Sea: Jubail (Saudi Arabia) and Sitra (Bahrain) around Arabia, through Suez, to Beirut. Hamburg (Germany) through Gibraltar to Beirut. Air: arcs to Beirut airport. A route draws itself, then a ship or plane marker moves along it, with travel time scaled to lead time.
- **Decision panel.** For each source and mode, the panel shows unit price by quantity tier, freight, landed cost per kg, lead time and the EOQ with quantity discounts. The best option is highlighted on the map and in the table. Changing the order quantity re-solves the table and redraws the routes.
- **Honesty.** Every price, tier and freight rate is a researched estimate with an S badge and a source link. The page header says the prices are not supplier quotes.

**Dashboard chrome.** The 3D scene fills the screen and the panels sit on top of it.

- **Top bar:** plant name, live indicator, simulated clock, and the scene switcher (Machine, Raw material, Sourcing, Redesign, Report).
- **Left panel:** one row per arm with its stage, a progress bar in the stage colour, and time left or time waiting.
- **Right panel:** three KPIs only (tanks finished against plan, oven utilisation, current bottleneck), each with a source badge.
- **Bottom bar:** play and pause, speed (1× to 600×), and a timeline of the shift coloured by oven state that you can scrub.
- **Panels:** solid #161A1D, 1 px hairline, 8 px radius. No blur stacks or drop-shadow piles. Panels collapse to give the scene the full screen.

## Concept image prompts

Paste the style anchor first, then one element prompt, into Nano Banana, Higgsfield or Midjourney. Where the tool accepts a reference image, attach the matching photo from `reference/photos/`.

**Style anchor** (start every prompt with this):

```text
Isometric 3D render, true orthographic isometric camera, scale-model look, soft warm key light from top left, cool fill, ambient occlusion, matte painted steel, cream #D9CFB8 cabinets, blue #2F6FC9 doors and motors, black moulds, dark green epoxy floor with a yellow safety line, near-black background #0F1214, clean and precise, no people faces, no text, no logos, no neon, no gradients
```

**Element prompts:**

1. **Machine hero:** `industrial rotational moulding carousel machine seen from above at isometric angle, central drum hub with ring of small blue motors, four steel arms with ring frames holding black dome-topped moulds, cream box oven on the right with blue sliding doors and front wall cut away showing orange glow inside, round blue cooling chamber with side fan at upper left, overhead dosing platform with two hoppers and a white hose, chain hoist lifting a grey water tank`
2. **Oven close-up:** `cut-away cream panelled oven with blue sliding doors half open, black mould on a steel arm inside tumbling, warm orange interior light spilling onto the floor, exhaust stack on top`
3. **Cooling chamber:** `cylindrical blue cooling chamber open on one side, yellow interior, large black side fan, black mould on a steel arm inside, faint water mist`
4. **Demoulding:** `orange chain hoist on a cream beam lifting a freshly moulded grey polyethylene water tank out of an open black mould, two simple worker figures guiding it, row of finished tanks nearby`
5. **Raw-material hall:** `polymer powder hall, three tall cream silos with blue screw feeders and cut-away level gauges, blue extruder with large blue electric motor, pulveriser with powder outlet, stacked white resin sacks on pallets, yellow forklift carrying a powder bin`
6. **Sourcing map:** `flat dark map of Europe, the Mediterranean, the Red Sea and the Arabian Gulf, muted grey land, three thin route lines converging on Beirut from Hamburg, Jubail and Bahrain, small ship and plane icons, minimal cartographic style`
7. **Full dashboard:** `industrial control room web dashboard, dark UI, isometric 3D rotational moulding machine filling the centre, thin left panel listing four arms with progress bars, right panel with three large numeric KPIs, bottom timeline bar, IBM Plex type, restrained amber accent`

## Open questions (defaults used until answered)

| Question | Default until answered |
| --- | --- |
| Tank colour per product (CTT4, CTT2, HTT2) | Grey body, black top, as in the photos |
| Layers 2 and 3: does the arm leave the oven for the next layer's powder? | Model as a configurable option; default = each layer is a separate oven entry with a return to loading |
| Raw-material line: extruder then pulveriser then silo? Which silo is which layer? | Extruder, pulveriser, silo; silo 1 outer (pigmented), silo 2 middle, silo 3 inner (foam) |
| Powder transport to the hoppers above the machine | Forklift with a bin |
| Arm count | 4 arms on 5 positions |
| Theme | Dark only |
| Sound | Off |
