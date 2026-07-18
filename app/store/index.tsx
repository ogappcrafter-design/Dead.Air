import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';

export default function StoreScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>STORE</Text>
      <Text style={styles.placeholder}>Coming in Phase 5</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.amber,
    marginBottom: spacing.md,
  },
  placeholder: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textMuted,
  },
});
