import type { CallData } from '../engine/calls/types';
import type { Band } from '../lib/constants';

export const SYM: string[];
export const BANDS: Array<{
  id: number;
  name: Band;
  freq: string;
  color: string;
  unlockAt: number;
}>;
export const BAND_VIBES: Record<number, string>;
export const ALL_TAPES: string[];
export const CALLS: CallData[];
