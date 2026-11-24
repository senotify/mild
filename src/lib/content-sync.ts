import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { db } from "./db";
import { savePost } from "./posts";

export const OWNER = "senotify";
// Read at runtime from the image, never traced into the server bundle.
const CONTENT_DIR = process.env.CONTENT_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "content", "posts");

/**
 * Upserts every markdown file in content/posts/ as a published post by the
 * owner. Keyed on the filename, so re-running (every boot, every interval)
 * never creates duplicates, and unchanged files are skipped by hash.
 */
export function syncContentPosts(): { created: number; updated: number; skipped: number } {
  const res = { created: 0, updated: 0, skipped: 0 };
  if (!fs.existsSync(/*turbopackIgnore: true*/ CONTENT_DIR)) return res;
  const owner = db().prepare("SELECT id FROM users WHERE username = ?").get(OWNER) as { id: number } | undefined;
  if (!owner) {
    console.warn(`[content-sync] no @${OWNER} account yet; run scripts/seed-owner.mjs`);
    return res;
  }
  for (const file of fs.readdirSync(/*turbopackIgnore: true*/ CONTENT_DIR).filter((f) => f.endsWith(".md")).sort()) {
    try {
      const raw = fs.readFileSync(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ CONTENT_DIR, file), "utf8");
      const hash = crypto.createHash("sha256").update(raw).digest("hex");
      const existing = db().prepare("SELECT id, source_hash FROM posts WHERE source_file = ?").get(file) as
        | { id: number; source_hash: string | null }
        | undefined;
      if (existing?.source_hash === hash) {
        res.skipped++;
        continue;
      }
      const { data, content } = matter(raw);
      if (data.draft === true) {
        res.skipped++;
        continue;
      }
      const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
      const date = data.date ? new Date(data.date) : dateMatch ? new Date(`${dateMatch[1]}T07:00:00+07:00`) : new Date();
      const html = marked.parse(content, { async: false, gfm: true }) as string;
      const tags: string[] = Array.isArray(data.tags) ? data.tags.map(String) : [];
      savePost(
        { id: owner.id, trusted: true },
        {
          title: String(data.title || file),
          subtitle: data.subtitle ? String(data.subtitle) : "",
          html,
          tags,
          cover: data.cover ? String(data.cover) : null,
          publish: true,
        },
        existing?.id,
        file,
        Math.floor(date.getTime() / 1000),
      );
      db().prepare("UPDATE posts SET source_hash = ? WHERE source_file = ?").run(hash, file);
      existing ? res.updated++ : res.created++;
    } catch (e) {
      console.error(`[content-sync] ${file}:`, e);
    }
  }
  return res;
}
