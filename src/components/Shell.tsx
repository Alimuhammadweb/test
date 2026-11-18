import Link from "next/link";
import { categoryNav } from "@/lib/queries";
import { BRAND, TAGLINE } from "@/lib/constants";
import { MobileNav } from "./MobileNav";

/** `bare` skips the category query: used by statically prerendered pages (404) so builds never need the database. */
export async function Header({ active, bare }: { active?: string; bare?: boolean }) {
  const cats = bare ? [] : await categoryNav();
  return (
    <header className="relative border-b border-line bg-paper">
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="font-display text-[1.65rem] font-extrabold tracking-[-0.04em]">{BRAND}</Link>
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold" aria-label="Asosiy menyu">
          <Link href="/posts" className="hover:text-acc">Barcha yozuvlar</Link>
          <Link href="/posts#qidiruv" className="hover:text-acc">Qidiruv</Link>
        </nav>
        <MobileNav cats={cats} />
      </div>
      {cats.length > 0 && (
        <nav className="hidden md:block border-t border-line" aria-label="Kategoriyalar">
          <ul className="mx-auto max-w-6xl px-5 flex gap-7 overflow-x-auto whitespace-nowrap text-sm">
            {cats.map((c) => (
              <li key={c.id}>
                <Link href={`/kategoriya/${c.slug}`} aria-current={active === c.slug ? "page" : undefined}
                  className={`block py-3 border-b-2 ${active === c.slug ? "border-ink font-bold" : "border-transparent text-mute hover:text-ink"}`}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

export async function Footer({ bare }: { bare?: boolean }) {
  const cats = bare ? [] : await categoryNav();
  return (
    <footer className="border-t border-line mt-28 bg-mist">
      <div className="mx-auto max-w-6xl px-5 py-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-2xl font-extrabold tracking-[-0.04em]">{BRAND}</p>
          <p className="mt-3 text-mute max-w-sm font-serif text-lg leading-snug">{TAGLINE}</p>
        </div>
        <nav aria-label="Bo‘limlar">
          <p className="font-bold text-sm mb-3">Kategoriyalar</p>
          <ul className="space-y-2 text-sm">{cats.map((c) => <li key={c.id}><Link href={`/kategoriya/${c.slug}`} className="hover:text-acc">{c.name}</Link></li>)}</ul>
        </nav>
        <nav aria-label="Sayt">
          <p className="font-bold text-sm mb-3">Sayt</p>
          <ul className="space-y-2 text-sm"><li><Link href="/posts" className="hover:text-acc">Barcha yozuvlar</Link></li></ul>
        </nav>
      </div>
    </footer>
  );
}
