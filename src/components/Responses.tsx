import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import type { User } from "@/lib/auth";
import { deleteCommentAction } from "@/app/actions";
import { Avatar } from "./Avatar";
import { ResponseForm } from "./ResponseForm";

type C = { id: number; parent_id: number | null; body: string; created_at: number; user_id: number; username: string; name: string; avatar: string | null };

export function Responses({ postId, postAuthorId, path, viewer }: { postId: number; postAuthorId: number; path: string; viewer: User | null }) {
  const rows = db()
    .prepare(
      `SELECT c.id, c.parent_id, c.body, c.created_at, c.user_id, u.username, u.name, u.avatar
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ? AND u.is_banned = 0 ORDER BY c.created_at`,
    )
    .all(postId) as C[];
  const top = rows.filter((r) => !r.parent_id).reverse();
  const kids = (id: number) => rows.filter((r) => r.parent_id === id);

  const One = ({ c, depth }: { c: C; depth: number }) => (
    <div className={depth ? "ml-6 pl-4 border-l-[3px] border-line mt-6" : "py-6 border-b border-line"}>
      <div className="flex items-center gap-3">
        <Avatar name={c.name} src={c.avatar} size={32} />
        <div className="text-sm">
          <Link href={`/@${c.username}`} className="text-ink">{c.name}</Link>
          <div className="text-muted">{fmtDate(c.created_at)}</div>
        </div>
      </div>
      <p className="mt-3 text-[14px] leading-5 text-ink whitespace-pre-wrap break-words">{c.body}</p>
      <div className="mt-3 flex gap-4 text-sm text-muted">
        {viewer && depth < 2 && <ResponseForm postId={postId} parentId={c.id} compact />}
        {viewer && (viewer.id === c.user_id || viewer.id === postAuthorId || viewer.is_admin) ? (
          <form action={deleteCommentAction}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="path" value={path} />
            <button className="hover:text-ink">Delete</button>
          </form>
        ) : null}
      </div>
      {kids(c.id).map((k) => <One key={k.id} c={k} depth={depth + 1} />)}
    </div>
  );

  return (
    <section id="responses" className="mt-12 scroll-mt-20">
      <h2 className="text-xl font-bold text-ink">Responses ({rows.length})</h2>
      <div className="mt-6">
        {viewer ? (
          <ResponseForm postId={postId} />
        ) : (
          <p className="text-sm text-muted">
            <Link href={`/signup?next=${encodeURIComponent(path)}`} className="underline text-ink">Sign up</Link> or{" "}
            <Link href={`/login?next=${encodeURIComponent(path)}`} className="underline text-ink">sign in</Link> to respond.
          </p>
        )}
      </div>
      <div>{top.map((c) => <One key={c.id} c={c} depth={0} />)}</div>
    </section>
  );
}
