import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/lib/util";
import { deletePost } from "./actions";
import { ConfirmButton } from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";
type SP = Record<string, string | undefined>;

export default async function Admin({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = sp.holat === "qoralama" ? "DRAFT" : sp.holat === "elon" ? "PUBLISHED" : undefined;
  const [posts, total, pub, views] = await Promise.all([
    db.post.findMany({
      where: filter ? { status: filter } : undefined, orderBy: { createdAt: "desc" },
      select: { id: true, title: true, slug: true, status: true, publishedAt: true, views: true, isSample: true, _count: { select: { media: true } },
        categories: { select: { category: { select: { id: true, name: true } } }, orderBy: { category: { name: "asc" } } } },
    }),
    db.post.count(), db.post.count({ where: { status: "PUBLISHED" } }), db.post.aggregate({ _sum: { views: true } }),
  ]);
  const stats: [string, number][] = [["Jami yozuvlar", total], ["E’lon qilingan", pub], ["Qoralamalar", total - pub], ["Ko‘rishlar", views._sum.views ?? 0]];
  const now = new Date();
  const tab = (href: string, label: string, on: boolean) => <Link href={href} className={`px-3 py-1.5 text-sm font-semibold rounded-[3px] border ${on ? "bg-ink text-paper border-ink" : "border-line hover:border-ink"}`}>{label}</Link>;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 space-y-10">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="headline text-4xl">Yozuvlar</h1>
        <Link href="/admin/posts/new" className="btn">Yangi yozuv</Link>
      </div>
      {sp.saqlandi && <p className="bg-mist px-4 py-2 text-sm rounded-[3px]" role="status">Yozuv saqlandi.</p>}
      {sp.ochirildi && <p className="bg-mist px-4 py-2 text-sm rounded-[3px]" role="status">Yozuv o‘chirildi.</p>}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(([l, n]) => <div key={l} className="border border-line p-5 rounded-[3px]"><p className="headline text-4xl">{n}</p><p className="meta mt-1">{l}</p></div>)}
      </section>
      <section>
        <div className="flex gap-2 mb-4" role="tablist" aria-label="Holat bo‘yicha">
          {tab("/admin", "Hammasi", !filter)}{tab("/admin?holat=elon", "E’lon qilingan", filter === "PUBLISHED")}{tab("/admin?holat=qoralama", "Qoralamalar", filter === "DRAFT")}
        </div>
        {posts.length === 0 ? <p className="text-mute py-8">Bu yerda yozuvlar yo‘q. <Link href="/admin/posts/new" className="underline">Birinchisini yozing.</Link></p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-mute border-b border-line"><th className="py-2 pr-3 font-semibold">Sarlavha</th><th className="font-semibold pr-3">Holat</th><th className="font-semibold pr-3">Kategoriyalar</th><th className="font-semibold pr-3">Nashr vaqti</th><th className="font-semibold pr-3">Rasm</th><th className="font-semibold pr-3">Ko‘rish</th><th /></tr></thead>
              <tbody>
                {posts.map((p) => {
                  const scheduled = p.status === "PUBLISHED" && !!p.publishedAt && p.publishedAt > now;
                  return (
                    <tr key={p.id} className="border-b border-line align-top">
                      <td className="py-3 pr-3 font-semibold">{p.title}{p.isSample && <span className="ml-2 text-xs bg-mist px-1.5 font-normal">namuna</span>}</td>
                      <td className="pr-3 whitespace-nowrap py-3">{p.status === "DRAFT" ? "Qoralama" : scheduled ? "Rejalashtirilgan" : "E’lon qilingan"}</td>
                      <td className="pr-3 py-3">{p.categories.length ? p.categories.map((c) => c.category.name).join(", ") : "—"}</td>
                      <td className="pr-3 py-3 whitespace-nowrap">{fmtDateTime(p.publishedAt) || "—"}</td>
                      <td className="pr-3 py-3">{p._count.media}</td><td className="pr-3 py-3">{p.views}</td>
                      <td className="py-3"><div className="flex gap-3 whitespace-nowrap">
                        {p.status === "PUBLISHED" && !scheduled && <Link href={`/posts/${p.slug}`} className="underline">Ko‘rish</Link>}
                        <Link href={`/admin/posts/${p.id}`} className="underline">Tahrirlash</Link>
                        <form action={deletePost}><input type="hidden" name="id" value={p.id} />
                          <ConfirmButton message={`“${p.title}” o‘chirilsinmi? Rasmlari ham o‘chadi.`} className="text-red-700 underline">O‘chirish</ConfirmButton></form>
                      </div></td>
                    </tr>);
                })}
              </tbody>
            </table>
          </div>)}
      </section>
    </main>
  );
}
