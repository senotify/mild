"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { commentAction, type FormState } from "@/app/actions";

export function ResponseForm({ postId, parentId, compact }: { postId: number; parentId?: number; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const [state, action, pending] = useActionState<FormState, FormData>(commentAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && !state.error && !pending) {
      ref.current?.reset();
      if (compact) setOpen(false);
    }
  }, [state, pending, compact]);

  if (!open) return <button onClick={() => setOpen(true)} className="hover:text-ink">Reply</button>;
  return (
    <form ref={ref} action={action} className={compact ? "w-full basis-full" : "shadow-[var(--menu-shadow)] rounded p-4"}>
      <input type="hidden" name="postId" value={postId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <textarea
        name="body"
        required
        maxLength={5000}
        placeholder={parentId ? "Write a reply..." : "What are your thoughts?"}
        className="w-full resize-y min-h-20 outline-none text-sm text-ink bg-field rounded p-3"
      />
      {state?.error && <p className="text-sm text-danger mt-1">{state.error}</p>}
      <div className="mt-2 flex justify-end gap-3">
        {compact && <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted">Cancel</button>}
        <button disabled={pending} className="bg-accent hover:bg-accent-dark text-on-accent text-sm rounded-full px-4 py-1.5 disabled:opacity-50">
          {pending ? "Posting..." : "Respond"}
        </button>
      </div>
    </form>
  );
}
