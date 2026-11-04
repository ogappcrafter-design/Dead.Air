// data/arg/traces.ts
// DEA-91: the three scanline traces.
//
// Each trace is a 13x13 glyph matrix drawn inside the CRT scanline layer while
// the player holds the CLASSIFIED band long enough for the carrier to resolve.
// The matrix is not a re-skin of the scanlines: it rides the same drifting
// layer, in the same phosphor, at the same opacity scale, and is rendered from
// a seeded bit field (engine/arg/GlyphCodec.ts).
//
// The payloads are registry keys, not prose. Decoding one gives the player a
// row of the 47-station register — the register fragment is the reward, and the
// three rows interlock into the answer the hidden call asks for.
//
// Conditions, in the order the player meets them (dwell = seconds held on the
// band this session; the counter resets when the player tunes away):
//   trace 1 — CLASSIFIED, 10s dwell, 35 static, call 12 received
//   trace 2 — CLASSIFIED, 20s dwell, 55 static, call 13 received, trace 1 read
//   trace 3 — CLASSIFIED, 30s dwell, 75 static, call 14 (or Season 1's
//             maintenance channel, 16005) received, trace 2 read

import type { ArgTraceSpec } from './types';

export const ARG_TRACES: readonly ArgTraceSpec[] = [
  {
    id: 'trace-row-23',
    payload: 'RELAY 23 11.04.87',
    registryRow: 23,
    label: 'ROW 23 — GREYFIELD EXCHANGE',
    condition: {
      band: 'CLASSIFIED',
      minDwellSeconds: 10,
      minStatic: 35,
      requiresAnyCalls: [12],
    },
  },
  {
    id: 'trace-row-46',
    payload: 'RELAY 46 104.7',
    registryRow: 46,
    label: 'ROW 46 — LONGWAVE ANNEX',
    condition: {
      band: 'CLASSIFIED',
      minDwellSeconds: 20,
      minStatic: 55,
      requiresAnyCalls: [13],
      requiresTraceIds: ['trace-row-23'],
    },
  },
  {
    id: 'trace-row-47',
    payload: 'RELAY 47 UNLISTED',
    registryRow: 47,
    label: 'ROW 47 — [NOT SURVEYED]',
    condition: {
      band: 'CLASSIFIED',
      minDwellSeconds: 30,
      minStatic: 75,
      requiresAnyCalls: [14, 16005],
      requiresTraceIds: ['trace-row-46'],
    },
  },
];

export const getArgTrace = (id: string): ArgTraceSpec | undefined =>
  ARG_TRACES.find((trace) => trace.id === id);
