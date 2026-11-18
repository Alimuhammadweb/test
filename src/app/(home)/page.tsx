import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { live } from "@/lib/util";
import { cardArgs } from "@/lib/queries";
import { BRAND, TAGLINE } from "@/lib/constants";
import { Header, Footer } from "@/components/Shell";
import { Card, Lead, Row } from "@/components/PostCard";
import { EmptyState, SectionTitle } from "@/components/Ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { alternates: { canonical: "/" }, openGraph: { title: BRAND, description: TAGLINE, url: "/" } };

export default async function Home() {
  const [latest, popular, topics] = await Promise.all([
    db.post.findMany({ where: live(), orderBy: { publishedAt: "desc" }, take: 11, ...cardArgs }),
    db.post.findMany({ where: { ...live(), views: { gt: 0 } }, orderBy: { views: "desc" }, take: 5, select: { id: true, title: true, slug: true, views: true } }),
    db.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, posts: { where: { post: live() }, orderBy: { post: { publishedAt: "desc" } }, take: 3, select: { post: { ...cardArgs } } } },
    }),
  ]);
  const [lead, ...others] = latest;
  const side = others.slice(0, 4), grid = others.slice(4);
  const sections = topics.filter((c) => c.posts.length > 0).slice(0, 6);

  return (<>
    <Header />
    <main className="mx-auto max-w-6xl px-5">
      {!lead ? (
        <section className="pt-14"><EmptyState title="Hozircha yozuvlar yo‘q" text={`${BRAND}da birinchi yozuv tez orada chiqadi. Keyinroq qayta tekshirib ko‘ring.`} /></section>
      ) : (
        <section className="pt-10 sm:pt-14 grid lg:grid-cols-12 gap-x-12 gap-y-12" aria-label="Asosiy yozuv">
          <div className="lg:col-span-8"><Lead p={lead} /></div>
          {side.length > 0 && (
            <aside className="lg:col-span-4 lg:border-l lg:border-line lg:pl-8" aria-label="So‘nggi yozuvlar">
              <h2 className="font-bold text-sm mb-5">So‘nggi yozuvlar</h2>
              <div className="divide-y divide-line">{side.map((p) => <Row key={p.id} p={p} />)}</div>
            </aside>
          )}
        </section>
      )}

      {grid.length > 0 && (
        <section className="mt-20">
          <SectionTitle href="/posts" link="Barcha yozuvlar">Yangi</SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">{grid.map((p) => <Card key={p.id} p={p} />)}</div>
        </section>
      )}

      {sections.length > 0 && (
        <section className="mt-24" aria-label="Mavzular bo‘yicha">
          <div className="grid gap-x-10 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
            {sections.map((c) => (
              <div key={c.id}>
                <SectionTitle href={`/kategoriya/${c.slug}`}>{c.name}</SectionTitle>
                <div className="divide-y divide-line">{c.posts.map(({ post }) => <Row key={post.id} p={post} />)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {popular.length > 0 && (
        <section className="mt-24 max-w-3xl">
          <SectionTitle>Ko‘p o‘qilgan</SectionTitle>
          <ol className="divide-y divide-line border-b border-line">
            {popular.map((p) => (
              <li key={p.id}><Link href={`/posts/${p.slug}`} className="flex justify-between gap-6 py-4 hover:text-acc">
                <span className="headline text-xl">{p.title}</span><span className="meta shrink-0 self-center">{p.views} marta o‘qilgan</span></Link></li>
            ))}
          </ol>
        </section>
      )}
    </main>
    <Footer />
  </>);
}
