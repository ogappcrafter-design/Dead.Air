import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_KEY } from '../lib/constants';

export interface LeaderboardEntry {
  id: string;
  callSign: string;
  score: number;
  date: string;
  achievement: string;
}

interface LeaderboardState {
  entries: LeaderboardEntry[];
  addEntry: (entry: Omit<LeaderboardEntry, 'id' | 'date'>) => void;
  getTopEntries: (limit: number) => LeaderboardEntry[];
  reset: () => void;
}

const CALL_SIGN_PREFIXES = [
  'NIGHT',
  'GHOST',
  'STATIC',
  'ECHO',
  'VOID',
  'DEAD',
  'COLD',
  'LOST',
  'DARK',
  'FADE',
  'DRIFT',
  'WHISPER',
  'SHADOW',
  'RADIO',
  'SIGNAL',
];
const CALL_SIGN_SUFFIXES = [
  'OWL',
  'WAVE',
  'FREQ',
  'CALL',
  'BAND',
  'TONE',
  'PULSE',
  'BEAT',
  'HUM',
  'NOISE',
  'STATIC',
  'AIR',
  'DIAL',
  'TUNE',
];

function generateCallSign(): string {
  const prefix =
    CALL_SIGN_PREFIXES[Math.floor(Math.random() * CALL_SIGN_PREFIXES.length)] ?? 'NIGHT';
  const suffix = CALL_SIGN_SUFFIXES[Math.floor(Math.random() * CALL_SIGN_SUFFIXES.length)] ?? 'OWL';
  const num = Math.floor(Math.random() * 100);
  return `${prefix}-${suffix}-${num}`;
}

function generateScore(): number {
  return Math.floor(Math.random() * 5000) + 500;
}

function generateAchievement(): string {
  const achievements = [
    'First Contact',
    'Marathon Listener',
    'Signal Master',
    'Dead Air Survivor',
    'Night Owl',
    'Frequency Hunter',
    'Ghost Chaser',
    'Static Surfer',
    'Lost & Found',
    'Classified Informant',
  ];
  return achievements[Math.floor(Math.random() * achievements.length)] ?? 'First Contact';
}

function generateDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0] ?? '2024-01-01';
}

function generateId(): string {
  return `seed-${Math.random().toString(36).slice(2, 10)}`;
}

function seedEntries(): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];
  for (let i = 0; i < 15; i++) {
    entries.push({
      id: generateId(),
      callSign: generateCallSign(),
      score: generateScore(),
      date: generateDate(Math.floor(Math.random() * 30)),
      achievement: generateAchievement(),
    });
  }
  return entries.sort((a, b) => b.score - a.score);
}

const initialState = {
  entries: seedEntries(),
};

export const useLeaderboardStore = create<LeaderboardState>()(
  persist(
    (set, get) => ({
      ...initialState,
      addEntry: (entry) => {
        const newEntry: LeaderboardEntry = {
          ...entry,
          id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          date: new Date().toISOString().split('T')[0] ?? '2024-01-01',
        };
        const entries = [...get().entries, newEntry].sort((a, b) => b.score - a.score);
        set({ entries });
      },
      getTopEntries: (limit) => {
        return [...get().entries].sort((a, b) => b.score - a.score).slice(0, limit);
      },
      reset: () => set({ entries: seedEntries() }),
    }),
    {
      name: `${SAVE_KEY}_leaderboard`,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export { generateCallSign };
