import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { palette } from '../../design/tokens';
import { useTwin } from '../../app/store';
import { usePlant } from '../plant';
import { DEG, H_ARM, R_ARM, STATION_DEG, polar } from '../layout';
import { armAngleDeg } from './Arm';
import { STATION_LABEL } from '../../sim/config';
import type { StationId } from '../../sim/types';

const mmss = (min: number) => {
  const s = Math.floor(min * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Bottleneck cues (style bible): an arm that is waiting shows a red ring on the
 * floor at its position and a growing timer. Both come from the simulator's
 * queue data, not from a fixed rule.
 */
export function WaitCues() {
  const plant = usePlant();
  const n = plant.result.config.arms.length;
  const rings = useRef<(THREE.Group | null)[]>([]);
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: palette.alertRed, toneMapped: false }), []);
  useFrame(() => {
    const s = plant.get();
    s.arms.forEach((a, i) => {
      const waiting = a.stage === 'waitOven' || a.stage === 'blocked';
      const ring = rings.current[i];
      const label = labels.current[i];
      if (ring) {
        ring.visible = waiting;
        if (waiting) ring.position.set(...polar(R_ARM, armAngleDeg(a, plant.result.ring), 0.02));
      }
      if (label) {
        label.style.display = waiting ? 'flex' : 'none';
        if (waiting) label.lastElementChild!.textContent = mmss(a.waitingMin);
      }
    });
  });
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} ref={(el) => void (rings.current[i] = el)} visible={false}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={mat}>
            <ringGeometry args={[2.12, 2.3, 72]} />
          </mesh>
          <Html position={[0, H_ARM + 2.6, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div
              ref={(el) => void (labels.current[i] = el)}
              className="hidden items-center gap-1.5 whitespace-nowrap rounded-control border border-hairline bg-panel px-2 py-1 text-12 text-text"
            >
              <span className="h-2 w-2 rounded-full bg-alertRed" aria-hidden="true" />
              <span className="text-textMuted">Arm {i + 1} waiting</span>
              <span className="num">0:00</span>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

const LABEL_AT: Partial<Record<StationId, [number, number, number]>> = {
  oven: polar(R_ARM + 0.3, 0, 7.7),
  air: polar(R_ARM, STATION_DEG.air, 5.4),
  chamber: polar(R_ARM, 120, 7.3),
  demould: polar(R_ARM + 0.6, 180, 9.2),
  load: polar(R_ARM + 1.6, 268, 0.3),
  wait: polar(R_ARM + 2.4, 305, 0.3),
};

/** Position names, and click targets that zoom to a position. */
export function StationLabels({ onSelect }: { onSelect: (s: StationId) => void }) {
  const plant = usePlant();
  const selected = useTwin((s) => s.selected);
  return (
    <group>
      {plant.result.ring.map((st) => (
        <group key={st}>
          <Html position={LABEL_AT[st]} center zIndexRange={[10, 0]}>
            <button
              type="button"
              onClick={() => onSelect(st)}
              aria-pressed={selected === st}
              className={[
                'hidden whitespace-nowrap rounded-control border px-2 py-0.5 text-12 transition-colors duration-150 ease-machine md:block',
                selected === st ? 'border-text bg-text text-canvas' : 'border-hairline bg-panel text-textMuted hover:border-textMuted hover:text-text',
              ].join(' ')}
            >
              {STATION_LABEL[st]}
            </button>
          </Html>
          {/* Invisible disc on the floor so the position itself can be clicked */}
          <mesh position={polar(R_ARM, STATION_DEG[st], 0.03)} rotation={[-Math.PI / 2, 0, 0]} onClick={(e) => (e.stopPropagation(), onSelect(st))} visible={false}>
            <circleGeometry args={[2.3, 24]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function stationPoint(st: StationId): [number, number, number] {
  const p = polar(R_ARM, STATION_DEG[st]);
  return [p[0], 1.8, p[2]];
}
export { DEG };
