import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useClock } from './app/useClock';
import { clock, useTwin, type SceneId } from './app/store';
import { motion as M } from './design/tokens';
import { PlantProvider } from './scene/plant';
import { Stage, type View } from './scene/Stage';
import { MachineScene } from './scene/MachineScene';
import { HALL_OFFSET, PLAN_ROT } from './scene/layout';
import { RawHall, HALL_SPAN, HALL_VIEW_CENTER } from './scene/raw/RawHall';
import { stationPoint } from './scene/machine/Cues';
import { ArmsPanel, BottomBar, Breadcrumb, KpiPanel, PanelSlot, TopBar, useUiState } from './ui/Chrome';
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
const OVERVIEW: View = { target: toWorld([-12, 1.5, 3]), span: [66, 38] };

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
  const { result, scene, selected, panelsOpen, select, reduced, simpleLight, setScene } = useTwin();
  const state = useUiState();
  const wide = useIsWide();
  const is3d = scene === 'machine' || scene === 'raw';

  // While the camera travels between the machine and the hall it pulls back to the plant overview.
  // The flag must outlive the render that changed the scene, or the pull-back would stop after one frame.
  const prevScene = useRef(scene);
  const [glideUntil, setGlideUntil] = useState(0);
  if (prevScene.current !== scene) {
    const between3d = (prevScene.current === 'machine' || prevScene.current === 'raw') && is3d;
    prevScene.current = scene;
    if (between3d) setGlideUntil(performance.now() + M.sceneTransition + 200);
  }
  const sceneChanged = performance.now() < glideUntil;

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
            via={sceneChanged ? OVERVIEW : undefined}
            durationMs={sceneChanged ? M.sceneTransition : M.cameraPreset}
            reduced={reduced}
            shadowSpan={38}
            shadowCenter={toWorld([-14, 0, 4])}
            effects={!simpleLight && q.get('fx') !== '0'}
            onMiss={() => select(null)}
            label={scene === 'raw' ? 'Raw-material hall, isometric view' : 'Machine 3700, isometric view'}
          >
            <PlantProvider result={result}>
              <MachineScene />
              <group rotation={[0, PLAN_ROT, 0]}>
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
            <div className="hidden min-h-0 flex-1 items-start justify-between gap-3 p-3 md:flex">
              <div className="flex flex-col gap-3">
                <Breadcrumb />
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
              <Breadcrumb />
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
