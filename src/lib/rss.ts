import type { PostCard } from "./posts";
import { SITE_URL } from "./format";

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

export function rss(title: string, link: string, description: string, posts: PostCard[]) {
  const items = posts
    .map((p) => {
      const url = `${SITE_URL}/@${p.username}/${p.slug}`;
      return `<item><title>${esc(p.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><dc:creator>${esc(p.author_name)}</dc:creator><pubDate>${new Date(p.published_at * 1000).toUTCString()}</pubDate><description>${esc(p.subtitle || p.excerpt)}</description></item>`;
    })
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(title)}</title><link>${link}</link><atom:link href="${link.replace(/\/$/, "")}/feed.xml" rel="self" type="application/rss+xml"/><description>${esc(description)}</description><language>en</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
