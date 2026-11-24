"use client";
import { useActionState, useState } from "react";
import { updateProfileAction, type FormState } from "@/app/actions";
import { Avatar } from "./Avatar";

export function SettingsForm({ name, bio, avatar }: { name: string; bio: string; avatar: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, undefined);
  const [img, setImg] = useState(avatar || "");
  const [err, setErr] = useState("");
  const input = "w-full border-b border-[#e6e6e6] focus:border-ink outline-none py-2 text-ink";
  return (
    <form action={action} className="mt-10 space-y-8">
      <div className="flex items-center gap-4">
        <Avatar name={name} src={img || null} size={80} />
        <label className="text-sm text-accent cursor-pointer">
          Update photo
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const fd = new FormData();
              fd.append("file", f);
              const r = await fetch("/api/upload", { method: "POST", body: fd });
              const j = await r.json();
              if (r.ok) setImg(j.url); else setErr(j.error);
            }}
          />
        </label>
        {img && <button type="button" className="text-sm text-muted" onClick={() => setImg("")}>Remove</button>}
        <input type="hidden" name="avatar" value={img} />
      </div>
      <label className="block text-sm text-muted">Name<input name="name" defaultValue={name} maxLength={60} required className={input} /></label>
      <label className="block text-sm text-muted">Short bio<textarea name="bio" defaultValue={bio} maxLength={300} rows={3} className={input} /></label>
      {(err || state?.error) && <p className="text-sm text-red-700">{err || state?.error}</p>}
      {state && !state.error && !pending && <p className="text-sm text-accent">Saved.</p>}
      <button disabled={pending} className="bg-accent text-white rounded-full px-5 py-2 text-sm disabled:opacity-50">{pending ? "Saving..." : "Save"}</button>
    </form>
  );
}
