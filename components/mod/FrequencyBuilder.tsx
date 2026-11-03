// components/mod/FrequencyBuilder.tsx
// DEA-89 — compose a call from existing fragments, tune the band's supported
// difficulty parameters, preview it, save it locally, play it, and publish it
// to the community preset API.
//
// The builder is deliberately closed-form: every line comes from a band
// fragment library and every tuned value is clamped to that band's existing
// variation range. No free-form call text is accepted.

import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import { BANDS as BAND_DATA } from '../../data/bands';
import {
  CUSTOM_FREQUENCY_MAX_CHOICES,
  CUSTOM_FREQUENCY_MAX_MIDDLE_LINES,
  CUSTOM_FREQUENCY_MIN_CHOICES,
  createCustomFrequencyDraft,
  customCallTypeLabel,
  getCustomCallTypesForBand,
  getCustomFrequencyBandName,
  getCustomFrequencyLibrary,
  getCustomFrequencyVariation,
  previewCustomFrequencyLines,
  validateCustomFrequency,
  type CustomCallType,
  type CustomFrequency,
  type CustomFrequencyIssue,
} from '../../engine/calls/CustomFrequency';
import { useCustomFrequencyStore } from '../../store/useCustomFrequencyStore';
import { FragmentPicker } from './FragmentPicker';
import { Stepper } from './Stepper';

export interface FrequencyBuilderProps {
  initial?: CustomFrequency;
  unlockedBands: readonly string[];
  hasInfiniteSignal: boolean;
  communityEnabled: boolean;
  /** The player's own friend code, attached when publishing. */
  friendCode?: string;
  publishing?: boolean;
  onSaved: (frequency: CustomFrequency) => void;
  onPlay: (frequency: CustomFrequency) => void;
  onPublish: (frequency: CustomFrequency) => Promise<CustomFrequency | undefined> | void;
}

function makeLocalId(): string {
  return `local:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export function FrequencyBuilder({
  initial,
  unlockedBands,
  hasInfiniteSignal,
  communityEnabled,
  friendCode,
  publishing = false,
  onSaved,
  onPlay,
  onPublish,
}: FrequencyBuilderProps) {
  const saveLocal = useCustomFrequencyStore((s) => s.saveLocal);
  const [draft, setDraft] = useState<CustomFrequency>(
    () =>
      initial ??
      createCustomFrequencyDraft(0, {
        id: makeLocalId(),
        name: 'Untitled Frequency',
        createdAt: Date.now(),
      })!,
  );
  const [showIssues, setShowIssues] = useState(false);
  const [saveIssues, setSaveIssues] = useState<CustomFrequencyIssue[]>([]);

  const composition = draft.composition;
  const library = getCustomFrequencyLibrary(composition.band);
  const variation = getCustomFrequencyVariation(composition.band);
  const bandName = getCustomFrequencyBandName(composition.band);
  const bandInfo = bandName ? BAND_DATA[bandName] : undefined;
  const callTypes = getCustomCallTypesForBand(composition.band);
  const bandUnlocked = bandName !== null && unlockedBands.includes(bandName);

  const validation = useMemo(() => validateCustomFrequency(draft), [draft]);
  const previewLines = useMemo(() => previewCustomFrequencyLines(draft), [draft]);
  const previewChoices = useMemo(() => {
    if (composition.callType !== 'RIGHT_ANSWER' || library === null) return [];
    return (composition.choiceIndices ?? [])
      .map((index) => library.responses[index])
      .filter((response) => response !== undefined);
  }, [composition.callType, composition.choiceIndices, library]);

  if (library === null || variation === null || bandInfo === undefined || bandName === null) {
    return (
      <Text style={styles.empty}>This band has no fragment library available for the forge.</Text>
    );
  }

  const patch = (partial: Partial<CustomFrequency>): void => {
    setDraft((current) => ({ ...current, ...partial }));
  };
  const patchComposition = (partial: Partial<CustomFrequency['composition']>): void => {
    setDraft((current) => ({
      ...current,
      composition: { ...current.composition, ...partial },
    }));
  };

  const changeBand = (band: number): void => {
    const next = createCustomFrequencyDraft(band, {
      id: draft.id,
      name: draft.name,
      description: draft.description,
      origin: draft.origin,
      remoteId: draft.remoteId,
      friendCode: draft.friendCode,
      authorName: draft.authorName,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    });
    if (next !== null) setDraft(next);
  };

  const changeCallType = (callType: CustomCallType): void => {
    patchComposition({
      callType,
      choiceIndices:
        callType === 'RIGHT_ANSWER' ? (composition.choiceIndices ?? [0, 1]) : undefined,
    });
  };

  const addMiddle = (): void => {
    if (composition.middleIndices.length >= CUSTOM_FREQUENCY_MAX_MIDDLE_LINES) return;
    const used = new Set(composition.middleIndices);
    if (used.size >= library.middles.length) return;
    let next = 0;
    while (used.has(next)) next += 1;
    patchComposition({ middleIndices: [...composition.middleIndices, next] });
  };

  const removeMiddle = (position: number): void => {
    if (composition.middleIndices.length <= 1) return;
    patchComposition({
      middleIndices: composition.middleIndices.filter((_, index) => index !== position),
    });
  };

  const toggleChoice = (index: number): void => {
    const selected = composition.choiceIndices ?? [];
    if (selected.includes(index)) {
      if (selected.length <= CUSTOM_FREQUENCY_MIN_CHOICES) return;
      patchComposition({ choiceIndices: selected.filter((value) => value !== index) });
      return;
    }
    if (selected.length >= CUSTOM_FREQUENCY_MAX_CHOICES) return;
    patchComposition({ choiceIndices: [...selected, index] });
  };

  const handleSave = (): void => {
    const result = saveLocal(draft);
    setSaveIssues(result.issues);
    if (result.ok && result.frequency) {
      setShowIssues(false);
      setDraft(result.frequency);
      onSaved(result.frequency);
    } else {
      setShowIssues(true);
    }
  };

  const handlePlay = (): void => {
    if (!validation.ok) {
      setShowIssues(true);
      return;
    }
    onPlay(draft);
  };

  const handlePublish = async (): Promise<void> => {
    if (!validation.ok) {
      setShowIssues(true);
      return;
    }
    const published = await onPublish(draft);
    if (published) {
      setDraft((current) => ({
        ...current,
        remoteId: published.remoteId,
        friendCode: published.friendCode,
      }));
    }
  };

  const playBlockedReason = !hasInfiniteSignal
    ? 'Infinite Signal required'
    : !bandUnlocked
      ? `${bandName} band locked`
      : null;
  const visibleIssues: CustomFrequencyIssue[] = showIssues
    ? validation.issues.length > 0
      ? validation.issues
      : saveIssues
    : [];

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>IDENTITY</Text>
        <TextInput
          testID="forge-name"
          style={styles.input}
          value={draft.name}
          onChangeText={(name) => patch({ name })}
          placeholder="Frequency name"
          placeholderTextColor={colors.textMuted}
          maxLength={60}
          autoCapitalize="words"
          accessible
          accessibilityLabel="Frequency name"
        />
        <TextInput
          testID="forge-description"
          style={[styles.input, styles.multiline]}
          value={draft.description ?? ''}
          onChangeText={(description) => patch({ description })}
          placeholder="Optional transmission notes"
          placeholderTextColor={colors.textMuted}
          maxLength={500}
          multiline
          accessible
          accessibilityLabel="Frequency description"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>BAND</Text>
        <View style={styles.chipRow}>
          {[0, 1, 2, 3, 4].map((band) => {
            const label = getCustomFrequencyBandName(band);
            if (label === null) return null;
            const selected = band === composition.band;
            const unlocked = unlockedBands.includes(label);
            return (
              <Pressable
                key={band}
                testID={`forge-band-${band}`}
                style={({ pressed }) => [
                  styles.chip,
                  selected && styles.chipSelected,
                  !unlocked && styles.chipDisabled,
                  pressed && styles.chipPressed,
                ]}
                onPress={() => unlocked && changeBand(band)}
                disabled={!unlocked}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${label} band${unlocked ? '' : ', locked'}`}
                accessibilityState={{ selected, disabled: !unlocked }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {label}
                  {unlocked ? '' : ' ⛔'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Stepper
          testID="forge-frequency"
          label="DIAL FREQUENCY"
          value={draft.frequency}
          min={bandInfo.frequencyRange[0]}
          max={bandInfo.frequencyRange[1]}
          step={0.5}
          onChange={(frequency) => patch({ frequency })}
          formatValue={(value) => value.toFixed(1)}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>CALL TYPE</Text>
        <View style={styles.chipRow}>
          {callTypes.map((callType) => {
            const selected = callType === composition.callType;
            return (
              <Pressable
                key={callType}
                testID={`forge-type-${callType}`}
                style={({ pressed }) => [
                  styles.chip,
                  selected && styles.chipSelected,
                  pressed && styles.chipPressed,
                ]}
                onPress={() => changeCallType(callType)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={customCallTypeLabel(callType)}
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {customCallTypeLabel(callType)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>FRAGMENTS</Text>
        <FragmentPicker
          testID="forge-opening"
          label="OPENING"
          fragments={library.openings}
          index={composition.openingIndex}
          onChange={(openingIndex) => patchComposition({ openingIndex })}
        />

        <Text style={styles.subLabel}>MIDDLES ({composition.middleIndices.length}/3)</Text>
        {composition.middleIndices.map((middleIndex, position) => (
          <View key={`middle-${position}`} style={styles.middleRow}>
            <View style={styles.middlePicker}>
              <FragmentPicker
                testID={`forge-middle-${position}`}
                label={`MIDDLE ${position + 1}`}
                fragments={library.middles}
                index={middleIndex}
                onChange={(index) =>
                  patchComposition({
                    middleIndices: composition.middleIndices.map((value, slot) =>
                      slot === position ? index : value,
                    ),
                  })
                }
              />
            </View>
            {composition.middleIndices.length > 1 && (
              <Pressable
                testID={`forge-middle-${position}-remove`}
                style={styles.removeButton}
                onPress={() => removeMiddle(position)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Remove middle line ${position + 1}`}
              >
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            )}
          </View>
        ))}
        {composition.middleIndices.length < CUSTOM_FREQUENCY_MAX_MIDDLE_LINES && (
          <Pressable
            testID="forge-middle-add"
            style={styles.secondaryButton}
            onPress={addMiddle}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Add a middle line"
          >
            <Text style={styles.secondaryButtonText}>+ ADD MIDDLE</Text>
          </Pressable>
        )}

        <FragmentPicker
          testID="forge-closing"
          label="CLOSING"
          fragments={library.closings}
          index={composition.closingIndex}
          onChange={(closingIndex) => patchComposition({ closingIndex })}
        />
      </View>

      {composition.callType === 'RIGHT_ANSWER' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            RESPONSES ({composition.choiceIndices?.length ?? 0}/{CUSTOM_FREQUENCY_MAX_CHOICES})
          </Text>
          <Text style={styles.hint}>Choose 2 to 4 responses. Their outcomes are authored.</Text>
          {library.responses.map((response, index) => {
            const selected = (composition.choiceIndices ?? []).includes(index);
            return (
              <Pressable
                key={`response-${index}`}
                testID={`forge-choice-${index}`}
                style={({ pressed }) => [
                  styles.choiceRow,
                  selected && styles.choiceRowSelected,
                  pressed && styles.chipPressed,
                ]}
                onPress={() => toggleChoice(index)}
                accessible
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={response.text}
              >
                <Text style={styles.choiceMark}>{selected ? '▣' : '▢'}</Text>
                <Text style={styles.choiceText} numberOfLines={2}>
                  {response.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>DIFFICULTY</Text>
        <Text style={styles.hint}>Values are clamped to {bandName}&apos;s authored range.</Text>
        {composition.callType !== 'RIGHT_ANSWER' && (
          <Stepper
            testID="forge-sanity"
            label="SANITY DELTA"
            value={draft.difficulty.sanityDelta}
            min={variation.sanityDeltaRange[0]}
            max={variation.sanityDeltaRange[1]}
            onChange={(sanityDelta) => patch({ difficulty: { ...draft.difficulty, sanityDelta } })}
          />
        )}
        <Stepper
          testID="forge-static"
          label="STATIC REWARD"
          value={draft.difficulty.staticReward}
          min={variation.staticRewardRange[0]}
          max={variation.staticRewardRange[1]}
          onChange={(staticReward) => patch({ difficulty: { ...draft.difficulty, staticReward } })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>PREVIEW</Text>
        {previewLines.map((line, index) => (
          <Text key={`preview-${index}`} style={styles.previewLine}>
            {line}
          </Text>
        ))}
        {previewChoices.length > 0 && (
          <View style={styles.previewChoices}>
            {previewChoices.map((choice, index) => (
              <Text key={`preview-choice-${index}`} style={styles.previewChoice}>
                ▸ {choice.text}
              </Text>
            ))}
          </View>
        )}
      </View>

      {visibleIssues.length > 0 && (
        <View style={styles.issues}>
          <Text style={styles.issuesTitle}>CANNOT SAVE</Text>
          {visibleIssues.map((issue) => (
            <Text key={`${issue.path}-${issue.message}`} style={styles.issueText}>
              {issue.message}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          testID="forge-save"
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          onPress={handleSave}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Save frequency locally"
        >
          <Text style={styles.primaryButtonText}>SAVE LOCAL</Text>
        </Pressable>
        <Pressable
          testID="forge-play"
          style={({ pressed }) => [
            styles.primaryButton,
            playBlockedReason !== null && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handlePlay}
          disabled={playBlockedReason !== null}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Test play this frequency"
          accessibilityHint={playBlockedReason ?? 'Plays the assembled call'}
        >
          <Text style={styles.primaryButtonText}>TEST PLAY</Text>
        </Pressable>
        <Pressable
          testID="forge-publish"
          style={({ pressed }) => [
            styles.secondaryButton,
            (!communityEnabled || !hasInfiniteSignal || publishing) && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handlePublish}
          disabled={!communityEnabled || !hasInfiniteSignal || publishing}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Publish frequency to the community"
        >
          <Text style={styles.secondaryButtonText}>{publishing ? 'PUBLISHING…' : 'PUBLISH'}</Text>
        </Pressable>
      </View>
      {playBlockedReason !== null && (
        <Text style={styles.blockedNote}>PLAYBACK LOCKED — {playBlockedReason.toUpperCase()}</Text>
      )}
      {!communityEnabled && (
        <Text style={styles.blockedNote}>COMMUNITY OFFLINE — SHARING DISABLED</Text>
      )}
      {communityEnabled && friendCode !== undefined && friendCode.length > 0 && (
        <Text style={styles.blockedNote}>PUBLISHING ATTACHES FRIEND CODE {friendCode}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  section: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 3,
  },
  subLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
    marginTop: spacing.xs,
  },
  hint: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontFamily: fonts.mono,
    fontSize: 15,
    color: colors.text,
  },
  multiline: {
    minHeight: 56,
    textAlignVertical: 'top',
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
  chipDisabled: {
    opacity: 0.4,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  chipTextSelected: {
    color: colors.amber,
  },
  middleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  middlePicker: {
    flex: 1,
  },
  removeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.red,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    padding: spacing.xs,
  },
  choiceRowSelected: {
    borderColor: colors.green,
  },
  choiceMark: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.green,
  },
  choiceText: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
  },
  previewLine: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
  previewChoices: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  previewChoice: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    color: colors.green,
  },
  issues: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 4,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  issuesTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.red,
    letterSpacing: 2,
  },
  issueText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.amber,
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryButtonText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.background,
    letterSpacing: 2,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.green,
    letterSpacing: 2,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  blockedNote: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  empty: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.textMuted,
  },
});
