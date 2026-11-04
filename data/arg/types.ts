// data/arg/types.ts
// DEA-91: types for the in-fiction ARG trail. Pure data shapes — no engine
// imports beyond the shared CallData type (the same exception data/seasons/
// takes so a season can declare its calls).

import type { Band } from '../../lib/constants';
import type { CallData } from '../../engine/calls/types';

export type ArgTraceId = 'trace-row-23' | 'trace-row-46' | 'trace-row-47';
export type ArgFragmentId = 'frag-count-47' | 'frag-date-door' | 'frag-carrier';

/**
 * One row of the 47-station registry (canon: data/relayPointCall.ts already
 * establishes "across the country — across the decades — forty-seven
 * stations"). A decoded scanline trace resolves to one of these rows.
 */
export interface RegistryRow {
  /** Row index in the register, 1..47. */
  readonly row: number;
  readonly designation: string;
  readonly site: string;
  readonly carrier: string;
  readonly status: string;
}

/**
 * When a piece of the trail is visible. Every field is read from state the
 * shipped app already carries:
 *
 * - `band` — the radio's current band (useRadioStore).
 * - `minShift` — the trail's temporal axis. The app tracks completed shifts
 *   (gameStore.shiftsCompleted); the NightShift engine is not mounted on the
 *   radio screen, so there is no intra-shift clock to read.
 * - `minStatic` — the player's accumulated static (gameStore.static). The
 *   deeper into the static, the more the carrier bleeds: the ARG's own
 *   currency doubles as its depth gauge.
 * - `requiresAnyCalls` — any-of prior call ids in receivedCalls, the same
 *   prerequisite shape data/unlockGraph.ts uses. Season ids are accepted
 *   alongside sacred ids so the trail keeps working once the Season 1
 *   registration layer is mounted.
 * - `requiresTraceIds` / `requiresFragmentIds` — earlier pieces of this trail,
 *   so the three rows resolve in order.
 */
export interface ArgCondition {
  readonly band: Band;
  readonly minShift: number;
  readonly minStatic: number;
  readonly requiresAnyCalls: readonly number[];
  readonly requiresTraceIds?: readonly ArgTraceId[];
  readonly requiresFragmentIds?: readonly ArgFragmentId[];
}

/** A glyph matrix hidden in the CRT scanline layer. */
export interface ArgTraceSpec {
  readonly id: ArgTraceId;
  /** Compact payload carried by the matrix (decodes to the registry row). */
  readonly payload: string;
  /** Registry row this trace resolves to. */
  readonly registryRow: number;
  /** In-world label for the collected-artifact log. */
  readonly label: string;
  readonly condition: ArgCondition;
}

/** A CLASSIFIED-band payload that is not a call — text bleeding through. */
export interface ArgFragmentSpec {
  readonly id: ArgFragmentId;
  readonly label: string;
  readonly text: readonly string[];
  readonly condition: ArgCondition;
}

/** The one hidden call the completed trail unlocks. */
export interface ArgHiddenCallSpec {
  readonly id: number;
  readonly band: Band;
  readonly call: CallData;
}
