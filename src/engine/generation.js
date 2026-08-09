import { CALL_TYPES, isCallType } from '../content/callTypes';
import { SYM } from '../content/symbols';

/**
 * Infinite Signal — turning a proxy response into a call the game can play.
 *
 * Prompt construction and the API call live in proxy/ so the key never ships
 * in the client bundle. What stays here is the clamping: the proxy is a
 * network boundary, so nothing that crosses it is trusted. Pure, so it can be
 * tested without a network.
 */

const int = (v, fallback, min, max) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const num = (v, fallback, min, max) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const str = (v, fallback) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || fallback;
};

const FALLBACK_CHOICES = [
  { text: 'Understood.', outcome: 'The line goes dead.', sanityDelta: -5, staticMult: 1 },
  { text: 'No.', outcome: 'Silence.', sanityDelta: 0, staticMult: 1 },
  { text: 'Who is this?', outcome: 'Click.', sanityDelta: -5, staticMult: 1.5 },
];

/**
 * Clamp a parsed payload into a playable call. Anything missing or out of
 * range is replaced rather than rejected — a weird generation should still be
 * playable, never a crash mid-call.
 */
export function normalizeGeneratedCall(payload, band, now = Date.now()) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const type = isCallType(p.type) ? p.type : CALL_TYPES.JUST_LISTEN;

  const lines = Array.isArray(p.lines)
    ? p.lines.map((l) => String(l)).filter((l) => l.length > 0)
    : [];

  const call = {
    id: `gen_${now}_${Math.floor(Math.random() * 1e6)}`,
    band: band.id,
    generated: true,
    callerName: str(p.callerName, 'UNKNOWN'),
    callerId: str(p.callerId, '???-????'),
    signal: int(p.signal, 2, 0, 5),
    type,
    lines: lines.length ? lines : ['...'],
    staticReward: int(p.staticReward, 60, 10, 400),
    sanityDelta: int(p.sanityDelta, 0, -40, 40),
  };

  if (type === CALL_TYPES.DEAD_AIR) {
    call.waitSeconds = int(p.waitSeconds, 10, 5, 30);
  }

  if (type === CALL_TYPES.STAY_CALM) {
    call.duration = int(p.duration, 12, 6, 30);
    call.sanityPenalty = int(p.sanityPenalty, 18, 5, 40);
  }

  if (type === CALL_TYPES.RIGHT_ANSWER) {
    const raw = Array.isArray(p.choices) ? p.choices.filter((c) => c && typeof c === 'object') : [];
    const choices = raw.slice(0, 3).map((c) => ({
      text: str(c.text, '...'),
      outcome: str(c.outcome, 'The line goes dead.'),
      sanityDelta: int(c.sanityDelta, 0, -40, 40),
      staticMult: num(c.staticMult, 1, 0, 4),
      // Generated calls never award archive tapes; the archive is authored.
    }));
    call.choices = choices.length === 3 ? choices : FALLBACK_CHOICES.map((c) => ({ ...c }));
  }

  if (type === CALL_TYPES.SIGNAL_DECODE) {
    call.intro = str(p.intro, 'Decode the incoming sequence.');
    const seq = Array.isArray(p.sequence) ? p.sequence : [];
    call.sequence =
      seq.length === 5
        ? seq.map((n) => int(n, 0, 0, SYM.length - 1))
        : [0, 1, 2, 3, 4];
    call.decodedMessage = str(p.decodedMessage, 'SIGNAL RECEIVED').toUpperCase();
  }

  return call;
}
