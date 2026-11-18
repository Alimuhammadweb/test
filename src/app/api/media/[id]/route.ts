import { db } from "@/lib/db";
import { getAdminId } from "@/lib/auth";

export const runtime = "nodejs";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Serves one image stored in PostgreSQL. Only this route reads the binary column.
 * - Published posts: public, long-lived cache (every upload/replacement gets a NEW id, so URLs are immutable).
 * - Drafts / scheduled posts: visible to the signed-in admin only, never cached.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) return notFound();

  const meta = await db.media.findUnique({
    where: { id },
    select: { id: true, mimeType: true, size: true, filename: true, post: { select: { status: true, publishedAt: true } } },
  });
  if (!meta?.mimeType) return notFound();

  const published = meta.post.status === "PUBLISHED" && !!meta.post.publishedAt && meta.post.publishedAt <= new Date();
  if (!published && !(await getAdminId())) return notFound();

  const etag = `"${meta.id}-${meta.size}"`;
  const cache = published ? "public, max-age=604800, immutable" : "private, no-store";
  if (published && req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": cache } });

  const row = await db.media.findUnique({ where: { id }, omit: { data: false } });
  if (!row?.data) return notFound();
  const bytes = new Uint8Array(row.data);
  return new Response(bytes, {
    headers: {
      "Content-Type": meta.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": cache,
      ETag: etag,
      "Content-Disposition": `inline; filename="${(meta.filename ?? "image").replace(/[^\w.\-]+/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
