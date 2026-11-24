// Create (or set the login of) the owner account @senotify.
// Run inside the container after the app has booted once (so migrations ran):
//   docker exec -it mild node scripts/seed-owner.mjs
// It asks for the email and password (hidden). OWNER_EMAIL / OWNER_PASSWORD
// env vars also work, but they end up in shell history.
// With --locked it creates the account with a random password nobody knows,
// so daily posts can publish before the owner has chosen a login.
import Database from "better-sqlite3";
import { hash } from "@node-rs/argon2";
import crypto from "node:crypto";
import path from "node:path";

import readline from "node:readline";

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Echo nothing while the password is typed.
      rl._writeToOutput = (s) => { if (s.startsWith(question)) rl.output.write(question); };
    }
    rl.question(question, (a) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(a.trim()); });
  });
}

const locked = process.argv.includes("--locked");
let email = locked ? process.env.OWNER_EMAIL || "owner@mild.invalid" : process.env.OWNER_EMAIL;
let password = locked ? crypto.randomBytes(32).toString("base64url") : process.env.OWNER_PASSWORD;
if (!locked && process.stdin.isTTY) {
  if (!email) email = await ask("Email for @senotify: ");
  if (!password) {
    password = await ask("New password (8+ chars, hidden): ", true);
    const again = await ask("Repeat password: ", true);
    if (password !== again) { console.error("Passwords don't match"); process.exit(1); }
  }
}
if (!email || !password || password.length < 8) {
  console.error("Need an email and a password of 8+ characters (run with docker exec -it so it can prompt), or pass --locked");
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
  console.log("updated @senotify: you can sign in at https://mild.senotify.com/login");
} else {
  db.prepare("INSERT INTO users(username, email, password_hash, name, bio, is_admin) VALUES ('senotify', ?, ?, ?, ?, 1)").run(email, pw, name, bio);
  console.log("created @senotify; content posts sync within a minute");
}
