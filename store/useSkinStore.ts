// store/useSkinStore.ts
// Cosmetic radio skin state. Tracks the active skin and owned skins.
// Zustand + persist + AsyncStorage. Follows useStoreStore pattern.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SKINS_KEY } from '../lib/constants';
import { DEFAULT_SKIN_ID, PURCHASABLE_SKIN_IDS } from '../lib/skins';

interface SkinState {
  // Currently selected skin id
  activeSkin: string;
  // Owned skin ids (always includes 'default')
  ownedSkins: string[];

  // Actions
  setActiveSkin: (skinId: string) => void;
  addOwnedSkin: (skinId: string) => void;
  isOwned: (skinId: string) => boolean;
  resetSkins: () => void;
}

export const useSkinStore = create<SkinState>()(
  persist(
    (set, get) => ({
      activeSkin: DEFAULT_SKIN_ID,
      ownedSkins: [DEFAULT_SKIN_ID],

      setActiveSkin: (skinId) => {
        // Only allow selecting owned skins
        if (get().ownedSkins.includes(skinId) || skinId === DEFAULT_SKIN_ID) {
          set({ activeSkin: skinId });
        }
      },

      addOwnedSkin: (skinId) => {
        const existing = get().ownedSkins;
        if (!existing.includes(skinId)) {
          set({ ownedSkins: [...existing, skinId] });
        }
      },

      isOwned: (skinId) => get().ownedSkins.includes(skinId),

      resetSkins: () =>
        set({
          activeSkin: DEFAULT_SKIN_ID,
          ownedSkins: [DEFAULT_SKIN_ID],
        }),
    }),
    {
      name: SKINS_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeSkin: state.activeSkin,
        ownedSkins: state.ownedSkins,
      }),
    },
  ),
);

// Helper: check if a product ID is a skin product
export function isSkinProductId(productId: string): boolean {
  return PURCHASABLE_SKIN_IDS.some((skinId) => `com.deadair.skin.${skinId}` === productId);
}

// Map a skin product ID to its skin id
export function skinIdFromProductId(productId: string): string | null {
  if (!productId.startsWith('com.deadair.skin.')) return null;
  const skinId = productId.replace('com.deadair.skin.', '');
  return PURCHASABLE_SKIN_IDS.includes(skinId) ? skinId : null;
}
