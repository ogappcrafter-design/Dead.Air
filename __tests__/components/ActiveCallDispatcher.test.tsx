import { act, fireEvent, render } from '@testing-library/react-native';
import { ActiveCallDispatcher } from '@/components/calls/ActiveCallDispatcher';
import { callManager } from '@/engine/calls/callManagerInstance';
import type { ActiveCall, CallLifecycleState } from '@/engine/calls/types';

let mockFocused = true;
let mockActive: ActiveCall | null = null;
const mockListeners = new Set<(state: CallLifecycleState, call: ActiveCall | null) => void>();
const outcome = { sanityDelta: -1, staticReward: 2, staticMultiplier: 1 };
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));
jest.mock('@/hooks/useSanityEffect', () => ({ useSanityEffect: jest.fn() }));
jest.mock('@/engine/calls/callManagerInstance', () => ({
  callManager: {
    getActiveRoute: () => mockActive?.call.type ?? null,
    subscribe: (listener: (state: CallLifecycleState, call: ActiveCall | null) => void) => {
      mockListeners.add(listener);
      listener(mockActive?.state ?? 'idle', mockActive);
      return () => mockListeners.delete(listener);
    },
    endCall: jest.fn(),
  },
}));
jest.mock('@/components/calls/JustListenCall', () => ({
  JustListenCall: ({ onComplete }: { onComplete: (value: unknown) => void }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return React.createElement(
      Pressable,
      {
        testID: 'listen-complete',
        onPress: () => onComplete({ sanityDelta: -1, staticReward: 2, staticMultiplier: 1 }),
      },
      React.createElement(Text, null, 'Listening'),
    );
  },
}));
jest.mock('@/components/calls/RightAnswerCall', () => ({ RightAnswerCall: () => null }));
jest.mock('@/components/calls/DeadAirCall', () => ({ DeadAirCall: () => null }));
jest.mock('@/components/calls/StayCalmCall', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/calls/SignalDecodeCall', () => ({ SignalDecodeCall: () => null }));
jest.mock('@/components/calls/RecordingCall', () => ({ RecordingCall: () => null }));
jest.mock('@/components/calls/MultiCallerCall', () => ({ MultiCallerCall: () => null }));
jest.mock('@/components/calls/TimingCall', () => ({ TimingCall: () => null }));
jest.mock('@/components/calls/PuzzleCall', () => ({ PuzzleCall: () => null }));
jest.mock('@/components/calls/ConversationCall', () => ({ ConversationCall: () => null }));

function emit(active: boolean): void {
  mockActive = active
    ? {
        call: {
          id: 1,
          band: 0,
          callerId: 'caller',
          callerName: 'Caller',
          signal: 3,
          type: 'JUST_LISTEN',
          staticReward: 2,
        },
        state: 'active',
        startTime: 1,
      }
    : null;
  for (const listener of mockListeners) listener(mockActive?.state ?? 'idle', mockActive);
}

beforeEach(() => {
  mockFocused = true;
  mockActive = null;
  mockListeners.clear();
  jest.clearAllMocks();
});

it('renders idle, active and idle transitions without changing hook order', async () => {
  const view = await render(<ActiveCallDispatcher />);
  expect(view.queryByText('Listening')).toBeNull();
  await act(async () => {
    emit(true);
  });
  expect(view.getByText('Listening')).toBeTruthy();
  await fireEvent.press(view.getByTestId('listen-complete'));
  expect(callManager.endCall).toHaveBeenCalledWith(outcome);
  await act(async () => {
    emit(false);
  });
  expect(view.queryByText('Listening')).toBeNull();
});

it('only renders the call on the focused screen and resumes when focused', async () => {
  mockFocused = false;
  const view = await render(<ActiveCallDispatcher />);
  await act(async () => {
    emit(true);
  });
  expect(view.queryByText('Listening')).toBeNull();
  expect(callManager.endCall).not.toHaveBeenCalled();
  mockFocused = true;
  await view.rerender(<ActiveCallDispatcher />);
  expect(view.getByText('Listening')).toBeTruthy();
  mockFocused = false;
  await view.rerender(<ActiveCallDispatcher />);
  expect(view.queryByText('Listening')).toBeNull();
});
