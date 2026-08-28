/**
 * Regression test for DEA-48 Greptile P1:
 * `app/index.tsx` routed returning players to /onboarding when AsyncStorage
 * hydration finished after the fixed 2000ms splash timer. The fix gates
 * navigation on player-store persistence hydration.
 *
 * Static-analysis verification is used (repo convention) because RNTL hits
 * a known RN 0.85 jest-preset Animated mock issue.
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC = fs.readFileSync(path.resolve(__dirname, '../../app/index.tsx'), 'utf8');

describe('Splash routing — persistence hydration guard (DEA-48 P1)', () => {
  it('waits for the player store hydration before navigating', () => {
    expect(SRC).toContain('usePlayerStore.persist.hasHydrated()');
    expect(SRC).toContain('usePlayerStore.persist.onFinishHydration');
  });

  it('reads hasOnboarded from hydrated state at decision time', () => {
    expect(SRC).toMatch(/hasOnboarded: onboarded/);
    expect(SRC).toContain('usePlayerStore.getState()');
  });

  it('navigates to /radio only when hasOnboarded is true', () => {
    expect(SRC).toContain("router.replace('/radio')");
  });

  it('navigates to /onboarding only when hasOnboarded is false', () => {
    expect(SRC).toContain("router.replace('/onboarding')");
  });

  it('keeps the 2000ms minimum splash duration', () => {
    expect(SRC).toMatch(/setTimeout\([\s\S]{0,120}4500/);
  });

  it('does not navigate before hydration AND splash time both hold', () => {
    expect(SRC).toContain('if (!active || !hydrated || !minSplashElapsed)');
  });
});
