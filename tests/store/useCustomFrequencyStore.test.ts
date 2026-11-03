// tests/store/useCustomFrequencyStore.test.ts
// DEA-89 — local custom frequency persistence and install boundaries.

import {
  CUSTOM_FREQUENCY_MAX_SAVED,
  createCustomFrequencyDraft,
  type CustomFrequency,
} from '@/engine/calls/CustomFrequency';
import {
  CUSTOM_FREQUENCY_STORAGE_KEY,
  useCustomFrequencyStore,
} from '@/store/useCustomFrequencyStore';

function localFrequency(index = 0): CustomFrequency {
  const frequency = createCustomFrequencyDraft(0, {
    id: `local:test-${index}`,
    name: `Frequency ${index}`,
    createdAt: 1_000 + index,
  });
  if (frequency === null) throw new Error('No draft');
  return frequency;
}

function communityFrequency(remoteId = 'preset-1'): CustomFrequency {
  return {
    ...localFrequency(),
    id: `remote:${remoteId}`,
    origin: 'community',
    remoteId,
    authorName: 'STATIC-1A2B',
    friendCode: 'DA-ABCDE',
  };
}

describe('useCustomFrequencyStore', () => {
  beforeEach(() => {
    useCustomFrequencyStore.setState({ frequencies: [] });
  });

  it('persists under its own key so game saves are untouched', () => {
    expect(useCustomFrequencyStore.persist.getOptions().name).toBe(CUSTOM_FREQUENCY_STORAGE_KEY);
    expect(CUSTOM_FREQUENCY_STORAGE_KEY).toContain('dead_air_save_v1');
  });

  it('saves a valid local frequency', () => {
    const result = useCustomFrequencyStore.getState().saveLocal(localFrequency());
    expect(result.ok).toBe(true);
    expect(result.frequency?.origin).toBe('local');
    expect(useCustomFrequencyStore.getState().frequencies).toHaveLength(1);
  });

  it('updates an existing frequency instead of duplicating it', () => {
    const first = localFrequency();
    useCustomFrequencyStore.getState().saveLocal(first);
    const result = useCustomFrequencyStore.getState().saveLocal({ ...first, name: 'Renamed' });

    expect(result.ok).toBe(true);
    expect(useCustomFrequencyStore.getState().frequencies).toHaveLength(1);
    expect(useCustomFrequencyStore.getState().frequencies[0]?.name).toBe('Renamed');
  });

  it('rejects invalid local input with explicit issues', () => {
    const invalid = localFrequency();
    invalid.composition.openingIndex = 999;
    const result = useCustomFrequencyStore.getState().saveLocal(invalid);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.path === 'composition.openingIndex')).toBe(true);
    expect(useCustomFrequencyStore.getState().frequencies).toHaveLength(0);
  });

  it('installs community frequencies read-only and replaces by remote id', () => {
    const installed = communityFrequency('preset-42');
    const first = useCustomFrequencyStore.getState().install(installed);
    expect(first.ok).toBe(true);
    expect(first.frequency?.origin).toBe('community');
    expect(first.frequency?.remoteId).toBe('preset-42');

    const refreshed = useCustomFrequencyStore
      .getState()
      .install({ ...installed, id: 'remote:renamed', name: 'Refreshed' });
    expect(refreshed.ok).toBe(true);
    expect(useCustomFrequencyStore.getState().frequencies).toHaveLength(1);
    expect(useCustomFrequencyStore.getState().frequencies[0]?.name).toBe('Refreshed');
  });

  it('refuses an install without a community id', () => {
    const result = useCustomFrequencyStore
      .getState()
      .install({ ...localFrequency(), origin: 'community' });
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.path).toBe('remoteId');
  });

  it('refuses invalid imported content', () => {
    const invalid = communityFrequency('preset-bad');
    invalid.composition.callType = 'STAY_CALM' as never;
    const result = useCustomFrequencyStore.getState().install(invalid);
    expect(result.ok).toBe(false);
    expect(useCustomFrequencyStore.getState().frequencies).toHaveLength(0);
  });

  it('enforces the library cap', () => {
    for (let index = 0; index < CUSTOM_FREQUENCY_MAX_SAVED; index += 1) {
      const result = useCustomFrequencyStore.getState().saveLocal(localFrequency(index));
      expect(result.ok).toBe(true);
    }
    const overflow = useCustomFrequencyStore
      .getState()
      .saveLocal(localFrequency(CUSTOM_FREQUENCY_MAX_SAVED));
    expect(overflow.ok).toBe(false);
    expect(useCustomFrequencyStore.getState().frequencies).toHaveLength(CUSTOM_FREQUENCY_MAX_SAVED);
  });

  it('removes a frequency by id', () => {
    const frequency = localFrequency();
    useCustomFrequencyStore.getState().saveLocal(frequency);
    useCustomFrequencyStore.getState().remove(frequency.id);
    expect(useCustomFrequencyStore.getState().frequencies).toHaveLength(0);
  });

  it('retains the published identity when saving a stale local draft', () => {
    const frequency = localFrequency();
    const store = useCustomFrequencyStore.getState();
    store.saveLocal({ ...frequency, remoteId: 'published-one', friendCode: 'DA-ABCDE' });
    store.saveLocal({ ...frequency, name: 'Updated locally' });
    expect(useCustomFrequencyStore.getState().frequencies[0]).toMatchObject({
      name: 'Updated locally',
      remoteId: 'published-one',
      friendCode: 'DA-ABCDE',
    });
  });
});
