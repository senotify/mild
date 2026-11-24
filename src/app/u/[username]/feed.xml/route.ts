import { db } from "@/lib/db";
import { postsByAuthor } from "@/lib/posts";
import { rss } from "@/lib/rss";
import { SITE_URL } from "@/lib/format";

export async function GET(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const u = db().prepare("SELECT id, username, name, bio FROM users WHERE username = ? AND is_banned = 0").get(decodeURIComponent(username)) as
    | { id: number; username: string; name: string; bio: string }
    | undefined;
  if (!u) return new Response("Not found", { status: 404 });
  return rss(`${u.name} on Mild`, `${SITE_URL}/@${u.username}`, u.bio || `Stories by ${u.name}`, postsByAuthor(u.id, 30));
}
