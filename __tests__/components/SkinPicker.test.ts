// __tests__/components/SkinPicker.test.ts
// Static-analysis tests for SkinPicker component.
// Uses regex match on source file content (same pattern as SettingsScreen.test.tsx).

import * as fs from 'fs';
import * as path from 'path';

const SOURCE = fs.readFileSync(
  path.join(__dirname, '../../components/settings/SkinPicker.tsx'),
  'utf-8',
);

describe('SkinPicker component', () => {
  it('imports useSkinStore', () => {
    expect(SOURCE).toMatch(/import.*useSkinStore.*from.*store\/useSkinStore/);
  });

  it('imports useStoreStore for purchasing state', () => {
    expect(SOURCE).toMatch(/import.*useStoreStore.*from.*store\/useStoreStore/);
  });

  it('imports purchaseProduct and PRODUCT_IDS from lib/iap', () => {
    expect(SOURCE).toMatch(/import.*purchaseProduct.*from.*lib\/iap/);
    expect(SOURCE).toMatch(/import.*PRODUCT_IDS.*from.*lib\/iap/);
  });

  it('imports SKIN_IDS and getSkin from lib/skins', () => {
    expect(SOURCE).toMatch(/import.*SKIN_IDS.*from.*lib\/skins/);
    expect(SOURCE).toMatch(/import.*getSkin.*from.*lib\/skins/);
  });

  it('subscribes to activeSkin from skin store', () => {
    expect(SOURCE).toMatch(/useSkinStore\(.*activeSkin/);
  });

  it('subscribes to ownedSkins from skin store', () => {
    expect(SOURCE).toMatch(/useSkinStore\(.*ownedSkins/);
  });

  it('subscribes to purchasingProductId from store store', () => {
    expect(SOURCE).toMatch(/useStoreStore\(.*purchasingProductId/);
  });

  it('renders all skins via SKIN_IDS.map', () => {
    expect(SOURCE).toMatch(/SKIN_IDS\.map/);
  });

  it('has purchase handler that calls purchaseProduct', () => {
    expect(SOURCE).toMatch(/purchaseProduct/);
  });

  it('has activate handler that calls setActiveSkin', () => {
    expect(SOURCE).toMatch(/setActiveSkin/);
  });

  it('maps skin ids to product IDs', () => {
    expect(SOURCE).toMatch(/PRODUCT_IDS\.SKIN_VINTAGE_WOOD/);
    expect(SOURCE).toMatch(/PRODUCT_IDS\.SKIN_MILITARY_GREEN/);
    expect(SOURCE).toMatch(/PRODUCT_IDS\.SKIN_SPACE_AGE_BLUE/);
    expect(SOURCE).toMatch(/PRODUCT_IDS\.SKIN_DIGITAL_PIXEL/);
  });

  it('shows ACTIVATE button for owned non-active skins', () => {
    expect(SOURCE).toMatch(/ACTIVATE/);
  });

  it('shows OWNED text for active skin', () => {
    expect(SOURCE).toMatch(/OWNED/);
  });

  it('shows price for locked skins', () => {
    expect(SOURCE).toMatch(/skin\.price/);
  });

  it('shows color swatches for each skin', () => {
    expect(SOURCE).toMatch(/skin\.colors\.background/);
    expect(SOURCE).toMatch(/skin\.colors\.surface/);
    expect(SOURCE).toMatch(/skin\.colors\.text/);
    expect(SOURCE).toMatch(/skin\.colors\.accent/);
    expect(SOURCE).toMatch(/skin\.colors\.border/);
  });

  it('uses testID for skin rows', () => {
    expect(SOURCE).toMatch(/testID.*skin-row/);
  });

  it('uses testID for purchase buttons', () => {
    expect(SOURCE).toMatch(/testID.*skin-purchase/);
  });

  it('uses testID for activate buttons', () => {
    expect(SOURCE).toMatch(/testID.*skin-activate/);
  });

  it('has accessibility labels for purchase buttons', () => {
    expect(SOURCE).toMatch(/accessibilityLabel.*Purchase/);
  });

  it('has accessibility labels for activate buttons', () => {
    expect(SOURCE).toMatch(/accessibilityLabel.*Activate/);
  });

  it('exports SkinPicker as named export', () => {
    expect(SOURCE).toMatch(/export function SkinPicker/);
  });
});

describe('SkinPicker in settings page', () => {
  const SETTINGS_SOURCE = fs.readFileSync(
    path.join(__dirname, '../../app/settings/index.tsx'),
    'utf-8',
  );

  it('settings page imports SkinPicker', () => {
    expect(SETTINGS_SOURCE).toMatch(/import.*SkinPicker.*from.*components\/settings\/SkinPicker/);
  });

  it('settings page renders SkinPicker', () => {
    expect(SETTINGS_SOURCE).toMatch(/<SkinPicker/);
  });

  it('settings page has SKINS section label', () => {
    expect(SETTINGS_SOURCE).toMatch(/SKINS/);
  });
});
