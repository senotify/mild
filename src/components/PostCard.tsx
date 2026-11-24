import Link from "next/link";
import type { PostCard as P } from "@/lib/posts";
import { postUrl } from "@/lib/posts";
import { compact, fmtDate } from "@/lib/format";
import { Avatar } from "./Avatar";
import { ClapIcon, ResponseIcon } from "./Icons";

export function PostCard({ p, hideAuthor }: { p: P; hideAuthor?: boolean }) {
  const href = postUrl(p.username, p.slug);
  return (
    <article className="py-8 border-b border-line">
      {!hideAuthor && (
        <Link href={`/@${p.username}`} className="flex items-center gap-2 text-[13px] text-ink mb-3">
          <Avatar name={p.author_name} src={p.author_avatar} size={20} />
          <span>{p.author_name}</span>
        </Link>
      )}
      <Link href={href} className="flex gap-6 sm:gap-14 items-start">
        <div className="flex-1 min-w-0">
          <h2 className="font-sans font-bold text-[16px] leading-5 sm:text-[22px] sm:leading-7 tracking-tight text-ink line-clamp-3">{p.title}</h2>
          <p className="hidden sm:block mt-2 text-[16px] leading-6 text-muted line-clamp-2">{p.subtitle || p.excerpt}</p>
          <div className="mt-4 flex items-center gap-5 text-[13px] text-muted">
            <span>{fmtDate(p.published_at)}</span>
            <span>{p.reading_minutes} min read</span>
            {p.claps > 0 && (
              <span className="flex items-center gap-1"><ClapIcon size={16} /> {compact(p.claps)}</span>
            )}
            {p.responses > 0 && (
              <span className="flex items-center gap-1"><ResponseIcon size={16} /> {p.responses}</span>
            )}
          </div>
        </div>
        {p.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.cover} alt="" loading="lazy" className="w-20 h-14 sm:w-40 sm:h-[107px] object-cover shrink-0" />
        )}
      </Link>
    </article>
  );
}

export function PostList({ posts, hideAuthor, empty }: { posts: P[]; hideAuthor?: boolean; empty?: string }) {
  if (!posts.length) return <p className="py-10 text-muted">{empty ?? "Nothing here yet."}</p>;
  return <div>{posts.map((p) => <PostCard key={p.id} p={p} hideAuthor={hideAuthor} />)}</div>;
}
