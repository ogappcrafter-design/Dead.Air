import { useEffect, useState } from 'react';

/**
 * Reveal a transmission one line at a time.
 *
 * Returns the index of the newest visible line and whether the last one has
 * been up long enough to hand control back to the player. v1 reimplemented
 * this in JustListen, DeadAir and RightAnswer with three different intervals
 * and three subtly different settle delays.
 */
export default function useLineReveal(lineCount, { interval = 2400, settle = 1800, active = true } = {}) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) return undefined;

    if (index < lineCount - 1) {
      const t = setTimeout(() => setIndex((i) => i + 1), interval);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => setDone(true), settle);
    return () => clearTimeout(t);
  }, [index, lineCount, interval, settle, active]);

  return { index, done };
}
