import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useReducedMotion } from '../motion';
import { colors } from '../theme/theme';

/**
 * Five-bar signal meter. `n` is 0–5.
 *
 * Pass `live` on an open line and the reading wavers by a bar now and then,
 * the way a real one does. It never wavers above the call's actual strength —
 * a weak signal has to keep looking weak.
 */
export default function SignalBars({ n = 0, color = colors.green, live = false }) {
  const [drop, setDrop] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!live || reduced || n === 0) return undefined;
    const id = setInterval(() => {
      // Mostly steady, occasionally down a bar, rarely down two.
      const roll = Math.random();
      setDrop(roll > 0.86 ? 2 : roll > 0.6 ? 1 : 0);
    }, 900);
    return () => clearInterval(id);
  }, [live, reduced, n]);

  const shown = Math.max(0, n - drop);

  return (
    <View
      accessibilityLabel={`Signal strength ${n} of 5`}
      style={{ flexDirection: 'row', alignItems: 'flex-end', height: 20, gap: 3 }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={{
            width: 5,
            height: 4 + i * 3,
            borderRadius: 1,
            backgroundColor: i <= shown ? color : colors.line,
          }}
        />
      ))}
    </View>
  );
}
