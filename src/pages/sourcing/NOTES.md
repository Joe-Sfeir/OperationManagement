# Sourcing page: notes, assumptions and gaps

20 Nov 2026. Stretch feature. Every price, tier and freight rate on the page is a researched estimate (S), not a supplier or forwarder quote.

## How the research was done, and its main weakness

- Figures were read from **web-search result summaries** on 20 Nov 2026. The source pages could not be opened from the build environment (network allowlist: `intratec.us`, `chemanalyst.com`, `chemdo.com`, `seatrade-maritime.com` all refused). So a record marked `published` means "as reported in the search summary of that page". Nobody has read the page itself. **Open each link and check before using a number outside this page.**
- Search summaries sometimes paired a title with the wrong URL. Where that happened the title in `sources.ts` follows the URL slug.
- Paid price services (ICIS, Argus, Platts, Polymerupdate, ChemOrbis price tables) hold the numbers this page really needs. Their public pages show no values.

## What the research changed against the brief

**Gulf containers are not sailing round Arabia today.** The brief and the style bible draw Jubail and Sitra by sea through Hormuz, Bab-el-Mandeb and Suez. On 20 Nov 2026 no large container line has services through Hormuz (CNBC citing Drewry, 16 Oct), Maersk lists Dammam, Jubail and Bahrain bookings as suspended (update 51, 8 Oct), and SABIC ships polymer from Jeddah and Yanbu after trucking it across Saudi Arabia.

- Decision: the page has a switch, "Gulf containers travel". Default **Road to Jeddah (now)**: dotted road leg to Jeddah, then sea through Suez. The other setting, **Sea through Hormuz**, is the route the bible describes.
- Alternative considered: default to the bible's route with a warning. Rejected: the default table would rank a route that cannot be booked.
- A red ring marks Hormuz in both settings. Alert red means "waiting or blocked" in the palette; it is a mark, not text.

## Assumptions (alternative considered, and why)

| # | Assumption | Alternative considered | Why this one |
| --- | --- | --- | --- |
| 1 | Resin at origin, Saudi Arabia: 1.10 USD/kg (0.95 to 1.25) | Calibrate so the landed cost equals NTG's 1.37 | Calibrating would make the comparison with NTG circular. Built instead from Intratec 1,160 USD/t (Apr 2026 peak), ChemAnalyst 789 USD/t (Q1 2026) and a trader listing for R50035E at 1,000 to 1,200 USD/t |
| 2 | Northern Europe trader: 1.45 USD/kg (1.22 to 1.70) | Use the April 2026 spike (2,590 USD/t) | The spike had unwound about 40% by July. Middle of the public benchmarks after the spike |
| 3 | "Sitra" is a Gulf trader re-shipping resin: Saudi price + 0.04 USD/kg | Treat Bahrain as a producer origin | No working polyethylene plant in Bahrain was found. Containers would load at Khalifa Bin Salman Port (Hidd); the map marks Sitra as the bible does |
| 4 | Price tiers, all-units: 1 container base; 2 to 3 containers -0.02 USD/kg; 4 or more -0.04 USD/kg | Percentage tiers; no tiers | **No public tier data found.** Only indicator: 4 to 5 US cents/lb (0.09 to 0.11 USD/kg) for large-volume buys in North America, undated. Steps are set well below that |
| 5 | Sea freight per 40 ft: Hamburg 2,000; Jeddah to Beirut 1,600; Jubail round Arabia 1,500; Bahrain 1,700 | Use the Drewry composite (4,305 USD) | No lane rate is public. The composite is for long-haul lanes and would overstate. Wide ranges are recorded |
| 6 | Road to Jeddah per 40 ft: 1,500 from Jubail, 1,900 from Bahrain | Use the Jeddah to UAE crisis rate (4,800 to 5,600 USD) | That rate is for the loaded direction and a longer haul. Range goes up to 4,000 and 4,500 |
| 7 | Beirut port dues and handling 650 USD, truck to plant 200 USD, per 40 ft | Fold into freight | Kept apart because duty is charged on price plus freight only |
| 8 | Container payload 24 t | 24.75 t (public bill-of-lading example) | NTG's own figure (inventory row 10, V) |
| 9 | Air: 2.50 USD/kg from the Gulf, 3.00 from Frankfurt; ordered by the tonne | Leave air out | The bible asks for air arcs. Air is shown to price speed, not as a real way to buy a year of resin |
| 10 | Lead time parts: 10 days supplier; road 4; wait at Jeddah 7; sea 8 (Jeddah), 18 (Jubail), 20 (Bahrain), 22 (Hamburg); Beirut dwell 9; air 3 or 4 plus 3 | Sailing days from distance only | Distance at 14 knots gives 3 to 11 days under way; public door estimates are much longer. The page shows the distance figure as a cross-check |
| 11 | Duty 0% (GAFTA for Arab origin, EU Association Agreement for EU origin) | Use 5% for all | The line rate for HS 3901 was not found. Sources agree on 0 to 5% and on raw-material exemptions. A switch applies 5% |
| 12 | VAT 11% shown, left out of cost | Count it | A registered manufacturer recovers it. A switch counts it |
| 13 | Fixed cost per order 400 USD (30 documents, 150 broker, 150 bank, 70 staff time) | Bank charge as a percentage of value | Only the 30 USD is published. A percentage charge would not be a fixed cost; noted on the record |
| 14 | Holding rate 25% a year | Other rates | Project input, inventory row 93 (S) |
| 15 | Demand = weekly use x 52 | Fewer working weeks | The brief specifies 52. Plant-wide option reads row 7 (11,638 kg in one week), which includes pigment and foam compound |
| 16 | Pipeline stock cost = demand x full lead time x landed cost x holding rate | Transit days only | The brief's formula. It overstates a little: NTG does not own the resin during the supplier's 10 days |
| 17 | No safety stock in the reorder point | Add one | No data on resin demand variability or supplier reliability |
| 18 | Insurance, war-risk premiums, demurrage and currency are left out | Add allowances | No figures found. War-risk premiums matter in 2026 and would add to every Gulf option |
| 19 | NTG's 1.37 USD/kg is treated as a landed price | Treat as FOB | Terms are not recorded (Form 1 §F). The comparison is indicative for this reason |
| 20 | Within a tier the solver tests the whole-container quantities either side of Q* and keeps the cheaper | Round to the nearest | Same or better result; a brute-force test confirms it finds the cheapest whole-container order |

## Confidence in each group of figures

| Figure | Confidence | Reason |
| --- | --- | --- |
| VAT 11% | High | Standard rate, several sources |
| Hormuz and Suez conditions | Medium to high | Several independent reports, the latest dated 10 to 16 Nov 2026 |
| Duty 0% | Medium | Consistent secondary sources; the customs line itself not seen |
| Beirut dwell 9 days; port dues 550 USD | Medium to low | Third-party aggregator; the port site shows conflicting tariff versions |
| Hamburg transit 22 days | Medium to low | Public estimates run from 14 to 38 days |
| Resin price levels | Low | General LLDPE, not rotomoulding grade; latest dated figure is July 2026 |
| All freight rates, sea, road and air | Low | No lane rate is public; each is an assumption beside a nearby figure |
| Price tiers | Very low | Pure assumption |
| Order cost | Low | One of four parts is published |

## What could not be found

- Any price for R50035E or another rotomoulding grade by origin, and any LLDPE price dated after July 2026.
- Per-container price tiers.
- Container rates for Jubail, Bahrain, Jeddah or Hamburg to Beirut; road rates Jubail or Bahrain to Jeddah; air rates to Beirut from Dammam, Riyadh, Bahrain, Hamburg or Frankfurt.
- Carrier schedules (transit days) from the Gulf to Beirut.
- The Lebanese tariff line for HS 3901, and whether the 3% additional customs fee still runs after 2024.
- Customs broker fees and bank charges in Lebanon.

## How to read the result

- The best row (Jubail by sea, 2 containers an order) lands at about 1.245 USD/kg against NTG's 1.37. Its range is 1.04 to 1.58, so **this does not show that NTG overpays.**
- Jubail against Sitra differs only by the assumed 0.04 USD/kg trader margin and 400 USD of road cost. That ordering is not evidence.
- One, two or four containers an order differ by about 1% of the yearly total. The 2-container EOQ exists only because of the assumed price step.
- Sturdier: sea is roughly a third of the cost of air; Gulf resin was cheaper than European on every public benchmark found.

## Map

- Natural Earth 1:50m land (world-atlas, public domain), d3-geo conic conformal, drawn at 1:1 pixels so labels are a true 12 px.
- Sea waypoints are hand-placed. A test samples every sea leg against the land polygons. Three legs are exempt by design: the Suez Canal, the Elbe below Hamburg, and the dotted road legs.
- Air arcs start at the port marks. Dammam and Bahrain airports are within 60 km of them, less than a label's width at this scale. The Hamburg air option goes by road to Frankfurt first.
- Nothing moves until the user selects an option, changes the order quantity or the routing, or presses Replay. With reduced motion the route simply appears and Replay is disabled.
