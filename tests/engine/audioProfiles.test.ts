// tests/engine/audioProfiles.test.ts
// Tests for atmospheric ambient audio profile structure (DEA-30).

import { RAIN_NIGHT_PROFILE } from '@/engine/audio/profiles/rainNight';
import { WINTER_STATIC_PROFILE } from '@/engine/audio/profiles/winterStatic';
import { DEEP_SPACE_PROFILE } from '@/engine/audio/profiles/deepSpace';
import type { AmbientProfile } from '@/engine/audio/profiles/types';
import { BANDS } from '@/lib/constants';

const ALL_PROFILES: Array<{ name: string; profile: AmbientProfile }> = [
  { name: 'RAIN_NIGHT', profile: RAIN_NIGHT_PROFILE },
  { name: 'WINTER_STATIC', profile: WINTER_STATIC_PROFILE },
  { name: 'DEEP_SPACE', profile: DEEP_SPACE_PROFILE },
];

describe('Atmospheric audio profiles', () => {
  for (const { name, profile } of ALL_PROFILES) {
    describe(`${name}`, () => {
      it('has a unique id', () => {
        expect(profile.id).toBeDefined();
        expect(typeof profile.id).toBe('string');
        expect(profile.id.length).toBeGreaterThan(0);
      });

      it('has a name', () => {
        expect(profile.name).toBeDefined();
        expect(typeof profile.name).toBe('string');
      });

      it('has a valid staticCharacter', () => {
        expect(['white', 'pink', 'brown']).toContain(profile.staticCharacter);
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

  it('all profiles have unique ids', () => {
    const ids = ALL_PROFILES.map((p) => p.profile.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all profiles have unique staticCharacter or are distinct from each other', () => {
    const chars = ALL_PROFILES.map((p) => p.profile.staticCharacter);
    const unique = new Set(chars);
    expect(unique.size).toBeGreaterThan(1);
  });
});
