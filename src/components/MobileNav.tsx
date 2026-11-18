"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function MobileNav({ cats }: { cats: { id: string; name: string; slug: string }[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  return (
    <div className="md:hidden">
      <button type="button" className="btn2 !px-3" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}>
        {open ? "Yopish" : "Menyu"}
      </button>
      {open && (
        <nav id="mobile-menu" aria-label="Menyu" className="absolute left-0 right-0 top-full z-30 bg-paper border-b border-line shadow-sm">
          <ul className="mx-auto max-w-6xl px-5 py-3 text-lg font-semibold divide-y divide-line">
            <li><Link href="/posts" className="block py-3">Barcha yozuvlar</Link></li>
            {cats.map((c) => <li key={c.id}><Link href={`/kategoriya/${c.slug}`} className="block py-3 font-medium">{c.name}</Link></li>)}
          </ul>
        </nav>
      )}
    </div>
  );
}
