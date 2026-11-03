import { act, fireEvent, render } from '@testing-library/react-native';
import { CommunityBrowser } from '@/components/mod/CommunityBrowser';
import { createCustomFrequencyDraft } from '@/engine/calls/CustomFrequency';
import { customFrequencyToPresetInput } from '@/lib/community/frequencyPreset';
import type { Preset } from '@/lib/community/schema';
import type { PresetListResult } from '@/lib/community/client';
import { useFriendCodeStore } from '@/store/useFriendCodeStore';
import { useCustomFrequencyStore } from '@/store/useCustomFrequencyStore';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('@/lib/community/appClient', () => ({
  getCommunityClient: () => ({ listPresets: mockList }),
}));
const mockList = jest.fn<Promise<PresetListResult>, [Record<string, unknown>]>();

function preset(id: string): Preset {
  const frequency = createCustomFrequencyDraft(0, { id, name: `Wave ${id}`, createdAt: 1 });
  if (!frequency) throw new Error('Missing draft');
  const input = customFrequencyToPresetInput(frequency);
  return {
    ...input,
    description: '',
    tags: [],
    id,
    friendCode: null,
    authorName: 'Author',
    schemaVersion: 2,
    status: 'published',
    reportCount: 0,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function page(ids: string[], nextCursor: string | null = null): PresetListResult {
  return { presets: ids.map(preset), nextCursor, source: 'network', stale: false };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockList.mockReset().mockResolvedValue(page([]));
  useFriendCodeStore.setState({ savedFriendCodes: ['DA-ABCDE', 'DA-ZYXWV'] });
  useCustomFrequencyStore.setState({ frequencies: [] });
});

it.each(['initial', 'query', 'band', 'friend', 'savedFriend'])(
  'paginates %s discovery with its original filters',
  async (mode) => {
    mockList.mockResolvedValue(
      page(
        Array.from({ length: 20 }, (_, index) => String(index)),
        'next-page',
      ),
    );
    const view = await render(<CommunityBrowser communityEnabled baseUrlConfigured />);
    let filters: Record<string, unknown> = { limit: 20 };
    if (mode !== 'initial') {
      await act(async () => {
        if (mode === 'query') {
          await fireEvent.changeText(view.getByTestId('community-search'), 'wave');
          filters = { ...filters, q: 'wave' };
        }
        if (mode === 'band') {
          await fireEvent.press(view.getByTestId('community-band-0'));
          filters = { ...filters, band: 'LIVING' };
        }
        if (mode === 'friend') {
          await fireEvent.changeText(view.getByTestId('community-friend-code'), 'DA-ABCDE');
          filters = { ...filters, friendCode: 'DA-ABCDE' };
        }
      });
      await act(async () => {
        if (mode === 'savedFriend') {
          await fireEvent.press(view.getByTestId('community-saved-friend-DA-ABCDE'));
          filters = { ...filters, friendCode: 'DA-ABCDE' };
        } else await fireEvent.press(view.getByTestId('community-search-submit'));
      });
    }
    expect(view.getByTestId('community-preset-0')).toBeTruthy();
    mockList.mockResolvedValue(page(['20']));
    await act(async () => {
      await fireEvent.press(view.getByTestId('community-load-more'));
    });
    expect(mockList).toHaveBeenLastCalledWith({ ...filters, cursor: 'next-page' });
    expect(view.getByTestId('community-preset-0')).toBeTruthy();
    expect(view.getByTestId('community-preset-20')).toBeTruthy();
    expect(view.queryByTestId('community-load-more')).toBeNull();
  },
);

it.each(['success', 'failure'])(
  'ignores obsolete search %s after a later search completes',
  async (completion) => {
    const view = await render(<CommunityBrowser communityEnabled baseUrlConfigured />);
    const slow = deferred<PresetListResult>();
    mockList.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(page(['new'], 'new-cursor'));
    await fireEvent.changeText(view.getByTestId('community-search'), 'old');
    await act(async () => {
      await fireEvent.press(view.getByTestId('community-search-submit'));
    });
    await fireEvent.changeText(view.getByTestId('community-search'), 'new');
    await act(async () => {
      await fireEvent.press(view.getByTestId('community-search-submit'));
    });
    await act(async () => {
      if (completion === 'success') slow.resolve(page(['old']));
      else slow.reject(new Error('Old failure'));
    });
    expect(view.getByTestId('community-preset-new')).toBeTruthy();
    expect(view.queryByTestId('community-preset-old')).toBeNull();
    expect(view.queryByText('OLD FAILURE')).toBeNull();
    expect(view.getByTestId('community-load-more')).toBeTruthy();
  },
);

it('preserves invalid-code state when a saved-friend request completes late', async () => {
  const view = await render(<CommunityBrowser communityEnabled baseUrlConfigured />);
  const slow = deferred<PresetListResult>();
  mockList.mockReturnValueOnce(slow.promise);
  await act(async () => {
    await fireEvent.press(view.getByTestId('community-saved-friend-DA-ABCDE'));
  });
  await fireEvent.changeText(view.getByTestId('community-friend-code'), 'bad');
  await act(async () => {
    await fireEvent.press(view.getByTestId('community-search-submit'));
  });
  await act(async () => {
    slow.resolve(page(['old'], 'obsolete'));
  });
  expect(view.getByText('FRIEND CODE MUST MATCH DA-XXXXX')).toBeTruthy();
  expect(view.queryByTestId('community-preset-old')).toBeNull();
  expect(view.queryByTestId('community-load-more')).toBeNull();
});

it('allows a non-owner to install a shared call read-only', async () => {
  mockList.mockResolvedValue(page(['shared']));
  const view = await render(<CommunityBrowser communityEnabled baseUrlConfigured />);
  await fireEvent.press(view.getByTestId('community-install-shared'));
  expect(useCustomFrequencyStore.getState().frequencies[0]).toMatchObject({
    origin: 'community',
    remoteId: 'shared',
  });
});
