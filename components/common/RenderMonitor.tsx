// components/common/RenderMonitor.tsx
// Dev-only performance monitor: wraps children and logs unnecessary re-renders.
// In production (__DEV__ === false) it renders children directly with zero overhead.

import React, { memo, useEffect, useRef } from 'react';

interface RenderMonitorProps {
  /** Label identifying the monitored component in console output. */
  name: string;
  /** The child component to monitor. */
  children: React.ReactNode;
}

/**
 * Wraps children and logs a console.warn when the component re-renders.
 * Only active when __DEV__ is true — in production, children pass through.
 *
 * Usage:
 *   <RenderMonitor name="RadioBody">
 *     <RadioBody />
 *   </RenderMonitor>
 */
export const RenderMonitor = memo(function RenderMonitor({ name, children }: RenderMonitorProps) {
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;
    if (renderCount.current > 1) {
      console.warn(`[RenderMonitor] "${name}" re-rendered (${renderCount.current}x)`);
    }
  });

  if (!__DEV__) {
    return <>{children}</>;
  }

  return <>{children}</>;
});
