import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { live } from "@/lib/util";
import { cardArgs, categoryNav, getCategory } from "@/lib/queries";
import { BRAND, PAGE_SIZE } from "@/lib/constants";
import { Header, Footer } from "@/components/Shell";
import { Card } from "@/components/PostCard";
import { Pagination } from "@/components/Pagination";
import { CategoryChips, EmptyState } from "@/components/Ui";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sahifa?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const c = await getCategory((await params).slug);
  if (!c) return { title: "Kategoriya topilmadi", robots: { index: false } };
  const page = Math.max(1, Number((await searchParams).sahifa) || 1);
  const description = c.description || `${c.name} kategoriyasidagi yozuvlar — ${BRAND}.`;
  const url = `/kategoriya/${c.slug}${page > 1 ? `?sahifa=${page}` : ""}`;
  return { title: c.name, description, alternates: { canonical: url }, openGraph: { title: `${c.name} — ${BRAND}`, description, url, type: "website" } };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const c = await getCategory(slug);
  if (!c) notFound();
  const page = Math.max(1, Number((await searchParams).sahifa) || 1);
  const where = { ...live(), categories: { some: { categoryId: c.id } } };
  const [posts, total, cats] = await Promise.all([
    db.post.findMany({ where, orderBy: { publishedAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, ...cardArgs }),
    db.post.count({ where }), categoryNav(),
  ]);
  const pages = Math.ceil(total / PAGE_SIZE);

  return (<>
    <Header active={c.slug} />
    <main className="mx-auto max-w-6xl px-5 pt-12">
      <h1 className="headline text-5xl sm:text-7xl">{c.name}</h1>
      {c.description && <p className="mt-4 font-serif text-xl text-mute max-w-2xl leading-snug">{c.description}</p>}
      <p className="meta mt-4">{total} ta yozuv</p>
      <div className="mt-8"><CategoryChips cats={cats} active={c.slug} /></div>
      {posts.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 mt-10">{posts.map((p, i) => <Card key={p.id} p={p} priority={i < 3} />)}</div>
      ) : (
        <div className="mt-10"><EmptyState title="Bu kategoriyada hozircha yozuv yo‘q" text="Boshqa kategoriyalarni ko‘ring yoki keyinroq qaytib keling." action={{ href: "/posts", label: "Barcha yozuvlar" }} /></div>
      )}
      <Pagination page={page} pages={pages} href={(n) => `/kategoriya/${c.slug}${n > 1 ? `?sahifa=${n}` : ""}`} />
    </main>
    <Footer />
  </>);
}
