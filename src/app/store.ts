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
  /** The clock, copied a few times a second for the panels. */
  tUi: number;
  setConfig: (patch: Partial<SimConfig>) => void;
  resetConfig: () => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  setScene: (s: SceneId) => void;
  select: (s: StationId | null) => void;
  seek: (t: number) => void;
  set: (p: Partial<Pick<Twin, 'drawerOpen' | 'panelsOpen' | 'tUi'>>) => void;
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
  setScene: (scene) => set({ scene, selected: null }),
  select: (selected) => set({ selected }),
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
