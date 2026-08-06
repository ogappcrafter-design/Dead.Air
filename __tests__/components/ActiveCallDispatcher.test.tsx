/**
 * Regression test for BUG-2 (P0):
 * `components/calls/ActiveCallDispatcher.tsx` originally declared
 * `useCallback(...)` AFTER the early return `if (!route || !activeCall) return null;`.
 * This violates the Rules of Hooks: when `route` flips between null and a
 * real call, React throws "Rendered fewer hooks than expected" because the
 * hook count changes between renders.
 *
 * The fix moved `useCallback` ABOVE the early return so the hook order
 * stays stable. This test verifies the source code structure enforces the
 * invariant: useCallback appears before any `return null` in the function
 * body.
 *
 * We use source-level inspection because the existing test configuration
 * mocks react-native minimally (per ErrorBoundary.test.tsx pattern); full
 * RNTL rendering hits a known RN 0.85 jest-preset + Animated mock issue.
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../../components/calls/ActiveCallDispatcher.tsx'),
  'utf8',
);

describe('ActiveCallDispatcher — Rules of Hooks stability (BUG-2)', () => {
  it('useCallback appears before any early return in the component body', () => {
    // Slice the body of the ActiveCallDispatcher function.
    const startIdx = SRC.indexOf('export function ActiveCallDispatcher');
    expect(startIdx).toBeGreaterThanOrEqual(0);

    const bodyStart = SRC.indexOf('{', startIdx);
    expect(bodyStart).toBeGreaterThan(startIdx);

    // Find the matching closing brace by depth tracking.
    let depth = 0;
    let endIdx = -1;
    for (let i = bodyStart; i < SRC.length; i++) {
      const ch = SRC[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    expect(endIdx).toBeGreaterThan(bodyStart);

    const body = SRC.slice(bodyStart, endIdx + 1);

    const useCallbackIdx = body.indexOf('useCallback(');
    const earlyReturnIdx = body.indexOf('return null;');

    expect(useCallbackIdx).toBeGreaterThanOrEqual(0);
    expect(earlyReturnIdx).toBeGreaterThanOrEqual(0);
    // Critical regression assertion: useCallback must come BEFORE the early
    // return so the hook is always registered.
    expect(useCallbackIdx).toBeLessThan(earlyReturnIdx);
  });

  it('the early return is gated by route AND activeCall being falsy', () => {
    // Regression guard: the early return text should still gate on both
    // route and activeCall to avoid confusing "no hook crash but wrong
    // branch renders" bugs.
    expect(SRC).toContain('if (!route || !activeCall) return null;');
  });

  it('the component declares useState, useEffect, useCallback as hooks', () => {
    expect(SRC).toMatch(/const \[route, setRoute\] = useState/);
    expect(SRC).toMatch(/const \[activeCall, setActiveCall\] = useState/);
    expect(SRC).toMatch(/useEffect\(\(\) => \{/);
    expect(SRC).toMatch(/const onComplete = useCallback\(/);
  });

  it('hook order is stable: useState, useEffect, useCallback, then early return', () => {
    const statesIdx = SRC.indexOf('useState<CallTypeRoute');
    const effectIdx = SRC.indexOf('useEffect(()');
    const callbackIdx = SRC.indexOf('useCallback((outcome');
    const returnIdx = SRC.indexOf('if (!route || !activeCall) return null;');

    // All hooks must appear before the return to keep the React hook
    // order consistent across renders where route/activeCall are null
    // vs set.
    expect(statesIdx).toBeLessThan(effectIdx);
    expect(effectIdx).toBeLessThan(callbackIdx);
    expect(callbackIdx).toBeLessThan(returnIdx);
  });
});
