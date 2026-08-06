/**
 * Regression test for BUG-1 (P1):
 * `app/settings/index.tsx` only exposed CRT + reduced-motion controls.
 * Store `useSettingsStore` exposes 13 settings but UI only touched 3.
 * Task requires: "Settings screen → all toggles work (CRT, volume, SFX, analytics)".
 *
 * The fix added AUDIO section (master/sfx volume steppers + static toggle)
 * and ANALYTICS section bound to `useAnalyticsStore.enabled` / `setEnabled`.
 *
 * This test verifies the source code contains:
 * 1. Bindings for all required store selectors + setters
 * 2. testID attributes for each toggle/stepper
 * 3. The new AUDIO and ANALYTICS section labels
 * 4. onValueChange/onPress wired to the corresponding store action
 *
 * Static-analysis verification is used because the existing test
 * configuration mocks react-native minimally (per ErrorBoundary.test.tsx
 * pattern); RNTL hits a known RN 0.85 jest-preset Animated mock issue.
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC = fs.readFileSync(path.resolve(__dirname, '../../app/settings/index.tsx'), 'utf8');

describe('SettingsScreen — full toggle coverage (BUG-1)', () => {
  describe('store bindings — useSettingsStore', () => {
    it('reads crtEnabled + crtIntensity + setCrt setters', () => {
      expect(SRC).toMatch(/const crtEnabled = useSettingsStore\(\(s\) => s\.crtEnabled\);/);
      expect(SRC).toMatch(/const setCrtEnabled = useSettingsStore\(\(s\) => s\.setCrtEnabled\);/);
      expect(SRC).toMatch(/const crtIntensity = useSettingsStore\(\(s\) => s\.crtIntensity\);/);
      expect(SRC).toMatch(
        /const setCrtIntensity = useSettingsStore\(\(s\) => s\.setCrtIntensity\);/,
      );
    });

    it('reads masterVolume + setMasterVolume', () => {
      expect(SRC).toMatch(/const masterVolume = useSettingsStore\(\(s\) => s\.masterVolume\);/);
      expect(SRC).toMatch(
        /const setMasterVolume = useSettingsStore\(\(s\) => s\.setMasterVolume\);/,
      );
    });

    it('reads sfxVolume + setSfxVolume', () => {
      expect(SRC).toMatch(/const sfxVolume = useSettingsStore\(\(s\) => s\.sfxVolume\);/);
      expect(SRC).toMatch(/const setSfxVolume = useSettingsStore\(\(s\) => s\.setSfxVolume\);/);
    });

    it('reads staticEnabled + setStaticEnabled', () => {
      expect(SRC).toMatch(/const staticEnabled = useSettingsStore\(\(s\) => s\.staticEnabled\);/);
      expect(SRC).toMatch(
        /const setStaticEnabled = useSettingsStore\(\(s\) => s\.setStaticEnabled\);/,
      );
    });

    it('reads reducedMotion + setReducedMotion', () => {
      expect(SRC).toMatch(/const reducedMotion = useSettingsStore\(\(s\) => s\.reducedMotion\);/);
      expect(SRC).toMatch(
        /const setReducedMotion = useSettingsStore\(\(s\) => s\.setReducedMotion\);/,
      );
    });
  });

  describe('store bindings — useAnalyticsStore', () => {
    it('reads enabled + setEnabled', () => {
      expect(SRC).toMatch(/const analyticsEnabled = useAnalyticsStore\(\(s\) => s\.enabled\);/);
      expect(SRC).toMatch(
        /const setAnalyticsEnabled = useAnalyticsStore\(\(s\) => s\.setEnabled\);/,
      );
    });
  });

  describe('section labels rendered', () => {
    it('renders CRT section label', () => {
      expect(SRC).toMatch(/<Text style=\{styles\.sectionLabel\}>CRT<\/Text>/);
    });

    it('renders AUDIO section label', () => {
      expect(SRC).toMatch(/<Text style=\{styles\.sectionLabel\}>AUDIO<\/Text>/);
    });

    it('renders ACCESSIBILITY section label', () => {
      expect(SRC).toMatch(/<Text style=\{styles\.sectionLabel\}>ACCESSIBILITY<\/Text>/);
    });

    it('renders ANALYTICS section label', () => {
      expect(SRC).toMatch(/<Text style=\{styles\.sectionLabel\}>ANALYTICS<\/Text>/);
    });
  });

  describe('required toggles — testIDs present', () => {
    it('crt intensity stepper has testID crt-intensity-down/up', () => {
      expect(SRC).toContain('testID="crt-intensity-down"');
      expect(SRC).toContain('testID="crt-intensity-up"');
    });

    it('master volume stepper has testID master-volume-down/up', () => {
      expect(SRC).toContain('testID="master-volume-down"');
      expect(SRC).toContain('testID="master-volume-up"');
    });

    it('sfx volume stepper has testID sfx-volume-down/up', () => {
      expect(SRC).toContain('testID="sfx-volume-down"');
      expect(SRC).toContain('testID="sfx-volume-up"');
    });

    it('static-enabled switch has testID static-enabled-switch', () => {
      expect(SRC).toContain('testID="static-enabled-switch"');
    });

    it('reduced-motion switch has testID reduced-motion-switch', () => {
      expect(SRC).toContain('testID="reduced-motion-switch"');
    });

    it('analytics switch has testID analytics-enabled-switch', () => {
      expect(SRC).toContain('testID="analytics-enabled-switch"');
    });
  });

  describe('switch handlers wired to store actions', () => {
    it('crt Switch onValueChange → setCrtEnabled', () => {
      expect(SRC).toMatch(/onValueChange=\{setCrtEnabled\}/);
    });

    it('static Switch onValueChange → setStaticEnabled', () => {
      expect(SRC).toMatch(/onValueChange=\{setStaticEnabled\}/);
    });

    it('reduced-motion Switch onValueChange → setReducedMotion', () => {
      expect(SRC).toMatch(/onValueChange=\{setReducedMotion\}/);
    });

    it('analytics Switch onValueChange → setAnalyticsEnabled', () => {
      expect(SRC).toMatch(/onValueChange=\{setAnalyticsEnabled\}/);
    });
  });

  describe('stepper handlers wired to store actions', () => {
    it('master-volume-down onPress → setMasterVolume(masterLower)', () => {
      expect(SRC).toMatch(/onPress=\{\(\) => setMasterVolume\(masterLower\)\}/);
    });

    it('master-volume-up onPress → setMasterVolume(masterRaise)', () => {
      expect(SRC).toMatch(/onPress=\{\(\) => setMasterVolume\(masterRaise\)\}/);
    });

    it('sfx-volume-down onPress → setSfxVolume(sfxLower)', () => {
      expect(SRC).toMatch(/onPress=\{\(\) => setSfxVolume\(sfxLower\)\}/);
    });

    it('sfx-volume-up onPress → setSfxVolume(sfxRaise)', () => {
      expect(SRC).toMatch(/onPress=\{\(\) => setSfxVolume\(sfxRaise\)\}/);
    });

    it('crt intensity stepper bounds to clamped 0-1 range', () => {
      expect(SRC).toMatch(/const lower = Math\.max\(0, Math\.round\(\(crtIntensity/);
      expect(SRC).toMatch(/const raise = Math\.min\(1, Math\.round\(\(crtIntensity/);
    });

    it('volume steppers bound to clamped 0-1 range', () => {
      expect(SRC).toMatch(/const masterLower = Math\.max\(0, Math\.round\(\(masterVolume/);
      expect(SRC).toMatch(/const masterRaise = Math\.min\(1, Math\.round\(\(masterVolume/);
      expect(SRC).toMatch(/const sfxLower = Math\.max\(0, Math\.round\(\(sfxVolume/);
      expect(SRC).toMatch(/const sfxRaise = Math\.min\(1, Math\.round\(\(sfxVolume/);
    });
  });
});
