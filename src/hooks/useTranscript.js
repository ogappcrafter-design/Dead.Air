import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Pacing for a transmission.
 *
 * Lines used to appear whole, on a fixed 2.4s interval, whatever they said —
 * so a two-word gut-punch sat on screen as long as a paragraph, and the player
 * read ahead of the caller. Here the line types out at reading speed and the
 * pause after it scales with its weight, which puts the player in the room at
 * the speed the caller is actually talking.
 *
 * The timing rules are a pure function so the feel can be tuned and tested
 * without waiting through a call.
 */

/** Characters per second. Brisk reading pace, not a teletype. */
export const DEFAULT_CPS = 46;

/** Repainting the line ~30 times a second looks continuous and costs little. */
const TICK_MS = 32;

const isBeat = (line) => String(line ?? '').trim() === '...';

/**
 * How long a line takes to type, and how long to sit on it afterwards.
 *
 * A beat is silence — nothing types, and it holds. Lines that trail off or
 * ask something hold longer, because that is where the dread lives.
 */
export function lineTiming(line, { cps = DEFAULT_CPS } = {}) {
  const text = String(line ?? '');

  if (isBeat(text)) return { typeMs: 0, holdMs: 1150 };

  const typeMs = Math.round((text.length / cps) * 1000);

  let holdMs = Math.min(1400, Math.max(380, Math.round(text.length * 8)));
  if (/\.\.\.["'”’]?$/.test(text.trim())) holdMs += 550; // trailing off
  else if (/[?]["'”’]?$/.test(text.trim())) holdMs += 320; // a question left hanging

  return { typeMs, holdMs };
}

/**
 * Drives one transmission.
 *
 * Returns the current line index, how much of it has been typed, and whether
 * the call has finished playing. `skip` finishes the current line, then jumps
 * the pause — an impatient player should be able to outrun the pacing without
 * having to leave.
 */
export default function useTranscript(lines, { cps = DEFAULT_CPS, active = true, settle = 900 } = {}) {
  const count = Array.isArray(lines) ? lines.length : 0;

  const [index, setIndex] = useState(0);
  const [chars, setChars] = useState(0);
  const [phase, setPhase] = useState('type'); // type → hold → done

  const indexRef = useRef(0);

  const advance = useCallback(() => {
    if (indexRef.current < count - 1) {
      indexRef.current += 1;
      setIndex(indexRef.current);
      setChars(0);
      setPhase('type');
    } else {
      setPhase('done');
    }
  }, [count]);

  // Typing.
  useEffect(() => {
    if (!active || phase !== 'type') return undefined;

    const text = String(lines?.[index] ?? '');
    const { typeMs } = lineTiming(text, { cps });

    if (typeMs === 0 || text.length === 0) {
      setChars(text.length);
      setPhase('hold');
      return undefined;
    }

    const perTick = Math.max(1, Math.round((text.length * TICK_MS) / typeMs));
    let shown = 0;
    const id = setInterval(() => {
      shown = Math.min(text.length, shown + perTick);
      setChars(shown);
      if (shown >= text.length) {
        clearInterval(id);
        setPhase('hold');
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [active, phase, index, lines, cps]);

  // The pause afterwards.
  useEffect(() => {
    if (!active || phase !== 'hold') return undefined;

    const text = String(lines?.[index] ?? '');
    const last = index >= count - 1;
    const { holdMs } = lineTiming(text, { cps });

    const id = setTimeout(() => (last ? setPhase('done') : advance()), last ? settle : holdMs);
    return () => clearTimeout(id);
  }, [active, phase, index, lines, cps, count, settle, advance]);

  const skip = useCallback(() => {
    if (phase === 'type') {
      setChars(String(lines?.[index] ?? '').length);
      setPhase('hold');
    } else if (phase === 'hold') {
      advance();
    }
  }, [phase, index, lines, advance]);

  return { index, chars, done: phase === 'done', typing: phase === 'type', skip };
}
