import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { normalizeTag, postsByTag } from "@/lib/posts";
import { PostList } from "@/components/PostCard";
import { SITE_URL } from "@/lib/format";

type Params = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const tag = normalizeTag(decodeURIComponent((await params).tag));
  return {
    title: `The most insightful stories about ${tag}`,
    description: `Read stories about ${tag} on Mild.`,
    alternates: { canonical: `${SITE_URL}/tag/${tag}` },
  };
}

export default async function TagPage({ params }: Params) {
  const tag = normalizeTag(decodeURIComponent((await params).tag));
  if (!tag) notFound();
  const posts = postsByTag(tag);
  return (
    <main className="max-w-[728px] mx-auto px-6">
      <div className="pt-16 pb-10 text-center">
        <h1 className="font-sans font-medium text-[42px] leading-[52px] tracking-tight text-ink">{tag}</h1>
        <p className="mt-2 text-muted text-sm">{posts.length} {posts.length === 1 ? "story" : "stories"}</p>
      </div>
      <PostList posts={posts} empty="No stories with this tag yet." />
    </main>
  );
}
