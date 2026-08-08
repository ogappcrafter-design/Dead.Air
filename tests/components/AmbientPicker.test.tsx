// tests/components/AmbientPicker.test.tsx
// Tests for the AmbientPicker settings component (DEA-30).

import { render } from '@testing-library/react-native';
import { AmbientPicker } from '@/components/settings/AmbientPicker';
import { useStoreStore } from '@/store/useStoreStore';
import { useAmbientStore } from '@/store/useAmbientStore';

describe('AmbientPicker', () => {
  beforeEach(() => {
    useStoreStore.getState().resetPurchases();
    useAmbientStore.getState().setActiveAmbient('default');
  });

  it('renders default option', async () => {
    const { findByTestId } = await render(<AmbientPicker />);
    expect(await findByTestId('ambient-option-default')).toBeTruthy();
  });

  it('shows empty message when no packs owned', async () => {
    const { findByText } = await render(<AmbientPicker />);
    expect(await findByText('No atmospheric packs owned. Purchase from the store.')).toBeTruthy();
  });

  it('does not render pack options when not owned', async () => {
    const { queryByTestId } = await render(<AmbientPicker />);
    expect(queryByTestId('ambient-option-rain_night')).toBeNull();
    expect(queryByTestId('ambient-option-winter_static')).toBeNull();
    expect(queryByTestId('ambient-option-deep_space')).toBeNull();
  });

  it('renders owned pack options', async () => {
    useStoreStore.getState().addOwnedAtmosphericPack('rain_night');
    useStoreStore.getState().addOwnedAtmosphericPack('deep_space');

    const { findByTestId, queryByTestId } = await render(<AmbientPicker />);
    expect(await findByTestId('ambient-option-rain_night')).toBeTruthy();
    expect(await findByTestId('ambient-option-deep_space')).toBeTruthy();
    expect(queryByTestId('ambient-option-winter_static')).toBeNull();
  });

  it('renders all three options when all owned', async () => {
    useStoreStore.getState().addOwnedAtmosphericPack('rain_night');
    useStoreStore.getState().addOwnedAtmosphericPack('winter_static');
    useStoreStore.getState().addOwnedAtmosphericPack('deep_space');

    const { findByTestId } = await render(<AmbientPicker />);
    expect(await findByTestId('ambient-option-rain_night')).toBeTruthy();
    expect(await findByTestId('ambient-option-winter_static')).toBeTruthy();
    expect(await findByTestId('ambient-option-deep_space')).toBeTruthy();
  });
});
