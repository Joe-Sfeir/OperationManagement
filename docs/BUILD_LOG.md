# Build log

## M0, design direction (20 Nov), at the gate

**Done**
- The project is scaffolded with Vite 8, React 18, TypeScript 7 (strict), Tailwind 3.4, three.js with @react-three/fiber 8 and drei 9, Framer Motion, `highs` and Vitest. IBM Plex is self-hosted through @fontsource. `npm run build`, `npm test` and `tsc -b` all pass.
- Tokens live in `src/design/tokens.ts` and feed `tailwind.config.ts`. The colours, font sizes and radii replace Tailwind's defaults, so off-palette colours and a fourth type size can't be written. A test parses the bible's palette table and fails if the tokens drift. It also checks text contrast and that the ease never overshoots.
- `SourceBadge` shows the N, V, C or S tag, with S drawn dashed. A token check page serves as the app entry for now.
- `tools/screens.mjs` takes 1600x1000 and 390x844 screenshots at 2x and fails on console errors. Screens are in `docs/screens/m0-*`.
- `tools/build_contact_sheet.mjs` builds `reference/concepts/contact_sheet.html` from the bible's prompts and the images in `reference/concepts/`.

**Design choices not in the bible** (none are claims about NTG)
- Interface neutrals for text, hairlines and the steel stage bars. Loading and demould use neutral steel, so amber stays heat only.
- Alert red is 4.2:1 on Panel, below AA for small text. It is used for fills, rings and bars only, never for 12 or 14 px text.
- Small controls and badges use a 4 px radius; panels use 8 px as the bible says.
- Light and material numbers are starting values, to be tuned against the approved hero concept in M2.

**Skills.** frontend-design was used. Impeccable, VectorLab UI/UX, Design (Anthropic) and parallax-threejs are not installed in this cloud session, and `/plugin` can't be run from here. I followed the bible's rules directly and did not write PRODUCT.md or DESIGN.md, since those come from `/impeccable init`.

**Blocked or missing**
- `_inputs/` was not in the session; only STYLE_BIBLE.md arrived. Still missing: both data workbooks, the timing CSV, data/sources, the status and build plan doc, the model spec, `tools/lp_prototype_check.py` and the style samples. M1 can't start without the inventory.
- Five reference images came in chat but not as files (see reference/photos/README.md). The console photo(s) and the raw-material hall photo were not received.
- `GEMINI_API_KEY` is not set, so no concepts have been generated.
- There is no git remote. Commits are local to an ephemeral container.

**Left in M0:** generate the concepts, refresh the contact sheet, and get approval.

## M1 to M6, in progress (20 to 21 Nov)

The M0 and M2 approval gates were skipped on H's instruction ("my main goal is to get the visuals done"). No concept images exist, so no screen has been compared with an approved concept.

**Done**
- **Data.** `tools/extract_data.py` copies both workbooks to JSON. `src/data/params.ts` parses every input from its inventory row and keeps its tag.
- **Simulator.** Four arms on a ring of five positions, oven by turn. Default settings give a 120.0 min cycle, 16 oven visits and 4 + 8 + 8 tanks. Tests cover oven booking, whole tanks, powder balance, determinism and the calibration.
- **Machine scene.** Hub, arms with moulds, oven as a section model, cooling chamber, dosing platform, hoist, buffer, console, operators, waiting cues. Checked on screen at 1600x1000 and 390x844, including the oven and demould close-ups and the alternative layout.
- **Dashboard.** Top bar, arms panel, three KPIs, playback bar with a scrubbable oven timeline, set-up drawer, station card. Default playback speed is 100x at H's request.
- **Plan and Sourcing pages.** Built by background agents, reviewed on screen, wired in.
- **Offline build.** `npm run build:single` writes one `index.html`. Opened from disk: the machine renders, HiGHS solves, the map draws.

**Decisions that follow the inventory where it differs from the master prompt**
- Oven time is 28.5 min per arm visit for all layers (rows 43, 44), not per layer. The two layer pauses are inside it.
- The five positions are loading, oven, air cooling, cooling chamber, demould. With both cooling phases at one position the cycle is 176 min and a shift gives about 3 cycles, which contradicts NTG.
- Layer order is outer ivory, foam, inner natural (row 26). The style bible had foam innermost.
- The alternatives are switches in the set-up drawer.

**Fixes worth remembering**
- three.js is pinned to 0.170. Version 0.187 breaks the ambient-occlusion pass and drops soft shadow maps.
- No bump maps. They produced NaN pixels in some close-ups, and the bloom pass then blacked out the whole frame.
- The arm cooling in air sits at 78 degrees, not 60, so the oven does not hide it.

**Not done yet**
- Raw-material hall, Redesign page, Report page (agents working).
- Accessibility pass, reduced-motion check, frame-rate check on a real laptop.
- Field timing: no timed shift log was supplied.
