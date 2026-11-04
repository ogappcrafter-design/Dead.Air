// data/tapes/types.ts
// Shared tape metadata shape. Kept in its own module so data/tapes.ts can
// aggregate season tapes without a type-only import cycle:
//   data/tapes.ts -> data/seasons/season1/tapes.ts -> data/tapes/types.ts

export interface TapeInfo {
  id: string;
  title: string;
  description: string;
  band: string;
  duration: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}
