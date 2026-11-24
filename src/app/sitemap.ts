import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const d = db();
  const posts = d
    .prepare(
      `SELECT p.slug, p.updated_at, u.username FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.status = 'published' AND u.is_banned = 0 ORDER BY p.published_at DESC LIMIT 45000`,
    )
    .all() as { slug: string; updated_at: number; username: string }[];
  const authors = d
    .prepare(
      `SELECT u.username, MAX(p.updated_at) AS t FROM users u JOIN posts p ON p.author_id = u.id
       WHERE p.status = 'published' AND u.is_banned = 0 GROUP BY u.id`,
    )
    .all() as { username: string; t: number }[];
  const tags = d
    .prepare(`SELECT DISTINCT t.tag FROM post_tags t JOIN posts p ON p.id = t.post_id WHERE p.status = 'published'`)
    .all() as { tag: string }[];
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    ...posts.map((p) => ({ url: `${SITE_URL}/@${p.username}/${p.slug}`, lastModified: new Date(p.updated_at * 1000), priority: 0.8 })),
    ...authors.map((a) => ({ url: `${SITE_URL}/@${a.username}`, lastModified: new Date(a.t * 1000), priority: 0.5 })),
    ...tags.map((t) => ({ url: `${SITE_URL}/tag/${t.tag}`, priority: 0.4 })),
  ];
}
