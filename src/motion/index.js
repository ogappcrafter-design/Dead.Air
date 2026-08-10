import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing } from 'react-native';

/**
 * Motion vocabulary.
 *
 * One place for durations and easings so the whole app moves like one object.
 * Everything here is opacity/transform only, which means every animation can
 * run on the native driver and none of them compete with the JS thread while a
 * call is ticking.
 */
export const DURATION = {
  /** Press feedback and other things the finger is already touching. */
  instant: 120,
  /** A line arriving, a control appearing. */
  quick: 260,
  /** Screen changes. */
  settle: 380,
};

export const EASE = {
  out: Easing.out(Easing.cubic),
  inOut: Easing.inOut(Easing.quad),
};

/** How far a fading-in element drifts up, in px. Small enough to read as weight. */
export const RISE = 6;

/**
 * Tracks the OS "reduce motion" setting.
 *
 * Respecting it costs one hook and means the animations never become an
 * accessibility problem — motion-sensitive players get the same game with
 * everything arriving at its final position immediately.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => {
        if (active) setReduced(!!value);
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (value) =>
      setReduced(!!value),
    );
    return () => {
      active = false;
      sub?.remove?.();
    };
  }, []);

  return reduced;
}
