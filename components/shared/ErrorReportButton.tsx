import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import { reportBug, isSentryEnabled } from '../../lib/errorTracking';

export function ErrorReportButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const handleSubmit = () => {
    const message = text.trim() || 'User-reported bug (no description)';
    reportBug(message, { source: 'manual-report' });
    setText('');
    setOpen(false);
    Alert.alert(
      'Report Sent',
      isSentryEnabled()
        ? 'Thank you. Your report was sent to the developers.'
        : 'Reporting is disabled in this build.',
    );
  };

  if (!open) {
    return (
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText}>REPORT A BUG</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Describe the issue:</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="What happened?"
        placeholderTextColor={colors.textMuted}
        multiline
      />
      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancel} onPress={() => setOpen(false)}>
          <Text style={styles.cancelText}>CANCEL</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.submit} onPress={handleSubmit}>
          <Text style={styles.submitText}>SEND</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  triggerText: {
    color: colors.amber,
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  form: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  label: {
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  input: {
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: 14,
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  cancel: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cancelText: {
    color: colors.textMuted,
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 1,
  },
  submit: {
    backgroundColor: colors.amber,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  submitText: {
    color: colors.background,
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

export default ErrorReportButton;
