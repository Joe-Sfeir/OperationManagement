import { PLAN_ROT } from './layout';
import { usePlant } from './plant';
import { useTwin } from '../app/store';
import { Floor, MachineSlab } from './machine/Floor';
import { Hub } from './machine/Hub';
import { Arm } from './machine/Arm';
import { Oven } from './machine/Oven';
import { AirPosition, CoolingChamber } from './machine/Cooling';
import { LoadingStation } from './machine/Loading';
import { DemouldStation } from './machine/Demould';
import { Console, Operators } from './machine/Extras';
import { StationLabels, WaitCues } from './machine/Cues';
import { CoolingDetails, HubDetails, OvenDetails } from './machine/Details';
import { R_ARM } from './layout';

/** Machine 3700. Every part is its own component and reads the plant state. */
/** `inHall`: the building supplies the floor. Otherwise the machine stands on its own slab. */
export function MachineScene({ interactive = true, inHall = false }: { interactive?: boolean; inHall?: boolean }) {
  const plant = usePlant();
  const select = useTwin((s) => s.select);
  return (
    <group rotation={[0, PLAN_ROT, 0]}>
      {!inHall && <MachineSlab />}
      <Floor />
      <Hub />
      <HubDetails />
      <OvenDetails cx={R_ARM + 0.15} hx={2.55} />
      <CoolingDetails />
      {plant.result.config.arms.map((_, i) => (
        <Arm key={i} id={i} />
      ))}
      <Oven onSelect={interactive ? () => select('oven') : undefined} />
      {plant.result.ring.includes('air') && <AirPosition />}
      <CoolingChamber onSelect={interactive ? () => select('chamber') : undefined} />
      <LoadingStation onSelect={interactive ? () => select('load') : undefined} />
      <DemouldStation onSelect={interactive ? () => select('demould') : undefined} />
      <Console />
      <Operators />
      <WaitCues />
      {interactive && <StationLabels onSelect={select} />}
    </group>
  );
}
