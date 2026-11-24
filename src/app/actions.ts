"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  RESERVED,
  checkPassword,
  createSession,
  currentUser,
  destroySession,
  hashPassword,
  requireUser,
} from "@/lib/auth";
import { limit } from "@/lib/ratelimit";
import { deletePost, getPostById, postUrl, savePost } from "@/lib/posts";
import { OWNER } from "@/lib/content-sync";

function safeNext(v: FormDataEntryValue | null) {
  const next = String(v || "/");
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export type FormState = { error?: string } | undefined;

// ---------- auth ----------

export async function signupAction(_: FormState, fd: FormData): Promise<FormState> {
  // Honeypot: real people never see or fill this field.
  if (String(fd.get("website") || "")) return { error: "Something went wrong" };
  if (!(await limit("signup", 5, 3600))) return { error: "Too many sign-ups from your network. Try again later." };

  const username = String(fd.get("username") || "").trim().toLowerCase();
  const name = String(fd.get("name") || "").trim().slice(0, 60);
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");

  if (!/^[a-z0-9_]{3,24}$/.test(username)) return { error: "Username: 3-24 letters, numbers or underscores" };
  if (RESERVED.has(username)) return { error: "That username is taken" };
  if (!name) return { error: "Enter your name" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return { error: "Enter a valid email" };
  if (password.length < 8 || password.length > 200) return { error: "Password must be at least 8 characters" };

  const exists = db().prepare("SELECT 1 FROM users WHERE username = ? OR email = ?").get(username, email);
  if (exists) return { error: "That username or email is already registered" };

  const id = Number(
    db()
      .prepare("INSERT INTO users(username, email, password_hash, name) VALUES (?,?,?,?)")
      .run(username, email, await hashPassword(password), name).lastInsertRowid,
  );
  await createSession(id);
  redirect(safeNext(fd.get("next")));
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await limit("login", 10, 900))) return { error: "Too many attempts. Wait a few minutes." };
  const login = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const u = db()
    .prepare("SELECT id, password_hash, is_banned FROM users WHERE email = ? OR username = ?")
    .get(login, login) as { id: number; password_hash: string; is_banned: number } | undefined;
  if (!u || !(await checkPassword(u.password_hash, password))) return { error: "Wrong email or password" };
  if (u.is_banned) return { error: "This account is suspended" };
  await createSession(u.id);
  redirect(safeNext(fd.get("next")));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

// ---------- posts ----------

export async function savePostAction(input: {
  id?: number;
  title: string;
  subtitle: string;
  html: string;
  tags: string[];
  cover: string | null;
  publish: boolean;
}): Promise<{ error?: string; url?: string; id?: number }> {
  const u = await currentUser();
  if (!u) return { error: "Sign in first" };
  if (!(await limit("save", 120, 3600, String(u.id)))) return { error: "Slow down a little" };
  if (input.html.length > 400_000) return { error: "That story is too long" };

  if (input.id) {
    const p = getPostById(input.id);
    if (!p || (p.author_id !== u.id && !u.is_admin)) return { error: "Not your story" };
  }
  if (input.publish && u.username !== OWNER) {
    // New accounts are the usual spam vector: cap fresh publishes per day.
    const n = db()
      .prepare("SELECT COUNT(*) AS n FROM posts WHERE author_id = ? AND published_at > unixepoch() - 86400")
      .get(u.id) as { n: number };
    const already = input.id ? (getPostById(input.id)?.status === "published" ? 1 : 0) : 0;
    if (!already && n.n >= 3) return { error: "You can publish up to 3 stories a day" };
  }
  try {
    const slug = savePost({ id: u.id, trusted: u.username === OWNER }, input, input.id);
    const id = (db().prepare("SELECT id FROM posts WHERE slug = ?").get(slug) as { id: number }).id;
    revalidatePath("/");
    return { url: postUrl(u.username, slug), id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deletePostAction(fd: FormData) {
  const u = await requireUser();
  const id = Number(fd.get("id"));
  const p = getPostById(id);
  if (!p || (p.author_id !== u.id && !u.is_admin)) return;
  deletePost(id);
  revalidatePath("/");
  redirect(`/@${u.username}`);
}

// ---------- social ----------

export async function clapAction(postId: number, add: number): Promise<{ mine: number; total: number } | { error: string }> {
  const u = await currentUser();
  if (!u) return { error: "signin" };
  if (!(await limit("clap", 300, 3600, String(u.id)))) return { error: "Slow down" };
  const n = Math.max(1, Math.min(50, Math.floor(add)));
  const d = db();
  const post = d.prepare("SELECT author_id FROM posts WHERE id = ? AND status = 'published'").get(postId) as
    | { author_id: number }
    | undefined;
  if (!post) return { error: "Not found" };
  if (post.author_id === u.id) return { error: "You can't clap for your own story" };
  d.prepare(
    `INSERT INTO claps(post_id, user_id, count) VALUES (?, ?, ?)
     ON CONFLICT(post_id, user_id) DO UPDATE SET count = MIN(50, count + excluded.count)`,
  ).run(postId, u.id, n);
  const mine = (d.prepare("SELECT count FROM claps WHERE post_id = ? AND user_id = ?").get(postId, u.id) as { count: number }).count;
  const total = (d.prepare("SELECT COALESCE(SUM(count),0) AS t FROM claps WHERE post_id = ?").get(postId) as { t: number }).t;
  return { mine, total };
}

export async function commentAction(_: FormState, fd: FormData): Promise<FormState> {
  const u = await currentUser();
  if (!u) return { error: "Sign in to respond" };
  if (!(await limit("comment", 20, 3600, String(u.id)))) return { error: "You're responding too fast" };
  const postId = Number(fd.get("postId"));
  const parentId = fd.get("parentId") ? Number(fd.get("parentId")) : null;
  const body = String(fd.get("body") || "").trim().slice(0, 5000);
  if (!body) return { error: "Write something first" };
  const post = db().prepare("SELECT p.slug, u.username FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ? AND p.status='published'").get(postId) as
    | { slug: string; username: string }
    | undefined;
  if (!post) return { error: "Story not found" };
  if (parentId) {
    const parent = db().prepare("SELECT post_id, parent_id FROM comments WHERE id = ?").get(parentId) as
      | { post_id: number; parent_id: number | null }
      | undefined;
    if (!parent || parent.post_id !== postId) return { error: "Response not found" };
  }
  db().prepare("INSERT INTO comments(post_id, user_id, parent_id, body) VALUES (?,?,?,?)").run(postId, u.id, parentId, body);
  revalidatePath(`/u/${post.username}/${post.slug}`);
  return {};
}

export async function deleteCommentAction(fd: FormData) {
  const u = await requireUser();
  const id = Number(fd.get("id"));
  const c = db()
    .prepare("SELECT c.user_id, p.author_id FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.id = ?")
    .get(id) as { user_id: number; author_id: number } | undefined;
  // The commenter, the story's author, or an admin can remove a response.
  if (!c || (c.user_id !== u.id && c.author_id !== u.id && !u.is_admin)) return;
  db().prepare("DELETE FROM comments WHERE id = ?").run(id);
  revalidatePath(String(fd.get("path") || "/"));
}

export async function toggleFollowAction(username: string): Promise<{ following: boolean } | { error: string }> {
  const u = await currentUser();
  if (!u) return { error: "signin" };
  const target = db().prepare("SELECT id FROM users WHERE username = ?").get(username) as { id: number } | undefined;
  if (!target || target.id === u.id) return { error: "Not found" };
  const d = db();
  const has = d.prepare("SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?").get(u.id, target.id);
  if (has) d.prepare("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?").run(u.id, target.id);
  else d.prepare("INSERT INTO follows(follower_id, followee_id) VALUES (?, ?)").run(u.id, target.id);
  return { following: !has };
}

export async function toggleBookmarkAction(postId: number): Promise<{ saved: boolean } | { error: string }> {
  const u = await currentUser();
  if (!u) return { error: "signin" };
  const d = db();
  const has = d.prepare("SELECT 1 FROM bookmarks WHERE user_id = ? AND post_id = ?").get(u.id, postId);
  if (has) d.prepare("DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?").run(u.id, postId);
  else d.prepare("INSERT OR IGNORE INTO bookmarks(user_id, post_id) SELECT ?, id FROM posts WHERE id = ?").run(u.id, postId);
  return { saved: !has };
}

export async function updateProfileAction(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  const name = String(fd.get("name") || "").trim().slice(0, 60);
  const bio = String(fd.get("bio") || "").trim().slice(0, 300);
  const avatar = String(fd.get("avatar") || "").trim();
  if (!name) return { error: "Name can't be empty" };
  const okAvatar = avatar === "" || /^\/uploads\/[\w.-]+$/.test(avatar) ? avatar || null : u.avatar;
  db().prepare("UPDATE users SET name = ?, bio = ?, avatar = ? WHERE id = ?").run(name, bio, okAvatar, u.id);
  revalidatePath(`/u/${u.username}`);
  return { error: undefined };
}

// ---------- admin ----------

export async function adminBanAction(fd: FormData) {
  const u = await requireUser();
  if (!u.is_admin) return;
  const id = Number(fd.get("id"));
  const target = db().prepare("SELECT is_admin FROM users WHERE id = ?").get(id) as { is_admin: number } | undefined;
  if (!target || target.is_admin) return;
  const d = db();
  d.transaction(() => {
    if (fd.get("purge") === "1") {
      const ids = d.prepare("SELECT id FROM posts WHERE author_id = ?").all(id) as { id: number }[];
      for (const p of ids) d.prepare("DELETE FROM posts_fts WHERE rowid = ?").run(p.id);
      d.prepare("DELETE FROM users WHERE id = ?").run(id);
    } else {
      d.prepare("UPDATE users SET is_banned = 1 - is_banned WHERE id = ?").run(id);
      d.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    }
  })();
  revalidatePath("/admin");
}
