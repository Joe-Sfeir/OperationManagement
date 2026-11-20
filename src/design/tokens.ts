/**
 * Design tokens for the Machine 3700 twin.
 *
 * Source of truth: docs/STYLE_BIBLE.md ("Visual system"). Values marked
 * `bible` are copied from it verbatim. Values marked `derived` are not in the
 * bible; they are neutral fills the interface needs (text, hairlines) and are
 * logged in docs/BUILD_LOG.md. Nothing here is a claim about the plant.
 *
 * Used by: tailwind.config.ts (panels) and the three.js scene (materials,
 * lights, camera). Keep both reading from this file.
 */

/** Palette from the photos. `bible` */
export const palette = {
  canvas: '#0F1214', // page and scene background
  panel: '#161A1D', // dashboard panels
  machineCream: '#D9CFB8', // oven cabinet, platforms, hub
  ntgBlue: '#2F6FC9', // sliding doors, motors, cooling shell
  mouldBlack: '#1E1F21', // moulds
  floorEpoxy: '#2C4638', // machine floor area
  safetyYellow: '#F2C230', // yellow line from the manual
  heatAmber: '#F2A33A', // oven, heat, the bottleneck. The only warm accent
  coolTeal: '#4FB3A6', // cooling stage
  alertRed: '#D0534A', // waiting or blocked
} as const;

/**
 * Interface neutrals. `derived`: cool greys between Canvas and Machine cream so
 * they carry no meaning of their own. Contrast against Panel (#161A1D):
 * text 13.7:1, textMuted 7.2:1, textFaint 4.8:1 (all pass WCAG AA at 12 px).
 *
 * Note: Alert red is 4.2:1 on Panel, below AA for 12-14 px text. Use it for
 * fills, rings and bars only; waiting timers are set in `text` beside a red mark.
 */
export const neutral = {
  hairline: '#2A3035', // 1 px panel border, dividers
  hairlineStrong: '#3A4247', // focus-adjacent borders, slider track
  text: '#E6E3DC', // primary text
  textMuted: '#A0A7AC', // secondary text, units
  textFaint: '#7F878C', // tertiary text, disabled
  steelLight: '#C3C9CD', // loading stage bar
  steelMid: '#8A949B', // demould stage bar
} as const;

export const color = { ...palette, ...neutral } as const;
export type ColorToken = keyof typeof color;

/**
 * Stage colours. Oven = heat, cooling = cool, waiting = alert. Loading and
 * demould are neutral activities, so they stay neutral steel (rule 3).
 * Stage colour is never the only cue: every bar carries its stage name.
 */
export const stageColor = {
  loading: neutral.steelLight,
  oven: palette.heatAmber,
  cooling: palette.coolTeal,
  demould: neutral.steelMid,
  waiting: palette.alertRed,
  indexing: neutral.textFaint,
} as const;
export type StageColorKey = keyof typeof stageColor;

/** Provenance tags (hard rule 2). Neutral by design; S is drawn dashed. */
export const provenance = {
  N: { label: 'NTG reported', dashed: false },
  V: { label: 'Team visit', dashed: false },
  C: { label: 'Calculated', dashed: false },
  S: { label: 'Synthetic or researched estimate', dashed: true },
} as const;
export type ProvenanceTag = keyof typeof provenance;

/** Type: IBM Plex, three sizes only. `bible` */
export const font = {
  sans: '"IBM Plex Sans", system-ui, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, monospace',
} as const;

export const typeScale = {
  12: { size: 12, lineHeight: 16 },
  14: { size: 14, lineHeight: 20 },
  28: { size: 28, lineHeight: 32 },
} as const;

export const fontWeight = { regular: 400, medium: 500, semibold: 600 } as const;

/** Shape. Panels 8 px radius, 1 px hairline (`bible`); small controls 4 px (`derived`). */
export const radius = { control: 4, panel: 8 } as const;
export const hairline = 1;
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32 } as const;

/**
 * Motion. Interface 150 to 250 ms; camera presets 1.2 s; scene transition
 * about 1.4 s; everything ease-in-out with no overshoot. `bible`
 * Machine motion takes its duration from simulation time, not from here.
 */
export const motion = {
  uiFast: 150,
  ui: 200,
  uiSlow: 250,
  cameraPreset: 1200,
  sceneTransition: 1400,
  /** CSS / Framer cubic-bezier for ease-in-out. Control points stay inside [0,1]: no overshoot. */
  easeInOut: [0.42, 0, 0.58, 1] as const,
} as const;

/** Cubic ease-in-out for hand-written tweens (camera, arms). Monotonic, no overshoot. */
export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Camera: orthographic, true isometric, locked. `bible` */
export const camera = {
  azimuthDeg: 45,
  /** True isometric elevation, atan(1/sqrt 2) = 35.264 deg ("about 35 deg down"). */
  elevationDeg: (Math.atan(1 / Math.SQRT2) * 180) / Math.PI,
  presets: ['plant', 'machine', 'station'] as const,
} as const;
export type CameraPreset = (typeof camera.presets)[number];

/**
 * Light rig. Direction is `bible` (warm key top left, cool fill, AO).
 * Colours and intensities are starting values, to be tuned against the
 * approved hero concept in M2.
 */
export const light = {
  key: { color: '#FFF0DA', intensity: 2.4 },
  fill: { color: '#CADBEA', intensity: 0.6 },
  ambient: { color: '#FFFFFF', intensity: 0.25 },
  ovenPractical: { color: palette.heatAmber },
} as const;

/**
 * Materials. Finishes are `bible`; roughness and metalness numbers are
 * starting values for MeshStandardMaterial, tuned in M2.
 */
export const material = {
  paintedSteel: { roughness: 0.75, metalness: 0.1 }, // cabinets
  brushedSteel: { roughness: 0.38, metalness: 0.85 }, // arms, frames
  blackenedSteel: { roughness: 0.42, metalness: 0.55 }, // moulds, faint sheen
  polyethylene: { roughness: 0.55, metalness: 0.0 }, // tanks, satin
  powder: { roughness: 0.95, metalness: 0.0 }, // white matte, no sparkle
  epoxy: { roughness: 0.6, metalness: 0.0 }, // floor
} as const;

/** Rendering budget for M7 (`brief`). */
export const budget = { maxTriangles: 200_000, maxPixelRatio: 2, targetFps: 60 } as const;
