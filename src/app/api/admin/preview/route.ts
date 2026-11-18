import { NextResponse } from "next/server";
import { getAdminId, sameOrigin } from "@/lib/auth";
import { renderContent } from "@/lib/content";

export const runtime = "nodejs";

/** Renders editor text with the exact sanitizer the public site uses (admin only). */
export async function POST(req: Request) {
  if (!(await getAdminId())) return NextResponse.json({ error: "Ruxsat yo‘q" }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "So‘rov manbasi noto‘g‘ri" }, { status: 403 });
  let body: { content?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON noto‘g‘ri" }, { status: 400 }); }
  if (typeof body.content !== "string" || body.content.length > 100000) return NextResponse.json({ error: "Matn noto‘g‘ri" }, { status: 422 });
  return NextResponse.json({ html: renderContent(body.content) });
}
