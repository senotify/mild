import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Editor } from "@/components/Editor";

export const metadata = { title: "New story", robots: { index: false } };

export default async function NewStory() {
  const u = await currentUser();
  if (!u) redirect("/signup?next=/new-story");
  return <Editor user={u} initial={{ title: "", subtitle: "", html: "", tags: [], cover: null }} />;
}
