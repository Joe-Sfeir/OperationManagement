/**
 * Researched figures behind the Sourcing page.
 *
 * Every number here is an ESTIMATE, not a supplier or forwarder quote, and is
 * shown on the page with an S badge. Each record keeps its range, where it
 * came from and the date it was read.
 *
 * How the figures were read (20 Nov 2026): through web-search result
 * summaries. The source pages themselves could not be opened from the build
 * environment, so a figure marked `published` is "as reported in the search
 * summary of that page". Open the link and check before relying on any of them.
 *
 * basis:
 *   published  - the number (or its range) is stated by the source
 *   derived    - built from published numbers; the note says how
 *   assumption - no public figure found; a labelled guess with a range
 */
import type { LonLat } from './model';

export type Basis = 'published' | 'derived' | 'assumption';

export interface SourceRecord {
  id: string;
  label: string;
  value: number;
  unit: string;
  low: number;
  high: number;
  basis: Basis;
  /** What the source says, in a few words. For an assumption: the nearest public evidence, or "No public figure found". */
  sourceTitle: string;
  /** Empty when no public source exists at all. */
  sourceUrl: string;
  /** ISO date the figure was read. */
  retrieved: string;
  note: string;
}

export const RETRIEVED = '2026-11-20';
export const RETRIEVAL_NOTE =
  'Read on 20 Nov 2026 from web-search summaries of the linked pages. The pages themselves could not be opened from the build environment, so check the link before relying on a figure.';

type Draft = Omit<SourceRecord, 'id' | 'retrieved'>;
function records<K extends string>(drafts: Record<K, Draft>): Record<K, SourceRecord> {
  const out = {} as Record<K, SourceRecord>;
  for (const id of Object.keys(drafts) as K[]) out[id] = { id, retrieved: RETRIEVED, ...drafts[id] };
  return out;
}

const NO_SOURCE = 'No public figure found';

const LINK = {
  intratec: 'https://www.intratec.us/solutions/primary-commodity-prices/commodity/lldpe-prices',
  chemanalyst: 'https://www.chemanalyst.com/Pricing-data/lldpe-6',
  chemdo: 'https://chemdo.com/lldpe-r50035e-product',
  imarc: 'https://www.imarcgroup.com/lldpe-pricing-report',
  chemorbisEuropeJul: 'https://www.chemorbis.com/en/premium-plastics-news/European-PE-downtrend-accelerates-as-pricing-power-shifts/2026/07/14/978427',
  chemorbisTurkiyeJun: 'https://www.chemorbis.com/en/premium-plastics-news/Buyer-resistance-fuels-fresh-cuts-in-Turkiye-s-PP-and-PE-markets/2026/06/26/976570',
  canplastics: 'https://www.canplastics.com/features/railcar-to-truck-to-silo/',
  bahrainGuide: 'https://www.trade.gov/country-commercial-guides/bahrain-petrochemicals',
  volza: 'https://www.volza.com/p/container-bag/export/cod-turkey/',
  globyLebanonSaudi: 'https://globy.com/freight-calculator/from-lebanon/to-saudi-arabia',
  globyHamburg: 'https://globy.com/freight-calculator/from-germany/from-hamburg/to-lebanon/to-beirut',
  mscQuote: 'https://data.moverspoe.com/AQS/AQS_OffersFiles/270253/RWQuote.htm',
  fluentBeirutJeddah: 'https://fluentcargo.com/routes/beirut-lb/jeddah-sa',
  fluentBeirutFrankfurt: 'https://www.fluentcargo.com/routes/beirut-lb/frankfurt-de',
  moveconnector: 'https://moveconnector.com/moving-tips/moving-from-dubai-to-beirut-guide',
  loadstarLandbridge: 'https://theloadstar.com/middle-east-landbridge-costs-soar-as-demand-exceeds-supply-4-5-times/',
  loadstarJeddah: 'https://theloadstar.com/jeddah-emerges-as-gulf-supply-chain-lifeline-as-hormuz-closure-reroutes-container-trade/',
  transInfo: 'https://trans.info/en/msc-saudi-landbridge-472744',
  drewryWci: 'https://www.shipuniverse.com/?p=27702',
  portBeirut: 'https://portdebeyrouth.com/en/ContainerHandling',
  cogoportBeirut: 'https://www.cogoport.com/knowledge-center/resources/port-info/LBBEY',
  hapagLebanon: 'https://www.hapag-lloyd.com/content/dam/website/downloads/detention_demurrage/lebanon__locals_new.pdf',
  byblos: 'https://byblos.byblosbank.com/files/Library/Assets/Gallery/PDF/New%20Fees%20&%20Commissions%20Brochure%20-ENG%202026%20.pdf',
  worldAcd: 'https://www.stattimes.com/air-cargo/global-air-cargo-traffic-falls-2-as-rates-continue-to-increase-1361323',
  dhlAir: 'https://www.dhl.com/gb-en/home/global-forwarding/latest-news-and-webinars/air-freight-market-update.html',
  tradeGovLebanon: 'https://www.trade.gov/knowledge-product/lebanon-import-tariff',
  euLebanon: 'https://policy.trade.ec.europa.eu/eu-trade-relationships-country-and-region/countries-and-regions/lebanon_en',
  ahkLebanon: 'https://aegypten.ahk.de/en/regional-offices/lebanon/rechtsberatung/import-and-export-regulations',
  pwcLebanon: 'https://taxsummaries.pwc.com/lebanon/corporate/other-taxes',
  cnbcHormuz: 'https://www.cnbc.com/2026/10/16/strait-hormuz-singapore-ships-attacked.html',
  maerskUpdates: 'https://www.maersk.com/stay-ahead',
  ukmto: 'https://gulfnews.com/world/mena/hormuz-shipping-below-normal-but-not-stalled-ukmto-1.500741839',
  sabicRedSea: 'https://hellenicshippingnews.com/saudi-sabic-shipments-via-red-sea-unaffected-by-mideast-conflict',
  alphalinerSuez: 'https://shipandbunker.com/news/emea/932812-container-lines-shift-63-of-far-east-europe-capacity-back-to-suez-canal-alphaliner',
} as const;

/** Every researched number. Units are in `unit`; prices in USD. */
export const SRC = records({
  // ---------------------------------------------------------------- resin price
  priceSaudi: {
    label: 'Resin at origin, Saudi Arabia (FOB), one container',
    value: 1.1,
    unit: 'USD/kg',
    low: 0.95,
    high: 1.25,
    basis: 'derived',
    sourceTitle: 'Intratec, LLDPE prices: Middle East export spot, FOB Saudi Arabia, 1,160 USD/t in April 2026',
    sourceUrl: LINK.intratec,
    note:
      'No public price for rotomoulding grade R50035E by origin was found. Built from general LLDPE benchmarks: Intratec 1,160 USD/t FOB Saudi Arabia in April 2026, the peak month of the 2026 supply shock; ChemAnalyst about 789 USD/t average for the first quarter of 2026; a trader listing for R50035E at 1,000 to 1,200 USD/t. Import prices in the region fell back by June and producers were pushing increases again in the autumn, so the middle of 0.95 to 1.25 is used. No figure dated after July 2026 was found.',
  },
  priceGulfTrader: {
    label: 'Resin at origin, Gulf trader shipping from Bahrain, one container',
    value: 1.14,
    unit: 'USD/kg',
    low: 1.0,
    high: 1.3,
    basis: 'assumption',
    sourceTitle: 'US Commercial Service, Bahrain petrochemicals guide: ammonia and methanol in production, polyethylene only as a planned project',
    sourceUrl: LINK.bahrainGuide,
    note:
      'No public figure found. The search found no working polyethylene plant in Bahrain, so this option is a trader re-shipping Gulf resin: the Saudi estimate plus 0.04 USD/kg for the trader.',
  },
  priceEurope: {
    label: 'Resin at origin, northern Europe trader (FCA Hamburg), one container',
    value: 1.45,
    unit: 'USD/kg',
    low: 1.22,
    high: 1.7,
    basis: 'derived',
    sourceTitle: 'ChemAnalyst, LLDPE pricing: Germany, about 1,222 USD/t delivered Hamburg, average for the first quarter of 2026',
    sourceUrl: LINK.chemanalyst,
    note:
      'No public rotomoulding-grade price found. European LLDPE in 2026: ChemAnalyst 1,222 USD/t delivered Hamburg (first-quarter average); IMARC 1.32 USD/kg in March; Intratec 2,590 USD/t for C6 film in April (the spike); ChemOrbis reported north-west European film prices about 40% below the early-May peak by mid-July. No figure dated after July 2026 was found.',
  },
  tier2Step: {
    label: 'Price step for 2 to 3 containers in one order',
    value: -0.02,
    unit: 'USD/kg',
    low: -0.04,
    high: 0,
    basis: 'assumption',
    sourceTitle: 'Canadian Plastics, "Railcar to truck to silo": about 4 to 5 US cents per lb saved on large-volume resin buys',
    sourceUrl: LINK.canplastics,
    note:
      'No public per-container price tiers for LLDPE were found. Tiers are an assumption. The only public indicator found is North American and undated: roughly 4 to 5 cents per lb (0.09 to 0.11 USD/kg) between truckload and railcar-volume buying. The steps used here are smaller on purpose.',
  },
  tier3Step: {
    label: 'Price step for 4 or more containers in one order',
    value: -0.04,
    unit: 'USD/kg',
    low: -0.1,
    high: -0.01,
    basis: 'assumption',
    sourceTitle: 'Canadian Plastics, "Railcar to truck to silo": about 4 to 5 US cents per lb saved on large-volume resin buys',
    sourceUrl: LINK.canplastics,
    note: 'No public per-container price tiers for LLDPE were found. See the 2 to 3 container step.',
  },

  // ------------------------------------------------- price benchmarks (evidence)
  benchSaudiApr: {
    label: 'Benchmark: LLDPE export spot, FOB Saudi Arabia, April 2026',
    value: 1160,
    unit: 'USD/t',
    low: 1160,
    high: 1160,
    basis: 'published',
    sourceTitle: 'Intratec, LLDPE prices: Middle East, FOB Saudi Arabia, 1,160 USD/t in April 2026 (up 20% on March)',
    sourceUrl: LINK.intratec,
    note: 'General LLDPE, not rotomoulding grade. April was the peak of the supply shock.',
  },
  benchSaudiQ1: {
    label: 'Benchmark: LLDPE, Saudi Arabia, average for January to March 2026',
    value: 788.67,
    unit: 'USD/t',
    low: 788.67,
    high: 788.67,
    basis: 'published',
    sourceTitle: 'ChemAnalyst, LLDPE pricing, quarter ending March 2026: Saudi Arabia average about 788.67 USD/t',
    sourceUrl: LINK.chemanalyst,
    note: 'Different method from Intratec; the two are not directly comparable.',
  },
  benchR50035E: {
    label: 'Benchmark: trader listing for SABIC R50035E',
    value: 1100,
    unit: 'USD/t',
    low: 1000,
    high: 1200,
    basis: 'published',
    sourceTitle: 'Chemdo, LLDPE R50035E product page: 1,000 to 1,200 USD/t, minimum one 40 ft container, Chinese ports',
    sourceUrl: LINK.chemdo,
    note: 'Undated listing from a trader in China. Another listing at 500 USD/t was ignored as not credible.',
  },
  benchGermanyQ1: {
    label: 'Benchmark: LLDPE delivered Hamburg, average for January to March 2026',
    value: 1222,
    unit: 'USD/t',
    low: 1222,
    high: 1222,
    basis: 'published',
    sourceTitle: 'ChemAnalyst, LLDPE pricing, quarter ending March 2026: Germany about 1,222 USD/t delivered Hamburg',
    sourceUrl: LINK.chemanalyst,
    note: 'General LLDPE, not rotomoulding grade.',
  },
  benchEuropeMar: {
    label: 'Benchmark: LLDPE, Europe, March 2026',
    value: 1.32,
    unit: 'USD/kg',
    low: 1.32,
    high: 1.32,
    basis: 'published',
    sourceTitle: 'IMARC, LLDPE pricing report: Europe 1.32 USD/kg in March 2026',
    sourceUrl: LINK.imarc,
    note: 'General LLDPE.',
  },
  benchEuropeApr: {
    label: 'Benchmark: LLDPE C6 film, Europe, April 2026',
    value: 2590,
    unit: 'USD/t',
    low: 2590,
    high: 2590,
    basis: 'published',
    sourceTitle: 'Intratec, LLDPE prices: C6 film, Europe, 2,590 USD/t in April 2026',
    sourceUrl: LINK.intratec,
    note: 'The spike. By mid-July ChemOrbis had north-west European film about 40% below the early-May peak.',
  },
  benchEuropeJul: {
    label: 'Benchmark: fall in north-west European LLDPE film from the May peak to mid-July 2026',
    value: 40,
    unit: '%',
    low: 40,
    high: 40,
    basis: 'published',
    sourceTitle: 'ChemOrbis, 14 Jul 2026: European PE downtrend accelerates as pricing power shifts',
    sourceUrl: LINK.chemorbisEuropeJul,
    note: 'Headline index move, read from the article summary.',
  },
  benchTurkiyeJun: {
    label: 'Benchmark: import LLDPE film, CIF Türkiye, June 2026',
    value: 1250,
    unit: 'USD/t',
    low: 1100,
    high: 1400,
    basis: 'published',
    sourceTitle: 'ChemOrbis, June 2026: US-origin LLDPE C4 film from 1,400 USD/t CIF early in the month to below 1,100 by late June',
    sourceUrl: LINK.chemorbisTurkiyeJun,
    note: 'Nearest regional import market with public figures. No Lebanon or East Mediterranean price was found.',
  },
  benchVolumeSaving: {
    label: 'Benchmark: saving on large-volume resin buys (North America)',
    value: 0.1,
    unit: 'USD/kg',
    low: 0.09,
    high: 0.11,
    basis: 'published',
    sourceTitle: 'Canadian Plastics, "Railcar to truck to silo": about 4 to 5 US cents per lb',
    sourceUrl: LINK.canplastics,
    note: 'Truckload against railcar volumes, undated. Converted at 2.2046 lb per kg.',
  },

  // ------------------------------------------------------- sea freight, per 40 ft
  seaJubailOpen: {
    label: 'Sea freight, Jubail to Beirut round Arabia',
    value: 1500,
    unit: 'USD per 40 ft',
    low: 900,
    high: 2500,
    basis: 'assumption',
    sourceTitle: 'Globy freight calculator, Lebanon to Saudi Arabia: Hapag-Lloyd 20 ft, Beirut to Dammam, 650 USD (valid to 18 Dec 2025)',
    sourceUrl: LINK.globyLebanonSaudi,
    note:
      'No public rate for this lane and direction was found. The nearest public figure is the reverse lane for a 20 ft from before the 2026 crisis. Large carriers were not taking bookings from Jubail on 20 Nov 2026.',
  },
  seaSitraOpen: {
    label: 'Sea freight, Bahrain to Beirut round Arabia',
    value: 1700,
    unit: 'USD per 40 ft',
    low: 1000,
    high: 2800,
    basis: 'assumption',
    sourceTitle: 'Globy freight calculator, Lebanon to Saudi Arabia: Hapag-Lloyd 20 ft, Beirut to Dammam, 650 USD (valid to 18 Dec 2025)',
    sourceUrl: LINK.globyLebanonSaudi,
    note: 'No public figure found. The Jubail estimate plus 200 USD for the feeder leg from Bahrain to a hub port.',
  },
  roadJubailJeddah: {
    label: 'Road, Jubail to Jeddah, about 1,400 km',
    value: 1500,
    unit: 'USD per 40 ft',
    low: 800,
    high: 4000,
    basis: 'assumption',
    sourceTitle: 'The Loadstar: Middle East landbridge costs soar as demand exceeds supply 4 to 5 times',
    sourceUrl: LINK.loadstarLandbridge,
    note:
      'No public rate for this leg. Nearest public figures are for Jeddah to the UAE: about SAR 4,000 (1,070 USD) before the conflict and SAR 18,000 to 21,000 (4,800 to 5,600 USD) since. Jubail to Jeddah is shorter and runs against the main flow of trucks.',
  },
  roadSitraJeddah: {
    label: 'Road, Bahrain to Jeddah over the causeway',
    value: 1900,
    unit: 'USD per 40 ft',
    low: 1000,
    high: 4500,
    basis: 'assumption',
    sourceTitle: 'The Loadstar: Middle East landbridge costs soar as demand exceeds supply 4 to 5 times',
    sourceUrl: LINK.loadstarLandbridge,
    note:
      'No public figure found. The Jubail estimate plus 400 USD for the causeway and the border. Maersk lists Bahrain export landbridges through Salalah and Khor Fakkan instead; those are not modelled.',
  },
  seaJeddahBeirut: {
    label: 'Sea freight, Jeddah to Beirut through Suez',
    value: 1600,
    unit: 'USD per 40 ft',
    low: 1000,
    high: 3000,
    basis: 'assumption',
    sourceTitle: 'MSC quotation, Beirut to Jeddah: 1,200 USD, 6 days direct (2025)',
    sourceUrl: LINK.mscQuote,
    note:
      'No public 2026 rate found. Nearest: a 2025 MSC quote for the reverse lane, container size not stated. Raised for the 2026 surcharges on Saudi Red Sea ports.',
  },
  seaHamburgBeirut: {
    label: 'Sea freight, Hamburg to Beirut via Gibraltar',
    value: 2000,
    unit: 'USD per 40 ft',
    low: 1300,
    high: 3500,
    basis: 'assumption',
    sourceTitle: 'Drewry World Container Index, 12 Nov 2026: 4,305 USD per 40 ft, composite of long-haul lanes',
    sourceUrl: LINK.drewryWci,
    note:
      'No public rate for this lane was found; freight calculators list it without figures. The Drewry composite covers long-haul east-west lanes and marks an upper level, not this lane. Xeneta put North Europe to the US East Coast at 2,955 USD per 40 ft on 13 Nov 2026.',
  },
  portBeirut: {
    label: 'Port of Beirut dues and handling',
    value: 650,
    unit: 'USD per 40 ft',
    low: 600,
    high: 1150,
    basis: 'derived',
    sourceTitle: 'Port of Beirut tariff: dues on imported containers for local consumption 550 USD per 40 ft; full-container handling 48 to 97 USD',
    sourceUrl: LINK.portBeirut,
    note:
      'The port site shows more than one tariff version and the official PDF could not be opened. The high end adds a forwarder estimate of 350 to 500 USD for terminal handling charged by the carrier.',
  },
  truckBeirutPlant: {
    label: 'Truck, Beirut port to Mazraat Yachouh',
    value: 200,
    unit: 'USD per 40 ft',
    low: 120,
    high: 350,
    basis: 'assumption',
    sourceTitle: NO_SOURCE,
    sourceUrl: '',
    note: 'No public figure found. About 15 km by road.',
  },
  payloadPublic: {
    label: 'Polyethylene in 25 kg bags per 40 ft container',
    value: 24.75,
    unit: 't',
    low: 24,
    high: 26,
    basis: 'published',
    sourceTitle: 'Volza trade records: polyethylene in 25 kg bags, 990 bags (24,750 kg net) on 18 pallets per 40 ft',
    sourceUrl: LINK.volza,
    note: 'Third-party bill-of-lading data, shown for comparison. The model uses the 24 t NTG reports (inventory row 10).',
  },

  // ---------------------------------------------------------- air freight, per kg
  airGulf: {
    label: 'Air freight, Dammam or Bahrain to Beirut',
    value: 2.5,
    unit: 'USD/kg',
    low: 1.2,
    high: 4.3,
    basis: 'assumption',
    sourceTitle: 'WorldACD via STAT Times: global average air cargo rate 3.45 USD/kg in week 45 (2 to 8 Nov 2026)',
    sourceUrl: LINK.worldAcd,
    note:
      'No public rate for this lane. The global average was 3.45 USD/kg; a WorldACD report earlier in 2026 put spot rates from Middle East and South Asia origins at 4.26 USD/kg (week 21, link not pinned). Short regional sectors usually price below the long-haul average. DHL reported Gulf gateway capacity still below pre-crisis levels in September 2026.',
  },
  airFrankfurt: {
    label: 'Air freight, Frankfurt to Beirut',
    value: 3,
    unit: 'USD/kg',
    low: 2,
    high: 4.5,
    basis: 'assumption',
    sourceTitle: 'WorldACD via STAT Times: global average air cargo rate 3.45 USD/kg in week 45 (2 to 8 Nov 2026)',
    sourceUrl: LINK.worldAcd,
    note:
      'No public rate for this lane. Europe-origin spot rates averaged 2.71 USD/kg in WorldACD data for November 2024; the 2026 global average is 3.45. Cargo is trucked from Hamburg to Frankfurt.',
  },
  airBeirutHandling: {
    label: 'Beirut airport handling and truck to the plant',
    value: 0.1,
    unit: 'USD/kg',
    low: 0.05,
    high: 0.2,
    basis: 'assumption',
    sourceTitle: NO_SOURCE,
    sourceUrl: '',
    note: 'No public figure found.',
  },
  benchAirGlobal: {
    label: 'Benchmark: global average air cargo rate, week 45 of 2026',
    value: 3.45,
    unit: 'USD/kg',
    low: 3.45,
    high: 3.45,
    basis: 'published',
    sourceTitle: 'WorldACD via STAT Times: 3.45 USD/kg in week 45 (2 to 8 Nov 2026), up 2% on the week',
    sourceUrl: LINK.worldAcd,
    note: 'All lanes and products.',
  },

  // ------------------------------------------------------------- lead time, days
  leadSupplier: {
    label: 'Order confirmed to cargo leaving the origin',
    value: 10,
    unit: 'days',
    low: 5,
    high: 21,
    basis: 'assumption',
    sourceTitle: NO_SOURCE,
    sourceUrl: '',
    note: 'No public figure found. Covers allocation, loading and booking. A trader with stock can be faster than a producer.',
  },
  transitJubailOpen: {
    label: 'At sea and in transshipment, Jubail to Beirut round Arabia',
    value: 18,
    unit: 'days',
    low: 14,
    high: 25,
    basis: 'derived',
    sourceTitle: 'MoveConnector, Dubai to Beirut guide (2026): water leg 12 to 18 days through a Mediterranean transshipment hub',
    sourceUrl: LINK.moveconnector,
    note:
      'No carrier schedule for this lane was found. Jebel Ali to Beirut is given as 12 to 18 days with one transshipment; Jubail lies further up the Gulf. Days under way alone, from the route drawn on the map, are fewer: the rest is port and transshipment time.',
  },
  transitSitraOpen: {
    label: 'At sea and in transshipment, Bahrain to Beirut round Arabia',
    value: 20,
    unit: 'days',
    low: 15,
    high: 27,
    basis: 'derived',
    sourceTitle: 'MoveConnector, Dubai to Beirut guide (2026): water leg 12 to 18 days through a Mediterranean transshipment hub',
    sourceUrl: LINK.moveconnector,
    note: 'The Jubail estimate plus 2 days for the feeder from Bahrain to a hub port. No carrier schedule found.',
  },
  transitHamburg: {
    label: 'At sea and in transshipment, Hamburg to Beirut via Gibraltar',
    value: 22,
    unit: 'days',
    low: 14,
    high: 38,
    basis: 'published',
    sourceTitle: 'Globy freight calculator, Hamburg to Beirut: Maersk option, 22 days',
    sourceUrl: LINK.globyHamburg,
    note:
      'Public estimates disagree: Fluent Cargo about 14.5 days; Globy (Maersk) 22; Germangate 21 to 25; Agora Freight 27 to 38. This route does not use the Red Sea or Suez.',
  },
  transitRoadJeddah: {
    label: 'On the road, Gulf coast to Jeddah',
    value: 4,
    unit: 'days',
    low: 3,
    high: 7,
    basis: 'assumption',
    sourceTitle: 'trans.info: MSC Saudi landbridge, about 1,300 km between Jeddah and Dammam',
    sourceUrl: LINK.transInfo,
    note: 'No public transit time. The distance is 1,300 to 1,400 km: two days of driving plus gate and booking time.',
  },
  waitJeddah: {
    label: 'Waiting for a truck and a vessel at Jeddah',
    value: 7,
    unit: 'days',
    low: 3,
    high: 14,
    basis: 'assumption',
    sourceTitle: 'The Loadstar: Jeddah emerges as Gulf supply chain lifeline as Hormuz closure reroutes container trade',
    sourceUrl: LINK.loadstarJeddah,
    note: 'No public figure. Reports describe congestion at Jeddah and haulage rates at historic highs. This allowance is a guess.',
  },
  transitJeddahBeirut: {
    label: 'At sea, Jeddah to Beirut through Suez',
    value: 8,
    unit: 'days',
    low: 6,
    high: 14,
    basis: 'derived',
    sourceTitle: 'Fluent Cargo, Beirut to Jeddah by container ship: about 5 days 6 hours (reverse direction)',
    sourceUrl: LINK.fluentBeirutJeddah,
    note:
      'Reverse-direction figures: Fluent Cargo 5 days 6 hours; an MSC quote from 2025, 6 days direct. Services listed from Jeddah to Beirut go through a transshipment port, so 8 days is used.',
  },
  dwellBeirut: {
    label: 'Beirut port: container dwell before release',
    value: 9,
    unit: 'days',
    low: 7,
    high: 14,
    basis: 'published',
    sourceTitle: 'Cogoport, Beirut port profile: average import dwell 8.7 days in February 2026, 12.0 days in January 2026',
    sourceUrl: LINK.cogoportBeirut,
    note: 'Third-party aggregator, not port statistics. Taken to include customs clearance.',
  },
  transitAirGulf: {
    label: 'Air from the Gulf: booking, handling and flight',
    value: 3,
    unit: 'days',
    low: 2,
    high: 6,
    basis: 'assumption',
    sourceTitle: 'DHL Global Forwarding, air freight market update, September 2026: capacity on Gulf gateway lanes below pre-crisis levels',
    sourceUrl: LINK.dhlAir,
    note: 'No public door-to-airport time found. The flight itself is a few hours.',
  },
  transitAirFrankfurt: {
    label: 'Air via Frankfurt: truck from Hamburg, booking, handling and flight',
    value: 4,
    unit: 'days',
    low: 3,
    high: 7,
    basis: 'assumption',
    sourceTitle: 'Fluent Cargo, Beirut to Frankfurt: direct flight 4 h 17 min',
    sourceUrl: LINK.fluentBeirutFrankfurt,
    note: 'No public door-to-airport time found. One day by truck to Frankfurt is included.',
  },
  clearAir: {
    label: 'Beirut airport: clearance and release',
    value: 3,
    unit: 'days',
    low: 2,
    high: 5,
    basis: 'assumption',
    sourceTitle: NO_SOURCE,
    sourceUrl: '',
    note: 'No public figure found.',
  },
  shipSpeed: {
    label: 'Container ship speed, to turn route length into days under way',
    value: 14,
    unit: 'knots',
    low: 12,
    high: 18,
    basis: 'assumption',
    sourceTitle: NO_SOURCE,
    sourceUrl: '',
    note: 'No figure from a carrier. A common slow-steaming speed, used only for the cross-check shown beside each sea transit time.',
  },

  // ------------------------------------------------------------- duty and VAT, %
  dutyArab: {
    label: 'Customs duty, Arab origin under GAFTA',
    value: 0,
    unit: '%',
    low: 0,
    high: 5,
    basis: 'published',
    sourceTitle: 'US Commercial Service, Lebanon import tariffs: goods from Arab countries exempt under the Greater Arab Free Trade Area',
    sourceUrl: LINK.tradeGovLebanon,
    note:
      'The Lebanese line rate for HS 3901 (polyethylene in primary forms) was not found. Sources agree that industrial goods carry 0 to 5%, that raw materials for licensed manufacturers are exempt, and that Arab-origin goods are exempt with a certificate of origin. The high end is the 5% ceiling if the preference is refused.',
  },
  dutyEu: {
    label: 'Customs duty, EU origin under the EU-Lebanon Association Agreement',
    value: 0,
    unit: '%',
    low: 0,
    high: 5,
    basis: 'published',
    sourceTitle: 'European Commission, EU trade relations with Lebanon: EU industrial products enter Lebanon free of customs duties',
    sourceUrl: LINK.euLebanon,
    note:
      'Needs proof of EU origin. Resin held by a Hamburg trader may not be made in the EU; without proof the general rate of 0 to 5% applies.',
  },
  dutyCeiling: {
    label: 'Customs duty if no preference is granted: top of the general range',
    value: 5,
    unit: '%',
    low: 0,
    high: 5,
    basis: 'published',
    sourceTitle: 'German-Arab Chamber of Industry and Commerce, Lebanon import regulations: tariffs on industrial goods range from 0 to 5%',
    sourceUrl: LINK.ahkLebanon,
    note: 'Used for the worst-case switch. The actual line rate for HS 3901 was not found and may be 0%.',
  },
  extraCustomsFee: {
    label: 'Additional 3% customs fee, as applied to manufacturing raw materials',
    value: 0,
    unit: '%',
    low: 0,
    high: 3,
    basis: 'published',
    sourceTitle: 'PwC Tax Summaries, Lebanon, other taxes: 3% additional customs fee extended to 31 Dec 2024, raw materials for industry excluded',
    sourceUrl: LINK.pwcLebanon,
    note: 'Whether the fee runs beyond 2024 was not confirmed. Raw materials for manufacturing were excluded in every version found, so 0% is used.',
  },
  vat: {
    label: 'VAT on imports, on customs value plus duty',
    value: 11,
    unit: '%',
    low: 11,
    high: 11,
    basis: 'published',
    sourceTitle: 'PwC Tax Summaries, Lebanon, other taxes: standard VAT rate 11%',
    sourceUrl: LINK.pwcLebanon,
    note: 'A VAT-registered manufacturer recovers import VAT against the VAT on its sales, so it is a cash-flow item, not a cost. Left out unless the switch is on.',
  },

  // ------------------------------------------------------ fixed cost per order
  orderDocs: {
    label: 'Carrier documentation and delivery-order fees, per bill of lading',
    value: 30,
    unit: 'USD per order',
    low: 17,
    high: 50,
    basis: 'published',
    sourceTitle: 'Hapag-Lloyd, Lebanon local charges: documentation fee 10 USD, delivery order fee 7 to 40 USD per bill of lading (from 21 Apr 2026)',
    sourceUrl: LINK.hapagLebanon,
    note: 'One carrier; 11% VAT on top.',
  },
  orderBroker: {
    label: 'Customs broker, per declaration',
    value: 150,
    unit: 'USD per order',
    low: 100,
    high: 300,
    basis: 'assumption',
    sourceTitle: NO_SOURCE,
    sourceUrl: '',
    note: 'No public figure found. Courier guides describe the service without prices.',
  },
  orderBank: {
    label: 'Bank charges, per payment',
    value: 150,
    unit: 'USD per order',
    low: 50,
    high: 500,
    basis: 'assumption',
    sourceTitle: 'Byblos Bank, fees and commissions brochure 2026: import documentary credit section (amounts not read)',
    sourceUrl: LINK.byblos,
    note:
      'No figure could be read from the brochure. A documentary credit is usually charged as a percentage of the amount, which grows with order size; a flat amount is used here.',
  },
  orderAdmin: {
    label: 'NTG staff time, per order',
    value: 70,
    unit: 'USD per order',
    low: 30,
    high: 150,
    basis: 'assumption',
    sourceTitle: NO_SOURCE,
    sourceUrl: '',
    note: 'No figure from NTG. A few hours of purchasing and receiving work.',
  },
});

export type SrcKey = keyof typeof SRC;
export const ALL_RECORDS: SourceRecord[] = Object.values(SRC);

/** Fixed cost of placing and receiving one order, whatever its size. */
export const ORDER_COST_LINES: SourceRecord[] = [SRC.orderDocs, SRC.orderBroker, SRC.orderBank, SRC.orderAdmin];
export const ORDER_COST_USD = ORDER_COST_LINES.reduce((s, r) => s + r.value, 0);

// ------------------------------------------------------------- route conditions

/** A dated statement about a route, not a number used in the arithmetic. */
export interface ConditionNote {
  id: string;
  text: string;
  sourceTitle: string;
  sourceUrl: string;
  retrieved: string;
}

export const CONDITIONS: ConditionNote[] = [
  {
    id: 'hormuz-lines',
    text: 'Strait of Hormuz: none of the large container lines has resumed services through the strait since February 2026. Regional operators run occasional small ships.',
    sourceTitle: 'CNBC, 16 Oct 2026, citing Drewry',
    sourceUrl: LINK.cnbcHormuz,
    retrieved: RETRIEVED,
  },
  {
    id: 'maersk-bookings',
    text: 'Maersk lists bookings to and from Dammam and Jubail as suspended, with Jeddah and King Abdullah Port open (operational update 51, 8 Oct 2026). Bahrain bookings are also suspended.',
    sourceTitle: 'Maersk, Middle East operational updates',
    sourceUrl: LINK.maerskUpdates,
    retrieved: RETRIEVED,
  },
  {
    id: 'hormuz-traffic',
    text: 'All ship types: 170 outbound and 155 inbound transits in the week to 10 Nov 2026, "below normal, but not stalled".',
    sourceTitle: 'Gulf News, reporting UKMTO',
    sourceUrl: LINK.ukmto,
    retrieved: RETRIEVED,
  },
  {
    id: 'sabic-red-sea',
    text: 'SABIC moves polymer by road from the east coast and ships it from Jeddah and Yanbu on the Red Sea; the volume moved west more than doubled in the second quarter of 2026.',
    sourceTitle: 'Hellenic Shipping News: Saudi SABIC shipments via Red Sea unaffected by Mideast conflict',
    sourceUrl: LINK.sabicRedSea,
    retrieved: RETRIEVED,
  },
  {
    id: 'suez',
    text: 'Red Sea and Suez: 63% of Far East to Europe container capacity was back on the Suez route between 15 Sep and 15 Oct 2026; a full return is expected in early 2027. Hamburg to Beirut does not use Suez.',
    sourceTitle: 'Ship & Bunker, 21 Oct 2026, citing Alphaliner',
    sourceUrl: LINK.alphalinerSuez,
    retrieved: RETRIEVED,
  },
];

// ---------------------------------------------------------------------- options

export type SourceId = 'jubail' | 'sitra' | 'hamburg';
export type Mode = 'sea' | 'air';
export type OptionId = `${SourceId}-${Mode}`;
/** How Gulf cargo reaches the Red Sea. */
export type GulfRouting = 'jeddah' | 'hormuz';

export const SOURCE_NAME: Record<SourceId, { place: string; supplier: string }> = {
  jubail: { place: 'Jubail', supplier: 'SABIC or another Saudi producer' },
  sitra: { place: 'Sitra', supplier: 'Gulf trader shipping from Bahrain' },
  hamburg: { place: 'Hamburg', supplier: 'Northern Europe trader' },
};

export interface OptionSpec {
  id: OptionId;
  source: SourceId;
  mode: Mode;
  /** Tier-1 price at origin. */
  price: SourceRecord;
  /** Freight to the Beirut port or airport. Sea: USD per 40 ft. Air: USD/kg. Counted in the customs value. */
  freight: SourceRecord[];
  /** Charges after customs. Sea: USD per 40 ft. Air: USD/kg. */
  destination: SourceRecord[];
  /** Lead-time parts in days, in order. */
  lead: SourceRecord[];
  /** Duty with the origin preference granted. */
  duty: SourceRecord;
  /** One line on what the route is, for the detail panel. */
  routeNote: string;
}

const PRICE: Record<SourceId, SourceRecord> = {
  jubail: SRC.priceSaudi,
  sitra: SRC.priceGulfTrader,
  hamburg: SRC.priceEurope,
};
const DUTY: Record<SourceId, SourceRecord> = { jubail: SRC.dutyArab, sitra: SRC.dutyArab, hamburg: SRC.dutyEu };

export const OPTION_IDS: OptionId[] = ['jubail-sea', 'sitra-sea', 'hamburg-sea', 'jubail-air', 'sitra-air', 'hamburg-air'];

export function optionSpec(id: OptionId, routing: GulfRouting): OptionSpec {
  const [source, mode] = id.split('-') as [SourceId, Mode];
  const base = { id, source, mode, price: PRICE[source], duty: DUTY[source] };
  if (mode === 'air') {
    const gulf = source !== 'hamburg';
    return {
      ...base,
      freight: [gulf ? SRC.airGulf : SRC.airFrankfurt],
      destination: [SRC.airBeirutHandling],
      lead: [SRC.leadSupplier, gulf ? SRC.transitAirGulf : SRC.transitAirFrankfurt, SRC.clearAir],
      routeNote:
        source === 'jubail'
          ? 'By air from Dammam airport, 60 km from Jubail, to Beirut airport.'
          : source === 'sitra'
            ? 'By air from Bahrain airport to Beirut airport.'
            : 'By truck from Hamburg to Frankfurt, then by air to Beirut airport.',
    };
  }
  const destination = [SRC.portBeirut, SRC.truckBeirutPlant];
  if (source === 'hamburg') {
    return {
      ...base,
      freight: [SRC.seaHamburgBeirut],
      destination,
      lead: [SRC.leadSupplier, SRC.transitHamburg, SRC.dwellBeirut],
      routeNote: 'Down the Elbe, through the Channel and Gibraltar, then the length of the Mediterranean. No Suez, no Red Sea.',
    };
  }
  if (routing === 'jeddah') {
    return {
      ...base,
      freight: [source === 'jubail' ? SRC.roadJubailJeddah : SRC.roadSitraJeddah, SRC.seaJeddahBeirut],
      destination,
      lead: [SRC.leadSupplier, SRC.transitRoadJeddah, SRC.waitJeddah, SRC.transitJeddahBeirut, SRC.dwellBeirut],
      routeNote:
        'By road across Saudi Arabia to Jeddah, then by sea up the Red Sea and through Suez. This is how Gulf containers were moving on 20 Nov 2026.',
    };
  }
  return {
    ...base,
    freight: [source === 'jubail' ? SRC.seaJubailOpen : SRC.seaSitraOpen],
    destination,
    lead: [SRC.leadSupplier, source === 'jubail' ? SRC.transitJubailOpen : SRC.transitSitraOpen, SRC.dwellBeirut],
    routeNote:
      'By sea through Hormuz, round Arabia, through Bab-el-Mandeb, the Red Sea and Suez. Large carriers were not offering this on 20 Nov 2026.',
  };
}

/** All-units price schedule: thresholds in containers per order, steps against the one-container price. */
export const PRICE_TIERS: { minContainers: number; label: string; step: SourceRecord | null }[] = [
  { minContainers: 1, label: '1 container', step: null },
  { minContainers: 2, label: '2 to 3 containers', step: SRC.tier2Step },
  { minContainers: 4, label: '4 or more', step: SRC.tier3Step },
];

/** Air cargo is ordered by the tonne; anything under two container loads pays the one-container price. */
export const AIR_LOT_KG = 1000;

// -------------------------------------------------------------- map geometry
// Hand-placed, not researched. Sea waypoints are checked against the Natural
// Earth 1:50m land polygons in model.test.ts so no sea leg crosses land.

export const PLACE = {
  beirut: [35.5, 33.9],
  jubail: [49.72, 27.07],
  sitra: [50.66, 26.16],
  hamburg: [9.97, 53.54],
  frankfurt: [8.57, 50.03],
  jeddah: [39.1, 21.47],
  hormuz: [56.45, 26.55],
  babElMandeb: [43.33, 12.58],
  suez: [32.4, 30.6],
  gibraltar: [-5.6, 35.93],
} as const satisfies Record<string, LonLat>;

export type LegKind =
  /** Open water: must not cross land. */
  | 'sea'
  /** Suez Canal: drawn like sea, crosses the isthmus by design. */
  | 'canal'
  /** River Elbe below Hamburg: drawn like sea, too narrow for the land polygons. */
  | 'river'
  | 'road'
  | 'air';

export interface RouteLeg {
  kind: LegKind;
  points: LonLat[];
}

const GULF_TO_RED_SEA: LonLat[] = [
  [51.9, 26.95], [53.6, 26.1], [55.3, 26.15], [56.2, 26.5], [56.62, 26.52], [57.1, 25.7], [58.4, 24.6],
  [59.7, 23.4], [60.3, 22.3], [59.7, 20.2], [58.7, 18.4], [57.4, 17.1], [55.0, 15.9], [52.5, 14.8],
  [49.5, 13.5], [46.5, 12.4], [44.6, 12.0], [43.6, 12.35], [43.33, 12.58], [43.18, 12.98], [42.42, 13.8],
  [42.05, 14.8], [41.1, 16.3], [40.0, 18.2], [38.7, 20.3],
];
const RED_SEA_NORTH: LonLat[] = [
  [37.6, 22.4], [36.4, 24.4], [35.0, 26.4], [34.0, 27.55], [33.55, 28.1], [33.0, 28.9], [32.62, 29.6], [32.56, 29.93],
];
const SUEZ_CANAL: LonLat[] = [[32.56, 29.93], [32.33, 30.55], [32.31, 31.27]];
const PORT_SAID_TO_BEIRUT: LonLat[] = [[32.31, 31.27], [32.5, 31.7], [34.0, 32.8], [35.1, 33.75], PLACE.beirut];
const ELBE: LonLat[] = [PLACE.hamburg, [9.4, 53.85], [8.6, 53.97]];
const HAMBURG_TO_BEIRUT: LonLat[] = [
  [8.6, 53.97], [7.6, 54.15], [5.0, 53.8], [3.9, 53.2], [3.0, 52.2], [2.2, 51.5], [1.55, 51.03], [0.3, 50.4],
  [-1.8, 50.1], [-3.8, 49.7], [-5.9, 48.7], [-10.0, 43.5], [-10.1, 38.7], [-9.6, 36.8], [-7.0, 36.1],
  [-5.6, 35.93], [-4.0, 36.1], [-1.5, 36.3], [3.0, 37.4], [8.0, 37.75], [10.3, 37.6], [11.4, 37.35],
  [13.5, 36.6], [15.0, 36.2], [19.0, 35.6], [23.0, 34.55], [26.5, 34.4], [30.0, 34.0], [33.0, 34.1],
  [34.8, 33.9], PLACE.beirut,
];
const ROAD_JUBAIL_JEDDAH: LonLat[] = [PLACE.jubail, [49.9, 26.5], [46.7, 24.7], [43.0, 23.0], [40.4, 21.35], PLACE.jeddah];
const ROAD_SITRA_JEDDAH: LonLat[] = [PLACE.sitra, [50.2, 26.25], [49.9, 26.5], [46.7, 24.7], [43.0, 23.0], [40.4, 21.35], PLACE.jeddah];
const JEDDAH_TO_RED_SEA: LonLat[] = [PLACE.jeddah, [38.3, 21.6]];

/** The legs of one option's route, origin first, ending at Beirut. */
export function routeLegs(id: OptionId, routing: GulfRouting): RouteLeg[] {
  const [source, mode] = id.split('-') as [SourceId, Mode];
  if (mode === 'air') {
    if (source === 'hamburg') {
      return [
        { kind: 'road', points: [PLACE.hamburg, PLACE.frankfurt] },
        { kind: 'air', points: [PLACE.frankfurt, PLACE.beirut] },
      ];
    }
    return [{ kind: 'air', points: [PLACE[source], PLACE.beirut] }];
  }
  if (source === 'hamburg') {
    return [
      { kind: 'river', points: ELBE },
      { kind: 'sea', points: HAMBURG_TO_BEIRUT },
    ];
  }
  const lastLegs: RouteLeg[] = [
    { kind: 'canal', points: SUEZ_CANAL },
    { kind: 'sea', points: PORT_SAID_TO_BEIRUT },
  ];
  if (routing === 'jeddah') {
    return [
      { kind: 'road', points: source === 'jubail' ? ROAD_JUBAIL_JEDDAH : ROAD_SITRA_JEDDAH },
      { kind: 'sea', points: [...JEDDAH_TO_RED_SEA, ...RED_SEA_NORTH] },
      ...lastLegs,
    ];
  }
  const leaveGulf: LonLat[] =
    source === 'jubail' ? [PLACE.jubail, [50.5, 27.35]] : [PLACE.sitra, [50.78, 26.4], [50.98, 26.78]];
  return [{ kind: 'sea', points: [...leaveGulf, ...GULF_TO_RED_SEA, ...RED_SEA_NORTH] }, ...lastLegs];
}
