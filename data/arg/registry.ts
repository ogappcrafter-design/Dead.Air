// data/arg/registry.ts
// DEA-91: fragments of the 47-station registry.
//
// Canon: data/relayPointCall.ts (DEA-59) already establishes that the network
// is "forty-seven stations", each operated by a relay point. The register is
// the network's paperwork; the ARG's answer is the row the paperwork leaves
// blank so the count comes out right.
//
// Only the rows the trail touches are printed here. A trace's glyph payload
// decodes to a designation + carrier key; the decoder resolves that key to one
// of these rows, so the screenshot carries a genuine index into the register
// rather than decorative noise.

import type { RegistryRow } from './types';

/** The register's stated size. The horror is that the count is correct. */
export const STATION_REGISTRY_TOTAL = 47;

export const STATION_REGISTRY_ROWS: Readonly<Record<number, RegistryRow>> = {
  23: {
    row: 23,
    designation: 'RELAY 23',
    site: 'GREYFIELD EXCHANGE',
    carrier: '101.9',
    status: 'DECOMMISSIONED 11.04.87 — LINE HELD OPEN',
  },
  46: {
    row: 46,
    designation: 'RELAY 46',
    site: 'LONGWAVE ANNEX',
    carrier: '104.7',
    status: 'HOLD TONE ONLY — NO OPERATOR ASSIGNED',
  },
  47: {
    row: 47,
    designation: 'RELAY 47',
    site: '[NOT SURVEYED]',
    carrier: '104.7',
    status: 'NO ROW IN THE REGISTER — SAME CARRIER AS 46',
  },
};

export const getRegistryRow = (row: number): RegistryRow | undefined => STATION_REGISTRY_ROWS[row];
