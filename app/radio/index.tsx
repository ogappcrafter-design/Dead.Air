import { View, StyleSheet } from 'react-native';
import { colors } from '../../lib/theme';
import { RadioBody } from '../../components/radio/RadioBody';
import CRTView from '../../components/shared/CRTView';

export default function RadioScreen() {
  return (
    <CRTView intensity={0.3}>
      <View style={styles.container}>
        <RadioBody />
      </View>
    </CRTView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
