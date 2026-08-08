import {
  useChoiceHistoryStore,
  ChoiceRecord,
  ChoiceHistorySnapshot,
} from '@/store/choiceHistoryStore';
import { SAVE_KEY } from '@/lib/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = `${SAVE_KEY}_choices_v1`;

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function makeRecord(
  callId: number,
  choiceKey: string,
  value: string | number,
  timestamp: number = Date.now(),
): ChoiceRecord {
  return { callId, choiceKey, value, timestamp };
}

describe('choiceHistoryStore', () => {
  beforeEach(() => {
    useChoiceHistoryStore.getState().clear();
  });

  describe('recordChoice', () => {
    it('appends a new choice to the history', () => {
      const store = useChoiceHistoryStore.getState();
      store.recordChoice(1001, 'RIGHT_ANSWER:1001:0', 'Door A');

      const state = useChoiceHistoryStore.getState();
      expect(state.choices).toHaveLength(1);
      expect(state.choices[0]).toMatchObject({
        callId: 1001,
        choiceKey: 'RIGHT_ANSWER:1001:0',
        value: 'Door A',
      });
      expect(typeof state.choices[0].timestamp).toBe('number');
    });

    it('deduplicates by choiceKey — last write wins', () => {
      const store = useChoiceHistoryStore.getState();
      store.recordChoice(1001, 'KEY_X', 'first');
      store.recordChoice(1002, 'KEY_X', 'second');

      const state = useChoiceHistoryStore.getState();
      expect(state.choices).toHaveLength(1);
      expect(state.choices[0].value).toBe('second');
      expect(state.choices[0].callId).toBe(1002);
    });

    it('preserves separate records for different choiceKeys', () => {
      const store = useChoiceHistoryStore.getState();
      store.recordChoice(1001, 'KEY_A', 'valA');
      store.recordChoice(1001, 'KEY_B', 'valB');

      const state = useChoiceHistoryStore.getState();
      expect(state.choices).toHaveLength(2);
    });

    it('trims history at MAX_RECORDS (500)', () => {
      const store = useChoiceHistoryStore.getState();
      for (let i = 0; i < 520; i++) {
        store.recordChoice(1000 + i, `KEY_${i}`, i);
      }

      const state = useChoiceHistoryStore.getState();
      expect(state.choices.length).toBeLessThanOrEqual(500);
      // oldest entries should be trimmed
      expect(state.choices[0].choiceKey).not.toBe('KEY_0');
    });
  });

  describe('hasChoice', () => {
    it('returns true when a choiceKey exists', () => {
      const store = useChoiceHistoryStore.getState();
      store.recordChoice(1001, 'KNOWN_KEY', 'val');

      expect(useChoiceHistoryStore.getState().hasChoice('KNOWN_KEY')).toBe(true);
    });

    it('returns false when a choiceKey does not exist', () => {
      expect(useChoiceHistoryStore.getState().hasChoice('MISSING_KEY')).toBe(false);
    });

    it('returns true after dedup replacement', () => {
      const store = useChoiceHistoryStore.getState();
      store.recordChoice(1001, 'KEY_D', 'first');
      store.recordChoice(1002, 'KEY_D', 'second');

      expect(useChoiceHistoryStore.getState().hasChoice('KEY_D')).toBe(true);
    });
  });

  describe('getChoice', () => {
    it('returns the most recent value for a choiceKey', () => {
      const store = useChoiceHistoryStore.getState();
      store.recordChoice(1001, 'KEY_R', 'old');
      store.recordChoice(1002, 'KEY_R', 'new');

      const result = useChoiceHistoryStore.getState().getChoice('KEY_R');
      expect(result).toBeDefined();
      expect(result!.value).toBe('new');
    });

    it('returns undefined for unknown choiceKey', () => {
      expect(useChoiceHistoryStore.getState().getChoice('NOPE')).toBeUndefined();
    });

    it('returns the full ChoiceRecord', () => {
      const store = useChoiceHistoryStore.getState();
      store.recordChoice(1001, 'KEY_FULL', 'val');

      const result = useChoiceHistoryStore.getState().getChoice('KEY_FULL');
      expect(result).toBeDefined();
      expect(result!.callId).toBe(1001);
      expect(result!.choiceKey).toBe('KEY_FULL');
      expect(result!.value).toBe('val');
    });
  });

  describe('getChoicesForCall', () => {
    it('returns all choices made in a specific call', () => {
      const store = useChoiceHistoryStore.getState();
      store.recordChoice(1001, 'K1', 'v1');
      store.recordChoice(1001, 'K2', 'v2');
      store.recordChoice(1002, 'K3', 'v3');

      const result = useChoiceHistoryStore.getState().getChoicesForCall(1001);
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.choiceKey)).toEqual(
        expect.arrayContaining(['K1', 'K2']),
      );
    });

    it('returns empty array for a call with no choices', () => {
      useChoiceHistoryStore.getState().recordChoice(1001, 'K1', 'v1');

      expect(useChoiceHistoryStore.getState().getChoicesForCall(9999)).toEqual([]);
    });
  });

  describe('hasChoicePattern', () => {
    it('returns true when any choiceKey matches the regex', () => {
      const store = useChoiceHistoryStore.getState();
      store.recordChoice(1001, 'RIGHT_ANSWER:1001:0', 'Door A');
      store.recordChoice(1002, 'SIGNAL_DECODE:1002:1', 'Decode B');

      expect(
        useChoiceHistoryStore.getState().hasChoicePattern(/^RIGHT_ANSWER:/),
      ).toBe(true);
      expect(
        useChoiceHistoryStore.getState().hasChoicePattern(/^SIGNAL_DECODE:/),
      ).toBe(true);
    });

    it('returns false when no choiceKey matches the regex', () => {
      const store = useChoiceHistoryStore.getState();
      store.recordChoice(1001, 'RIGHT_ANSWER:1001:0', 'Door A');

      expect(
        useChoiceHistoryStore.getState().hasChoicePattern(/^STAY_CALM:/),
      ).toBe(false);
    });

    it('returns false on empty history', () => {
      expect(
        useChoiceHistoryStore.getState().hasChoicePattern(/.*/),
      ).toBe(false);
    });
  });

  describe('toSnapshot', () => {
    it('returns a ChoiceHistorySnapshot with bound query methods', () => {
      const store = useChoiceHistoryStore.getState();
      store.recordChoice(1001, 'SNAP_KEY', 'snapval');

      const snapshot: ChoiceHistorySnapshot =
        useChoiceHistoryStore.getState().toSnapshot();

      expect(snapshot.records).toHaveLength(1);
      expect(snapshot.hasChoice('SNAP_KEY')).toBe(true);
      expect(snapshot.getChoice('SNAP_KEY')!.value).toBe('snapval');
      expect(snapshot.getChoicesForCall(1001)).toHaveLength(1);
      expect(snapshot.hasChoicePattern(/^SNAP_/)).toBe(true);
    });

    it('snapshot records array is a copy — pushing does not affect store', () => {
      const store = useChoiceHistoryStore.getState();
      store.recordChoice(1001, 'K_IMM', 'val');

      const snapshot = useChoiceHistoryStore.getState().toSnapshot();
      snapshot.records.push({ callId: 9999, choiceKey: 'INJECTED', value: 'x', timestamp: 0 });

      expect(useChoiceHistoryStore.getState().choices).toHaveLength(1);
      expect(useChoiceHistoryStore.getState().hasChoice('INJECTED')).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all choices from the store', () => {
      const store = useChoiceHistoryStore.getState();
      store.recordChoice(1001, 'K1', 'v1');
      store.recordChoice(1002, 'K2', 'v2');
      expect(useChoiceHistoryStore.getState().choices).toHaveLength(2);

      useChoiceHistoryStore.getState().clear();

      expect(useChoiceHistoryStore.getState().choices).toHaveLength(0);
      expect(useChoiceHistoryStore.getState().hasChoice('K1')).toBe(false);
    });
  });

  describe('persistence', () => {
    it('persists choices to AsyncStorage under the correct key', async () => {
      useChoiceHistoryStore.getState().recordChoice(1001, 'PERSIST_KEY', 'val');

      await flushPromises();

      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.state.choices).toBeDefined();
      expect(parsed.state.choices).toHaveLength(1);
      expect(parsed.state.choices[0].choiceKey).toBe('PERSIST_KEY');
    });
  });
});
