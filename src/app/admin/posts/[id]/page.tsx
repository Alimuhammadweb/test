import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { PostEditor, type EditorInitial } from "@/components/PostEditor";

export const dynamic = "force-dynamic";

export default async function Edit({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [cats, p] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    id === "new" ? null : db.post.findUnique({ where: { id }, include: { tags: true, categories: { select: { categoryId: true } }, media: { orderBy: { order: "asc" } } } }),
  ]);
  if (id !== "new" && !p) notFound();

  const initial: EditorInitial = {
    id: p?.id ?? "new", slug: p?.slug ?? null, status: p?.status ?? "DRAFT",
    title: p?.title ?? "", excerpt: p?.excerpt ?? "", content: p?.content ?? "",
    categoryIds: p?.categories.map((c) => c.categoryId) ?? [], tags: p?.tags.map((t) => t.name).join(", ") ?? "",
    sourceUrl: p?.sourceUrl ?? "", publishedAt: p?.publishedAt?.toISOString() ?? null, coverUrl: p?.coverUrl ?? null,
    media: (p?.media ?? []).map((m) => ({ id: m.id, hasData: !!m.mimeType, url: m.url, alt: m.alt, isCover: m.isCover, filename: m.filename, size: m.size })),
  };
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 pb-32">
      <Link href="/admin" className="text-sm underline">Yozuvlarga qaytish</Link>
      <h1 className="headline text-4xl mt-3 mb-8">{p ? "Yozuvni tahrirlash" : "Yangi yozuv"}</h1>
      <PostEditor initial={initial} categories={cats} />
    </main>
  );
}
