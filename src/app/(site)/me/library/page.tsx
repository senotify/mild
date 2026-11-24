import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { bookmarkedPosts } from "@/lib/posts";
import { PostList } from "@/components/PostCard";

export const metadata = { title: "Your library", robots: { index: false } };

export default async function Library() {
  const u = await currentUser();
  if (!u) redirect("/login?next=/me/library");
  return (
    <main className="max-w-[728px] mx-auto px-6 pt-14">
      <h1 className="text-[42px] font-medium tracking-tight text-ink">Your library</h1>
      <PostList posts={bookmarkedPosts(u.id)} empty="Save stories with the bookmark icon to read them later." />
    </main>
  );
}
