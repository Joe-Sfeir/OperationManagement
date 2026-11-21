/**
 * Gives scene components the plant state for the frame being drawn.
 * Components read it inside useFrame through `plant.get()`; nothing in the
 * scene keeps its own clock, so nothing can move unless the simulator says so.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { clock } from '../app/store';
import { stateAt } from '../sim/state';
import type { PlantState, SimResult } from '../sim/types';

export interface PlantSource {
  result: SimResult;
  /** State at the current clock time (cached per time value). */
  get: () => PlantState;
}

const Ctx = createContext<PlantSource | null>(null);

export function PlantProvider({ result, children }: { result: SimResult; children: ReactNode }) {
  const source = useMemo<PlantSource>(() => {
    let cachedT = NaN;
    let cached: PlantState | null = null;
    return {
      result,
      get: () => {
        if (cached === null || cachedT !== clock.t) {
          cachedT = clock.t;
          cached = stateAt(clock.t, result);
        }
        return cached;
      },
    };
  }, [result]);
  return <Ctx.Provider value={source}>{children}</Ctx.Provider>;
}

export function usePlant(): PlantSource {
  const p = useContext(Ctx);
  if (!p) throw new Error('usePlant must be used inside <PlantProvider>');
  return p;
}
