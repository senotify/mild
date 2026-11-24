import crypto from "node:crypto";
import { cookies } from "next/headers";
import { hash, verify } from "@node-rs/argon2";
import { db } from "./db";

export type User = {
  id: number;
  username: string;
  name: string;
  bio: string;
  avatar: string | null;
  is_admin: number;
  is_banned: number;
};

const COOKIE = "mild_session";
const TTL = 60 * 60 * 24 * 30;

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export const hashPassword = (pw: string) => hash(pw);
export const checkPassword = (h: string, pw: string) => verify(h, pw).catch(() => false);

export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + TTL;
  db().prepare("INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(sha(token), userId, exp);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(t));
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const u = db()
    .prepare(
      `SELECT u.id, u.username, u.name, u.bio, u.avatar, u.is_admin, u.is_banned
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > unixepoch()`,
    )
    .get(sha(t)) as User | undefined;
  if (!u || u.is_banned) return null;
  return u;
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Sign in first");
  return u;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const RESERVED = new Set([
  "senotify", "admin", "mild", "api", "about", "help", "search", "tag", "u",
  "new-story", "edit", "login", "signup", "logout", "me", "settings", "root", "support",
]);
