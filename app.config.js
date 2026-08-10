/**
 * Dynamic Expo config.
 *
 * Everything static lives in app.json; this only layers in values that must
 * come from the build environment. Expo passes app.json's `expo` object in as
 * `config`, so the two compose rather than compete.
 *
 * The Infinite Signal proxy URL is the reason this file exists: it differs per
 * environment and shipping it in a tracked file means editing version control
 * to point a build somewhere else.
 *
 *   SIGNAL_PROXY_URL=https://dead-air-proxy-xxxx.run.app npx expo start
 *
 * For EAS, set it per profile in eas.json `env`, or as an EAS environment
 * variable. Unset simply leaves Infinite Signal switched off — the app says so
 * in Settings rather than failing at the network layer.
 */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    signalProxyUrl: process.env.SIGNAL_PROXY_URL || config.extra?.signalProxyUrl || null,
  },
});
