// tests/engine/CallManager.atmospheric.test.ts
// Tests for CallManager atmospheric pack ownership check (DEA-30).

import { CallManager } from '@/engine/calls/CallManager';
import type { CallManagerConfig } from '@/engine/calls/CallManager';
import type { Band } from '@/lib/constants';

function makeMinimalConfig(overrides: Partial<CallManagerConfig> = {}): CallManagerConfig {
  return {
    registry: new Map(),
    stores: {
      setCurrentCall: jest.fn(),
      decreaseSanity: jest.fn(),
      increaseSanity: jest.fn(),
      addStatic: jest.fn(),
      addTape: jest.fn(),
      unlockBand: jest.fn(),
      getReceivedCalls: jest.fn().mockReturnValue([]),
      getUnlockedBands: jest.fn().mockReturnValue([]),
      markCallReceived: jest.fn(),
      recordCallDuration: jest.fn(),
      getPlayerStats: jest.fn().mockReturnValue({}),
      recordChoice: jest.fn(),
    },
    radio: {
      getCurrentBand: jest.fn().mockReturnValue('LIVING' as Band),
    },
    bands: [],
    ...overrides,
  };
}

describe('CallManager atmospheric pack ownership', () => {
  it('isPackOwned returns false when no ownsAtmosphericPack callback', () => {
    const cm = new CallManager(makeMinimalConfig());
    expect(cm.isPackOwned('rain_night')).toBe(false);
  });

  it('isPackOwned returns true when callback returns true', () => {
    const cm = new CallManager(
      makeMinimalConfig({
        ownsAtmosphericPack: (packId) => packId === 'rain_night',
      }),
    );
    expect(cm.isPackOwned('rain_night')).toBe(true);
  });

  it('isPackOwned returns false when callback returns false', () => {
    const cm = new CallManager(
      makeMinimalConfig({
        ownsAtmosphericPack: () => false,
      }),
    );
    expect(cm.isPackOwned('deep_space')).toBe(false);
  });

  it('isPackOwned delegates to callback with correct packId', () => {
    const mockFn = jest.fn().mockReturnValue(true);
    const cm = new CallManager(makeMinimalConfig({ ownsAtmosphericPack: mockFn }));
    cm.isPackOwned('winter_static');
    expect(mockFn).toHaveBeenCalledWith('winter_static');
  });
});
