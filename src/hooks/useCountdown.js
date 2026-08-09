import { useEffect, useRef, useState } from 'react';

/**
 * Wall-clock countdown in whole seconds.
 *
 * Anchored to Date.now() rather than accumulated setTimeout ticks: chained
 * timeouts drift, and drift on a 20-second hold is the difference between the
 * finale landing and feeling broken.
 */
export default function useCountdown(seconds, { active = true } = {}) {
  const [remaining, setRemaining] = useState(seconds);
  const startedAt = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    if (startedAt.current === null) startedAt.current = Date.now();

    const tick = () => {
      const elapsed = (Date.now() - startedAt.current) / 1000;
      setRemaining(Math.max(0, Math.ceil(seconds - elapsed)));
    };

    const id = setInterval(tick, 250);
    tick();
    return () => clearInterval(id);
  }, [seconds, active]);

  return { remaining, expired: remaining <= 0 };
}
