-- DEA-95 Phase 1 — community frequency presets (presets only).
--
-- Scope: a device-authenticated preset catalogue with reporting and admin
-- moderation. No user accounts, no custom calls (those stay behind the
-- Infinite Signal gate), and no user-generated call content — that is deferred
-- until the store-policy work lands.
--
-- Timestamps are Unix epoch milliseconds (INTEGER) so keyset pagination is a
-- plain integer comparison.

CREATE TABLE IF NOT EXISTS community_devices (
  id TEXT PRIMARY KEY,
  -- SHA-256 of the bearer token. The token itself is never stored.
  token_hash TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  banned INTEGER NOT NULL DEFAULT 0 CHECK (banned IN (0, 1)),
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS community_presets (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES community_devices (id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  -- `band` and `frequency` duplicate values inside `payload` so the feed and
  -- band filter can be indexed without parsing JSON on every row.
  band TEXT NOT NULL,
  frequency REAL NOT NULL,
  payload TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  schema_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'hidden')),
  report_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (length(name) BETWEEN 3 AND 60),
  CHECK (length(description) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_community_presets_feed
  ON community_presets (status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_community_presets_band
  ON community_presets (band, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_presets_author
  ON community_presets (author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_preset_creations (
  preset_id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES community_devices (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_preset_creations_author
  ON community_preset_creations (author_id, created_at);

CREATE TRIGGER IF NOT EXISTS community_presets_record_creation
AFTER INSERT ON community_presets
BEGIN
  INSERT INTO community_preset_creations (preset_id, author_id, created_at)
  VALUES (NEW.id, NEW.author_id, NEW.created_at);
END;

CREATE TABLE IF NOT EXISTS community_reports (
  id TEXT PRIMARY KEY,
  preset_id TEXT NOT NULL REFERENCES community_presets (id) ON DELETE CASCADE,
  reporter_device_id TEXT NOT NULL REFERENCES community_devices (id) ON DELETE CASCADE,
  reason TEXT NOT NULL
    CHECK (reason IN ('spam', 'harassment', 'hate', 'sexual', 'broken', 'other')),
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at INTEGER NOT NULL,
  -- One report per device per preset: repeat reports are idempotent instead of
  -- letting a single device inflate a preset's report count.
  UNIQUE (preset_id, reporter_device_id),
  CHECK (length(details) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_community_reports_status
  ON community_reports (status, created_at DESC);
