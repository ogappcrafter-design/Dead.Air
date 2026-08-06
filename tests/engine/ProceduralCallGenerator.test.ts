import { ProceduralCallGenerator } from '../../engine/calls/ProceduralCallGenerator';
import type { Band } from '../../lib/constants';
import { BANDS } from '../../lib/constants';

describe('ProceduralCallGenerator', () => {
  let generator: ProceduralCallGenerator;

  beforeEach(() => {
    generator = new ProceduralCallGenerator();
  });

  describe('generateCall', () => {
    it('generates calls for all valid bands', () => {
      for (const band of BANDS) {
        const call = generator.generateCall(band);
        expect(call).toBeDefined();
        expect(call.callerId).toBeDefined();
        expect(call.lines).toBeDefined();
        expect(call.lines!.length).toBe(3);
      }
    });

    it('throws for invalid band', () => {
      expect(() => generator.generateCall('INVALID' as Band)).toThrow('Invalid band');
    });

    it('generates valid CallData with all required fields', () => {
      const call = generator.generateCall('LIVING');
      expect(typeof call.id).toBe('number');
      expect(call.id).toBeGreaterThanOrEqual(1000);
      expect(typeof call.band).toBe('number');
      expect(call.band).toBe(0);
      expect(typeof call.callerId).toBe('string');
      expect(call.callerId.length).toBe(8);
      expect(typeof call.callerName).toBe('string');
      expect(typeof call.signal).toBe('number');
      expect(call.signal).toBeGreaterThanOrEqual(0);
      expect(call.signal).toBeLessThanOrEqual(5);
      expect(typeof call.type).toBe('string');
      expect(typeof call.staticReward).toBe('number');
    });

    it('generates non-empty lines', () => {
      const call = generator.generateCall('LOST');
      for (const line of call.lines!) {
        expect(typeof line).toBe('string');
        expect(line.length).toBeGreaterThan(0);
      }
    });

    it('generates unique caller IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const call = generator.generateCall('LIVING');
        expect(ids.has(call.callerId)).toBe(false);
        ids.add(call.callerId);
      }
    });

    it('assigns band index correctly', () => {
      expect(generator.generateCall('LIVING').band).toBe(0);
      expect(generator.generateCall('LIMINAL').band).toBe(1);
      expect(generator.generateCall('LOST').band).toBe(2);
      expect(generator.generateCall('CLASSIFIED').band).toBe(3);
      expect(generator.generateCall('████████').band).toBe(4);
    });
  });

  describe('generateCalls', () => {
    it('generates calls across all bands', () => {
      const calls = generator.generateCalls(2);
      expect(calls.length).toBe(10);
      const bands = new Set(calls.map(c => c.band));
      expect(bands.size).toBe(5);
    });

    it('generates unique caller IDs across all calls', () => {
      const calls = generator.generateCalls(5);
      const ids = new Set(calls.map(c => c.callerId));
      expect(ids.size).toBe(calls.length);
    });

    it('default count generates 5 per band (25 total)', () => {
      const calls = generator.generateCalls();
      expect(calls.length).toBe(25);
    });
  });

  describe('clearCache', () => {
    it('clears used caller IDs', () => {
      generator.generateCall('LIVING');
      generator.generateCall('LIVING');
      generator.clearCache();
      // Should not throw after clear
      expect(() => generator.generateCall('LIVING')).not.toThrow();
    });
  });

  describe('Fragment libraries', () => {
    it('all fragment libraries have required structure', () => {
      const { LIVING_FRAGMENTS } = require('../../data/fragments/LIVING');
      expect(LIVING_FRAGMENTS.opening.length).toBeGreaterThan(0);
      expect(LIVING_FRAGMENTS.middle.length).toBeGreaterThan(0);
      expect(LIVING_FRAGMENTS.closing.length).toBeGreaterThan(0);
      expect(LIVING_FRAGMENTS.response.length).toBeGreaterThan(0);
    });

    it('████████ fragment file exists and exports VOID_FRAGMENTS', () => {
      const { VOID_FRAGMENTS } = require('../../data/fragments/████████');
      expect(VOID_FRAGMENTS.opening.length).toBeGreaterThan(0);
      expect(VOID_FRAGMENTS.response.length).toBeGreaterThan(0);
    });
  });
});
