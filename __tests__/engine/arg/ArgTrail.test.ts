// __tests__/engine/arg/ArgTrail.test.ts
// DEA-91: gating for the in-fiction ARG trail. Every piece must be reachable
// only through the conditions data/arg/ declares, and the hidden call must
// only arm when the resolved trail is tuned to the carrier.

import {
  ARG_FREQUENCY_TOLERANCE,
  ARG_TARGET_FREQUENCY,
  buildTraceGrid,
  getActiveFragment,
  getActiveTrace,
  getTrailLog,
  isArgConditionMet,
  isHiddenCallArmed,
  isTrailResolved,
  resolveTraceArtifact,
  traceSeed,
  type TrailContext,
  type TrailProgress,
} from '../../../engine/arg/ArgTrail';
import { decodeGlyphMatrix } from '../../../engine/arg/GlyphCodec';
import { ARG_FRAGMENTS, ARG_HIDDEN_CALL_ID, ARG_TRACES, getArgTrace } from '../../../data/arg';

const context = (overrides: Partial<TrailContext> = {}): TrailContext => ({
  band: 'CLASSIFIED',
  frequency: ARG_TARGET_FREQUENCY,
  shiftNumber: 9,
  staticLevel: 90,
  receivedCalls: [12, 13, 14],
  ...overrides,
});

const progress = (overrides: Partial<TrailProgress> = {}): TrailProgress => ({
  decodedTraceIds: [],
  heardFragmentIds: [],
  hiddenCallPlayed: false,
  ...overrides,
});

const FULL_PROGRESS = progress({
  decodedTraceIds: ARG_TRACES.map((trace) => trace.id),
  heardFragmentIds: ARG_FRAGMENTS.map((fragment) => fragment.id),
});

describe('ArgTrail — trace gating', () => {
  it('hides every trace outside the CLASSIFIED band', () => {
    for (const band of ['LIVING', 'LIMINAL', 'LOST', '████████'] as const) {
      expect(getActiveTrace(context({ band }), progress())).toBeNull();
    }
  });

  it('shows trace 1 once band, shift, static and the prior call line up', () => {
    expect(getActiveTrace(context(), progress())?.id).toBe('trace-row-23');
  });

  it('hides trace 1 one shift short', () => {
    expect(getActiveTrace(context({ shiftNumber: 2 }), progress())).toBeNull();
  });

  it('hides trace 1 one static point short', () => {
    expect(getActiveTrace(context({ staticLevel: 34 }), progress())).toBeNull();
  });

  it('hides trace 1 without the prior classified call', () => {
    expect(getActiveTrace(context({ receivedCalls: [] }), progress())).toBeNull();
  });

  it('will not show trace 2 until trace 1 is decoded', () => {
    expect(getActiveTrace(context(), progress())?.id).toBe('trace-row-23');
    expect(getActiveTrace(context(), progress({ decodedTraceIds: ['trace-row-23'] }))?.id).toBe(
      'trace-row-46',
    );
  });

  it('accepts the Season 1 maintenance channel as the trace 3 prior unlock', () => {
    const p = progress({ decodedTraceIds: ['trace-row-23', 'trace-row-46'] });
    expect(getActiveTrace(context({ receivedCalls: [12, 13, 16005] }), p)?.id).toBe('trace-row-47');
    expect(getActiveTrace(context({ receivedCalls: [12, 13] }), p)).toBeNull();
  });

  it('never re-shows a decoded trace', () => {
    const all = progress({ decodedTraceIds: ['trace-row-23', 'trace-row-46', 'trace-row-47'] });
    expect(getActiveTrace(context(), all)).toBeNull();
  });
});

describe('ArgTrail — signal bleed gating', () => {
  it('shows the count bleed at its threshold', () => {
    const active = getActiveFragment(context({ shiftNumber: 4, staticLevel: 45 }), progress());
    expect(active?.id).toBe('frag-count-47');
  });

  it('hides the count bleed below its threshold', () => {
    expect(getActiveFragment(context({ shiftNumber: 4, staticLevel: 44 }), progress())).toBeNull();
  });

  it('requires the count bleed and trace 1 before the date bleed', () => {
    const contextAt = context({ shiftNumber: 6, staticLevel: 65 });
    expect(getActiveFragment(contextAt, progress())?.id).toBe('frag-count-47');
    expect(
      getActiveFragment(contextAt, progress({ heardFragmentIds: ['frag-count-47'] })),
    ).toBeNull();
    expect(
      getActiveFragment(
        contextAt,
        progress({ heardFragmentIds: ['frag-count-47'], decodedTraceIds: ['trace-row-23'] }),
      )?.id,
    ).toBe('frag-date-door');
  });

  it('requires trace 2 and the date bleed before the carrier bleed', () => {
    const contextAt = context({ shiftNumber: 8, staticLevel: 85 });
    const ready = progress({
      heardFragmentIds: ['frag-count-47', 'frag-date-door'],
      decodedTraceIds: ['trace-row-23', 'trace-row-46'],
    });
    expect(getActiveFragment(contextAt, ready)?.id).toBe('frag-carrier');
  });

  it('never re-shows a filed bleed', () => {
    const all = progress({ heardFragmentIds: ARG_FRAGMENTS.map((fragment) => fragment.id) });
    expect(getActiveFragment(context(), all)).toBeNull();
  });
});

describe('ArgTrail — artifact resolution', () => {
  it('resolves each trace to the registry row it carries', () => {
    const expected = [
      ['trace-row-23', 'RELAY 23', '101.9'],
      ['trace-row-46', 'RELAY 46', '104.7'],
      ['trace-row-47', 'RELAY 47', '104.7'],
    ] as const;

    for (const [traceId, designation, carrier] of expected) {
      const trace = getArgTrace(traceId);
      expect(trace).toBeDefined();
      const artifact = resolveTraceArtifact(trace!, 9);
      expect(artifact.payload).toBe(trace!.payload);
      expect(artifact.row.designation).toBe(designation);
      expect(artifact.row.carrier).toBe(carrier);
    }
  });

  it('decodes from the matrix cells alone, not from the trace id', () => {
    for (const trace of ARG_TRACES) {
      const grid = buildTraceGrid(trace, 3);
      expect(decodeGlyphMatrix(grid)).toBe(trace.payload);
    }
  });

  it('is deterministic per shift', () => {
    const trace = getArgTrace('trace-row-46')!;
    expect(buildTraceGrid(trace, 5)).toEqual(buildTraceGrid(trace, 5));
    expect(traceSeed(trace.id, 5)).toBe('arg:trace-row-46:shift:5');
  });

  it('keeps the payload stable across shifts while the dither moves', () => {
    const trace = getArgTrace('trace-row-47')!;
    const a = buildTraceGrid(trace, 7);
    const b = buildTraceGrid(trace, 8);
    expect(decodeGlyphMatrix(a)).toBe(trace.payload);
    expect(decodeGlyphMatrix(b)).toBe(trace.payload);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

describe('ArgTrail — resolution and the hidden call', () => {
  it('is unresolved until every row is read and every bleed filed', () => {
    expect(isTrailResolved(progress())).toBe(false);
    expect(
      isTrailResolved(progress({ decodedTraceIds: ARG_TRACES.map((trace) => trace.id) })),
    ).toBe(false);
    expect(isTrailResolved(FULL_PROGRESS)).toBe(true);
  });

  it('arms the hidden call only on the carrier', () => {
    expect(isHiddenCallArmed(context({ frequency: 104.6 }), FULL_PROGRESS)).toBe(false);
    expect(isHiddenCallArmed(context({ frequency: 101.9 }), FULL_PROGRESS)).toBe(false);
    expect(isHiddenCallArmed(context(), FULL_PROGRESS)).toBe(true);
  });

  it('matches the frequency the console prints', () => {
    const displayEdge = ARG_TARGET_FREQUENCY - ARG_FREQUENCY_TOLERANCE + 0.001;
    expect(isHiddenCallArmed(context({ frequency: displayEdge }), FULL_PROGRESS)).toBe(true);
  });

  it('does not arm on another band', () => {
    expect(isHiddenCallArmed(context({ band: '████████' }), FULL_PROGRESS)).toBe(false);
  });

  it('does not arm before the trail resolves', () => {
    expect(isHiddenCallArmed(context(), progress())).toBe(false);
  });

  it('does not re-arm after the call has played', () => {
    expect(
      isHiddenCallArmed(context(), progress({ ...FULL_PROGRESS, hiddenCallPlayed: true })),
    ).toBe(false);
  });

  it('does not re-arm once the call is in receivedCalls', () => {
    expect(
      isHiddenCallArmed(
        context({ receivedCalls: [12, 13, 14, ARG_HIDDEN_CALL_ID] }),
        FULL_PROGRESS,
      ),
    ).toBe(false);
  });
});

describe('ArgTrail — log', () => {
  it('reports collected pieces in trail order', () => {
    const log = getTrailLog(
      progress({
        decodedTraceIds: ['trace-row-23', 'trace-row-46'],
        heardFragmentIds: ['frag-count-47'],
      }),
    );
    expect(log.decodedRows.map((row) => row.row)).toEqual([23, 46]);
    expect(log.filedFragments.map((fragment) => fragment.id)).toEqual(['frag-count-47']);
    expect(log.totalTraces).toBe(3);
    expect(log.totalFragments).toBe(3);
  });

  it('reports an empty log before the player investigates', () => {
    const log = getTrailLog(progress());
    expect(log.decodedRows).toHaveLength(0);
    expect(log.filedFragments).toHaveLength(0);
  });
});

describe('ArgTrail — condition shape', () => {
  it('evaluates the same condition object used by data/arg', () => {
    const trace = ARG_TRACES[0]!;
    expect(isArgConditionMet(trace.condition, context(), progress())).toBe(true);
    expect(isArgConditionMet(trace.condition, context({ band: 'LIVING' }), progress())).toBe(false);
  });
});
