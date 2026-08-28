// jest.setup-after-env.js
// Runs after the test framework is installed (jest global available).
// Mocks native-only modules that crash on import in the jest environment.

// react-native-worklets requires a native module that doesn't exist in jest.
jest.mock('react-native-worklets', () => ({
  useSharedValue: (init) => ({ value: init }),
  useAnimatedStyle: () => ({}),
  withTiming: (value) => value,
  withSpring: (value) => value,
  withDecay: (value) => value,
  withRepeat: (value) => value,
  withSequence: (value) => value,
  withDelay: (value) => value,
  Easing: {
    linear: (x) => x,
    ease: (x) => x,
    inOut: (x) => x,
    in: (x) => x,
    out: (x) => x,
    bezier: () => (x) => x,
  },
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
}));

// react-native-reanimated depends on worklets and a native module.
// Provide a complete mock so no native code is loaded.
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');

  const useSharedValue = (init) => ({ value: init });
  const useAnimatedStyle = () => ({});
  const useAnimatedProps = () => ({});
  const useAnimatedReaction = () => {};
  const useAnimatedScrollHandler = () => () => {};
  const useAnimatedRef = () => ({ current: null });
  const useAnimatedGestureHandler = () => ({});
  const useDerivedValue = (fn) => ({ value: fn() });

  const withTiming = (value) => value;
  const withSpring = (value) => value;
  const withDecay = (value) => value;
  const withRepeat = (value) => value;
  const withSequence = (...values) => values[0];
  const withDelay = (_delay, value) => value;

  const Easing = {
    linear: (x) => x,
    ease: (x) => x,
    in: (x) => x,
    out: (x) => x,
    inOut: (x) => x,
    sin: (x) => x,
    cos: (x) => x,
    exp: (x) => x,
    bezier: () => (x) => x,
    cubic: () => (x) => x,
    quad: () => (x) => x,
  };

  const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' };
  const interpolate = (value, _input, output) => output[0];
  const interpolateColor = (_value, _input, output) => output[0];
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const Animated = {
    View: React.forwardRef((props, ref) => React.createElement(View, { ...props, ref })),
    Text: React.forwardRef((props, ref) =>
      React.createElement(require('react-native').Text, { ...props, ref }),
    ),
    Image: React.forwardRef((props, ref) =>
      React.createElement(require('react-native').Image, { ...props, ref }),
    ),
    ScrollView: React.forwardRef((props, ref) =>
      React.createElement(require('react-native').ScrollView, { ...props, ref }),
    ),
    FlatList: React.forwardRef((props, ref) =>
      React.createElement(require('react-native').FlatList, { ...props, ref }),
    ),
    createAnimatedComponent: (component) => component,
  };

  return {
    __esModule: true,
    default: Animated,
    Animated,
    useSharedValue,
    useAnimatedStyle,
    useAnimatedProps,
    useAnimatedReaction,
    useAnimatedScrollHandler,
    useAnimatedRef,
    useAnimatedGestureHandler,
    useDerivedValue,
    withTiming,
    withSpring,
    withDecay,
    withRepeat,
    withSequence,
    withDelay,
    Easing,
    Extrapolation,
    interpolate,
    interpolateColor,
    clamp,
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
  };
});
