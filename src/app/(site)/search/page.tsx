import type { Metadata } from "next";
import Link from "next/link";
import { searchPeople, searchPosts, searchTags } from "@/lib/posts";
import { PostList } from "@/components/PostCard";
import { Avatar } from "@/components/Avatar";
import { SearchIcon } from "@/components/Icons";

type P = { searchParams: Promise<{ q?: string; tab?: string }> };

export async function generateMetadata({ searchParams }: P): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `Search results for ${q}` : "Search", robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: P) {
  const { q = "", tab = "stories" } = await searchParams;
  const query = q.trim().slice(0, 100);
  const tabs = [
    ["stories", "Stories"],
    ["people", "People"],
    ["tags", "Tags"],
  ] as const;
  return (
    <main className="max-w-[728px] mx-auto px-6 pt-10">
      <form action="/search" className="flex items-center gap-2 border-b border-line pb-3">
        <SearchIcon className="text-muted" />
        <input name="q" defaultValue={query} autoFocus placeholder="Search Mild" className="w-full text-2xl outline-none placeholder:text-faint" />
        <input type="hidden" name="tab" value={tab} />
      </form>
      {query && (
        <>
          <h1 className="mt-10 text-[42px] leading-[52px] font-medium tracking-tight text-muted">
            Results for <span className="text-ink">{query}</span>
          </h1>
          <nav className="mt-8 flex gap-8 border-b border-line text-sm">
            {tabs.map(([k, label]) => (
              <Link key={k} href={`/search?q=${encodeURIComponent(query)}&tab=${k}`} className={`pb-4 -mb-px ${tab === k ? "border-b border-ink text-ink" : "text-muted"}`}>
                {label}
              </Link>
            ))}
          </nav>
          {tab === "people" ? (
            <div className="py-6">
              {searchPeople(query).map((u) => (
                <Link key={u.username} href={`/@${u.username}`} className="flex items-center gap-4 py-4">
                  <Avatar name={u.name} src={u.avatar} size={48} />
                  <div>
                    <div className="font-medium text-ink">{u.name}</div>
                    <div className="text-sm text-muted line-clamp-2">{u.bio || `@${u.username}`}</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : tab === "tags" ? (
            <div className="py-8 flex flex-wrap gap-3">
              {searchTags(query).map((t) => (
                <Link key={t.tag} href={`/tag/${t.tag}`} className="bg-chip rounded-full px-4 py-2 text-sm text-ink">
                  {t.tag} <span className="text-muted">· {t.n}</span>
                </Link>
              ))}
            </div>
          ) : (
            <PostList posts={searchPosts(query)} empty="Make sure all words are spelled correctly, or try different keywords." />
          )}
        </>
      )}
    </main>
  );
}
