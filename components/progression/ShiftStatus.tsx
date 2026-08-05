// components/progression/ShiftStatus.tsx
// Presentational component showing the current shift status.
// Displays: in-game clock, phase label, calls remaining.
// Pure presentational — no store access, no side effects.

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';
import type { ShiftState, ShiftPhase } from '../../engine/progression/NightShift';

interface ShiftStatusProps {
  state: ShiftState;
}

/**
 * Format in-game minutes as a clock time.
 * The shift starts at midnight (12:00 AM). 60 in-game minutes = 1 hour.
 * e.g. 0 → "12:00 AM", 90 → "1:30 AM", 240 → "4:00 AM".
 */
function formatClock(inGameMinutes: number): string {
  const totalMinutes = Math.floor(inGameMinutes);
  const hours24 = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  // Shift starts at midnight (12:00 AM).
  const displayHour12 = hours24 === 0 ? 12 : hours24 <= 12 ? hours24 : hours24 - 12;
  const ampm = hours24 < 12 ? 'AM' : 'PM';
  const minuteStr = mins < 10 ? `0${mins}` : String(mins);

  return `${displayHour12}:${minuteStr} ${ampm}`;
}

/** Human-readable phase label. */
const PHASE_LABELS: Record<ShiftPhase, string> = {
  'off-air': 'OFF AIR',
  'on-air': 'ON AIR',
  break: 'BREAK',
  'sign-off': 'SIGN-OFF',
};

/** Phase → accent color. */
const PHASE_COLORS: Record<ShiftPhase, string> = {
  'off-air': colors.textMuted,
  'on-air': colors.green,
  break: colors.amber,
  'sign-off': colors.red,
};

export const ShiftStatus = memo(function ShiftStatus({ state }: ShiftStatusProps) {
  const callsRemaining = state.scheduledCalls.length - state.nextCallIndex;
  const phaseColor = PHASE_COLORS[state.phase];
  const clock = formatClock(state.inGameMinutes);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.clock}>{clock}</Text>
        <Text style={[styles.phase, { color: phaseColor }]}>{PHASE_LABELS[state.phase]}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>CALLS</Text>
        <Text style={styles.metaValue}>{callsRemaining}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  clock: {
    fontFamily: fonts.mono,
    fontSize: 24,
    color: colors.text,
    letterSpacing: 2,
  },
  phase: {
    fontFamily: fonts.mono,
    fontSize: 14,
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  metaValue: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.amber,
    letterSpacing: 1,
  },
});
