import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { clock } from '../../app/store';
import { usePlant } from '../plant';
import { mats } from '../materials';
import { Bar, Cyl, Motor } from '../parts';
import { Boxes, CagedLadder, Eased, Pipe, Plain, type BoxItem } from './bits';
import { BIN_Z, CONE_Y0, HEADER_Y, RISER_X, SHELL_H, SHELL_Y0, SILO_R, SILO_X, SILO_Z, logistics } from './layout';

const DEG = Math.PI / 180;
const SHELL_TOP = SHELL_Y0 + SHELL_H;
/** The gauge faces the camera: the view looks along (-0.26, 0, -0.97) in hall coordinates. */
const GAUGE_AZ = 15 * DEG;
const GAUGE_W = 0.48; // radians of shell: a 0.6 m slot
const GAUGE_Y0 = SHELL_Y0 + 0.22;
const GAUGE_H = SHELL_H - 0.44;
/** Reorder level (data inventory, assumption A11): a grinding batch is due below 30 %. */
const REORDER = 0.3;
/** Bin centre in front of the silo axis. */
const REACH = BIN_Z - SILO_Z;
const LEG = 0.884; // legs at 45 degrees on the shell radius
const LADDER_AZ = 62 * DEG;

/** Point on a circle about the silo axis: azimuth 0 faces +z (the front). */
const az = (r: number, a: number, y = 0): [number, number, number] => [r * Math.sin(a), y, r * Math.cos(a)];

/** The blue screw feeder under a silo: inclined tube up to a spout over the bin, gear motor at the top end. */
function ScrewFeeder() {
  const M = mats();
  const from = useMemo(() => new THREE.Vector3(0, 0.92, -0.2), []);
  const to = useMemo(() => new THREE.Vector3(0, 1.79, REACH + 0.14), []);
  const { quat, len } = useMemo(() => {
    const d = to.clone().sub(from);
    return { len: d.length(), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.clone().normalize()) };
  }, [from, to]);
  const slope = (to.y - from.y) / (to.z - from.z);
  const yAt = (z: number) => from.y + (z - from.z) * slope;
  return (
    <group>
      {/* Slide gate and inlet boot under the cone outlet */}
      <Cyl r={0.23} h={0.05} position={[0, CONE_Y0 - 0.02, 0]} material={M.steelDark} segments={20} />
      <Plain size={[0.5, 0.06, 0.34]} position={[0.08, CONE_Y0 - 0.08, 0]} material={M.galvanised} />
      <Eased size={[0.36, 0.3, 0.4]} position={[0, yAt(0) + 0.12, 0]} material={M.blue} radius={0.03} />
      {/* Tube, along the feeder's own axis */}
      <group position={from} quaternion={quat}>
        <Cyl r={0.12} h={len} position={[len / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={M.blue} segments={18} />
        {[0.02, len * 0.5, len - 0.02].map((x) => (
          <Cyl key={x} r={0.15} h={0.04} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={M.blueDark} segments={18} />
        ))}
        <Cyl r={0.125} h={0.03} position={[-0.015, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={M.blueDark} segments={18} />
      </group>
      {/* Drive at the top end: angle gearbox and a small blue motor standing on it */}
      <Eased size={[0.24, 0.24, 0.26]} position={[0, to.y + 0.02, to.z + 0.1]} material={M.blueDark} radius={0.03} />
      <group position={[0, to.y + 0.42, to.z + 0.1]} rotation={[0, 0, -Math.PI / 2]}>
        <Motor length={0.36} r={0.1} />
      </group>
      {/* Spout over the bin */}
      <Cyl r={0.1} h={0.34} position={[0, yAt(REACH) - 0.2, REACH]} material={M.blue} segments={14} />
      <Cyl r={0.12} h={0.03} position={[0, yAt(REACH) - 0.37, REACH]} material={M.blueDark} segments={14} />
      {/* A-frame under the tube, clear of the bin */}
      {[-1, 1].map((s) => (
        <Bar key={s} from={[s * 0.34, 0, REACH - 0.74]} to={[0, yAt(REACH - 0.74) - 0.1, REACH - 0.74]} r={0.03} material={M.steelDark} segments={6} />
      ))}
    </group>
  );
}
/** Bottom of the feeder spout above the floor. */
const SPOUT_Y = 0.92 + ((REACH + 0.2) * (1.79 - 0.92)) / (REACH + 0.34) - 0.385;

/** Everything on one silo that does not move. */
function SiloBody() {
  const M = mats();
  const feet = useMemo<BoxItem[]>(() => [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ p: [sx * LEG, 0.0125, sz * LEG] as [number, number, number], s: [0.36, 0.025, 0.36] as [number, number, number] }))), []);
  const legs = useMemo<BoxItem[]>(() => [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ p: [sx * LEG, 1.5, sz * LEG] as [number, number, number], s: [0.16, 3.0, 0.16] as [number, number, number], r: [0, Math.PI / 4, 0] as [number, number, number] }))), []);
  const railPosts = 12;
  return (
    <group>
      <Boxes items={legs} material={M.cream} />
      <Boxes items={feet} material={M.steelDark} />
      {/* Ties and cross bracing; the front bay stays open for the feeder and the bin */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Bar from={[s * LEG, 2.25, -LEG]} to={[s * LEG, 2.25, LEG]} r={0.035} material={M.cream} segments={6} />
          <Bar from={[s * LEG, 0.35, -LEG]} to={[s * LEG, 2.2, LEG]} r={0.022} material={M.creamDark} segments={6} />
          <Bar from={[s * LEG, 2.2, -LEG]} to={[s * LEG, 0.35, LEG]} r={0.022} material={M.creamDark} segments={6} />
          <Bar from={[-LEG, 2.25, s * LEG]} to={[LEG, 2.25, s * LEG]} r={0.035} material={M.cream} segments={6} />
        </group>
      ))}
      <Bar from={[-LEG, 0.35, -LEG]} to={[LEG, 2.2, -LEG]} r={0.022} material={M.creamDark} segments={6} />
      <Bar from={[-LEG, 2.2, -LEG]} to={[LEG, 0.35, -LEG]} r={0.022} material={M.creamDark} segments={6} />

      {/* Cone, skirt, shell with one plate seam (clear of the reorder mark), roof */}
      <Cyl r={0.17} rTop={SILO_R} h={SHELL_Y0 - CONE_Y0} position={[0, (SHELL_Y0 + CONE_Y0) / 2, 0]} material={M.cream} segments={36} open />
      <Cyl r={SILO_R + 0.035} h={0.14} position={[0, SHELL_Y0 + 0.02, 0]} material={M.creamDark} segments={36} />
      <Cyl r={SILO_R} h={SHELL_H} position={[0, SHELL_Y0 + SHELL_H / 2, 0]} material={M.cream} segments={40} open />
      <Cyl r={SILO_R + 0.012} h={0.05} position={[0, SHELL_Y0 + SHELL_H * 0.55, 0]} material={M.creamDark} segments={40} open />
      <Cyl r={SILO_R + 0.04} h={0.1} position={[0, SHELL_TOP - 0.03, 0]} material={M.creamDark} segments={36} />
      <Cyl r={SILO_R + 0.02} rTop={0.2} h={0.34} position={[0, SHELL_TOP + 0.19, 0]} material={M.cream} segments={36} />
      <Cyl r={0.15} h={0.26} position={[0, SHELL_TOP + 0.45, 0]} material={M.galvanised} segments={16} />
      {/* Manhole and vent on the roof */}
      <Cyl r={0.26} h={0.1} position={[-0.62, SHELL_TOP + 0.2, 0.4]} rotation={[0.18, 0, 0.25]} material={M.creamDark} segments={16} />
      <Cyl r={0.07} h={0.4} position={[0.55, SHELL_TOP + 0.36, -0.55]} material={M.galvanised} segments={10} />

      {/* Roof rail */}
      {[1.0, 0.52].map((h) => (
        <mesh key={h} position={[0, SHELL_TOP + h, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.cream} castShadow>
          <torusGeometry args={[SILO_R - 0.03, h === 1.0 ? 0.03 : 0.022, 5, 32]} />
        </mesh>
      ))}
      {Array.from({ length: railPosts }, (_, i) => {
        const a = ((i + 0.5) / railPosts) * Math.PI * 2;
        return <Bar key={i} from={az(SILO_R - 0.03, a, SHELL_TOP)} to={az(SILO_R - 0.03, a, SHELL_TOP + 1.0)} r={0.026} material={M.cream} segments={6} />;
      })}

      {/* Ladder with cage up the side */}
      <group position={az(SILO_R + 0.14, LADDER_AZ)} rotation={[0, LADDER_AZ, 0]}>
        <CagedLadder height={SHELL_TOP} material={M.cream} />
        {[0.42, 0.7, 0.96].map((f) => (
          <Plain key={f} size={[0.5, 0.04, 0.16]} position={[0, SHELL_TOP * f, -0.07]} material={M.creamDark} />
        ))}
      </group>

      {/* Level gauge: a slot cut in the shell on the camera side. The powder column is drawn by Silos. */}
      <mesh position={[0, GAUGE_Y0 + GAUGE_H / 2, 0]} material={M.section}>
        <cylinderGeometry args={[SILO_R + 0.006, SILO_R + 0.006, GAUGE_H, 8, 1, true, GAUGE_AZ - GAUGE_W / 2, GAUGE_W]} />
      </mesh>
      {[-1, 1].map((s) => {
        const a = GAUGE_AZ + (s * GAUGE_W) / 2;
        return <Bar key={s} from={az(SILO_R + 0.012, a, GAUGE_Y0 - 0.04)} to={az(SILO_R + 0.012, a, GAUGE_Y0 + GAUGE_H + 0.04)} r={0.022} material={M.steelDark} segments={6} />;
      })}
      {[GAUGE_Y0 - 0.04, GAUGE_Y0 + GAUGE_H + 0.04].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={M.steelDark}>
          <cylinderGeometry args={[SILO_R + 0.03, SILO_R + 0.03, 0.05, 6, 1, false, GAUGE_AZ - GAUGE_W / 2 - 0.02, GAUGE_W + 0.04]} />
        </mesh>
      ))}
      {/* Reorder mark at 30 %: a dark line across the slot with a pointer beside it */}
      <mesh position={[0, GAUGE_Y0 + GAUGE_H * REORDER, 0]} material={M.rubber}>
        <cylinderGeometry args={[SILO_R + 0.03, SILO_R + 0.03, 0.035, 8, 1, false, GAUGE_AZ - GAUGE_W / 2 - 0.02, GAUGE_W + 0.16]} />
      </mesh>

      <ScrewFeeder />
    </group>
  );
}

/**
 * Three cream silos, one per layer (1 outer, 2 foam, 3 inner), with the powder
 * duct along their roofs. Each gauge shows the simulated stock; the diverter
 * on the duct points at the silo the simulator is grinding into; a feeder
 * runs a stream of powder while its bin is filling.
 */
export function Silos() {
  const plant = usePlant();
  const M = mats();
  const columns = useRef<(THREE.Mesh | null)[]>([]);
  const levers = useRef<(THREE.Group | null)[]>([]);
  const sights = useRef<(THREE.Mesh | null)[]>([]);
  const streams = useRef<(THREE.Group | null)[]>([]);
  const grains = useRef<(THREE.Group | null)[]>([]);
  // The gauge has to read in the shade of the shell: the same matte white as the powder, lifted a little.
  const gaugePowder = useMemo(() => new THREE.MeshStandardMaterial({ color: '#F2F1EC', roughness: 0.95, metalness: 0, emissive: '#ECEBE6', emissiveIntensity: 0.5 }), []);

  useFrame(() => {
    const s = plant.get();
    const cap = plant.result.config.raw.siloCapacityKg;
    const raw = plant.result.config.raw;
    const lg = logistics(clock.t, plant.result.bins, raw.binKg);
    for (let i = 0; i < 3; i++) {
      const level = Math.min(1, Math.max(0, s.siloKg[i as 0 | 1 | 2] / cap));
      const col = columns.current[i];
      if (col) {
        col.visible = level > 0.002;
        col.scale.y = Math.max(0.002, level);
        col.position.y = GAUGE_Y0 + (GAUGE_H * level) / 2;
      }
      // The duct feeds the silo the simulator names; the other two diverters stay shut.
      const fed = s.grind.active && s.grind.layer === i;
      const lever = levers.current[i];
      if (lever) lever.rotation.x = fed ? 0 : -1.1;
      const sight = sights.current[i];
      if (sight) sight.material = fed ? M.powder : M.steelDark;
      // Powder from the screw feeder while this silo's bin is filling.
      const on = lg.filling === i;
      const stream = streams.current[i];
      if (stream) {
        stream.visible = on;
        if (on) {
          // The stream ends on the powder already in the bin.
          const drop = SPOUT_Y - (0.15 + 0.84 * lg.fill[i as 0 | 1 | 2]);
          const jet = stream.children[0]!;
          jet.scale.y = drop;
          jet.position.y = -drop / 2;
          grains.current[i]?.children.forEach((c, j) => {
            // Falls with simulated time: frozen when the clock is paused.
            const p = (clock.t * 9 + j / 6) % 1;
            c.position.y = -p * drop;
          });
        }
      }
    }
  });

  return (
    <group>
      {SILO_X.map((x, i) => (
        <group key={i} position={[x, 0, SILO_Z]}>
          <SiloBody />
          {/* Powder column in the gauge: its height is the simulated stock */}
          <mesh ref={(el) => void (columns.current[i] = el)} material={gaugePowder}>
            <cylinderGeometry args={[SILO_R + 0.014, SILO_R + 0.014, GAUGE_H, 8, 1, true, GAUGE_AZ - GAUGE_W / 2 + 0.075, GAUGE_W - 0.15]} />
          </mesh>
          {/* Drop from the duct, with a diverter and a sight band */}
          <Cyl r={0.1} h={HEADER_Y - SHELL_TOP - 0.5} position={[0, (HEADER_Y + SHELL_TOP + 0.5) / 2, 0]} material={M.galvanised} segments={14} />
          <Eased size={[0.3, 0.26, 0.3]} position={[0, HEADER_Y, 0]} material={M.galvanised} radius={0.03} />
          <mesh ref={(el) => void (sights.current[i] = el)} position={[0, HEADER_Y - 0.42, 0]} material={M.steelDark}>
            <cylinderGeometry args={[0.115, 0.115, 0.26, 14]} />
          </mesh>
          <group ref={(el) => void (levers.current[i] = el)} position={[0, HEADER_Y, 0.16]} rotation={[-1.1, 0, 0]}>
            <Bar from={[0, 0, 0]} to={[0, -0.34, 0.04]} r={0.018} material={M.steelDark} segments={6} />
            <Cyl r={0.035} h={0.1} position={[0, -0.36, 0.04]} material={M.rubber} segments={8} />
          </group>
          {/* Powder stream at the feeder spout: only while this bin is filling */}
          <group ref={(el) => void (streams.current[i] = el)} position={[0, SPOUT_Y, REACH]} visible={false}>
            <mesh material={M.powder}>
              <cylinderGeometry args={[0.04, 0.05, 1, 8]} />
            </mesh>
            <group ref={(el) => void (grains.current[i] = el)}>
              {Array.from({ length: 6 }, (_, j) => (
                <mesh key={j} position={[((j % 3) - 1) * 0.035, 0, ((j % 2) - 0.5) * 0.06]} material={M.powder}>
                  <icosahedronGeometry args={[0.04, 0]} />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      ))}
      {/* Duct: up beside silo 1, along the roofs, down to each silo */}
      <Pipe
        points={[
          [RISER_X, 0.5, SILO_Z],
          [RISER_X, HEADER_Y, SILO_Z],
          [SILO_X[2], HEADER_Y, SILO_Z],
        ]}
        r={0.09}
        material={M.galvanised}
      />
      {/* Pipe flanges and the clamps that hold the riser to silo 1 */}
      {[2.2, 4.4, 6.6].map((y) => (
        <group key={y}>
          <Cyl r={0.115} h={0.04} position={[RISER_X, y, SILO_Z]} material={M.steelDark} segments={12} />
          <Bar from={[RISER_X, y + 0.5, SILO_Z]} to={[SILO_X[0] - SILO_R + 0.02, y + 0.5, SILO_Z]} r={0.02} material={M.steelDark} segments={6} />
        </group>
      ))}
      {[0, 1].map((i) => (
        <Cyl key={i} r={0.115} h={0.04} position={[(SILO_X[i]! + SILO_X[i + 1]!) / 2, HEADER_Y, SILO_Z]} rotation={[0, 0, Math.PI / 2]} material={M.steelDark} segments={12} />
      ))}
    </group>
  );
}
