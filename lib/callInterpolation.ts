// lib/callInterpolation.ts
// Runtime call interpolation system.
// Interpolates player identity (name, call sign, station name) into call lines
// at runtime WITHOUT modifying the sacred data/calls.js file.
//
// Design: rule-based per-call-id. Each rule specifies which lines to insert
// or replace after, keyed by call id. This keeps the interpolation declarative
// and extensible — new calls just add a new rule entry.

export interface InterpolationContext {
  playerName: string;
  djCallSign: string;
  stationName: string;
}

/** A single interpolation rule for one call. */
interface InterpolationRule {
  /** Call id this rule applies to. */
  callId: number;
  /**
   * Transform the call's lines array and return a new array with
   * interpolations applied. Must not mutate the input.
   */
  transform: (lines: string[], ctx: InterpolationContext) => string[];
}

/**
 * Rule for ORIGIN call (#15): After the line "Your name." insert the player's
 * actual name as a new line. This preserves the dramatic structure — the voice
 * says "He says your name." / "Not your username." / "Your name." and then the
 * actual name appears, grounding the player in the fiction.
 */
const originRule: InterpolationRule = {
  callId: 15,
  transform: (lines, ctx) => {
    if (!ctx.playerName) return lines;
    const anchor = 'Your name.';
    const idx = lines.indexOf(anchor);
    if (idx === -1) return lines;
    // Insert the player's name after "Your name." as a whispered revelation
    const result = [...lines];
    result.splice(idx + 1, 0, ctx.playerName);
    return result;
  },
};

/**
 * Rule for DEAD AIR meta-ending call (#17): If the station name is set, insert
 * it into the broadcast sequence so the final transmission feels personal.
 */
const deadAirRule: InterpolationRule = {
  callId: 17,
  transform: (lines, ctx) => {
    if (!ctx.stationName) return lines;
    const anchor = 'The station goes dark.';
    const idx = lines.indexOf(anchor);
    if (idx === -1) return lines;
    // Insert station name after the opening line for personal resonance
    const result = [...lines];
    result.splice(idx + 1, 0, `${ctx.stationName} falls silent.`);
    return result;
  },
};

/** All interpolation rules, keyed by call id for O(1) lookup. */
const RULES: Map<number, InterpolationRule> = new Map([
  [originRule.callId, originRule],
  [deadAirRule.callId, deadAirRule],
]);

/**
 * Apply interpolation rules to a call's lines array.
 * Returns a new array — never mutates the original.
 * If no rule exists for the call id, returns lines unchanged.
 */
export function interpolateCallLines(
  callId: number,
  lines: string[],
  ctx: InterpolationContext,
): string[] {
  const rule = RULES.get(callId);
  if (!rule) return lines;
  return rule.transform(lines, ctx);
}

/**
 * Register a custom interpolation rule at runtime.
 * Useful for procedural calls or extensions.
 */
export function registerInterpolationRule(rule: InterpolationRule): void {
  RULES.set(rule.callId, rule);
}
