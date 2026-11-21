import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { clock } from '../../app/store';
import { usePlant } from '../plant';
import { mats } from '../materials';
import { Bar, Box, Cyl, Railing, Stairs } from '../parts';
import { H_ARM, R_ARM, STATION_DEG, polar } from '../layout';

/** Plan position of the dosing platform (deck centre) and its deck height. */
export const PLATFORM: [number, number, number] = polar(11.4, 231, 3.5);
const DECK: [number, number] = [3.6, 2.6];

/** One cream hopper with a cut-away window showing the powder level (0..1 per column). */
function Hopper({ levels }: { levels: React.MutableRefObject<number[]> }) {
  const M = mats();
  const cols = useRef<(THREE.Mesh | null)[]>([]);
  const n = levels.current.length;
  useFrame(() => {
    cols.current.forEach((c, i) => {
      if (!c) return;
      const v = Math.min(1, Math.max(0.001, levels.current[i] ?? 0));
      c.scale.y = v;
      c.position.y = 0.52 + (1.0 * v) / 2;
    });
  });
  return (
    <group>
      {/* Cone and outlet */}
      <Cyl r={0.16} rTop={0.72} h={0.55} position={[0, 0.25, 0]} material={M.cream} segments={4} rotation={[0, Math.PI / 4, 0]} />
      <Box size={[1.05, 1.1, 1.05]} position={[0, 1.05, 0]} material={M.cream} radius={0.04} />
      <Box size={[1.12, 0.08, 1.12]} position={[0, 1.62, 0]} material={M.creamDark} radius={0.02} />
      {/* Window on the camera side, with the powder behind it */}
      <Box size={[0.62, 1.04, 0.03]} position={[0, 1.04, 0.53]} material={M.section} radius={0.005} shadow={false} />
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} ref={(el) => void (cols.current[i] = el)} position={[(i - (n - 1) / 2) * (0.56 / n), 1.02, 0.545]} material={M.powder}>
          <boxGeometry args={[0.56 / n - 0.03, 1.0, 0.02]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Loading station: the overhead dosing platform with two cream hoppers and a
 * white hose down to the mould (hoist photo, right-hand platform). The powder
 * stream shows while the simulator is dosing at this position, and the hopper
 * windows follow the simulated hopper levels.
 */
export function LoadingStation({ onSelect }: { onSelect?: () => void }) {
  const plant = usePlant();
  const M = mats();
  const stream = useRef<THREE.Group>(null);
  const grains = useRef<THREE.Group>(null);
  const outer = useRef<number[]>([1]);
  const inner = useRef<number[]>([1, 1]);
  const mouldPos = polar(R_ARM, STATION_DEG.load);
  const tip: [number, number, number] = [mouldPos[0], H_ARM + 2.0, mouldPos[2]];
  const hose = useMemo(() => {
    const a = new THREE.Vector3(PLATFORM[0] + 0.95, PLATFORM[1] - 0.05, PLATFORM[2] - 0.3);
    const b = new THREE.Vector3(...tip);
    const mid1 = a.clone().lerp(b, 0.3).setY(PLATFORM[1] + 1.2);
    const mid2 = a.clone().lerp(b, 0.85).setY(H_ARM + 3.1);
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, mid1, mid2, b]), 40, 0.085, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    const s = plant.get();
    const cap = plant.result.config.raw.hopperCapacityKg;
    outer.current[0] = s.hopperKg[0] / cap[0];
    inner.current[0] = s.hopperKg[1] / cap[1];
    inner.current[1] = s.hopperKg[2] / cap[2];
    const on = s.loading.dosing && s.loading.station === 'load';
    if (stream.current) stream.current.visible = on;
    if (on && grains.current) {
      grains.current.children.forEach((c, i) => {
        const p = (clock.t * 9 + i / 7) % 1;
        c.position.y = -p * 1.9;
      });
    }
  });

  return (
    <group onClick={(e) => e.delta < 6 && (e.stopPropagation(), onSelect?.())}>
      <group position={[PLATFORM[0], 0, PLATFORM[2]]}>
        {/* Frame */}
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => <Box key={`${sx}${sz}`} size={[0.16, PLATFORM[1], 0.16]} position={[(sx * (DECK[0] - 0.2)) / 2, PLATFORM[1] / 2, (sz * (DECK[1] - 0.2)) / 2]} material={M.cream} radius={0.02} />),
        )}
        {[-1, 1].map((sz) => (
          <Bar key={sz} from={[-DECK[0] / 2 + 0.1, 0.3, (sz * (DECK[1] - 0.2)) / 2]} to={[DECK[0] / 2 - 0.1, PLATFORM[1] - 0.3, (sz * (DECK[1] - 0.2)) / 2]} r={0.04} material={M.cream} />
        ))}
        <Box size={[DECK[0], 0.14, DECK[1]]} position={[0, PLATFORM[1] - 0.07, 0]} material={M.cream} radius={0.02} />
        <group position={[0, PLATFORM[1], 0]}>
          <Railing
            points={[
              [-DECK[0] / 2 + 0.06, 0, DECK[1] / 2 - 0.06],
              [-DECK[0] / 2 + 0.06, 0, -DECK[1] / 2 + 0.06],
              [DECK[0] / 2 - 0.06, 0, -DECK[1] / 2 + 0.06],
              [DECK[0] / 2 - 0.06, 0, DECK[1] / 2 - 0.06],
              [-DECK[0] / 2 + 1.1, 0, DECK[1] / 2 - 0.06],
            ]}
          />
          {/* Two hoppers on a raised stand so their outlets clear the deck */}
          <group position={[-0.85, 0.5, -0.3]}>
            <Hopper levels={outer} />
          </group>
          <group position={[0.85, 0.5, -0.3]}>
            <Hopper levels={inner} />
          </group>
          {[-0.85, 0.85].map((x) => (
            <group key={x} position={[x, 0, -0.3]}>
              {[-1, 1].flatMap((a) => [-1, 1].map((b) => <Bar key={`${a}${b}`} from={[a * 0.45, 0, b * 0.45]} to={[a * 0.45, 0.95, b * 0.45]} r={0.035} material={M.creamDark} />))}
            </group>
          ))}
          {/* Screw feeder joining the outlets to the hose */}
          <Cyl r={0.1} h={1.9} position={[0, 0.42, -0.3]} rotation={[0, 0, Math.PI / 2]} material={M.galvanised} segments={14} />
          <Cyl r={0.1} h={0.75} position={[0.95, 0.2, -0.3]} material={M.galvanised} segments={14} />
        </group>
        {/* Stair on the side away from the machine */}
        <group position={[-DECK[0] / 2 + 0.5, 0, DECK[1] / 2 + 0.5]} rotation={[0, Math.PI, 0]}>
          <group position={[-2.9, 0, 0]}>
            <Stairs rise={PLATFORM[1] - 0.14} run={3.4} />
          </group>
        </group>
      </group>
      {/* White hose from the feeder to the mould */}
      <mesh geometry={hose} material={M.hose} castShadow />
      <Cyl r={0.11} h={0.3} position={[tip[0], tip[1] - 0.1, tip[2]]} material={M.galvanised} segments={12} />
      {/* Powder stream: only while dosing */}
      <group ref={stream} position={[tip[0], tip[1] - 0.25, tip[2]]} visible={false}>
        <Cyl r={0.035} h={1.9} position={[0, -0.95, 0]} material={M.powder} segments={8} shadow={false} />
        <group ref={grains}>
          {Array.from({ length: 7 }, (_, i) => (
            <mesh key={i} position={[((i % 3) - 1) * 0.04, 0, ((i % 2) - 0.5) * 0.06]} material={M.powder}>
              <sphereGeometry args={[0.05, 6, 5]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
