import { useEffect, useMemo, useState } from 'react';
import { useClock, usePrefersReducedMotion } from './app/useClock';
import { clock, useTwin, type SceneId } from './app/store';
import { motion as M } from './design/tokens';
import { PlantProvider } from './scene/plant';
import { Stage, type View } from './scene/Stage';
import { MachineScene } from './scene/MachineScene';
import { HALL_OFFSET, PLAN_ROT } from './scene/layout';
import { stationPoint } from './scene/machine/Cues';
import { ArmsPanel, BottomBar, Breadcrumb, KpiPanel, PanelSlot, TopBar, useUiState } from './ui/Chrome';
import { ConfigDrawer } from './ui/Drawer';
import { StationCard } from './ui/StationCard';

// Repeatable screenshots: ?t=<minute> sets the clock, ?scene=, ?select=, ?play=1.
const q = new URLSearchParams(location.search);
if (q.has('t')) clock.t = Number(q.get('t'));
if (q.has('scene')) useTwin.setState({ scene: q.get('scene') as SceneId });
if (q.has('select')) useTwin.setState({ selected: q.get('select') as never });
if (q.has('panels')) useTwin.setState({ panelsOpen: q.get('panels') !== '0' });
if (q.has('drawer')) useTwin.setState({ drawerOpen: true });
if (q.has('t')) useTwin.setState({ tUi: clock.t });

/** Machine coordinates to world coordinates (the machine group is turned by PLAN_ROT). */
function toWorld([x, y, z]: [number, number, number]): [number, number, number] {
  const c = Math.cos(PLAN_ROT);
  const s = Math.sin(PLAN_ROT);
  return [x * c + z * s, y, -x * s + z * c];
}

const MACHINE_TARGET: [number, number, number] = [-3.2, 1.5, -1.2];
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
  const { result, scene, selected, panelsOpen, select } = useTwin();
  const state = useUiState();
  const reduced = usePrefersReducedMotion();
  const wide = useIsWide();
  const is3d = scene === 'machine' || scene === 'raw';

  const [lastScene, setLastScene] = useState(scene);
  const sceneChanged = lastScene !== scene;
  useEffect(() => setLastScene(scene), [scene]);

  const view = useMemo<View>(() => {
    // Keep the subject clear of the panels: [left, right, top, bottom] in pixels.
    const pad: [number, number, number, number] = wide ? (panelsOpen ? [300, 300, 60, 80] : [16, 16, 60, 80]) : panelsOpen ? [8, 8, 56, 330] : [8, 8, 56, 120];
    if (scene === 'raw') return { target: toWorld([HALL_OFFSET[0], 2, HALL_OFFSET[2]]), span: [26, 16], pad };
    if (selected) return { target: toWorld(stationPoint(selected)), span: [15, 10.5], pad };
    return { target: toWorld(MACHINE_TARGET), span: [37, 23.5], pad };
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
            shadowSpan={30}
            shadowCenter={toWorld([-8, 0, 2])}
            onMiss={() => select(null)}
            label={scene === 'raw' ? 'Raw-material hall, isometric view' : 'Machine 3700, isometric view'}
          >
            <PlantProvider result={result}>
              <MachineScene />
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
                  <ArmsPanel state={state} result={result} />
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
                  <KpiPanel state={state} result={result} />
                  <ArmsPanel state={state} result={result} />
                </div>
              )}
            </div>
            <div className="p-2 pt-0 md:p-3 md:pt-0">
              <BottomBar result={result} />
            </div>
          </>
        ) : (
          <div className="pointer-events-auto relative min-h-0 flex-1 overflow-auto">
            <div className="mx-auto max-w-[1520px] p-6 text-14 text-textMuted">This page is being built.</div>
          </div>
        )}
      </div>
      <ConfigDrawer />
    </div>
  );
}
