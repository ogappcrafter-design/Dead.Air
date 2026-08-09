/**
 * The five ways a transmission can play out. Each maps to a player component
 * in src/calls/, and to a set of extra fields on the call object:
 *
 *   JUST_LISTEN    lines only — the call plays itself out
 *   DEAD_AIR       lines + waitSeconds — hold the line while nothing happens
 *   RIGHT_ANSWER   lines + choices[] — what you say changes the outcome
 *   SIGNAL_DECODE  intro + sequence[] + decodedMessage — tap the glyphs back
 *   STAY_CALM      lines + duration + sanityPenalty — keep your nerve
 */
export const CALL_TYPES = Object.freeze({
  JUST_LISTEN: 'JUST_LISTEN',
  DEAD_AIR: 'DEAD_AIR',
  RIGHT_ANSWER: 'RIGHT_ANSWER',
  SIGNAL_DECODE: 'SIGNAL_DECODE',
  STAY_CALM: 'STAY_CALM',
});

export const CALL_TYPE_LIST = Object.values(CALL_TYPES);

export const isCallType = (t) => CALL_TYPE_LIST.includes(t);

/** Human label for the call cards on the dial. */
export const callTypeLabel = (t) => String(t || '').replace(/_/g, ' ');
