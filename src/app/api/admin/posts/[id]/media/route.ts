import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAdminId, sameOrigin } from "@/lib/auth";
import { ImageError, safeFilename, validateImage } from "@/lib/image";
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_POST } from "@/lib/constants";

export const runtime = "nodejs";
const err = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * Upload ONE image (multipart: file, order, alt, isCover) for a post and store its bytes in PostgreSQL.
 * One image per request keeps every request under Vercel's ~4.5 MB body limit.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAdminId())) return err("Ruxsat yo‘q", 401);
  if (!sameOrigin(req)) return err("So‘rov manbasi noto‘g‘ri", 403);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES + 512 * 1024) return err("Rasm juda katta", 413);

  const { id: postId } = await ctx.params;
  try {
    if (!(await db.post.findUnique({ where: { id: postId }, select: { id: true } }))) return err("Nashr topilmadi", 404);

    let form: FormData;
    try { form = await req.formData(); } catch { return err("So‘rov formati noto‘g‘ri", 400); }
    const file = form.get("file");
    if (!(file instanceof File)) return err("Rasm fayli topilmadi", 400);

    const buf = Buffer.from(await file.arrayBuffer());
    let info;
    try { info = validateImage(buf, file.type, file.name); }
    catch (e) { if (e instanceof ImageError) return err(e.message, 422); throw e; }

    const order = Math.min(Math.max(parseInt(String(form.get("order") ?? "0"), 10) || 0, 0), 999);
    const alt = String(form.get("alt") ?? "").trim().slice(0, 200);
    const isCover = form.get("isCover") === "true";

    const row = await db.$transaction(async (tx) => {
      if ((await tx.media.count({ where: { postId } })) >= MAX_IMAGES_PER_POST) return null;
      if (isCover) await tx.media.updateMany({ where: { postId, isCover: true }, data: { isCover: false } });
      return tx.media.create({
        data: { postId, type: "IMAGE", data: new Uint8Array(buf), mimeType: info.mime, filename: safeFilename(file.name), size: buf.length, width: info.width, height: info.height, alt, order, isCover },
        select: { id: true, order: true, isCover: true, width: true, height: true },
      });
    });
    if (!row) return err(`Bitta nashrga ko‘pi bilan ${MAX_IMAGES_PER_POST} ta rasm qo‘shish mumkin`, 422);
    revalidatePath("/", "layout");
    return NextResponse.json({ ...row, src: `/api/media/${row.id}` }, { status: 201 });
  } catch (e) {
    console.error("[media upload]", e instanceof Error ? e.message : "noma’lum xato");
    return err("Rasmni saqlab bo‘lmadi. Qayta urinib ko‘ring.", 500);
  }
}
