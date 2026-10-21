import ships from './ships.json';
import translations from './ship-names-zh.json';
import type {ShipSpec} from '../sim/types';

// Display names only: IDs, loadouts, allocation and member identities stay intact.
export const localizedShips:ShipSpec[]=(ships as ShipSpec[]).map(spec=>({
  ...spec,name:translations.names[spec.id as keyof typeof translations.names]?.name??spec.name,
}));
