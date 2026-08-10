import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { IMPACT, NOTIFICATION, PATTERNS, SELECTION } from './patterns';

/**
 * Touch feedback, on exactly the moments that already make a sound.
 *
 * Same restraint as the audio bus and the same shape, so a call site reads
 * `haptics.tap('key')` beside `audio.play('key')` — in practice both go
 * through src/feedback so they cannot drift apart.
 *
 * Everything is fire-and-forget and every call is swallowed: a device without
 * a haptic engine, or one with it switched off at the OS level, should feel
 * like a game without haptics rather than a game throwing promises.
 */

/** Web has no haptics API worth calling. */
const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

const IMPACT_STYLES = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

const NOTIFICATION_TYPES = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

let enabled = true;

function perform(pattern) {
  switch (pattern.kind) {
    case IMPACT:
      return Haptics.impactAsync(IMPACT_STYLES[pattern.style]);
    case NOTIFICATION:
      return Haptics.notificationAsync(NOTIFICATION_TYPES[pattern.style]);
    case SELECTION:
      return Haptics.selectionAsync();
    default:
      return undefined;
  }
}

export function tap(name) {
  if (!enabled || !SUPPORTED) return;
  const pattern = PATTERNS[name];
  if (!pattern) return;
  try {
    // Deliberately not awaited: feedback must never sit in front of the UI
    // update that caused it.
    perform(pattern)?.catch?.(() => {});
  } catch {
    // A device that cannot buzz is not a broken device.
  }
}

export function setEnabled(next) {
  enabled = !!next;
}

export const isEnabled = () => enabled;

export default { tap, setEnabled, isEnabled };
