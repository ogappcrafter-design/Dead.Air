import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_KEY } from '../lib/constants';
import { generateFriendCode, isValidFriendCodeFormat } from '../utils/friendCodeGenerator';

interface FriendCodeState {
  myFriendCode: string;
  savedFriendCodes: string[];
  addFriendCode: (code: string) => boolean;
  removeFriendCode: (code: string) => void;
  regenerateMyCode: () => void;
  reset: () => void;
}

const initialState = {
  myFriendCode: '',
  savedFriendCodes: [] as string[],
};

function getOrCreateMyCode(): string {
  return generateFriendCode();
}

export const useFriendCodeStore = create<FriendCodeState>()(
  persist(
    (set, get) => ({
      ...initialState,
      addFriendCode: (code: string): boolean => {
        const normalized = code.toUpperCase().trim();
        if (!isValidFriendCodeFormat(normalized)) return false;
        const saved = get().savedFriendCodes;
        if (saved.includes(normalized)) return false;
        set({ savedFriendCodes: [...saved, normalized] });
        return true;
      },
      removeFriendCode: (code: string) => {
        const normalized = code.toUpperCase().trim();
        set({
          savedFriendCodes: get().savedFriendCodes.filter((c) => c !== normalized),
        });
      },
      regenerateMyCode: () => {
        set({ myFriendCode: getOrCreateMyCode() });
      },
      reset: () => set(initialState),
    }),
    {
      name: `${SAVE_KEY}_friend_codes`,
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state && !state.myFriendCode) {
          state.myFriendCode = getOrCreateMyCode();
        }
      },
    },
  ),
);
