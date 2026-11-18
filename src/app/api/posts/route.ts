import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { slugify } from "@/lib/util";
import { plainText } from "@/lib/content";

// Token-protected endpoint for creating posts from other tools/scripts.
// Disabled unless API_TOKEN (16+ chars) is set. Images are passed as URLs (legacy, URL-only media);
// images uploaded through the admin panel are stored in PostgreSQL instead.
const schema = z.object({
  title: z.string().trim().min(3).max(200), content: z.string().min(1).max(100000), excerpt: z.string().max(500).optional(),
  image_url: z.string().url().optional(), images: z.array(z.string().url()).max(10).optional(),
  category: z.string().trim().max(60).optional(), categories: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
  source_url: z.string().url().optional(), published_at: z.string().datetime().optional(),
  external_id: z.string().trim().min(1).max(200).optional(), status: z.enum(["draft", "published"]).optional(),
});

function authed(req: Request) {
  const t = process.env.API_TOKEN, h = req.headers.get("authorization") ?? "";
  if (!t || t.length < 16 || !h.startsWith("Bearer ")) return false;
  const a = Buffer.from(h.slice(7)), b = Buffer.from(t);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ xato: "Ruxsat yo‘q" }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ xato: "JSON noto‘g‘ri" }, { status: 400 }); }
  const r = schema.safeParse(body);
  if (!r.success) return NextResponse.json({ xato: "Ma’lumotlar noto‘g‘ri", tafsilot: r.error.flatten().fieldErrors }, { status: 422 });
  const d = r.data, ext = req.headers.get("idempotency-key") ?? d.external_id ?? d.source_url ?? null;
  try {
    if (ext) { const ex = await db.post.findUnique({ where: { externalId: ext } }); if (ex) return NextResponse.json({ xato: "Bu post allaqachon mavjud", id: ex.id }, { status: 409 }); }
    const base = slugify(d.title); let slug = base, n = 1;
    while (await db.post.findUnique({ where: { slug } })) slug = `${base}-${++n}`;
    const names = [...new Map([...(d.categories ?? []), ...(d.category ? [d.category] : [])].map((s) => s.trim()).filter(Boolean).map((s) => [slugify(s), s] as const)).values()];
    const post = await db.post.create({ data: {
      title: d.title, slug, content: d.content, excerpt: d.excerpt ?? plainText(d.content, 180),
      coverUrl: d.image_url, sourceUrl: d.source_url, externalId: ext,
      status: d.status === "published" ? "PUBLISHED" : "DRAFT",
      publishedAt: d.published_at ? new Date(d.published_at) : d.status === "published" ? new Date() : null,
      categories: names.length ? { create: names.map((name) => ({ category: { connectOrCreate: { where: { slug: slugify(name) }, create: { name, slug: slugify(name) } } } })) } : undefined,
      tags: d.tags?.length ? { connectOrCreate: d.tags.map((t) => ({ where: { slug: slugify(t) }, create: { name: t, slug: slugify(t) } })) } : undefined,
      media: d.images?.length ? { create: d.images.map((url, order) => ({ url, order })) } : undefined,
    } });
    return NextResponse.json({ id: post.id, slug: post.slug, status: post.status }, { status: 201 });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") return NextResponse.json({ xato: "Takroriy so‘rov" }, { status: 409 });
    console.error("[api/posts] xato", code ?? "noma’lum");
    return NextResponse.json({ xato: "Server xatosi" }, { status: 500 });
  }
}
