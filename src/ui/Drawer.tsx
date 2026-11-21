/**
 * Set-up drawer: moulds on each arm, how layers are handled, cooling layout,
 * end-of-shift rule and shift length. Changing anything re-runs the simulator.
 * The two open questions about NTG's process are switches here, not hidden
 * choices: each shows what the default is and why.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useTwin } from '../app/store';
import { motion as M } from '../design/tokens';
import { P, assumed } from '../data/params';
import { ARM_OPTIONS, armOptionId } from '../sim/config';
import { Button, Num, Segmented } from './kit';
import { CloseIcon } from './icons';

const ease = M.easeInOut as unknown as [number, number, number, number];

function Row({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 border-t border-hairline py-3 first:border-t-0">
      <div className="text-14 font-medium">{label}</div>
      {children}
      {help && <p className="text-12 text-textMuted">{help}</p>}
    </div>
  );
}

export function ConfigDrawer() {
  const { drawerOpen, config, result, setConfig, resetConfig, set } = useTwin();
  const k = result.kpis;
  return (
    <AnimatePresence>
      {drawerOpen && (
        <motion.aside
          aria-label="Set-up"
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 24, opacity: 0 }}
          transition={{ duration: M.uiSlow / 1000, ease }}
          className="pointer-events-auto absolute bottom-0 right-0 top-12 z-30 flex w-full max-w-[380px] flex-col border-l border-hairline bg-panel"
        >
          <header className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <h2 className="text-14 font-semibold">Set-up</h2>
            <Button aria-label="Close set-up" onClick={() => set({ drawerOpen: false })} className="!px-1.5">
              <CloseIcon />
            </Button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            <Row label="Moulds on each arm" help={`An arm carries one 4,000 L mould or two 2,000 L moulds (inventory row ${P.mouldsPerArm.row}). NTG's typical shift: one arm on other products, one CTT4, two CTT2, two HTT2.`}>
              <div className="grid gap-2">
                {config.arms.map((a, i) => (
                  <label key={i} className="flex items-center justify-between gap-3 text-12">
                    <span className="w-12 text-textMuted">Arm {i + 1}</span>
                    <select
                      value={armOptionId(a.moulds)}
                      onChange={(e) => {
                        const opt = ARM_OPTIONS.find((o) => o.id === e.target.value)!;
                        setConfig({ arms: config.arms.map((x, j) => (j === i ? { moulds: opt.moulds } : x)) });
                      }}
                      className="flex-1 rounded-control border border-hairlineStrong bg-canvas px-2 py-1.5 text-12 text-text"
                    >
                      {ARM_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </Row>

            <Row
              label="New layer of powder"
              help="Not confirmed by NTG. Default: the arm stays in the oven and pauses about 1.5 min for each new layer. The other reading swings the arm back to loading for each layer; it adds four arm moves per visit."
            >
              <Segmented
                label="How the next layer goes in"
                value={config.layerMode}
                onChange={(v) => setConfig({ layerMode: v })}
                options={[
                  { value: 'singleVisit', label: 'Pause in the oven' },
                  { value: 'returnToLoad', label: 'Return to loading' },
                ]}
              />
            </Row>

            <Row
              label="Oven visit of 28.5 min"
              help="Default: the two layer pauses are part of the 28.5 min the team observed. That gives the 120 min cycle NTG reports. Adding the pauses on top gives about 129 min."
            >
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  label="Layer pauses"
                  value={config.pausesInsideVisit ? 'in' : 'on'}
                  onChange={(v) => setConfig({ pausesInsideVisit: v === 'in' })}
                  options={[
                    { value: 'in', label: 'Includes the pauses' },
                    { value: 'on', label: 'Pauses on top' },
                  ]}
                />
                <Num size="12" value={P.ovenVisitMin.value} unit="min" datum={P.ovenVisitMin} />
                <Num size="12" value={P.layerPauseMin.value} unit="min pause" datum={P.layerPauseMin} />
              </div>
            </Row>

            <Row
              label="Where the arm cools"
              help="Default: 18 min in air at the open position after the oven, then 25 min in the chamber. With both phases in the chamber the cooling position blocks the oven and a shift gives about 3 cycles, not the 4 NTG plans."
            >
              <Segmented
                label="Cooling layout"
                value={config.cooling}
                onChange={(v) => setConfig({ cooling: v })}
                options={[
                  { value: 'airAtOpenPosition', label: 'Air position, then chamber' },
                  { value: 'bothInChamber', label: 'Both in the chamber' },
                ]}
              />
            </Row>

            <Row label="End of the shift" help="Default: the oven takes no arm it cannot finish by the end of the shift; arms already cooked are cooled and demoulded. Hard stop counts only tanks out at the 8.5 h mark.">
              <Segmented
                label="End of shift rule"
                value={config.endOfShift}
                onChange={(v) => setConfig({ endOfShift: v })}
                options={[
                  { value: 'finishWip', label: 'Finish cooked arms' },
                  { value: 'hardStop', label: 'Hard stop' },
                ]}
              />
            </Row>

            <Row label="Shift length">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={6}
                  max={12}
                  step={0.5}
                  value={config.shiftMin / 60}
                  onChange={(e) => setConfig({ shiftMin: Number(e.target.value) * 60 })}
                  aria-label="Shift length in hours"
                  className="flex-1 accent-[#E6E3DC]"
                />
                <Num
                  size="14"
                  value={(config.shiftMin / 60).toFixed(1)}
                  unit="h"
                  tag={config.shiftMin === P.shiftHours.value * 60 ? P.shiftHours.tag : 'S'}
                  title={config.shiftMin === P.shiftHours.value * 60 ? undefined : 'Entered on this page'}
                  datum={config.shiftMin === P.shiftHours.value * 60 ? P.shiftHours : undefined}
                />
              </div>
            </Row>

            <Row label="Task time variation" help="Default 0: every task takes its inventory time. With 10 %, each oven, cooling and demould time varies by up to plus or minus 10 %, from a fixed seed, as a stress test.">
              <Segmented
                label="Task time variation"
                value={config.jitter}
                onChange={(v) => setConfig({ jitter: v })}
                options={[
                  { value: 0, label: 'None' },
                  { value: 0.05, label: '5 %' },
                  { value: 0.1, label: '10 %' },
                ]}
              />
            </Row>

            <Row label="This set-up gives">
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-12">
                <dt className="text-textMuted">Arm cycle</dt>
                <dd>
                  <Num size="12" value={k.cycleMin.toFixed(1)} unit="min" tag="C" title="Mean time between two oven entries of the same arm" />
                </dd>
                <dt className="text-textMuted">Tanks, CTT4 / CTT2 / HTT2</dt>
                <dd>
                  <Num size="12" value={`${k.tanksTotal.CTT4} / ${k.tanksTotal.CTT2} / ${k.tanksTotal.HTT2}`} tag="C" title="Tanks from one shift of loading" />
                </dd>
                <dt className="text-textMuted">Out by the end of the shift</dt>
                <dd>
                  <Num size="12" value={`${k.tanksInShift.CTT4} / ${k.tanksInShift.CTT2} / ${k.tanksInShift.HTT2}`} tag="C" title="Tanks lifted out before the shift ends" />
                </dd>
                <dt className="text-textMuted">Oven visits</dt>
                <dd>
                  <Num size="12" value={k.ovenVisits} tag="C" title="Arm visits to the oven in the shift" />
                </dd>
                <dt className="text-textMuted">Arm move between positions</dt>
                <dd>
                  <Num size="12" value={assumed.indexMin.value} unit="min" datum={assumed.indexMin} />
                </dd>
              </dl>
            </Row>
          </div>
          <footer className="flex items-center justify-between gap-2 border-t border-hairline px-4 py-3">
            <span className="text-12 text-textMuted">Changes re-run the shift at once.</span>
            <Button onClick={resetConfig}>Reset to NTG's typical shift</Button>
          </footer>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
