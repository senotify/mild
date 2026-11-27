import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPostBySlug, postUrl, postsByAuthor } from "@/lib/posts";
import { SITE_NAME, SITE_URL, fmtDate } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { BookmarkButton, ClapButton, FollowButton, ResponsesLink, ShareButton } from "@/components/Interactions";
import { Responses } from "@/components/Responses";
import { PostCard } from "@/components/PostCard";
import { deletePostAction } from "@/app/actions";

type Params = { params: Promise<{ username: string; slug: string }> };

async function load({ params }: Params) {
  const { username, slug } = await params;
  const p = getPostBySlug(slug);
  if (!p || p.username.toLowerCase() !== decodeURIComponent(username).toLowerCase()) return null;
  return p;
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const p = await load(props);
  if (!p || p.status !== "published") return { title: "Not found", robots: { index: false } };
  const url = `${SITE_URL}${postUrl(p.username, p.slug)}`;
  const description = (p.subtitle || p.excerpt).slice(0, 155);
  return {
    title: p.title,
    description,
    alternates: { canonical: url },
    authors: [{ name: p.author_name, url: `${SITE_URL}/@${p.username}` }],
    keywords: p.tags,
    openGraph: {
      type: "article",
      url,
      title: p.title,
      description,
      siteName: SITE_NAME,
      publishedTime: new Date(p.published_at * 1000).toISOString(),
      modifiedTime: new Date(p.updated_at * 1000).toISOString(),
      authors: [p.author_name],
      tags: p.tags,
      ...(p.cover ? { images: [{ url: p.cover }] } : {}),
    },
    twitter: { card: p.cover ? "summary_large_image" : "summary", title: p.title, description },
  };
}

export default async function StoryPage(props: Params) {
  const p = await load(props);
  if (!p) notFound();
  const viewer = await currentUser();
  const own = viewer?.id === p.author_id;
  // Drafts are visible only to their author (and admins).
  if (p.status !== "published" && !own && !viewer?.is_admin) notFound();

  const path = postUrl(p.username, p.slug);
  const mine = viewer
    ? ((db().prepare("SELECT count FROM claps WHERE post_id = ? AND user_id = ?").get(p.id, viewer.id) as { count: number } | undefined)?.count ?? 0)
    : 0;
  const saved = viewer ? !!db().prepare("SELECT 1 FROM bookmarks WHERE user_id = ? AND post_id = ?").get(viewer.id, p.id) : false;
  const following = viewer ? !!db().prepare("SELECT 1 FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = ? AND u.id = ?").get(viewer.id, p.author_id) : false;
  const followers = (db().prepare("SELECT COUNT(*) AS n FROM follows WHERE followee_id = ?").get(p.author_id) as { n: number }).n;
  const more = postsByAuthor(p.author_id, 5).filter((x) => x.id !== p.id).slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: p.subtitle || p.excerpt,
    datePublished: new Date(p.published_at * 1000).toISOString(),
    dateModified: new Date(p.updated_at * 1000).toISOString(),
    author: { "@type": "Person", name: p.author_name, url: `${SITE_URL}/@${p.username}` },
    mainEntityOfPage: `${SITE_URL}${path}`,
    keywords: p.tags.join(", "),
    ...(p.cover ? { image: p.cover.startsWith("/") ? `${SITE_URL}${p.cover}` : p.cover } : {}),
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.png` } },
  };

  const actionBar = (
    <div className="flex items-center justify-between border-y border-line px-2 py-[10px] text-muted">
      <div className="flex items-center gap-6">
        <ClapButton postId={p.id} total={p.claps} mine={mine} own={own} />
        <ResponsesLink count={p.responses} />
      </div>
      <div className="flex items-center gap-6">
        <BookmarkButton postId={p.id} saved={saved} />
        <ShareButton title={p.title} />
      </div>
    </div>
  );

  return (
    <main className="px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="max-w-[680px] mx-auto pt-10 sm:pt-14">
        {p.status !== "published" && (
          <div className="mb-6 text-sm bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 rounded px-4 py-2">Draft, only visible to you.</div>
        )}
        <h1 className="font-sans font-bold text-[32px] leading-[38px] sm:text-[42px] sm:leading-[52px] tracking-[-0.022em] text-ink">{p.title}</h1>

        <div className="mt-8 mb-8 flex items-center gap-3">
          <Link href={`/@${p.username}`}><Avatar name={p.author_name} src={p.author_avatar} size={44} /></Link>
          <div className="text-[14px] sm:text-[16px] leading-5">
            <div className="flex items-center gap-2">
              <Link href={`/@${p.username}`} className="text-ink hover:underline">{p.author_name}</Link>
              {!own && (
                <>
                  <span className="text-muted">·</span>
                  <FollowButton username={p.username} following={following} small />
                </>
              )}
            </div>
            <div className="text-muted text-[14px] mt-1">
              {p.reading_minutes} min read · {fmtDate(p.published_at)}
            </div>
          </div>
        </div>

        {actionBar}

        {own || viewer?.is_admin ? (
          <div className="flex gap-4 text-sm mt-4">
            <Link href={`/edit/${p.id}`} className="text-accent hover:underline">Edit story</Link>
            <form action={deletePostAction}>
              <input type="hidden" name="id" value={p.id} />
              <button className="text-danger hover:underline">Delete</button>
            </form>
          </div>
        ) : null}

        {p.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.cover} alt="" className="mt-10 w-full" />
        )}

        <div className="story mt-10" dangerouslySetInnerHTML={{ __html: p.body_html }} />

        {p.tags.length > 0 && (
          <div className="mt-12 flex flex-wrap gap-2">
            {p.tags.map((t) => (
              <Link key={t} href={`/tag/${t}`} className="bg-chip rounded-full px-4 py-2 text-sm text-ink hover:bg-chip-hover">{t}</Link>
            ))}
          </div>
        )}

        <div className="mt-8">{actionBar}</div>

        <section className="mt-14 pb-10 border-b border-line">
          <Link href={`/@${p.username}`}><Avatar name={p.author_name} src={p.author_avatar} size={64} /></Link>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <Link href={`/@${p.username}`} className="text-2xl font-medium text-ink">Written by {p.author_name}</Link>
              <div className="mt-2 text-sm text-muted">{followers} follower{followers === 1 ? "" : "s"}</div>
              {p.author_bio && <p className="mt-3 text-sm text-ink">{p.author_bio}</p>}
            </div>
            {!own && <FollowButton username={p.username} following={following} />}
          </div>
        </section>

        <Responses postId={p.id} postAuthorId={p.author_id} path={path} viewer={viewer} />

        {more.length > 0 && (
          <section className="mt-16 pb-20">
            <h2 className="text-base font-medium text-ink">More from {p.author_name}</h2>
            {more.map((m) => <PostCard key={m.id} p={m} hideAuthor />)}
          </section>
        )}
      </article>
    </main>
  );
}
