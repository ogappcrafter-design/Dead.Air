jest.mock('react-native-gesture-handler', () => ({
  Gesture: { Pan: () => ({}), Tap: () => ({}), Pinch: () => ({}) },
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('react-native-reanimated', () => {
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: {
      View: View,
      Text: Text,
      ScrollView: View,
      createAnimatedComponent: (c: unknown) => c,
    },
    View: View,
    Text: Text,
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
    withSequence: (...v: unknown[]) => v[0],
    withSpring: (v: unknown) => v,
    Easing: { in: (f: unknown) => f, out: (f: unknown) => f, ease: () => {}, linear: () => {} },
    runOnJS: (f: unknown) => f,
    interpolate: () => 0,
    Extrapolate: { CLAMP: 'clamp' },
  };
});

import React from 'react';
import { FrequencyDisplay } from '../../components/radio/FrequencyDisplay';
import { SignalStrength } from '../../components/radio/SignalStrength';
import { BandSelector } from '../../components/radio/BandSelector';
import { VolumeControl } from '../../components/radio/VolumeControl';
import { TuningDial } from '../../components/radio/TuningDial';
import { DeadAirCall } from '../../components/calls/DeadAirCall';
import { JustListenCall } from '../../components/calls/JustListenCall';
import { RightAnswerCall } from '../../components/calls/RightAnswerCall';
import { SignalDecodeCall } from '../../components/calls/SignalDecodeCall';
import { SanityOverlay } from '../../components/calls/SanityOverlay';
import { ShiftStatus } from '../../components/progression/ShiftStatus';
import { AchievementNotification } from '../../components/progression/AchievementNotification';
import { AchievementsGrid } from '../../components/progression/AchievementsGrid';
import { BandUnlockNotification } from '../../components/progression/BandUnlockNotification';
import { BandProgress } from '../../components/BandProgress';
import { StoreCard } from '../../components/store/StoreCard';
import { TapeCollection } from '../../components/TapeCollection';
import StayCalmCall from '../../components/calls/StayCalmCall';
import TapePlayer from '../../components/tapes/TapePlayer';
import { RenderMonitor } from '../../components/common/RenderMonitor';

const MEMO_TYPE = Symbol.for('react.memo');

function isMemoComponent(Component: unknown): boolean {
  const maybe = Component as unknown as { $$typeof?: symbol };
  return maybe.$$typeof === MEMO_TYPE;
}

describe('React.memo wrapping — radio components', () => {
  test('FrequencyDisplay is memo-wrapped', () => {
    expect(isMemoComponent(FrequencyDisplay)).toBe(true);
  });
  test('SignalStrength is memo-wrapped', () => {
    expect(isMemoComponent(SignalStrength)).toBe(true);
  });
  test('BandSelector is memo-wrapped', () => {
    expect(isMemoComponent(BandSelector)).toBe(true);
  });
  test('VolumeControl is memo-wrapped', () => {
    expect(isMemoComponent(VolumeControl)).toBe(true);
  });
  test('TuningDial is memo-wrapped', () => {
    expect(isMemoComponent(TuningDial)).toBe(true);
  });
});

describe('React.memo wrapping — call components', () => {
  test('JustListenCall is memo-wrapped', () => {
    expect(isMemoComponent(JustListenCall)).toBe(true);
  });
  test('RightAnswerCall is memo-wrapped', () => {
    expect(isMemoComponent(RightAnswerCall)).toBe(true);
  });
  test('DeadAirCall is memo-wrapped', () => {
    expect(isMemoComponent(DeadAirCall)).toBe(true);
  });
  test('SignalDecodeCall is memo-wrapped', () => {
    expect(isMemoComponent(SignalDecodeCall)).toBe(true);
  });
  test('SanityOverlay is memo-wrapped', () => {
    expect(isMemoComponent(SanityOverlay)).toBe(true);
  });
});

describe('React.memo wrapping — progression components', () => {
  test('ShiftStatus is memo-wrapped', () => {
    expect(isMemoComponent(ShiftStatus)).toBe(true);
  });
  test('AchievementNotification is memo-wrapped', () => {
    expect(isMemoComponent(AchievementNotification)).toBe(true);
  });
  test('AchievementsGrid is memo-wrapped', () => {
    expect(isMemoComponent(AchievementsGrid)).toBe(true);
  });
  test('BandUnlockNotification is memo-wrapped', () => {
    expect(isMemoComponent(BandUnlockNotification)).toBe(true);
  });
  test('BandProgress is memo-wrapped', () => {
    expect(isMemoComponent(BandProgress)).toBe(true);
  });
});

describe('React.memo wrapping — store/tapes components', () => {
  test('StoreCard is memo-wrapped', () => {
    expect(isMemoComponent(StoreCard)).toBe(true);
  });
  test('TapeCollection is memo-wrapped', () => {
    expect(isMemoComponent(TapeCollection)).toBe(true);
  });
});

describe('React.memo wrapping — common components', () => {
  test('RenderMonitor is memo-wrapped', () => {
    expect(isMemoComponent(RenderMonitor)).toBe(true);
  });
});

describe('React.memo wrapping — default exports', () => {
  test('DeadAirCall named export is memo-wrapped', () => {
    expect(isMemoComponent(DeadAirCall)).toBe(true);
  });
  test('StayCalmCall default export is memo-wrapped', () => {
    expect(isMemoComponent(StayCalmCall)).toBe(true);
  });
  test('TapePlayer default export is memo-wrapped', () => {
    expect(isMemoComponent(TapePlayer)).toBe(true);
  });
});
