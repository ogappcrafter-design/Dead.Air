// jest.setup.js
// Apply the React Native jest-preset setup (mocks native modules like
// StyleSheet/Animated so component tests don't crash on import), then
// patch React 19's CommonJS export to expose `act` synchronously. RNTL v14
// reads `React.act` from `require('react')`, but React 19.2.3 only ships
// `act` via its ESM entry under act environments, so CommonJS tests see
// `undefined` and crash at render with "actImplementation is not a function".
// Hoisted per-file jest.mock() blocks install before any import.
require('@react-native/jest-preset/jest/setup');

const React = require('react');
if (typeof React.act !== 'function') {
  React.act = function act(callback) {
    return callback();
  };
}

module.exports = {};
