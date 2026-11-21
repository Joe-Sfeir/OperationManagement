import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { palette } from '../../design/tokens';
import { clock } from '../../app/store';
import { usePlant } from '../plant';
import { mats } from '../materials';
import { Box, Cyl, Ladder, Motor, PanelWall, Railing } from '../parts';
import { H_ARM, R_ARM } from '../layout';

// Oven box, in machine coordinates with x along the oven arm (radial) and z across it.
const CX = R_ARM + 0.15; // centre
const HX = 2.55; // half length (radial)
const HZ = 2.5; // half width
const H = 5.0;
const WALL = 0.22;
const CUT = 0.95; // height the camera-side wall is cut at
const SLOT = 0.55; // half height of the slot the arm beam sweeps through

/**
 * Cooking chamber: cream panelled box with blue sliding doors, drawn as a
 * section model. The wall and half the roof on the camera side are cut away
 * so the mould and the glow can be seen. Doors, glow and stack shimmer all
 * follow the simulator's oven state.
 */
export function Oven({ onSelect }: { onSelect?: () => void }) {
  const plant = usePlant();
  const M = mats();
  const doorIn = useRef<THREE.Group>(null);
  const doorOut = useRef<THREE.Group>(null);
  const glow = useRef<THREE.PointLight>(null);
  const spill = useRef<THREE.PointLight>(null);
  const outline = useRef<THREE.Group>(null);
  const shimmer = useRef<THREE.Group>(null);
  const lining = useMemo(() => M.ovenLining.clone(), [M]);
  const outlineMat = useMemo(() => new THREE.MeshBasicMaterial({ color: palette.heatAmber, toneMapped: false }), []);
  const shimmerMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#E9E4D8', transparent: true, opacity: 0.0, depthWrite: false }), []);

  useFrame(() => {
    const s = plant.get();
    const set = plant.result.config.oven.setC;
    // 0 at room temperature, 1 at the set point.
    const heat = Math.min(1, Math.max(0, (s.oven.tempC - 40) / (set - 40)));
    lining.emissiveIntensity = 0.06 + heat * heat * 0.42;
    if (glow.current) glow.current.intensity = heat * heat * 26;
    if (spill.current) spill.current.intensity = heat * heat * 12;
    if (doorIn.current) doorIn.current.position.x = s.oven.doorIn * (2 * HX - 0.5);
    if (doorOut.current) doorOut.current.position.x = s.oven.doorOut * (2 * HX - 0.5);
    // Amber outline only while arms are queuing for the oven: it is the limiting station then.
    if (outline.current) outline.current.visible = s.ovenQueue > 0 && s.bottleneck === 'oven';
    if (shimmer.current) {
      shimmerMat.opacity = heat * 0.1;
      shimmer.current.children.forEach((c, i) => {
        // Rises with simulated time: frozen when the clock is paused.
        const p = (clock.t * 0.9 + i * 0.37) % 1;
        c.position.y = p * 1.6;
        c.scale.setScalar(0.25 + p * 0.5);
      });
    }
  });

  return (
    <group position={[CX, 0, 0]} onClick={(e) => (e.stopPropagation(), onSelect?.())}>
      {/* Hearth */}
      <Box size={[2 * HX, 0.12, 2 * HZ]} position={[0, 0.06, 0]} material={lining} radius={0.01} />

      {/* End wall (away from the hub) */}
      <group position={[HX - WALL / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <PanelWall w={2 * HZ} h={H} cols={4} rows={3} material={M.cream} depth={WALL} />
      </group>
      <Box size={[0.05, H - 0.2, 2 * HZ - 2 * WALL]} position={[HX - WALL - 0.02, H / 2, 0]} material={lining} radius={0.005} shadow={false} />

      {/* Hub-side wall, with the slot the arm beam sweeps through */}
      <group position={[-HX + WALL / 2, (H_ARM - SLOT) / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <PanelWall w={2 * HZ} h={H_ARM - SLOT} cols={4} rows={1} material={M.cream} depth={WALL} />
      </group>
      <group position={[-HX + WALL / 2, (H + H_ARM + SLOT) / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <PanelWall w={2 * HZ} h={H - H_ARM - SLOT} cols={4} rows={1} material={M.cream} depth={WALL} />
      </group>

      {/* Exit side (far from the camera): frame and a full blue sliding door */}
      <group position={[0, 0, -HZ + WALL / 2]}>
        <Box size={[2 * HX, 0.5, WALL]} position={[0, H - 0.25, 0]} material={M.cream} radius={0.02} />
        <Box size={[0.3, H, WALL]} position={[-HX + 0.15, H / 2, 0]} material={M.cream} radius={0.02} />
        <Box size={[0.3, H, WALL]} position={[HX - 0.15, H / 2, 0]} material={M.cream} radius={0.02} />
        <group ref={doorOut}>
          <Box size={[2 * HX - 0.5, H - 0.6, 0.12]} position={[0, (H - 0.6) / 2 + 0.05, -0.2]} material={M.blue} radius={0.02} />
          <Box size={[2 * HX - 0.6, H - 0.7, 0.03]} position={[0, (H - 0.6) / 2 + 0.05, -0.125]} material={lining} radius={0.005} shadow={false} />
          {[-1.1, 0, 1.1].map((x) => (
            <Box key={x} size={[0.08, H - 0.7, 0.05]} position={[x, (H - 0.6) / 2 + 0.05, -0.12]} material={M.blueDark} radius={0.01} />
          ))}
        </group>
        {/* Door rail, running out past the end of the oven */}
        <Box size={[4 * HX - 0.4, 0.16, 0.16]} position={[HX - 0.2, H - 0.42, -0.24]} material={M.cream} radius={0.02} />
        <Box size={[0.16, H - 0.42, 0.16]} position={[3 * HX - 0.5, (H - 0.42) / 2, -0.24]} material={M.cream} radius={0.02} />
        <Box size={[0.16, H - 0.42, 0.16]} position={[2 * HX - 0.2, (H - 0.42) / 2, -0.24]} material={M.cream} radius={0.02} />
      </group>

      {/* Entry side (toward the camera): cut away above the sill. The cut face is dark. */}
      <group position={[0, 0, HZ - WALL / 2]}>
        <Box size={[0.3, CUT, WALL]} position={[-HX + 0.15, CUT / 2, 0]} material={M.cream} radius={0.02} />
        <Box size={[0.3, CUT, WALL]} position={[HX - 0.15, CUT / 2, 0]} material={M.cream} radius={0.02} />
        <Box size={[0.3, 0.03, WALL]} position={[-HX + 0.15, CUT + 0.015, 0]} material={M.section} radius={0.002} shadow={false} />
        <Box size={[0.3, 0.03, WALL]} position={[HX - 0.15, CUT + 0.015, 0]} material={M.section} radius={0.002} shadow={false} />
        <group ref={doorIn}>
          <Box size={[2 * HX - 0.5, CUT - 0.08, 0.12]} position={[0, (CUT - 0.08) / 2 + 0.05, 0.2]} material={M.blue} radius={0.02} />
          <Box size={[2 * HX - 0.5, 0.03, 0.12]} position={[0, CUT - 0.01, 0.2]} material={M.section} radius={0.002} shadow={false} />
        </group>
        <Box size={[4 * HX - 0.4, 0.07, 0.12]} position={[HX - 0.2, 0.035, 0.22]} material={M.steelDark} radius={0.02} />
      </group>
      {/* Cut edges of the end and hub walls */}
      <Box size={[WALL, H - CUT, 0.03]} position={[HX - WALL / 2, (H + CUT) / 2, HZ - 0.015]} material={M.section} radius={0.002} shadow={false} />

      {/* Roof: the far half only; cut edge dark */}
      <Box size={[2 * HX, 0.2, HZ + 0.4]} position={[0, H + 0.1, -HZ / 2 + 0.2 - 0.4]} material={M.cream} radius={0.03} />
      <Box size={[2 * HX, 0.2, 0.03]} position={[0, H + 0.1, 0.02]} material={M.section} radius={0.002} shadow={false} />
      <Box size={[2 * HX - 2 * WALL, 0.05, HZ]} position={[0, H - 0.02, -HZ / 2]} material={lining} radius={0.005} shadow={false} />
      {/* Roof platform rail and the exhaust stack (cooking chamber drawing) */}
      <group position={[0, H + 0.2, 0]}>
        <Railing points={[[-HX + 0.1, 0, -0.25], [-HX + 0.1, 0, -HZ - 0.05], [HX - 0.1, 0, -HZ - 0.05], [HX - 0.1, 0, -0.25]]} />
        <Cyl r={0.4} h={0.25} position={[0.9, 0.125, -1.3]} material={M.creamDark} segments={24} />
        <Cyl r={0.33} h={2.1} position={[0.9, 1.25, -1.3]} material={M.galvanised} segments={24} />
        <Cyl r={0.42} rTop={0.1} h={0.25} position={[0.9, 2.55, -1.3]} material={M.galvanised} segments={24} />
        <group ref={shimmer} position={[0.9, 2.75, -1.3]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} material={shimmerMat}>
              <sphereGeometry args={[0.4, 10, 8]} />
            </mesh>
          ))}
        </group>
      </group>
      {/* Burner and blower on the end wall */}
      <group position={[HX + 0.45, 1.5, -1.0]}>
        <Box size={[0.7, 0.8, 0.7]} material={M.blueDark} radius={0.06} />
        <group position={[0.1, 0.7, 0]} rotation={[0, 0, Math.PI / 2]}>
          <Motor length={0.6} r={0.2} />
        </group>
        <Cyl r={0.2} h={0.5} position={[-0.4, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={M.steelDark} segments={16} />
      </group>
      <group position={[HX + 0.06, 0, 1.5]} rotation={[0, Math.PI / 2, 0]}>
        <Ladder height={H + 0.2} />
      </group>

      {/* The only warm lights in the scene: inside the oven, and its spill on the floor in front */}
      <pointLight ref={glow} position={[0, H_ARM, 0]} color={palette.heatAmber} distance={7} decay={1.6} intensity={0} />
      <pointLight ref={spill} position={[0, 3.0, HZ + 0.2]} color={palette.heatAmber} distance={9} decay={1.6} intensity={0} />

      {/* Amber outline on the floor while the oven is the limiting station */}
      <group ref={outline} visible={false}>
        {[
          [0, HZ + 0.6, 2 * HX + 1.2, 0.09],
          [0, -HZ - 0.6, 2 * HX + 1.2, 0.09],
        ].map(([x, z, w, d], i) => (
          <mesh key={i} position={[x!, 0.03, z!]} material={outlineMat}>
            <boxGeometry args={[w!, 0.02, d!]} />
          </mesh>
        ))}
        {[-HX - 0.6, HX + 0.6].map((x) => (
          <mesh key={x} position={[x, 0.03, 0]} material={outlineMat}>
            <boxGeometry args={[0.09, 0.02, 2 * HZ + 1.29]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
