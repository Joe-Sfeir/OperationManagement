/**
 * Sourcing page: routes into Beirut and a buying decision panel.
 *
 * Follows docs/STYLE_BIBLE.md, "Sourcing map and dashboard chrome". Every price,
 * tier and freight rate is a researched estimate from ./sources.ts and carries
 * an S badge and a link to its entry in the source list at the foot of the
 * page. The arithmetic is in ./model.ts.
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
import { SourceBadge } from '../../design/SourceBadge';
import { Button, Num, Panel, Segmented, fmt, sourceTitle } from '../../ui/kit';
import { P, inventoryRows, numbers } from '../../data/params';
import {
  evaluate,
  landedCost,
  pathLengthNm,
  rankByTotal,
  sailingDays,
  solveOption,
  travelMs,
  type OptionResult,
  type Ranked,
  type Scenario,
} from './model';
import {
  AIR_LOT_KG,
  ALL_RECORDS,
  CONDITIONS,
  OPTION_IDS,
  ORDER_COST_LINES,
  ORDER_COST_USD,
  PLACE,
  PRICE_TIERS,
  RETRIEVAL_NOTE,
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

/** Scroll to a record in the source list and mark it. Not a hash link, so it cannot disturb the app's own navigation. */
function useRecordJump() {
  const [marked, setMarked] = useState<string | null>(null);
  const jump = useCallback((id: string) => {
    setMarked(id);
    const el = document.getElementById(`src-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.focus({ preventScroll: true });
  }, []);
  return { marked, jump };
}

type Jump = (id: string) => void;

/** A researched figure: value in Plex Mono, S badge, and a link to its entry in the source list. */
function Est({
  rec,
  value,
  unit,
  size = '14',
  jump,
}: {
  rec: SourceRecord;
  value: ReactNode;
  unit?: string;
  size?: '12' | '14' | '28';
  jump: Jump;
}) {
  return (
    <a
      href={`#src-${rec.id}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        jump(rec.id);
      }}
      aria-label={`${rec.label}: estimate. Go to its source.`}
      className="inline-flex border-b border-dotted border-textFaint hover:border-text"
    >
      <Num value={value} unit={unit} tag="S" title={recordTitle(rec)} size={size} />
    </a>
  );
}

/** A figure worked out on this page from the estimates: S badge, no single source. */
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

          {/* Hormuz: red ring = blocked for this cargo on 20 Nov 2026. */}
          <circle cx={xy(PLACE.hormuz)[0]} cy={xy(PLACE.hormuz)[1]} r={6} fill="none" stroke={palette.alertRed} strokeWidth={2} />

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

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
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
  'num w-24 rounded-control border border-hairlineStrong bg-canvas px-2 py-1 text-14 text-text placeholder:text-textFaint';

function ExternalLink({ url, children }: { url: string; children: ReactNode }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="underline decoration-textFaint underline-offset-2 hover:decoration-text">
      {children}
    </a>
  );
}

/** One line of a breakdown: label, figure with badge, and where it came from. */
function Line({ label, children, source }: { label: ReactNode; children: ReactNode; source?: SourceRecord }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 border-t border-hairline py-1.5 first:border-t-0">
      <dt className="min-w-0 text-12 text-textMuted">
        {label}
        {source && (
          <span className="block text-textFaint">
            {source.sourceUrl ? <ExternalLink url={source.sourceUrl}>{host(source.sourceUrl)}</ExternalLink> : 'No public figure found'}
            {source.basis === 'assumption' && source.sourceUrl ? ' (nearest public figure; the number is an assumption)' : ''}
          </span>
        )}
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function SubHead({ children }: { children: ReactNode }) {
  return <h3 className="mb-1 mt-4 text-12 font-semibold text-text first:mt-0">{children}</h3>;
}

// ---------------------------------------------------------------- the page

export function SourcingPage() {
  const ids = { demand: useId(), qty: useId(), table: useId(), tableNote: useId() };
  const reducedMotion = usePrefersReducedMotion();
  const { marked, jump } = useRecordJump();

  const [demandMode, setDemandMode] = useState<DemandMode>('tanks');
  const [customT, setCustomT] = useState(Math.round(TANKS_T_PER_YEAR));
  const [qtyMode, setQtyMode] = useState<QtyMode>('eoq');
  const [containers, setContainers] = useState(2);
  const [routing, setRouting] = useState<GulfRouting>('jeddah');
  const [includeVat, setIncludeVat] = useState(false);
  const [dutyCeiling, setDutyCeiling] = useState(false);
  const [picked, setPicked] = useState<OptionId | null>(null);
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

  const calcTitle = 'Worked out on this page from the estimates in this row. Not a quote.';
  const applied = PRICE_TIERS[selected.chosen.tierIndex] ?? PRICE_TIERS[0]!;
  const seaNm = selected.spec.mode === 'sea'
    ? routeLegs(selected.id, routing)
        .filter((l) => l.kind !== 'road')
        .reduce((s, l) => s + pathLengthNm(l.points), 0)
    : 0;
  const perLot = selected.spec.mode === 'sea' ? PAYLOAD_KG : 1;
  const chosenLanded = selected.tiers[selected.chosen.tierIndex]?.landed;
  const tierTotals = selected.eoq.perTier.flatMap((t) => (t ? [t.total] : []));
  const tierSpread = (Math.max(...tierTotals) - Math.min(...tierTotals)) / Math.min(...tierTotals);
  const gapToNtg = selected.chosen.unitCost - NTG_PRICE;

  const used = new Set<string>();
  for (const r of rows) for (const rec of [r.spec.price, ...r.spec.freight, ...r.spec.destination, ...r.spec.lead, r.dutyRec]) used.add(rec.id);
  for (const t of PRICE_TIERS) if (t.step) used.add(t.step.id);
  for (const rec of [...ORDER_COST_LINES, SRC.vat, SRC.extraCustomsFee, SRC.shipSpeed]) used.add(rec.id);
  const usedRecords = ALL_RECORDS.filter((r) => used.has(r.id));
  const otherRecords = ALL_RECORDS.filter((r) => !used.has(r.id));

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-hairline bg-canvas px-4 py-3 md:px-6">
        <h1 className="text-14 font-semibold">Sourcing: resin into Beirut</h1>
        <p className="flex items-center gap-2 text-14">
          <SourceBadge tag="S" />
          Prices are researched estimates, not supplier quotes.
        </p>
      </header>

      <main className="mx-auto flex max-w-[1680px] flex-col gap-4 p-4 md:p-6">
        <p className="max-w-[110ch] text-14 text-textMuted">
          <span className="text-text">Raw material is not a bottleneck in NTG&rsquo;s data.</span> The plant has{' '}
          <Num value={P.siloCount.value} unit="silos" datum={P.siloCount} /> of about{' '}
          <Num value={P.siloCapacityT.value} unit="t" datum={P.siloCapacityT} /> each and the three studied tanks use{' '}
          <Num value={fmt(P.weeklyResinT.value, 3)} unit="t a week" datum={P.weeklyResinT} />. This page is about buying cost and lead
          time for resin R50035E, not about the machine.
        </p>

        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,9fr)_minmax(0,14fr)] lg:items-start">
          {/* Left on a wide screen: map, route conditions, how to read. On a phone the conditions and the guide follow the table. */}
          <div className="contents lg:flex lg:flex-col lg:gap-4">
            <Panel className="order-1 p-4 lg:order-none" aria-label="Route map">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-14 font-semibold">
                  Route: {optionName(selected.id)}
                  <span className="ml-2 font-normal text-textMuted">
                    {selected.leadDays} days, order to plant
                  </span>
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
                describedBy={ids.tableNote}
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
                  Origin of the best option
                </li>
                <li className="flex items-center gap-2">
                  <svg width={14} height={14} aria-hidden="true">
                    <circle cx={7} cy={7} r={5} fill="none" stroke={palette.alertRed} strokeWidth={2} />
                  </svg>
                  Hormuz: no large container line sailing, 20 Nov 2026
                </li>
              </ul>
              <p className="mt-2 text-12 text-textFaint">
                {selected.spec.routeNote} The mark crosses in {fmt(travelMs(selected.leadDays) / 1000, 1)} s: 40 ms for each day of lead
                time. Air arcs start at the port marks; Dammam and Bahrain airports are within 60 km of them.
              </p>
            </Panel>

            <Panel className="order-5 p-4 lg:order-none" aria-label="Route conditions">
              <h2 className="mb-2 text-14 font-semibold">Route conditions on 20 Nov 2026</h2>
              <ul className="flex flex-col gap-2">
                {CONDITIONS.map((c) => (
                  <li key={c.id} className="text-12 text-textMuted">
                    {c.text}{' '}
                    <ExternalLink url={c.sourceUrl}>{c.sourceTitle}</ExternalLink>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel className="order-6 p-4 lg:order-none" aria-label="How to read this">
              <h2 className="mb-2 text-14 font-semibold">How to read this</h2>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-14 text-textMuted marker:text-textFaint">
                <li>
                  Each row of the table is one way to buy resin: where it comes from and whether it travels by sea or by air. The row
                  with the outline has the lowest cost for a year of resin.
                </li>
                <li>
                  <span className="text-text">Landed cost</span> is what a kilo costs at the plant gate: price at origin, freight, port
                  charges and the truck, and duty.
                </li>
                <li>
                  <span className="text-text">EOQ</span> is the order size that makes the yearly total lowest. A bigger order means a
                  lower price per kilo and fewer orders, but more resin sitting in stock.
                </li>
                <li>
                  <span className="text-text">Reorder point</span> is the stock level at which to order again: the resin the plant uses
                  while the order is on its way. No safety stock is added.
                </li>
                <li>
                  Every figure with an <SourceBadge tag="S" /> badge is an estimate from public sources, not a quote. The ranges are
                  wide: wider than the gap between the best row and the {fmt(NTG_PRICE, 2)} USD/kg NTG pays now. Use the table to
                  decide who to ask for quotes, not to conclude that NTG overpays.
                </li>
                <li>
                  What holds up better than the exact numbers: sea is far cheaper than air; Gulf resin was cheaper than European on
                  every public benchmark found, though the ranges overlap; and ordering two containers at a time only pays if the
                  supplier gives a price step for it.
                </li>
              </ol>
            </Panel>
          </div>

          {/* Right on a wide screen: the decision panel. */}
          <div className="contents lg:flex lg:flex-col lg:gap-4">
            <Panel className="order-2 p-4 lg:order-none" aria-label="Demand and order quantity">
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                <Field
                  label="Demand, tonnes of resin a year"
                  htmlFor={ids.demand}
                  hint={
                    <>
                      Studied tanks: <Num size="12" value={fmt(P.weeklyResinT.value, 3)} unit="t a week" datum={P.weeklyResinT} /> x{' '}
                      {WEEKS_PER_YEAR}. Whole plant:{' '}
                      <Num size="12" value={fmt(PLANT_KG_PER_WEEK / 1000, 3)} unit="t a week" tag="N" title={plantTitle} /> x{' '}
                      {WEEKS_PER_YEAR}.
                    </>
                  }
                >
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

                <Field
                  label={`Order quantity, containers of ${fmt(P.deliveryLotT.value)} t`}
                  htmlFor={ids.qty}
                  hint={
                    qtyMode === 'eoq'
                      ? 'Each option is costed at its own best order size.'
                      : `Every option is costed at ${containers} ${containers === 1 ? 'container' : 'containers'} an order. The EOQ column still shows its own best size.`
                  }
                >
                  <Segmented<QtyMode>
                    label="Order quantity"
                    value={qtyMode}
                    onChange={(m) => setQty(m)}
                    options={[
                      { value: 'eoq', label: 'Solve EOQ' },
                      { value: 'fixed', label: 'Set by hand' },
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
                    placeholder="EOQ"
                    value={qtyMode === 'fixed' ? containers : ''}
                    onChange={(e) => {
                      const v = Math.round(Number(e.target.value));
                      if (e.target.value !== '' && Number.isFinite(v)) setQty('fixed', clamp(v, 1, 20));
                    }}
                  />
                </Field>

                <Field label="Gulf containers travel">
                  <Segmented<GulfRouting>
                    label="Gulf routing"
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

                <Field label="Customs duty" hint="The Lebanese rate for HS 3901 was not found. 5% is the top of the general range.">
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

                <Field label="VAT at the border" hint="Normally recovered by a registered manufacturer, so left out of cost.">
                  <Segmented<'out' | 'in'>
                    label="VAT"
                    value={includeVat ? 'in' : 'out'}
                    onChange={(v) => setIncludeVat(v === 'in')}
                    options={[
                      { value: 'out', label: 'Left out' },
                      { value: 'in', label: 'Count it' },
                    ]}
                  />
                  <Est rec={SRC.vat} value={fmt(SRC.vat.value)} unit="%" jump={jump} />
                </Field>

                <Field label="Held fixed">
                  <span className="flex flex-wrap gap-x-4 gap-y-1">
                    <Num value={fmt(P.holdingRatePerYear.value * 100)} unit="% a year to hold stock" datum={P.holdingRatePerYear} />
                    <Est rec={ORDER_COST_LINES[0]!} value={fmt(ORDER_COST_USD)} unit="USD an order" jump={jump} />
                  </span>
                </Field>
              </div>
            </Panel>

            <Panel className="order-3 min-w-0 p-4 lg:order-none" aria-label="Options">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-14 font-semibold">Options, cheapest year first</h2>
                <p id={ids.tableNote} className="text-12 text-textMuted">
                  The table lists every route on the map. Choose a row to draw its route.
                </p>
              </div>
              <div className="-mx-4 overflow-x-auto px-4">
                <table className="w-full min-w-[880px] border-collapse text-left">
                  <caption className="sr-only">
                    Six sourcing options ranked by total annual cost, with NTG&rsquo;s current price as a reference line.
                  </caption>
                  <thead>
                    <tr className="text-12 text-textMuted">
                      {[
                        ['Option', 'left'],
                        ['Price at origin, USD/kg', 'right'],
                        ['Freight to plant, USD/kg', 'right'],
                        ['Duty, %', 'right'],
                        ['Landed cost, USD/kg', 'right'],
                        ['Lead time, days', 'right'],
                        ['EOQ, t', 'right'],
                        ['Orders a year', 'right'],
                        ['Total, USD a year', 'right'],
                      ].map(([h, align], i) => (
                        <th
                          key={h}
                          scope="col"
                          className={[
                            'border-b border-hairline px-1.5 pb-2 align-bottom font-medium',
                            align === 'right' ? 'text-right' : 'text-left',
                            i === 0 ? 'sticky left-0 z-[1] bg-panel pl-0' : '',
                          ].join(' ')}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const isSelected = r.id === selected.id;
                      const tier = PRICE_TIERS[r.chosen.tierIndex] ?? PRICE_TIERS[0]!;
                      const cellBg = isSelected ? 'bg-canvas' : 'bg-panel';
                      const name = SOURCE_NAME[r.spec.source];
                      // Lead parts end with: main transit leg, then release at Beirut. Link the total to the transit leg.
                      const transit = r.spec.lead[r.spec.lead.length - 2] ?? r.spec.lead[0]!;
                      return (
                        <tr
                          key={r.id}
                          onClick={() => select(r.id)}
                          className={[
                            'cursor-pointer align-top',
                            cellBg,
                            r.best ? 'outline outline-1 -outline-offset-1 outline-textMuted' : '',
                          ].join(' ')}
                        >
                          <th scope="row" className={`sticky left-0 z-[1] border-b border-hairline py-2 pl-2 pr-2 text-left font-normal ${cellBg}`}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                select(r.id);
                              }}
                              aria-pressed={isSelected}
                              className="flex min-w-[9.5rem] items-baseline gap-2 text-left"
                            >
                              <span className="num text-12 text-textFaint">{r.rank}</span>
                              <span>
                                <span className={`block text-14 ${r.best ? 'font-semibold' : 'font-normal'}`}>
                                  {name.place}, {r.spec.mode}
                                  {r.best && <span className="ml-2 text-12 font-semibold text-text">Best</span>}
                                </span>
                                <span className="block text-12 text-textMuted">{name.supplier}</span>
                              </span>
                            </button>
                          </th>
                          <td className="whitespace-nowrap border-b border-hairline px-1.5 py-2 text-right">
                            <Est rec={r.spec.price} value={fmt(r.tiers[r.chosen.tierIndex]?.unitPrice ?? 0, 2)} jump={jump} />
                            <span className="mt-0.5 flex items-center justify-end gap-1.5 text-12 text-textMuted">
                              {tier.step ? (
                                <a
                                  href={`#src-${tier.step.id}`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    jump(tier.step!.id);
                                  }}
                                  className="border-b border-dotted border-textFaint hover:border-text"
                                >
                                  {tier.label}
                                </a>
                              ) : (
                                tier.label
                              )}
                              <SourceBadge tag="S" title={tier.step ? recordTitle(tier.step) : 'Price tiers are an assumption: no public tier data found.'} />
                            </span>
                          </td>
                          <td className="whitespace-nowrap border-b border-hairline px-1.5 py-2 text-right">
                            <Est rec={r.spec.freight[r.spec.freight.length - 1]!} value={fmt(r.freightPerKg + r.destinationPerKg, 3)} jump={jump} />
                          </td>
                          <td className="whitespace-nowrap border-b border-hairline px-1.5 py-2 text-right">
                            <Est rec={r.dutyRec} value={fmt(r.dutyRec.value)} jump={jump} />
                          </td>
                          <td className="whitespace-nowrap border-b border-hairline px-1.5 py-2 text-right">
                            <span className={r.best ? 'font-semibold' : ''}>
                              <Calc value={fmt(r.chosen.unitCost, 3)} title={calcTitle} />
                            </span>
                            <span className="num mt-0.5 block text-12 text-textMuted">
                              {fmt(r.landedLow, 2)} to {fmt(r.landedHigh, 2)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap border-b border-hairline px-1.5 py-2 text-right">
                            <Est rec={transit} value={r.leadDays} jump={jump} />
                          </td>
                          <td className="whitespace-nowrap border-b border-hairline px-1.5 py-2 text-right">
                            <Calc value={tonnes(r.eoq.best.qty)} title={`${calcTitle} Square-root quantity before rounding: ${tonnes(r.eoq.best.qStar, 1)} t.`} />
                            <span className="mt-0.5 block text-12 text-textMuted">
                              {r.spec.mode === 'sea'
                                ? `${r.eoq.best.qty / PAYLOAD_KG} ${r.eoq.best.qty === PAYLOAD_KG ? 'container' : 'containers'}`
                                : 'by the tonne'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap border-b border-hairline px-1.5 py-2 text-right">
                            <Calc value={fmt(r.chosen.ordersPerYear, 1)} title={calcTitle} />
                          </td>
                          <td className="whitespace-nowrap border-b border-hairline py-2 pl-1.5 pr-2 text-right">
                            <span className={r.best ? 'font-semibold' : ''}>
                              <Calc value={usdK(r.total)} title={`${calcTitle} Rounded to the nearest 1,000.`} />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="align-top">
                      <th scope="row" className="sticky left-0 z-[1] bg-panel py-2 pl-2 pr-2 text-left font-normal">
                        <span className="block pl-[1.1rem] text-14">NTG today</span>
                        <span className="block pl-[1.1rem] text-12 text-textMuted">Reference line. Supplier and terms not recorded.</span>
                      </th>
                      <td className="whitespace-nowrap px-1.5 py-2 text-right">
                        <Num value={fmt(NTG_PRICE, 2)} datum={P.resinPriceUsdKg} />
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 text-right text-12 text-textMuted">not recorded</td>
                      <td className="whitespace-nowrap px-1.5 py-2 text-right text-12 text-textMuted">not recorded</td>
                      <td className="whitespace-nowrap px-1.5 py-2 text-right">
                        <Num value={fmt(NTG_PRICE, 3)} datum={P.resinPriceUsdKg} />
                        <span className="mt-0.5 block text-12 text-textMuted">taken as landed</span>
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 text-right">
                        <Num
                          value={NTG_LEAD_DAYS}
                          tag={P.replenishLeadMonths.tag}
                          title={`${sourceTitle(P.replenishLeadMonths)}. ${P.replenishLeadMonths.value} months at 30 days.`}
                        />
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 text-right">
                        <Num value={fmt(P.deliveryLotT.value)} datum={P.deliveryLotT} />
                        <span className="mt-0.5 block text-12 text-textMuted">lot, not an EOQ</span>
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 text-right">
                        <Num value={fmt(ntg.ordersPerYear, 1)} tag="C" title="Demand divided by the 24 t lot (inventory row 10)." />
                      </td>
                      <td className="whitespace-nowrap py-2 pl-1.5 pr-2 text-right">
                        <Num
                          value={usdK(ntg.total)}
                          tag="C"
                          title="NTG price, lot and lead time (inventory rows 9 to 11) through the same formula, with the estimated order cost and the 25% holding rate."
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-12 text-textMuted min-[1580px]:hidden">Slide the table sideways to see every column.</p>
              <p className="mt-2 text-12 text-textFaint">
                Under each landed cost: the same sum with every estimate at the low and at the high end of its range. Totals are rounded
                to the nearest 1,000 USD and include resin, ordering, holding and stock on the way.
              </p>
            </Panel>

            <Panel className="order-4 p-4 lg:order-none" aria-label="Selected option">
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div>
                  <h2 className="text-14 font-semibold">
                    {optionName(selected.id)}
                    {selected.best ? ': best option' : `: rank ${selected.rank} of ${rows.length}`}
                  </h2>
                  <p className="text-12 text-textMuted">{SOURCE_NAME[selected.spec.source].supplier}</p>
                </div>
                <dl className="flex flex-wrap gap-x-8 gap-y-3">
                  <div>
                    <dt className="text-12 text-textMuted">Landed cost</dt>
                    <dd>
                      <Calc size="28" value={fmt(selected.chosen.unitCost, 3)} unit="USD/kg" title={calcTitle} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-12 text-textMuted">Order</dt>
                    <dd>
                      <Calc size="28" value={tonnes(selected.chosen.qty)} unit="t" title={calcTitle} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-12 text-textMuted">Reorder point</dt>
                    <dd>
                      <Calc
                        size="28"
                        value={tonnes(selected.reorderKg, 1)}
                        unit="t"
                        title="Demand during the lead time: demand a year x lead days / 365. No safety stock."
                      />
                    </dd>
                  </div>
                </dl>
              </div>
              <p className="mt-2 text-12 text-textMuted">
                {gapToNtg <= 0 ? `${fmt(-gapToNtg, 3)} USD/kg below` : `${fmt(gapToNtg, 3)} USD/kg above`} NTG&rsquo;s{' '}
                <Num size="12" value={fmt(NTG_PRICE, 2)} unit="USD/kg" datum={P.resinPriceUsdKg} />. The estimate runs from{' '}
                <span className="num">{fmt(selected.landedLow, 2)}</span> to <span className="num">{fmt(selected.landedHigh, 2)}</span>, so
                this gap is inside its range. Order again when stock on hand and on order falls to the reorder point:{' '}
                {selected.leadDays} days of demand.
              </p>

              <div className="mt-4 grid gap-x-8 gap-y-2 md:grid-cols-2">
                <div>
                  <SubHead>Price by order size (all units)</SubHead>
                  <dl>
                    {PRICE_TIERS.map((t, k) => {
                      const tc = selected.tiers[k];
                      if (!tc) return null;
                      const on = k === selected.chosen.tierIndex;
                      return (
                        <Line
                          key={t.label}
                          source={k === 0 ? selected.spec.price : (t.step ?? undefined)}
                          label={
                            <span className={on ? 'font-semibold text-text' : ''}>
                              {t.label}
                              {on ? ' (applied)' : ''}
                            </span>
                          }
                        >
                          <Est rec={k === 0 ? selected.spec.price : (t.step ?? selected.spec.price)} value={fmt(tc.unitPrice, 2)} unit="USD/kg" jump={jump} />
                        </Line>
                      );
                    })}
                  </dl>

                  <SubHead>Freight to plant</SubHead>
                  <dl>
                    {[...selected.spec.freight, ...selected.spec.destination].map((rec) => (
                      <Line key={rec.id} label={rec.label} source={rec}>
                        <Est
                          rec={rec}
                          value={selected.spec.mode === 'sea' ? fmt(rec.value) : fmt(rec.value, 2)}
                          unit={selected.spec.mode === 'sea' ? 'USD per 40 ft' : 'USD/kg'}
                          jump={jump}
                        />
                      </Line>
                    ))}
                    <Line
                      label={
                        selected.spec.mode === 'sea'
                          ? `Per kg, over ${fmt(P.deliveryLotT.value)} t a container`
                          : 'Per kg'
                      }
                    >
                      <Calc value={fmt(selected.freightPerKg + selected.destinationPerKg, 3)} unit="USD/kg" title={calcTitle} />
                    </Line>
                    {selected.spec.mode === 'sea' && (
                      <Line label="NTG container load" >
                        <Num value={fmt(P.deliveryLotT.value)} unit="t" datum={P.deliveryLotT} />
                      </Line>
                    )}
                  </dl>

                  <SubHead>Duty and VAT</SubHead>
                  <dl>
                    <Line label={selected.dutyRec.label} source={selected.dutyRec}>
                      <Est rec={selected.dutyRec} value={fmt(selected.dutyRec.value)} unit="%" jump={jump} />
                    </Line>
                    <Line label={SRC.extraCustomsFee.label} source={SRC.extraCustomsFee}>
                      <Est rec={SRC.extraCustomsFee} value={fmt(SRC.extraCustomsFee.value)} unit="%" jump={jump} />
                    </Line>
                    <Line label={`VAT, ${includeVat ? 'counted in landed cost' : 'paid and recovered, not in landed cost'}`} source={SRC.vat}>
                      <Calc value={fmt(chosenLanded?.vat ?? 0, 3)} unit="USD/kg" title="11% of price plus freight plus duty." />
                    </Line>
                  </dl>
                </div>

                <div>
                  <SubHead>Lead time, order to plant</SubHead>
                  <dl>
                    {selected.spec.lead.map((rec) => (
                      <Line key={rec.id} label={rec.label} source={rec}>
                        <Est rec={rec} value={rec.value} unit="days" jump={jump} />
                      </Line>
                    ))}
                    <Line label="Total">
                      <Calc value={selected.leadDays} unit="days" title="Sum of the parts above." />
                    </Line>
                    <Line label="NTG reports, for its present supply">
                      <Num
                        value={NTG_LEAD_DAYS}
                        unit="days"
                        tag={P.replenishLeadMonths.tag}
                        title={`${sourceTitle(P.replenishLeadMonths)}. ${P.replenishLeadMonths.value} months at 30 days.`}
                      />
                    </Line>
                    {selected.spec.mode === 'sea' && (
                      <Line label={`Cross-check: sea legs as drawn, ${fmt(seaNm)} nautical miles at an assumed ${SRC.shipSpeed.value} knots`}>
                        <Calc
                          value={fmt(sailingDays(seaNm, SRC.shipSpeed.value), 1)}
                          unit="days under way"
                          title="Length of the sea legs on the map divided by speed. Port and transshipment time come on top."
                        />
                      </Line>
                    )}
                  </dl>

                  <SubHead>Order size: each price tier tried</SubHead>
                  <dl>
                    {selected.eoq.perTier.map((t, k) => {
                      const label = PRICE_TIERS[k]?.label ?? '';
                      if (!t) return null;
                      const on = t.qty === selected.eoq.best.qty && k === selected.eoq.best.tierIndex;
                      return (
                        <Line
                          key={label}
                          label={
                            <span className={on ? 'font-semibold text-text' : ''}>
                              {label}: square-root size {tonnes(t.qStar, 1)} t, moved to {tonnes(t.qty)} t{on ? ' (EOQ)' : ''}
                            </span>
                          }
                        >
                          <Calc value={usdK(t.total)} unit="USD a year" title={calcTitle} />
                        </Line>
                      );
                    })}
                  </dl>

                  <p className="mt-1 text-12 text-textFaint">
                    The order sizes tried are within {fmt(tierSpread * 100, 1)}% of each other on the yearly total. Order size matters
                    far less here than the price per kilo.
                  </p>

                  <SubHead>Cost of a year at {tonnes(selected.chosen.qty)} t an order ({applied.label.toLowerCase()} price)</SubHead>
                  <dl>
                    <Line label={`Resin, landed: ${fmt(demandT)} t`}>
                      <Calc value={usdK(selected.chosen.purchase)} unit="USD" title={calcTitle} />
                    </Line>
                    <Line label={`Ordering: ${fmt(selected.chosen.ordersPerYear, 1)} orders`}>
                      <Calc value={fmt(selected.chosen.ordering)} unit="USD" title={calcTitle} />
                    </Line>
                    <Line label="Holding: half an order on average">
                      <Calc value={fmt(selected.chosen.holding)} unit="USD" title={calcTitle} />
                    </Line>
                    <Line label={`Stock on the way: ${selected.leadDays} days of demand`}>
                      <Calc value={fmt(selected.chosen.pipeline)} unit="USD" title={calcTitle} />
                    </Line>
                    <Line label="Fixed cost of one order">
                      <Est rec={ORDER_COST_LINES[0]!} value={fmt(ORDER_COST_USD)} unit="USD" jump={jump} />
                    </Line>
                  </dl>
                </div>
              </div>
              {perLot === 1 && (
                <p className="mt-3 text-12 text-textFaint">
                  Air cargo is costed by the tonne. A year of resin by air costs about three times the sea total: it is here to show what
                  speed costs, for a part load in an emergency.
                </p>
              )}
            </Panel>
          </div>
        </div>

        <Panel className="p-4" aria-label="Sources">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-14 font-semibold">Sources and assumptions</h2>
            <p className="max-w-[90ch] text-12 text-textMuted">{RETRIEVAL_NOTE}</p>
          </div>
          <h3 className="mb-2 text-12 font-semibold">Used in the table now</h3>
          <RecordList records={usedRecords} marked={marked} />
          <h3 className="mb-2 mt-5 text-12 font-semibold">Benchmarks and figures for the other settings</h3>
          <RecordList records={otherRecords} marked={marked} />
        </Panel>
      </main>
    </div>
  );
}

function RecordList({ records, marked }: { records: SourceRecord[]; marked: string | null }) {
  return (
    <ul className="grid gap-x-8 md:grid-cols-2">
      {records.map((r) => (
        <li
          key={r.id}
          id={`src-${r.id}`}
          tabIndex={-1}
          className={[
            'scroll-mt-16 border-t border-hairline py-2 text-12',
            marked === r.id ? 'outline outline-1 outline-offset-2 outline-textMuted' : '',
          ].join(' ')}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-text">{r.label}</span>
            <Num size="12" value={fmt(r.value, Number.isInteger(r.value) ? 0 : 2)} unit={r.unit} tag="S" title={recordTitle(r)} />
          </div>
          <p className="text-textMuted">
            {BASIS_LABEL[r.basis]}
            {r.low !== r.high ? `. Range ${rangeText(r)}` : ''}.{' '}
            {r.sourceUrl ? <ExternalLink url={r.sourceUrl}>{r.sourceTitle}</ExternalLink> : null}
          </p>
          <p className="text-textFaint">{r.note}</p>
        </li>
      ))}
    </ul>
  );
}
