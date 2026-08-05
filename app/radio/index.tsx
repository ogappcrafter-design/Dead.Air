import { View, StyleSheet } from "react-native";
import { colors } from "../../lib/theme";
import { RadioBody } from "../../components/radio/RadioBody";
import { ActiveCallDispatcher } from "@/components/calls/ActiveCallDispatcher";
import CRTView from "../../components/shared/CRTView";

export default function RadioScreen() {
  return (
    <CRTView intensity={0.3}>
      <View style={styles.container}>
        <RadioBody />
        <ActiveCallDispatcher />
      </View>
    </CRTView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
