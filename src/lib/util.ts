import type { Prisma } from "@prisma/client";

export const SITE = (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

function validZone(z: string | undefined) {
  const zone = z || "Asia/Tashkent";
  try { new Intl.DateTimeFormat("en-GB", { timeZone: zone }); return zone; } catch { return "Asia/Tashkent"; }
}
export const TZ = validZone(process.env.SITE_TIMEZONE);

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[ʻʼ’‘`'´]/g, "") // o‘zgarish -> ozgarish, ma'lumot -> malumot
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "post";
}

export const readMin = (t: string) => Math.max(1, Math.round(t.trim().split(/\s+/).length / 180));

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const dtf = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function parts(d: Date) {
  const o: Record<string, string> = {};
  for (const p of dtf.formatToParts(d)) o[p.type] = p.value;
  return o;
}
/** "17-noyabr, 2026" in the site time zone (never the server's local zone). */
export function fmtDate(d: Date | null | undefined) {
  if (!d) return "";
  const p = parts(d);
  return `${Number(p.day)}-${MONTHS[Number(p.month) - 1]}, ${p.year}`;
}
/** "14:30" in the site time zone. */
export function fmtTime(d: Date | null | undefined) {
  if (!d) return "";
  const p = parts(d);
  return `${p.hour}:${p.minute}`;
}
export const fmt = fmtDateTime;
export function fmtDateTime(d: Date | null | undefined) {
  return d ? `${fmtDate(d)}, ${fmtTime(d)}` : "";
}

/** Visible to the public: published and its publication time has arrived. */
export const live = (): Prisma.PostWhereInput => ({ status: "PUBLISHED", publishedAt: { lte: new Date() } });

export function absUrl(path: string) {
  return /^https?:\/\//i.test(path) ? path : `${SITE}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** 00:00 of a "yyyy-mm-dd" day in the site time zone, as an absolute Date (null if the input is not a valid date). */
export function zonedDayStart(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  if (Number.isNaN(guess)) return null;
  const p = parts(new Date(guess));
  const offset = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - guess;
  return new Date(guess - offset);
}
