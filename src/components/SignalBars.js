import React from 'react';
import { View } from 'react-native';

import { colors } from '../theme/theme';

/** Five-bar signal meter. `n` is 0–5. */
export default function SignalBars({ n = 0, color = colors.green }) {
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
            backgroundColor: i <= n ? color : colors.line,
          }}
        />
      ))}
    </View>
  );
}
