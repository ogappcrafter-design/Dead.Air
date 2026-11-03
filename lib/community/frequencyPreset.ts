// lib/community/frequencyPreset.ts
// DEA-89 — translate between the local custom-frequency model and the
// community preset contract. Pure: no storage, no network, no React.
//
// The community API is the established sharing surface (DEA-95); a custom
// frequency is a preset whose payload carries a `composition` + `difficulty`
// pair. Legacy tuning-only presets remain valid but cannot be installed as
// playable calls.

import { BANDS } from '../constants';
import {
  CUSTOM_FREQUENCY_SCHEMA_VERSION,
  customCallTypeLabel,
  getCustomFrequencyBandName,
  validateCustomFrequency,
  type CustomFrequency,
  type CustomFrequencyIssue,
} from '../../engine/calls/CustomFrequency';
import type { CreatePresetInput, Preset } from './schema';

export interface PresetToFrequencyResult {
  ok: boolean;
  frequency?: CustomFrequency;
  issues: CustomFrequencyIssue[];
}

/** The payload a shared custom frequency carries. */
export function customFrequencyToPresetInput(
  frequency: CustomFrequency,
  friendCode?: string,
): CreatePresetInput {
  const bandName = getCustomFrequencyBandName(frequency.composition.band);
  if (bandName === null) {
    throw new Error('Custom frequency band has no community band label');
  }

  return {
    name: frequency.name,
    description: frequency.description,
    payload: {
      frequency: frequency.frequency,
      band: bandName,
      volume: frequency.volume,
      tone: 'hiss',
      composition: frequency.composition,
      difficulty: frequency.difficulty,
    },
    tags: [
      'custom-frequency',
      bandName.toLowerCase(),
      frequency.composition.callType.toLowerCase(),
    ],
    ...((friendCode ?? frequency.friendCode)
      ? { friendCode: friendCode ?? frequency.friendCode }
      : {}),
  };
}

/** True when a preset carries a call composition the builder can install. */
export function presetHasCustomCall(preset: Pick<Preset, 'payload'>): boolean {
  return preset.payload.composition !== undefined && preset.payload.difficulty !== undefined;
}

/**
 * Convert an installed community preset into a local, read-only frequency.
 * Invalid imports fail with explicit issues instead of partially installing.
 */
export function presetToCustomFrequency(preset: Preset): PresetToFrequencyResult {
  if (!presetHasCustomCall(preset)) {
    return {
      ok: false,
      issues: [
        {
          path: 'payload.composition',
          message: 'this preset has no call composition',
        },
      ],
    };
  }

  const band = BANDS.indexOf(preset.payload.band);
  const frequency: CustomFrequency = {
    id: `remote:${preset.id}`,
    name: preset.name,
    description: preset.description.length > 0 ? preset.description : undefined,
    frequency: preset.payload.frequency,
    volume: preset.payload.volume,
    composition: preset.payload.composition!,
    difficulty: preset.payload.difficulty!,
    origin: 'community',
    remoteId: preset.id,
    friendCode: preset.friendCode ?? undefined,
    authorName: preset.authorName,
    schemaVersion: CUSTOM_FREQUENCY_SCHEMA_VERSION,
    createdAt: Date.parse(preset.createdAt),
    updatedAt: Date.parse(preset.updatedAt),
  };

  const validation = validateCustomFrequency(frequency);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues };
  }
  // Guard against a payload whose band label disagrees with the composition.
  if (band !== frequency.composition.band) {
    return {
      ok: false,
      issues: [
        {
          path: 'composition.band',
          message: 'composition band must match the preset band',
        },
      ],
    };
  }

  return { ok: true, frequency, issues: [] };
}

/** Clipboard-friendly summary used by the library's SHARE action. */
export function customFrequencyShareText(frequency: CustomFrequency): string {
  const bandName = getCustomFrequencyBandName(frequency.composition.band) ?? 'UNKNOWN';
  const lines = [
    `DEAD AIR — CUSTOM FREQUENCY "${frequency.name}"`,
    `${customCallTypeLabel(frequency.composition.callType)} · ${bandName} ${frequency.frequency.toFixed(1)}`,
  ];
  if (frequency.remoteId) lines.push(`COMMUNITY ID: ${frequency.remoteId}`);
  if (frequency.friendCode) lines.push(`FRIEND CODE: ${frequency.friendCode}`);
  return lines.join('\n');
}
