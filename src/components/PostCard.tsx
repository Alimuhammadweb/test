import Link from "next/link";
import { fmtDate, fmtTime } from "@/lib/util";
import { splitMedia } from "@/lib/media";
import type { PostCardData } from "@/lib/queries";
import { PostImage } from "./PostImage";

type Cats = PostCardData["categories"];

export function Labels({ cats }: { cats: Cats }) {
  if (!cats.length) return null;
  return (
    <ul className="relative z-10 flex flex-wrap gap-1.5" aria-label="Kategoriyalar">
      {cats.map(({ category: c }) => <li key={c.id}><Link href={`/kategoriya/${c.slug}`} className="label">{c.name}</Link></li>)}
    </ul>
  );
}

/** Publication date and time, straight from the stored timestamp, shown in the site time zone. */
export function DateLine({ date, className = "" }: { date: Date | null; className?: string }) {
  if (!date) return null;
  return (
    <time dateTime={date.toISOString()} className={`meta inline-flex items-center gap-2 ${className}`}>
      <span>{fmtDate(date)}</span><span aria-hidden className="h-3 w-px bg-line" /><span>{fmtTime(date)}</span>
    </time>
  );
}

export function Card({ p, priority }: { p: PostCardData; priority?: boolean }) {
  const { cover } = splitMedia(p);
  return (
    <article className="relative flex flex-col">
      {cover && (
        <div className="relative aspect-[3/2] bg-mist overflow-hidden mb-4 rounded-[2px]">
          <PostImage img={cover} fill priority={priority} sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 100vw" className="object-cover" />
        </div>
      )}
      <Labels cats={p.categories} />
      <h3 className={`headline text-[1.6rem] mt-2.5 ${p.categories.length ? "" : "mt-0"}`}>
        <Link href={`/posts/${p.slug}`} className="after:absolute after:inset-0 hover:text-acc">{p.title}</Link>
      </h3>
      {p.excerpt && <p className="mt-2 text-mute font-serif text-[1.05rem] leading-snug line-clamp-3">{p.excerpt}</p>}
      <DateLine date={p.publishedAt} className="mt-3" />
    </article>
  );
}

/** Compact headline-only row used in side lists. */
export function Row({ p }: { p: PostCardData }) {
  return (
    <article className="relative py-4 first:pt-0">
      <Labels cats={p.categories} />
      <h3 className={`headline text-[1.35rem] ${p.categories.length ? "mt-2" : ""}`}><Link href={`/posts/${p.slug}`} className="after:absolute after:inset-0 hover:text-acc">{p.title}</Link></h3>
      <DateLine date={p.publishedAt} className="mt-2" />
    </article>
  );
}

export function Lead({ p }: { p: PostCardData }) {
  const { cover } = splitMedia(p);
  return (
    <article className="relative">
      <Labels cats={p.categories} />
      <h2 className={`headline text-[2.5rem] sm:text-6xl lg:text-[4.25rem] ${p.categories.length ? "mt-4" : ""}`}>
        <Link href={`/posts/${p.slug}`} className="after:absolute after:inset-0 hover:text-acc">{p.title}</Link>
      </h2>
      {p.excerpt && <p className="mt-5 font-serif text-xl sm:text-[1.4rem] leading-snug text-mute max-w-2xl">{p.excerpt}</p>}
      <DateLine date={p.publishedAt} className="mt-5" />
      {cover && (
        <div className="relative aspect-[16/9] bg-mist overflow-hidden mt-7 rounded-[2px]">
          <PostImage img={cover} fill priority sizes="(min-width: 1024px) 720px, 100vw" className="object-cover" />
        </div>
      )}
    </article>
  );
}
