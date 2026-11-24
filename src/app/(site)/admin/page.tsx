import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { adminBanAction, deletePostAction } from "@/app/actions";

export const metadata = { title: "Admin", robots: { index: false } };

export default async function Admin() {
  const u = await currentUser();
  if (!u?.is_admin) notFound();
  const users = db()
    .prepare(
      `SELECT u.id, u.username, u.name, u.email, u.is_banned, u.is_admin, u.created_at,
       (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) AS posts
       FROM users u ORDER BY u.created_at DESC LIMIT 100`,
    )
    .all() as { id: number; username: string; name: string; email: string; is_banned: number; is_admin: number; created_at: number; posts: number }[];
  const posts = db()
    .prepare(
      `SELECT p.id, p.slug, p.title, p.published_at, u.username FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.status = 'published' ORDER BY p.published_at DESC LIMIT 50`,
    )
    .all() as { id: number; slug: string; title: string; published_at: number; username: string }[];
  const btn = "text-xs border rounded-full px-3 py-1";
  return (
    <main className="max-w-[960px] mx-auto px-6 py-14">
      <h1 className="text-3xl font-bold">Admin</h1>
      <h2 className="mt-10 font-bold">Newest users</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {users.map((x) => (
              <tr key={x.id} className="border-b border-line">
                <td className="py-2"><Link href={`/@${x.username}`} className="text-ink">@{x.username}</Link><div className="text-muted">{x.name}</div></td>
                <td className="text-muted">{x.email}</td>
                <td className="text-muted">{fmtDate(x.created_at, true)}</td>
                <td>{x.posts} posts</td>
                <td className="text-right whitespace-nowrap space-x-2">
                  {!x.is_admin && (
                    <>
                      <form action={adminBanAction} className="inline">
                        <input type="hidden" name="id" value={x.id} />
                        <button className={`${btn} ${x.is_banned ? "border-accent text-accent" : "border-amber-600 text-amber-700"}`}>{x.is_banned ? "Unban" : "Ban"}</button>
                      </form>
                      <form action={adminBanAction} className="inline">
                        <input type="hidden" name="id" value={x.id} />
                        <input type="hidden" name="purge" value="1" />
                        <button className={`${btn} border-red-700 text-red-700`}>Delete user + content</button>
                      </form>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-12 font-bold">Latest stories</h2>
      <div className="mt-4">
        {posts.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-4 py-2 border-b border-line text-sm">
            <Link href={`/@${p.username}/${p.slug}`} className="text-ink truncate">{p.title} <span className="text-muted">by @{p.username} · {fmtDate(p.published_at)}</span></Link>
            <form action={deletePostAction}>
              <input type="hidden" name="id" value={p.id} />
              <button className={`${btn} border-red-700 text-red-700`}>Delete</button>
            </form>
          </div>
        ))}
      </div>
    </main>
  );
}
