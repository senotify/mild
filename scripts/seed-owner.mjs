// One-time: create (or reset the password of) the owner account @senotify.
// Run inside the container after the app has booted once (so migrations ran):
//   docker exec -it -e OWNER_EMAIL=... -e OWNER_PASSWORD=... mild node scripts/seed-owner.mjs
import Database from "better-sqlite3";
import { hash } from "@node-rs/argon2";
import path from "node:path";

const email = process.env.OWNER_EMAIL;
const password = process.env.OWNER_PASSWORD;
if (!email || !password || password.length < 8) {
  console.error("Set OWNER_EMAIL and OWNER_PASSWORD (8+ chars)");
  process.exit(1);
}
const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const db = new Database(path.join(dir, "mild.db"));
const name = "Arya Annurseno";
const bio = "Backend engineer in Jakarta (Node.js, Go, TypeScript). 6+ years building APIs, integrations and event-driven systems. I write about backend, AI and infrastructure.";
const pw = await hash(password);
const existing = db.prepare("SELECT id FROM users WHERE username = 'senotify'").get();
if (existing) {
  db.prepare("UPDATE users SET email = ?, password_hash = ?, is_admin = 1, is_banned = 0 WHERE id = ?").run(email, pw, existing.id);
  console.log("updated @senotify");
} else {
  db.prepare("INSERT INTO users(username, email, password_hash, name, bio, is_admin) VALUES ('senotify', ?, ?, ?, ?, 1)").run(email, pw, name, bio);
  console.log("created @senotify; content posts sync within a minute");
}
