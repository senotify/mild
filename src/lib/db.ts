import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

// Each entry runs exactly once, in order. Never edit a shipped migration:
// append a new one instead.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    avatar TEXT,
    is_admin INTEGER NOT NULL DEFAULT 0,
    is_banned INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    body_html TEXT NOT NULL,
    body_text TEXT NOT NULL,
    cover TEXT,
    reading_minutes INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
    source_file TEXT UNIQUE,
    source_hash TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    published_at INTEGER
  );
  CREATE INDEX posts_feed ON posts(status, published_at DESC);
  CREATE INDEX posts_author ON posts(author_id, status, published_at DESC);

  CREATE TABLE post_tags (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (post_id, tag)
  );
  CREATE INDEX post_tags_tag ON post_tags(tag);

  CREATE TABLE claps (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    count INTEGER NOT NULL,
    PRIMARY KEY (post_id, user_id)
  );

  CREATE TABLE comments (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX comments_post ON comments(post_id, created_at);

  CREATE TABLE follows (
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (follower_id, followee_id)
  );
  CREATE INDEX follows_followee ON follows(followee_id);

  CREATE TABLE bookmarks (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (user_id, post_id)
  );

  -- Full-text index over published and draft posts; queries filter by status.
  CREATE VIRTUAL TABLE posts_fts USING fts5(
    title, subtitle, body_text, tags,
    content='', contentless_delete=1, tokenize='porter unicode61'
  );
  `,
];

function migrate(db: Database.Database) {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

function open(): Database.Database {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "mild.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

// One connection per process, surviving Next's dev-mode module reloads.
const g = globalThis as unknown as { __mildDb?: Database.Database };
export function db(): Database.Database {
  if (!g.__mildDb) g.__mildDb = open();
  return g.__mildDb;
}

/** Rewrite a post's row in the FTS index. Call after every post write. */
export function reindexPost(postId: number) {
  const d = db();
  d.prepare("DELETE FROM posts_fts WHERE rowid = ?").run(postId);
  const p = d
    .prepare("SELECT title, subtitle, body_text FROM posts WHERE id = ?")
    .get(postId) as { title: string; subtitle: string; body_text: string } | undefined;
  if (!p) return;
  const tags = (
    d.prepare("SELECT tag FROM post_tags WHERE post_id = ?").all(postId) as { tag: string }[]
  )
    .map((t) => t.tag)
    .join(" ");
  d.prepare(
    "INSERT INTO posts_fts(rowid, title, subtitle, body_text, tags) VALUES (?, ?, ?, ?, ?)",
  ).run(postId, p.title, p.subtitle, p.body_text, tags);
}
