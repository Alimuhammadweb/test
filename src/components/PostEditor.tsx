"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { savePost } from "@/app/admin/actions";
import { IMAGE_MIME_TYPES, MAX_IMAGES_PER_POST, MAX_IMAGE_BYTES } from "@/lib/constants";

export type EditorInitial = {
  id: string; slug: string | null; status: "DRAFT" | "PUBLISHED"; title: string; excerpt: string; content: string;
  categoryIds: string[]; tags: string; sourceUrl: string; publishedAt: string | null; coverUrl: string | null;
  media: { id: string; hasData: boolean; url: string | null; alt: string; isCover: boolean; filename: string | null; size: number }[];
};
type Item = { key: string; id?: string; src: string; file?: File; name: string; size: number; alt: string; isCover: boolean; state: "idle" | "uploading" | "failed"; error?: string };

const isoToLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
let seq = 0;
const nextKey = () => `k${++seq}`;

/** Re-encodes big photos in the browser so each upload stays well below the host's request-size limit (and strips EXIF/GPS). */
async function prepareImage(file: File): Promise<File> {
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) throw new Error(`${file.name}: faqat JPEG, PNG yoki WebP`);
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { throw new Error(`${file.name}: rasmni o‘qib bo‘lmadi (fayl buzilgan bo‘lishi mumkin)`); }
  const MAX_SIDE = 2560, scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  if (file.size <= 1.5 * 1048576 && scale === 1) { bmp.close(); return file; }
  const encode = async (side: number, q: number) => {
    const s = Math.min(1, side / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    const ctx = c.getContext("2d")!; ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const toBlob = (t: string) => new Promise<Blob | null>((r) => c.toBlob(r, t, q));
    const w = await toBlob("image/webp");
    if (w && w.type === "image/webp") return w;
    ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    return toBlob("image/jpeg");
  };
  let blob = await encode(MAX_SIDE, 0.86);
  if (blob && blob.size > MAX_IMAGE_BYTES) blob = await encode(1920, 0.75);
  bmp.close();
  if (!blob) throw new Error(`${file.name}: rasmni siqib bo‘lmadi`);
  if (blob.size >= file.size && file.size <= MAX_IMAGE_BYTES) return file;
  if (blob.size > MAX_IMAGE_BYTES) throw new Error(`${file.name}: rasm juda katta (siqilgandan keyin ham ${kb(blob.size)})`);
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + "." + ext, { type: blob.type });
}

async function uploadOne(postId: string, it: Item, order: number): Promise<{ id: string }> {
  const fd = new FormData();
  fd.set("file", it.file!); fd.set("order", String(order)); fd.set("alt", it.alt); fd.set("isCover", String(it.isCover));
  let res: Response;
  try { res = await fetch(`/api/admin/posts/${postId}/media`, { method: "POST", body: fd }); } catch { throw new Error("Tarmoq xatosi"); }
  if (res.ok) return res.json();
  if (res.status === 413) throw new Error("Rasm serverga sig‘maydi (4 MB dan kichik bo‘lishi kerak)");
  if (res.status === 401) throw new Error("Sessiya tugagan. Qayta kiring.");
  const j = await res.json().catch(() => null);
  throw new Error(j?.error ?? `Server xatosi (${res.status})`);
}

export function PostEditor({ initial, categories }: { initial: EditorInitial; categories: { id: string; name: string }[] }) {
  const [postId, setPostId] = useState(initial.id);
  const [status, setStatus] = useState(initial.status);
  const [title, setTitle] = useState(initial.title);
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [content, setContent] = useState(initial.content);
  const [catIds, setCatIds] = useState(initial.categoryIds);
  const [tags, setTags] = useState(initial.tags);
  const [sourceUrl, setSourceUrl] = useState(initial.sourceUrl);
  const [when, setWhen] = useState("");
  const [legacyCover, setLegacyCover] = useState(initial.coverUrl);
  const [items, setItems] = useState<Item[]>(() => initial.media.map((m) => ({ key: nextKey(), id: m.id, src: m.hasData ? `/api/media/${m.id}` : m.url ?? "", name: m.filename ?? "Rasm", size: m.size, alt: m.alt, isCover: m.isCover, state: "idle" as const })));
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [html, setHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);
  const [msg, setMsg] = useState<{ type: "error" | "ok"; text: string } | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string[] | undefined>>({});
  const [imgMsgs, setImgMsgs] = useState<string[]>([]);
  const [baseline, setBaseline] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const leaving = useRef(false);

  const snapshot = useMemo(() => JSON.stringify([title, excerpt, content, catIds, tags, sourceUrl, when, legacyCover, items.map((i) => [i.key, i.alt, i.isCover])]), [title, excerpt, content, catIds, tags, sourceUrl, when, legacyCover, items]);
  useEffect(() => { setWhen(isoToLocal(initial.publishedAt)); }, [initial.publishedAt]);
  useEffect(() => { if (baseline === null && (when !== "" || !initial.publishedAt)) setBaseline(snapshot); }, [baseline, when, snapshot, initial.publishedAt]);
  const dirty = baseline !== null && baseline !== snapshot;
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { if (!leaving.current) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
  useEffect(() => () => items.forEach((i) => i.file && URL.revokeObjectURL(i.src)), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- live preview, rendered by the server with the same sanitizer the public site uses ----
  useEffect(() => {
    if (tab !== "preview") return;
    const ctl = new AbortController();
    setHtml(null);
    fetch("/api/admin/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }), signal: ctl.signal })
      .then((r) => r.json()).then((j) => setHtml(j.html ?? "")).catch(() => { if (!ctl.signal.aborted) setHtml(""); });
    return () => ctl.abort();
  }, [tab, content]);

  // ---- text formatting helpers ----
  const edit = useCallback((fn: (v: string, s: number, e: number) => { v: string; s: number; e: number }) => {
    const el = ta.current; if (!el) return;
    const r = fn(content, el.selectionStart, el.selectionEnd);
    setContent(r.v);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.s, r.e); });
  }, [content]);
  const wrap = (a: string, b: string, ph: string) => edit((v, s, e) => { const sel = v.slice(s, e) || ph; return { v: v.slice(0, s) + a + sel + b + v.slice(e), s: s + a.length, e: s + a.length + sel.length }; });
  const prefix = (p: string) => edit((v, s, e) => {
    const start = v.lastIndexOf("\n", s - 1) + 1, block = v.slice(start, e).split("\n").map((l) => p + l).join("\n");
    return { v: v.slice(0, start) + block + v.slice(e), s: start, e: start + block.length };
  });
  const link = () => edit((v, s, e) => { const t = v.slice(s, e) || "havola matni", ins = `[${t}](https://)`, us = s + t.length + 3; return { v: v.slice(0, s) + ins + v.slice(e), s: us, e: us + 8 }; });

  // ---- images ----
  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const errs: string[] = [], added: Item[] = [];
    for (const f of Array.from(list)) {
      if (items.length + added.length >= MAX_IMAGES_PER_POST) { errs.push(`Ko‘pi bilan ${MAX_IMAGES_PER_POST} ta rasm qo‘shish mumkin`); break; }
      try { const p = await prepareImage(f); added.push({ key: nextKey(), src: URL.createObjectURL(p), file: p, name: p.name, size: p.size, alt: "", isCover: false, state: "idle" }); }
      catch (e) { errs.push((e as Error).message); }
    }
    setImgMsgs(errs);
    if (added.length) setItems((cur) => {
      const all = [...cur, ...added];
      if (!all.some((i) => i.isCover) && !legacyCover) all[0] = { ...all[0], isCover: true };
      return all;
    });
  };
  const replaceFile = async (key: string, list: FileList | null) => {
    const f = list?.[0]; if (!f) return;
    try {
      const p = await prepareImage(f);
      setItems((cur) => cur.map((i) => i.key === key ? { key: nextKey(), src: URL.createObjectURL(p), file: p, name: p.name, size: p.size, alt: i.alt, isCover: i.isCover, state: "idle" } : i));
      setImgMsgs([]);
    } catch (e) { setImgMsgs([(e as Error).message]); }
  };
  const move = (i: number, d: number) => setItems((cur) => { const n = [...cur], j = i + d; if (j < 0 || j >= n.length) return cur; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const remove = (key: string) => setItems((cur) => {
    const gone = cur.find((i) => i.key === key); if (gone?.file) URL.revokeObjectURL(gone.src);
    const n = cur.filter((i) => i.key !== key);
    if (gone?.isCover && n.length && !legacyCover) n[0] = { ...n[0], isCover: true };
    return n;
  });
  const setCover = (key: string) => { setLegacyCover(null); setItems((cur) => cur.map((i) => ({ ...i, isCover: i.key === key }))); };

  // ---- save ----
  const save = async (mode: "draft" | "publish") => {
    setMsg(null); setFieldErr({});
    if (items.some((i) => i.state === "uploading")) return;
    setBusy(mode);
    try {
      let list = items;
      if (list.length && !list.some((i) => i.isCover) && !legacyCover) { list = list.map((x, n) => (n === 0 ? { ...x, isCover: true } : x)); setItems(list); }
      const uploaded: Record<string, string> = {};
      const payload = (id: string, m: "draft" | "publish", first: boolean) => ({
        id, mode: m, title, content, excerpt, categoryIds: catIds, tags, sourceUrl,
        // Keep the exact stored timestamp unless the author changed the field (the input only has minute precision).
        publishedAt: when && when === isoToLocal(initial.publishedAt) ? initial.publishedAt : when ? new Date(when).toISOString() : null, coverUrl: legacyCover,
        media: list.flatMap((it, order) => { const mid = it.id ?? uploaded[it.key]; return mid && (!it.file || !first) ? [{ id: mid, alt: it.alt, order, isCover: it.isCover }] : []; }),
        newCover: first && list.some((i) => i.file && i.isCover),
      });
      // A post that is not live yet is first saved as a draft, then published once all its images are stored,
      // so visitors never see it half-finished.
      const twoPhase = mode === "publish" && status !== "PUBLISHED" && list.some((i) => i.file);
      const r = await savePost(payload(postId, twoPhase ? "draft" : mode, true));
      if (!r.ok) { setMsg({ type: "error", text: r.error }); setFieldErr(r.fields ?? {}); return; }
      setPostId(r.id); setStatus(r.status);
      if (initial.id === "new") window.history.replaceState(null, "", `/admin/posts/${r.id}`);

      // Upload new images one request at a time (each stays under the host's body limit).
      let failed = 0;
      for (let order = 0; order < list.length; order++) {
        const it = list[order]; if (!it.file) continue;
        setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, state: "uploading", error: undefined } : x)));
        try {
          const up = await uploadOne(r.id, it, order);
          uploaded[it.key] = up.id;
          setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, id: up.id, file: undefined, state: "idle" } : x)));
        } catch (e) {
          failed++;
          setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, state: "failed", error: (e as Error).message } : x)));
        }
      }
      if (failed) {
        setMsg({ type: "error", text: `${failed} ta rasm yuklanmadi${twoPhase ? "; yozuv qoralama sifatida saqlandi va hali e’lon qilinmadi" : ""}. Pastdagi xatolarni ko‘ring va qayta saqlang.` });
        return;
      }
      if (twoPhase) {
        const r2 = await savePost(payload(r.id, "publish", false));
        if (!r2.ok) { setMsg({ type: "error", text: `Rasmlar saqlandi, lekin e’lon qilib bo‘lmadi: ${r2.error}` }); return; }
        setStatus(r2.status);
      }
      leaving.current = true;
      window.location.assign("/admin?saqlandi=1");
    } finally { setBusy(null); }
  };

  const err = (k: string) => fieldErr[k]?.[0] && <p role="alert" className="text-sm text-red-700 mt-1">{fieldErr[k]![0]}</p>;
  const tools: [string, string, () => void][] = [
    ["Qalin", "B", () => wrap("**", "**", "qalin matn")], ["Kursiv", "I", () => wrap("*", "*", "kursiv matn")], ["Sarlavha", "H", () => prefix("## ")],
    ["Ro‘yxat", "•", () => prefix("- ")], ["Iqtibos", "”", () => prefix("> ")], ["Havola", "Havola", link],
  ];
  const published = status === "PUBLISHED" && initial.publishedAt && new Date(initial.publishedAt) <= new Date();

  return (
    <div className="grid lg:grid-cols-[1fr_20rem] gap-x-10 gap-y-8">
      <div className="space-y-6 min-w-0">
        <div>
          <label htmlFor="title" className="block text-sm font-semibold">Sarlavha</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Yozuv sarlavhasi" aria-invalid={!!fieldErr.title}
            className="mt-1 w-full border-0 border-b-2 border-line focus:border-ink bg-transparent px-0 py-2 headline text-4xl outline-none" />
          {err("title")}
        </div>

        <div>
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div role="tablist" aria-label="Matn rejimi" className="flex gap-1">
              {(["write", "preview"] as const).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-sm font-semibold rounded-t-[3px] border border-b-0 ${tab === t ? "bg-paper border-line" : "bg-mist border-transparent text-mute"}`}>{t === "write" ? "Yozish" : "Ko‘rinish"}</button>)}
            </div>
            {tab === "write" && <div className="flex gap-1 flex-wrap" role="toolbar" aria-label="Formatlash">
              {tools.map(([label, text, fn]) => <button key={label} type="button" onClick={fn} aria-label={label} title={label} className="btn2 !px-2.5 !py-1 min-w-9">{text}</button>)}
            </div>}
          </div>
          {tab === "write" ? (
            <textarea ref={ta} value={content} onChange={(e) => setContent(e.target.value)} rows={18} aria-label="Matn" aria-invalid={!!fieldErr.content}
              placeholder="Matnni shu yerga yozing…" className="inp !rounded-t-none font-serif !text-lg leading-relaxed" />
          ) : (
            <div className="border border-line min-h-[24rem] p-5 rounded-b-[3px]" aria-live="polite">
              {html === null ? <p className="meta">Yuklanmoqda…</p> : html ? <div className="prose-jm" dangerouslySetInnerHTML={{ __html: html }} /> : <p className="meta">Ko‘rsatadigan matn yo‘q.</p>}
            </div>
          )}
          {err("content")}
          <p className="meta mt-2">Bo‘sh qator — yangi paragraf, Enter — yangi qator. <code>**qalin**</code>, <code>*kursiv*</code>, <code>[matn](https://…)</code>; oddiy <code>https://…</code> havolalar avtomatik bosiladigan bo‘ladi.</p>
        </div>

        <div>
          <label htmlFor="excerpt" className="block text-sm font-semibold">Qisqa tavsif <span className="font-normal text-mute">(bo‘sh qolsa, matndan olinadi)</span></label>
          <textarea id="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} maxLength={500} className="inp mt-1" />
          {err("excerpt")}
        </div>

        <section aria-labelledby="img-h">
          <h2 id="img-h" className="text-sm font-semibold">Rasmlar <span className="font-normal text-mute">(JPEG, PNG, WebP; ko‘pi bilan {MAX_IMAGES_PER_POST} ta)</span></h2>
          <label className="mt-2 flex flex-col items-center justify-center border-2 border-dashed border-line rounded-[3px] px-4 py-8 text-center cursor-pointer hover:border-ink focus-within:border-ink"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
            <span className="font-semibold">Rasmlarni tanlang yoki shu yerga tashlang</span>
            <span className="meta mt-1">Katta rasmlar yuklashdan oldin avtomatik siqiladi</span>
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
          {imgMsgs.map((m, i) => <p key={i} role="alert" className="text-sm text-red-700 mt-2">{m}</p>)}

          {legacyCover && (
            <div className="mt-4 flex gap-4 items-center border border-line p-3 rounded-[3px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={legacyCover} alt="Eski muqova" className="h-20 w-28 object-cover bg-mist" />
              <div className="text-sm flex-1"><p className="font-semibold">Muqova (tashqi havola)</p><p className="meta break-all line-clamp-1">{legacyCover}</p></div>
              <button type="button" className="text-red-700 underline text-sm" onClick={() => setLegacyCover(null)}>Olib tashlash</button>
            </div>
          )}

          {items.length > 0 && (
            <ol className="mt-4 space-y-3">
              {items.map((it, i) => (
                <li key={it.key} className="flex gap-4 border border-line p-3 rounded-[3px] flex-wrap sm:flex-nowrap">
                  <div className="w-full sm:w-40 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.src} alt={it.alt || `Rasm ${i + 1} ko‘rinishi`} className="w-full h-28 object-cover bg-mist rounded-[2px]" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="font-semibold">{i + 1}-rasm</span>
                      {it.isCover && <span className="label !cursor-default hover:!bg-marker hover:!text-ink">Muqova</span>}
                      <span className="meta truncate">{it.name}{it.size ? ` · ${kb(it.size)}` : ""}</span>
                      {it.file && <span className="meta">(hali yuklanmagan)</span>}
                      {it.state === "uploading" && <span className="text-acc font-semibold" role="status">Yuklanmoqda…</span>}
                    </div>
                    <input value={it.alt} onChange={(e) => setItems((cur) => cur.map((x) => x.key === it.key ? { ...x, alt: e.target.value } : x))} maxLength={200} placeholder="Rasm tavsifi (alt matn)" aria-label={`${i + 1}-rasm tavsifi`} className="inp" />
                    {it.error && <p role="alert" className="text-sm text-red-700">{it.error}</p>}
                    <div className="flex gap-2 flex-wrap">
                      <button type="button" className="btn2 !py-1" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${i + 1}-rasmni yuqoriga`}>Yuqoriga</button>
                      <button type="button" className="btn2 !py-1" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`${i + 1}-rasmni pastga`}>Pastga</button>
                      {!it.isCover && <button type="button" className="btn2 !py-1" onClick={() => setCover(it.key)}>Muqova qilish</button>}
                      <label className="btn2 !py-1 cursor-pointer">Almashtirish<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { replaceFile(it.key, e.target.files); e.target.value = ""; }} /></label>
                      <button type="button" className="text-red-700 underline text-sm px-2" onClick={() => remove(it.key)}>O‘chirish</button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <aside className="space-y-6">
        <section className="border border-line p-4 rounded-[3px] space-y-3" aria-labelledby="pub-h">
          <h2 id="pub-h" className="font-bold">Nashr</h2>
          <p className="text-sm">Holat: <strong>{postId === "new" ? "yangi" : status === "DRAFT" ? "qoralama" : published ? "e’lon qilingan" : "rejalashtirilgan"}</strong></p>
          <div>
            <label htmlFor="when" className="block text-sm font-semibold">Nashr sanasi va vaqti</label>
            <div className="flex gap-2 mt-1"><input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="inp" />
              <button type="button" className="btn2 !px-2" onClick={() => setWhen(isoToLocal(new Date().toISOString()))}>Hozir</button></div>
            <p className="meta mt-1">Bo‘sh qoldirsangiz, e’lon qilingan payt olinadi. Kelajak vaqt — rejalashtirilgan nashr.</p>
            {err("publishedAt")}
          </div>
          {published && initial.slug && <Link href={`/posts/${initial.slug}`} className="text-sm underline block" target="_blank">Saytda ko‘rish</Link>}
        </section>

        <fieldset className="border border-line p-4 rounded-[3px]">
          <legend className="font-bold px-1">Kategoriyalar</legend>
          {categories.length === 0 ? <p className="meta">Kategoriyalar yo‘q.</p> : (
            <ul className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const on = catIds.includes(c.id);
                return (
                  <li key={c.id}>
                    <label className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-[3px] border cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-acc ${on ? "bg-marker border-marker" : "border-line hover:border-ink"}`}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => setCatIds((cur) => on ? cur.filter((x) => x !== c.id) : [...cur, c.id])} />
                      <span aria-hidden className={`inline-block h-3.5 w-3.5 border-2 rounded-[2px] ${on ? "bg-ink border-ink" : "border-mute"}`} />{c.name}
                    </label>
                  </li>);
              })}
            </ul>)}
          <p className="meta mt-3">Bir nechtasini tanlash mumkin. <Link href="/admin/categories" className="underline">Kategoriyalarni boshqarish</Link></p>
        </fieldset>

        <section className="border border-line p-4 rounded-[3px] space-y-3">
          <div><label htmlFor="tags" className="block text-sm font-semibold">Teglar <span className="font-normal text-mute">(vergul bilan)</span></label>
            <input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} className="inp mt-1" /></div>
          <div><label htmlFor="src" className="block text-sm font-semibold">Manba havolasi <span className="font-normal text-mute">(ixtiyoriy)</span></label>
            <input id="src" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" className="inp mt-1" />{err("sourceUrl")}</div>
        </section>
      </aside>

      <div className="fixed bottom-0 inset-x-0 z-20 bg-paper/95 backdrop-blur border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-3 flex items-center gap-3 flex-wrap">
          <p className={`text-sm flex-1 min-w-[12rem] ${msg?.type === "error" ? "text-red-700" : ""}`} role={msg ? "alert" : undefined}>
            {msg ? msg.text : dirty ? "Saqlanmagan o‘zgarishlar bor" : busy ? "Saqlanmoqda…" : ""}
          </p>
          <button type="button" className="btn2" disabled={!!busy} onClick={() => save("draft")}>{busy === "draft" ? "Saqlanmoqda…" : "Qoralama sifatida saqlash"}</button>
          <button type="button" className="btn" disabled={!!busy} onClick={() => save("publish")}>{busy === "publish" ? "Saqlanmoqda…" : published ? "Yangilash" : "E’lon qilish"}</button>
        </div>
      </div>
    </div>
  );
}
