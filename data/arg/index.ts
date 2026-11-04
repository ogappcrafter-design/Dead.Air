// data/arg/index.ts
// DEA-91: the in-fiction ARG trail — a hidden-mystery layer that lives
// entirely inside the game. Nothing here dials out; there is no phone number,
// no website, no account. The trail is the fiction the broadcast was always
// carrying.
//
// The trail is deliberately small:
//   3 scanline traces  -> 3 registry rows (23 / 46 / 47)
//   3 CLASSIFIED bleeds -> the three questions those rows answer
//   1 hidden call      -> RELAY 47, at carrier 104.7 on CLASSIFIED
//
// Every piece degrades silently: a player who never looks at the static keeps
// the base game untouched, and loses only the hidden call.

export type {
  ArgCondition,
  ArgFragmentId,
  ArgFragmentSpec,
  ArgHiddenCallSpec,
  ArgTraceId,
  ArgTraceSpec,
  RegistryRow,
} from './types';

export { STATION_REGISTRY_ROWS, STATION_REGISTRY_TOTAL, getRegistryRow } from './registry';
export { ARG_TRACES, getArgTrace } from './traces';
export { ARG_FRAGMENTS, getArgFragment } from './fragments';
export { ARG_HIDDEN_CALL, ARG_HIDDEN_CALL_ID, ARG_HIDDEN_CALL_ID_BASE } from './hiddenCall';
