/** Short help for a first-time user: five steps, what the two cues mean, what the source letters mean. */
import { useEffect, useRef } from 'react';
import { useTwin } from '../app/store';
import { provenance, type ProvenanceTag } from '../design/tokens';
import { SourceBadge } from '../design/SourceBadge';
import { Button } from './kit';
import { CloseIcon } from './icons';

const STEPS: [string, string][] = [
  ['Press Play', 'The machine runs one 8.5 h shift. At 100x, one 120 min arm cycle takes 1.2 min. Drag the orange bar to jump to any minute.'],
  ['Move around', 'Drag to move across the plant, scroll or pinch to zoom, click a position to fly to it. Reset view brings you back.'],
  ['Read the cues', 'A red ring on the floor means that arm is waiting. An amber outline round the oven means the oven is what it is waiting for.'],
  ['Change the set-up', 'Set-up lets you put different moulds on each arm and change the shift. The shift re-runs at once.'],
  ['Use the other pages', 'Redesign compares four ways to run a week. Plan works out what to make next week. Sourcing compares resin routes. Report shows how well the twin matches NTG.'],
];

export function HelpOverlay() {
  const open = useTwin((s) => s.helpOpen);
  const set = useTwin((s) => s.set);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && set({ helpOpen: false });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, set]);
  if (!open) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-start justify-center overflow-auto bg-canvas/80 p-4 pt-16" style={{ background: 'rgba(15,18,20,0.8)' }} onClick={() => set({ helpOpen: false })}>
      <div role="dialog" aria-modal="true" aria-labelledby="help-title" className="panel w-full max-w-[560px] p-4" onClick={(e) => e.stopPropagation()}>
        <header className="mb-3 flex items-center justify-between">
          <h2 id="help-title" className="text-14 font-semibold">
            How to use the twin
          </h2>
          <button ref={closeRef} type="button" aria-label="Close help" onClick={() => set({ helpOpen: false })} className="rounded-control border border-hairlineStrong p-1 text-text hover:border-textMuted">
            <CloseIcon />
          </button>
        </header>
        <ol className="grid gap-2.5">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="grid grid-cols-[1.25rem_1fr] gap-x-2">
              <span className="num text-14 text-textMuted">{i + 1}</span>
              <p className="text-14">
                <span className="font-medium">{title}.</span> <span className="text-textMuted">{body}</span>
              </p>
            </li>
          ))}
        </ol>
        <div className="mt-4 border-t border-hairline pt-3">
          <p className="mb-2 text-12 text-textMuted">Sources, in the top bar, shows a letter beside every number:</p>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {(Object.keys(provenance) as ProvenanceTag[]).map((t) => (
              <li key={t} className="flex items-center gap-2 text-12">
                <SourceBadge tag={t} always />
                {provenance[t].label}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 border-t border-hairline pt-3 text-12 text-textMuted">
          The twin is calibrated to NTG's figures and has not yet been timed on the floor. It was built with AI assistance; the team is responsible for checking it.
        </p>
        <div className="mt-3 flex justify-end">
          <Button onClick={() => set({ helpOpen: false })}>Close</Button>
        </div>
      </div>
    </div>
  );
}
