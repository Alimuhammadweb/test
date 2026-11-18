import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "jm_admin";
const sec = () => { const s = process.env.SESSION_SECRET || ""; return s.length >= 16 ? s : ""; };
const sign = (v: string) => createHmac("sha256", sec()).update(v).digest("hex");

export async function setSession(uid: string) {
  const exp = Date.now() + 7 * 864e5, v = `${uid}.${exp}`;
  (await cookies()).set(COOKIE, `${v}.${sign(v)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 86400 });
}
export async function clearSession() { (await cookies()).delete(COOKIE); }

/** Returns the admin id for a valid session, otherwise null. Never redirects (use in API routes). */
export async function getAdminId(): Promise<string | null> {
  const c = (await cookies()).get(COOKIE)?.value;
  const p = c?.split(".");
  if (!sec() || !p || p.length !== 3) return null;
  const a = Buffer.from(sign(`${p[0]}.${p[1]}`)), b = Buffer.from(p[2]);
  if (a.length !== b.length || !timingSafeEqual(a, b) || !(Number(p[1]) > Date.now())) return null;
  return p[0];
}
/** For pages and server actions: redirects to the login page when not signed in. */
export async function requireAdmin() {
  const id = await getAdminId();
  if (!id) redirect("/admin/login");
  return id;
}
/** Defense in depth for cookie-authenticated mutating API routes: the request must come from this site. */
export function sameOrigin(req: Request) {
  const o = req.headers.get("origin");
  if (!o) return true; // non-browser clients; the session cookie is still required
  try { return new URL(o).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host")); } catch { return false; }
}
