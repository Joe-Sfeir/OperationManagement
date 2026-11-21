/**
 * The building round the plant, matched to the site photo: green epoxy floor,
 * pale walls with a darker lower band, brown steel columns and roof beams,
 * high-bay lamps, a roller door, signs and a few things that stand about in a
 * real hall. The two walls nearest the camera and the roof are cut away, as
 * on a scale model. Nothing here moves.
 */
import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { MeshReflectorMaterial } from '@react-three/drei';
import { palette } from '../../design/tokens';
import { useTwin } from '../../app/store';
import { mats } from '../materials';
import { HALL, LAMPS } from '../layout';
import { signTexture, type SignSpec } from './signs';

type V3 = [number, number, number];

function build() {
  const std = (color: string, roughness: number, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  return {
    wall: std('#75716A', 0.92),
    wallBand: std('#393E41', 0.9),
    joint: std('#55524A', 0.95),
    steel: std('#5C4838', 0.7, 0.2), // brown painted structure, as in the photo
    shutter: std('#8A9196', 0.55, 0.5),
    glass: std('#27323B', 0.25, 0.3),
    lampShade: std('#2B2E31', 0.6, 0.4),
    lampGlow: new THREE.MeshStandardMaterial({ color: '#FFF4E0', emissive: '#FFE9C4', emissiveIntensity: 2.2, roughness: 0.4 }),
    post: std('#9AA1A6', 0.5, 0.7),
    extinguisher: std('#A8372F', 0.5, 0.2),
    bollard: std(palette.safetyYellow, 0.6),
    black: std('#1B1D1F', 0.7),
    base: std('#14181A', 0.95),
  };
}
let cache: ReturnType<typeof build> | null = null;
const hallMats = () => (cache ??= build());

/** Plain box: the hall has many large flat pieces and none needs eased edges. */
function Slab({ size, position, material, shadow = false, rotation }: { size: V3; position: V3; material: THREE.Material; shadow?: boolean; rotation?: V3 }) {
  return (
    <mesh position={position} rotation={rotation} material={material} castShadow={shadow} receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

const W = HALL.x1 - HALL.x0;
const D = HALL.z1 - HALL.z0;
const CX = (HALL.x0 + HALL.x1) / 2;
const CZ = (HALL.z0 + HALL.z1) / 2;
const H = HALL.wallH;

/** One continuous epoxy floor. With full lighting it picks up soft reflections, like a polished shop floor. */
function Floor() {
  const M = mats();
  const simple = useTwin((s) => s.simpleLight);
  const color = useMemo(() => new THREE.Color(palette.floorEpoxy).multiplyScalar(0.5), []);
  const walkway = useMemo<{ p: V3; s: V3 }[]>(() => {
    const it: { p: V3; s: V3 }[] = [];
    const y = 0.006;
    // A marked walkway along the back wall and the powder-hall end, and its hatched crossing of the forklift lane.
    it.push({ p: [CX, y, HALL.z0 + 2.6], s: [W - 2, 0.004, 0.1] });
    it.push({ p: [HALL.x0 + 2.6, y, CZ], s: [0.1, 0.004, D - 2] });
    for (let i = 0; i < 7; i++) it.push({ p: [-17.6, y, 9.6 + i * 0.75], s: [2.4, 0.004, 0.38] });
    return it;
  }, []);
  return (
    <group>
      <Slab size={[W + 0.6, 0.5, D + 0.6]} position={[CX, -0.26, CZ]} material={hallMats().base} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CX, -0.004, CZ]} receiveShadow>
        <planeGeometry args={[W, D]} />
        {simple ? (
          <primitive object={M.epoxy} attach="material" />
        ) : (
          <MeshReflectorMaterial
            color={color}
            roughness={0.7}
            metalness={0.05}
            blur={[420, 140]}
            resolution={1024}
            mixBlur={1}
            mixStrength={0.42}
            mixContrast={1}
            depthScale={0.6}
            minDepthThreshold={0.5}
            maxDepthThreshold={1.3}
            mirror={0}
          />
        )}
      </mesh>
      {walkway.map((l, i) => (
        <Slab key={i} size={l.s} position={l.p} material={M.yellow} />
      ))}
    </group>
  );
}

/** A wall along x at depth z, facing +z, with a darker lower band, panel joints, columns and roof-beam stubs. */
function Wall({ length, children }: { length: number; children?: ReactNode }) {
  const HM = hallMats();
  const cols = Math.round(length / 8.5);
  const pitch = length / cols;
  return (
    <group>
      <Slab size={[length, H, 0.3]} position={[0, H / 2, -0.15]} material={HM.wall} />
      <Slab size={[length, 1.35, 0.04]} position={[0, 0.675, 0.02]} material={HM.wallBand} />
      <Slab size={[length, 0.1, 0.06]} position={[0, 1.38, 0.03]} material={HM.joint} />
      {Array.from({ length: Math.floor(length / 2.9) }, (_, i) => (
        <Slab key={`j${i}`} size={[0.03, H - 1.45, 0.012]} position={[-length / 2 + (i + 0.5) * 2.9, 1.4 + (H - 1.45) / 2, 0.006]} material={HM.joint} />
      ))}
      {/* Columns, with the stub of the roof beam each one carried before the roof was cut away */}
      {Array.from({ length: cols + 1 }, (_, i) => {
        const x = -length / 2 + i * pitch;
        return (
          <group key={`c${i}`} position={[x, 0, 0.22]}>
            <Slab size={[0.42, H + 0.5, 0.42]} position={[0, (H + 0.5) / 2, 0]} material={HM.steel} shadow />
            <Slab size={[0.7, 0.06, 0.7]} position={[0, 0.03, 0]} material={HM.steel} />
            <Slab size={[0.3, 0.55, 2.6]} position={[0, H - 0.1, 1.45]} material={HM.steel} shadow />
            <Slab size={[0.3, 0.55, 0.02]} position={[0, H - 0.1, 2.76]} material={mats().section} />
            <Slab size={[0.16, 0.16, 1.5]} position={[0, H - 0.95, 0.95]} rotation={[0.6, 0, 0]} material={HM.steel} />
          </group>
        );
      })}
      {/* Rail along the wall at eaves height, and high windows between the columns */}
      <Slab size={[length, 0.3, 0.26]} position={[0, 6.2, 0.2]} material={HM.steel} />
      {Array.from({ length: cols }, (_, i) => {
        const x = -length / 2 + (i + 0.5) * pitch;
        return (
          <group key={`w${i}`} position={[x, 7.75, 0.03]}>
            <Slab size={[pitch - 1.4, 1.7, 0.04]} position={[0, 0, 0]} material={HM.glass} />
            {[-1, 0, 1].map((k) => (
              <Slab key={k} size={[0.07, 1.7, 0.06]} position={[(k * (pitch - 1.4)) / 3.2, 0, 0.01]} material={HM.joint} />
            ))}
            <Slab size={[pitch - 1.3, 0.08, 0.07]} position={[0, -0.86, 0.01]} material={HM.joint} />
          </group>
        );
      })}
      {children}
    </group>
  );
}

function Sign({ spec, position, rotation }: { spec: SignSpec; position: V3; rotation?: V3 }) {
  const tex = useMemo(() => signTexture(spec), [spec]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), [tex]);
  return (
    <group position={position} rotation={rotation}>
      <Slab size={[spec.size[0] + 0.1, spec.size[1] + 0.1, 0.05]} position={[0, 0, -0.03]} material={hallMats().black} />
      <mesh material={mat}>
        <planeGeometry args={spec.size} />
      </mesh>
    </group>
  );
}

/** A sign on a steel post standing on the floor. */
function PostSign({ spec, position, rotation }: { spec: SignSpec; position: V3; rotation?: V3 }) {
  const HM = hallMats();
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 1.05, -0.06]} material={HM.post} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 2.1, 10]} />
      </mesh>
      <mesh position={[0, 0.02, -0.06]} material={HM.post}>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 16]} />
      </mesh>
      <Sign spec={spec} position={[0, 2.1 + spec.size[1] / 2 - 0.25, 0]} />
    </group>
  );
}

const BLUE_BOARD = { bg: '#1F4A86', fg: '#EFE8D6' };
const YELLOW_BOARD = { bg: '#E4B62B', fg: '#17191B', border: '#17191B' };
const SIGNS = {
  raw: { lines: ['Raw material'], size: [6.4, 1.2], ...BLUE_BOARD } as SignSpec,
  tanks: { lines: ['Finished tanks'], size: [6.8, 1.2], ...BLUE_BOARD } as SignSpec,
  machine: { lines: ['Machine 3700'], size: [6.6, 1.2], ...BLUE_BOARD } as SignSpec,
  moulds: { lines: ['Mould store'], size: [4.6, 0.9], ...BLUE_BOARD } as SignSpec,
  company: { lines: ['Nassar Techno Group'], size: [7.4, 1.0], bg: '#E9E2CF', fg: '#1F4A86' } as SignSpec,
  // Wording from the machine manual: operators stay behind the yellow line while the arms move.
  line: { lines: ['Keep behind the yellow line', 'while the arms move'], size: [3.3, 0.95], mark: 'warning', ...YELLOW_BOARD } as SignSpec,
  hot: { lines: ['Hot surface', 'Oven and moulds'], size: [2.5, 0.9], mark: 'warning', ...YELLOW_BOARD } as SignSpec,
  forklift: { lines: ['Forklift route'], size: [2.6, 0.7], mark: 'arrow', ...YELLOW_BOARD } as SignSpec,
};

function RollerDoor() {
  const HM = hallMats();
  const w = 5.2;
  const h = 5.6;
  return (
    <group>
      <Slab size={[w + 0.5, h + 0.3, 0.1]} position={[0, (h + 0.3) / 2, 0.06]} material={HM.steel} />
      {Array.from({ length: 22 }, (_, i) => (
        <Slab key={i} size={[w, h / 22 - 0.02, 0.06]} position={[0, (i + 0.5) * (h / 22), 0.13]} material={HM.shutter} />
      ))}
      <Slab size={[w + 0.3, 0.5, 0.5]} position={[0, h + 0.3, 0.26]} material={HM.shutter} shadow />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 2 + 0.55), 0, 0.9]}>
          <mesh position={[0, 0.5, 0]} material={HM.bollard} castShadow>
            <cylinderGeometry args={[0.11, 0.11, 1, 14]} />
          </mesh>
          {[0.3, 0.62].map((y) => (
            <mesh key={y} position={[0, y, 0]} material={HM.black}>
              <cylinderGeometry args={[0.113, 0.113, 0.14, 14]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Extinguisher({ position }: { position: V3 }) {
  const HM = hallMats();
  return (
    <group position={position}>
      <Slab size={[0.5, 0.5, 0.02]} position={[0, 1.75, 0.012]} material={HM.extinguisher} />
      <mesh position={[0, 0.95, 0.16]} material={HM.extinguisher} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.55, 14]} />
      </mesh>
      <mesh position={[0, 1.27, 0.16]} material={HM.black}>
        <cylinderGeometry args={[0.03, 0.05, 0.1, 10]} />
      </mesh>
    </group>
  );
}

/** Steel rack of spare moulds against the back wall. NTG owns more moulds than the arms carry (inventory row 35). */
function MouldRack() {
  const M = mats();
  const HM = hallMats();
  const len = 9;
  return (
    <group>
      {[-len / 2, 0, len / 2].flatMap((x) => [0.05, 1.25].map((z) => <Slab key={`${x}${z}`} size={[0.1, 3.4, 0.1]} position={[x, 1.7, z]} material={HM.post} shadow />))}
      {[0.35, 1.9].map((y) => (
        <Slab key={y} size={[len + 0.1, 0.08, 1.3]} position={[0, y, 0.65]} material={HM.post} shadow />
      ))}
      {[0.39, 1.94].flatMap((y, row) =>
        Array.from({ length: 5 }, (_, i) => (
          <mesh key={`${row}${i}`} position={[-len / 2 + 0.95 + i * 1.78, y + 0.62, 0.65]} rotation={[Math.PI / 2, 0, 0]} material={M.mould} castShadow>
            <cylinderGeometry args={[0.6, 0.6, 1.15, 20]} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Lamps() {
  const HM = hallMats();
  return (
    <group>
      {LAMPS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {/* Fixtures are drawn only near the back wall; nearer ones would hang in front of the machines. */}
          {z < -5 && (
            <group position={[0, H - 0.9, 0]}>
              <mesh position={[0, 0.75, 0]} material={HM.black}>
                <cylinderGeometry args={[0.02, 0.02, 1.5, 6]} />
              </mesh>
              <mesh material={HM.lampShade} castShadow>
                <cylinderGeometry args={[0.2, 0.46, 0.4, 20, 1, true]} />
              </mesh>
              <mesh position={[0, -0.19, 0]} rotation={[Math.PI / 2, 0, 0]} material={HM.lampGlow}>
                <circleGeometry args={[0.42, 20]} />
              </mesh>
            </group>
          )}
          <Pool />
        </group>
      ))}
    </group>
  );
}

/** One lamp's pool of light: a spot pointing straight down, without its own shadow (the key light casts those). */
function Pool() {
  const target = useMemo(() => new THREE.Object3D(), []);
  return (
    <>
      <primitive object={target} />
      <spotLight position={[0, 11.5, 0]} target={target} angle={0.95} penumbra={1} intensity={150} distance={30} decay={1.5} color="#FFEFD6" />
    </>
  );
}

export function Hall() {
  const HM = hallMats();
  return (
    <group>
      <Floor />
      {/* Back wall */}
      <group position={[CX, 0, HALL.z0]}>
        <Wall length={W}>
          <Sign spec={SIGNS.company} position={[-19.6 - CX, 3.9, 0.42]} />
          <Sign spec={SIGNS.raw} position={[-28.1 - CX, 5.25, 0.42]} />
          <Sign spec={SIGNS.tanks} position={[-11.0 - CX, 5.25, 0.42]} />
          <Sign spec={SIGNS.machine} position={[-2.4 - CX, 5.25, 0.42]} />
          <Sign spec={SIGNS.moulds} position={[14.7 - CX, 4.3, 0.42]} />
          <group position={[-36.7 - CX, 0, 0]}>
            <RollerDoor />
          </group>
          {/* Staff door */}
          <group position={[-20.8 - CX, 0, 0.05]}>
            <Slab size={[1.25, 2.3, 0.08]} position={[0, 1.15, 0]} material={HM.steel} />
            <Slab size={[1.05, 2.15, 0.06]} position={[0, 1.1, 0.03]} material={mats().blue} />
          </group>
          <Extinguisher position={[-31 - CX, 0, 0.05]} />
          <Extinguisher position={[-8.6 - CX, 0, 0.05]} />
          <Extinguisher position={[4.2 - CX, 0, 0.05]} />
          <group position={[14.2 - CX, 0, 0.5]}>
            <MouldRack />
          </group>
        </Wall>
      </group>
      {/* Powder-hall end wall */}
      <group position={[HALL.x0, 0, CZ]} rotation={[0, Math.PI / 2, 0]}>
        <Wall length={D}>
          <Extinguisher position={[6, 0, 0.05]} />
        </Wall>
      </group>
      {/* The two near walls are cut away: only a low kerb remains, with a dark cut face */}
      <Slab size={[W, 0.3, 0.3]} position={[CX, 0.15, HALL.z1 + 0.15]} material={HM.wallBand} />
      <Slab size={[W, 0.02, 0.3]} position={[CX, 0.31, HALL.z1 + 0.15]} material={mats().section} />
      <Slab size={[0.3, 0.3, D]} position={[HALL.x1 + 0.15, 0.15, CZ]} material={HM.wallBand} />
      <Slab size={[0.3, 0.02, D]} position={[HALL.x1 + 0.15, 0.31, CZ]} material={mats().section} />

      <Lamps />

      {/* Standing signs, facing the open side of the hall */}
      <PostSign spec={SIGNS.line} position={[-9.6, 0, 8.4]} rotation={[0, 0.25, 0]} />
      <PostSign spec={SIGNS.hot} position={[12.2, 0, 6.6]} rotation={[0, 0.2, 0]} />
      <PostSign spec={SIGNS.forklift} position={[-20.4, 0, 12.9]} rotation={[0, 0.1, 0]} />

      {/* A stack of empty pallets by the roller door */}
      {Array.from({ length: 6 }, (_, i) => (
        <Slab key={i} size={[1.2, 0.13, 1.0]} position={[-38.6, 0.07 + i * 0.15, -14.6]} material={mats().wood} shadow />
      ))}
    </group>
  );
}
