CREATE TABLE IF NOT EXISTS inspectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  shift TEXT NOT NULL CHECK (shift IN ('G','H','J')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  updated_at TEXT NOT NULL
);
