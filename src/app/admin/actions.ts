"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, setSession, clearSession } from "@/lib/auth";
import { slugify } from "@/lib/util";
import { plainText } from "@/lib/content";
import { MAX_IMAGES_PER_POST } from "@/lib/constants";

let dummy: Promise<string> | undefined;
const dummyHash = () => (dummy ??= bcrypt.hash("not-a-real-password", 12));
const refresh = () => revalidatePath("/", "layout");

// ---------- auth ----------
export async function login(_: unknown, f: FormData): Promise<{ xato: string; email: string } | null> {
  const email = String(f.get("email") ?? "").trim().toLowerCase(), password = String(f.get("password") ?? "");
  const u = email ? await db.adminUser.findUnique({ where: { email } }) : null;
  const ok = await bcrypt.compare(password, u?.passwordHash ?? (await dummyHash())); // same work whether or not the email exists
  if (!u || !ok) { await new Promise((r) => setTimeout(r, 600)); return { xato: "Email yoki parol noto‘g‘ri", email }; }
  await setSession(u.id);
  redirect("/admin");
}
export async function logout() { await clearSession(); redirect("/admin/login"); }

// ---------- posts ----------
const isHttp = (v: string) => { try { const u = new URL(v); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; } };
const postInput = z.object({
  id: z.string().min(1).max(40),
  mode: z.enum(["draft", "publish"]),
  title: z.string().trim().min(1, "Sarlavha kiritilishi shart").max(200, "Sarlavha 200 belgidan oshmasin"),
  content: z.string().trim().min(1, "Matn kiritilishi shart").max(100000, "Matn juda uzun"),
  excerpt: z.string().trim().max(500, "Qisqa tavsif 500 belgidan oshmasin"),
  categoryIds: z.array(z.string().max(40)).max(30),
  tags: z.string().max(600),
  sourceUrl: z.string().trim().max(500).refine((v) => !v || isHttp(v), "Havola http:// yoki https:// bilan boshlanishi kerak"),
  publishedAt: z.string().max(40).nullable(),
  coverUrl: z.string().max(1000).nullable(),
  media: z.array(z.object({ id: z.string().min(1).max(40), alt: z.string().max(200), order: z.number().int().min(0).max(999), isCover: z.boolean() })).max(MAX_IMAGES_PER_POST),
  newCover: z.boolean(),
});
export type SavePostResult =
  | { ok: true; id: string; slug: string; status: "DRAFT" | "PUBLISHED" }
  | { ok: false; error: string; fields?: Record<string, string[] | undefined> };

/** Saves post data (not image bytes: those are uploaded one by one to /api/admin/posts/[id]/media). */
export async function savePost(raw: unknown): Promise<SavePostResult> {
  await requireAdmin();
  const r = postInput.safeParse(raw);
  if (!r.success) return { ok: false, error: "Maydonlarni tekshiring", fields: r.error.flatten().fieldErrors };
  const d = r.data;
  const when = d.publishedAt ? new Date(d.publishedAt) : null;
  if (when && Number.isNaN(when.getTime())) return { ok: false, error: "Nashr sanasi noto‘g‘ri", fields: { publishedAt: ["Sana noto‘g‘ri"] } };
  const isNew = d.id === "new";
  const existing = isNew ? null : await db.post.findUnique({ where: { id: d.id }, select: { id: true, publishedAt: true } });
  if (!isNew && !existing) return { ok: false, error: "Nashr topilmadi (u o‘chirilgan bo‘lishi mumkin)" };

  const status = d.mode === "publish" ? "PUBLISHED" as const : "DRAFT" as const;
  // The publication timestamp is only ever set deliberately: an explicit date wins, then the one already stored, then "now" when publishing.
  const publishedAt = d.mode === "publish" ? (when ?? existing?.publishedAt ?? new Date()) : (when ?? existing?.publishedAt ?? null);

  const categoryIds = (await db.category.findMany({ where: { id: { in: d.categoryIds } }, select: { id: true } })).map((c) => c.id);
  const tagNames = [...new Map(d.tags.split(",").map((s) => s.trim().slice(0, 40)).filter(Boolean).map((t) => [slugify(t), t] as const)).values()].slice(0, 15);
  const tags = tagNames.map((t) => ({ where: { slug: slugify(t) }, create: { name: t, slug: slugify(t) } }));
  const fields = { title: d.title, content: d.content, excerpt: d.excerpt || plainText(d.content, 180), status, publishedAt, sourceUrl: d.sourceUrl || null, coverUrl: d.coverUrl || null };

  try {
    const saved = await db.$transaction(async (tx) => {
      if (isNew) {
        const base = slugify(d.title); let slug = base, n = 1;
        while (await tx.post.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${++n}`;
        return tx.post.create({
          data: { ...fields, slug, categories: { create: categoryIds.map((categoryId) => ({ categoryId })) }, tags: { connectOrCreate: tags } },
          select: { id: true, slug: true },
        });
      }
      const p = await tx.post.update({
        where: { id: d.id },
        data: { ...fields, categories: { deleteMany: {}, create: categoryIds.map((categoryId) => ({ categoryId })) }, tags: { set: [], connectOrCreate: tags } },
        select: { id: true, slug: true },
      });
      // Images the editor no longer lists are deleted; the rest get their new order / alt text / cover flag.
      await tx.media.deleteMany({ where: { postId: p.id, id: { notIn: d.media.map((m) => m.id) } } });
      for (const m of d.media) await tx.media.updateMany({ where: { id: m.id, postId: p.id }, data: { alt: m.alt, order: m.order, isCover: d.newCover ? false : m.isCover } });
      return p;
    });
    refresh();
    return { ok: true, id: saved.id, slug: saved.slug, status };
  } catch (e) {
    console.error("[savePost]", (e as { code?: string })?.code ?? "noma’lum xato");
    return { ok: false, error: "Saqlab bo‘lmadi. Qayta urinib ko‘ring." };
  }
}

export async function deletePost(f: FormData) {
  await requireAdmin();
  const id = String(f.get("id") ?? "");
  try { await db.post.delete({ where: { id } }); } catch { /* already deleted */ }
  refresh();
  redirect("/admin?ochirildi=1");
}

// ---------- categories ----------
const catInput = z.object({
  id: z.string().max(40).optional(),
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(300).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(100),
});
const back = (q: string): never => redirect(`/admin/categories?${q}`);

export async function saveCategory(f: FormData) {
  await requireAdmin();
  const r = catInput.safeParse(Object.fromEntries(f));
  if (!r.success) return back("xato=" + encodeURIComponent("Nom 2–60 belgidan iborat bo‘lishi kerak"));
  const { id, name, description = "", sortOrder } = r.data;
  const slug = slugify(r.data.slug || name);
  let err = "";
  try {
    if (id) await db.category.update({ where: { id }, data: { name, slug, description, sortOrder } });
    else await db.category.create({ data: { name, slug, description, sortOrder } });
  } catch (e) {
    err = (e as { code?: string })?.code === "P2002" ? "Bunday nom yoki slug bilan kategoriya allaqachon bor" : "Kategoriyani saqlab bo‘lmadi";
  }
  if (err) return back("xato=" + encodeURIComponent(err));
  refresh();
  return back("saqlandi=1");
}

export async function deleteCategory(f: FormData) {
  await requireAdmin();
  try { await db.category.delete({ where: { id: String(f.get("id") ?? "") } }); } catch { /* already deleted */ }
  refresh();
  return back("ochirildi=1");
}
