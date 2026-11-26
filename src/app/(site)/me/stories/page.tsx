import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Your stories", robots: { index: false } };

export default async function Stories({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const u = await currentUser();
  if (!u) redirect("/login?next=/me/stories");
  const tab = (await searchParams).tab === "drafts" ? "draft" : "published";
  const rows = db()
    .prepare("SELECT id, slug, title, updated_at, published_at, reading_minutes FROM posts WHERE author_id = ? AND status = ? ORDER BY updated_at DESC")
    .all(u.id, tab) as { id: number; slug: string; title: string; updated_at: number; published_at: number; reading_minutes: number }[];
  return (
    <main className="max-w-[728px] mx-auto px-6 pt-14">
      <div className="flex items-center justify-between">
        <h1 className="text-[42px] font-medium tracking-tight text-ink">Your stories</h1>
        <Link href="/new-story" className="bg-accent text-on-accent text-sm rounded-full px-4 py-2">Write a story</Link>
      </div>
      <nav className="mt-8 flex gap-8 border-b border-line text-sm">
        <Link href="/me/stories?tab=drafts" className={`pb-4 -mb-px ${tab === "draft" ? "border-b border-ink text-ink" : "text-muted"}`}>Drafts</Link>
        <Link href="/me/stories" className={`pb-4 -mb-px ${tab === "published" ? "border-b border-ink text-ink" : "text-muted"}`}>Published</Link>
      </nav>
      {rows.length === 0 && <p className="py-10 text-muted">Nothing here yet.</p>}
      {rows.map((r) => (
        <div key={r.id} className="py-6 border-b border-line">
          <Link href={tab === "draft" ? `/edit/${r.id}` : `/@${u.username}/${r.slug}`} className="font-bold text-ink text-lg">{r.title}</Link>
          <div className="mt-2 text-sm text-muted flex gap-4">
            <span>{tab === "draft" ? `Last edited ${fmtDate(r.updated_at)}` : `Published ${fmtDate(r.published_at)}`}</span>
            <span>{r.reading_minutes} min read</span>
            <Link href={`/edit/${r.id}`} className="hover:text-ink">Edit</Link>
          </div>
        </div>
      ))}
    </main>
  );
}
