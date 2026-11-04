// __tests__/data/arg.test.ts
// DEA-91: content integrity for the in-fiction ARG trail. The hidden call must
// stay inside the reserved seasonal id space and never collide with the sacred
// calls or Season 1; every trace must point at a real registry row and carry a
// payload the codec can actually encode.

import {
  ARG_FRAGMENTS,
  ARG_HIDDEN_CALL,
  ARG_HIDDEN_CALL_ID,
  ARG_HIDDEN_CALL_ID_BASE,
  ARG_TRACES,
  STATION_REGISTRY_ROWS,
  STATION_REGISTRY_TOTAL,
  getArgFragment,
  getArgTrace,
  getRegistryRow,
} from '../../data/arg';
import { SEASON_1_CALL_IDS } from '../../data/seasons/season1/holdMusic';
import { GLYPH_ALPHABET, GLYPH_MAX_CHARS } from '../../engine/arg/GlyphCodec';
import { CALLS } from '../../data/calls';

describe('ARG trail data', () => {
  it('defines exactly three traces and three bleeds', () => {
    expect(ARG_TRACES).toHaveLength(3);
    expect(ARG_FRAGMENTS).toHaveLength(3);
  });

  it('keeps trace ids unique and resolvable', () => {
    const ids = ARG_TRACES.map((trace) => trace.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(getArgTrace(id)?.id).toBe(id);
    }
  });

  it('keeps fragment ids unique and resolvable', () => {
    const ids = ARG_FRAGMENTS.map((fragment) => fragment.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(getArgFragment(id)?.id).toBe(id);
    }
  });

  it('points every trace at a registry row that exists', () => {
    for (const trace of ARG_TRACES) {
      const row = getRegistryRow(trace.registryRow);
      expect(row).toBeDefined();
      expect(row?.row).toBe(trace.registryRow);
      expect(trace.registryRow).toBeLessThanOrEqual(STATION_REGISTRY_TOTAL);
    }
  });

  it('carries glyph payloads the codec can encode', () => {
    for (const trace of ARG_TRACES) {
      expect(trace.payload.length).toBeLessThanOrEqual(GLYPH_MAX_CHARS);
      for (const char of trace.payload) {
        expect(GLYPH_ALPHABET).toContain(char);
      }
      // The payload must name the row it resolves to, or the artifact lies.
      expect(trace.payload).toContain(String(trace.registryRow));
    }
  });

  it('registers the registry rows the trail needs', () => {
    expect(Object.keys(STATION_REGISTRY_ROWS)).toHaveLength(3);
    expect(STATION_REGISTRY_TOTAL).toBe(47);
  });

  it('anchors the answer in the register: row 47 shares row 46 carrier', () => {
    const row46 = getRegistryRow(46);
    const row47 = getRegistryRow(47);
    expect(row47?.carrier).toBe(row46?.carrier);
    expect(row47?.status).toContain('NO ROW');
  });

  it('keeps every bleed on the CLASSIFIED band', () => {
    for (const fragment of ARG_FRAGMENTS) {
      expect(fragment.condition.band).toBe('CLASSIFIED');
      expect(fragment.text.length).toBeGreaterThan(0);
    }
  });

  it('keeps every trace on the CLASSIFIED band', () => {
    for (const trace of ARG_TRACES) {
      expect(trace.condition.band).toBe('CLASSIFIED');
    }
  });

  it('chains the trail: each piece depends on the one before it', () => {
    const [t1, t2, t3] = ARG_TRACES;
    expect(t1?.condition.requiresTraceIds).toBeUndefined();
    expect(t2?.condition.requiresTraceIds).toEqual(['trace-row-23']);
    expect(t3?.condition.requiresTraceIds).toEqual(['trace-row-46']);

    const [f1, f2, f3] = ARG_FRAGMENTS;
    expect(f1?.condition.requiresFragmentIds).toBeUndefined();
    expect(f2?.condition.requiresFragmentIds).toEqual(['frag-count-47']);
    expect(f3?.condition.requiresFragmentIds).toEqual(['frag-date-door']);
  });
});

describe('ARG hidden call', () => {
  it('lives in the reserved seasonal id space', () => {
    expect(ARG_HIDDEN_CALL_ID).toBe(ARG_HIDDEN_CALL_ID_BASE);
    expect(ARG_HIDDEN_CALL_ID).toBeGreaterThanOrEqual(15_000);
  });

  it('never collides with the sacred calls', () => {
    const sacredIds = (CALLS as unknown as Array<{ id: number }>).map((call) => call.id);
    expect(sacredIds).not.toContain(ARG_HIDDEN_CALL_ID);
  });

  it('never collides with Season 1', () => {
    expect(SEASON_1_CALL_IDS as readonly number[]).not.toContain(ARG_HIDDEN_CALL_ID);
  });

  it('matches its declared id and band', () => {
    expect(ARG_HIDDEN_CALL.id).toBe(ARG_HIDDEN_CALL_ID);
    expect(ARG_HIDDEN_CALL.band).toBe('CLASSIFIED');
    expect(ARG_HIDDEN_CALL.call.id).toBe(ARG_HIDDEN_CALL_ID);
    expect(ARG_HIDDEN_CALL.call.band).toBe(3);
  });

  it('is a playable RIGHT_ANSWER call with three distinct choices', () => {
    const call = ARG_HIDDEN_CALL.call;
    expect(call.type).toBe('RIGHT_ANSWER');
    expect(call.lines?.length).toBeGreaterThan(8);
    expect(call.choices).toHaveLength(3);
    const tags = (call.choices ?? []).map((choice) => choice.choiceTag);
    expect(new Set(tags).size).toBe(3);
    for (const tag of tags) {
      expect(tag?.startsWith('arg_')).toBe(true);
    }
  });

  it('is not DLC-gated or forge-gated', () => {
    expect(ARG_HIDDEN_CALL.call.sourcePackId).toBeUndefined();
    expect(ARG_HIDDEN_CALL.call.sourceCustomFrequencyId).toBeUndefined();
  });
});
