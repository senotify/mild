import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { UPLOAD_DIR } from "@/lib/db";
import { limit } from "@/lib/ratelimit";

const MAX = 2 * 1024 * 1024;

// Trust the bytes, not the client-declared type.
function sniff(b: Buffer): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (b.subarray(0, 6).toString("ascii") === "GIF89a" || b.subarray(0, 6).toString("ascii") === "GIF87a") return "gif";
  return null;
}

export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!(await limit("upload", 40, 3600, String(u.id)))) return NextResponse.json({ error: "Too many uploads" }, { status: 429 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Images must be under 2MB" }, { status: 413 });
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) return NextResponse.json({ error: "Use a JPG, PNG, WebP or GIF" }, { status: 415 });
  const name = `${crypto.randomBytes(12).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
  return NextResponse.json({ url: `/uploads/${name}` });
}
