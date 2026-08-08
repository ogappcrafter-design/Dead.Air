// __tests__/components/RadioBodySkins.test.ts
// Snapshot-style tests for RadioBody visual properties under each skin.
// Uses static-analysis pattern (regex match on source) since RNTL has RN 0.85 mock issues.

import * as fs from 'fs';
import * as path from 'path';

const SOURCE = fs.readFileSync(
  path.join(__dirname, '../../components/radio/RadioBody.tsx'),
  'utf-8',
);

describe('RadioBody skin integration', () => {
  it('imports useSkinStore', () => {
    expect(SOURCE).toMatch(/import.*useSkinStore.*from.*store\/useSkinStore/);
  });

  it('imports getSkin from lib/skins', () => {
    expect(SOURCE).toMatch(/import.*getSkin.*from.*lib\/skins/);
  });

  it('does not import from lib/theme', () => {
    expect(SOURCE).not.toMatch(/from.*lib\/theme/);
  });

  it('subscribes to activeSkin from skin store', () => {
    expect(SOURCE).toMatch(/useSkinStore\(.*activeSkin/);
  });

  it('resolves skin via getSkin', () => {
    expect(SOURCE).toMatch(/getSkin\(activeSkin\)/);
  });

  it('uses skin.colors.surface for radio background', () => {
    expect(SOURCE).toMatch(/skin\.colors\.surface/);
  });

  it('uses skin.colors.border for radio border', () => {
    expect(SOURCE).toMatch(/skin\.colors\.border/);
  });

  it('uses skin.colors.power for power indicator', () => {
    expect(SOURCE).toMatch(/skin\.colors\.power/);
  });

  it('uses skin.colors.station for station name', () => {
    expect(SOURCE).toMatch(/skin\.colors\.station/);
  });

  it('uses skin.fonts.primary for station name font', () => {
    expect(SOURCE).toMatch(/skin\.fonts\.primary/);
  });

  it('uses skin.spacing for layout', () => {
    expect(SOURCE).toMatch(/skin\.spacing\.comfortable/);
    expect(SOURCE).toMatch(/skin\.spacing\.compact/);
  });

  it('uses useMemo for skin-dependent styles', () => {
    expect(SOURCE).toMatch(/useMemo/);
    expect(SOURCE).toMatch(/StyleSheet\.create/);
  });

  it('skinStyles is memoized on skin dependency', () => {
    expect(SOURCE).toMatch(/\[skin\]/);
  });
});
