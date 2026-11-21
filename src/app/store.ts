/**
 * App state. The simulation result is recomputed whenever the configuration
 * changes; the clock only chooses which minute of that result is shown.
 */
import { create } from 'zustand';
import { defaultConfig } from '../sim/config';
import { runSimulation } from '../sim/engine';
import type { SimConfig, SimResult, StationId } from '../sim/types';

export type SceneId = 'machine' | 'raw' | 'sourcing' | 'redesign' | 'plan' | 'report';
export const SPEEDS = [1, 10, 60, 100, 300, 600] as const;

/** The simulated minute being shown. Mutated every frame; not React state. */
export const clock = { t: 0 };

interface Twin {
  config: SimConfig;
  result: SimResult;
  playing: boolean;
  speed: number;
  scene: SceneId;
  selected: StationId | null;
  drawerOpen: boolean;
  panelsOpen: boolean;
  /** Scenes update in steps instead of tweening (follows the system setting; can be switched in Set-up). */
  reduced: boolean;
  /** Skip ambient occlusion and bloom, for slower laptops. */
  simpleLight: boolean;
  /** Show the N / V / C / S source letters beside numbers. Off by default for a clean screen. */
  showSources: boolean;
  /** The clock, copied a few times a second for the panels. */
  tUi: number;
  setConfig: (patch: Partial<SimConfig>) => void;
  resetConfig: () => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  /** Goes up each time the camera should fly to the current view (tab, station click, Reset view). Dragging never changes it. */
  viewNonce: number;
  setScene: (s: SceneId) => void;
  /** Dragging across the plant changes which area the panels describe, without moving the camera. */
  setArea: (s: 'machine' | 'raw') => void;
  select: (s: StationId | null, fly?: boolean) => void;
  resetView: () => void;
  seek: (t: number) => void;
  set: (p: Partial<Pick<Twin, 'drawerOpen' | 'panelsOpen' | 'tUi' | 'reduced' | 'simpleLight' | 'showSources'>>) => void;
}

const first = defaultConfig();

export const useTwin = create<Twin>((set, get) => ({
  config: first,
  result: runSimulation(first),
  playing: false,
  // 100x: one 120 min arm cycle plays in 1.2 min.
  speed: 100,
  scene: 'machine',
  selected: null,
  drawerOpen: false,
  panelsOpen: true,
  reduced: typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  simpleLight: false,
  showSources: false,
  tUi: 0,
  setConfig: (patch) => {
    const config = { ...get().config, ...patch };
    const result = runSimulation(config);
    clock.t = Math.min(clock.t, result.endMin);
    set({ config, result, tUi: clock.t });
  },
  resetConfig: () => {
    const config = defaultConfig();
    clock.t = 0;
    set({ config, result: runSimulation(config), tUi: 0, playing: false });
  },
  setPlaying: (playing) => {
    if (playing && clock.t >= get().result.endMin - 1e-6) clock.t = 0;
    set({ playing, tUi: clock.t });
  },
  setSpeed: (speed) => set({ speed }),
  viewNonce: 0,
  setScene: (scene) => set({ scene, selected: null, viewNonce: get().viewNonce + 1 }),
  setArea: (scene) => get().scene !== scene && set({ scene }),
  select: (selected, fly = true) => set({ selected, viewNonce: get().viewNonce + (fly && selected ? 1 : 0) }),
  resetView: () => set({ selected: null, viewNonce: get().viewNonce + 1 }),
  seek: (t) => {
    clock.t = Math.min(Math.max(0, t), get().result.endMin);
    set({ tUi: clock.t });
  },
  set: (p) => set(p),
}));

/** Advance the clock. Call once per animation frame with the real milliseconds elapsed. */
export function tick(realMs: number) {
  const s = useTwin.getState();
  if (!s.playing) return;
  // Cap the step so a background tab does not jump the shift forward.
  const dt = (Math.min(realMs, 100) / 60000) * s.speed;
  clock.t = Math.min(s.result.endMin, clock.t + dt);
  if (clock.t >= s.result.endMin - 1e-9) useTwin.setState({ playing: false, tUi: clock.t });
}
