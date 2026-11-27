import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { followingPosts, latestPosts, topTags } from "@/lib/posts";
import { PostList } from "@/components/PostCard";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ feed?: string; page?: string }> }) {
  const { feed, page } = await searchParams;
  const u = await currentUser();
  const pageNum = Math.max(1, Number(page) || 1);
  const tab = feed === "following" && u ? "following" : "foryou";
  const posts = tab === "following" ? followingPosts(u!.id, 30) : latestPosts(20, (pageNum - 1) * 20);
  const tags = topTags(12);

  // Tells Google the site's name ("Mild", not "senotify.com") and its logo.
  const siteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: "Mild by senotify",
    url: `${SITE_URL}/`,
    publisher: { "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/`, logo: `${SITE_URL}/icon.png` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
      {!u && (
        <section className="border-b border-ink bg-hero">
          <div className="max-w-[1192px] mx-auto px-6 py-16 sm:py-24">
            <h1 className="font-serif text-[56px] leading-[56px] sm:text-[96px] sm:leading-[95px] tracking-[-0.04em] text-ink">
              {SITE_TAGLINE}
            </h1>
            <p className="mt-8 text-[20px] sm:text-[22px] text-ink max-w-md">A place to read, write, and think out loud about tech.</p>
            <Link href="/signup" className="inline-block mt-10 bg-ink text-bg rounded-full px-10 py-2 text-xl hover:opacity-85">
              Start reading
            </Link>
          </div>
        </section>
      )}
      <main className="max-w-[1336px] mx-auto px-4 sm:px-6 flex gap-16 justify-evenly">
        <div className="w-full max-w-[728px] pt-6">
          <nav className="flex gap-8 border-b border-line text-sm sticky top-[57px] bg-bg z-10">
            <Link href="/" className={`py-4 -mb-px ${tab === "foryou" ? "border-b border-ink text-ink" : "text-muted hover:text-ink"}`}>
              For you
            </Link>
            {u && (
              <Link href="/?feed=following" className={`py-4 -mb-px ${tab === "following" ? "border-b border-ink text-ink" : "text-muted hover:text-ink"}`}>
                Following
              </Link>
            )}
            {tags.slice(0, 4).map((t) => (
              <Link key={t.tag} href={`/tag/${t.tag}`} className="py-4 text-muted hover:text-ink whitespace-nowrap hidden md:block">
                {t.tag}
              </Link>
            ))}
          </nav>
          <PostList posts={posts} empty={tab === "following" ? "Follow writers to see their stories here." : "No stories yet."} />
          {tab === "foryou" && posts.length === 20 && (
            <div className="py-8 flex justify-center">
              <Link href={`/?page=${pageNum + 1}`} className="text-sm border border-ink rounded-full px-5 py-2">Older stories</Link>
            </div>
          )}
        </div>
        <aside className="hidden lg:block w-[368px] shrink-0 border-l border-line pl-10 pt-10">
          <div className="sticky top-[90px]">
            <h2 className="font-medium text-base text-ink">Recommended topics</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((t) => (
                <Link key={t.tag} href={`/tag/${t.tag}`} className="bg-chip rounded-full px-4 py-2 text-sm text-ink hover:bg-chip-hover">
                  {t.tag}
                </Link>
              ))}
            </div>
            <footer className="mt-10 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
              <Link href="/about">About</Link>
              <Link href="/search">Search</Link>
              <a href="/feed.xml">RSS</a>
              <a href="https://senotify.com">senotify.com</a>
            </footer>
          </div>
        </aside>
      </main>
    </>
  );
}
