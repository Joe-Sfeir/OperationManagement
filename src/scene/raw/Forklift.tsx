import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { clock } from '../../app/store';
import { usePlant } from '../plant';
import { mats } from '../materials';
import { Bar, Cyl } from '../parts';
import { Boxes, Eased, Plain, type BoxItem } from './bits';
import { BIN_BASE_H, BIN_BODY_H, BIN_FWD, BIN_HALF, BIN_Z, FORK_LOW, FORK_TIP, HOPPER_TOP, POCKET_TOP, SILO_X, WHEELBASE, logistics } from './layout';

const R_FRONT = 0.33;
const R_REAR = 0.27;
/** Three-stage mast: each stage is this long and carries a third of the lift. */
const STAGE = 2.65;
const MAST_X = 0.44;
const FORK_X0 = 0.56;
const FORK_LEN = 1.1;

function Wheel({ r, w }: { r: number; w: number }) {
  const M = mats();
  const lugs = useMemo<BoxItem[]>(
    () =>
      [0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return { p: [Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, 0], s: [0.05, 0.05, w + 0.05], r: [0, 0, a] };
      }),
    [r, w],
  );
  return (
    <group>
      <Cyl r={r} h={w} rotation={[Math.PI / 2, 0, 0]} material={M.rubber} segments={22} />
      <Cyl r={r * 0.56} h={w + 0.02} rotation={[Math.PI / 2, 0, 0]} material={M.forklift} segments={16} />
      <Boxes items={lugs} material={M.steelDark} shadow={false} />
    </group>
  );
}

/** Simple faceless operator, seated: for scale only. */
function Operator() {
  const M = mats();
  return (
    <group>
      <mesh position={[-1.06, 1.63, 0]} rotation={[0, 0, -0.08]} material={M.cloth} castShadow>
        <capsuleGeometry args={[0.18, 0.36, 3, 10]} />
      </mesh>
      <mesh position={[-1.03, 2.04, 0]} material={M.skin} castShadow>
        <sphereGeometry args={[0.13, 12, 10]} />
      </mesh>
      {[-0.12, 0.12].map((z) => (
        <group key={z}>
          <Bar from={[-1.02, 1.36, z]} to={[-0.58, 1.34, z]} r={0.078} material={M.rubber} />
          <Bar from={[-0.58, 1.36, z]} to={[-0.5, 0.9, z]} r={0.066} material={M.rubber} />
        </group>
      ))}
      {[-0.25, 0.25].map((z) => (
        <group key={z}>
          <Bar from={[-1.05, 1.82, z]} to={[-0.84, 1.52, z * 0.9]} r={0.052} material={M.cloth} />
          <Bar from={[-0.84, 1.52, z * 0.9]} to={[-0.5, 1.5, z * 0.55]} r={0.046} material={M.cloth} />
        </group>
      ))}
    </group>
  );
}

/** A transfer bin: grey polyethylene tipping body on a steel base frame with fork pockets. Local +x is the hinge (front) side. */
function Bin({ body, powder }: { body: (el: THREE.Group | null) => void; powder: (el: THREE.Mesh | null) => void }) {
  const M = mats();
  const w = BIN_HALF * 2;
  const base = useMemo<BoxItem[]>(
    () => [
      { p: [0, 0.05, -0.3], s: [1.0, 0.1, 0.17] },
      { p: [0, 0.05, 0.3], s: [1.0, 0.1, 0.17] },
      { p: [-0.46, 0.06, 0], s: [0.08, 0.1, 0.78] },
      { p: [0.46, 0.06, 0], s: [0.08, 0.1, 0.78] },
      { p: [0, BIN_BASE_H - 0.01, 0], s: [1.06, 0.02, 0.9] },
    ],
    [],
  );
  const walls = useMemo<BoxItem[]>(() => {
    const h = BIN_BODY_H;
    // Body drawn from its hinge: the front bottom edge.
    const it: BoxItem[] = [
      { p: [-w / 2, 0.015, 0], s: [w, 0.03, w] },
      { p: [-0.015, h / 2, 0], s: [0.03, h, w] },
      { p: [-w + 0.015, h / 2, 0], s: [0.03, h, w] },
      { p: [-w / 2, h / 2, w / 2 - 0.015], s: [w, h, 0.03] },
      { p: [-w / 2, h / 2, -w / 2 + 0.015], s: [w, h, 0.03] },
    ];
    for (const z of [-w / 2 - 0.012, w / 2 + 0.012]) for (const x of [-0.3, -0.8]) it.push({ p: [x, h * 0.48, z], s: [0.05, h * 0.86, 0.025] });
    for (const x of [0.012, -w - 0.012]) for (const z of [-0.25, 0.25]) it.push({ p: [x, h * 0.48, z], s: [0.025, h * 0.86, 0.05] });
    return it;
  }, [w]);
  const rim = useMemo<BoxItem[]>(() => {
    const h = BIN_BODY_H;
    return [
      { p: [-w / 2, h, w / 2], s: [w + 0.07, 0.06, 0.07] },
      { p: [-w / 2, h, -w / 2], s: [w + 0.07, 0.06, 0.07] },
      { p: [0, h, 0], s: [0.07, 0.06, w + 0.07] },
      { p: [-w, h, 0], s: [0.07, 0.06, w + 0.07] },
    ];
  }, [w]);
  return (
    <group>
      <Boxes items={base} material={M.steelDark} />
      <group ref={body} position={[BIN_HALF, BIN_BASE_H, 0]}>
        <Boxes items={walls} material={M.tank} />
        <Boxes items={rim} material={M.steelDark} />
        <mesh ref={powder} position={[-w / 2, 0.03, 0]} material={M.powder} visible={false}>
          <boxGeometry args={[w - 0.06, 1, w - 0.06]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * The yellow forklift and the three transfer bins (one under each silo's
 * feeder). Every pose comes from `logistics(clock.t, result.bins)`: the
 * forklift only moves while a bin trip or the run back after it is under way.
 */
export function Forklift() {
  const plant = usePlant();
  const M = mats();
  const truck = useRef<THREE.Group>(null);
  const stageMid = useRef<THREE.Group>(null);
  const stageIn = useRef<THREE.Group>(null);
  const carriage = useRef<THREE.Group>(null);
  const front = useRef<(THREE.Group | null)[]>([]);
  const rear = useRef<(THREE.Group | null)[]>([]);
  const rearSpin = useRef<(THREE.Group | null)[]>([]);
  const bins = useRef<(THREE.Group | null)[]>([]);
  const bodies = useRef<(THREE.Group | null)[]>([]);
  const powders = useRef<(THREE.Mesh | null)[]>([]);
  const pour = useRef<THREE.Group>(null);
  const pourGrains = useRef<THREE.Group>(null);

  useFrame(() => {
    const raw = plant.result.config.raw;
    const g = logistics(clock.t, plant.result.bins, raw.binKg);
    const cos = Math.cos(g.yaw);
    const sin = Math.sin(g.yaw);
    if (truck.current) {
      truck.current.position.set(g.x, 0, g.z);
      truck.current.rotation.y = g.yaw;
    }
    const lift = g.forkY - FORK_LOW;
    if (stageMid.current) stageMid.current.position.y = lift / 3;
    if (stageIn.current) stageIn.current.position.y = (lift * 2) / 3;
    if (carriage.current) carriage.current.position.y = lift;
    // Wheels roll with the distance travelled, so they stand still when the forklift does.
    front.current.forEach((w) => w && (w.rotation.z = -g.odo / R_FRONT));
    rear.current.forEach((w) => w && (w.rotation.y = g.steer));
    rearSpin.current.forEach((w) => w && (w.rotation.z = -g.odo / R_REAR));

    for (let i = 0; i < 3; i++) {
      const bin = bins.current[i];
      const body = bodies.current[i];
      const powder = powders.current[i];
      if (!bin) continue;
      const on = g.carried === i;
      if (on) {
        bin.position.set(g.x + BIN_FWD * cos, Math.max(0, g.forkY - POCKET_TOP), g.z - BIN_FWD * sin);
        bin.rotation.y = g.yaw;
      } else {
        bin.position.set(SILO_X[i]!, 0, BIN_Z);
        bin.rotation.y = Math.PI / 2;
      }
      if (body) body.rotation.z = on ? -g.tip : 0;
      if (powder) {
        const f = g.fill[i as 0 | 1 | 2];
        powder.visible = f > 0.004;
        const h = Math.max(0.004, f * (BIN_BODY_H - 0.08));
        powder.scale.y = h;
        powder.position.y = 0.03 + h / 2;
      }
    }

    // Powder leaving the tipped bin into the hopper.
    if (pour.current) {
      pour.current.visible = g.pouring && g.carried >= 0;
      if (pour.current.visible) {
        const hingeX = g.x + (BIN_FWD + BIN_HALF) * cos;
        const hingeZ = g.z - (BIN_FWD + BIN_HALF) * sin;
        const hingeY = g.forkY - POCKET_TOP + BIN_BASE_H;
        const reach = BIN_BODY_H * Math.sin(g.tip);
        const lipY = hingeY + BIN_BODY_H * Math.cos(g.tip);
        pour.current.position.set(hingeX + reach * cos, lipY, hingeZ - reach * sin);
        pour.current.rotation.y = g.yaw;
        const drop = Math.max(0.1, lipY - (HOPPER_TOP - 0.02));
        const jet = pour.current.children[0]!;
        jet.scale.y = drop;
        jet.position.y = -drop / 2;
        pourGrains.current?.children.forEach((c, j) => {
          const p = (clock.t * 9 + j / 6) % 1;
          c.position.y = -p * drop;
        });
      }
    }
  });

  const mastOuter = useMemo<BoxItem[]>(
    () => [
      { p: [MAST_X, 0.15 + STAGE / 2, -0.37], s: [0.13, STAGE, 0.07] },
      { p: [MAST_X, 0.15 + STAGE / 2, 0.37], s: [0.13, STAGE, 0.07] },
      { p: [MAST_X - 0.03, 0.15 + STAGE - 0.05, 0], s: [0.06, 0.1, 0.8] },
      { p: [MAST_X - 0.03, 0.3, 0], s: [0.06, 0.16, 0.8] },
    ],
    [],
  );
  const mastMid = useMemo<BoxItem[]>(
    () => [
      { p: [MAST_X + 0.01, 0.17 + STAGE / 2, -0.3], s: [0.11, STAGE, 0.06] },
      { p: [MAST_X + 0.01, 0.17 + STAGE / 2, 0.3], s: [0.11, STAGE, 0.06] },
      { p: [MAST_X - 0.02, 0.17 + STAGE - 0.05, 0], s: [0.05, 0.1, 0.62] },
    ],
    [],
  );
  const mastIn = useMemo<BoxItem[]>(
    () => [
      { p: [MAST_X + 0.02, 0.19 + STAGE / 2, -0.235], s: [0.09, STAGE, 0.055] },
      { p: [MAST_X + 0.02, 0.19 + STAGE / 2, 0.235], s: [0.09, STAGE, 0.055] },
      { p: [MAST_X - 0.01, 0.19 + STAGE - 0.05, 0], s: [0.05, 0.1, 0.5] },
    ],
    [],
  );
  const forks = useMemo<BoxItem[]>(() => {
    const it: BoxItem[] = [];
    for (const z of [-0.3, 0.3]) {
      // Blade (top face at fork height) and shank
      it.push({ p: [FORK_X0 + FORK_LEN / 2, FORK_LOW - 0.0225, z], s: [FORK_LEN, 0.045, 0.12] });
      it.push({ p: [FORK_X0 + 0.025, FORK_LOW + 0.26, z], s: [0.05, 0.6, 0.12] });
    }
    // Carriage bars and load backrest
    it.push({ p: [FORK_X0 - 0.03, FORK_LOW + 0.14, 0], s: [0.06, 0.12, 0.98] });
    it.push({ p: [FORK_X0 - 0.03, FORK_LOW + 0.5, 0], s: [0.06, 0.12, 0.98] });
    for (const z of [-0.46, -0.15, 0.15, 0.46]) it.push({ p: [FORK_X0 - 0.03, FORK_LOW + 0.85, z], s: [0.035, 0.75, 0.035] });
    it.push({ p: [FORK_X0 - 0.03, FORK_LOW + 1.22, 0], s: [0.04, 0.05, 0.98] });
    return it;
  }, []);
  const guard = useMemo<BoxItem[]>(() => {
    const y = 2.3;
    const it: BoxItem[] = [
      { p: [-0.85, y, -0.5], s: [1.62, 0.06, 0.06] },
      { p: [-0.85, y, 0.5], s: [1.62, 0.06, 0.06] },
      { p: [-0.07, y, 0], s: [0.06, 0.06, 1.0] },
      { p: [-1.63, y, 0], s: [0.06, 0.06, 1.0] },
    ];
    for (const z of [-0.3, -0.1, 0.1, 0.3]) it.push({ p: [-0.85, y, z], s: [1.56, 0.03, 0.04] });
    return it;
  }, []);

  return (
    <group>
      <group ref={truck}>
        {/* Chassis, hood and the black counterweight */}
        <Eased size={[1.62, 0.44, 1.04]} position={[-0.72, 0.56, 0]} material={M.forklift} radius={0.06} />
        <Eased size={[1.02, 0.42, 0.98]} position={[-1.12, 0.96, 0]} material={M.forklift} radius={0.08} segments={2} />
        <Eased size={[0.62, 0.98, 1.04]} position={[-1.84, 0.75, 0]} material={M.rubber} radius={0.14} segments={2} />
        <Eased size={[0.3, 0.78, 1.0]} position={[-0.16, 1.02, 0]} material={M.forklift} radius={0.06} />
        {[-1, 1].map((s) => (
          <Eased key={s} size={[0.74, 0.1, 0.3]} position={[0.0, 0.76, s * 0.5]} material={M.forklift} radius={0.04} />
        ))}
        <Plain size={[0.5, 0.04, 0.9]} position={[-0.52, 0.8, 0]} material={M.steelDark} />
        {/* Seat, steering column and wheel */}
        <Eased size={[0.48, 0.12, 0.5]} position={[-1.08, 1.23, 0]} material={M.rubber} radius={0.04} />
        <Eased size={[0.12, 0.52, 0.5]} position={[-1.33, 1.5, 0]} rotation={[0, 0, 0.12]} material={M.rubber} radius={0.04} />
        <Bar from={[-0.28, 1.36, 0]} to={[-0.46, 1.52, 0]} r={0.03} material={M.steelDark} segments={6} />
        <group position={[-0.48, 1.54, 0]} rotation={[0, 0, -0.72]}>
          <mesh rotation={[0, Math.PI / 2, 0]} material={M.rubber}>
            <torusGeometry args={[0.16, 0.022, 6, 16]} />
          </mesh>
        </group>
        {/* Overhead guard */}
        {[-0.5, 0.5].map((z) => (
          <group key={z}>
            <Bar from={[-0.1, 1.38, z]} to={[-0.07, 2.3, z]} r={0.035} material={M.steelDark} segments={6} />
            <Bar from={[-1.72, 1.18, z]} to={[-1.63, 2.3, z]} r={0.035} material={M.steelDark} segments={6} />
          </group>
        ))}
        <Boxes items={guard} material={M.steelDark} />
        <Operator />

        {/* Wheels: driven pair at the front, steered pair at the back */}
        {[-1, 1].map((s, i) => (
          <group key={s} position={[0, R_FRONT, s * 0.5]}>
            <group ref={(el) => void (front.current[i] = el)}>
              <Wheel r={R_FRONT} w={0.24} />
            </group>
          </group>
        ))}
        {[-1, 1].map((s, i) => (
          <group key={s} ref={(el) => void (rear.current[i] = el)} position={[-WHEELBASE, R_REAR, s * 0.5]}>
            <group ref={(el) => void (rearSpin.current[i] = el)}>
              <Wheel r={R_REAR} w={0.2} />
            </group>
          </group>
        ))}

        {/* Mast: fixed outer stage, two rising stages, fork carriage */}
        <Boxes items={mastOuter} material={M.steelDark} />
        <Cyl r={0.045} h={STAGE - 0.5} position={[MAST_X - 0.06, 0.2 + (STAGE - 0.5) / 2, 0]} material={M.steel} segments={10} />
        {[-0.34, 0.34].map((z) => (
          <Bar key={z} from={[-0.02, 0.62, z]} to={[MAST_X - 0.05, 1.5, z]} r={0.03} material={M.steel} segments={6} />
        ))}
        <group ref={stageMid}>
          <Boxes items={mastMid} material={M.steelDark} />
        </group>
        <group ref={stageIn}>
          <Boxes items={mastIn} material={M.steelDark} />
        </group>
        <group ref={carriage}>
          <Boxes items={forks} material={M.rubber} />
        </group>
      </group>

      {SILO_X.map((_, i) => (
        <group key={i} ref={(el) => void (bins.current[i] = el)}>
          <Bin body={(el) => void (bodies.current[i] = el)} powder={(el) => void (powders.current[i] = el)} />
        </group>
      ))}

      {/* Powder pouring from the tipped bin: only while the simulator is filling the hopper */}
      <group ref={pour} visible={false}>
        {/* A sheet of powder off the lip of the bin, as wide as the pour */}
        <mesh material={M.powder}>
          <boxGeometry args={[0.07, 1, 0.56]} />
        </mesh>
        <group ref={pourGrains}>
          {Array.from({ length: 6 }, (_, j) => (
            <mesh key={j} position={[((j % 3) - 1) * 0.06, 0, ((j % 2) - 0.5) * 0.5]} material={M.powder}>
              <icosahedronGeometry args={[0.05, 0]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

/** Highest point of the mast at full lift, for the view that checks the tipping. */
export const MAST_TOP = 0.19 + STAGE + ((FORK_TIP - FORK_LOW) * 2) / 3;
