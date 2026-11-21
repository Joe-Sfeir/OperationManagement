/**
 * Runs the solver off the render path. A change of settings waits a moment
 * (so dragging a slider does not solve at every pixel), then solves the LP and
 * the whole-arm-cycle plan, then the what-if grid. Between solves the hook
 * hands control back to the browser, so typing is never held up. A newer
 * change abandons the run in flight.
 */
import { useEffect, useRef, useState } from 'react';
import { installInlinedHighs } from './highsBrowser';
import { buildInput, manualInput, solvePlan, whatIf, type PlanResult, type PlanSettings, type WhatIfCell } from './model';

export interface PlanState {
  /** loading: solver starting. solving: a newer answer is on its way. */
  phase: 'loading' | 'solving' | 'ready' | 'error';
  result: PlanResult | null;
  /** The settings `result` was solved for. */
  settings: PlanSettings | null;
  cells: WhatIfCell[] | null;
  cellsPending: boolean;
  manual: PlanResult | null;
  error: string | null;
}

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** The what-if grid sets arm-days and the demand level itself, so it only depends on the rest. */
const gridKeyOf = (s: PlanSettings) => JSON.stringify({ ...s, armDays: 0, demandPct: 0 });

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function usePlan(settings: PlanSettings): PlanState {
  const [state, setState] = useState<PlanState>({ phase: 'loading', result: null, settings: null, cells: null, cellsPending: true, manual: null, error: null });
  const run = useRef(0);
  const gridKey = useRef('');
  const key = JSON.stringify(settings);

  useEffect(() => {
    installInlinedHighs();
    const id = ++run.current;
    const current = JSON.parse(key) as PlanSettings;
    setState((s) => ({ ...s, phase: s.result ? 'solving' : 'loading', error: null }));
    const timer = setTimeout(
      () => {
        void (async () => {
          try {
            const result = await solvePlan(buildInput(current), pause);
            if (id !== run.current) return;
            const wanted = gridKeyOf(current);
            const keep = wanted === gridKey.current;
            setState((s) => ({ ...s, phase: 'ready', result, settings: current, cells: keep ? s.cells : null, cellsPending: !keep }));
            if (keep) return;
            const cells = await whatIf(current, pause, () => id !== run.current);
            if (id !== run.current) return;
            gridKey.current = wanted;
            setState((s) => ({ ...s, cells, cellsPending: false }));
          } catch (e) {
            if (id !== run.current) return;
            setState((s) => ({ ...s, phase: 'error', error: message(e) }));
          }
        })();
      },
      run.current > 1 ? 160 : 0,
    );
    return () => clearTimeout(timer);
  }, [key]);

  // The hand-solved case never changes: solve it once.
  useEffect(() => {
    let alive = true;
    installInlinedHighs();
    solvePlan(manualInput, pause).then(
      (manual) => alive && setState((s) => ({ ...s, manual })),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
