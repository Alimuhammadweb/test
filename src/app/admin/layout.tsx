import Link from "next/link";
import type { Metadata } from "next";
import { getAdminId } from "@/lib/auth";
import { BRAND } from "@/lib/constants";
import { logout } from "./actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const signedIn = !!(await getAdminId());
  return (<>
    {signedIn && (
      <div className="border-b border-line bg-mist">
        <div className="mx-auto max-w-6xl px-5 h-12 flex items-center gap-6 text-sm font-semibold">
          <Link href="/admin" className="font-display font-extrabold tracking-[-0.03em] text-base">{BRAND} admin</Link>
          <Link href="/admin" className="hover:text-acc">Yozuvlar</Link>
          <Link href="/admin/categories" className="hover:text-acc">Kategoriyalar</Link>
          <span className="flex-1" />
          <Link href="/" className="hover:text-acc">Saytga o‘tish</Link>
          <form action={logout}><button className="hover:text-acc">Chiqish</button></form>
        </div>
      </div>
    )}
    {children}
  </>);
}
