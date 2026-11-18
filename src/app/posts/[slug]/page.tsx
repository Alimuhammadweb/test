import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createHash } from "crypto";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { absUrl, readMin, SITE } from "@/lib/util";
import { renderContent, plainText, excerptIsAuto } from "@/lib/content";
import { getArticle, relatedPosts } from "@/lib/queries";
import { splitMedia } from "@/lib/media";
import { BRAND } from "@/lib/constants";
import { Header, Footer } from "@/components/Shell";
import { Card, DateLine, Labels } from "@/components/PostCard";
import { PostImage } from "@/components/PostImage";
import { SectionTitle } from "@/components/Ui";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getArticle((await params).slug);
  if (!p) return { title: "Yozuv topilmadi", robots: { index: false } };
  const { cover } = splitMedia(p);
  const description = p.excerpt || plainText(p.content, 160);
  const url = `/posts/${p.slug}`;
  const images = cover ? [{ url: absUrl(cover.src), ...(cover.width && cover.height ? { width: cover.width, height: cover.height } : {}), alt: cover.alt }] : [];
  return {
    title: p.title, description, alternates: { canonical: url },
    openGraph: {
      title: p.title, description, url, type: "article", siteName: BRAND, images,
      publishedTime: p.publishedAt?.toISOString(), modifiedTime: p.updatedAt.toISOString(),
      section: p.categories[0]?.category.name, tags: p.tags.map((t) => t.name),
    },
    twitter: { card: cover ? "summary_large_image" : "summary", title: p.title, description, images: images.map((i) => i.url) },
  };
}

async function countView(postId: string) {
  const h = await headers(), ua = h.get("user-agent") ?? "";
  if (/bot|crawl|spider|preview/i.test(ua)) return;
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const visitorHash = createHash("sha256").update(ip + ua + (process.env.SESSION_SECRET ?? "")).digest("hex");
  const day = new Date().toISOString().slice(0, 10);
  try { await db.$transaction([db.postView.create({ data: { postId, visitorHash, day } }), db.post.update({ where: { id: postId }, data: { views: { increment: 1 } } })]); } catch { /* already counted today */ }
}

export default async function PostPage({ params }: Props) {
  const p = await getArticle((await params).slug);
  if (!p) notFound();
  await countView(p.id);
  const [related] = await Promise.all([relatedPosts(p.id, p.categories.map((c) => c.category.id))]);
  const { cover, gallery } = splitMedia(p);
  const url = encodeURIComponent(`${SITE}/posts/${p.slug}`), t = encodeURIComponent(p.title);
  const ld = {
    "@context": "https://schema.org", "@type": "BlogPosting", headline: p.title, description: p.excerpt || plainText(p.content, 160),
    datePublished: p.publishedAt?.toISOString(), dateModified: p.updatedAt.toISOString(), mainEntityOfPage: `${SITE}/posts/${p.slug}`,
    image: cover ? [absUrl(cover.src)] : undefined, articleSection: p.categories.map((c) => c.category.name), keywords: p.tags.map((x) => x.name).join(", ") || undefined,
    publisher: { "@type": "Organization", name: BRAND },
  };

  return (<>
    <Header active={p.categories[0]?.category.slug} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
    <main className="mx-auto max-w-6xl px-5 pt-12">
      <article>
        <header className="max-w-4xl mx-auto">
          <Labels cats={p.categories} />
          <h1 className={`headline text-[2.6rem] sm:text-6xl lg:text-7xl ${p.categories.length ? "mt-5" : ""}`}>{p.title}</h1>
          {p.excerpt && !excerptIsAuto(p.excerpt, p.content) && <p className="mt-6 font-serif text-xl sm:text-2xl leading-snug text-mute max-w-3xl">{p.excerpt}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1">
            <DateLine date={p.publishedAt} />
            <span className="meta">{readMin(p.content)} daqiqalik o‘qish</span>
          </div>
        </header>

        {cover && (
          <figure className="max-w-5xl mx-auto mt-10">
            <div className="bg-mist overflow-hidden rounded-[2px]">
              <PostImage img={cover} priority sizes="(min-width: 1024px) 1024px, 100vw" className="w-full h-auto" />
            </div>
          </figure>
        )}

        <div className="max-w-4xl mx-auto mt-10">
          <div className="prose-jm" dangerouslySetInnerHTML={{ __html: renderContent(p.content) }} />

          {gallery.length > 0 && (
            <section className="mt-12" aria-label="Rasmlar">
              <ul className={`grid gap-4 ${gallery.length === 1 ? "" : "sm:grid-cols-2"}`}>
                {gallery.map((g, i) => (
                  <li key={g.src} className={gallery.length % 2 === 1 && i === 0 && gallery.length > 1 ? "sm:col-span-2" : ""}>
                    <a href={g.src} target="_blank" rel="noopener noreferrer" className="block bg-mist overflow-hidden rounded-[2px]" aria-label={`Rasmni to‘liq ochish: ${g.alt}`}>
                      <PostImage img={g} sizes={gallery.length === 1 || (gallery.length % 2 === 1 && i === 0) ? "(min-width: 1024px) 896px, 100vw" : "(min-width: 1024px) 440px, (min-width: 640px) 45vw, 100vw"} className="w-full h-auto" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {p.tags.length > 0 && <ul className="mt-10 flex flex-wrap gap-x-4 gap-y-1 meta">{p.tags.map((x) => <li key={x.id}>#{x.name}</li>)}</ul>}

          <div className="mt-10 pt-6 border-t border-line flex flex-wrap gap-3 text-sm items-center">
            <span className="meta">Ulashish:</span>
            <a className="btn2" href={`https://twitter.com/intent/tweet?url=${url}&text=${t}`} target="_blank" rel="noopener noreferrer">X</a>
            <a className="btn2" href={`https://www.facebook.com/sharer/sharer.php?u=${url}`} target="_blank" rel="noopener noreferrer">Facebook</a>
            <a className="btn2" href={`https://www.linkedin.com/sharing/share-offsite/?url=${url}`} target="_blank" rel="noopener noreferrer">LinkedIn</a>
            {p.sourceUrl && <a className="underline ml-auto" href={p.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">Manba</a>}
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="mt-24" aria-label="O‘xshash yozuvlar">
          <SectionTitle>O‘xshash yozuvlar</SectionTitle>
          <div className="grid sm:grid-cols-3 gap-x-8 gap-y-12">{related.map((r) => <Card key={r.id} p={r} />)}</div>
        </section>
      )}
      <p className="mt-16"><Link href="/posts" className="text-sm font-semibold hover:text-acc">Barcha yozuvlarga qaytish</Link></p>
    </main>
    <Footer />
  </>);
}
