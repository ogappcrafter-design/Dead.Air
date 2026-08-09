/**
 * The app bundles through babel-preset-expo; Jest runs the framework-free
 * modules under src/engine on plain preset-env so tests need no RN runtime.
 */
module.exports = function babelConfig(api) {
  const isTest = api.env('test');
  api.cache.using(() => process.env.NODE_ENV);

  return {
    presets: isTest
      ? [['@babel/preset-env', { targets: { node: 'current' } }]]
      : ['babel-preset-expo'],
  };
};
