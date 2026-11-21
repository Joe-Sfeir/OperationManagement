/**
 * The shared stage every 3D view uses: one camera at a fixed isometric angle
 * (45 degrees round, about 35 down) with a long lens, one light rig, one set of
 * post effects. In the main view the user drags to move across the plant and
 * scrolls or pinches to zoom; the angle never changes.
 */
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, N8AO, Bloom, ToneMapping, SMAA } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { budget, easeInOutCubic, light, motion, palette } from '../design/tokens';

export interface View {
  /** World point the camera looks at. */
  target: [number, number, number];
  /** Metres that must fit across the view at the target, horizontally and vertically. */
  span: [number, number];
  /** Screen pixels kept clear of the subject: [left, right, top, bottom]. Panels sit there. */
  pad?: [number, number, number, number];
}

/** Lens: long enough that the plant still reads as a scale model, short enough to give depth. */
const FOV = 26;
const TAN = Math.tan((FOV / 2) * (Math.PI / 180));
const ISO = new THREE.Vector3(1, 1, 1).normalize();
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const UP = new THREE.Vector3().crossVectors(RIGHT, ISO).normalize().multiplyScalar(-1);
/** Direction on the floor that points up the screen. */
const AWAY = new THREE.Vector3(-1, 0, -1).normalize();
const SIN_ELEV = ISO.y;
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/** Where to look and from how far so the view's span fits in the area the panels leave clear. */
function fit(view: View, w: number, h: number) {
  const [l, r, t, b] = view.pad ?? [0, 0, 0, 0];
  const availW = Math.max(120, w - l - r);
  const availH = Math.max(120, h - t - b);
  const visibleH = Math.max((view.span[1] * h) / availH, (view.span[0] * h) / availW);
  const perPx = visibleH / h;
  const target = new THREE.Vector3(...view.target).addScaledVector(RIGHT, ((r - l) / 2) * perPx).addScaledVector(UP, ((t - b) / 2) * perPx);
  return { target, dist: visibleH / (2 * TAN) };
}

export interface Bounds {
  /** World x and z limits for the point the camera looks at. */
  x: [number, number];
  z: [number, number];
  /** Fewest and most metres visible top to bottom. */
  visible: [number, number];
}

/** Buttons outside the canvas (zoom in, zoom out) reach the camera through this. */
export const cameraApi: { zoomBy: (factor: number) => void } = { zoomBy: () => {} };

interface RigProps {
  view: View;
  /** When this number changes, the camera flies to `view`. */
  flyKey: number;
  durationMs: number;
  reduced: boolean;
  interactive: boolean;
  bounds?: Bounds;
  onMove?: (target: THREE.Vector3, flying: boolean) => void;
}

/**
 * Camera rig. Flights are hand-written tweens, ease-in-out with no overshoot,
 * and pull back a little on long hops. Dragging moves the look-at point along
 * the floor so the spot under the pointer stays under it.
 */
function CameraRig({ view, flyKey, durationMs, reduced, interactive, bounds, onMove }: RigProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const first = useMemo(() => fit(view, size.width, size.height), []); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = useRef({ target: first.target.clone(), dist: first.dist });
  const goal = useRef({ target: first.target.clone(), dist: first.dist });
  const flight = useRef<{ t0: number; from: THREE.Vector3; fromDist: number; to: THREE.Vector3; toDist: number; lift: number } | null>(null);
  const latest = useRef({ view, size, reduced, bounds, onMove });
  latest.current = { view, size, reduced, bounds, onMove };
  const lastKey = useRef(flyKey);
  const lastReport = useRef(0);

  const clamp = () => {
    const b = latest.current.bounds;
    if (!b) return;
    const g = goal.current;
    g.target.x = Math.min(b.x[1], Math.max(b.x[0], g.target.x));
    g.target.z = Math.min(b.z[1], Math.max(b.z[0], g.target.z));
    g.dist = Math.min(b.visible[1] / (2 * TAN), Math.max(b.visible[0] / (2 * TAN), g.dist));
  };

  // Fly when asked (tab, station, Reset view). Dragging never triggers this.
  useEffect(() => {
    if (lastKey.current === flyKey) return;
    lastKey.current = flyKey;
    const to = fit(latest.current.view, latest.current.size.width, latest.current.size.height);
    if (latest.current.reduced) {
      goal.current = { target: to.target.clone(), dist: to.dist };
      cur.current = { target: to.target.clone(), dist: to.dist };
      flight.current = null;
      return;
    }
    const travel = cur.current.target.distanceTo(to.target);
    flight.current = { t0: performance.now(), from: cur.current.target.clone(), fromDist: cur.current.dist, to: to.target, toDist: to.dist, lift: travel > 14 ? Math.min(45, travel * 0.9) : 0 };
  }, [flyKey]);

  // Pointer, wheel, pinch and keyboard.
  useEffect(() => {
    if (!interactive) return;
    const el = gl.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let moved = 0;
    const perPx = () => (2 * cur.current.dist * TAN) / el.clientHeight;
    const pan = (dx: number, dy: number) => {
      const k = perPx();
      goal.current.target.addScaledVector(RIGHT, -dx * k).addScaledVector(AWAY, (dy * k) / SIN_ELEV);
      clamp();
    };
    const zoom = (factor: number, clientX?: number, clientY?: number) => {
      const before = goal.current.dist;
      goal.current.dist = before * factor;
      clamp();
      const ratio = goal.current.dist / before;
      if (clientX !== undefined && clientY !== undefined) {
        // Keep the floor point under the pointer where it is.
        const r = el.getBoundingClientRect();
        const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, camera);
        const hit = ray.ray.intersectPlane(GROUND, new THREE.Vector3());
        if (hit) {
          goal.current.target.x += (hit.x - goal.current.target.x) * (1 - ratio);
          goal.current.target.z += (hit.z - goal.current.target.z) * (1 - ratio);
          clamp();
        }
      }
    };
    cameraApi.zoomBy = (f) => {
      flight.current = null;
      zoom(f);
    };
    const pinchSpan = () => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const down = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
    };
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      const spanBefore = pinchSpan();
      p.x = e.clientX;
      p.y = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved < 4) return;
      flight.current = null;
      el.style.cursor = 'grabbing';
      if (pointers.size === 1) pan(dx, dy);
      else if (pointers.size === 2) {
        pan(dx / 2, dy / 2);
        const spanAfter = pinchSpan();
        if (spanBefore > 0 && spanAfter > 0) zoom(spanBefore / spanAfter);
      }
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) el.style.cursor = 'grab';
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      flight.current = null;
      zoom(Math.exp(Math.max(-120, Math.min(120, e.deltaY)) * 0.0016), e.clientX, e.clientY);
    };
    const key = (e: KeyboardEvent) => {
      const step = el.clientHeight * 0.12;
      if (e.key === 'ArrowLeft') pan(step, 0);
      else if (e.key === 'ArrowRight') pan(-step, 0);
      else if (e.key === 'ArrowUp') pan(0, step);
      else if (e.key === 'ArrowDown') pan(0, -step);
      else if (e.key === '+' || e.key === '=') zoom(0.8);
      else if (e.key === '-' || e.key === '_') zoom(1.25);
      else return;
      flight.current = null;
      e.preventDefault();
    };
    el.style.cursor = 'grab';
    el.style.touchAction = 'none';
    el.tabIndex = 0;
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('keydown', key);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('keydown', key);
      cameraApi.zoomBy = () => {};
    };
  }, [interactive, gl, camera]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const f = flight.current;
    if (!interactive) {
      // Fixed views (the two small machines on the Redesign page) always frame their view.
      const to = fit(latest.current.view, latest.current.size.width, latest.current.size.height);
      cur.current.target.copy(to.target);
      cur.current.dist = to.dist;
    } else if (f) {
      const p = Math.min(1, (performance.now() - f.t0) / durationMs);
      const e = easeInOutCubic(p);
      cur.current.target.lerpVectors(f.from, f.to, e);
      cur.current.dist = f.fromDist + (f.toDist - f.fromDist) * e + f.lift * Math.sin(Math.PI * e);
      goal.current.target.copy(cur.current.target);
      goal.current.dist = cur.current.dist;
      if (p >= 1) {
        flight.current = null;
        goal.current.target.copy(f.to);
        goal.current.dist = f.toDist;
      }
    } else {
      // Follow the pointer with a short ease so a drag feels like moving something with mass.
      const a = latest.current.reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) / 0.07);
      cur.current.target.lerp(goal.current.target, a);
      cur.current.dist += (goal.current.dist - cur.current.dist) * a;
    }
    camera.position.copy(cur.current.target).addScaledVector(ISO, cur.current.dist);
    camera.lookAt(cur.current.target);
    const now = performance.now();
    if (latest.current.onMove && now - lastReport.current > 200) {
      lastReport.current = now;
      latest.current.onMove(cur.current.target, flight.current !== null);
    }
  });
  return null;
}

/** Exposes the renderer for the triangle and draw-call check. */
function Probe() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.info.autoReset = false;
    (window as unknown as { __gl?: THREE.WebGLRenderer }).__gl = gl;
  }, [gl]);
  useFrame(() => gl.info.reset(), -100);
  return null;
}

function Lights({ shadowSpan, center }: { shadowSpan: number; center: [number, number, number] }) {
  const key = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    target.position.set(...center);
    target.updateMatrixWorld();
  }, [center, target]);
  // Key from the top left of the screen (world: from -x, high, slightly toward the camera).
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={key}
        target={target}
        position={[center[0] - 26, 34, center[2] + 6]}
        color={light.key.color}
        intensity={light.key.intensity * 1.5}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={5}
      >
        <orthographicCamera attach="shadow-camera" args={[-shadowSpan, shadowSpan, shadowSpan, -shadowSpan, 1, 110]} />
      </directionalLight>
      <directionalLight position={[center[0] + 18, 14, center[2] + 24]} color={light.fill.color} intensity={light.fill.intensity} />
      <hemisphereLight args={['#C9D6E2', '#1B2420', light.ambient.intensity * 2.4]} />
    </>
  );
}

/** Soft studio surround for reflections on steel. Built from light panels: no image file. */
function Studio() {
  return (
    <Environment resolution={128} frames={1} background={false}>
      <color attach="background" args={['#0B0D0F']} />
      <Lightformer form="rect" intensity={2.2} color="#FFF1DE" position={[-8, 9, 2]} rotation={[0, Math.PI / 2, 0]} scale={[14, 8, 1]} />
      <Lightformer form="rect" intensity={0.9} color="#C6D8EA" position={[9, 5, 8]} rotation={[0, -Math.PI / 3, 0]} scale={[12, 6, 1]} />
      <Lightformer form="rect" intensity={0.6} color="#FFFFFF" position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[16, 16, 1]} />
    </Environment>
  );
}

export function Stage({
  view,
  flyKey = 0,
  durationMs = motion.cameraPreset,
  shadowSpan = 24,
  shadowCenter = [0, 0, 0],
  reduced = false,
  effects = true,
  interactive = false,
  bounds,
  onMove,
  children,
  onMiss,
  label,
}: {
  view: View;
  flyKey?: number;
  durationMs?: number;
  shadowSpan?: number;
  shadowCenter?: [number, number, number];
  reduced?: boolean;
  effects?: boolean;
  /** true: drag to move, scroll or pinch to zoom, arrow keys and + / - from the keyboard. */
  interactive?: boolean;
  bounds?: Bounds;
  onMove?: (target: THREE.Vector3, flying: boolean) => void;
  children: ReactNode;
  onMiss?: () => void;
  label: string;
}) {
  return (
    <Canvas
      shadows="soft"
      dpr={[1, budget.maxPixelRatio]}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      camera={{ fov: FOV, near: 1, far: 900, position: [60, 60, 60] }}
      onPointerMissed={onMiss}
      aria-label={interactive ? `${label}. Drag to move, scroll to zoom, arrow keys also work.` : label}
      role="img"
      style={{ background: palette.canvas }}
    >
      <color attach="background" args={[palette.canvas]} />
      <CameraRig view={view} flyKey={flyKey} durationMs={durationMs} reduced={reduced} interactive={interactive} bounds={bounds} onMove={onMove} />
      <Lights shadowSpan={shadowSpan} center={shadowCenter} />
      <Studio />
      <Probe />
      {children}
      {effects && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <N8AO aoRadius={1.6} intensity={2.4} distanceFalloff={1.2} quality="medium" halfRes />
          {/* Bloom spreads any NaN pixel over the whole frame, so materials must not use bump maps (see materials.ts). */}
          <Bloom mipmapBlur luminanceThreshold={1.6} luminanceSmoothing={0.2} intensity={0.35} radius={0.6} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <SMAA />
        </EffectComposer>
      )}
    </Canvas>
  );
}
