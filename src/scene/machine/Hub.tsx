import { mats } from '../materials';
import { Box, Cyl, Motor } from '../parts';
import { H_ARM } from '../layout';

/** The turret: cream drum with a ring of small blue gear motors (style bible, hero table). */
export function Hub() {
  const M = mats();
  return (
    <group>
      <Cyl r={2.0} h={0.22} position={[0, 0.11, 0]} material={M.steelDark} segments={48} />
      <Cyl r={1.45} h={H_ARM - 0.75} position={[0, 0.22 + (H_ARM - 0.75) / 2, 0]} material={M.cream} segments={48} />
      {/* Access panels round the drum */}
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i} rotation={[0, (i * Math.PI) / 4 + 0.39, 0]}>
          <Box size={[0.06, 0.9, 0.62]} position={[1.45, 0.95, 0]} material={M.creamDark} radius={0.02} />
        </group>
      ))}
      {/* Bearing ring the arms hang from */}
      <Cyl r={1.62} h={0.5} position={[0, H_ARM - 0.28, 0]} material={M.steelDark} segments={48} />
      <Cyl r={1.5} h={0.95} position={[0, H_ARM + 0.4, 0]} material={M.cream} segments={48} />
      <Cyl r={1.56} h={0.08} position={[0, H_ARM + 0.9, 0]} material={M.creamDark} segments={48} />
      {/* Ring of gear motors on top */}
      {Array.from({ length: 8 }, (_, i) => (
        <group key={`m${i}`} rotation={[0, (i * Math.PI) / 4, 0]}>
          <group position={[0.98, H_ARM + 1.16, 0]} rotation={[0, 0, Math.PI / 2]}>
            <Motor length={0.44} r={0.13} />
          </group>
          <Box size={[0.3, 0.2, 0.3]} position={[0.98, H_ARM + 0.98, 0]} material={M.blueDark} radius={0.03} />
        </group>
      ))}
      <Cyl r={0.5} h={0.5} position={[0, H_ARM + 1.15, 0]} material={M.steelDark} segments={24} />
      <Cyl r={0.2} h={0.9} position={[0, H_ARM + 1.6, 0]} material={M.steel} segments={16} />
    </group>
  );
}
