// Create (or set the login of) the owner account @senotify.
// Run inside the container after the app has booted once (so migrations ran):
//   docker exec -it -e OWNER_EMAIL=... -e OWNER_PASSWORD=... mild node scripts/seed-owner.mjs
// With --locked it creates the account with a random password nobody knows,
// so daily posts can publish before the owner has chosen a login.
import Database from "better-sqlite3";
import { hash } from "@node-rs/argon2";
import crypto from "node:crypto";
import path from "node:path";

const locked = process.argv.includes("--locked");
const email = locked ? process.env.OWNER_EMAIL || "owner@mild.invalid" : process.env.OWNER_EMAIL;
const password = locked ? crypto.randomBytes(32).toString("base64url") : process.env.OWNER_PASSWORD;
if (!email || !password || password.length < 8) {
  console.error("Set OWNER_EMAIL and OWNER_PASSWORD (8+ chars), or pass --locked");
  process.exit(1);
}
const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const db = new Database(path.join(dir, "mild.db"));
const name = "Arya Annurseno";
const bio = "Backend engineer in Jakarta (Node.js, Go, TypeScript). 6+ years building APIs, integrations and event-driven systems. I write about backend, AI and infrastructure.";
const pw = await hash(password);
const existing = db.prepare("SELECT id FROM users WHERE username = 'senotify'").get();
if (existing && locked) {
  console.log("@senotify already exists; nothing to do");
} else if (existing) {
  db.prepare("UPDATE users SET email = ?, password_hash = ?, is_admin = 1, is_banned = 0 WHERE id = ?").run(email, pw, existing.id);
  console.log("updated @senotify");
} else {
  db.prepare("INSERT INTO users(username, email, password_hash, name, bio, is_admin) VALUES ('senotify', ?, ?, ?, ?, 1)").run(email, pw, name, bio);
  console.log("created @senotify; content posts sync within a minute");
}
