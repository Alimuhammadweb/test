/**
 * One-time, idempotent helper: moves images that were uploaded by the OLD version of the site
 * (files in public/uploads, referenced as "/uploads/<file>") into PostgreSQL.
 * Run it where the old public/uploads folder is available:  npm run db:legacy-images
 * Rows whose file is missing, invalid or an external https:// URL are left untouched.
 */
import { readFile } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { validateImage, safeFilename, ImageError } from "../src/lib/image";

const db = new PrismaClient();
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

async function load(url: string) {
  if (!url.startsWith("/uploads/")) return null;
  const name = path.basename(url);
  const buf = await readFile(path.join(process.cwd(), "public", "uploads", name)).catch(() => null);
  if (!buf) { console.warn("  fayl topilmadi:", url); return null; }
  try { return { buf, name, info: validateImage(buf, MIME[name.split(".").pop()?.toLowerCase() ?? ""] ?? "", name) }; }
  catch (e) { console.warn("  o‘tkazib yuborildi:", url, e instanceof ImageError ? e.message : e); return null; }
}

(async () => {
  let moved = 0;
  for (const m of await db.media.findMany({ where: { mimeType: null, url: { startsWith: "/uploads/" } } })) {
    const f = await load(m.url!); if (!f) continue;
    await db.media.update({ where: { id: m.id }, data: { data: new Uint8Array(f.buf), mimeType: f.info.mime, filename: safeFilename(f.name), size: f.buf.length, width: f.info.width, height: f.info.height, url: null } });
    moved++;
  }
  for (const p of await db.post.findMany({ where: { coverUrl: { startsWith: "/uploads/" } }, select: { id: true, coverUrl: true } })) {
    const f = await load(p.coverUrl!); if (!f) continue;
    await db.$transaction([
      db.media.updateMany({ where: { postId: p.id, isCover: true }, data: { isCover: false } }),
      db.media.create({ data: { postId: p.id, data: new Uint8Array(f.buf), mimeType: f.info.mime, filename: safeFilename(f.name), size: f.buf.length, width: f.info.width, height: f.info.height, order: -1, isCover: true } }),
      db.post.update({ where: { id: p.id }, data: { coverUrl: null } }),
    ]);
    moved++;
  }
  console.log(`${moved} ta rasm PostgreSQL ga ko‘chirildi`);
  await db.$disconnect();
})();
