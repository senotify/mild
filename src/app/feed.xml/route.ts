import { latestPosts } from "@/lib/posts";
import { rss } from "@/lib/rss";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/format";

export const dynamic = "force-dynamic";

export function GET() {
  return rss(SITE_NAME, SITE_URL, SITE_TAGLINE, latestPosts(30));
}
