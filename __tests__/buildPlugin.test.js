import withNativeDebugSymbols from '../plugins/withNativeDebugSymbols';

/**
 * The plugin edits a generated Gradle file that only exists during an EAS
 * build, so it is the one piece of the release setup nobody sees fail until
 * an upload is already in flight. These drive it the way `expo prebuild`
 * does — a config object with a `mods` chain — and assert on the result.
 */
const gradle = (contents) => ({
  modResults: { language: 'groovy', contents },
  modRequest: {},
});

/** Run the plugin's mod the way prebuild would, and hand back the Gradle text. */
async function apply(contents) {
  const config = withNativeDebugSymbols({ name: 'Dead Air', slug: 'dead-air' });
  const mod = config.mods.android.appBuildGradle;
  const result = await mod(gradle(contents));
  return result.modResults.contents;
}

const TEMPLATE = `
apply plugin: "com.android.application"

android {
    namespace "com.deadair.app"
    defaultConfig {
        applicationId "com.deadair.app"
    }
    buildTypes {
        release {
            minifyEnabled (findProperty('android.enableMinifyInReleaseBuilds')?.toBoolean() ?: false)
        }
    }
}
`;

describe('withNativeDebugSymbols', () => {
  it('registers itself as an app/build.gradle mod', () => {
    const config = withNativeDebugSymbols({});
    expect(typeof config.mods.android.appBuildGradle).toBe('function');
  });

  it('asks AGP to package native symbols into the bundle', async () => {
    const out = await apply(TEMPLATE);
    expect(out).toMatch(/debugSymbolLevel\s+'SYMBOL_TABLE'/);
    expect(out).toMatch(/buildTypes\s*\{[\s\S]*release\s*\{[\s\S]*ndk\s*\{/);
  });

  it('leaves the generated block alone and appends instead', async () => {
    const out = await apply(TEMPLATE);
    // Everything the template had is still there, untouched and in order.
    expect(out).toContain('apply plugin: "com.android.application"');
    expect(out).toContain('applicationId "com.deadair.app"');
    expect(out.indexOf('namespace')).toBeLessThan(out.indexOf('debugSymbolLevel'));
  });

  it('is idempotent — prebuild can run repeatedly over the same android dir', async () => {
    const once = await apply(TEMPLATE);
    const twice = await apply(once);
    expect(twice).toBe(once);
    expect(twice.match(/debugSymbolLevel/g)).toHaveLength(1);
  });

  it('refuses a Kotlin-DSL build file rather than writing Groovy into it', async () => {
    const config = withNativeDebugSymbols({});
    const mod = config.mods.android.appBuildGradle;
    await expect(
      mod({ modResults: { language: 'kt', contents: '' }, modRequest: {} }),
    ).rejects.toThrow(/Groovy/);
  });
});
