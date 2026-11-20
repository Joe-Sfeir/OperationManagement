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
