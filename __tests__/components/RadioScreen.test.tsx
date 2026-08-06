/**
 * Regression test for BUG-3 (P1):
 * `app/radio/index.tsx` had no navigation entry points to Tapes/Store/Settings.
 * The fix added 3 Pressable buttons with testIDs `radio-nav-tapes`,
 * `radio-nav-store`, `radio-nav-settings` that call `router.push(...)`.
 *
 * This test verifies the source code contains:
 * 1. Pressable elements for each of the 3 nav paths
 * 2. Each has the expected testID and accessibility label
 * 3. Each calls `router.push('/tapes'|'/store'|'/settings')`
 *
 * Static-analysis verification is used because RNTL hits a known RN 0.85
 * jest-preset Animated mock issue that we sidestep by inspecting source.
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC = fs.readFileSync(path.resolve(__dirname, '../../app/radio/index.tsx'), 'utf8');

describe('RadioScreen — nav buttons (BUG-3)', () => {
  it('imports useRouter from expo-router', () => {
    expect(SRC).toContain("from 'expo-router'");
    expect(SRC).toContain('useRouter');
  });

  it('calls useRouter() inside the component', () => {
    expect(SRC).toMatch(/const router = useRouter\(\);/);
  });

  it('renders a TAPES nav button with testID and routes to /tapes', () => {
    expect(SRC).toContain('testID="radio-nav-tapes"');
    expect(SRC).toContain("router.push('/tapes')");
    expect(SRC).toContain('accessibilityLabel="Open tape collection"');
  });

  it('renders a STORE nav button with testID and routes to /store', () => {
    expect(SRC).toContain('testID="radio-nav-store"');
    expect(SRC).toContain("router.push('/store')");
    expect(SRC).toContain('accessibilityLabel="Open store"');
  });

  it('renders a SETTINGS nav button with testID and routes to /settings', () => {
    expect(SRC).toContain('testID="radio-nav-settings"');
    expect(SRC).toContain("router.push('/settings')");
    expect(SRC).toContain('accessibilityLabel="Open settings"');
  });

  it('all 3 nav buttons use Pressable', () => {
    // Count occurrences of "Pressable" in the source — should reference
    // it at least 3 times (one per nav button). Strictly, this guards
    // against the buttons being deleted wholesale; it does not catch a
    // partial deletion (only 2 buttons remain), but the per-testid tests
    // above already cover that case individually.
    const matches = SRC.match(/Pressable/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it('nav buttons live inside a navRow View with accessibilityRole="toolbar"', () => {
    expect(SRC).toContain('styles.navRow');
    expect(SRC).toContain('accessibilityRole="toolbar"');
  });
});
