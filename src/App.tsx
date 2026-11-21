import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import type * as THREE from 'three';
import { useClock } from './app/useClock';
import { clock, useTwin, type SceneId } from './app/store';
import { motion as M } from './design/tokens';
import { PlantProvider } from './scene/plant';
import { Stage, cameraApi, type Bounds, type View } from './scene/Stage';
import { MachineScene } from './scene/MachineScene';
import { HALL_OFFSET, PLAN_ROT } from './scene/layout';
import { RawHall, HALL_SPAN, HALL_VIEW_CENTER } from './scene/raw/RawHall';
import { Hall } from './scene/hall/Hall';
import { stationPoint } from './scene/machine/Cues';
import { ArmsPanel, BottomBar, KpiPanel, PanelSlot, TopBar, useUiState } from './ui/Chrome';
import { Button } from './ui/kit';
import { MinusIcon, PlusIcon, TargetIcon } from './ui/icons';
import { ConfigDrawer } from './ui/Drawer';
import { StationCard } from './ui/StationCard';
import { RawPanel } from './ui/RawPanel';

// Pages load on demand so the 3D scene does not wait for them.
const PlanPage = lazy(() => import('./pages/plan/PlanPage').then((m) => ({ default: m.PlanPage })));
const SourcingPage = lazy(() => import('./pages/sourcing/SourcingPage').then((m) => ({ default: m.SourcingPage })));
const RedesignPage = lazy(() => import('./pages/redesign/RedesignPage').then((m) => ({ default: m.RedesignPage })));
const ReportPage = lazy(() => import('./pages/report/ReportPage').then((m) => ({ default: m.ReportPage })));
const PAGES: Partial<Record<SceneId, React.LazyExoticComponent<() => JSX.Element>>> = { plan: PlanPage, sourcing: SourcingPage, redesign: RedesignPage, report: ReportPage };

// Repeatable screenshots: ?t=<minute> sets the clock, ?scene=, ?select=, ?play=1.
const q = new URLSearchParams(location.search);
if (q.has('t')) clock.t = Number(q.get('t'));
if (q.has('scene')) useTwin.setState({ scene: q.get('scene') as SceneId });
if (q.has('select')) useTwin.setState({ selected: q.get('select') as never });
if (q.has('panels')) useTwin.setState({ panelsOpen: q.get('panels') !== '0' });
if (q.has('drawer')) useTwin.setState({ drawerOpen: true });
if (q.has('sources')) useTwin.setState({ showSources: true });
if (q.has('cooling')) useTwin.getState().setConfig({ cooling: q.get('cooling') as never });
if (q.has('layer')) useTwin.getState().setConfig({ layerMode: q.get('layer') as never });
if (q.has('t')) clock.t = Number(q.get('t'));
if (q.has('t')) useTwin.setState({ tUi: clock.t });
if (q.has('speed')) useTwin.setState({ speed: Number(q.get('speed')) });
if (q.get('play') === '1') useTwin.setState({ playing: true });

/** Machine coordinates to world coordinates (the machine group is turned by PLAN_ROT). */
function toWorld([x, y, z]: [number, number, number]): [number, number, number] {
  const c = Math.cos(PLAN_ROT);
  const s = Math.sin(PLAN_ROT);
  return [x * c + z * s, y, -x * s + z * c];
}

const MACHINE_TARGET: [number, number, number] = [-4.6, 1.8, -1.4];
/** Machine x (metres) where the floor passes from the machine to the powder hall. */
const AREA_SPLIT_X = (HALL_OFFSET[0] + 9 - 21) / 2;

/** How far the look-at point may be dragged, and how far in and out the view may zoom. */
const BOUNDS: Bounds = (() => {
  const corners = ([[-39, -15], [16, -15], [16, 17], [-39, 17]] as const).map(([x, z]) => toWorld([x, 0, z]));
  const xs = corners.map((c) => c[0]);
  const zs = corners.map((c) => c[2]);
  return { x: [Math.min(...xs), Math.max(...xs)], z: [Math.min(...zs), Math.max(...zs)], visible: [7, 62] };
})();

/** Zoom and reset buttons. Dragging and the scroll wheel do the same from the scene itself. */
function ViewControls() {
  const resetView = useTwin((s) => s.resetView);
  return (
    <div className="pointer-events-auto flex items-center gap-1.5 rounded-panel border border-hairline bg-panel p-1.5">
      <span className="hidden px-1.5 text-12 text-textMuted lg:inline">Drag to move, scroll to zoom</span>
      <Button aria-label="Zoom in" title="Zoom in" onClick={() => cameraApi.zoomBy(0.75)} className="!px-1.5">
        <PlusIcon />
      </Button>
      <Button aria-label="Zoom out" title="Zoom out" onClick={() => cameraApi.zoomBy(1.33)} className="!px-1.5">
        <MinusIcon />
      </Button>
      <Button title="Fly back to the whole view" onClick={resetView} className="flex items-center gap-1.5">
        <TargetIcon />
        Reset view
      </Button>
    </div>
  );
}

function useIsWide() {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 768px)');
    const f = () => setWide(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return wide;
}

export function App() {
  useClock();
  const { result, scene, selected, panelsOpen, select, reduced, simpleLight, setScene, setArea, viewNonce } = useTwin();
  const state = useUiState();
  const wide = useIsWide();
  const is3d = scene === 'machine' || scene === 'raw';

  // Machine and powder hall are one floor. The panels describe whichever one the camera is over.
  const onMove = useCallback(
    (target: THREE.Vector3, flying: boolean) => {
      if (flying) return;
      const machineX = target.x * Math.cos(PLAN_ROT) - target.z * Math.sin(PLAN_ROT);
      setArea(machineX < AREA_SPLIT_X ? 'raw' : 'machine');
    },
    [setArea],
  );

  const view = useMemo<View>(() => {
    // Keep the subject clear of the panels: [left, right, top, bottom] in pixels.
    const pad: [number, number, number, number] = wide ? (panelsOpen ? [170, 170, 52, 72] : [16, 16, 52, 72]) : panelsOpen ? [4, 4, 44, 330] : [4, 4, 44, 120];
    if (scene === 'raw')
      return { target: toWorld([HALL_OFFSET[0] + HALL_VIEW_CENTER[0], HALL_VIEW_CENTER[1], HALL_OFFSET[2] + HALL_VIEW_CENTER[2]]), span: HALL_SPAN, pad };
    if (selected) return { target: toWorld(stationPoint(selected)), span: [15, 10.5], pad };
    return { target: toWorld(MACHINE_TARGET), span: wide ? [33, 20.5] : [30, 19], pad };
  }, [scene, selected, panelsOpen, wide]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-canvas">
      {is3d && (
        <div className="absolute inset-0">
          <Stage
            view={view}
            flyKey={viewNonce}
            interactive
            bounds={BOUNDS}
            onMove={onMove}
            durationMs={M.cameraPreset}
            reduced={reduced}
            shadowSpan={42}
            shadowCenter={toWorld([-11, 0, 1])}
            keyScale={0.55}
            ambientScale={0.5}
            effects={!simpleLight && q.get('fx') !== '0'}
            onMiss={() => select(null, false)}
            label="Machine 3700 and the powder hall, isometric view"
          >
            <PlantProvider result={result}>
              <MachineScene inHall />
              <group rotation={[0, PLAN_ROT, 0]}>
                <Hall />
                <group position={HALL_OFFSET}>
                  <RawHall onSelect={() => setScene('raw')} />
                </group>
              </group>
            </PlantProvider>
          </Stage>
        </div>
      )}

      {/* Chrome sits on top of the scene; only the panels take pointer events. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <TopBar />
        {is3d ? (
          <>
            <div className="relative hidden min-h-0 flex-1 items-start justify-between gap-3 p-3 md:flex">
              <div className="absolute bottom-3 right-3">
                <ViewControls />
              </div>
              <div className="flex flex-col gap-3">
                <PanelSlot show={panelsOpen} from="left">
                  {scene === 'raw' ? <RawPanel state={state} result={result} /> : <ArmsPanel state={state} result={result} />}
                </PanelSlot>
              </div>
              <PanelSlot show={panelsOpen} from="right">
                <div className="flex flex-col gap-3">
                  <KpiPanel state={state} result={result} />
                  <StationCard state={state} result={result} />
                </div>
              </PanelSlot>
            </div>
            {/* Phone: the scene keeps the top; panels scroll in a strip above the playback bar. */}
            <div className="flex min-h-0 flex-1 flex-col justify-between p-2 md:hidden">
              <div className="self-end">
                <ViewControls />
              </div>
              {panelsOpen && (
                <div className="pointer-events-auto mt-auto flex max-h-[38vh] flex-col gap-2 overflow-y-auto">
                  <StationCard state={state} result={result} />
                  {scene === 'raw' && <RawPanel state={state} result={result} />}
                  <KpiPanel state={state} result={result} />
                  {scene !== 'raw' && <ArmsPanel state={state} result={result} />}
                </div>
              )}
            </div>
            <div className="p-2 pt-0 md:p-3 md:pt-0">
              <BottomBar result={result} />
            </div>
          </>
        ) : (
          <div className="pointer-events-auto relative min-h-0 flex-1 overflow-auto">
            <Suspense fallback={<div className="p-6 text-14 text-textMuted">Loading the page.</div>}>
              {(() => {
                const Page = PAGES[scene];
                return Page ? <Page /> : <div className="mx-auto max-w-[1520px] p-6 text-14 text-textMuted">This page is being built.</div>;
              })()}
            </Suspense>
          </div>
        )}
      </div>
      <ConfigDrawer />
    </div>
  );
}
