// engine/audio/capture/MicrophoneCapture.ts
// DEA-90 — platform-agnostic microphone capture contract.
//
// Sits alongside the PlatformBridge abstraction: the engine (and the
// useVoiceFlinch hook) only ever talk to this interface, while the concrete
// implementations wrap the browser's getUserMedia (web) or expo-audio's PCM
// stream (native). Everything here degrades: a missing device, a denied
// permission, or a failed capture reports failure and the caller falls back to
// the tap-only mechanic.
//
// No audio is retained: implementations hand the caller a level per frame and
// release the stream when stopped. Nothing is written to disk or transmitted.

/** Result of asking for microphone access. */
export type MicrophonePermission = 'granted' | 'denied' | 'unavailable';

/** Receives one RMS level in [0, 1] per captured frame. */
export type MicrophoneLevelListener = (rms: number) => void;

export interface MicrophoneCapture {
  /** Platform identifier — mirrors `PlatformBridge.platform`. */
  readonly platform: 'web' | 'native';

  /** True when this runtime can even attempt capture (API present). */
  isAvailable(): boolean;

  /**
   * Ask the player for microphone access. Never throws: a refusal or a broken
   * platform reports `denied` / `unavailable`.
   */
  requestPermission(): Promise<MicrophonePermission>;

  /**
   * Begin delivering levels to `onLevel`. Resolves `true` when capture is
   * running. On any failure it resolves `false` and releases whatever it
   * acquired, so the caller can stay on the tap-only path.
   */
  start(onLevel: MicrophoneLevelListener): Promise<boolean>;

  /** Stop capture and release resources. Idempotent; safe after a failure. */
  stop(): void;
}

/**
 * Session-level permission memory. Players are asked at most once per app
 * session: a grant is reused, and a refusal is remembered so the game never
 * nags or re-prompts during later calls. `unavailable` is not cached — a
 * device can gain a microphone (headset plugged in) without a restart.
 */
let cachedPermission: 'granted' | 'denied' | null = null;

/**
 * Resolve microphone permission through the platform capture, memoizing the
 * answer for the session. Never throws.
 */
export async function requestMicrophonePermission(
  capture: MicrophoneCapture,
): Promise<MicrophonePermission> {
  if (cachedPermission !== null) return cachedPermission;

  let permission: MicrophonePermission;
  try {
    permission = await capture.requestPermission();
  } catch {
    permission = 'unavailable';
  }

  if (permission === 'granted' || permission === 'denied') {
    cachedPermission = permission;
  }
  return permission;
}

/** Test-only: forget the memoized permission answer. */
export function __resetMicrophonePermissionCache(): void {
  cachedPermission = null;
}
