import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { saveCategory, deleteCategory } from "../actions";
import { ConfirmButton } from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

export default async function Categories({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const cats = await db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { posts: true } } } });
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="headline text-4xl">Kategoriyalar</h1>
      <p className="meta mt-2">Bir yozuv bir nechta kategoriyaga tegishli bo‘lishi mumkin. Slug — sahifa manzili (<code>/kategoriya/slug</code>); u o‘zgarsa, eski havola ishlamay qoladi.</p>
      {sp.xato && <p role="alert" className="mt-5 text-sm text-red-700 bg-red-50 px-4 py-2 rounded-[3px]">{sp.xato}</p>}
      {sp.saqlandi && <p role="status" className="mt-5 text-sm bg-mist px-4 py-2 rounded-[3px]">Saqlandi.</p>}
      {sp.ochirildi && <p role="status" className="mt-5 text-sm bg-mist px-4 py-2 rounded-[3px]">Kategoriya o‘chirildi. Yozuvlar saqlanib qoldi.</p>}

      <form action={saveCategory} className="mt-8 grid gap-3 sm:grid-cols-[1.2fr_1fr_5rem_auto] items-end border border-line p-4 rounded-[3px]">
        <label className="text-sm font-semibold">Yangi kategoriya<input name="name" required minLength={2} maxLength={60} placeholder="Masalan: Podkastlar" className="inp mt-1 font-normal" /></label>
        <label className="text-sm font-semibold">Slug (ixtiyoriy)<input name="slug" maxLength={80} placeholder="avtomatik" className="inp mt-1 font-normal" /></label>
        <label className="text-sm font-semibold">Tartib<input name="sortOrder" type="number" min={0} max={9999} defaultValue={100} className="inp mt-1 font-normal" /></label>
        <button className="btn">Qo‘shish</button>
        <label className="text-sm font-semibold sm:col-span-4">Tavsif (ixtiyoriy, kategoriya sahifasida ko‘rinadi)<input name="description" maxLength={300} className="inp mt-1 font-normal" /></label>
      </form>

      <ul className="mt-8 space-y-4">
        {cats.map((c) => (
          <li key={c.id} className="border border-line p-4 rounded-[3px]">
            <form action={saveCategory} className="grid gap-3 sm:grid-cols-[1.2fr_1fr_5rem_auto] items-end">
              <input type="hidden" name="id" value={c.id} />
              <label className="text-sm font-semibold">Nomi<input name="name" defaultValue={c.name} required minLength={2} maxLength={60} className="inp mt-1 font-normal" /></label>
              <label className="text-sm font-semibold">Slug<input name="slug" defaultValue={c.slug} required maxLength={80} className="inp mt-1 font-normal" /></label>
              <label className="text-sm font-semibold">Tartib<input name="sortOrder" type="number" min={0} max={9999} defaultValue={c.sortOrder} className="inp mt-1 font-normal" /></label>
              <button className="btn2">Saqlash</button>
              <label className="text-sm font-semibold sm:col-span-4">Tavsif<input name="description" defaultValue={c.description} maxLength={300} className="inp mt-1 font-normal" /></label>
            </form>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="meta">{c._count.posts} ta yozuv</span>
              <Link href={`/kategoriya/${c.slug}`} className="underline">Sahifani ko‘rish</Link>
              <form action={deleteCategory} className="ml-auto"><input type="hidden" name="id" value={c.id} />
                <ConfirmButton message={`“${c.name}” kategoriyasi o‘chirilsinmi? ${c._count.posts} ta yozuv saqlanib qoladi, faqat shu kategoriyadan chiqariladi.`} className="text-red-700 underline">O‘chirish</ConfirmButton></form>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
