import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { live, zonedDayStart } from "@/lib/util";
import { cardArgs, categoryNav } from "@/lib/queries";
import { PAGE_SIZE } from "@/lib/constants";
import { Header, Footer } from "@/components/Shell";
import { Card } from "@/components/PostCard";
import { Pagination } from "@/components/Pagination";
import { CategoryChips, EmptyState } from "@/components/Ui";

export const dynamic = "force-dynamic";
type SP = Record<string, string | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams, page = Math.max(1, Number(sp.sahifa) || 1);
  return {
    title: "Barcha yozuvlar",
    description: "Kitoblar, texnologiya, loyihalar va o‘z ustida ishlash haqidagi barcha yozuvlar.",
    alternates: { canonical: page > 1 ? `/posts?sahifa=${page}` : "/posts" },
    robots: sp.q || sp.kategoriya || sp.dan || sp.gacha ? { index: false, follow: true } : undefined,
  };
}

export default async function All({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams, page = Math.max(1, Number(sp.sahifa) || 1);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const where: Prisma.PostWhereInput = { ...live() };
  if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }];
  if (sp.kategoriya) where.categories = { some: { category: { slug: sp.kategoriya } } };
  const from = sp.dan ? zonedDayStart(sp.dan) : null, to = sp.gacha ? zonedDayStart(sp.gacha) : null;
  const range: Prisma.DateTimeNullableFilter = { lte: new Date() };
  if (from) range.gte = from;
  if (to) range.lt = new Date(to.getTime() + 864e5);
  where.publishedAt = range;

  const [posts, total, cats] = await Promise.all([
    db.post.findMany({ where, orderBy: { publishedAt: sp.tartib === "eski" ? "asc" : "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, ...cardArgs }),
    db.post.count({ where }), categoryNav(),
  ]);
  const pages = Math.ceil(total / PAGE_SIZE);
  const href = (n: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "sahifa") u.set(k, v);
    if (n > 1) u.set("sahifa", String(n));
    const s = u.toString();
    return s ? `/posts?${s}` : "/posts";
  };
  const filtered = !!(q || sp.kategoriya || sp.dan || sp.gacha);

  return (<>
    <Header />
    <main className="mx-auto max-w-6xl px-5 pt-12">
      <h1 className="headline text-5xl sm:text-6xl">Barcha yozuvlar</h1>
      <div className="mt-8"><CategoryChips cats={cats} /></div>
      <form id="qidiruv" className="mt-8 grid gap-3 md:grid-cols-6 scroll-mt-6" role="search">
        <input name="q" defaultValue={q} placeholder="Sarlavha yoki matn bo‘yicha qidirish" aria-label="Qidiruv" className="inp md:col-span-2" />
        <select name="kategoriya" defaultValue={sp.kategoriya ?? ""} className="inp" aria-label="Kategoriya">
          <option value="">Barcha kategoriyalar</option>{cats.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
        <input type="date" name="dan" defaultValue={sp.dan} className="inp" aria-label="Sanadan" />
        <input type="date" name="gacha" defaultValue={sp.gacha} className="inp" aria-label="Sanagacha" />
        <select name="tartib" defaultValue={sp.tartib === "eski" ? "eski" : "yangi"} className="inp" aria-label="Saralash">
          <option value="yangi">Avval yangilari</option><option value="eski">Avval eskilari</option>
        </select>
        <div className="md:col-span-6 flex gap-3 items-center">
          <button className="btn">Qidirish</button>
          {filtered && <a href="/posts" className="text-sm underline">Filtrlarni tozalash</a>}
        </div>
      </form>
      <p className="meta mt-8" role="status">{total} ta yozuv topildi</p>
      {posts.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 mt-6">{posts.map((p, i) => <Card key={p.id} p={p} priority={i < 3} />)}</div>
      ) : (
        <div className="mt-6"><EmptyState title={filtered ? "Hech narsa topilmadi" : "Hozircha yozuvlar yo‘q"} text={filtered ? "Qidiruv shartlarini o‘zgartirib ko‘ring." : "Yangi yozuvlar tez orada paydo bo‘ladi."} action={filtered ? { href: "/posts", label: "Filtrlarni tozalash" } : undefined} /></div>
      )}
      <Pagination page={page} pages={pages} href={href} />
    </main>
    <Footer />
  </>);
}
