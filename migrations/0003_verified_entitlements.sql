CREATE TABLE community_entitlements (
  purchase_hash TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES community_devices(id),
  platform TEXT NOT NULL CHECK (platform IN ('apple', 'google')),
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  verified_at INTEGER NOT NULL
);
