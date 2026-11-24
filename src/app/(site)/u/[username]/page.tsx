import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { postsByAuthor } from "@/lib/posts";
import { SITE_URL } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { PostList } from "@/components/PostCard";
import { FollowButton } from "@/components/Interactions";

type Params = { params: Promise<{ username: string }>; searchParams: Promise<{ tab?: string }> };
type U = { id: number; username: string; name: string; bio: string; avatar: string | null; created_at: number };

function getUser(username: string) {
  return db()
    .prepare("SELECT id, username, name, bio, avatar, created_at FROM users WHERE username = ? AND is_banned = 0")
    .get(decodeURIComponent(username)) as U | undefined;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const u = getUser((await params).username);
  if (!u) return { title: "Not found" };
  return {
    title: `${u.name} (@${u.username})`,
    description: u.bio || `Read stories from ${u.name} on Mild.`,
    alternates: {
      canonical: `${SITE_URL}/@${u.username}`,
      types: { "application/rss+xml": `${SITE_URL}/@${u.username}/feed.xml` },
    },
    openGraph: { type: "profile", title: u.name, description: u.bio },
  };
}

export default async function Profile({ params, searchParams }: Params) {
  const u = getUser((await params).username);
  if (!u) notFound();
  const { tab } = await searchParams;
  const viewer = await currentUser();
  const posts = postsByAuthor(u.id);
  const followers = (db().prepare("SELECT COUNT(*) AS n FROM follows WHERE followee_id = ?").get(u.id) as { n: number }).n;
  const followingCount = (db().prepare("SELECT COUNT(*) AS n FROM follows WHERE follower_id = ?").get(u.id) as { n: number }).n;
  const following = viewer ? !!db().prepare("SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?").get(viewer.id, u.id) : false;
  const own = viewer?.id === u.id;
  const about = tab === "about";

  const card = (
    <div>
      <Avatar name={u.name} src={u.avatar} size={88} />
      <h2 className="mt-4 font-medium text-base text-ink">{u.name}</h2>
      <div className="text-muted text-base">{followers} follower{followers === 1 ? "" : "s"}</div>
      {u.bio && <p className="mt-3 text-sm text-muted">{u.bio}</p>}
      <div className="mt-6">
        {own ? (
          <Link href="/me/settings" className="text-sm text-accent hover:underline">Edit profile</Link>
        ) : (
          <FollowButton username={u.username} following={following} />
        )}
      </div>
    </div>
  );

  return (
    <main className="max-w-[1336px] mx-auto px-6 flex gap-16 justify-evenly">
      <div className="w-full max-w-[680px]">
        <div className="lg:hidden pt-10 flex items-center gap-4">
          <Avatar name={u.name} src={u.avatar} size={48} />
          <div>
            <div className="font-bold text-xl">{u.name}</div>
            <div className="text-sm text-muted">{followers} followers</div>
          </div>
        </div>
        <h1 className="hidden lg:block pt-14 font-sans font-medium text-[42px] leading-[52px] tracking-[-0.016em] text-ink">{u.name}</h1>
        <nav className="mt-8 flex gap-8 border-b border-line text-sm">
          <Link href={`/@${u.username}`} className={`pb-4 -mb-px ${!about ? "border-b border-ink text-ink" : "text-muted"}`}>Home</Link>
          <Link href={`/@${u.username}?tab=about`} className={`pb-4 -mb-px ${about ? "border-b border-ink text-ink" : "text-muted"}`}>About</Link>
        </nav>
        {about ? (
          <div className="py-10 text-ink">
            <p className="font-serif text-lg whitespace-pre-wrap">{u.bio || `${u.name} hasn't written a bio yet.`}</p>
            <p className="mt-8 text-sm text-muted">
              Member since {new Date(u.created_at * 1000).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <p className="mt-2 text-sm text-accent">{followers} followers · {followingCount} following</p>
          </div>
        ) : (
          <PostList posts={posts} hideAuthor empty={own ? "You haven't published anything yet." : "No stories yet."} />
        )}
      </div>
      <aside className="hidden lg:block w-[368px] shrink-0 border-l border-line pl-10 pt-10">
        <div className="sticky top-[90px]">{card}</div>
      </aside>
    </main>
  );
}
