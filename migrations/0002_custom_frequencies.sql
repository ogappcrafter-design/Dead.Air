-- DEA-89 — player-authored custom frequency presets.
--
-- Adds the optional friend code used to share a preset socially. The call
-- composition itself travels inside the existing `payload` JSON column
-- (`composition` + `difficulty`), so no additional content tables are needed.
-- Legacy tuning-only presets keep `friend_code = NULL` and remain readable.

ALTER TABLE community_presets ADD COLUMN friend_code TEXT;

CREATE INDEX IF NOT EXISTS idx_community_presets_friend_code
  ON community_presets (friend_code, status, created_at DESC);
