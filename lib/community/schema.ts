/**
 * DEA-95 Phase 1 — shared community schemas.
 *
 * These Zod schemas are the single contract between the app, the Cloudflare
 * Worker, and the D1 rows. The Worker validates every write with the same
 * schema the client uses, so a preset that renders in the app is guaranteed to
 * be well formed before it reaches storage.
 *
 * Phase 1 scope: frequency presets only. Custom calls stay behind the Infinite
 * Signal gate and user-generated call content is deferred until the store
 * policy work lands, so nothing here accepts free-form call scripts.
 */

import { z } from 'zod';
import { BANDS } from '../constants';

export const COMMUNITY_SCHEMA_VERSION = 1;

export const MIN_PRESET_FREQUENCY = 87.5;
export const MAX_PRESET_FREQUENCY = 172;

export const PRESET_NAME_MIN_LENGTH = 3;
export const PRESET_NAME_MAX_LENGTH = 60;
export const PRESET_DESCRIPTION_MAX_LENGTH = 500;
export const PRESET_NOTES_MAX_LENGTH = 280;
export const PRESET_TAG_MAX_COUNT = 5;
export const PRESET_TAG_MAX_LENGTH = 24;
export const DISPLAY_NAME_MAX_LENGTH = 32;
export const SEARCH_QUERY_MAX_LENGTH = 64;
export const REPORT_DETAILS_MAX_LENGTH = 500;

export const PRESET_DEFAULT_LIMIT = 20;
export const PRESET_MAX_LIMIT = 50;

/** Per-device preset creation cap enforced by the Worker (per hour). */
export const PRESET_CREATE_LIMIT_PER_HOUR = 10;
export const PRESET_CREATE_WINDOW_MS = 60 * 60 * 1000;

export const PRESET_TONES = ['clean', 'warm', 'hiss', 'warble'] as const;
export const PRESET_STATUSES = ['published', 'hidden'] as const;
export const REPORT_REASONS = ['spam', 'harassment', 'hate', 'sexual', 'broken', 'other'] as const;
export const REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;

export const bandSchema = z.enum(BANDS);

export type PresetBand = z.infer<typeof bandSchema>;
export type PresetTone = (typeof PRESET_TONES)[number];
export type PresetStatus = (typeof PRESET_STATUSES)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** The tuning state a preset captures. */
export const presetPayloadSchema = z
  .object({
    frequency: z.number().finite().min(MIN_PRESET_FREQUENCY).max(MAX_PRESET_FREQUENCY),
    band: bandSchema,
    volume: z.number().finite().min(0).max(1).default(0.8),
    staticLevel: z.number().finite().min(0).max(100).optional(),
    tone: z.enum(PRESET_TONES).optional(),
    notes: z.string().trim().max(PRESET_NOTES_MAX_LENGTH).optional(),
  })
  .strict();

export const presetTagsSchema = z
  .array(z.string().trim().toLowerCase().min(1).max(PRESET_TAG_MAX_LENGTH))
  .max(PRESET_TAG_MAX_COUNT)
  .transform((tags) => Array.from(new Set(tags)));

const presetNameSchema = z
  .string()
  .trim()
  .refine(
    (name) => {
      const length = Array.from(name).length;
      return (
        !name.includes('\0') && length >= PRESET_NAME_MIN_LENGTH && length <= PRESET_NAME_MAX_LENGTH
      );
    },
    { message: 'name must contain 3 to 60 characters without NUL' },
  );

export const createPresetInputSchema = z
  .object({
    name: presetNameSchema,
    description: z.string().trim().max(PRESET_DESCRIPTION_MAX_LENGTH).optional(),
    payload: presetPayloadSchema,
    tags: presetTagsSchema.optional(),
  })
  .strict();

export const updatePresetInputSchema = z
  .object({
    name: presetNameSchema.optional(),
    description: z.string().trim().max(PRESET_DESCRIPTION_MAX_LENGTH).optional(),
    payload: presetPayloadSchema.optional(),
    tags: presetTagsSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'at least one field is required',
  });

export const reportInputSchema = z
  .object({
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(REPORT_DETAILS_MAX_LENGTH).optional(),
  })
  .strict();

export const deviceRegistrationSchema = z
  .object({
    displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH).optional(),
  })
  .strict();

/** Query for the public preset list / search. */
export const presetQuerySchema = z
  .object({
    q: z.string().trim().max(SEARCH_QUERY_MAX_LENGTH).optional(),
    band: bandSchema.optional(),
    limit: z.coerce.number().int().min(1).max(PRESET_MAX_LIMIT).default(PRESET_DEFAULT_LIMIT),
    cursor: z.string().min(1).max(128).optional(),
  })
  .strict();

/** A preset as returned by the API. */
export const presetSchema = z.object({
  id: z.string().min(1).max(64),
  name: presetNameSchema,
  description: z.string(),
  payload: presetPayloadSchema,
  tags: presetTagsSchema,
  authorName: z.string(),
  schemaVersion: z.number().int().positive(),
  status: z.enum(PRESET_STATUSES),
  reportCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const presetListResponseSchema = z.object({
  items: z.array(presetSchema),
  nextCursor: z.string().nullable(),
});

export const deviceSessionSchema = z.object({
  deviceId: z.string().min(1),
  token: z.string().min(1),
  displayName: z.string(),
});

export const deviceProfileSchema = z.object({
  deviceId: z.string().min(1),
  displayName: z.string(),
  createdAt: z.string().datetime(),
  presetCount: z.number().int().nonnegative(),
});

export const reportResponseSchema = z.object({
  reportId: z.string().min(1),
  alreadyReported: z.boolean(),
  reportCount: z.number().int().nonnegative(),
});

export const deleteResponseSchema = z.object({
  deleted: z.boolean(),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type PresetPayload = z.output<typeof presetPayloadSchema>;
export type CreatePresetInput = z.input<typeof createPresetInputSchema>;
export type ValidatedCreatePresetInput = z.output<typeof createPresetInputSchema>;
export type UpdatePresetInput = z.input<typeof updatePresetInputSchema>;
export type ValidatedUpdatePresetInput = z.output<typeof updatePresetInputSchema>;
export type PresetReportInput = z.input<typeof reportInputSchema>;
export type PresetQueryInput = z.input<typeof presetQuerySchema>;
export type Preset = z.infer<typeof presetSchema>;
export type PresetListResponse = z.infer<typeof presetListResponseSchema>;
export type DeviceSession = z.infer<typeof deviceSessionSchema>;
export type DeviceProfile = z.infer<typeof deviceProfileSchema>;
export type PresetReportResponse = z.infer<typeof reportResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
