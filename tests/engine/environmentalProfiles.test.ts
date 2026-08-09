// tests/engine/environmentalProfiles.test.ts
// DEA-13: Room tone + 6 weather profiles extend AmbientProfile correctly.

import { ROOM_TONE_PROFILE } from '@/engine/audio/profiles/roomTone';
import { CLEAR_WEATHER_PROFILE } from '@/engine/audio/profiles/clear';
import { RAIN_WEATHER_PROFILE } from '@/engine/audio/profiles/rain';
import { STORM_WEATHER_PROFILE } from '@/engine/audio/profiles/storm';
import { SNOW_WEATHER_PROFILE } from '@/engine/audio/profiles/snow';
import { WIND_WEATHER_PROFILE } from '@/engine/audio/profiles/wind';
import { FOG_WEATHER_PROFILE } from '@/engine/audio/profiles/fog';
import type { AmbientProfile } from '@/engine/audio/profiles/types';
import type { StaticCharacter } from '@/engine/audio/PlatformBridge';
import { BANDS } from '@/lib/constants';

const ENV_PROFILES: Array<{
  name: string;
  profile: AmbientProfile;
  expectedChar: StaticCharacter;
}> = [
  { name: 'ROOM_TONE', profile: ROOM_TONE_PROFILE, expectedChar: 'brown' },
  { name: 'CLEAR_WEATHER', profile: CLEAR_WEATHER_PROFILE, expectedChar: 'white' },
  { name: 'RAIN_WEATHER', profile: RAIN_WEATHER_PROFILE, expectedChar: 'brown' },
  { name: 'STORM_WEATHER', profile: STORM_WEATHER_PROFILE, expectedChar: 'brown' },
  { name: 'SNOW_WEATHER', profile: SNOW_WEATHER_PROFILE, expectedChar: 'white' },
  { name: 'WIND_WEATHER', profile: WIND_WEATHER_PROFILE, expectedChar: 'pink' },
  { name: 'FOG_WEATHER', profile: FOG_WEATHER_PROFILE, expectedChar: 'brown' },
];

describe('Environmental ambient profiles (DEA-13)', () => {
  for (const { name, profile, expectedChar } of ENV_PROFILES) {
    describe(`${name}`, () => {
      it('has a unique non-empty id', () => {
        expect(profile.id).toBeDefined();
        expect(typeof profile.id).toBe('string');
        expect(profile.id.length).toBeGreaterThan(0);
      });

      it('has a name', () => {
        expect(typeof profile.name).toBe('string');
        expect(profile.name.length).toBeGreaterThan(0);
      });

      it('has a valid staticCharacter', () => {
        expect(['white', 'pink', 'brown']).toContain(profile.staticCharacter);
      });

      it('uses the expected noise character', () => {
        expect(profile.staticCharacter).toBe(expectedChar);
      });

      it('has bandParams for every band', () => {
        for (const band of BANDS) {
          expect(profile.bandParams[band]).toBeDefined();
        }
      });

      it('has valid centerFreq values (20-20000 Hz)', () => {
        for (const band of BANDS) {
          const freq = profile.bandParams[band].centerFreq;
          expect(freq).toBeGreaterThanOrEqual(20);
          expect(freq).toBeLessThanOrEqual(20000);
        }
      });

      it('has valid baseGain values (0-1)', () => {
        for (const band of BANDS) {
          const gain = profile.bandParams[band].baseGain;
          expect(gain).toBeGreaterThanOrEqual(0);
          expect(gain).toBeLessThanOrEqual(1);
        }
      });

      it('has numeric detuneCents', () => {
        for (const band of BANDS) {
          expect(typeof profile.bandParams[band].detuneCents).toBe('number');
        }
      });
    });
  }

  it('all 7 environmental profiles have unique ids', () => {
    const ids = ENV_PROFILES.map((p) => p.profile.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('environmental profile ids do not collide with existing atmospheric ids', () => {
    const existingIds = ['rain_night', 'winter_static', 'deep_space'];
    const envIds = ENV_PROFILES.map((p) => p.profile.id);
    for (const env of envIds) {
      expect(existingIds).not.toContain(env);
    }
  });

  it('room tone uses brown noise (persistent low-level layer)', () => {
    expect(ROOM_TONE_PROFILE.staticCharacter).toBe('brown');
  });

  it('room tone gains are subtle (< 0.1) — beneath band ambient', () => {
    for (const band of BANDS) {
      expect(ROOM_TONE_PROFILE.bandParams[band].baseGain).toBeLessThan(0.1);
    }
  });

  it('storm is the most intense weather profile', () => {
    const stormGain = STORM_WEATHER_PROFILE.bandParams.LOST.baseGain;
    for (const { name, profile } of ENV_PROFILES) {
      if (name === 'STORM_WEATHER' || name === 'ROOM_TONE') continue;
      expect(stormGain).toBeGreaterThan(profile.bandParams.LOST.baseGain);
    }
  });
});
