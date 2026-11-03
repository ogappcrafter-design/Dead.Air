// tests/components/FrequencyForgeBuilder.test.tsx
// DEA-89 — renders the builder and library to verify the owner/non-owner flow
// and local save boundary.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { FrequencyBuilder } from '@/components/mod/FrequencyBuilder';
import { FrequencyLibrary } from '@/components/mod/FrequencyLibrary';
import { createCustomFrequencyDraft, type CustomFrequency } from '@/engine/calls/CustomFrequency';
import { useCustomFrequencyStore } from '@/store/useCustomFrequencyStore';

function localFrequency(): CustomFrequency {
  const value = createCustomFrequencyDraft(0, {
    id: 'local:component',
    name: 'Component Wave',
    createdAt: 1,
  });
  if (value === null) throw new Error('No draft');
  return value;
}

function installedFrequency(): CustomFrequency {
  return {
    ...localFrequency(),
    id: 'remote:preset-component',
    name: 'Installed Wave',
    origin: 'community',
    remoteId: 'preset-component',
    authorName: 'STATIC-1A2B',
  };
}

const noop = (): void => {};

describe('FrequencyBuilder', () => {
  beforeEach(() => {
    useCustomFrequencyStore.setState({ frequencies: [] });
  });

  it('saves a composed frequency locally', async () => {
    const onSaved = jest.fn();
    const { getByTestId } = await render(
      <FrequencyBuilder
        initial={{ ...localFrequency(), name: 'My Wave' }}
        unlockedBands={['LIVING']}
        hasInfiniteSignal
        communityEnabled={false}
        onSaved={onSaved}
        onPlay={noop}
        onPublish={noop}
      />,
    );

    await fireEvent.press(getByTestId('forge-save'));

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(useCustomFrequencyStore.getState().frequencies[0]?.name).toBe('My Wave');
    expect(useCustomFrequencyStore.getState().frequencies[0]?.origin).toBe('local');
  });

  it('reports a full local library when saving a valid draft', async () => {
    const initial = localFrequency();
    useCustomFrequencyStore.setState({
      frequencies: Array.from({ length: 50 }, (_, i) => ({ ...initial, id: `full:${i}` })),
    });
    const onSaved = jest.fn();
    const view = await render(
      <FrequencyBuilder
        initial={initial}
        unlockedBands={['LIVING']}
        hasInfiniteSignal
        communityEnabled
        onSaved={onSaved}
        onPlay={noop}
        onPublish={noop}
      />,
    );
    await fireEvent.press(view.getByTestId('forge-save'));
    expect(view.getByText(/the library is full/i)).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('omits signal and only offers sanity tuning for supported calls', async () => {
    const initial = localFrequency();
    const view = await render(
      <FrequencyBuilder
        initial={initial}
        unlockedBands={['LIVING']}
        hasInfiniteSignal
        communityEnabled
        onSaved={noop}
        onPlay={noop}
        onPublish={noop}
      />,
    );
    expect(view.queryByTestId('forge-signal-up')).toBeNull();
    expect(view.queryByTestId('forge-sanity-up')).not.toBeNull();
    await view.unmount();
    const choices = {
      ...initial,
      composition: {
        ...initial.composition,
        callType: 'RIGHT_ANSWER' as const,
        choiceIndices: [0, 1],
      },
    };
    const answer = await render(
      <FrequencyBuilder
        initial={choices}
        unlockedBands={['LIVING']}
        hasInfiniteSignal
        communityEnabled
        onSaved={noop}
        onPlay={noop}
        onPublish={noop}
      />,
    );
    expect(answer.queryByTestId('forge-sanity-up')).toBeNull();
    expect(answer.queryByTestId('forge-static-up')).not.toBeNull();
  });

  it('retains the published identity for repeat publishing and saving', async () => {
    const initial = localFrequency();
    const onPublish = jest.fn(async (frequency: CustomFrequency) => ({
      ...frequency,
      remoteId: 'published-1',
      friendCode: 'DA-ABCDE',
    }));
    const view = await render(
      <FrequencyBuilder
        initial={initial}
        unlockedBands={['LIVING']}
        hasInfiniteSignal
        communityEnabled
        onSaved={noop}
        onPlay={noop}
        onPublish={onPublish}
      />,
    );
    await act(async () => {
      await fireEvent.press(view.getByTestId('forge-publish'));
    });
    expect(onPublish).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByTestId('forge-save'));
    expect(useCustomFrequencyStore.getState().frequencies[0]?.remoteId).toBe('published-1');
    await fireEvent.press(view.getByTestId('forge-publish'));
    await waitFor(() =>
      expect(onPublish).toHaveBeenLastCalledWith(
        expect.objectContaining({ remoteId: 'published-1', friendCode: 'DA-ABCDE' }),
      ),
    );
  });

  it('blocks test play for a non-owner', async () => {
    const onPlay = jest.fn();
    const { getByTestId } = await render(
      <FrequencyBuilder
        unlockedBands={['LIVING']}
        hasInfiniteSignal={false}
        communityEnabled={false}
        onSaved={noop}
        onPlay={onPlay}
        onPublish={noop}
      />,
    );

    await fireEvent.press(getByTestId('forge-play'));
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('blocks test play on a locked band', async () => {
    const onPlay = jest.fn();
    const { getByTestId } = await render(
      <FrequencyBuilder
        unlockedBands={[]}
        hasInfiniteSignal
        communityEnabled={false}
        onSaved={noop}
        onPlay={onPlay}
        onPublish={noop}
      />,
    );

    await fireEvent.press(getByTestId('forge-play'));
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('plays a valid owner frequency on an unlocked band', async () => {
    const onPlay = jest.fn();
    const { getByTestId } = await render(
      <FrequencyBuilder
        unlockedBands={['LIVING']}
        hasInfiniteSignal
        communityEnabled={false}
        onSaved={noop}
        onPlay={onPlay}
        onPublish={noop}
      />,
    );

    await fireEvent.press(getByTestId('forge-play'));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('blocks publishing while the community is offline', async () => {
    const onPublish = jest.fn();
    const { getByTestId } = await render(
      <FrequencyBuilder
        unlockedBands={['LIVING']}
        hasInfiniteSignal
        communityEnabled={false}
        onSaved={noop}
        onPlay={noop}
        onPublish={onPublish}
      />,
    );

    await fireEvent.press(getByTestId('forge-publish'));
    expect(onPublish).not.toHaveBeenCalled();
  });
});

describe('FrequencyLibrary ownership boundary', () => {
  it('shows installed frequencies read-only to a non-owner', async () => {
    const onPlay = jest.fn();
    const onEdit = jest.fn();
    const installed = installedFrequency();
    const { getByTestId, queryByTestId } = await render(
      <FrequencyLibrary
        frequencies={[installed]}
        hasInfiniteSignal={false}
        unlockedBands={['LIVING']}
        communityEnabled={false}
        onPlay={onPlay}
        onEdit={onEdit}
        onDelete={noop}
        onShare={noop}
        onPublish={noop}
      />,
    );

    await fireEvent.press(getByTestId(`frequency-play-${installed.id}`));
    expect(onPlay).not.toHaveBeenCalled();
    expect(queryByTestId(`frequency-edit-${installed.id}`)).toBeNull();
  });

  it('lets an owner play an installed frequency on an unlocked band', async () => {
    const onPlay = jest.fn();
    const installed = installedFrequency();
    const { getByTestId } = await render(
      <FrequencyLibrary
        frequencies={[installed]}
        hasInfiniteSignal
        unlockedBands={['LIVING']}
        communityEnabled
        onPlay={onPlay}
        onEdit={noop}
        onDelete={noop}
        onShare={noop}
        onPublish={noop}
      />,
    );

    await fireEvent.press(getByTestId(`frequency-play-${installed.id}`));
    expect(onPlay).toHaveBeenCalledWith(installed);
  });
});
