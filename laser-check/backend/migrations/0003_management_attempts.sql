CREATE TABLE IF NOT EXISTS management_attempts (
  client_key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
