import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, spacing } from '../../lib/theme';
import { useFriendCodeStore } from '../../store/useFriendCodeStore';

export function FriendCodeManager() {
  const myFriendCode = useFriendCodeStore((s) => s.myFriendCode);
  const savedFriendCodes = useFriendCodeStore((s) => s.savedFriendCodes);
  const addFriendCode = useFriendCodeStore((s) => s.addFriendCode);
  const removeFriendCode = useFriendCodeStore((s) => s.removeFriendCode);
  const regenerateMyCode = useFriendCodeStore((s) => s.regenerateMyCode);

  const [input, setInput] = useState('');

  const handleCopy = async () => {
    if (myFriendCode) {
      await Clipboard.setStringAsync(myFriendCode);
      Alert.alert('Copied', 'Friend code copied to clipboard');
    }
  };

  const handleAdd = () => {
    if (!input.trim()) return;
    const success = addFriendCode(input);
    if (success) {
      setInput('');
    } else {
      Alert.alert('Invalid', 'Invalid or duplicate friend code');
    }
  };

  const handleRemove = (code: string) => {
    removeFriendCode(code);
  };

  const handleShare = async () => {
    if (myFriendCode) {
      await Clipboard.setStringAsync(myFriendCode);
      Alert.alert('Copied', 'Friend code copied to clipboard — share it with friends!');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.myCodeSection}>
        <Text style={styles.label}>YOUR FRIEND CODE</Text>
        <View style={styles.codeRow}>
          <Text style={styles.myCode}>{myFriendCode || '—'}</Text>
          <Pressable style={styles.copyButton} onPress={handleCopy}>
            <Text style={styles.copyButtonText}>COPY</Text>
          </Pressable>
          <Pressable style={styles.copyButton} onPress={handleShare}>
            <Text style={styles.copyButtonText}>SHARE</Text>
          </Pressable>
        </View>
        <Pressable style={styles.regenerateButton} onPress={regenerateMyCode}>
          <Text style={styles.regenerateButtonText}>GENERATE NEW CODE</Text>
        </Pressable>
      </View>

      <View style={styles.addSection}>
        <Text style={styles.label}>ADD FRIEND CODE</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="DA-XXXXX"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
          />
          <Pressable style={styles.addButton} onPress={handleAdd}>
            <Text style={styles.addButtonText}>ADD</Text>
          </Pressable>
        </View>
      </View>

      {savedFriendCodes.length > 0 && (
        <View style={styles.listSection}>
          <Text style={styles.label}>SAVED FRIEND CODES</Text>
          <ScrollView style={styles.list}>
            {savedFriendCodes.map((code) => (
              <View key={code} style={styles.savedRow}>
                <Text style={styles.savedCode}>{code}</Text>
                <Pressable style={styles.removeButton} onPress={() => handleRemove(code)}>
                  <Text style={styles.removeButtonText}>REMOVE</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  myCodeSection: {
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 3,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  myCode: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.amber,
    letterSpacing: 3,
    flex: 1,
  },
  copyButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  copyButtonText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.green,
    letterSpacing: 2,
  },
  regenerateButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  regenerateButtonText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  addSection: {
    gap: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 2,
  },
  addButton: {
    backgroundColor: colors.amber,
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  addButtonText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.background,
    letterSpacing: 2,
  },
  listSection: {
    gap: spacing.sm,
  },
  list: {
    maxHeight: 200,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  savedCode: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 2,
  },
  removeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  removeButtonText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.red,
    letterSpacing: 2,
  },
});
