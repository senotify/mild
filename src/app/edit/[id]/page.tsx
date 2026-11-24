import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getPostById } from "@/lib/posts";
import { Editor } from "@/components/Editor";

export const metadata = { title: "Edit story", robots: { index: false } };

export default async function EditStory({ params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  const { id } = await params;
  if (!u) redirect(`/login?next=/edit/${id}`);
  const p = getPostById(Number(id));
  if (!p || (p.author_id !== u.id && !u.is_admin)) notFound();
  return (
    <Editor
      user={u}
      initial={{ id: p.id, title: p.title, subtitle: p.subtitle, html: p.body_html, tags: p.tags, cover: p.cover, status: p.status }}
    />
  );
}
