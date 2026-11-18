import Link from "next/link";

function range(page: number, pages: number) {
  const s = new Set([1, pages, page - 1, page, page + 1]);
  const list = [...s].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  list.forEach((n, i) => { if (i && n - list[i - 1] > 1) out.push("…"); out.push(n); });
  return out;
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (n: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-14 flex flex-wrap items-center gap-2" aria-label="Sahifalash">
      {page > 1 && <Link href={href(page - 1)} rel="prev" className="btn2">Oldingi</Link>}
      {range(page, pages).map((n, i) => n === "…"
        ? <span key={`d${i}`} className="px-1 text-mute" aria-hidden>…</span>
        : <Link key={n} href={href(n)} aria-current={n === page ? "page" : undefined} className={n === page ? "btn" : "btn2"}>{n}</Link>)}
      {page < pages && <Link href={href(page + 1)} rel="next" className="btn2">Keyingi</Link>}
    </nav>
  );
}
