// components/mod/CommunityBrowser.tsx
// DEA-89 — discover and install shared custom frequencies through the DEA-95
// community preset API. Installing is allowed for every player; playback of an
// installed frequency stays behind the Infinite Signal gate.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { BANDS, FRIEND_CODE_PATTERN, type Band } from '../../lib/constants';
import { colors, fonts, spacing } from '../../lib/theme';
import { getCommunityClient } from '../../lib/community/appClient';
import {
  customFrequencyShareText,
  presetHasCustomCall,
  presetToCustomFrequency,
} from '../../lib/community/frequencyPreset';
import type { Preset, PresetQueryInput } from '../../lib/community/schema';
import { useCustomFrequencyStore } from '../../store/useCustomFrequencyStore';
import { useFriendCodeStore } from '../../store/useFriendCodeStore';
import {
  customCallTypeLabel,
  getCustomFrequencyBandName,
  type CustomFrequency,
} from '../../engine/calls/CustomFrequency';

const CORE_BANDS = [0, 1, 2, 3, 4] as const;

export interface CommunityBrowserProps {
  communityEnabled: boolean;
  baseUrlConfigured: boolean;
}

export function CommunityBrowser({ communityEnabled, baseUrlConfigured }: CommunityBrowserProps) {
  const frequencies = useCustomFrequencyStore((s) => s.frequencies);
  const install = useCustomFrequencyStore((s) => s.install);
  const savedFriendCodes = useFriendCodeStore((s) => s.savedFriendCodes);

  const [query, setQuery] = useState('');
  const [band, setBand] = useState<Band | undefined>(undefined);
  const [friendCode, setFriendCode] = useState('');
  const [results, setResults] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'network' | 'cache' | 'empty' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const searchSequence = useRef(0);
  const activeSearch = useRef<PresetQueryInput | null>(null);

  const invalidateSearch = (): void => {
    searchSequence.current += 1;
    activeSearch.current = null;
    setNextCursor(null);
    setLoading(false);
  };

  const installedRemoteIds = new Set(
    frequencies
      .map((frequency) => frequency.remoteId)
      .filter((remoteId): remoteId is string => remoteId !== undefined),
  );

  const runSearch = useCallback(
    async (overrides?: { friendCode?: string; cursor?: string }) => {
      const sequence = ++searchSequence.current;
      if (!communityEnabled || !baseUrlConfigured) return;
      const cursor = overrides?.cursor;
      const normalizedFriendCode = (overrides?.friendCode ?? friendCode).trim().toUpperCase();
      if (
        !cursor &&
        normalizedFriendCode.length > 0 &&
        !FRIEND_CODE_PATTERN.test(normalizedFriendCode)
      ) {
        setMessage('FRIEND CODE MUST MATCH DA-XXXXX');
        setResults([]);
        setSource('empty');
        setNextCursor(null);
        activeSearch.current = null;
        setLoading(false);
        return;
      }
      const search: PresetQueryInput | null = cursor
        ? activeSearch.current
        : {
            ...(query.trim().length > 0 ? { q: query.trim() } : {}),
            ...(band !== undefined ? { band } : {}),
            ...(normalizedFriendCode.length > 0 ? { friendCode: normalizedFriendCode } : {}),
            limit: 20,
          };
      if (!search) return;
      activeSearch.current = search;
      if (!cursor) {
        setResults([]);
        setNextCursor(null);
      }
      setLoading(true);
      setMessage(null);
      try {
        const result = await getCommunityClient().listPresets({
          ...search,
          ...(cursor ? { cursor } : {}),
        });
        if (sequence !== searchSequence.current) return;
        setResults((previous) =>
          cursor
            ? [
                ...previous,
                ...result.presets.filter((item) => !previous.some((entry) => entry.id === item.id)),
              ]
            : result.presets,
        );
        if (result.source !== 'empty' || !cursor) setNextCursor(result.nextCursor);
        setSource(result.source);
        if (result.error !== undefined) setMessage(result.error.toUpperCase());
      } catch (error) {
        if (sequence !== searchSequence.current) return;
        if (!cursor) setResults([]);
        setSource('empty');
        setMessage(error instanceof Error ? error.message.toUpperCase() : 'COMMUNITY UNAVAILABLE');
      } finally {
        if (sequence === searchSequence.current) setLoading(false);
      }
    },
    [band, baseUrlConfigured, communityEnabled, friendCode, query],
  );

  useEffect(() => {
    void runSearch();
    return () => {
      searchSequence.current += 1;
    };
  }, []);

  const handleInstall = (preset: Preset): void => {
    const converted = presetToCustomFrequency(preset);
    if (!converted.ok || converted.frequency === undefined) {
      Alert.alert(
        'Cannot install',
        converted.issues.map((issue) => issue.message).join('\n') || 'Invalid frequency.',
      );
      return;
    }
    const result = install(converted.frequency);
    if (!result.ok) {
      Alert.alert('Cannot install', result.issues.map((issue) => issue.message).join('\n'));
      return;
    }
    Alert.alert('Installed', `${preset.name} is in your library (read-only).`);
  };

  const handleShareInstalled = async (frequency: CustomFrequency): Promise<void> => {
    await Clipboard.setStringAsync(customFrequencyShareText(frequency));
    Alert.alert('Copied', 'Frequency details copied to clipboard.');
  };

  if (!communityEnabled || !baseUrlConfigured) {
    return (
      <View style={styles.offlineCard}>
        <Text style={styles.offlineTitle}>COMMUNITY OFFLINE</Text>
        <Text style={styles.offlineText}>
          Browsing and sharing need the community feature flag and API URL. Local composition and
          the saved library keep working without them.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchCard}>
        <TextInput
          testID="community-search"
          style={styles.input}
          value={query}
          onChangeText={(value) => {
            invalidateSearch();
            setQuery(value);
          }}
          placeholder="Search frequencies"
          placeholderTextColor={colors.textMuted}
          maxLength={64}
          accessible
          accessibilityLabel="Search community frequencies"
        />
        <TextInput
          testID="community-friend-code"
          style={styles.input}
          value={friendCode}
          onChangeText={(value) => {
            invalidateSearch();
            setFriendCode(value.toUpperCase());
          }}
          placeholder="Friend code (DA-XXXXX)"
          placeholderTextColor={colors.textMuted}
          maxLength={8}
          autoCapitalize="characters"
          autoCorrect={false}
          accessible
          accessibilityLabel="Filter by friend code"
        />
        {savedFriendCodes.length > 0 && (
          <View style={styles.chipRow}>
            {savedFriendCodes.map((code) => (
              <Pressable
                key={code}
                testID={`community-saved-friend-${code}`}
                style={[styles.chip, friendCode === code && styles.chipSelected]}
                onPress={() => {
                  setFriendCode(code);
                  void runSearch({ friendCode: code });
                }}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Browse frequencies shared by ${code}`}
                accessibilityState={{ selected: friendCode === code }}
              >
                <Text style={[styles.chipText, friendCode === code && styles.chipTextSelected]}>
                  {code}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={styles.chipRow}>
          <Pressable
            testID="community-band-all"
            style={[styles.chip, band === undefined && styles.chipSelected]}
            onPress={() => {
              invalidateSearch();
              setBand(undefined);
            }}
            accessible
            accessibilityRole="button"
            accessibilityLabel="All bands"
            accessibilityState={{ selected: band === undefined }}
          >
            <Text style={[styles.chipText, band === undefined && styles.chipTextSelected]}>
              ALL
            </Text>
          </Pressable>
          {CORE_BANDS.map((index) => {
            const label = BANDS[index];
            if (label === undefined) return null;
            const selected = band === label;
            return (
              <Pressable
                key={label}
                testID={`community-band-${index}`}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => {
                  invalidateSearch();
                  setBand(label);
                }}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${label} band`}
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          testID="community-search-submit"
          style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
          onPress={() => void runSearch()}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Search community frequencies"
        >
          <Text style={styles.searchButtonText}>SEARCH</Text>
        </Pressable>
      </View>

      {loading && <ActivityIndicator color={colors.amber} />}
      {source === 'cache' && (
        <Text style={styles.sourceNote}>OFFLINE — SHOWING CACHED RESULTS</Text>
      )}
      {message !== null && <Text style={styles.errorNote}>{message}</Text>}

      {!loading && results.length === 0 && source !== null && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>NO FREQUENCIES FOUND</Text>
          <Text style={styles.emptyText}>
            Try a wider search, another band, or a friend&apos;s code.
          </Text>
        </View>
      )}

      <View style={styles.results}>
        {results.map((preset) => {
          const hasCall = presetHasCustomCall(preset);
          const installed = installedRemoteIds.has(preset.id);
          const composition = preset.payload.composition;
          const bandIndex = composition?.band;
          const bandLabel = bandIndex !== undefined ? getCustomFrequencyBandName(bandIndex) : null;

          return (
            <View key={preset.id} testID={`community-preset-${preset.id}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {preset.name}
                </Text>
                <Text style={styles.cardAuthor}>{preset.authorName.toUpperCase()}</Text>
              </View>
              <Text style={styles.cardMeta}>
                {bandLabel ?? preset.payload.band} · {preset.payload.frequency.toFixed(1)}
                {composition ? ` · ${customCallTypeLabel(composition.callType)}` : ' · TUNING ONLY'}
              </Text>
              {preset.friendCode ? (
                <Text style={styles.cardFriend}>FRIEND CODE {preset.friendCode}</Text>
              ) : null}
              {preset.description.length > 0 && (
                <Text style={styles.cardDescription} numberOfLines={3}>
                  {preset.description}
                </Text>
              )}
              <View style={styles.cardActions}>
                <Pressable
                  testID={`community-install-${preset.id}`}
                  style={({ pressed }) => [
                    styles.installButton,
                    (!hasCall || installed) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => handleInstall(preset)}
                  disabled={!hasCall || installed}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={
                    installed ? `${preset.name} is already installed` : `Install ${preset.name}`
                  }
                  accessibilityHint={hasCall ? undefined : 'This preset has no call composition'}
                >
                  <Text style={styles.installButtonText}>
                    {installed ? 'INSTALLED' : hasCall ? 'INSTALL' : 'NO CALL DATA'}
                  </Text>
                </Pressable>
                {installed && (
                  <Pressable
                    testID={`community-copy-${preset.id}`}
                    style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
                    onPress={() => {
                      const local = frequencies.find((entry) => entry.remoteId === preset.id);
                      if (local) void handleShareInstalled(local);
                    }}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={`Copy details for ${preset.name}`}
                  >
                    <Text style={styles.copyButtonText}>COPY</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </View>
      {nextCursor !== null && (
        <Pressable
          testID="community-load-more"
          style={styles.searchButton}
          disabled={loading}
          onPress={() => void runSearch({ cursor: nextCursor })}
          accessibilityRole="button"
          accessibilityLabel="Load more community frequencies"
        >
          <Text style={styles.searchButtonText}>LOAD MORE</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  searchCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipSelected: {
    borderColor: colors.amber,
    backgroundColor: colors.surfaceLight,
  },
  chipText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  chipTextSelected: {
    color: colors.amber,
  },
  searchButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.amber,
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  searchButtonText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.background,
    letterSpacing: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  sourceNote: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  errorNote: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.red,
    letterSpacing: 1,
  },
  results: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardName: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 15,
    color: colors.amber,
  },
  cardAuthor: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  cardMeta: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  cardFriend: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.green,
    letterSpacing: 1,
  },
  cardDescription: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  installButton: {
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  installButtonText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.amber,
    letterSpacing: 1,
  },
  copyButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  copyButtonText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text,
    letterSpacing: 1,
  },
  disabled: {
    opacity: 0.35,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: spacing.md,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  emptyText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
  offlineCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: spacing.md,
    gap: spacing.sm,
  },
  offlineTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  offlineText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
});
