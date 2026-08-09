// tests/components/CRTEffects.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { ScanlineOverlay, VignetteOverlay, PhosphorGlow } from '@/components/shared/CRTEffects';

describe('CRTEffects', () => {
  describe('ScanlineOverlay', () => {
    it('does not crash when mode is "off"', () => {
      render(<ScanlineOverlay intensity={0.5} mode="off" />);
    });

    it('does not crash when intensity is 0', () => {
      render(<ScanlineOverlay intensity={0} mode="full" />);
    });

    it('does not crash when mode is "full"', () => {
      render(<ScanlineOverlay intensity={0.5} mode="full" />);
    });

    it('does not crash when mode is "reduced"', () => {
      render(<ScanlineOverlay intensity={0.5} mode="reduced" />);
    });

    it('does not crash when mode is omitted (defaults to "full")', () => {
      render(<ScanlineOverlay intensity={0.5} />);
    });
  });

  describe('VignetteOverlay', () => {
    it('does not crash when mode is "off"', () => {
      render(<VignetteOverlay intensity={0.5} mode="off" />);
    });

    it('does not crash when mode is "full"', () => {
      render(<VignetteOverlay intensity={0.5} mode="full" />);
    });

    it('does not crash when mode is "reduced"', () => {
      render(<VignetteOverlay intensity={0.5} mode="reduced" />);
    });

    it('does not crash when mode is omitted', () => {
      render(<VignetteOverlay intensity={0.5} />);
    });
  });

  describe('PhosphorGlow', () => {
    it('does not crash when mode is "off"', () => {
      render(<PhosphorGlow intensity={0.5} mode="off" />);
    });

    it('does not crash when mode is "full"', () => {
      render(<PhosphorGlow intensity={0.5} mode="full" />);
    });

    it('does not crash when mode is "reduced"', () => {
      render(<PhosphorGlow intensity={0.5} mode="reduced" />);
    });

    it('does not crash when mode is omitted', () => {
      render(<PhosphorGlow intensity={0.5} />);
    });
  });
});
