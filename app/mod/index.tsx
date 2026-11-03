// app/mod/index.tsx
// DEA-89 — Frequency Forge: the player-facing call builder.
//
// One flow: compose a call from existing fragments, tune the band's supported
// difficulty parameters, preview, save locally, play, and share / install /
// discover custom frequencies through the DEA-95 community preset API.
//
// The Infinite Signal boundary is carried through every path: composition,
// local playback, preview playback, and publishing require ownership; any
// player may install a shared frequency read-only.

import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, spacing } from '../../lib/theme';
import { useGameStore } from '../../store/useGameStore';
import { useStoreStore } from '../../store/useStoreStore';
import { useFriendCodeStore } from '../../store/useFriendCodeStore';
import { useCustomFrequencyStore } from '../../store/useCustomFrequencyStore';
import { ActiveCallDispatcher } from '../../components/calls/ActiveCallDispatcher';
import { CommunityBrowser } from '../../components/mod/CommunityBrowser';
import { FrequencyBuilder } from '../../components/mod/FrequencyBuilder';
import { FrequencyLibrary } from '../../components/mod/FrequencyLibrary';
import {
  callManager,
  clearCustomFrequencyCalls,
  registerCustomFrequencyCall,
} from '../../engine/calls/callManagerInstance';
import {
  getCustomFrequencyBandName,
  type CustomFrequency,
} from '../../engine/calls/CustomFrequency';
import { getCommunityClient } from '../../lib/community/appClient';
import { isCommunityEnabled } from '../../lib/community/featureFlag';
import { resolveCommunityBaseUrl } from '../../lib/community/client';
import { getInfiniteSignalPublishingProof } from '../../lib/iap';
import {
  customFrequencyShareText,
  customFrequencyToPresetInput,
} from '../../lib/community/frequencyPreset';

type Tab = 'build' | 'library' | 'browse';

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message;
  return 'The request failed. Try again.';
}

export default function FrequencyForgeScreen() {
  const hasInfiniteSignal = useStoreStore((s) => s.hasInfiniteSignal);
  const unlockedBands = useGameStore((s) => s.unlockedBands);
  const myFriendCode = useFriendCodeStore((s) => s.myFriendCode);
  const frequencies = useCustomFrequencyStore((s) => s.frequencies);
  const removeFrequency = useCustomFrequencyStore((s) => s.remove);
  const saveLocal = useCustomFrequencyStore((s) => s.saveLocal);

  const communityEnabled = isCommunityEnabled();
  const baseUrlConfigured = resolveCommunityBaseUrl().length > 0;

  const [tab, setTab] = useState<Tab>(hasInfiniteSignal ? 'build' : 'library');
  const [editing, setEditing] = useState<CustomFrequency | undefined>(undefined);
  const [publishing, setPublishing] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const publishingRef = useRef(false);
  const ownedCallId = useRef<number | null>(null);

  // Any active call takes over the whole screen; the forge returns when the
  // CallManager is idle again.
  useEffect(() => {
    return callManager.subscribe((state) => setCallActive(state !== 'idle'));
  }, []);

  // Leaving the forge must not leave a custom call registered or half-played.
  useEffect(() => {
    return () => {
      if (
        ownedCallId.current !== null &&
        callManager.getCurrentCall()?.call.id === ownedCallId.current
      ) {
        callManager.reset();
      }
      clearCustomFrequencyCalls();
    };
  }, []);

  useEffect(() => {
    if (!hasInfiniteSignal && tab === 'build') setTab('library');
  }, [hasInfiniteSignal, tab]);

  const handlePlay = (frequency: CustomFrequency): void => {
    if (!hasInfiniteSignal) {
      Alert.alert('Infinite Signal required', 'Custom frequencies are owner-only content.');
      return;
    }
    const bandName = getCustomFrequencyBandName(frequency.composition.band);
    if (bandName === null || !unlockedBands.includes(bandName)) {
      Alert.alert('Band locked', 'Unlock this band before playing a frequency on it.');
      return;
    }
    if (callManager.getCallState() !== 'idle') {
      Alert.alert('Line busy', 'Finish the current call before tuning a custom frequency.');
      return;
    }

    const slot = frequencies.findIndex((entry) => entry.id === frequency.id);
    const call = registerCustomFrequencyCall(frequency, slot >= 0 ? slot : 0);
    if (call === null) {
      Alert.alert('Cannot play', 'This frequency could not be registered.');
      return;
    }
    ownedCallId.current = call.id;
    if (!callManager.startCall(call.id)) {
      ownedCallId.current = null;
      Alert.alert('Cannot play', 'Playback was refused. Infinite Signal is required.');
    }
  };

  const handlePublish = async (
    frequency: CustomFrequency,
  ): Promise<CustomFrequency | undefined> => {
    if (publishingRef.current) return undefined;
    if (!hasInfiniteSignal) {
      Alert.alert('Infinite Signal required', 'Custom frequencies are owner-only content.');
      return undefined;
    }
    if (!communityEnabled || !baseUrlConfigured) {
      Alert.alert('Community offline', 'Sharing needs the community feature flag and API URL.');
      return undefined;
    }

    publishingRef.current = true;
    setPublishing(true);
    try {
      const saved = saveLocal(frequency);
      if (!saved.ok || !saved.frequency) {
        Alert.alert('Cannot publish', saved.issues.map((issue) => issue.message).join('\n'));
        return;
      }
      const current = saved.frequency;
      const client = getCommunityClient();
      if (!(await client.hasDeviceToken())) {
        await client.registerDevice();
      }
      // Friend codes are generated lazily; make sure a published frequency
      // always carries one so friends can discover it by code.
      let friendCode = myFriendCode;
      if (!friendCode) {
        useFriendCodeStore.getState().regenerateMyCode();
        friendCode = useFriendCodeStore.getState().myFriendCode;
      }
      const entitlementProof = await getInfiniteSignalPublishingProof();
      const input = {
        ...customFrequencyToPresetInput(current, friendCode || undefined),
        entitlementProof,
      };
      const preset = current.remoteId
        ? await client.updatePreset(current.remoteId, input)
        : await client.createPreset(input);

      const result = saveLocal({
        ...(useCustomFrequencyStore
          .getState()
          .frequencies.find((entry) => entry.id === current.id) ?? current),
        remoteId: preset.id,
        friendCode: preset.friendCode ?? current.friendCode,
      });
      if (!result.ok) {
        Alert.alert(
          'Published, but not linked locally',
          result.issues.map((issue) => issue.message).join('\n'),
        );
        return undefined;
      }
      Alert.alert('Published', `Community ID: ${preset.id}`);
      return result.frequency;
    } catch (error) {
      Alert.alert('Publish failed', errorMessage(error));
      return undefined;
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  };

  const handleShare = async (frequency: CustomFrequency): Promise<void> => {
    await Clipboard.setStringAsync(customFrequencyShareText(frequency));
    Alert.alert(
      'Copied',
      frequency.remoteId
        ? 'Frequency details and community ID copied.'
        : 'Frequency details copied. Publish it to share a playable copy.',
    );
  };

  const handleDelete = (frequency: CustomFrequency): void => {
    Alert.alert('Delete frequency?', `"${frequency.name}" will be removed from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => removeFrequency(frequency.id),
      },
    ]);
  };

  const tabs: Array<{ id: Tab; label: string; visible: boolean }> = [
    { id: 'build', label: 'BUILD', visible: hasInfiniteSignal },
    { id: 'library', label: 'LIBRARY', visible: true },
    { id: 'browse', label: 'BROWSE', visible: true },
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          testID="forge-back"
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => router.back()}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Back to radio"
        >
          <Text style={styles.backText}>‹ BACK</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          FREQUENCY FORGE
        </Text>
      </View>

      {!hasInfiniteSignal && (
        <View style={styles.lockedBanner}>
          <Text style={styles.lockedTitle}>INFINITE SIGNAL REQUIRED</Text>
          <Text style={styles.lockedText}>
            You can browse and install shared frequencies read-only. Composing, publishing, and
            playing custom calls unlock with Infinite Signal.
          </Text>
        </View>
      )}

      <View style={styles.tabBar} accessibilityRole="tablist">
        {tabs
          .filter((entry) => entry.visible)
          .map((entry) => {
            const selected = tab === entry.id;
            return (
              <Pressable
                key={entry.id}
                testID={`forge-tab-${entry.id}`}
                style={({ pressed }) => [
                  styles.tab,
                  selected && styles.tabSelected,
                  pressed && styles.pressed,
                ]}
                onPress={() => setTab(entry.id)}
                accessible
                accessibilityRole="tab"
                accessibilityLabel={`${entry.label} tab`}
                accessibilityState={{ selected }}
              >
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
                  {entry.label}
                </Text>
              </Pressable>
            );
          })}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {tab === 'build' && hasInfiniteSignal && (
          <FrequencyBuilder
            key={editing?.id ?? 'new'}
            initial={editing}
            unlockedBands={unlockedBands}
            hasInfiniteSignal={hasInfiniteSignal}
            communityEnabled={communityEnabled && baseUrlConfigured}
            friendCode={myFriendCode}
            publishing={publishing}
            onSaved={(frequency) => {
              setEditing(undefined);
              setTab('library');
              Alert.alert('Saved', `"${frequency.name}" is in your library.`);
            }}
            onPlay={handlePlay}
            onPublish={handlePublish}
          />
        )}

        {tab === 'library' && (
          <FrequencyLibrary
            frequencies={frequencies}
            hasInfiniteSignal={hasInfiniteSignal}
            unlockedBands={unlockedBands}
            communityEnabled={communityEnabled && baseUrlConfigured}
            publishing={publishing}
            onPlay={handlePlay}
            onEdit={(frequency) => {
              if (!hasInfiniteSignal) {
                Alert.alert('Infinite Signal required', 'Editing is owner-only.');
                return;
              }
              setEditing(frequency);
              setTab('build');
            }}
            onDelete={handleDelete}
            onShare={(frequency) => void handleShare(frequency)}
            onPublish={(frequency) => void handlePublish(frequency)}
          />
        )}

        {tab === 'browse' && (
          <CommunityBrowser
            communityEnabled={communityEnabled}
            baseUrlConfigured={baseUrlConfigured}
          />
        )}
      </ScrollView>

      {callActive && (
        <View style={styles.callOverlay}>
          <ActiveCallDispatcher />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  backText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.amber,
    letterSpacing: 1,
  },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.amber,
    letterSpacing: 3,
    textAlign: 'right',
  },
  lockedBanner: {
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 4,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  lockedTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.red,
    letterSpacing: 2,
  },
  lockedText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text,
  },
  tabBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  tabSelected: {
    borderColor: colors.amber,
    backgroundColor: colors.surface,
  },
  tabText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  tabTextSelected: {
    color: colors.amber,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  callOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
  },
  pressed: {
    opacity: 0.7,
  },
});
