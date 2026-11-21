import { useEffect } from 'react';
import { clock, tick, useTwin } from './store';

/** Drives the clock from requestAnimationFrame and copies it to the panels about 8 times a second. */
export function useClock() {
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const loop = (now: number) => {
      tick(now - last);
      last = now;
      if (now - lastUi > 120) {
        lastUi = now;
        if (Math.abs(useTwin.getState().tUi - clock.t) > 1e-6) useTwin.setState({ tUi: clock.t });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

export function usePrefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
