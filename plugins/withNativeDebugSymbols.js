const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Ship native debug symbols inside the AAB.
 *
 * Most of this app is JavaScript, but the binary Play receives is mostly
 * native: React Native, Hermes, and the Expo modules all arrive as `.so`
 * libraries. Without symbols, any crash inside them shows up in Android Vitals
 * as bare addresses, and Play puts a "this App Bundle contains native code and
 * you've not uploaded debug symbols" warning on every release.
 *
 * Setting `debugSymbolLevel` makes AGP package the symbols into the bundle's
 * metadata, so Play ingests them automatically at upload — there is nothing to
 * remember to attach by hand. The symbols are stripped from what users
 * actually download, so this costs upload size, not install size.
 *
 * SYMBOL_TABLE gives function names, which is what makes a stack trace
 * readable. FULL adds file and line numbers and is considerably larger; switch
 * if you ever need to chase a crash to an exact line.
 *
 * `expo-build-properties` has no option for this, hence the local plugin.
 *
 * Note there is no ProGuard/R8 mapping file to worry about alongside it:
 * minification is off by default in the Expo Android template, so the Java and
 * Kotlin frames are not obfuscated. If you ever turn it on, AGP embeds
 * `mapping.txt` in the bundle the same way — see docs/PLAY_CONSOLE.md.
 */
const MARKER = '// dead-air: native debug symbols';

const BLOCK = `
${MARKER}
// Gradle merges repeated android {} blocks and configures the existing
// release build type by name, so appending is safer than patching the
// generated block and surviving every template change.
android {
    buildTypes {
        release {
            ndk {
                debugSymbolLevel 'SYMBOL_TABLE'
            }
        }
    }
}
`;

module.exports = function withNativeDebugSymbols(config) {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      throw new Error(
        `withNativeDebugSymbols expects a Groovy build.gradle, got "${modConfig.modResults.language}".`,
      );
    }
    // Prebuild can run repeatedly against an existing android/ directory.
    if (modConfig.modResults.contents.includes(MARKER)) {
      return modConfig;
    }
    modConfig.modResults.contents = `${modConfig.modResults.contents.trimEnd()}\n${BLOCK}`;
    return modConfig;
  });
};
