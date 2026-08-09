import { LEGACY_ID_ORDER } from '../content/calls';
import { ALL_TAPES } from '../content/tapes';

export const SAVE_VERSION = 2;
export const SANITY_MIN = 0;
export const SANITY_MAX = 100;

export const DEFAULT_SAVE = Object.freeze({
  version: SAVE_VERSION,
  sanity: SANITY_MAX,
  bal: 0,
  done: [],
  tapes: [],
  genCount: 0,
});

export const DEFAULT_PURCHASES = Object.freeze({
  baseUnlocked: false,
  infiniteUnlocked: false,
});

export const clampSanity = (n) =>
  Math.max(SANITY_MIN, Math.min(SANITY_MAX, Math.round(Number(n) || 0)));

const uniqueStrings = (arr) => [...new Set((Array.isArray(arr) ? arr : []).filter((v) => v))];

/**
 * Bring any previously stored save up to the current shape.
 *
 * v1 stored `done` as numeric indices into the flat call list and had no
 * `version` field; v2 uses stable string ids so content can be reordered
 * without corrupting anyone's progress.
 */
export function migrateSave(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SAVE };

  const done = Array.isArray(raw.done)
    ? raw.done
        .map((entry) => (typeof entry === 'number' ? LEGACY_ID_ORDER[entry] : entry))
        .filter((id) => typeof id === 'string' && id.length > 0)
    : [];

  // Tapes were stored by display name in both versions; drop anything that no
  // longer matches a real tape so a renamed tape cannot wedge the archive.
  const tapes = uniqueStrings(raw.tapes).filter((t) => ALL_TAPES.includes(t));

  return {
    version: SAVE_VERSION,
    sanity: clampSanity(raw.sanity ?? SANITY_MAX),
    bal: Math.max(0, Math.round(Number(raw.bal) || 0)),
    done: uniqueStrings(done),
    tapes,
    genCount: Math.max(0, Math.round(Number(raw.genCount) || 0)),
  };
}

export function migratePurchases(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PURCHASES };
  return {
    baseUnlocked: !!raw.baseUnlocked,
    infiniteUnlocked: !!raw.infiniteUnlocked,
  };
}

/**
 * Fold the result of a finished call into the save.
 *
 * `result` is what a call player hands back when the player ends the call:
 *   { sanityDelta, staticMult, tape, outcome }
 *
 * Returns a brand new save plus a `gained` summary the UI uses for the
 * post-call readout. Pure — no storage, no side effects.
 */
export function applyCallResult(save, call, result = {}) {
  const base = migrateSave(save);
  const staticMult = Number.isFinite(result.staticMult) ? result.staticMult : 1;
  const sanityDelta = Number.isFinite(result.sanityDelta) ? result.sanityDelta : 0;

  const payout = Math.max(0, Math.round((Number(call?.staticReward) || 0) * staticMult));
  const nextSanity = clampSanity(base.sanity + sanityDelta);

  // A tape only counts once, and only if it is a tape the archive knows about.
  const tape = typeof result.tape === 'string' ? result.tape : null;
  const isNewTape = !!tape && ALL_TAPES.includes(tape) && !base.tapes.includes(tape);

  // Generated calls are one-shot: they are never added to `done` (there is no
  // stable content to re-hide) but they do burn a generation credit.
  const isGenerated = !!call?.generated;
  const alreadyDone = !!call?.id && base.done.includes(call.id);

  return {
    save: {
      ...base,
      sanity: nextSanity,
      bal: base.bal + payout,
      done: isGenerated || alreadyDone || !call?.id ? base.done : [...base.done, call.id],
      tapes: isNewTape ? [...base.tapes, tape] : base.tapes,
      genCount: isGenerated ? base.genCount + 1 : base.genCount,
    },
    gained: {
      payout,
      sanityDelta: nextSanity - base.sanity,
      tape: isNewTape ? tape : null,
      outcome: result.outcome || null,
    },
  };
}

/** Descriptive band for the sanity readout. Cosmetic — no mechanical effect. */
export function sanityState(sanity) {
  const s = clampSanity(sanity);
  if (s >= 70) return { label: 'STABLE', color: '#39FF14' };
  if (s >= 35) return { label: 'FRAYED', color: '#FF8C00' };
  if (s > 0) return { label: 'CRITICAL', color: '#FF3366' };
  return { label: 'DEAD AIR', color: '#FF3366' };
}
