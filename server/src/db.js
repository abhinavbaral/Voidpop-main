// The database: one SQLite file via Node's built-in node:sqlite (no install, Node 22.5+).
// The SQL below is plain enough to move to Postgres later; everything that touches it is in this folder.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function openDb(file = ":memory:") {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY,
      email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
      username   TEXT NOT NULL UNIQUE COLLATE NOCASE,
      pass_hash  TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- one verdict per person per title. 'status' is what decides if it counts in the community split
    CREATE TABLE IF NOT EXISTS verdicts (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      segment    TEXT NOT NULL,
      item_id    TEXT NOT NULL,
      verdict    TEXT NOT NULL,
      status     TEXT NOT NULL,
      moods      TEXT NOT NULL DEFAULT '[]',
      title      TEXT,
      image      TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, segment, item_id)
    );
    CREATE INDEX IF NOT EXISTS verdicts_by_title ON verdicts (segment, item_id);

    CREATE TABLE IF NOT EXISTS comments (
      id         INTEGER PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      segment    TEXT NOT NULL,
      item_id    TEXT NOT NULL,
      parent_id  INTEGER REFERENCES comments(id) ON DELETE CASCADE,
      body       TEXT NOT NULL,
      created_at TEXT NOT NULL,
      edited_at  TEXT,
      deleted    INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS comments_by_title ON comments (segment, item_id, id);

    CREATE TABLE IF NOT EXISTS comment_likes (
      comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (comment_id, user_id)
    );

    -- cloud sync: the app's whole backup, last write wins, guarded by a version number
    CREATE TABLE IF NOT EXISTS sync (
      user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data       TEXT NOT NULL,
      version    INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}
