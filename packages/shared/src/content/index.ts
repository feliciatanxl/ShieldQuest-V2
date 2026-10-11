// Mission registry. Each district batch owns its own file; this index only concatenates them.
import type { BandId, DistrictId } from '../framework';
import type { Mission } from '../mission';
import { DIGI_MISSIONS } from './digi';
import { RETAIL_MISSIONS } from './retail';
import { SCHOOL_MISSIONS } from './school';

export const MISSIONS: readonly Mission[] = [...SCHOOL_MISSIONS, ...RETAIL_MISSIONS, ...DIGI_MISSIONS];

export const missionById = (id: string): Mission | undefined => MISSIONS.find((m) => m.id === id);

export const missionsForBand = (band: BandId): Mission[] => MISSIONS.filter((m) => m.bands.includes(band));

export const missionsInDistrict = (district: DistrictId, band?: BandId): Mission[] =>
  MISSIONS.filter((m) => m.district === district && (!band || m.bands.includes(band)));
