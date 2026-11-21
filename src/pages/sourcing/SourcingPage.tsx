/**
 * Sourcing page: routes into Beirut and a short buying table.
 *
 * Follows docs/STYLE_BIBLE.md, "Sourcing map and dashboard chrome", trimmed
 * after the team review to what the owner needs: the map, a few controls, five
 * columns and one line of advice. Every figure still comes from ./sources.ts
 * (researched estimates, tag S) and keeps its source as a hover title; the
 * letters show when "Sources" is on in the top bar. The breakdown and links sit
 * behind "Sources and details". The arithmetic is in ./model.ts; assumptions
 * and route conditions are in ./NOTES.md.
 *
 * Nothing on the map moves by itself. The route draws and the ship or plane
 * mark crosses once when the user picks an option, changes the order quantity
 * or the Gulf routing, or presses Replay.
 */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { geoConicConformal, geoGraticule10, geoPath, type GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { MultiPolygon, Position } from 'geojson';
import landTopo from 'world-atlas/land-50m.json';
import { easeInOutCubic, font, neutral, palette } from '../../design/tokens';
import { Button, Num, Panel, Segmented, fmt, sourceTitle } from '../../ui/kit';
import { P, inventoryRows, numbers } from '../../data/params';
import {
  evaluate,
  landedCost,
  rankByTotal,
  solveOption,
  travelMs,
  type OptionResult,
  type Ranked,
  type Scenario,
} from './model';
import {
  AIR_LOT_KG,
  OPTION_IDS,
  ORDER_COST_USD,
  PLACE,
  PRICE_TIERS,
  SOURCE_NAME,
  SRC,
  optionSpec,
  routeLegs,
  type GulfRouting,
  type LegKind,
  type OptionId,
  type OptionSpec,
  type SourceRecord,
} from './sources';

// ------------------------------------------------------------------ NTG inputs

const WEEKS_PER_YEAR = 52;
const PAYLOAD_KG = P.deliveryLotT.value * 1000;
const NTG_PRICE = P.resinPriceUsdKg.value;
/** Inventory row 11 gives 1.5 months; 30 days to the month. */
const NTG_LEAD_DAYS = Math.round(P.replenishLeadMonths.value * 30);
const TANKS_T_PER_YEAR = P.weeklyResinT.value * WEEKS_PER_YEAR;

const plantRow = inventoryRows.find((r) => r.row === 7);
const PLANT_KG_PER_WEEK = plantRow ? (numbers(plantRow.value)[0] ?? 0) : 0;
const PLANT_T_PER_YEAR = (PLANT_KG_PER_WEEK * WEEKS_PER_YEAR) / 1000;
const plantTitle = plantRow
  ? `${plantRow.parameter}. Inventory row 7: ${plantRow.source}. Confidence: ${plantRow.confidence}`
  : undefined;

type DemandMode = 'tanks' | 'plant' | 'custom';
type QtyMode = 'eoq' | 'fixed';

// ------------------------------------------------------------------- utilities

const sum = (rs: { value: number }[]) => rs.reduce((s, r) => s + r.value, 0);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const tonnes = (kg: number, digits = 0) => fmt(kg / 1000, digits);
const usdK = (usd: number) => fmt(Math.round(usd / 1000) * 1000);

const BASIS_LABEL: Record<SourceRecord['basis'], string> = {
  published: 'Published figure',
  derived: 'Built from published figures',
  assumption: 'Assumption: no public figure found',
};

function rangeText(r: SourceRecord): string {
  const d = r.unit === 'USD/kg' ? 2 : Number.isInteger(r.value) && Number.isInteger(r.low) && Number.isInteger(r.high) ? 0 : 2;
  return r.low === r.high ? `${fmt(r.value, d)} ${r.unit}` : `${fmt(r.low, d)} to ${fmt(r.high, d)} ${r.unit}`;
}

function recordTitle(r: SourceRecord): string {
  return `${r.label}. ${BASIS_LABEL[r.basis]}. Range ${rangeText(r)}. Source: ${r.sourceTitle}. Read ${r.retrieved}.`;
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function optionName(id: OptionId): string {
  const [source, mode] = id.split('-') as [keyof typeof SOURCE_NAME, 'sea' | 'air'];
  return `${SOURCE_NAME[source].place}, ${mode}`;
}

function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** A researched figure: value in Plex Mono, tag S, source as the hover title. */
function Est({ rec, value, unit, size = '14' }: { rec: SourceRecord; value: ReactNode; unit?: string; size?: '12' | '14' | '28' }) {
  return <Num value={value} unit={unit} tag="S" title={recordTitle(rec)} size={size} />;
}

/** A figure worked out on this page from the estimates: tag S, no single source. */
function Calc({ value, unit, title, size = '14' }: { value: ReactNode; unit?: string; title: string; size?: '12' | '14' | '28' }) {
  return <Num value={value} unit={unit} tag="S" title={title} size={size} />;
}

// --------------------------------------------------------------------- the map

const topo = landTopo as unknown as Topology<{ land: GeometryCollection }>;

/** Land polygons near the map only, so each redraw projects a few hundred rings instead of the whole world. */
const LAND: MultiPolygon = (() => {
  const coordinates: Position[][][] = [];
  for (const f of feature(topo, topo.objects.land).features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const rings of polys) {
      const outer = rings[0];
      if (!outer) continue;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of outer) {
        const x = c[0] ?? 0;
        const y = c[1] ?? 0;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      if (x1 < -40 || x0 > 95 || y1 < -12 || y0 > 75) continue;
      coordinates.push(rings);
    }
  }
  return { type: 'MultiPolygon', coordinates };
})();

/** Every point any route touches: the map is fitted to these. */
const FIT_POINTS: Position[] = (() => {
  const pts: Position[] = Object.values(PLACE).map((p) => [p[0], p[1]]);
  for (const routing of ['jeddah', 'hormuz'] as const)
    for (const id of OPTION_IDS) for (const leg of routeLegs(id, routing)) for (const p of leg.points) pts.push([p[0], p[1]]);
  return pts;
})();

type XY = [number, number];

interface DrawnLeg {
  kind: LegKind;
  pts: XY[];
}

interface DrawnRoute {
  id: OptionId;
  legs: DrawnLeg[];
}

function toPath(pts: XY[]): string {
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
}

/** An air leg as a shallow arc, bowed to the upper side so it stays clear of the sea lanes. */
function arc(a: XY, b: XY, bow: number): XY[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const cx = (a[0] + b[0]) / 2 + nx * len * bow;
  const cy = (a[1] + b[1]) / 2 + ny * len * bow;
  const out: XY[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]);
  }
  return out;
}

const AIR_BOW: Record<OptionId, number> = {
  'jubail-air': 0.2,
  'sitra-air': 0.3,
  'hamburg-air': 0.16,
  'jubail-sea': 0,
  'sitra-sea': 0,
  'hamburg-sea': 0,
};

function drawRoute(id: OptionId, routing: GulfRouting, project: GeoProjection): DrawnRoute {
  const xy = (p: readonly [number, number]): XY => project([p[0], p[1]]) ?? [0, 0];
  const legs = routeLegs(id, routing).map((leg): DrawnLeg => {
    const pts = leg.points.map(xy);
    if (leg.kind === 'air') {
      const a = pts[0] ?? [0, 0];
      const b = pts[pts.length - 1] ?? a;
      return { kind: leg.kind, pts: arc(a, b, AIR_BOW[id]) };
    }
    return { kind: leg.kind, pts };
  });
  return { id, legs };
}

/** Walk a drawn route: the point, heading and leg at a distance along it. */
function measure(route: DrawnRoute) {
  const segs: { a: XY; b: XY; start: number; len: number; kind: LegKind }[] = [];
  let total = 0;
  for (const leg of route.legs) {
    for (let i = 1; i < leg.pts.length; i++) {
      const a = leg.pts[i - 1] as XY;
      const b = leg.pts[i] as XY;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len === 0) continue;
      segs.push({ a, b, start: total, len, kind: leg.kind });
      total += len;
    }
  }
  const at = (dist: number) => {
    const d = clamp(dist, 0, total);
    let s = segs[0];
    for (const seg of segs) {
      s = seg;
      if (d <= seg.start + seg.len) break;
    }
    if (!s) return { x: 0, y: 0, angle: 0, kind: 'sea' as LegKind };
    const t = clamp((d - s.start) / s.len, 0, 1);
    return {
      x: s.a[0] + (s.b[0] - s.a[0]) * t,
      y: s.a[1] + (s.b[1] - s.a[1]) * t,
      angle: (Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]) * 180) / Math.PI,
      kind: s.kind,
    };
  };
  return { total, at };
}

const LEG_STROKE: Record<LegKind, { dash?: string; cap: 'butt' | 'round' }> = {
  sea: { cap: 'round' },
  canal: { cap: 'round' },
  river: { cap: 'round' },
  road: { dash: '0.1 4.5', cap: 'round' },
  air: { dash: '7 4', cap: 'butt' },
};

type MarkKind = 'ship' | 'plane' | 'truck';
const markFor = (k: LegKind): MarkKind => (k === 'air' ? 'plane' : k === 'road' ? 'truck' : 'ship');

/** Simple marks drawn for this page, nose towards +x. */
const MARK_PATH: Record<MarkKind, string> = {
  ship: 'M-7 -3.2H3L8 0L3 3.2H-7Z',
  plane: 'M9 0L2 -1.5L-2 -7.5H-4.5L-2.6 -1.5L-6.5 -1.2L-8 -3.6H-9.6L-8.8 0L-9.6 3.6H-8L-6.5 1.2L-2.6 1.5L-4.5 7.5H-2L2 1.5Z',
  truck: 'M-6 -3.2H2V3.2H-6ZM3 -2.4H6.2V2.4H3Z',
};

const DRAW_MS = 700;
/** Where the mark comes to rest: just short of the Beirut ring. */
const PARK_PX = 15;

interface MapLabel {
  key: string;
  at: readonly [number, number];
  text: string;
  dx: number;
  dy: number;
  anchor: 'start' | 'middle' | 'end';
  /** port: an origin or Beirut. passage: a strait or canal on the way. */
  tone: 'port' | 'passage';
  dot: boolean;
}

function RouteMap({
  rows,
  selectedId,
  bestId,
  routing,
  leadDays,
  playToken,
  reducedMotion,
  describedBy,
  onSelect,
}: {
  rows: Row[];
  selectedId: OptionId;
  bestId: OptionId;
  routing: GulfRouting;
  leadDays: number;
  /** Changes when the user does something that should replay the route. 0 on first render: no motion. */
  playToken: number;
  reducedMotion: boolean;
  describedBy: string;
  onSelect: (id: OptionId) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => setWidth(Math.floor(el.clientWidth));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = width < 480;
  const height = Math.round(clamp(width * (narrow ? 0.86 : 0.74), 240, 560));
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  const scene = useMemo(() => {
    if (width === 0) return null;
    const pad = narrow ? { l: 14, r: 44, t: 22, b: 26 } : { l: 26, r: 64, t: 30, b: 34 };
    const projection = geoConicConformal()
      .parallels([20, 50])
      .rotate([-24, 0])
      .fitExtent(
        [
          [pad.l, pad.t],
          [width - pad.r, height - pad.b],
        ],
        { type: 'MultiPoint', coordinates: FIT_POINTS },
      );
    projection.clipExtent([
      [-1, -1],
      [width + 1, height + 1],
    ]);
    const path = geoPath(projection);
    return {
      projection,
      land: path(LAND) ?? '',
      graticule: path(geoGraticule10()) ?? '',
    };
  }, [width, height, narrow]);

  const routes = useMemo(
    () => (scene ? OPTION_IDS.map((id) => drawRoute(id, routing, scene.projection)) : []),
    [scene, routing],
  );
  const selected = routes.find((r) => r.id === selectedId);
  const measured = useMemo(() => (selected ? measure(selected) : null), [selected]);

  const revealRef = useRef<SVGPathElement>(null);
  const markRef = useRef<SVGGElement>(null);

  /** Put the reveal and the mark at a given state. p: share of the line drawn. dist: mark position in px. */
  const place = useCallback(
    (p: number, dist: number) => {
      if (!measured) return;
      revealRef.current?.setAttribute('stroke-dashoffset', String(1 - p));
      const g = markRef.current;
      if (!g) return;
      const m = measured.at(dist);
      g.setAttribute('transform', `translate(${m.x.toFixed(1)} ${m.y.toFixed(1)}) rotate(${m.angle.toFixed(1)})`);
      const show = markFor(m.kind);
      for (const child of Array.from(g.children)) {
        (child as SVGElement).style.display = child.getAttribute('data-mark') === show ? '' : 'none';
      }
    },
    [measured],
  );

  // Rest state: line fully drawn, mark parked at Beirut. With reduced motion this is all that happens.
  // A new playToken (a user action) runs once: draw the line, send the mark along it, stop.
  // A resize or a re-solve that keeps the same token only re-places the rest state.
  const played = useRef(0);
  useLayoutEffect(() => {
    if (!measured) return;
    const end = measured.total - PARK_PX;
    if (playToken === played.current || reducedMotion) {
      place(1, end);
      return;
    }
    played.current = playToken;
    const travel = travelMs(leadDays);
    let raf = 0;
    let start = 0;
    const frame = (now: number) => {
      if (start === 0) start = now;
      const t = now - start;
      if (t < DRAW_MS) {
        place(easeInOutCubic(t / DRAW_MS), 0);
      } else if (t < DRAW_MS + travel) {
        place(1, end * easeInOutCubic((t - DRAW_MS) / travel));
      } else {
        place(1, end);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    place(0, 0);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      place(1, end);
    };
  }, [playToken, reducedMotion, measured, leadDays, place]);

  const labels = useMemo((): MapLabel[] => {
    const src = selectedId.split('-')[0];
    const viaFrankfurt = selectedId === 'hamburg-air';
    const out: MapLabel[] = [
      { key: 'hamburg', at: PLACE.hamburg, text: 'Hamburg', dx: 8, dy: -5, anchor: 'start', tone: 'port', dot: true },
      { key: 'jubail', at: PLACE.jubail, text: 'Jubail', dx: -7, dy: -7, anchor: 'end', tone: 'port', dot: true },
      { key: 'sitra', at: PLACE.sitra, text: 'Sitra', dx: 8, dy: 12, anchor: 'start', tone: 'port', dot: true },
      { key: 'beirut', at: PLACE.beirut, text: 'Beirut', dx: 9, dy: -10, anchor: 'start', tone: 'port', dot: false },
      { key: 'hormuz', at: PLACE.hormuz, text: 'Hormuz', dx: 10, dy: -8, anchor: 'start', tone: 'passage', dot: false },
      { key: 'suez', at: PLACE.suez, text: 'Suez', dx: -8, dy: 4, anchor: 'end', tone: 'passage', dot: false },
      { key: 'gibraltar', at: PLACE.gibraltar, text: 'Gibraltar', dx: 0, dy: 18, anchor: 'middle', tone: 'passage', dot: false },
    ];
    if (!narrow || routing === 'hormuz')
      out.push({ key: 'bab', at: PLACE.babElMandeb, text: 'Bab-el-Mandeb', dx: -9, dy: 12, anchor: 'end', tone: 'passage', dot: false });
    if (routing === 'jeddah')
      out.push({ key: 'jeddah', at: PLACE.jeddah, text: 'Jeddah', dx: 8, dy: 15, anchor: 'start', tone: 'port', dot: true });
    if (!narrow || viaFrankfurt)
      out.push({ key: 'frankfurt', at: PLACE.frankfurt, text: 'Frankfurt', dx: 8, dy: 4, anchor: 'start', tone: 'port', dot: true });
    return out.map((l) => ({ ...l, tone: l.key === src || (l.key === 'frankfurt' && viaFrankfurt) || l.key === 'beirut' ? 'port' : l.tone }));
  }, [selectedId, routing, narrow]);

  const xy = (p: readonly [number, number]): XY => scene?.projection([p[0], p[1]]) ?? [0, 0];
  const selectedSource = selectedId.split('-')[0];
  const bestSource = bestId.split('-')[0];
  const rowOf = (id: OptionId) => rows.find((r) => r.id === id);

  return (
    <div ref={boxRef} className="w-full">
      {scene && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Map of sourcing routes into Beirut from Jubail, Sitra and Hamburg, by sea and by air."
          aria-describedby={describedBy}
          className="block rounded-control border border-hairline"
          style={{ background: palette.canvas, fontFamily: font.sans, fontSize: 12 }}
        >
          <defs>
            <mask id={`reveal-${uid}`} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
              {selected && (
                <path
                  ref={revealRef}
                  d={selected.legs.map((l) => toPath(l.pts)).join('')}
                  fill="none"
                  stroke="#fff" /* mask luminance, not a visible colour */
                  strokeWidth={12}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  strokeDasharray="1 1"
                  strokeDashoffset={0}
                />
              )}
            </mask>
          </defs>

          {/* Sea is the canvas; land is the hairline grey, one step lighter. No tiles, no relief. */}
          <path d={scene.graticule} fill="none" stroke={neutral.hairline} strokeWidth={0.5} opacity={0.5} />
          <path d={scene.land} fill={neutral.hairline} stroke={palette.canvas} strokeWidth={0.5} strokeLinejoin="round" />

          {/* Routes not selected: faint. The best one, when it is not the one selected, is drawn heavier. */}
          {routes
            .filter((r) => r.id !== selectedId)
            .map((r) => {
              const row = rowOf(r.id);
              const tip = row
                ? `${optionName(r.id)}: ${fmt(row.chosen.unitCost, 2)} USD/kg landed, ${row.leadDays} days. Select to draw.`
                : optionName(r.id);
              return (
                <g key={r.id} onClick={() => onSelect(r.id)} style={{ cursor: 'pointer' }}>
                  <title>{tip}</title>
                  {r.legs.map((leg, i) => (
                    <path
                      key={i}
                      d={toPath(leg.pts)}
                      fill="none"
                      stroke={neutral.textFaint}
                      strokeWidth={r.id === bestId ? 2 : 1}
                      strokeDasharray={LEG_STROKE[leg.kind].dash}
                      strokeLinecap={LEG_STROKE[leg.kind].cap}
                      strokeLinejoin="round"
                    />
                  ))}
                  <path d={r.legs.map((l) => toPath(l.pts)).join('')} fill="none" stroke="transparent" strokeWidth={12} />
                </g>
              );
            })}

          {/* The selected route, revealed through the mask as it draws. */}
          {selected && (
            <g mask={`url(#reveal-${uid})`}>
              {selected.legs.map((leg, i) => (
                <path
                  key={i}
                  d={toPath(leg.pts)}
                  fill="none"
                  stroke={neutral.text}
                  strokeWidth={2}
                  strokeDasharray={LEG_STROKE[leg.kind].dash}
                  strokeLinecap={LEG_STROKE[leg.kind].cap}
                  strokeLinejoin="round"
                />
              ))}
            </g>
          )}

          {/* Beirut: small ring. */}
          <circle cx={xy(PLACE.beirut)[0]} cy={xy(PLACE.beirut)[1]} r={5} fill={palette.canvas} stroke={neutral.text} strokeWidth={1.5} />

          {labels.map((l) => {
            const [x, y] = xy(l.at);
            const isSelected = l.key === selectedSource || (l.key === 'frankfurt' && selectedId === 'hamburg-air');
            const strong = isSelected || l.key === 'beirut';
            const isBest = l.key === bestSource;
            const text = isBest && !narrow ? `${l.text} (best)` : l.text;
            return (
              <g key={l.key}>
                {isBest && <circle cx={x} cy={y} r={6.5} fill="none" stroke={neutral.text} strokeWidth={1} />}
                {l.dot && (
                  <circle cx={x} cy={y} r={3} fill={strong ? neutral.text : neutral.textMuted} stroke={palette.canvas} strokeWidth={1.5} />
                )}
                <text
                  x={x + l.dx}
                  y={y + l.dy}
                  textAnchor={l.anchor}
                  fill={strong ? neutral.text : l.tone === 'port' ? neutral.textMuted : neutral.textFaint}
                  fontWeight={strong ? 500 : 400}
                  stroke={palette.canvas}
                  strokeWidth={3}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {text}
                </text>
              </g>
            );
          })}

          {/* Ship, plane or truck mark. Its position is set by place(); it only moves after a user action. */}
          <g ref={markRef} aria-hidden="true">
            {(Object.keys(MARK_PATH) as MarkKind[]).map((k) => (
              <path
                key={k}
                data-mark={k}
                d={MARK_PATH[k]}
                fill={neutral.text}
                stroke={palette.canvas}
                strokeWidth={1.5}
                strokeLinejoin="round"
                paintOrder="stroke"
                style={{ display: 'none' }}
              />
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}

function LegendLine({ kind, label, faint }: { kind: LegKind; label: string; faint?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <svg width={30} height={8} aria-hidden="true">
        <path
          d="M2 4H28"
          stroke={faint ? neutral.textFaint : neutral.text}
          strokeWidth={faint ? 1 : 2}
          strokeDasharray={LEG_STROKE[kind].dash}
          strokeLinecap={LEG_STROKE[kind].cap}
        />
      </svg>
      {label}
    </li>
  );
}

// --------------------------------------------------------------------- rows

interface Row extends Ranked<OptionResult> {
  id: OptionId;
  spec: OptionSpec;
  dutyRec: SourceRecord;
  /** Landed cost at the tier applied, with every part at the low and high end of its range. */
  landedLow: number;
  landedHigh: number;
}

function buildRows(scenario: Scenario, routing: GulfRouting, dutyCeiling: boolean): Row[] {
  const solved = OPTION_IDS.map((id) => {
    const spec = optionSpec(id, routing);
    const dutyRec = dutyCeiling ? SRC.dutyCeiling : spec.duty;
    const perContainer = spec.mode === 'sea';
    const result = solveOption(
      {
        id,
        perContainer,
        price: spec.price.value,
        freight: sum(spec.freight),
        destination: sum(spec.destination),
        leadDays: sum(spec.lead),
        dutyRate: dutyRec.value / 100,
      },
      scenario,
    );
    const step = PRICE_TIERS[result.chosen.tierIndex]?.step?.value ?? 0;
    const per = perContainer ? scenario.payloadKg : 1;
    const end = (pick: (r: SourceRecord) => number) =>
      landedCost({
        unitPrice: pick(spec.price) + step,
        freightPerKg: spec.freight.reduce((s, r) => s + pick(r), 0) / per,
        destinationPerKg: spec.destination.reduce((s, r) => s + pick(r), 0) / per,
        dutyRate: dutyRec.value / 100,
        vatRate: scenario.vatRate,
        includeVat: scenario.includeVat,
      }).landed;
    return { ...result, id, spec, dutyRec, landedLow: end((r) => r.low), landedHigh: end((r) => r.high) };
  });
  return rankByTotal(solved);
}

// ----------------------------------------------------------------- small parts

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-12 text-textMuted">
          {label}
        </label>
      ) : (
        <span className="text-12 text-textMuted">{label}</span>
      )}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {hint && <p className="text-12 text-textFaint">{hint}</p>}
    </div>
  );
}

const INPUT =
  'num w-20 rounded-control border border-hairlineStrong bg-canvas px-2 py-1 text-12 text-text placeholder:text-textFaint';

const BASIS_WORD: Record<SourceRecord['basis'], string> = {
  published: 'source',
  derived: 'built from',
  assumption: 'assumed; nearest figure',
};

/** One line of the details list: what it is, where it came from, the figure. */
function DetailLine({ rec, value, unit }: { rec: SourceRecord; value: ReactNode; unit: string }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-t border-hairline py-1 first:border-t-0">
      <span className="min-w-0 text-12 text-textMuted">
        {rec.label}
        <span className="text-textFaint">
          {rec.sourceUrl ? (
            <>
              {' '}
              ({BASIS_WORD[rec.basis]}:{' '}
              <a
                href={rec.sourceUrl}
                target="_blank"
                rel="noreferrer"
                title={rec.sourceTitle}
                className="underline decoration-textFaint underline-offset-2 hover:text-text"
              >
                {host(rec.sourceUrl)}
              </a>
              )
            </>
          ) : (
            ' (assumed)'
          )}
        </span>
      </span>
      <Est rec={rec} size="12" value={value} unit={unit} />
    </li>
  );
}

function PlainLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-t border-hairline py-1 first:border-t-0">
      <span className="min-w-0 text-12 text-text">{label}</span>
      {children}
    </li>
  );
}

// ---------------------------------------------------------------- the page

export function SourcingPage() {
  const ids = { demand: useId(), qty: useId(), mapNote: useId(), details: useId() };
  const reducedMotion = usePrefersReducedMotion();

  const [demandMode, setDemandMode] = useState<DemandMode>('tanks');
  const [customT, setCustomT] = useState(Math.round(TANKS_T_PER_YEAR));
  const [qtyMode, setQtyMode] = useState<QtyMode>('eoq');
  const [containers, setContainers] = useState(2);
  const [routing, setRouting] = useState<GulfRouting>('jeddah');
  const [includeVat, setIncludeVat] = useState(false);
  const [dutyCeiling, setDutyCeiling] = useState(false);
  const [picked, setPicked] = useState<OptionId | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [playToken, setPlayToken] = useState(0);
  const play = useCallback(() => setPlayToken((n) => n + 1), []);

  const demandT = demandMode === 'tanks' ? TANKS_T_PER_YEAR : demandMode === 'plant' ? PLANT_T_PER_YEAR : customT;
  const demandKg = Math.max(1, demandT * 1000);

  const scenario: Scenario = useMemo(
    () => ({
      demandKgYr: demandKg,
      payloadKg: PAYLOAD_KG,
      airLotKg: AIR_LOT_KG,
      orderCost: ORDER_COST_USD,
      holdingRate: P.holdingRatePerYear.value,
      vatRate: SRC.vat.value / 100,
      includeVat,
      priceBreaks: PRICE_TIERS.map((t) => ({ minContainers: t.minContainers, step: t.step?.value ?? 0 })),
      fixedQtyKg: qtyMode === 'fixed' ? containers * PAYLOAD_KG : undefined,
    }),
    [demandKg, includeVat, qtyMode, containers],
  );

  const rows = useMemo(() => buildRows(scenario, routing, dutyCeiling), [scenario, routing, dutyCeiling]);
  const best = rows[0] as Row;
  const selected = rows.find((r) => r.id === picked) ?? best;

  /** NTG's own figures through the same cost formula, for the reference line. */
  const ntg = useMemo(
    () =>
      evaluate(
        {
          demand: demandKg,
          orderCost: ORDER_COST_USD,
          holdingRate: P.holdingRatePerYear.value,
          tiers: [{ minQty: PAYLOAD_KG, unitCost: NTG_PRICE }],
          lot: PAYLOAD_KG,
          leadDays: NTG_LEAD_DAYS,
        },
        PAYLOAD_KG,
      ),
    [demandKg],
  );

  const select = (id: OptionId) => {
    setPicked(id);
    play();
  };
  const setQty = (mode: QtyMode, n = containers) => {
    setQtyMode(mode);
    setContainers(n);
    play();
  };

  const calcTitle = 'Worked out from the estimates for this option. Not a quote.';
  const sea = selected.spec.mode === 'sea';
  const tier = PRICE_TIERS[selected.chosen.tierIndex] ?? PRICE_TIERS[0]!;
  const demandTitle =
    demandMode === 'tanks'
      ? `${sourceTitle(P.weeklyResinT)}. Times ${WEEKS_PER_YEAR} weeks.`
      : demandMode === 'plant'
        ? `${plantTitle ?? ''}. Times ${WEEKS_PER_YEAR} weeks.`
        : 'Typed in.';

  const th = 'border-b border-hairline px-1.5 pb-2 align-bottom font-medium sm:px-2';
  const td = 'whitespace-nowrap border-b border-hairline px-1.5 py-1.5 text-right sm:px-2';

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-hairline bg-canvas px-4 py-3 md:px-6">
        <h1 className="text-14 font-semibold">Sourcing: resin into Beirut</h1>
        <p className="text-14 text-textMuted">Prices are estimates, not supplier quotes.</p>
      </header>

      <main className="mx-auto flex max-w-[1680px] flex-col gap-4 p-4 md:p-6 lg:grid lg:grid-cols-2 lg:items-start">
        <Panel className="p-4" aria-label="Route map">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-14 font-semibold">
              Route: {optionName(selected.id)}
              <span className="ml-2 font-normal text-textMuted">{selected.leadDays} days, order to plant</span>
            </h2>
            <Button onClick={play} disabled={reducedMotion} title={reducedMotion ? 'Motion is turned off in your system settings' : undefined}>
              Replay
            </Button>
          </div>
          <RouteMap
            rows={rows}
            selectedId={selected.id}
            bestId={best.id}
            routing={routing}
            leadDays={selected.leadDays}
            playToken={playToken}
            reducedMotion={reducedMotion}
            describedBy={ids.mapNote}
            onSelect={select}
          />
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-12 text-textMuted">
            <LegendLine kind="sea" label="Sea" />
            <LegendLine kind="road" label="Road" />
            <LegendLine kind="air" label="Air" />
            <LegendLine kind="sea" label="Other options" faint />
            <li className="flex items-center gap-2">
              <svg width={16} height={16} aria-hidden="true">
                <circle cx={8} cy={8} r={6.5} fill="none" stroke={neutral.text} strokeWidth={1} />
                <circle cx={8} cy={8} r={3} fill={neutral.text} />
              </svg>
              Best option
            </li>
          </ul>
          <p id={ids.mapNote} className="sr-only">
            The options table lists the same routes with their cost and lead time.
          </p>
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel className="p-4" aria-label="Controls">
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Demand, tonnes a year" htmlFor={ids.demand}>
                <Segmented<DemandMode>
                  label="Demand basis"
                  value={demandMode}
                  onChange={(m) => {
                    if (m === 'custom') setCustomT(Math.round(demandT));
                    setDemandMode(m);
                  }}
                  options={[
                    { value: 'tanks', label: 'Studied tanks' },
                    { value: 'plant', label: 'Whole plant' },
                    { value: 'custom', label: 'Other' },
                  ]}
                />
                <input
                  id={ids.demand}
                  className={INPUT}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={5000}
                  step={1}
                  title={demandTitle}
                  value={Math.round(demandT)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v > 0) {
                      setCustomT(clamp(v, 1, 5000));
                      setDemandMode('custom');
                    }
                  }}
                />
              </Field>

              <Field label={`Order quantity, containers of ${fmt(P.deliveryLotT.value)} t`} htmlFor={ids.qty}>
                <Segmented<QtyMode>
                  label="Order quantity"
                  value={qtyMode}
                  onChange={(m) => setQty(m)}
                  options={[
                    { value: 'eoq', label: 'Solve' },
                    { value: 'fixed', label: 'By hand' },
                  ]}
                />
                <input
                  id={ids.qty}
                  className={INPUT}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  step={1}
                  placeholder="best"
                  value={qtyMode === 'fixed' ? containers : ''}
                  onChange={(e) => {
                    const v = Math.round(Number(e.target.value));
                    if (e.target.value !== '' && Number.isFinite(v)) setQty('fixed', clamp(v, 1, 20));
                  }}
                />
              </Field>

              <Field label="Gulf route" hint="Large carriers are not sailing through Hormuz now.">
                <Segmented<GulfRouting>
                  label="Gulf route"
                  value={routing}
                  onChange={(r) => {
                    setRouting(r);
                    play();
                  }}
                  options={[
                    { value: 'jeddah', label: 'Road to Jeddah (now)' },
                    { value: 'hormuz', label: 'Sea through Hormuz' },
                  ]}
                />
              </Field>

              <Field label="Customs duty">
                <Segmented<'pref' | 'ceiling'>
                  label="Customs duty"
                  value={dutyCeiling ? 'ceiling' : 'pref'}
                  onChange={(v) => setDutyCeiling(v === 'ceiling')}
                  options={[
                    { value: 'pref', label: '0% with origin certificate' },
                    { value: 'ceiling', label: '5% worst case' },
                  ]}
                />
              </Field>

              <Field label={`VAT, ${fmt(SRC.vat.value)}%`}>
                <Segmented<'out' | 'in'>
                  label="VAT"
                  value={includeVat ? 'in' : 'out'}
                  onChange={(v) => setIncludeVat(v === 'in')}
                  options={[
                    { value: 'out', label: 'Left out (recovered)' },
                    { value: 'in', label: 'Count it' },
                  ]}
                />
              </Field>
            </div>
          </Panel>

          <Panel className="min-w-0 p-4" aria-label="Options">
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Six sourcing options, cheapest year first, with what NTG pays today as a reference line. Choose a row to draw its route.
                </caption>
                <thead>
                  <tr className="text-12 text-textMuted">
                    <th scope="col" className={`${th} sticky left-0 z-[1] bg-panel pl-2 text-left`}>
                      Option
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      Landed cost, USD/kg
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      Lead time, days
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      Order size, t
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      Total, USD a year
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isSelected = r.id === selected.id;
                    const cellBg = isSelected ? 'bg-canvas' : 'bg-panel';
                    const name = SOURCE_NAME[r.spec.source];
                    const weight = r.best ? 'font-semibold' : '';
                    return (
                      <tr
                        key={r.id}
                        onClick={() => select(r.id)}
                        className={['cursor-pointer', cellBg, r.best ? 'outline outline-1 -outline-offset-1 outline-textMuted' : ''].join(' ')}
                      >
                        <th scope="row" className={`sticky left-0 z-[1] border-b border-hairline py-1.5 pl-2 pr-1.5 text-left font-normal sm:pr-2 ${cellBg}`}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              select(r.id);
                            }}
                            aria-pressed={isSelected}
                            className="flex flex-col text-left sm:flex-row sm:items-baseline sm:gap-2"
                          >
                            <span className={`whitespace-nowrap text-14 ${weight}`}>
                              {name.place}, {r.spec.mode}
                            </span>
                            {r.best && <span className="text-12 font-semibold">Best</span>}
                            <span className="hidden text-12 text-textMuted md:inline">{name.supplier}</span>
                          </button>
                        </th>
                        <td className={`${td} ${weight}`}>
                          <Calc
                            value={fmt(r.chosen.unitCost, 3)}
                            title={`${calcTitle} Between ${fmt(r.landedLow, 2)} and ${fmt(r.landedHigh, 2)} with every estimate at the low or high end of its range.`}
                          />
                        </td>
                        <td className={td}>
                          <Calc value={r.leadDays} title="Sum of the lead-time parts for this route. Estimates." />
                        </td>
                        <td className={td}>
                          <Calc
                            value={tonnes(r.chosen.qty)}
                            title={
                              r.spec.mode === 'sea'
                                ? `${r.chosen.qty / PAYLOAD_KG} ${r.chosen.qty === PAYLOAD_KG ? 'container' : 'containers'}. ${calcTitle}`
                                : `Air cargo, by the tonne. ${calcTitle}`
                            }
                          />
                        </td>
                        <td className={`${td} ${weight}`}>
                          <Calc value={usdK(r.total)} title={`Resin, ordering, holding and stock on the way. Rounded to the nearest 1,000. ${calcTitle}`} />
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <th scope="row" className="sticky left-0 z-[1] bg-panel py-1.5 pl-2 pr-1.5 text-left font-normal sm:pr-2">
                      <span className="flex items-baseline gap-2">
                        <span className="whitespace-nowrap text-14">NTG today</span>
                        <span className="hidden text-12 text-textMuted md:inline">What the plant pays and waits now</span>
                      </span>
                    </th>
                    <td className="whitespace-nowrap px-1.5 py-1.5 text-right sm:px-2">
                      <Num value={fmt(NTG_PRICE, 3)} datum={P.resinPriceUsdKg} />
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-1.5 text-right sm:px-2">
                      <Num
                        value={NTG_LEAD_DAYS}
                        tag={P.replenishLeadMonths.tag}
                        title={`${sourceTitle(P.replenishLeadMonths)}. ${P.replenishLeadMonths.value} months at 30 days.`}
                      />
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-1.5 text-right sm:px-2">
                      <Num value={fmt(P.deliveryLotT.value)} datum={P.deliveryLotT} />
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-1.5 text-right sm:px-2">
                      <Num
                        value={usdK(ntg.total)}
                        tag="C"
                        title="NTG price, lot and lead time (inventory rows 9 to 11) through the same formula as the options."
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-14">
              {optionName(selected.id)}: order <Calc value={tonnes(selected.chosen.qty)} unit="t" title={calcTitle} /> when stock falls to{' '}
              <Calc
                value={tonnes(selected.reorderKg, 1)}
                unit="t"
                title="Demand during the lead time: demand a year x lead days / 365. No safety stock."
              />
              ; about <Calc value={fmt(selected.chosen.ordersPerYear, 1)} title={calcTitle} /> orders a year.
            </p>
            <p className="mt-1 text-12 text-textMuted">Raw material is not a bottleneck in NTG&rsquo;s data.</p>

            <div className="mt-3">
              <Button aria-expanded={detailsOpen} aria-controls={ids.details} onClick={() => setDetailsOpen((o) => !o)}>
                Sources and details
              </Button>
            </div>
          </Panel>

          {detailsOpen && (
            <Panel id={ids.details} className="p-4" aria-label="Sources and details">
              <h2 className="mb-2 text-14 font-semibold">{optionName(selected.id)}: where the figures come from</h2>
              <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                <div>
                  <h3 className="mb-1 text-12 font-semibold">Cost per kg</h3>
                  <ul>
                    <DetailLine rec={selected.spec.price} value={fmt(selected.spec.price.value, 2)} unit="USD/kg" />
                    {tier.step && <DetailLine rec={tier.step} value={fmt(tier.step.value, 2)} unit="USD/kg" />}
                    {[...selected.spec.freight, ...selected.spec.destination].map((rec) => (
                      <DetailLine key={rec.id} rec={rec} value={sea ? fmt(rec.value) : fmt(rec.value, 2)} unit={sea ? 'USD per 40 ft' : 'USD/kg'} />
                    ))}
                    <DetailLine rec={selected.dutyRec} value={fmt(selected.dutyRec.value)} unit="%" />
                    <PlainLine label={sea ? `Landed, with freight spread over ${fmt(P.deliveryLotT.value)} t a container` : 'Landed'}>
                      <Calc
                        size="12"
                        value={fmt(selected.chosen.unitCost, 3)}
                        unit="USD/kg"
                        title={`${calcTitle} Between ${fmt(selected.landedLow, 2)} and ${fmt(selected.landedHigh, 2)} across the ranges.`}
                      />
                    </PlainLine>
                  </ul>
                </div>
                <div>
                  <h3 className="mb-1 text-12 font-semibold">Lead time</h3>
                  <ul>
                    {selected.spec.lead.map((rec) => (
                      <DetailLine key={rec.id} rec={rec} value={rec.value} unit="days" />
                    ))}
                    <PlainLine label="Order to plant">
                      <Calc size="12" value={selected.leadDays} unit="days" title="Sum of the parts above." />
                    </PlainLine>
                  </ul>
                </div>
              </div>
              <p className="mt-3 text-12 text-textFaint">
                Estimates read from public pages on 20 Nov 2026, with {fmt(ORDER_COST_USD)} USD an order and{' '}
                {fmt(P.holdingRatePerYear.value * 100)}% a year to hold stock. Every assumption and the full source list are in the
                project notes.
              </p>
            </Panel>
          )}
        </div>
      </main>
    </div>
  );
}
