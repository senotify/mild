"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { savePostAction } from "@/app/actions";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";

type Initial = { id?: number; title: string; subtitle: string; html: string; tags: string[]; cover: string | null; status?: string };

async function upload(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Upload failed");
  return j.url;
}

export function Editor({ initial, user }: { initial: Initial; user: { name: string; avatar: string | null; username: string } }) {
  const router = useRouter();
  const [id, setId] = useState(initial.id);
  const [title, setTitle] = useState(initial.title);
  const [subtitle, setSubtitle] = useState(initial.subtitle);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [tagInput, setTagInput] = useState("");
  const [cover, setCover] = useState<string | null>(initial.cover);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [showPublish, setShowPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const dirty = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true } }),
      Image,
      Placeholder.configure({ placeholder: "Tell your story..." }),
    ],
    content: initial.html,
    editorProps: { attributes: { class: "story" } },
    onUpdate: () => { dirty.current = true; setStatus("idle"); },
  });

  useEffect(() => {
    const el = titleRef.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  }, [title]);

  const save = async (publish: boolean) => {
    if (!editor) return;
    setError("");
    setStatus("saving");
    const r = await savePostAction({ id, title: title || "Untitled", subtitle, html: editor.getHTML(), tags, cover, publish });
    if (r.error) { setStatus("error"); setError(r.error); return null; }
    dirty.current = false;
    setStatus("saved");
    if (r.id && !id) { setId(r.id); window.history.replaceState(null, "", `/edit/${r.id}`); }
    return r;
  };

  // Autosave drafts every few seconds while typing (published stories save on demand).
  useEffect(() => {
    if (initial.status === "published") return;
    const t = setInterval(() => {
      if (dirty.current && (title.trim() || (editor && !editor.isEmpty))) void save(false);
    }, 8000);
    return () => clearInterval(t);
  });

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
    if (t && !tags.includes(t) && tags.length < 5) setTags([...tags, t]);
    setTagInput("");
  };

  const insertImage = async (file?: File) => {
    if (!file || !editor) return;
    try {
      const url = await upload(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (e) { setError((e as Error).message); }
  };

  const tb = "px-2 py-1 rounded text-sm hover:bg-[#f2f2f2]";
  const on = (n: string, a?: object) => (editor?.isActive(n, a) ? "bg-[#f2f2f2] text-ink" : "text-muted");

  return (
    <div className="min-h-screen bg-white">
      <header className="max-w-[1032px] mx-auto px-6 h-[65px] flex items-center gap-4">
        <Link href="/" className="text-ink"><Logo /></Link>
        <span className="text-sm text-ink hidden sm:inline">Draft in {user.name}</span>
        <span className="text-sm text-muted">{status === "saving" ? "Saving..." : status === "saved" ? "Saved" : ""}</span>
        <div className="ml-auto flex items-center gap-4">
          {initial.status === "published" ? (
            <button onClick={async () => { const r = await save(true); if (r?.url) router.push(r.url); }} className="bg-accent hover:bg-accent-dark text-white text-sm rounded-full px-4 py-1.5">
              Save and publish
            </button>
          ) : (
            <button disabled={!title.trim()} onClick={() => setShowPublish(true)} className="bg-accent hover:bg-accent-dark text-white text-sm rounded-full px-4 py-1.5 disabled:opacity-40">
              Publish
            </button>
          )}
          <Avatar name={user.name} src={user.avatar} size={32} />
        </div>
      </header>

      <div className="sticky top-0 z-10 bg-white/95 border-b border-line">
        <div className="max-w-[740px] mx-auto px-6 py-2 flex flex-wrap gap-1">
          <button className={`${tb} font-bold ${on("bold")}`} onClick={() => editor?.chain().focus().toggleBold().run()}>B</button>
          <button className={`${tb} italic ${on("italic")}`} onClick={() => editor?.chain().focus().toggleItalic().run()}>i</button>
          <button className={`${tb} ${on("heading", { level: 2 })}`} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>T</button>
          <button className={`${tb} text-xs ${on("heading", { level: 3 })}`} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>T</button>
          <button className={`${tb} ${on("blockquote")}`} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>“</button>
          <button className={`${tb} font-mono ${on("codeBlock")}`} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>{"{ }"}</button>
          <button className={`${tb} ${on("bulletList")}`} onClick={() => editor?.chain().focus().toggleBulletList().run()}>• List</button>
          <button className={`${tb} ${on("orderedList")}`} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>1. List</button>
          <button
            className={`${tb} ${on("link")}`}
            onClick={() => {
              if (editor?.isActive("link")) return editor.chain().focus().unsetLink().run();
              const url = prompt("Link URL");
              if (url && /^https?:\/\//.test(url)) editor?.chain().focus().setLink({ href: url }).run();
            }}
          >
            Link
          </button>
          <label className={`${tb} text-muted cursor-pointer`}>
            Image
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => insertImage(e.target.files?.[0])} />
          </label>
          <button className={`${tb} text-muted`} onClick={() => editor?.chain().focus().setHorizontalRule().run()}>···</button>
        </div>
      </div>

      <main className="max-w-[740px] mx-auto px-6 pt-10 pb-40">
        {error && <p className="mb-4 text-sm text-red-700">{error}</p>}
        <textarea
          ref={titleRef}
          value={title}
          onChange={(e) => { setTitle(e.target.value.replace(/\n/g, "")); dirty.current = true; }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); editor?.commands.focus("start"); } }}
          placeholder="Title"
          rows={1}
          maxLength={200}
          className="w-full resize-none overflow-hidden outline-none font-serif text-[42px] leading-[52px] text-ink placeholder:text-[#b3b3b1]"
        />
        <div className="mild-editor mt-4">
          <EditorContent editor={editor} />
        </div>
      </main>

      {showPublish && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="max-w-[1040px] mx-auto px-6 py-10 sm:py-20 grid sm:grid-cols-2 gap-12">
            <div>
              <h2 className="font-bold text-ink">Story Preview</h2>
              <label className="mt-4 block bg-[#fafafa] aspect-[16/9] flex items-center justify-center text-sm text-muted cursor-pointer overflow-hidden">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" className="w-full h-full object-cover" />
                ) : (
                  "Add a cover image (optional)"
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) try { setCover(await upload(f)); } catch (err) { setError((err as Error).message); }
                  }}
                />
              </label>
              <p className="mt-6 font-bold text-ink border-b border-line pb-2">{title}</p>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                maxLength={300}
                placeholder="Write a preview subtitle..."
                className="mt-3 w-full border-b border-line pb-2 text-sm outline-none"
              />
              <p className="mt-4 text-xs text-muted">Changes here affect how your story appears in feeds and search results, not the story itself.</p>
            </div>
            <div>
              <p className="text-ink">Publishing to: <b>{user.name}</b></p>
              <p className="mt-6 text-sm text-muted">Add or change topics (up to 5) so readers know what your story is about</p>
              <div className="mt-3 bg-[#fafafa] p-2 flex flex-wrap gap-2 min-h-12">
                {tags.map((t) => (
                  <span key={t} className="bg-white border border-line rounded px-2 py-1 text-sm flex items-center gap-2">
                    {t}
                    <button onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>×</button>
                  </span>
                ))}
                {tags.length < 5 && (
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }}
                    onBlur={() => tagInput && addTag(tagInput)}
                    placeholder="Add a topic..."
                    className="bg-transparent outline-none text-sm flex-1 min-w-24"
                  />
                )}
              </div>
              {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
              <div className="mt-8 flex items-center gap-4">
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const r = await save(true);
                    setBusy(false);
                    if (r?.url) router.push(r.url);
                  }}
                  className="bg-accent hover:bg-accent-dark text-white text-sm rounded-full px-4 py-2 disabled:opacity-50"
                >
                  {busy ? "Publishing..." : "Publish now"}
                </button>
                <button onClick={() => setShowPublish(false)} className="text-sm text-muted">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
