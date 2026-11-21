/**
 * Moulds and the tanks that come out of them, modelled from the hoist photo:
 * black dome-topped steel moulds; grey ribbed tanks with a black top.
 * Sizes are by eye (4,000 L and 2,000 L tanks) and feed no calculation.
 */
import { forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { mats } from '../materials';
import { Box, Cyl } from '../parts';
import type { MouldKind } from '../../sim/types';

export const MOULD_DIM: Record<MouldKind, { r: number; h: number }> = {
  CTT4: { r: 0.98, h: 2.35 },
  CTT2: { r: 0.7, h: 1.72 },
  HTT2: { r: 0.62, h: 1.95 }, // lying down: h is its length
  OTHER: { r: 0.8, h: 1.5 },
};

/** Where each mould sits in the cradle, in cradle coordinates (x along the arm). */
export function mouldSlots(moulds: MouldKind[]): [number, number, number][] {
  if (moulds.length <= 1) return [[0, 0, 0]];
  return moulds.map((_, i) => [(i - (moulds.length - 1) / 2) * 1.5, 0, 0]);
}

interface MouldProps {
  kind: MouldKind;
  material: THREE.Material;
  /** Ref to the part that opens (lid or hatch). */
  lidRef?: React.Ref<THREE.Group>;
}

/** Upright dome-topped mould (CTT4, CTT2). Origin at its centre. */
function VerticalMould({ r, h, material, lidRef }: { r: number; h: number; material: THREE.Material; lidRef?: React.Ref<THREE.Group> }) {
  const M = mats();
  const dome = r * 0.42;
  const body = h - dome;
  const y0 = -h / 2;
  return (
    <group>
      <Cyl r={r} h={body} position={[0, y0 + body / 2, 0]} material={material} segments={36} />
      <Cyl r={r * 0.96} h={0.06} position={[0, y0 + 0.03, 0]} material={M.mouldTrim} segments={36} />
      {/* Flange where the lid bolts on */}
      <Cyl r={r + 0.07} h={0.08} position={[0, y0 + body, 0]} material={M.mouldTrim} segments={36} />
      {/* Stiffening bands and ribs */}
      {[0.28, 0.62].map((f) => (
        <Cyl key={f} r={r + 0.035} h={0.07} position={[0, y0 + body * f, 0]} material={M.mouldTrim} segments={36} />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i} rotation={[0, (i * Math.PI) / 4, 0]}>
          <Box size={[0.05, body * 0.92, 0.07]} position={[r + 0.02, y0 + body * 0.5, 0]} material={M.mouldTrim} radius={0.01} />
        </group>
      ))}
      <group ref={lidRef} position={[0, y0 + body + 0.04, 0]}>
        <mesh material={material} scale={[1, dome / r, 1]} castShadow receiveShadow>
          <sphereGeometry args={[r, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <Cyl r={r * 0.22} h={0.16} position={[0, dome + 0.02, 0]} material={M.mouldTrim} segments={16} />
        {Array.from({ length: 6 }, (_, i) => (
          <group key={i} rotation={[0, (i * Math.PI) / 3, 0]}>
            <Box size={[r * 0.82, 0.04, 0.05]} position={[r * 0.52, dome * 0.55, 0]} rotation={[0, 0, -0.42]} material={M.mouldTrim} radius={0.008} />
          </group>
        ))}
      </group>
    </group>
  );
}

/** Lying mould for the horizontal tank (HTT2). Long axis along z. */
function HorizontalMould({ r, len, material, lidRef }: { r: number; len: number; material: THREE.Material; lidRef?: React.Ref<THREE.Group> }) {
  const M = mats();
  const body = len - r * 0.9;
  return (
    <group>
      <Cyl r={r} h={body} rotation={[Math.PI / 2, 0, 0]} material={material} segments={32} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0, (s * body) / 2]} rotation={[(s * Math.PI) / 2, 0, 0]} scale={[1, 0.45, 1]} material={material} castShadow receiveShadow>
          <sphereGeometry args={[r, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      ))}
      {[-0.36, -0.12, 0.12, 0.36].map((f) => (
        <Cyl key={f} r={r + 0.035} h={0.06} position={[0, 0, body * f]} rotation={[Math.PI / 2, 0, 0]} material={M.mouldTrim} segments={32} />
      ))}
      {/* Parting flange along the split line */}
      <Box size={[2 * r + 0.16, 0.06, body + 0.1]} material={M.mouldTrim} radius={0.01} />
      {/* Saddle feet */}
      {[-0.3, 0.3].map((f) => (
        <Box key={f} size={[r * 1.5, 0.1, 0.12]} position={[0, -r - 0.03, body * f]} material={M.mouldTrim} radius={0.01} />
      ))}
      <group ref={lidRef} position={[0, r * 0.96, 0]}>
        <Box size={[r * 0.9, 0.07, body * 0.5]} material={M.mouldTrim} radius={0.02} />
        <Cyl r={0.14} h={0.14} position={[0, 0.08, 0]} material={M.mouldTrim} segments={14} />
      </group>
    </group>
  );
}

/** Mould of another NTG product. Not modelled individually in the data, so it is a plain ribbed box. */
function OtherMould({ material, lidRef }: { material: THREE.Material; lidRef?: React.Ref<THREE.Group> }) {
  const M = mats();
  return (
    <group>
      <Box size={[1.7, 1.25, 1.5]} position={[0, -0.12, 0]} material={material} radius={0.08} />
      {[-0.5, 0, 0.5].map((x) => (
        <Box key={x} size={[0.07, 1.3, 1.56]} position={[x, -0.12, 0]} material={M.mouldTrim} radius={0.01} />
      ))}
      <group ref={lidRef} position={[0, 0.54, 0]}>
        <Box size={[1.76, 0.1, 1.56]} material={M.mouldTrim} radius={0.03} />
      </group>
    </group>
  );
}

export function Mould({ kind, material, lidRef }: MouldProps) {
  const d = MOULD_DIM[kind];
  if (kind === 'HTT2') return <HorizontalMould r={d.r} len={d.h} material={material} lidRef={lidRef} />;
  if (kind === 'OTHER') return <OtherMould material={material} lidRef={lidRef} />;
  return <VerticalMould r={d.r} h={d.h} material={material} lidRef={lidRef} />;
}

/** Height of the mould's lid above its centre, for the hoist. */
export function mouldTop(kind: MouldKind): number {
  const d = MOULD_DIM[kind];
  return kind === 'HTT2' ? d.r : kind === 'OTHER' ? 0.6 : d.h / 2;
}

// ---- Finished tanks -----------------------------------------------------------

/** Ribbed wall profile for a tank body, turned on a lathe. */
function useRibbedProfile(r: number, h: number, ribs: number) {
  return useMemo(() => {
    const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0), new THREE.Vector2(r * 0.97, 0)];
    const step = h / ribs;
    for (let i = 0; i < ribs; i++) {
      const y = i * step;
      pts.push(new THREE.Vector2(r, y + step * 0.12), new THREE.Vector2(r, y + step * 0.78), new THREE.Vector2(r * 0.965, y + step * 0.9), new THREE.Vector2(r * 0.965, y + step));
    }
    return pts;
  }, [r, h, ribs]);
}

export const TANK_DIM: Record<MouldKind, { r: number; h: number }> = {
  CTT4: { r: 0.9, h: 2.15 },
  CTT2: { r: 0.63, h: 1.56 },
  HTT2: { r: 0.56, h: 1.8 },
  OTHER: { r: 0.6, h: 1.0 },
};

/** A finished tank. Origin at the middle of its base (standing on the floor). */
export const Tank = forwardRef<THREE.Group, { kind: MouldKind } & JSX.IntrinsicElements['group']>(function Tank({ kind, ...rest }, ref) {
  const M = mats();
  const d = TANK_DIM[kind];
  const cone = kind === 'CTT4' ? 0.42 : 0.3;
  const bodyH = d.h - cone;
  const profile = useRibbedProfile(d.r, bodyH, kind === 'CTT4' ? 7 : 5);
  if (kind === 'HTT2') {
    const body = d.h - d.r * 0.8;
    return (
      <group ref={ref} {...rest}>
        <group position={[0, d.r + 0.08, 0]}>
          <Cyl r={d.r} h={body} rotation={[Math.PI / 2, 0, 0]} material={M.tank} segments={30} />
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, 0, (s * body) / 2]} rotation={[(s * Math.PI) / 2, 0, 0]} scale={[1, 0.4, 1]} material={M.tank} castShadow receiveShadow>
              <sphereGeometry args={[d.r, 26, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
          ))}
          {[-0.3, 0, 0.3].map((f) => (
            <Cyl key={f} r={d.r + 0.025} h={0.09} position={[0, 0, body * f]} rotation={[Math.PI / 2, 0, 0]} material={M.tank} segments={30} />
          ))}
          {[-0.28, 0.28].map((f) => (
            <Box key={f} size={[d.r * 1.5, 0.16, 0.2]} position={[0, -d.r, body * f]} material={M.tank} radius={0.03} />
          ))}
          <Cyl r={0.2} h={0.12} position={[0, d.r + 0.03, 0]} material={M.tankTop} segments={18} />
        </group>
      </group>
    );
  }
  if (kind === 'OTHER') {
    return (
      <group ref={ref} {...rest}>
        <Cyl r={0.5} rTop={0.62} h={d.h} position={[0, d.h / 2, 0]} material={M.tankOther} segments={26} />
        <Cyl r={0.66} h={0.08} position={[0, d.h - 0.04, 0]} material={M.tankOther} segments={26} />
      </group>
    );
  }
  return (
    <group ref={ref} {...rest}>
      <mesh material={M.tank} castShadow receiveShadow>
        <latheGeometry args={[profile, 28]} />
      </mesh>
      {/* Black conical top with ribs and a lid, as in the photo */}
      <group position={[0, bodyH, 0]}>
        <Cyl r={d.r * 1.01} h={0.1} position={[0, 0.05, 0]} material={M.tankTop} segments={40} />
        <Cyl r={d.r} rTop={d.r * 0.3} h={cone - 0.1} position={[0, 0.1 + (cone - 0.1) / 2, 0]} material={M.tankTop} segments={40} />
        {Array.from({ length: 8 }, (_, i) => (
          <group key={i} rotation={[0, (i * Math.PI) / 4, 0]}>
            <Box size={[d.r * 0.74, 0.05, 0.06]} position={[d.r * 0.62, 0.1 + (cone - 0.1) * 0.52, 0]} rotation={[0, 0, -Math.atan2(cone - 0.1, d.r * 0.7)]} material={M.tankTop} radius={0.01} />
          </group>
        ))}
        <Cyl r={d.r * 0.3} h={0.1} position={[0, cone + 0.03, 0]} material={M.tankTop} segments={24} />
      </group>
    </group>
  );
});
