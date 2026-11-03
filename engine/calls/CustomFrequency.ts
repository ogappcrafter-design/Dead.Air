// engine/calls/CustomFrequency.ts
// DEA-89 — player-authored call frequencies.
//
// A custom frequency is a deterministic recipe: it references fragments from
// one of the five core band libraries, tunes the band's supported difficulty
// parameters, and can be saved locally or shared through the community preset
// API. No free-form call text is accepted here — the sacred transmissions in
// data/calls.js stay untouched and player content is assembled only from
// existing fragment strings.
//
// The module is pure: no React, no store imports, no I/O. The registry and
// persistence layers call into it.

import { BANDS as BAND_DATA } from '../../data/bands';
import { BAND_VARIATIONS } from '../../data/fragments/variations';
import { LIVING_FRAGMENTS } from '../../data/fragments/living';
import { LIMINAL_FRAGMENTS } from '../../data/fragments/liminal';
import { LOST_FRAGMENTS } from '../../data/fragments/lost';
import { CLASSIFIED_FRAGMENTS } from '../../data/fragments/classified';
import { REDACTED_FRAGMENTS } from '../../data/fragments/redacted';
import type { FragmentLibrary, BandVariation } from '../../data/fragments/types';
import { SeededRNG } from './SeededRNG';
import type { CallChoice, CallData } from './types';
import { BANDS, FRIEND_CODE_PATTERN, type Band } from '../../lib/constants';

/**
 * Call types the builder can assemble from explicit fragment choices.
 *
 * Advanced types (RECORDING, MULTI_CALLER, TIMING, PUZZLE, CONVERSATION) need
 * authored mechanic payloads and are intentionally out of scope; SIGNAL_DECODE
 * and STAY_CALM carry no line composition and are left to the procedural
 * generator.
 */
export const CUSTOM_CALL_TYPES = ['JUST_LISTEN', 'DEAD_AIR', 'RIGHT_ANSWER'] as const;
export type CustomCallType = (typeof CUSTOM_CALL_TYPES)[number];

export const CUSTOM_FREQUENCY_SCHEMA_VERSION = 1;
export const CUSTOM_FREQUENCY_MAX_SAVED = 50;
export const CUSTOM_FREQUENCY_NAME_MIN_LENGTH = 3;
export const CUSTOM_FREQUENCY_NAME_MAX_LENGTH = 60;
export const CUSTOM_FREQUENCY_DESCRIPTION_MAX_LENGTH = 500;
export const CUSTOM_FREQUENCY_MIN_MIDDLE_LINES = 1;
export const CUSTOM_FREQUENCY_MAX_MIDDLE_LINES = 3;
export const CUSTOM_FREQUENCY_MIN_CHOICES = 2;
export const CUSTOM_FREQUENCY_MAX_CHOICES = 4;

const CORE_LIBRARIES: Readonly<Record<number, FragmentLibrary>> = {
  0: LIVING_FRAGMENTS,
  1: LIMINAL_FRAGMENTS,
  2: LOST_FRAGMENTS,
  3: CLASSIFIED_FRAGMENTS,
  4: REDACTED_FRAGMENTS,
};

export type CustomFrequencyOrigin = 'local' | 'community';

/** Tuned values, constrained to the band's existing variation ranges. */
export interface CustomFrequencyDifficulty {
  /** Sanity change applied by the call (band variation range). */
  sanityDelta: number;
  /** Base static reward before choice multipliers (band variation range). */
  staticReward: number;
  /** Signal strength 0-5 (band variation range). */
  signal: number;
}

/** Fragment references plus the supported call type. */
export interface CustomFrequencyComposition {
  /** Core band index 0-4. */
  band: number;
  callType: CustomCallType;
  /** Index into the band library's `openings`. */
  openingIndex: number;
  /** 1-3 distinct indices into the band library's `middles`. */
  middleIndices: number[];
  /** Index into the band library's `closings`. */
  closingIndex: number;
  /** 2-4 distinct indices into `responses`; RIGHT_ANSWER only. */
  choiceIndices?: number[];
}

/** A saved or installed custom frequency. */
export interface CustomFrequency {
  id: string;
  name: string;
  description?: string;
  /** Dial position inside the band's frequency range. */
  frequency: number;
  volume: number;
  composition: CustomFrequencyComposition;
  difficulty: CustomFrequencyDifficulty;
  origin: CustomFrequencyOrigin;
  /** Present when the frequency was installed from the community API. */
  remoteId?: string;
  /** Author's friend code, when shared. */
  friendCode?: string;
  authorName?: string;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface CustomFrequencyIssue {
  path: string;
  message: string;
}

export interface CustomFrequencyValidation {
  ok: boolean;
  issues: CustomFrequencyIssue[];
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** The fragment library for a core band, or null for any other band index. */
export function getCustomFrequencyLibrary(band: number): FragmentLibrary | null {
  return CORE_LIBRARIES[band] ?? null;
}

/** The band's variation rules, or null when the band has no core library. */
export function getCustomFrequencyVariation(band: number): BandVariation | null {
  return BAND_VARIATIONS.find((variation) => variation.band === band) ?? null;
}

/** Call types this band can assemble in the builder. */
export function getCustomCallTypesForBand(band: number): CustomCallType[] {
  const library = getCustomFrequencyLibrary(band);
  if (library === null) return [];
  return CUSTOM_CALL_TYPES.filter((type) => library.callTypes.includes(type));
}

/** Band label for a core band index, or null. */
export function getCustomFrequencyBandName(band: number): Band | null {
  return BANDS[band] ?? null;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function midpoint(range: readonly [number, number]): number {
  return clampInt((range[0] + range[1]) / 2, range[0], range[1]);
}

/**
 * A valid starting draft for a band. Returns null when the band has no core
 * fragment library.
 */
export function createCustomFrequencyDraft(
  band: number,
  overrides: Partial<Omit<CustomFrequency, 'composition' | 'difficulty'>> & {
    composition?: Partial<CustomFrequencyComposition>;
    difficulty?: Partial<CustomFrequencyDifficulty>;
  } = {},
): CustomFrequency | null {
  const library = getCustomFrequencyLibrary(band);
  const variation = getCustomFrequencyVariation(band);
  if (library === null || variation === null) return null;

  const callTypes = getCustomCallTypesForBand(band);
  const callType = callTypes.includes(overrides.composition?.callType as CustomCallType)
    ? (overrides.composition?.callType as CustomCallType)
    : callTypes[0];
  if (callType === undefined) return null;

  const bandInfo = BAND_DATA[getCustomFrequencyBandName(band) as Band];
  const now = overrides.createdAt ?? 0;

  return {
    id: overrides.id ?? `local:${now}`,
    name: overrides.name ?? 'Untitled Frequency',
    description: overrides.description,
    frequency: overrides.frequency ?? midpoint(bandInfo.frequencyRange),
    volume: overrides.volume ?? 0.8,
    composition: {
      band,
      callType,
      openingIndex: overrides.composition?.openingIndex ?? 0,
      middleIndices: overrides.composition?.middleIndices ?? [0],
      closingIndex: overrides.composition?.closingIndex ?? 0,
      choiceIndices:
        callType === 'RIGHT_ANSWER' ? (overrides.composition?.choiceIndices ?? [0, 1]) : undefined,
    },
    difficulty: {
      sanityDelta: overrides.difficulty?.sanityDelta ?? midpoint(variation.sanityDeltaRange),
      staticReward: overrides.difficulty?.staticReward ?? midpoint(variation.staticRewardRange),
      signal: overrides.difficulty?.signal ?? midpoint(variation.signalRange),
    },
    origin: overrides.origin ?? 'local',
    remoteId: overrides.remoteId,
    friendCode: overrides.friendCode,
    authorName: overrides.authorName,
    schemaVersion: CUSTOM_FREQUENCY_SCHEMA_VERSION,
    createdAt: overrides.createdAt ?? 0,
    updatedAt: overrides.updatedAt ?? now,
  };
}

/** Validate a frequency, including fragment references and difficulty bounds. */
export function validateCustomFrequency(frequency: CustomFrequency): CustomFrequencyValidation {
  const issues: CustomFrequencyIssue[] = [];
  const add = (path: string, message: string): void => {
    issues.push({ path, message });
  };

  if (typeof frequency.id !== 'string' || frequency.id.trim().length === 0) {
    add('id', 'id must be a non-empty string');
  }
  if (typeof frequency.name !== 'string') {
    add('name', 'name must be a string');
  } else {
    const length = Array.from(frequency.name.trim()).length;
    if (length < CUSTOM_FREQUENCY_NAME_MIN_LENGTH || length > CUSTOM_FREQUENCY_NAME_MAX_LENGTH) {
      add(
        'name',
        `name must contain ${CUSTOM_FREQUENCY_NAME_MIN_LENGTH} to ${CUSTOM_FREQUENCY_NAME_MAX_LENGTH} characters`,
      );
    }
  }
  if (
    frequency.description !== undefined &&
    Array.from(frequency.description).length > CUSTOM_FREQUENCY_DESCRIPTION_MAX_LENGTH
  ) {
    add('description', 'description is too long');
  }
  if (frequency.friendCode !== undefined && !FRIEND_CODE_PATTERN.test(frequency.friendCode)) {
    add('friendCode', 'friendCode is not a valid DA-XXXXX code');
  }
  if (frequency.origin !== 'local' && frequency.origin !== 'community') {
    add('origin', 'origin must be local or community');
  }
  if (!isInteger(frequency.schemaVersion) || frequency.schemaVersion < 1) {
    add('schemaVersion', 'schemaVersion must be a positive integer');
  }

  const composition = frequency.composition;
  if (composition === null || typeof composition !== 'object') {
    add('composition', 'composition is required');
    return { ok: false, issues };
  }

  const library = getCustomFrequencyLibrary(composition.band);
  const variation = getCustomFrequencyVariation(composition.band);
  if (library === null || variation === null) {
    add('composition.band', 'band must be a core band index 0-4');
    return { ok: false, issues };
  }

  const bandName = getCustomFrequencyBandName(composition.band);
  const bandInfo = bandName ? BAND_DATA[bandName] : undefined;
  if (
    bandInfo === undefined ||
    !isFiniteNumber(frequency.frequency) ||
    frequency.frequency < bandInfo.frequencyRange[0] ||
    frequency.frequency > bandInfo.frequencyRange[1]
  ) {
    add('frequency', 'frequency must fall inside the band range');
  }
  if (!isFiniteNumber(frequency.volume) || frequency.volume < 0 || frequency.volume > 1) {
    add('volume', 'volume must be between 0 and 1');
  }

  if (!CUSTOM_CALL_TYPES.includes(composition.callType)) {
    add('composition.callType', 'callType is not supported by the builder');
  } else if (!library.callTypes.includes(composition.callType)) {
    add('composition.callType', 'callType is not supported by this band');
  }

  if (
    !isInteger(composition.openingIndex) ||
    composition.openingIndex < 0 ||
    composition.openingIndex >= library.openings.length
  ) {
    add('composition.openingIndex', 'openingIndex is outside the band library');
  }
  if (
    !isInteger(composition.closingIndex) ||
    composition.closingIndex < 0 ||
    composition.closingIndex >= library.closings.length
  ) {
    add('composition.closingIndex', 'closingIndex is outside the band library');
  }

  const middles = composition.middleIndices;
  if (!Array.isArray(middles)) {
    add('composition.middleIndices', 'middleIndices must be an array');
  } else {
    if (
      middles.length < CUSTOM_FREQUENCY_MIN_MIDDLE_LINES ||
      middles.length > CUSTOM_FREQUENCY_MAX_MIDDLE_LINES
    ) {
      add(
        'composition.middleIndices',
        `middleIndices must contain ${CUSTOM_FREQUENCY_MIN_MIDDLE_LINES} to ${CUSTOM_FREQUENCY_MAX_MIDDLE_LINES} entries`,
      );
    }
    if (new Set(middles).size !== middles.length) {
      add('composition.middleIndices', 'middleIndices must be distinct');
    }
    middles.forEach((index, position) => {
      if (!isInteger(index) || index < 0 || index >= library.middles.length) {
        add(`composition.middleIndices.${position}`, 'middleIndex is outside the band library');
      }
    });
  }

  const choices = composition.choiceIndices;
  if (composition.callType === 'RIGHT_ANSWER') {
    if (!Array.isArray(choices)) {
      add('composition.choiceIndices', 'choiceIndices are required for RIGHT_ANSWER');
    } else {
      if (
        choices.length < CUSTOM_FREQUENCY_MIN_CHOICES ||
        choices.length > CUSTOM_FREQUENCY_MAX_CHOICES
      ) {
        add(
          'composition.choiceIndices',
          `choiceIndices must contain ${CUSTOM_FREQUENCY_MIN_CHOICES} to ${CUSTOM_FREQUENCY_MAX_CHOICES} entries`,
        );
      }
      if (new Set(choices).size !== choices.length) {
        add('composition.choiceIndices', 'choiceIndices must be distinct');
      }
      choices.forEach((index, position) => {
        if (!isInteger(index) || index < 0 || index >= library.responses.length) {
          add(
            `composition.choiceIndices.${position}`,
            'choiceIndex is outside the band response library',
          );
        }
      });
    }
  } else if (choices !== undefined && (!Array.isArray(choices) || choices.length > 0)) {
    add('composition.choiceIndices', 'choiceIndices are only valid for RIGHT_ANSWER');
  }

  const difficulty = frequency.difficulty;
  if (difficulty === null || typeof difficulty !== 'object') {
    add('difficulty', 'difficulty is required');
    return { ok: false, issues };
  }
  const ranges: Array<[keyof CustomFrequencyDifficulty, readonly [number, number]]> = [
    ['sanityDelta', variation.sanityDeltaRange],
    ['staticReward', variation.staticRewardRange],
    ['signal', variation.signalRange],
  ];
  for (const [key, range] of ranges) {
    const value = difficulty[key];
    if (!isInteger(value) || value < range[0] || value > range[1]) {
      add(`difficulty.${key}`, `${key} must be an integer between ${range[0]} and ${range[1]}`);
    }
  }

  return { ok: issues.length === 0, issues };
}

/** True when the frequency is valid; convenient for filters and guards. */
export function isValidCustomFrequency(frequency: CustomFrequency): boolean {
  return validateCustomFrequency(frequency).ok;
}

function resolveCallerPrefix(library: FragmentLibrary, rng: SeededRNG): string {
  const prefix = rng.pick(library.callerIdPrefixes);
  return prefix.replace(/####/g, () => String(rng.int(0, 9)));
}

/**
 * Build the playable CallData for a valid frequency. Deterministic: the same
 * frequency always produces the same lines and caller identity, so an
 * installed shared frequency plays the same for every owner.
 *
 * @param callId id assigned by the live registry.
 */
export function buildCustomFrequencyCall(frequency: CustomFrequency, callId: number): CallData {
  const validation = validateCustomFrequency(frequency);
  if (!validation.ok) {
    throw new Error(
      `Invalid custom frequency: ${validation.issues.map((issue) => issue.path).join(', ')}`,
    );
  }

  const { composition, difficulty } = frequency;
  const library = getCustomFrequencyLibrary(composition.band);
  if (library === null) {
    throw new Error('Custom frequency band has no fragment library');
  }

  const rng = new SeededRNG(
    JSON.stringify([
      composition.band,
      composition.callType,
      composition.openingIndex,
      composition.middleIndices,
      composition.closingIndex,
      composition.choiceIndices ?? [],
      difficulty.sanityDelta,
      difficulty.staticReward,
      difficulty.signal,
    ]),
  );
  const opening = library.openings[composition.openingIndex] as string;
  const middles = composition.middleIndices.map((index) => library.middles[index] as string);
  const closing = library.closings[composition.closingIndex] as string;

  const call: CallData = {
    id: callId,
    band: composition.band,
    callerId: resolveCallerPrefix(library, rng),
    callerName: rng.pick(library.callerNamePrefixes),
    signal: difficulty.signal,
    type: composition.callType,
    staticReward: difficulty.staticReward,
    lines: [opening, ...middles, closing],
    sourceCustomFrequencyId: frequency.id,
  };

  if (composition.callType === 'JUST_LISTEN' || composition.callType === 'DEAD_AIR') {
    call.sanityDelta = difficulty.sanityDelta;
    if (composition.callType === 'DEAD_AIR') {
      call.waitSeconds = rng.int(6, 15);
    }
  }

  if (composition.callType === 'RIGHT_ANSWER') {
    const choices: CallChoice[] = (composition.choiceIndices ?? []).map((index) => {
      const response = library.responses[index];
      if (response === undefined) {
        throw new Error('Custom frequency choice index is outside the response library');
      }
      const derivedMult = Math.max(1, Math.min(3, Math.ceil(response.outcome.length / 80)));
      return {
        text: response.text,
        outcome: response.outcome,
        sanityDelta: response.sanityDelta ?? difficulty.sanityDelta,
        staticMult: Math.max(1, Math.min(3, response.staticMult ?? derivedMult)),
      };
    });
    call.choices = choices;
  }

  return call;
}

/** Human-readable preview of the assembled lines, for the builder UI. */
export function previewCustomFrequencyLines(frequency: CustomFrequency): string[] {
  const validation = validateCustomFrequency(frequency);
  if (!validation.ok) return [];
  const { composition } = frequency;
  const library = getCustomFrequencyLibrary(composition.band);
  if (library === null) return [];
  return [
    library.openings[composition.openingIndex] as string,
    ...composition.middleIndices.map((index) => library.middles[index] as string),
    library.closings[composition.closingIndex] as string,
  ];
}

/** Stable, human-readable label for a custom call type. */
export function customCallTypeLabel(type: CustomCallType): string {
  switch (type) {
    case 'JUST_LISTEN':
      return 'JUST LISTEN';
    case 'DEAD_AIR':
      return 'DEAD AIR';
    case 'RIGHT_ANSWER':
      return 'RIGHT ANSWER';
  }
}
