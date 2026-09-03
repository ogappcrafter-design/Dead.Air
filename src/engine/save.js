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

/**
 * Descriptive band for the sanity readout.
 *
 * Not cosmetic: DEAD AIR is a real state — see `isOffAir` — and everything
 * below STABLE drives visible interference through src/engine/interference.js.
 */
export function sanityState(sanity) {
  const s = clampSanity(sanity);
  if (s >= 70) return { label: 'STABLE', color: '#39FF14' };
  if (s >= 35) return { label: 'FRAYED', color: '#FF8C00' };
  if (s > 0) return { label: 'CRITICAL', color: '#FF3366' };
  return { label: 'DEAD AIR', color: '#FF3366' };
}

/* ── Going off air, and buying your way back ─────────────────────────────────
 *
 * Sanity used to be a number that fell and did nothing, and static a score
 * with nothing to spend it on. These two close the loop: the calls that pay
 * best are the ones that cost the most sanity, and sanity is bought back with
 * static. Playing greedily walks you toward the edge on purpose.
 */

/** Full price of a stabilise, in static. */
export const STABILISE_COST = 100;

/** Sanity a full-price stabilise restores. */
export const STABILISE_RESTORE = 30;

/**
 * What a broke player at zero sanity gets anyway.
 *
 * Without this, spending everything and then taking one bad call would strand
 * someone off air with no way back — a softlock at the exact moment the game
 * is most interesting. Hitting zero should cost you your score, not your save.
 */
export const EMERGENCY_RESTORE = 10;

/** At zero the station is dark: no calls until the DJ stabilises. */
export const isOffAir = (save) => clampSanity(save?.sanity) <= SANITY_MIN;

/** What a stabilise would cost and give right now, without performing it. */
export function stabiliseQuote(save) {
  const base = migrateSave(save);
  const spend = Math.min(STABILISE_COST, base.bal);
  const restore = Math.round(STABILISE_RESTORE * (spend / STABILISE_COST));
  const emergency = base.sanity <= SANITY_MIN && restore < EMERGENCY_RESTORE;

  return {
    cost: emergency ? base.bal : spend,
    restore: emergency ? EMERGENCY_RESTORE : restore,
    emergency,
    // Topping up a full meter is not a purchase worth offering.
    available: base.sanity < SANITY_MAX && (base.bal > 0 || emergency),
  };
}

/** Spend static to buy sanity back. Pure; returns a new save. */
export function stabilise(save) {
  const base = migrateSave(save);
  const quote = stabiliseQuote(base);
  if (!quote.available) return { save: base, spent: 0, restored: 0 };

  return {
    save: {
      ...base,
      bal: Math.max(0, base.bal - quote.cost),
      sanity: clampSanity(base.sanity + quote.restore),
    },
    spent: quote.cost,
    restored: quote.restore,
  };
}
