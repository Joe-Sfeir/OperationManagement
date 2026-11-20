import {
  palette,
  neutral,
  stageColor,
  provenance,
  motion,
  camera,
  easeInOutCubic,
  type ProvenanceTag,
  type StageColorKey,
} from './tokens';
import { SourceBadge } from './SourceBadge';

/** Usage notes copied from STYLE_BIBLE.md, Palette table. */
const paletteRows: { key: keyof typeof palette; name: string; use: string }[] = [
  { key: 'canvas', name: 'Canvas', use: 'Page and scene background' },
  { key: 'panel', name: 'Panel', use: 'Dashboard panels, 1 px hairline border' },
  { key: 'machineCream', name: 'Machine cream', use: 'Oven cabinet, platforms, hub' },
  { key: 'ntgBlue', name: 'NTG blue', use: 'Sliding doors, motors, cooling shell' },
  { key: 'mouldBlack', name: 'Mould black', use: 'Moulds, slightly glossy' },
  { key: 'floorEpoxy', name: 'Floor epoxy', use: 'Machine floor area' },
  { key: 'safetyYellow', name: 'Safety yellow', use: 'Yellow line from the manual' },
  { key: 'heatAmber', name: 'Heat amber', use: 'Oven, heat, the bottleneck. The only warm accent' },
  { key: 'coolTeal', name: 'Cool teal', use: 'Cooling stage' },
  { key: 'alertRed', name: 'Alert red', use: 'Waiting or blocked' },
];

const neutralRows: { key: keyof typeof neutral; use: string }[] = [
  { key: 'text', use: 'Primary text' },
  { key: 'textMuted', use: 'Secondary text, units' },
  { key: 'textFaint', use: 'Tertiary text' },
  { key: 'hairline', use: 'Panel border' },
  { key: 'hairlineStrong', use: 'Badge and track border' },
  { key: 'steelLight', use: 'Loading stage' },
  { key: 'steelMid', use: 'Demould stage' },
];

const stageRows: { key: StageColorKey; label: string; fill: number }[] = [
  { key: 'loading', label: 'Loading', fill: 0.35 },
  { key: 'oven', label: 'Oven', fill: 0.7 },
  { key: 'cooling', label: 'Cooling', fill: 0.5 },
  { key: 'demould', label: 'Demould', fill: 0.2 },
  { key: 'waiting', label: 'Waiting for oven', fill: 1 },
];

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="panel p-4">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-14 font-semibold">{title}</h2>
        {note && <p className="text-12 text-textMuted">{note}</p>}
      </header>
      {children}
    </section>
  );
}

function Swatch({ hex, name, use, light }: { hex: string; name: string; use: string; light?: boolean }) {
  return (
    <li className="flex min-w-0 flex-col gap-2">
      <div
        className="h-14 rounded-control border border-hairline"
        style={{ background: hex }}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-12 font-medium">{name}</p>
        <p className="num text-12 text-textMuted">{hex}</p>
        <p className={light ? 'text-12 text-textFaint' : 'text-12 text-textMuted'}>{use}</p>
      </div>
    </li>
  );
}

/** Static plot of the machine ease, to check visually that it never overshoots. */
function EaseCurve() {
  const w = 160;
  const h = 96;
  const pts = Array.from({ length: 41 }, (_, i) => {
    const t = i / 40;
    return `${(t * w).toFixed(1)},${(h - easeInOutCubic(t) * h).toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`-4 -4 ${w + 8} ${h + 8}`} width={w + 8} height={h + 8} role="img" aria-label="Ease-in-out curve, no overshoot">
      <rect x="0" y="0" width={w} height={h} fill="none" stroke={neutral.hairline} />
      <polyline points={pts} fill="none" stroke={neutral.text} strokeWidth="1.5" />
    </svg>
  );
}

export function TokenSheet() {
  return (
    <div className="min-h-full">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline px-4 py-3 md:px-6">
        <h1 className="text-14 font-semibold">Machine 3700 twin</h1>
        <p className="text-12 text-textMuted">Design tokens from docs/STYLE_BIBLE.md. M0 check page, not plant data.</p>
      </header>

      <main className="mx-auto grid max-w-[1520px] gap-4 p-4 md:p-6 lg:grid-cols-12">
        <div className="lg:col-span-12">
          <Section title="Palette" note="From the photos. Hex values are the bible's.">
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-5 xl:grid-cols-10">
              {paletteRows.map((r) => (
                <Swatch key={r.key} hex={palette[r.key]} name={r.name} use={r.use} />
              ))}
            </ul>
          </Section>
        </div>

        <div className="lg:col-span-7">
          <Section title="Type" note="IBM Plex Sans and Mono. Three sizes: 28, 14, 12.">
            <div className="grid gap-4">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <p className="text-28 font-medium">Cooking chamber</p>
                <p className="num text-28">0123456789</p>
                <p className="text-12 text-textMuted">28 px, KPI values and scene titles</p>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <p className="text-14">Arm in oven, layer of mould, demould to buffer</p>
                <p className="num text-14">0123456789 kg min</p>
                <p className="text-12 text-textMuted">14 px, body and panel rows</p>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <p className="text-12">Silo, hopper, pulveriser, extruder</p>
                <p className="num text-12">0123456789 00:00:00</p>
                <p className="text-12 text-textMuted">12 px, labels and units</p>
              </div>
              <p className="text-12 text-textMuted">
                Figures in Mono are tabular, so timers keep their width as they count.
              </p>
            </div>
          </Section>
        </div>

        <div className="lg:col-span-5">
          <Section title="Source badges" note="Shown next to every number.">
            <ul className="grid gap-2">
              {(Object.keys(provenance) as ProvenanceTag[]).map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <SourceBadge tag={t} />
                  <span className="text-14">{provenance[t].label}</span>
                  {provenance[t].dashed && <span className="text-12 text-textMuted">dashed: an estimate</span>}
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="lg:col-span-5">
          <Section title="Stage colours" note="Specimen bars, not plant data.">
            <ul className="grid gap-3">
              {stageRows.map((r) => (
                <li key={r.key} className="grid grid-cols-[9rem_1fr] items-center gap-3">
                  <span className="flex items-center gap-2 text-14">
                    <span className="h-2 w-2 rounded-full" style={{ background: stageColor[r.key] }} aria-hidden="true" />
                    {r.label}
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-hairline" aria-hidden="true">
                    <span className="block h-full" style={{ width: `${r.fill * 100}%`, background: stageColor[r.key] }} />
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-12 text-textMuted">
              Loading and demould stay neutral steel. Amber is reserved for heat.
            </p>
          </Section>
        </div>

        <div className="lg:col-span-4">
          <Section title="Interface neutrals" note="Not in the bible; logged in BUILD_LOG.">
            <ul className="grid grid-cols-[2rem_1fr] items-center gap-x-3 gap-y-2">
              {neutralRows.map((r) => (
                <li key={r.key} className="contents">
                  <span className="h-5 w-8 rounded-control border border-hairline" style={{ background: neutral[r.key] }} aria-hidden="true" />
                  <span className="text-12">
                    <span className="num text-textMuted">{neutral[r.key]}</span> {r.use}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="lg:col-span-3">
          <Section title="Motion">
            <EaseCurve />
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-12">
              <dt className="text-textMuted">Interface</dt>
              <dd className="num">{motion.uiFast} to {motion.uiSlow} ms</dd>
              <dt className="text-textMuted">Camera preset</dt>
              <dd className="num">{motion.cameraPreset} ms</dd>
              <dt className="text-textMuted">Scene change</dt>
              <dd className="num">{motion.sceneTransition} ms</dd>
              <dt className="text-textMuted">Camera</dt>
              <dd className="num">
                {camera.azimuthDeg}°, {camera.elevationDeg.toFixed(1)}°
              </dd>
            </dl>
          </Section>
        </div>
      </main>
    </div>
  );
}
