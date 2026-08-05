import { RenderMonitor } from '../../components/common/RenderMonitor';

const MEMO_TYPE = Symbol.for('react.memo');

function isMemoComponent(Component: unknown): boolean {
  const maybe = Component as unknown as { $$typeof?: symbol };
  return maybe.$$typeof === MEMO_TYPE;
}

describe('RenderMonitor', () => {
  test('is memo-wrapped', () => {
    expect(isMemoComponent(RenderMonitor)).toBe(true);
  });

  test('is a named export', () => {
    expect(RenderMonitor).toBeDefined();
    expect(typeof RenderMonitor).toBe('object');
  });

  test('has React.memo type signature', () => {
    const maybe = RenderMonitor as unknown as { $$typeof?: symbol; type?: unknown };
    expect(maybe.$$typeof).toBe(MEMO_TYPE);
    expect(maybe.type).toBeDefined();
  });
});
