/**
 * The shared stage every 3D view uses: one orthographic isometric camera,
 * one light rig, one set of post effects (style bible, "Visual system").
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
  /** World metres that must fit across the view, horizontally and vertically. */
  span: [number, number];
  /** Screen pixels kept clear of the subject: [left, right, top, bottom]. Panels sit there. */
  pad?: [number, number, number, number];
}

const ISO = new THREE.Vector3(1, 1, 1).normalize();
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const UP = new THREE.Vector3().crossVectors(RIGHT, ISO).normalize().multiplyScalar(-1);
const DIST = 120;

function zoomFor(view: View, w: number, h: number) {
  const [l, r, t, b] = view.pad ?? [0, 0, 0, 0];
  return Math.min(Math.max(120, w - l - r) / view.span[0], Math.max(120, h - t - b) / view.span[1]);
}
/** Shift the look-at point so the subject sits in the middle of the area left clear by the panels. */
function offsetFor(view: View, zoom: number, out: THREE.Vector3) {
  const [l, r, t, b] = view.pad ?? [0, 0, 0, 0];
  // Screen right is world (1,0,-1)/sqrt2; screen up is the camera's up vector.
  const dx = (r - l) / 2 / zoom;
  const dy = (t - b) / 2 / zoom;
  return out.set(...view.target).addScaledVector(RIGHT, dx).addScaledVector(UP, dy);
}

/**
 * Moves the locked isometric camera between views. Hand-written tween,
 * ease-in-out, no overshoot. `via` adds a pull-back in the middle of the move.
 */
function CameraRig({ view, via, durationMs, reduced }: { view: View; via?: View; durationMs: number; reduced: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const z0 = zoomFor(view, size.width, size.height);
  const cur = useRef({ target: offsetFor(view, z0, new THREE.Vector3()), zoom: z0 });
  const tween = useRef<{ t0: number; from: THREE.Vector3; fromZoom: number; first: boolean } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!started.current || reduced) {
      started.current = true;
      cur.current.zoom = zoomFor(view, size.width, size.height);
      offsetFor(view, cur.current.zoom, cur.current.target);
      tween.current = null;
    } else {
      tween.current = { t0: performance.now(), from: cur.current.target.clone(), fromZoom: cur.current.zoom, first: true };
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, size.width, size.height, reduced]);

  useFrame(() => {
    const tw = tween.current;
    const goalZoom = zoomFor(view, size.width, size.height);
    const goal = offsetFor(view, goalZoom, new THREE.Vector3());
    if (tw) {
      const p = Math.min(1, (performance.now() - tw.t0) / durationMs);
      const e = easeInOutCubic(p);
      cur.current.target.lerpVectors(tw.from, goal, e);
      let z = tw.fromZoom + (goalZoom - tw.fromZoom) * e;
      if (via) {
        // Pull back toward the overview in the middle of the move, then close in again.
        const viaZoom = Math.min(zoomFor(via, size.width, size.height), tw.fromZoom, goalZoom);
        z = z + (viaZoom - z) * Math.sin(Math.PI * e) * 0.9;
      }
      cur.current.zoom = z;
      if (p >= 1) tween.current = null;
    } else {
      cur.current.target.copy(goal);
      cur.current.zoom = goalZoom;
    }
    camera.position.copy(cur.current.target).addScaledVector(ISO, DIST);
    camera.zoom = cur.current.zoom;
    camera.lookAt(cur.current.target);
    camera.updateProjectionMatrix();
  });
  return null;
}

/** Exposes the renderer for the triangle and draw-call check (tools/ and the M7 budget). */
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
  via,
  durationMs = motion.cameraPreset,
  shadowSpan = 24,
  shadowCenter = [0, 0, 0],
  reduced = false,
  effects = true,
  children,
  onMiss,
  label,
}: {
  view: View;
  via?: View;
  durationMs?: number;
  shadowSpan?: number;
  shadowCenter?: [number, number, number];
  reduced?: boolean;
  effects?: boolean;
  children: ReactNode;
  onMiss?: () => void;
  label: string;
}) {
  return (
    <Canvas
      orthographic
      shadows="soft"
      dpr={[1, budget.maxPixelRatio]}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      camera={{ near: 0.1, far: 400, position: [DIST, DIST, DIST], zoom: 30 }}
      onPointerMissed={onMiss}
      aria-label={label}
      role="img"
      style={{ background: palette.canvas }}
    >
      <color attach="background" args={[palette.canvas]} />
      <CameraRig view={view} via={via} durationMs={durationMs} reduced={reduced} />
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
