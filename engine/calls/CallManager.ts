// engine/calls/CallManager.ts
// Singleton managing call lifecycle: idle → incoming → active → resolving → completed.
// Routes to call type handlers (Wave 2 renderers), reports outcomes to stores + audio.
// Observer pattern lets UI react to state changes.

import type { Band, CallType } from '../../lib/constants';
import type { VoiceProcessor } from '../audio/VoiceProcessor';
import type {
  ActiveCall,
  CallData,
  CallLifecycleState,
  CallOutcome,
  CallStateListener,
} from './types';
import { checkBandUnlock, type BandUnlockRow } from '../progression/BandUnlock';
import type { PlayerStats } from '../progression/Achievements';

/** Calls registry — in production imported from data/calls.js. Injectable for tests. */
export type CallRegistry = ReadonlyMap<number, CallData>;

/** Store accessors — decouples CallManager from Zustand singletons for testing. */
export interface CallManagerStoreAccess {
  /** Current call id (string) or null. Set by setCurrentCall. */
  setCurrentCall(callId: string | null): void;
  /** Decrease sanity by amount (store clamps to 0..100). */
  decreaseSanity(amount: number): void;
  /** Increase sanity by amount (store clamps to 0..MAX_SANITY). */
  increaseSanity(amount: number): void;
  /** Add static (store clamps to 0..100). */
  addStatic(amount: number): void;
  /** Add tape by name if not already present. */
  addTape(tapeId: string): void;
  /** Unlock a band if not already unlocked. */
  unlockBand(band: Band): void;
  /** Cross-cycle list of received call ids (persistent, dedupes on write). */
  getReceivedCalls(): number[];
  /** Bands the player has unlocked so far. */
  getUnlockedBands(): Band[];
  /** Persist a received call id (deduped by store). */
  markCallReceived(callId: number): void;
  /** Record a completed call's duration; store keeps the running maximum. */
  recordCallDuration(durationMs: number): void;
  /** Snapshot of all stats the achievement engine evaluates. */
  getPlayerStats(): PlayerStats;
}

/** Radio accessors — read current band for audio preset selection. */
export interface CallManagerRadioAccess {
  /** Current band the radio is tuned to. */
  getCurrentBand(): Band;
}

/**
 * Optional audio hook. CallManager applies the voice preset for the
 * current band when a call starts. If voiceProcessor is null (e.g. in
 * tests or before audio is initialized), audio is skipped.
 */
export interface CallManagerAudioAccess {
  /** VoiceProcessor instance, or null if audio not ready. */
  voiceProcessor: VoiceProcessor | null;
  /** Apply preset for band. Defaults to voiceProcessor.applyPresetForBand. */
  applyPresetForBand?(band: Band): void;
  /** Preload preset for band ahead of call start. Defaults to voiceProcessor.preloadVoiceForBand. */
  preloadVoiceForBand?(band: Band): void;
}

export interface CallManagerConfig {
  registry: CallRegistry;
  stores: CallManagerStoreAccess;
  radio: CallManagerRadioAccess;
  audio?: CallManagerAudioAccess | null;
  /** BANDS rows from data/calls.js — drives received-call band unlock threshold checks. */
  bands: readonly BandUnlockRow[];
  /** Invoked after endCall applies all stat changes so the achievement engine can check unlocks. */
  onAchievementsCheck?(stats: PlayerStats): void;
  /**
   * Invoked by reset() when an active call is aborted (no rewards applied).
   * Receives the call that was active at reset time, or null when reset is
   * called from idle (no-op). Analytics consumers use this to record
   * `call_failed`. Not invoked by endCall — only by the abort path.
   */
  onCallReset?(activeCall: ActiveCall | null): void;
}

/** Map call.type to handler route label. Wave 2 renderers register here. */
export type CallTypeRoute =
  | 'JUST_LISTEN'
  | 'DEAD_AIR'
  | 'RIGHT_ANSWER'
  | 'SIGNAL_DECODE'
  | 'STAY_CALM'
  | 'RECORDING'
  | 'MULTI_CALLER'
  | 'TIMING'
  | 'PUZZLE'
  | 'CONVERSATION';

const routeForType = (type: CallType): CallTypeRoute => type; // 1:1 today

/**
 * CallManager — singleton owning the call lifecycle state machine.
 *
 * Contract:
 * - Exactly one call active at a time.
 * - startCall(id): idle/incoming/active. Looks up call in registry.
 * - endCall(outcome): resolving → completed → idle. Applies rewards.
 * - Observer pattern: subscribers fire on every state transition.
 * - reset(): force back to idle, clear active call (no rewards applied).
 */
export class CallManager {
  private readonly registry: CallRegistry;
  private readonly stores: CallManagerStoreAccess;
  private readonly radio: CallManagerRadioAccess;
  private readonly bands: readonly BandUnlockRow[];
  private readonly onAchievementsCheck?: (stats: PlayerStats) => void;
  private readonly onCallReset?: (activeCall: ActiveCall | null) => void;
  private audio: CallManagerAudioAccess | null;

  private state: CallLifecycleState = 'idle';
  private activeCall: ActiveCall | null = null;
  private readonly listeners = new Set<CallStateListener>();

  constructor(config: CallManagerConfig) {
    this.registry = config.registry;
    this.stores = config.stores;
    this.radio = config.radio;
    this.bands = config.bands;
    this.audio = config.audio ?? null;
    this.onAchievementsCheck = config.onAchievementsCheck;
    this.onCallReset = config.onCallReset;
  }

  // --- Lifecycle ---

  /**
   * Start a call by id. Transitions idle → incoming → active.
   * If a call is already in progress, returns without starting a new one
   * (caller must endCall or reset first).
   * @returns true if call started, false if id invalid or busy.
   */
  startCall(callId: number): boolean {
    if (this.state !== 'idle') {
      return false;
    }
    const call = this.registry.get(callId);
    if (call === undefined) {
      return false;
    }
    this.transition('incoming', { call, state: 'incoming', startTime: 0 });
    // Brief: startCall transitions idle → incoming → active in one call.
    // The incoming state is a brief notification step; active follows immediately.
    this.stores.setCurrentCall(String(call.id));
    const startTime = Date.now();
    this.transition('active', { call, state: 'active', startTime });

    // Apply voice preset for current band (audio best-effort).
    this.applyBandPreset();

    return true;
  }

  /**
   * Mark the active call as resolving (	renderer computing outcome).
   * Renderers call this before reporting the final outcome.
   */
  setResolving(): void {
    if (this.state !== 'active' || this.activeCall === null) {
      return;
    }
    this.transition('resolving', { ...this.activeCall, state: 'resolving' });
  }

  /**
   * End the active call with an outcome. Transitions → completed → idle.
   * Applies sanity delta, static reward (with multiplier, clamped), tape unlock,
   * band unlock check. Notifies subscribers on each transition.
   */
  endCall(outcome: CallOutcome): void {
    if (this.activeCall === null) {
      return;
    }
    if (this.state !== 'active' && this.state !== 'resolving') {
      return;
    }
    const call = this.activeCall.call;

    // resolving → completed
    if (this.state === 'active') {
      this.transition('resolving', { ...this.activeCall, state: 'resolving' });
    }
    this.transition('completed', {
      call,
      state: 'completed',
      startTime: this.activeCall.startTime,
    });

    // Apply outcome to stores.
    // Sanity: decreaseSanity takes positive amount; negative delta = increase.
    if (outcome.sanityDelta !== 0) {
      if (outcome.sanityDelta < 0) {
        this.stores.decreaseSanity(-outcome.sanityDelta);
      } else {
        this.stores.increaseSanity(outcome.sanityDelta);
      }
    }

    // Static reward with multiplier, clamped to [0, MAX_STATIC] by store.
    const reward = Math.max(0, Math.round(outcome.staticReward * outcome.staticMultiplier));
    if (reward > 0) {
      this.stores.addStatic(reward);
    }

    // Tape unlock.
    if (outcome.tapeUnlocked !== undefined && outcome.tapeUnlocked !== '') {
      this.stores.addTape(outcome.tapeUnlocked);
    }

    // Band unlock.
    if (outcome.bandUnlocked !== undefined) {
      this.stores.unlockBand(outcome.bandUnlocked);
    }

    // Band unlock by received-call threshold. The store persists the
    // deduped received-call id list; the count used here reflects it.
    this.stores.markCallReceived(call.id);

    const unlockedBands = this.stores.getUnlockedBands();
    const receivedCallIds = this.stores.getReceivedCalls();
    const counted = receivedCallIds.length;
    const unlock = checkBandUnlock(
      {
        callsReceived: counted,
        tapesCollected: 0,
        unlockedBands,
      },
      this.bands,
    );
    if (unlock.band !== null) {
      this.stores.unlockBand(unlock.band);
    }

    // Record call duration for the Patient Listener achievement.
    const duration = Date.now() - this.activeCall.startTime;
    if (duration > 0) {
      this.stores.recordCallDuration(duration);
    }

    // Clear current call in store.
    this.stores.setCurrentCall(null);

    // Reset to idle for next call.
    this.transition('idle', null);

    // Surface the new stats snapshot to the achievement engine so it can
    // check + queue any freshly-unlocked milestones.
    if (this.onAchievementsCheck !== undefined) {
      this.onAchievementsCheck(this.stores.getPlayerStats());
    }
  }

  /** Current active call (or null if idle/completed). */
  getCurrentCall(): ActiveCall | null {
    return this.activeCall;
  }

  /** Current lifecycle state. */
  getCallState(): CallLifecycleState {
    return this.state;
  }

  /** Get the route label for the active call's type (null if no active call). */
  getActiveRoute(): CallTypeRoute | null {
    return this.activeCall === null ? null : routeForType(this.activeCall.call.type);
  }

  // --- Observer pattern ---

  /**
   * Subscribe to state transitions. Listener fires immediately with current state.
   * @returns unsubscribe function.
   */
  subscribe(listener: CallStateListener): () => void {
    this.listeners.add(listener);
    // Immediate notify with current state.
    listener(this.state, this.activeCall);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // --- Reset ---

  /**
   * Force reset to idle. Does NOT apply rewards or notify completion.
   * Use endCall() for normal completion; reset() only for abort/teardown.
   */
  reset(): void {
    if (this.onCallReset !== undefined) {
      this.onCallReset(this.activeCall);
    }
    if (this.activeCall !== null) {
      this.stores.setCurrentCall(null);
    }
    this.transition('idle', null);
  }

  /** Configure audio access after construction (e.g. once AudioEngine ready). */
  setAudioAccess(audio: CallManagerAudioAccess | null): void {
    this.audio = audio ?? null;
    if (this.state === 'active' && this.activeCall !== null) {
      this.applyBandPreset();
    } else if (this.audio !== null) {
      this.preloadBandPreset();
    }
  }

  /**
   * Preload the voice preset for the current radio band ahead of call start.
   * Best-effort: no-op if audio not ready. Callers may invoke this before
   * startCall to pre-bake the bitcrush curve and avoid allocation on the hot path.
   */
  preloadBandPreset(): void {
    if (this.audio === null || this.audio.voiceProcessor === null) {
      return;
    }
    const band = this.radio.getCurrentBand();
    if (this.audio.preloadVoiceForBand !== undefined) {
      this.audio.preloadVoiceForBand(band);
    } else {
      this.audio.voiceProcessor.preloadVoiceForBand(band);
    }
  }

  // --- Internal ---

  private transition(newState: CallLifecycleState, call: ActiveCall | null): void {
    this.state = newState;
    this.activeCall = call;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state, this.activeCall);
    }
  }

  private applyBandPreset(): void {
    if (this.audio === null || this.audio.voiceProcessor === null) {
      return;
    }
    const band = this.radio.getCurrentBand();
    if (this.audio.applyPresetForBand !== undefined) {
      this.audio.applyPresetForBand(band);
    } else {
      this.audio.voiceProcessor.applyPresetForBand(band);
    }
  }
}

// --- Module-level singleton ---

let callManagerInstance: CallManager | null = null;

/** Get the singleton CallManager. Returns null if not yet initialized. */
export const getCallManager = (): CallManager | null => callManagerInstance;

/** Initialize the singleton CallManager. Idempotent — safe to call once at boot. */
export const initCallManager = (config: CallManagerConfig): CallManager => {
  if (callManagerInstance === null) {
    callManagerInstance = new CallManager(config);
  }
  return callManagerInstance;
};

/** Test-only: clear singleton. Allows fresh per-test instantiation. */
export const resetCallManager = (): void => {
  if (callManagerInstance !== null) {
    callManagerInstance.reset();
    callManagerInstance = null;
  }
};
