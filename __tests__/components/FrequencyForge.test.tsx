import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import FrequencyForgeScreen from '@/app/mod';
import { createCustomFrequencyDraft } from '@/engine/calls/CustomFrequency';
import { useStoreStore } from '@/store/useStoreStore';
import { useGameStore } from '@/store/useGameStore';
import { useCustomFrequencyStore } from '@/store/useCustomFrequencyStore';
import { callManager } from '@/engine/calls/callManagerInstance';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('@/components/calls/ActiveCallDispatcher', () => ({
  ActiveCallDispatcher: () => {
    const React = require('react');
    return React.createElement(require('react-native').Text, null, 'Custom call playing');
  },
}));
jest.mock('@/lib/community/featureFlag', () => ({ isCommunityEnabled: () => true }));
jest.mock('@/lib/community/client', () => ({ resolveCommunityBaseUrl: () => 'https://api.test' }));
jest.mock('@/lib/iap', () => ({
  getInfiniteSignalPublishingProof: async () => ({ platform: 'apple', transactionId: '1001' }),
}));
jest.mock('@/lib/community/appClient', () => ({ getCommunityClient: () => mockClient }));
jest.mock('@/engine/calls/callManagerInstance', () => {
  const { CallManager } = require('@/engine/calls/CallManager');
  const { buildCustomFrequencyCall } = require('@/engine/calls/CustomFrequency');
  const registry = new Map([
    [
      1,
      {
        id: 1,
        band: 0,
        callerId: 'caller',
        callerName: 'Caller',
        signal: 3,
        type: 'JUST_LISTEN',
        staticReward: 0,
      },
    ],
  ]);
  return {
    callManager: new CallManager({
      registry,
      stores: {
        setCurrentCall: jest.fn(),
        decreaseSanity: jest.fn(),
        increaseSanity: jest.fn(),
        addStatic: jest.fn(),
        addTape: jest.fn(),
        unlockBand: jest.fn(),
        getReceivedCalls: () => [],
        getUnlockedBands: () => ['LIVING'],
        markCallReceived: jest.fn(),
        recordCallDuration: jest.fn(),
        getPlayerStats: () => ({}),
        recordChoice: jest.fn(),
        getOwnedTapePacks: () => [],
      },
      radio: { getCurrentBand: () => 'LIVING' },
      bands: [],
      canPlayCustomCall: () => true,
    }),
    registerCustomFrequencyCall: (frequency: unknown) => {
      const call = buildCustomFrequencyCall(frequency, 20000);
      registry.set(call.id, call);
      return call;
    },
    clearCustomFrequencyCalls: () => registry.delete(20000),
  };
});

const mockClient = {
  hasDeviceToken: jest.fn(async () => true),
  registerDevice: jest.fn(),
  createPreset: jest.fn(),
  updatePreset: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  callManager.reset();
  useStoreStore.setState({ hasInfiniteSignal: true });
  useGameStore.setState({ unlockedBands: ['LIVING'] });
  useCustomFrequencyStore.setState({ frequencies: [] });
});

it('keeps composition unavailable to non-owners', async () => {
  useStoreStore.setState({ hasInfiniteSignal: false });
  const view = await render(<FrequencyForgeScreen />);
  expect(view.queryByTestId('forge-tab-build')).toBeNull();
  expect(view.getByText('INFINITE SIGNAL REQUIRED')).toBeTruthy();
});

it('surfaces an ordinary background call and leaves it running when the Forge closes', async () => {
  const view = await render(<FrequencyForgeScreen />);
  await act(async () => {
    expect(callManager.startCall(1)).toBe(true);
  });
  expect(view.getByText('Custom call playing')).toBeTruthy();
  await view.unmount();
  expect(callManager.getCurrentCall()?.call.id).toBe(1);
  expect(callManager.getCallState()).toBe('active');
});

it('cleans up playback started by the Forge', async () => {
  const view = await render(<FrequencyForgeScreen />);
  await act(async () => {
    await fireEvent.press(view.getByTestId('forge-play'));
  });
  expect(view.getByText('Custom call playing')).toBeTruthy();
  await view.unmount();
  expect(callManager.getCallState()).toBe('idle');
});

it('serializes publishing and keeps the remote link through repeats and local saves', async () => {
  mockClient.createPreset.mockImplementation(async (input) => ({
    ...input,
    id: 'remote-one',
    friendCode: 'DA-ABCDE',
  }));
  mockClient.updatePreset.mockImplementation(async (id, input) => ({
    ...input,
    id,
    friendCode: 'DA-ABCDE',
  }));
  const view = await render(<FrequencyForgeScreen />);
  await act(async () => {
    await fireEvent.press(view.getByTestId('forge-publish'));
  });
  await waitFor(() =>
    expect(useCustomFrequencyStore.getState().frequencies[0]?.remoteId).toBe('remote-one'),
  );
  expect(mockClient.createPreset).toHaveBeenCalledTimes(1);
  await act(async () => {
    await fireEvent.press(view.getByTestId('forge-publish'));
  });
  expect(mockClient.updatePreset).toHaveBeenCalledWith(
    'remote-one',
    expect.objectContaining({ entitlementProof: { platform: 'apple', transactionId: '1001' } }),
  );
  await fireEvent.press(view.getByTestId('forge-save'));
  expect(useCustomFrequencyStore.getState().frequencies[0]?.remoteId).toBe('remote-one');
  expect(useCustomFrequencyStore.getState().frequencies[0]?.friendCode).toBe('DA-ABCDE');
  const publishButton = view.getByTestId(
    `frequency-publish-${useCustomFrequencyStore.getState().frequencies[0]!.id}`,
  );
  let finishUpdate!: () => void;
  mockClient.updatePreset.mockImplementationOnce(
    (id, input) =>
      new Promise((resolve) => {
        finishUpdate = () => resolve({ ...input, id, friendCode: 'DA-ABCDE' });
      }),
  );
  await fireEvent.press(publishButton);
  await fireEvent.press(publishButton);
  await act(async () => {
    finishUpdate();
  });
  expect(mockClient.createPreset).toHaveBeenCalledTimes(1);
  expect(mockClient.updatePreset).toHaveBeenCalledTimes(2);
});

it('serializes concurrent first publishes from the library', async () => {
  const frequency = createCustomFrequencyDraft(0, {
    id: 'local:library',
    name: 'Library Wave',
    createdAt: 1,
  });
  if (!frequency) throw new Error('Missing draft');
  useCustomFrequencyStore.setState({ frequencies: [frequency] });
  let finishCreate!: () => void;
  mockClient.createPreset.mockImplementationOnce(
    (input) =>
      new Promise((resolve) => {
        finishCreate = () => resolve({ ...input, id: 'library-remote', friendCode: 'DA-ABCDE' });
      }),
  );
  const view = await render(<FrequencyForgeScreen />);
  await fireEvent.press(view.getByTestId('forge-tab-library'));
  const publishButton = view.getByTestId(`frequency-publish-${frequency.id}`);
  await fireEvent.press(publishButton);
  await fireEvent.press(publishButton);
  expect(mockClient.createPreset).toHaveBeenCalledTimes(1);
  await act(async () => {
    finishCreate();
  });
  await waitFor(() =>
    expect(useCustomFrequencyStore.getState().frequencies[0]?.remoteId).toBe('library-remote'),
  );
  expect(mockClient.createPreset).toHaveBeenCalledTimes(1);
});
