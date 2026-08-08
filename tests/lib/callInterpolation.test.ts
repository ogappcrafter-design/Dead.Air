// tests/lib/callInterpolation.test.ts
// Tests for the runtime call interpolation system (DEA-48).

import {
  interpolateCallLines,
  registerInterpolationRule,
  type InterpolationContext,
} from '@/lib/callInterpolation';

const baseCtx: InterpolationContext = {
  playerName: 'Alice',
  djCallSign: 'NIGHTOWL',
  stationName: 'Dead Air Radio',
};

const emptyCtx: InterpolationContext = {
  playerName: '',
  djCallSign: '',
  stationName: '',
};

describe('callInterpolation', () => {
  describe('interpolateCallLines', () => {
    it('returns lines unchanged for unknown call id', () => {
      const lines = ['Hello', 'World'];
      const result = interpolateCallLines(999, lines, baseCtx);
      expect(result).toBe(lines);
      expect(result).toEqual(['Hello', 'World']);
    });

    it('does not mutate the original array', () => {
      const lines = ['He says your name.', 'Not your username.', 'Your name.'];
      const original = [...lines];
      interpolateCallLines(15, lines, baseCtx);
      expect(lines).toEqual(original);
    });
  });

  describe('Origin call (#15)', () => {
    const originLines = [
      'He says your name.',
      'Not your username.',
      'Your name.',
      'The signal goes quiet for one hundred years.',
    ];

    it('inserts player name after "Your name." line', () => {
      const result = interpolateCallLines(15, originLines, baseCtx);
      const nameIdx = result.indexOf('Alice');
      expect(nameIdx).toBeGreaterThan(-1);
      // Should be right after "Your name."
      const anchorIdx = result.indexOf('Your name.');
      expect(nameIdx).toBe(anchorIdx + 1);
    });

    it('preserves all original lines', () => {
      const result = interpolateCallLines(15, originLines, baseCtx);
      for (const line of originLines) {
        expect(result).toContain(line);
      }
      expect(result.length).toBe(originLines.length + 1);
    });

    it('does not insert if player name is empty', () => {
      const result = interpolateCallLines(15, originLines, emptyCtx);
      expect(result).toEqual(originLines);
      expect(result.length).toBe(originLines.length);
    });

    it('does not insert if anchor line is missing', () => {
      const lines = ['Some other line', 'Different content'];
      const result = interpolateCallLines(15, lines, baseCtx);
      expect(result).toEqual(lines);
    });
  });

  describe('Dead Air call (#17)', () => {
    const deadAirLines = [
      'The station goes dark.',
      'Something answers.',
      'The game will never tell you what it was.',
    ];

    it('inserts station name after "The station goes dark." line', () => {
      const result = interpolateCallLines(17, deadAirLines, baseCtx);
      const insertedIdx = result.indexOf('Dead Air Radio falls silent.');
      expect(insertedIdx).toBeGreaterThan(-1);
      const anchorIdx = result.indexOf('The station goes dark.');
      expect(insertedIdx).toBe(anchorIdx + 1);
    });

    it('preserves all original lines', () => {
      const result = interpolateCallLines(17, deadAirLines, baseCtx);
      for (const line of deadAirLines) {
        expect(result).toContain(line);
      }
      expect(result.length).toBe(deadAirLines.length + 1);
    });

    it('does not insert if station name is empty', () => {
      const result = interpolateCallLines(17, deadAirLines, emptyCtx);
      expect(result).toEqual(deadAirLines);
    });

    it('does not insert if anchor line is missing', () => {
      const lines = ['Different opening', 'Other content'];
      const result = interpolateCallLines(17, lines, baseCtx);
      expect(result).toEqual(lines);
    });
  });

  describe('registerInterpolationRule', () => {
    afterEach(() => {
      registerInterpolationRule({
        callId: 9999,
        transform: (lines: string[]) => lines,
      });
    });

    it('allows registering custom rules', () => {
      registerInterpolationRule({
        callId: 9999,
        transform: (lines: string[], ctx: InterpolationContext) => {
          if (!ctx.djCallSign) return lines;
          return [...lines, `Signed, ${ctx.djCallSign}.`];
        },
      });
      const lines = ['End of transmission.'];
      const result = interpolateCallLines(9999, lines, baseCtx);
      expect(result).toEqual(['End of transmission.', 'Signed, NIGHTOWL.']);
    });

    it('custom rule does not affect other calls', () => {
      registerInterpolationRule({
        callId: 9999,
        transform: (lines: string[], ctx: InterpolationContext) => [...lines, ctx.playerName],
      });
      const lines = ['Test'];
      const result = interpolateCallLines(15, lines, baseCtx);
      expect(result).toEqual(lines);
    });
  });
});
