import Link from "next/link";

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: { href: string; label: string } }) {
  return (
    <div className="border border-dashed border-line rounded-[3px] px-6 py-14 text-center">
      <h2 className="headline text-2xl">{title}</h2>
      {text && <p className="mt-2 text-mute max-w-md mx-auto font-serif text-lg">{text}</p>}
      {action && <Link href={action.href} className="btn mt-6">{action.label}</Link>}
    </div>
  );
}

export function CategoryChips({ cats, active, allHref = "/posts" }: { cats: { id: string; name: string; slug: string }[]; active?: string; allHref?: string }) {
  const base = "inline-block px-3 py-1.5 text-sm font-semibold rounded-[3px] border";
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Kategoriya bo‘yicha saralash">
      <li><Link href={allHref} className={`${base} ${!active ? "bg-ink text-paper border-ink" : "border-line hover:border-ink"}`}>Barchasi</Link></li>
      {cats.map((c) => (
        <li key={c.id}><Link href={`/kategoriya/${c.slug}`} aria-current={active === c.slug ? "page" : undefined}
          className={`${base} ${active === c.slug ? "bg-ink text-paper border-ink" : "border-line hover:border-ink"}`}>{c.name}</Link></li>
      ))}
    </ul>
  );
}

export function SectionTitle({ children, href, link }: { children: React.ReactNode; href?: string; link?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t-2 border-ink pt-3 mb-7">
      <h2 className="headline text-2xl">{children}</h2>
      {href && <Link href={href} className="text-sm font-semibold hover:text-acc whitespace-nowrap">{link ?? "Hammasi"}</Link>}
    </div>
  );
}
