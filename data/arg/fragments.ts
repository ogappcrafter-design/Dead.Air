// data/arg/fragments.ts
// DEA-91: hidden signals on the CLASSIFIED band.
//
// These are not calls. No renderer opens, nothing is answered, no call id is
// touched — a payload bleeds through the console while the player holds the
// band at depth, and files itself only if the player chooses to keep it. The
// voice is the Season 1 hold-music voice: short lines, radio vocabulary taken
// literally, the threat stated as paperwork.
//
// Each fragment advances exactly one thread of the puzzle:
//   frag 1 — the register's arithmetic is wrong on purpose
//   frag 2 — the date is a door, not a record
//   frag 3 — tune the carrier, not the station
//
// Conditions mirror the traces (band + dwell + static + prior call), so the
// trail stays a single gesture: stay on CLASSIFIED, go deeper, pay attention.

import type { ArgFragmentSpec } from './types';

export const ARG_FRAGMENTS: readonly ArgFragmentSpec[] = [
  {
    id: 'frag-count-47',
    label: 'SIGNAL BLEED — COUNT',
    text: [
      'A carrier under the carrier. Under that, a voice reading a count.',
      '"Forty-seven stations. Forty-six rows."',
      '"The register is correct. The count is correct."',
      '"The difference is not a mistake. The difference is a room."',
    ],
    condition: {
      band: 'CLASSIFIED',
      minDwellSeconds: 15,
      minStatic: 45,
      requiresAnyCalls: [12],
    },
  },
  {
    id: 'frag-date-door',
    label: 'SIGNAL BLEED — DATE',
    text: [
      '"A date is a door, not a record."',
      '"They struck the line on the fourth of November."',
      '"They did not strike the day. The day kept its hours."',
    ],
    condition: {
      band: 'CLASSIFIED',
      minDwellSeconds: 25,
      minStatic: 65,
      requiresAnyCalls: [13],
      requiresTraceIds: ['trace-row-23'],
      requiresFragmentIds: ['frag-count-47'],
    },
  },
  {
    id: 'frag-carrier',
    label: 'SIGNAL BLEED — CARRIER',
    text: [
      '"Nobody tunes a carrier."',
      '"They dial stations. Stations have names, and names go in the register."',
      '"Tune the carrier. It has been holding since before the register."',
    ],
    condition: {
      band: 'CLASSIFIED',
      minDwellSeconds: 35,
      minStatic: 85,
      requiresAnyCalls: [14, 16005],
      requiresTraceIds: ['trace-row-46'],
      requiresFragmentIds: ['frag-date-door'],
    },
  },
];

export const getArgFragment = (id: string): ArgFragmentSpec | undefined =>
  ARG_FRAGMENTS.find((fragment) => fragment.id === id);
