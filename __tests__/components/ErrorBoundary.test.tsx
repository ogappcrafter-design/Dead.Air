jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: {
    create: (s: Record<string, unknown>) => s,
  },
  Platform: {
    OS: 'ios',
    Version: 16,
    select: (obj: Record<string, unknown>) => obj.ios ?? obj.default ?? Object.values(obj)[0],
  },
}));

jest.mock('../../lib/errorTracking', () => ({
  captureException: jest.fn(),
}));

import { ErrorBoundary } from '../../components/shared/ErrorBoundary';

import { captureException } from '../../lib/errorTracking';

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getDerivedStateFromError returns hasError state', () => {
    const err = new Error('boom');
    const state = ErrorBoundary.getDerivedStateFromError(err);
    expect(state).toEqual({ hasError: true, error: err });
  });

  it('componentDidCatch calls captureException with error and componentStack', () => {
    const boundary = new ErrorBoundary({ children: null });
    const err = new Error('kaboom');
    const info = { componentStack: '\n  in Thrower\n  in ErrorBoundary' };
    boundary.componentDidCatch(err, info);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect((captureException as jest.Mock).mock.calls[0]?.[0]).toBe(err);
    expect((captureException as jest.Mock).mock.calls[0]?.[1]).toEqual({
      componentStack: info.componentStack,
    });
  });

  it('renders children when no error', () => {
    const boundary = new ErrorBoundary({ children: 'child' });
    const rendered = boundary.render();
    expect(rendered).toBe('child');
  });

  it('handleReset clears error state', () => {
    const boundary = new ErrorBoundary({ children: null });
    boundary.setState = jest.fn();
    boundary.handleReset();
    expect(boundary.setState).toHaveBeenCalledWith({ hasError: false, error: null });
  });
});
