CREATE TABLE IF NOT EXISTS view_daily (
  zip_id TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (zip_id, day)
);
