/**
 * Dashboard chrome (style bible): top bar with the scene switcher, left panel
 * with one row per arm, right panel with three KPIs, bottom bar with playback
 * and the shift timeline. Panels are solid, hairline-bordered, and collapse.
 */
import { useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { clock, SPEEDS, useTwin, type SceneId } from '../app/store';
import { palette, neutral, motion as M } from '../design/tokens';
import { P, SKUS } from '../data/params';
import { stateAt } from '../sim/state';
import { STATION_LABEL } from '../sim/config';
import type { PlantState, SimResult } from '../sim/types';
import { Button, Num, Panel, clock as hmm, minSec, sourceTitle } from './kit';
import { BackIcon, PanelsIcon, PauseIcon, PlayIcon, RestartIcon, SlidersIcon } from './icons';
import { mouldsLabel, stageView } from './stage';

const SCENES: { id: SceneId; label: string }[] = [
  { id: 'machine', label: 'Machine' },
  { id: 'raw', label: 'Raw material' },
  { id: 'redesign', label: 'Redesign' },
  { id: 'plan', label: 'Plan' },
  { id: 'sourcing', label: 'Sourcing' },
  { id: 'report', label: 'Report' },
];
const ease = M.easeInOut as unknown as [number, number, number, number];
const slide = (x: number) => ({ initial: { opacity: 0, x }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x }, transition: { duration: M.ui / 1000, ease } });

/** Plant state for the panels, refreshed with the throttled clock. */
export function useUiState(): PlantState {
  const result = useTwin((s) => s.result);
  const tUi = useTwin((s) => s.tUi);
  return useMemo(() => stateAt(tUi, result), [tUi, result]);
}

export function TopBar() {
  const { scene, setScene, playing, tUi, result, panelsOpen, drawerOpen, set } = useTwin();
  const over = tUi >= result.config.shiftMin;
  return (
    <header className="pointer-events-auto flex h-12 items-center gap-3 border-b border-hairline bg-panel px-3 md:px-4">
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="truncate text-14 font-semibold">NTG Machine 3700</h1>
        <span className="hidden text-12 text-textMuted lg:inline">digital twin</span>
      </div>
      <div className="hidden items-center gap-2 border-l border-hairline pl-3 sm:flex" aria-live="off">
        <span className={`h-2 w-2 rounded-full ${playing ? 'bg-coolTeal' : 'bg-textFaint'}`} aria-hidden="true" />
        <span className="text-12 text-textMuted">{playing ? 'Running' : tUi >= result.endMin - 1e-6 ? 'Shift done' : 'Paused'}</span>
        <span className="num text-14" title="Simulated time since the start of the shift">
          {hmm(tUi)}
        </span>
        <span className="text-12 text-textMuted">of {hmm(result.config.shiftMin)} h{over ? ', run-out' : ''}</span>
      </div>
      <nav aria-label="Scenes" className="ml-auto flex min-w-0 items-center gap-1 overflow-x-auto">
        {SCENES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setScene(s.id)}
            aria-current={scene === s.id ? 'page' : undefined}
            className={[
              'whitespace-nowrap rounded-control px-2.5 py-1 text-12 transition-colors duration-150 ease-machine',
              scene === s.id ? 'bg-text text-canvas' : 'text-textMuted hover:bg-hairline hover:text-text',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="flex items-center gap-1 border-l border-hairline pl-2">
        <Button aria-label={panelsOpen ? 'Hide panels' : 'Show panels'} aria-pressed={!panelsOpen} title={panelsOpen ? 'Hide panels' : 'Show panels'} onClick={() => set({ panelsOpen: !panelsOpen })} className="!px-1.5">
          <PanelsIcon />
        </Button>
        <Button aria-label="Set-up" aria-pressed={drawerOpen} title="Set-up: arms, layers, shift" onClick={() => set({ drawerOpen: !drawerOpen })} className="flex items-center gap-1.5">
          <SlidersIcon />
          <span className="hidden md:inline">Set-up</span>
        </Button>
      </div>
    </header>
  );
}

export function ArmsPanel({ state, result }: { state: PlantState; result: SimResult }) {
  return (
    <Panel aria-label="Arms" className="pointer-events-auto w-full p-3 md:w-72">
      <header className="mb-2 flex items-baseline justify-between">
        <h2 className="text-14 font-semibold">Arms</h2>
        <span className="text-12 text-textMuted">stage, time left or waiting</span>
      </header>
      <ul className="grid gap-2.5">
        {state.arms.map((a) => {
          const v = stageView(a, result.config.layers);
          const timed = a.stage !== 'idle' && !(v.waiting && a.stage !== 'waitDemould');
          return (
            <li key={a.id} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-14 font-medium">Arm {a.id + 1}</span>
                <span className="truncate text-12 text-textMuted">{mouldsLabel(a.moulds)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-12">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: v.color }} aria-hidden="true" />
                  <span className="truncate">{v.label}</span>
                </span>
                {a.stage !== 'idle' && (
                  <Num
                    size="12"
                    value={minSec(v.waiting && a.stage !== 'waitDemould' ? a.waitingMin : a.stageRemainingMin)}
                    unit={v.waiting && a.stage !== 'waitDemould' ? 'waiting' : 'left'}
                    tag="C"
                    title="Calculated by the simulator from the inventory times"
                  />
                )}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-hairline" role="progressbar" aria-label={`Arm ${a.id + 1}: ${v.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(a.stageProgress * 100)}>
                <div className="h-full" style={{ width: `${(timed ? a.stageProgress : 1) * 100}%`, background: v.color }} />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function KpiPanel({ state, result }: { state: PlantState; result: SimResult }) {
  const k = result.kpis;
  const made = SKUS.reduce((s, x) => s + state.tanksOut[x], 0);
  const planned = SKUS.reduce((s, x) => s + k.planned[x], 0);
  // Oven use so far: share of elapsed shift time the oven has held an arm.
  const t = Math.min(state.t, result.config.shiftMin);
  const held = result.oven.reduce((s, o) => s + (o.state === 'heating' || o.state === 'pause' ? Math.max(0, Math.min(o.t1, t) - o.t0) : 0), 0);
  const util = t > 0 ? held / t : 0;
  const waiters = state.arms.filter((a) => a.stage === 'waitOven' || a.stage === 'blocked');
  const longest = waiters.reduce((m, a) => Math.max(m, a.waitingMin), 0);
  const bn = state.bottleneck;
  return (
    <Panel aria-label="Key figures" className="pointer-events-auto w-full p-3 md:w-72">
      <dl className="grid gap-3">
        <div>
          <dt className="text-12 text-textMuted">Tanks out of the mould, against plan</dt>
          <dd className="flex items-baseline gap-2">
            <Num size="28" value={made} tag="C" title="Counted by the simulator" />
            <span className="text-14 text-textMuted">of</span>
            <Num size="14" value={planned} datum={P.cyclesPerMouldPerDay} title={`Plan = moulds x ${P.cyclesPerMouldPerDay.value} cycles a day. ${sourceTitle(P.cyclesPerMouldPerDay)}`} />
          </dd>
          <dd className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-12 text-textMuted">
            {SKUS.map((s) => (
              <span key={s}>
                {s} <span className="num text-text">{state.tanksOut[s]}</span>/<span className="num">{k.planned[s]}</span>
              </span>
            ))}
          </dd>
        </div>
        <div className="border-t border-hairline pt-3">
          <dt className="text-12 text-textMuted">Oven in use, shift so far</dt>
          <dd className="flex items-baseline gap-2">
            <Num size="28" value={Math.round(util * 100)} unit="%" tag="C" title="Minutes the oven held an arm, divided by minutes elapsed" />
          </dd>
          <dd className="mt-1 text-12 text-textMuted">
            Oven air <span className="num text-text">{Math.round(state.oven.tempC)}</span> °C{' '}
            <span className="inline-block align-middle">
              <Num size="12" value="" datum={P.ovenTempC} title={`Set point is the middle of a researched range, not an NTG reading. ${sourceTitle(P.ovenTempC)}`} />
            </span>
          </dd>
        </div>
        <div className="border-t border-hairline pt-3">
          <dt className="text-12 text-textMuted">Current bottleneck</dt>
          <dd className="flex items-baseline gap-2">
            <span className="text-28 font-medium">{bn === 'none' ? 'None' : bn === 'crew' ? 'Crew' : STATION_LABEL[bn]}</span>
            <span className="self-center">
              <Num value="" tag="C" title="The position arms are waiting for, from the simulator's queue" />
            </span>
          </dd>
          <dd className="mt-1 flex items-center gap-1.5 text-12 text-textMuted">
            {waiters.length > 0 ? (
              <>
                <span className="h-2 w-2 rounded-full bg-alertRed" aria-hidden="true" />
                <span>
                  <span className="num text-text">{waiters.length}</span> arm{waiters.length > 1 ? 's' : ''} waiting, longest <span className="num text-text">{minSec(longest)}</span>
                </span>
              </>
            ) : (
              <span>No arm waiting right now</span>
            )}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}

const OVEN_FILL: Record<string, string> = { heating: palette.heatAmber, pause: '#9A6A2C', door: neutral.textFaint, idle: neutral.hairline };

export function BottomBar({ result }: { result: SimResult }) {
  const { playing, speed, setPlaying, setSpeed, seek, tUi } = useTwin();
  const track = useRef<HTMLDivElement>(null);
  const end = result.endMin;
  const shift = result.config.shiftMin;
  const scrub = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    seek(((clientX - r.left) / r.width) * end);
  };
  return (
    <Panel aria-label="Playback" className="pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-2 p-2.5 md:flex-nowrap">
      <div className="flex items-center gap-1.5">
        <Button onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'} className="flex items-center gap-1.5 !px-3 !py-1.5" active={playing}>
          {playing ? <PauseIcon /> : <PlayIcon />}
          <span>{playing ? 'Pause' : 'Play'}</span>
        </Button>
        <Button onClick={() => (seek(0), setPlaying(false))} aria-label="Back to the start of the shift" title="Back to the start of the shift" className="!px-2 !py-1.5">
          <RestartIcon />
        </Button>
      </div>
      <div role="radiogroup" aria-label="Playback speed" className="flex items-center rounded-control border border-hairlineStrong">
        {SPEEDS.map((s, i) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={speed === s}
            onClick={() => setSpeed(s)}
            title={s === 100 ? 'One 120 min arm cycle plays in 1.2 min' : `${s} simulated seconds per second`}
            className={['num px-2 py-1 text-12 transition-colors duration-150 ease-machine', i > 0 ? 'border-l border-hairlineStrong' : '', speed === s ? 'bg-text text-canvas' : 'text-text hover:bg-hairline'].join(' ')}
          >
            {s}x
          </button>
        ))}
      </div>
      <div className="order-last w-full min-w-0 md:order-none md:w-auto md:flex-1">
        <div
          ref={track}
          role="slider"
          tabIndex={0}
          aria-label="Shift timeline, coloured by oven state"
          aria-valuemin={0}
          aria-valuemax={Math.round(end)}
          aria-valuenow={Math.round(tUi)}
          aria-valuetext={`${hmm(tUi)} into the shift`}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            scrub(e.clientX);
          }}
          onPointerMove={(e) => e.buttons === 1 && scrub(e.clientX)}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 30 : 5;
            if (e.key === 'ArrowRight') seek(clock.t + step);
            else if (e.key === 'ArrowLeft') seek(clock.t - step);
            else if (e.key === 'Home') seek(0);
            else if (e.key === 'End') seek(end);
            else if (e.key === ' ') setPlaying(!playing);
            else return;
            e.preventDefault();
          }}
          className="relative h-7 cursor-pointer touch-none select-none"
        >
          <svg className="absolute inset-x-0 top-1.5 h-4 w-full overflow-hidden rounded-control" preserveAspectRatio="none" viewBox={`0 0 ${end} 10`} aria-hidden="true">
            {result.oven.map((o, i) => (
              <rect key={i} x={o.t0} width={Math.max(0, o.t1 - o.t0)} y={0} height={10} fill={OVEN_FILL[o.state]} />
            ))}
            {end > shift && <rect x={shift} width={end - shift} y={0} height={10} fill={palette.canvas} opacity={0.55} />}
          </svg>
          {/* Hour ticks */}
          {Array.from({ length: Math.floor(end / 60) }, (_, i) => (
            <span key={i} className="absolute top-1.5 h-4 w-px bg-canvas/60" style={{ left: `${(((i + 1) * 60) / end) * 100}%`, background: 'rgba(15,18,20,0.55)' }} aria-hidden="true" />
          ))}
          {end > shift && <span className="absolute top-0 h-7 w-px bg-text" style={{ left: `${(shift / end) * 100}%` }} title="End of the 8.5 h shift" aria-hidden="true" />}
          <span className="absolute top-0 h-7 w-0.5 -translate-x-1/2 rounded-full bg-text" style={{ left: `${(tUi / end) * 100}%` }} aria-hidden="true" />
        </div>
      </div>
      <div className="flex items-center gap-3 text-12 text-textMuted">
        <span className="num text-14 text-text">{hmm(tUi)}</span>
        <ul className="hidden items-center gap-2.5 xl:flex" aria-label="Timeline legend">
          {[
            ['Heating', OVEN_FILL.heating],
            ['Layer pause', OVEN_FILL.pause],
            ['Arm change', OVEN_FILL.door],
            ['Oven empty', OVEN_FILL.idle],
          ].map(([label, c]) => (
            <li key={label} className="flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm" style={{ background: c, borderRadius: 2 }} aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

/** Breadcrumb and Back key for the raw-material scene. */
export function Breadcrumb() {
  const { scene, setScene } = useTwin();
  if (scene !== 'raw') return null;
  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <Button onClick={() => setScene('machine')} className="flex items-center gap-1">
        <BackIcon /> Back
      </Button>
      <span className="rounded-control border border-hairline bg-panel px-2 py-1 text-12 text-textMuted">
        Machine 3700 / <span className="text-text">Raw material</span>
      </span>
    </div>
  );
}

export function PanelSlot({ show, from, children }: { show: boolean; from: 'left' | 'right'; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div {...slide(from === 'left' ? -12 : 12)} className="pointer-events-none">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
