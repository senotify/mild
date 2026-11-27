import crypto from "node:crypto";
import { db, reindexPost } from "./db";
import { SITE_URL } from "./format";
import { cleanPostHtml, htmlToText, readingMinutes } from "./sanitize";

export type PostCard = {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  cover: string | null;
  reading_minutes: number;
  published_at: number;
  username: string;
  author_name: string;
  author_avatar: string | null;
  claps: number;
  responses: number;
  excerpt: string;
};

export type FullPost = PostCard & {
  author_id: number;
  author_bio: string;
  body_html: string;
  status: "draft" | "published";
  updated_at: number;
  tags: string[];
};

const CARD_COLS = `
  p.id, p.slug, p.title, p.subtitle, p.cover, p.reading_minutes, p.published_at,
  u.username, u.name AS author_name, u.avatar AS author_avatar,
  substr(p.body_text, 1, 220) AS excerpt,
  (SELECT COALESCE(SUM(count),0) FROM claps c WHERE c.post_id = p.id) AS claps,
  (SELECT COUNT(*) FROM comments m WHERE m.post_id = p.id) AS responses`;
const VISIBLE = `p.status = 'published' AND u.is_banned = 0`;

export function latestPosts(limit = 20, offset = 0): PostCard[] {
  return db()
    .prepare(
      `SELECT ${CARD_COLS} FROM posts p JOIN users u ON u.id = p.author_id
       WHERE ${VISIBLE} ORDER BY p.published_at DESC LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as PostCard[];
}

export function followingPosts(userId: number, limit = 20): PostCard[] {
  return db()
    .prepare(
      `SELECT ${CARD_COLS} FROM posts p JOIN users u ON u.id = p.author_id
       WHERE ${VISIBLE} AND p.author_id IN (SELECT followee_id FROM follows WHERE follower_id = ?)
       ORDER BY p.published_at DESC LIMIT ?`,
    )
    .all(userId, limit) as PostCard[];
}

export function postsByTag(tag: string, limit = 30): PostCard[] {
  return db()
    .prepare(
      `SELECT ${CARD_COLS} FROM posts p JOIN users u ON u.id = p.author_id
       JOIN post_tags t ON t.post_id = p.id
       WHERE ${VISIBLE} AND t.tag = ? ORDER BY p.published_at DESC LIMIT ?`,
    )
    .all(tag, limit) as PostCard[];
}

export function postsByAuthor(userId: number, limit = 50): PostCard[] {
  return db()
    .prepare(
      `SELECT ${CARD_COLS} FROM posts p JOIN users u ON u.id = p.author_id
       WHERE ${VISIBLE} AND p.author_id = ? ORDER BY p.published_at DESC LIMIT ?`,
    )
    .all(userId, limit) as PostCard[];
}

export function bookmarkedPosts(userId: number): PostCard[] {
  return db()
    .prepare(
      `SELECT ${CARD_COLS} FROM bookmarks b JOIN posts p ON p.id = b.post_id
       JOIN users u ON u.id = p.author_id
       WHERE ${VISIBLE} AND b.user_id = ? ORDER BY b.created_at DESC`,
    )
    .all(userId) as PostCard[];
}

/** Turn arbitrary user input into a safe FTS5 query: each word is a quoted prefix term. */
function ftsQuery(q: string): string | null {
  const words = q.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0, 8);
  if (!words?.length) return null;
  return words.map((w) => `"${w}"*`).join(" ");
}

export function searchPosts(q: string, limit = 30): PostCard[] {
  const fq = ftsQuery(q);
  if (!fq) return [];
  return db()
    .prepare(
      `SELECT ${CARD_COLS} FROM posts_fts f JOIN posts p ON p.id = f.rowid
       JOIN users u ON u.id = p.author_id
       WHERE posts_fts MATCH ? AND ${VISIBLE}
       ORDER BY bm25(posts_fts, 10.0, 5.0, 1.0, 8.0) LIMIT ?`,
    )
    .all(fq, limit) as PostCard[];
}

export function searchPeople(q: string) {
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  return db()
    .prepare(
      `SELECT username, name, bio, avatar FROM users
       WHERE is_banned = 0 AND (username LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\') LIMIT 20`,
    )
    .all(like, like) as { username: string; name: string; bio: string; avatar: string | null }[];
}

export function searchTags(q: string) {
  const like = `%${normalizeTag(q).replace(/[%_\\]/g, "\\$&")}%`;
  return db()
    .prepare(
      `SELECT t.tag, COUNT(*) AS n FROM post_tags t JOIN posts p ON p.id = t.post_id
       WHERE p.status = 'published' AND t.tag LIKE ? ESCAPE '\\'
       GROUP BY t.tag ORDER BY n DESC LIMIT 20`,
    )
    .all(like) as { tag: string; n: number }[];
}

export function topTags(limit = 12) {
  return db()
    .prepare(
      `SELECT t.tag, COUNT(*) AS n FROM post_tags t JOIN posts p ON p.id = t.post_id
       WHERE p.status = 'published' GROUP BY t.tag ORDER BY n DESC, t.tag LIMIT ?`,
    )
    .all(limit) as { tag: string; n: number }[];
}

export function getPostBySlug(slug: string): FullPost | null {
  const p = db()
    .prepare(
      `SELECT ${CARD_COLS}, p.author_id, p.body_html, p.status, p.updated_at, u.bio AS author_bio
       FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.slug = ? AND u.is_banned = 0`,
    )
    .get(slug) as Omit<FullPost, "tags"> | undefined;
  if (!p) return null;
  return { ...p, tags: tagsFor(p.id) };
}

export function getPostById(id: number) {
  const p = db().prepare("SELECT * FROM posts WHERE id = ?").get(id) as
    | {
        id: number;
        author_id: number;
        slug: string;
        title: string;
        subtitle: string;
        body_html: string;
        cover: string | null;
        status: string;
      }
    | undefined;
  return p ? { ...p, tags: tagsFor(p.id) } : null;
}

export function tagsFor(postId: number): string[] {
  return (db().prepare("SELECT tag FROM post_tags WHERE post_id = ? ORDER BY rowid").all(postId) as { tag: string }[]).map(
    (t) => t.tag,
  );
}

export function normalizeTag(t: string) {
  return t
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function slugify(title: string) {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "story";
  return `${base}-${crypto.randomBytes(4).toString("hex")}`;
}

export type PostInput = {
  title: string;
  subtitle?: string;
  html: string;
  tags: string[];
  cover?: string | null;
  publish: boolean;
};

/** Create or update a post. Returns the slug. Body HTML is always sanitized here. */
export function savePost(author: { id: number; trusted: boolean }, input: PostInput, postId?: number, sourceFile?: string, publishedAt?: number) {
  const d = db();
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new Error("A title is required");
  const html = cleanPostHtml(input.html, author.trusted);
  const text = htmlToText(html);
  if (input.publish && text.length < 50) throw new Error("Write a little more before publishing");
  const tags = [...new Set(input.tags.map(normalizeTag).filter(Boolean))].slice(0, 5);
  const subtitle = (input.subtitle || "").trim().slice(0, 300);
  const cover = input.cover && /^(\/uploads\/[\w.-]+|https:\/\/[^\s"'<>]+)$/.test(input.cover) ? input.cover : null;
  const minutes = readingMinutes(text);

  return d.transaction(() => {
    let id = postId;
    let slug: string;
    if (id) {
      const existing = d.prepare("SELECT slug, status, published_at FROM posts WHERE id = ?").get(id) as
        | { slug: string; status: string; published_at: number | null }
        | undefined;
      if (!existing) throw new Error("Post not found");
      slug = existing.slug;
      const status = input.publish ? "published" : existing.status === "published" && !input.publish ? "draft" : existing.status;
      const pub = status === "published" ? (publishedAt ?? existing.published_at ?? Math.floor(Date.now() / 1000)) : existing.published_at;
      d.prepare(
        `UPDATE posts SET title=?, subtitle=?, body_html=?, body_text=?, cover=?, reading_minutes=?,
         status=?, published_at=?, updated_at=unixepoch() WHERE id=?`,
      ).run(title, subtitle, html, text, cover, minutes, status, pub, id);
    } else {
      slug = slugify(title);
      const status = input.publish ? "published" : "draft";
      const pub = input.publish ? (publishedAt ?? Math.floor(Date.now() / 1000)) : null;
      id = Number(
        d
          .prepare(
            `INSERT INTO posts(author_id, slug, title, subtitle, body_html, body_text, cover, reading_minutes, status, published_at, source_file)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .run(author.id, slug, title, subtitle, html, text, cover, minutes, status, pub, sourceFile ?? null).lastInsertRowid,
      );
    }
    d.prepare("DELETE FROM post_tags WHERE post_id = ?").run(id);
    const ins = d.prepare("INSERT INTO post_tags(post_id, tag) VALUES (?, ?)");
    for (const t of tags) ins.run(id, t);
    reindexPost(id);
    return slug;
  })();
}

export function deletePost(id: number) {
  const d = db();
  d.transaction(() => {
    d.prepare("DELETE FROM posts_fts WHERE rowid = ?").run(id);
    d.prepare("DELETE FROM posts WHERE id = ?").run(id);
  })();
}

export function postUrl(username: string, slug: string) {
  return `/@${username}/${slug}`;
}

/** Absolute URL of a post's share image: its own cover, or the generated card at /og/<slug>. */
export function postImage(p: { slug: string; cover: string | null }) {
  if (p.cover) return p.cover.startsWith("/") ? `${SITE_URL}${p.cover}` : p.cover;
  return `${SITE_URL}/og/${p.slug}`;
}
